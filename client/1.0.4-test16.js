class AIClient extends EventTarget {
  static _chatIds = new Set();

  constructor(options = {}) {
    super();
    const cfg = Object.freeze({
      apiKey: options.apiKey || null,
      model: options.model || 'openai',
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      width: options.width || 1024,
      height: options.height || 1024,
      historyLimit: options.historyLimit || 10,
      timeout: options.timeout || 60000,
      retry: options.retry !== undefined ? options.retry : true,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000,
      chatId: options.chatId ?? null,
      stream: options.stream ?? false,
      isImage: options.isImage ?? false
    });
    if (cfg.chatId) {
      if (AIClient._chatIds.has(cfg.chatId)) throw new Error(`chatId "${cfg.chatId}" already exists`);
      AIClient._chatIds.add(cfg.chatId);
    }
    this.config = { ...cfg, history: [] };
  }

  clearHistory() {
    this.config.history = [];
    return this;
  }

  async generate(input) {
    if (!input || !input.trim()) throw new Error("Input prompt cannot be empty.");
    const type = this.config.isImage ? 'image' : 'text';
    const endpoint = type === 'image'
      ? 'https://gen.pollinations.ai/v1/images/generations'
      : 'https://gen.pollinations.ai/v1/chat/completions';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const headers = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;

      if (type === 'image') {
        const payload = {
          prompt: input,
          model: this.config.model,
          size: `${this.config.width}x${this.config.height}`,
          response_format: "b64_json",
          nologo: true
        };
        const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`API Error: ${res.status}`);
        const data = await res.json();
        if (!data?.data?.[0]?.b64_json) throw new Error("Invalid image response");
        const b64 = data.data[0].b64_json;
        const blob = new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
        this.dispatchEvent(new CustomEvent("message", { detail: { data: blob, chatId: this.config.chatId, stream: false } }));
      } else {
        const payload = {
          model: this.config.model,
          messages: [{ role: 'system', content: this.config.systemPrompt }, ...this.config.history, { role: 'user', content: input }],
          stream: this.config.stream
        };
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
              const trimmedLine = line.trim();
              if (!trimmedLine) continue;

              const message = trimmedLine.startsWith('data: ') ? trimmedLine.slice(6) : trimmedLine;

              if (message === '[DONE]') {
                this.dispatchEvent(new CustomEvent("message", { detail: { data: false, chatId: this.config.chatId, stream: true } }));
                return;
              }

              try {
                const parsed = JSON.parse(message);
                const content = parsed?.choices?.[0]?.delta?.content;
                if (content) {
                  this.dispatchEvent(new CustomEvent("message", { detail: { data: content, chatId: this.config.chatId, stream: true } }));
                }
              } catch (e) {
                 console.warn("Stream parse error:", e);
              }
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
