import { BaseProvider } from '../BaseProvider.js';
import { readNdjson } from '../SseParser.js';

/** Ollama / LM Studio lokal: tanpa API key, data tidak keluar dari perangkat. */
export class OllamaProvider extends BaseProvider {
  headers() {
    return { 'content-type': 'application/json' };
  }

  async chat(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}) {
    const response = await this.request(`${this.baseURL}/api/chat`, {
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: false,
        options: { temperature, num_predict: maxTokens }
      })
    });
    const data = await response.json();
    return {
      text: data.message?.content || '',
      usage: {
        in: data.prompt_eval_count || 0,
        out: data.eval_count || 0
      }
    };
  }

  async stream(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}, onToken) {
    const response = await this.request(`${this.baseURL}/api/chat`, {
      headers: this.headers(),
      body: JSON.stringify({
        model: this.model,
        messages,
        stream: true,
        options: { temperature, num_predict: maxTokens }
      })
    });
    let text = '';
    let usage = { in: 0, out: 0 };
    for await (const line of readNdjson(response)) {
      let json;
      try {
        json = JSON.parse(line);
      } catch {
        continue;
      }
      const delta = json.message?.content || '';
      if (delta) {
        text += delta;
        onToken?.(delta);
      }
      if (json.done) {
        usage = { in: json.prompt_eval_count || 0, out: json.eval_count || 0 };
      }
    }
    return { text, usage };
  }

  async listModels() {
    const response = await this.request(`${this.baseURL}/api/tags`, { method: 'GET', headers: this.headers() });
    const data = await response.json();
    return (data.models || []).map((item) => item.name).filter(Boolean);
  }
}
