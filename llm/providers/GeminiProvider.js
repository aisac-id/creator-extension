import { BaseProvider } from '../BaseProvider.js';
import { readSse } from '../SseParser.js';

export class GeminiProvider extends BaseProvider {
  headers() {
    return {
      'content-type': 'application/json',
      'x-goog-api-key': this.apiKey
    };
  }

  convert(messages) {
    const systemInstruction = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n\n');
    const contents = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
    return { systemInstruction: systemInstruction ? { parts: [{ text: systemInstruction }] } : undefined, contents };
  }

  extract(json) {
    const candidate = json.candidates?.[0];
    const parts = candidate?.content?.parts || [];
    return parts.map((part) => part.text || '').join('');
  }

  async chat(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}) {
    const body = this.convert(messages);
    const response = await this.request(
      `${this.baseURL}/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
      {
        headers: this.headers(),
        body: JSON.stringify({
          ...body,
          generationConfig: { temperature, maxOutputTokens: maxTokens }
        })
      }
    );
    const data = await response.json();
    return {
      text: this.extract(data),
      usage: {
        in: data.usageMetadata?.promptTokenCount || 0,
        out: data.usageMetadata?.candidatesTokenCount || 0
      }
    };
  }

  async stream(messages, { temperature = this.temperature, maxTokens = this.maxTokens } = {}, onToken) {
    const body = this.convert(messages);
    const response = await this.request(
      `${this.baseURL}/v1beta/models/${encodeURIComponent(this.model)}:streamGenerateContent?alt=sse`,
      {
        headers: this.headers(),
        body: JSON.stringify({
          ...body,
          generationConfig: { temperature, maxOutputTokens: maxTokens }
        })
      }
    );
    let text = '';
    let usage = { in: 0, out: 0 };
    for await (const data of readSse(response)) {
      let json;
      try {
        json = JSON.parse(data);
      } catch {
        continue;
      }
      const delta = this.extract(json);
      if (delta) {
        text += delta;
        onToken?.(delta);
      }
      if (json.usageMetadata) {
        usage = {
          in: json.usageMetadata.promptTokenCount || usage.in,
          out: json.usageMetadata.candidatesTokenCount || usage.out
        };
      }
    }
    return { text, usage };
  }

  async listModels() {
    const response = await this.request(`${this.baseURL}/v1beta/models`, {
      method: 'GET',
      headers: this.headers()
    });
    const data = await response.json();
    return (data.models || [])
      .filter((item) => (item.supportedGenerationMethods || []).includes('generateContent'))
      .map((item) => String(item.name || '').replace('models/', ''))
      .filter(Boolean);
  }
}
