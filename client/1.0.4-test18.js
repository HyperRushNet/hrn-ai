class AIClient extends EventTarget {
  static _chatIds = new Set();
  static async getModels() {
    const res = await fetch('https://gen.pollinations.ai/v1/models');
    if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
    const data = await res.json();
    return data?.data || [];
  }

  constructor(options = {}) {
    super();
    this.models = null;
    this.config = { chatId: null, history: [], systemPrompt: 'You are a helpful assistant.', modelAlias: 'openai', apiKey: null, width: 1024, height: 1024, timeout: 60000, retry: true, retryAttempts: 2, retryDelay: 1000, stream: false, ...options };
    if (this.config.chatId) {
      if (AIClient._chatIds.has(this.config.chatId)) throw new Error(`chatId "${this.config.chatId}" already exists`);
      AIClient._chatIds.add(this.config.chatId);
    }
  }

  async _resolveModel() {
    if (!this.models) this.models = await AIClient.getModels();
    const model = this.models.find(m => m.id === this.config.modelAlias);
    if (!model) throw new Error(`Model alias "${this.config.modelAlias}" not found`);
    if (model.input_modalities.includes('image')) return 'image';
    return 'text';
  }

  clearHistory() {
    this.config.history = [];
    return this;
  }

  async generate(input) {
    if (!input || !input.trim()) throw new Error("Input prompt cannot be empty.");
    const type = await this._resolveModel();
    const endpoint = type === 'image'
      ? 'https://gen.pollinations.ai/v1/images/generations'
      : 'https://gen.pollinations.ai/v1/chat/completions';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      if (type === 'image') {
        const payload = { prompt: input, model: this.config.modelAlias, size: `${this.config.width}x${this.config.height}`, response_format: "b64_json", nologo: true };
        const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        const b64 = data?.data?.[0]?.b64_json;
        if (!b64) throw new Error("Invalid image response");
        const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
        this.dispatchEvent(new CustomEvent("message", { detail: { data: blob, chatId: this.config.chatId, stream: false } }));
      } else {
        const payload = { model: this.config.modelAlias, messages: [{ role: 'system', content: this.config.systemPrompt }, ...this.config.history, { role: 'user', content: input }], stream: this.config.stream };
        const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        if (this.config.stream) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              const msg = trimmed.startsWith('data: ') ? trimmed.slice(6) : trimmed;
              if (msg === '[DONE]') {
                this.dispatchEvent(new CustomEvent("message", { detail: { data: false, chatId: this.config.chatId, stream: true } }));
                return;
              }
              try {
                const parsed = JSON.parse(msg);
                const content = parsed?.choices?.[0]?.delta?.content;
                if (content) this.dispatchEvent(new CustomEvent("message", { detail: { data: content, chatId: this.config.chatId, stream: true } }));
              } catch {}
            }
          }
          this.dispatchEvent(new CustomEvent("message", { detail: { data: false, chatId: this.config.chatId, stream: true } }));
        } else {
          clearTimeout(timer);
          const data = await res.json();
          const content = data?.choices?.[0]?.message?.content;
          if (!content) throw new Error("Invalid text response");
          this.dispatchEvent(new CustomEvent("message", { detail: { data: content, chatId: this.config.chatId, stream: false } }));
        }
      }
    } catch (err) {
      clearTimeout(timer);
      if (err.name === 'AbortError') throw new Error("AI Request Timeout");
      throw err;
    } finally {
      if (this.config.chatId) AIClient._chatIds.delete(this.config.chatId);
    }
  }

  destroy() {
    if (this.config.chatId) AIClient._chatIds.delete(this.config.chatId);
  }
}
