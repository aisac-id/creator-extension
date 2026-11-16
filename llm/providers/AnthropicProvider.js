import { BaseProvider } from '../BaseProvider.js';
import { readSse } from '../SseParser.js';

export class AnthropicProvider extends BaseProvider {
  headers() {
    return {
      'content-type': 'application/json',
      'x-api-key': this.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true'
    };
  }

  split(messages) {
    const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const rest = messages.filter((m) => m.role !== 'system').map((m) => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content
    }));
    return { system, rest };
  }

  async chat(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}) {
    const { system, rest } = this.split(messages);
    const response = await this.request(`${this.baseURL}/v1/messages`, {
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: rest
      })
    });
    const data = await response.json();
    const text = (data.content || []).filter((part) => part.type === 'text').map((part) => part.text).join('');
    return {
      text,
      usage: { in: data.usage?.input_tokens || 0, out: data.usage?.output_tokens || 0 }
    };
  }

  async stream(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}, onToken) {
    const { system, rest } = this.split(messages);
    const response = await this.request(`${this.baseURL}/v1/messages`, {
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: rest,
        stream: true
      })
    });
    let text = '';
    let usage = { in: 0, out: 0 };
    for await (const data of readSse(response)) {
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      if (json.type === 'content_block_delta' && json.delta?.text) {
        text += json.delta.text;
        onToken?.(json.delta.text);
      }
      if (json.type === 'message_delta' && json.usage) {
        usage = { in: json.usage.input_tokens || usage.in, out: json.usage.output_tokens || usage.out };
      }
      if (json.type === 'message_start' && json.message?.usage) {
        usage = { in: json.message.usage.input_tokens || 0, out: 0 };
      }
    }
    return { text, usage };
  }

  async listModels() {
    const response = await this.request(`${this.baseURL}/v1/models`, {
      method: 'GET',
      headers: this.headers()
    });
    const data = await response.json();
    return (data.data || []).map((item) => item.id).filter(Boolean);
  }
}
