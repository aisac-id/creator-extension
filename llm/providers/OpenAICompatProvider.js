import { BaseProvider } from '../BaseProvider.js';
import { readSse } from '../SseParser.js';

/** Satu class untuk semua endpoint OpenAI-compatible (OpenAI, Groq, DeepSeek, OpenRouter, xAI, LM Studio). */
export class OpenAICompatProvider extends BaseProvider {
  headers() {
    return {
      'content-type': 'application/json',
      authorization: `Bearer ${this.apiKey}`,
      'HTTP-Referer': 'https://github.com/aisac-id/creator-extension',
      'X-Title': 'Creator Harness'
    };
  }

  async chat(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}) {
    const response = await this.request(`${this.baseURL}/chat/completions`, {
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens
      })
    });
    const data = await response.json();
    return {
      text: data.choices?.[0]?.message?.content || '',
      usage: {
        in: data.usage?.prompt_tokens || this.estimateTokens(messages.map((m) => m.content).join(' ')),
        out: data.usage?.completion_tokens || this.estimateTokens(data.choices?.[0]?.message?.content || '')
      }
    };
  }

  async stream(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}, onToken) {
    const response = await this.request(`${this.baseURL}/chat/completions`, {
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream: true,
        stream_options: { include_usage: true }
      })
    });
    let text = '';
    let usage = null;
    for await (const data of readSse(response)) {
      if (data === '[DONE]') break;
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = json.choices?.[0]?.delta?.content || '';
      if (delta) {
        text += delta;
        onToken?.(delta);
      }
      if (json.usage) {
        usage = { in: json.usage.prompt_tokens || 0, out: json.usage.completion_tokens || 0 };
      }
    }
    return {
      text,
      usage: usage || { in: this.estimateTokens(messages.map((m) => m.content).join(' ')), out: this.estimateTokens(text) }
    };
  }

  async listModels() {
    const response = await this.request(`${this.baseURL}/models`, {
      method: 'GET',
      headers: this.headers()
    });
    const data = await response.json();
    return (data.data || []).map((item) => item.id).filter(Boolean);
  }
}
