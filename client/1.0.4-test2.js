    class AIClient {
      constructor(options = {}) {
        this.config = {
          apiKey: options.apiKey || null,
          model: options.model || 'flux',
          systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
          type: options.type === 'image' ? 'image' : 'text',
          width: options.width || 1024,
          height: options.height || 1024,
          history: options.history || [],
          historyLimit: options.historyLimit || 10,
          timeout: options.timeout || 30000,
          seed: options.seed || null,
          retry: options.retry !== undefined ? options.retry : true,
          retryAttempts: options.retryAttempts || 2,
          retryDelay: options.retryDelay || 1000
        };
      }

      setApiKey(k) { this.config.apiKey = String(k); return this; }
      setModel(m) { this.config.model = String(m); return this; }
      setType(t) { this.config.type = t === 'image' ? 'image' : 'text'; return this; }
      setSystemPrompt(p) { this.config.systemPrompt = String(p); return this; }
      setTimeout(ms) { this.config.timeout = Number(ms) || 30000; return this; }
      setSeed(s) { this.config.seed = s ? Number(s) : null; return this; }
      setDimensions(w, h) {
        this.config.width = Number(w) || 1024;
        this.config.height = Number(h) || 1024;
        return this;
      }
      setRetry(bool, attempts = 2, delay = 1000) {
        this.config.retry = !!bool;
        this.config.retryAttempts = Number(attempts);
        this.config.retryDelay = Number(delay);
        return this;
      }
      clearHistory() { this.config.history = []; return this; }

      async generate(input, attempt = 0) {
        if (!this.config.apiKey) throw new Error("AIClient: API Key is required.");
        if (!input?.trim()) throw new Error("AIClient: Input prompt cannot be empty.");

        const isImg = this.config.type === 'image';
        const url = isImg ? 'https://gen.pollinations.ai/v1/images/generations' : 'https://gen.pollinations.ai/v1/chat/completions';
        
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const activeSeed = this.config.seed || Math.floor(Math.random() * 1e9);
          const payload = isImg ? {
            prompt: input,
            model: this.config.model,
            width: this.config.width,
            height: this.config.height,
            nologo: true,
            response_format: "b64_json",
            seed: activeSeed
          } : {
            model: this.config.model,
            messages: [
              { role: 'system', content: this.config.systemPrompt },
              ...this.config.history,
              { role: 'user', content: input }
            ],
            seed: activeSeed
          };

          const response = await fetch(url, {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json', 
              'Authorization': `Bearer ${this.config.apiKey}` 
            },
            signal: controller.signal,
            body: JSON.stringify(payload)
          });

          clearTimeout(timer);

          if (!response.ok) {
            const retryable = response.status >= 500 || response.status === 429;
            if (this.config.retry && attempt < this.config.retryAttempts && retryable) {
              await new Promise(r => setTimeout(r, this.config.retryDelay));
              return this.generate(input, attempt + 1);
            }
            throw new Error(`AI API Error: ${response.status} ${response.statusText}`);
          }

          const data = await response.json();

          if (isImg) {
            const b64 = data.data[0].b64_json;
            return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
          } else {
            const content = data.choices[0].message.content;
            this.config.history.push({ role: 'user', content: input }, { role: 'assistant', content });
            if (this.config.history.length > this.config.historyLimit * 2) {
              this.config.history.splice(0, 2);
            }
            return content;
          }

        } catch (err) {
          clearTimeout(timer);
          if (err.name === 'AbortError') {
            if (this.config.retry && attempt < this.config.retryAttempts) {
              return this.generate(input, attempt + 1);
            }
            throw new Error("AI Request Timeout");
          }
          throw err;
        }
      }
    }
