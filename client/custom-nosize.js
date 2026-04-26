(function (global) {
  const FALLBACK_IMAGE_MODELS = new Set([
    'flux', 'zimage', 'kontext', 'nanobanana', 'nanobanana-2', 'nanobanana-pro',
    'seedream5', 'gptimage', 'gptimage-large', 'klein', 'p-image', 'p-image-edit',
    'veo', 'seedance', 'seedance-pro', 'wan', 'p-video'
  ]);

  class AIClient extends EventTarget {
    constructor(options = {}) {
      super();

      this._config = {
        apiKey: options.apiKey ?? null,
        model: options.model ?? 'openai',
        systemPrompt: options.systemPrompt ?? 'You are a helpful assistant.',
        historyLimit: options.historyLimit ?? 10,
        stream: options.stream ?? false,
        timeout: options.timeout ?? 60000,
        seed: options.seed ?? null,
        width: options.width ?? null,  // Veranderd: geen standaardwaarde
        height: options.height ?? null, // Veranderd: geen standaardwaarde
        retry: options.retry ?? true,
        retryAttempts: options.retryAttempts ?? 2,
        retryDelay: options.retryDelay ?? 1000,
        debug: options.debug ?? false
      };

      this.history = [];
      this._modelCache = null;
    }

    key(v) { this._config.apiKey = v; return this; }
    model(v) { this._config.model = v; return this; }
    system(v) { this._config.systemPrompt = v; return this; }
    timeout(v) { this._config.timeout = v; return this; }
    seed(v) { this._config.seed = v; return this; }
    dimensions(w, h) { this._config.width = w; this._config.height = h; return this; }

    clearHistory() {
      this.history = [];
      this._log("History cleared");
    }

    _log(...args) {
      if (this._config.debug) console.log('[AIClient]', ...args);
    }

    _validate(cfg) {
      if (!cfg.apiKey) throw new Error("Key required");
      if (!cfg.model) throw new Error("Model required");

      // Aanpassing: Alleen valideren als de waarden bestaan (niet null zijn)
      if (cfg.width !== null && cfg.width <= 0) throw new Error("Invalid width");
      if (cfg.height !== null && cfg.height <= 0) throw new Error("Invalid height");
    }

    async _fetchModelList() {
      if (this._modelCache) return this._modelCache;

      this._log("Fetching model list...");
      try {
        const res = await fetch('https://gen.pollinations.ai/v1/models');
        if (!res.ok) throw new Error();

        const data = await res.json();
        this._modelCache = data.data || [];
        this._log(`Model list cached (${this._modelCache.length} models)`);
        return this._modelCache;
      } catch (e) {
        this._log("Failed to fetch model list, using fallback.");
        return [];
      }
    }

    async _isImageModel(modelId) {
      const models = await this._fetchModelList();
      const found = models.find(m => m.id === modelId);

      if (found?.output_modalities) {
        const isImage = found.output_modalities.includes('image');
        this._log(`Model ${modelId} detected via API as ${isImage ? 'image' : 'text'}`);
        return isImage;
      }

      const isFallback = FALLBACK_IMAGE_MODELS.has(modelId.toLowerCase());
      this._log(`Model ${modelId} detected via Fallback as ${isFallback ? 'image' : 'text'}`);
      return isFallback;
    }

    async generate(prompt, options = {}) {
      if (!prompt) throw new Error("Prompt required");

      const cfg = { ...this._config, ...options };
      this._validate(cfg);

      this._log(`Generating with model: ${cfg.model}`);
      const isImage = await this._isImageModel(cfg.model);

      return isImage
        ? this._generateImage(prompt, cfg)
        : this._generateText(prompt, cfg);
    }

    async _generateText(prompt, cfg) {
      const messages = [
        { role: 'system', content: cfg.systemPrompt },
        ...this.history,
        { role: 'user', content: prompt }
      ];

      const payload = {
        model: cfg.model,
        messages,
        stream: cfg.stream
      };

      if (cfg.seed !== null && cfg.seed !== undefined) {
        payload.seed = cfg.seed;
      }

      this._log("Sending text request...", payload);

      return this._retry(cfg, async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), cfg.timeout);

        const res = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: cfg.signal || ctrl.signal
        });

        clearTimeout(timer);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`[${cfg.model}] ${err.error?.message || res.status}`);
        }

        if (cfg.stream) {
          this._log("Handling stream...");
          return this._handleStream(res, prompt, cfg);
        }

        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) throw new Error("Invalid response");

        this._log("Text response received");
        this._addToHistory(prompt, text, cfg.historyLimit);
        return text;
      });
    }

    async _handleStream(res, prompt, cfg) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      let buffer = '';
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const str = line.trim();
          if (!str.startsWith('data: ')) continue;

          const json = str.slice(6);
          if (json === '[DONE]') continue;

          try {
            const parsed = JSON.parse(json);
            const chunk = parsed.choices?.[0]?.delta?.content;

            if (chunk) {
              full += chunk;

              cfg.onStream?.(chunk);
              this.dispatchEvent(new CustomEvent('chunk', {
                detail: { data: chunk }
              }));
            }
          } catch {}
        }
      }

      this._log("Stream complete");
      this._addToHistory(prompt, full, cfg.historyLimit);
      return full;
    }

    async _generateImage(prompt, cfg) {
      const payload = {
        model: cfg.model,
        prompt,
        response_format: 'b64_json'
      };

      // Aanpassing: Voeg 'size' alleen toe als width EN height zijn ingesteld
      if (cfg.width !== null && cfg.height !== null) {
        payload.size = `${cfg.width}x${cfg.height}`;
      }

      if (cfg.seed !== null && cfg.seed !== undefined) {
        payload.seed = cfg.seed;
      }

      this._log("Sending image request...", { prompt, size: payload.size || 'default' });

      return this._retry(cfg, async () => {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), cfg.timeout);

        const res = await fetch('https://gen.pollinations.ai/v1/images/generations', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${cfg.apiKey}`
          },
          body: JSON.stringify(payload),
          signal: cfg.signal || ctrl.signal
        });

        clearTimeout(timer);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(`[${cfg.model}] Image Error: ${err.error?.message || res.status}`);
        }

        const data = await res.json();
        const img = data.data?.[0];

        if (img?.b64_json) {
          this._log("Image received (base64)");
          return this._b64ToBlob(img.b64_json);
        }

        if (img?.url) {
          this._log("Image received (URL), fetching blob...");
          const r = await fetch(img.url);
          return r.blob();
        }

        throw new Error("Invalid image response");
      });
    }

    _addToHistory(user, ai, limit) {
      if (limit === 0) return;

      this.history.push({ role: 'user', content: user });
      this.history.push({ role: 'assistant', content: ai });

      while (this.history.length > limit * 2) {
        this.history.shift();
        this.history.shift();
      }
    }

    _b64ToBlob(b64) {
      const bytes = atob(b64);
      const arr = new Uint8Array(bytes.length);

      for (let i = 0; i < bytes.length; i++) {
        arr[i] = bytes.charCodeAt(i);
      }

      return new Blob([arr], { type: 'image/png' });
    }

    async _retry(cfg, fn) {
      let lastErr;
      const attempts = cfg.retry ? cfg.retryAttempts + 1 : 1;

      for (let i = 0; i < attempts; i++) {
        try {
          return await fn();
        } catch (e) {
          lastErr = e;
          
          this._log(`Attempt ${i + 1}/${attempts} failed:`, e.message);

          if (e.name === 'AbortError') {
            throw new Error("AI Request Timeout");
          }

          if (i < attempts - 1) {
            await new Promise(r => setTimeout(r, cfg.retryDelay));
          }
        }
      }

      throw lastErr;
    }
  }

  global.AIClient = AIClient;

})(window);
