(function(global) {
  'use strict';

  class AIClient {
    static _modelCache = null;

    constructor(options = {}) {
      this.config = {
        apiKey: options.apiKey || null,
        model: options.model || 'openai',
        systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
        width: options.width || 1024,
        height: options.height || 1024,
        history: [],
        historyLimit: options.historyLimit || 10,
        timeout: options.timeout || 60000,
        seed: options.seed ?? null,
        retry: options.retry !== undefined ? options.retry : true,
        retryAttempts: options.retryAttempts || 2,
        retryDelay: options.retryDelay || 1000,
        stream: options.stream ?? false
      };
      
      // Init cache check
      this._initModelCache();
    }

    // --- Setters for Chaining ---
    setApiKey(k) { this.config.apiKey = String(k); return this; }
    setModel(m) { this.config.model = String(m); return this; }
    setSystemPrompt(p) { this.config.systemPrompt = String(p); return this; }
    setTimeout(ms) { this.config.timeout = Number(ms) || 60000; return this; }
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

    // --- Model Cache Logic ---
    async _initModelCache() {
      if (AIClient._modelCache) return;
      try {
        // No auth required for model list endpoint
        const res = await fetch('https://gen.pollinations.ai/v1/models');
        if (res.ok) {
          const data = await res.json();
          AIClient._modelCache = data.data || [];
        }
      } catch (e) {
        console.warn("AIClient: Could not fetch model list, using fallback.");
        AIClient._modelCache = []; 
      }
    }

    // Determines type based on cached model info
    async _getModelType(modelId) {
      if (!AIClient._modelCache) await this._initModelCache();
      
      const modelInfo = AIClient._modelCache.find(m => m.id === modelId);
      
      // If found and has image output, it's an image model
      if (modelInfo && modelInfo.output_modalities && modelInfo.output_modalities.includes('image')) {
        return 'image';
      }
      
      // Default to text for everything else (text models, unknown models, or audio models)
      return 'text';
    }

    // --- Main Generate Method ---
    async generate(input, options = {}) {
      if (!this.config.apiKey) throw new Error("AIClient: API Key is required.");
      if (!input?.trim()) throw new Error("AIClient: Input prompt cannot be empty.");

      // Determine model and type
      const activeModel = options.model || this.config.model;
      const detectedType = await this._getModelType(activeModel);
      const isImg = detectedType === 'image';

      // Handle Streaming Text separately
      if (!isImg && (options.stream !== undefined ? options.stream : this.config.stream)) {
        return this._handleStreamingText(input, options);
      }

      // --- Standard POST Request (Image or Non-Streaming Text) ---
      const url = isImg 
        ? 'https://gen.pollinations.ai/v1/images/generations' 
        : 'https://gen.pollinations.ai/v1/chat/completions';

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeout);
      const activeSeed = this.config.seed || Math.floor(Math.random() * 1e9);

      const payload = isImg ? {
        prompt: input,
        model: activeModel, // Use the determined model
        width: this.config.width,
        height: this.config.height,
        nologo: true,
        response_format: "b64_json",
        seed: activeSeed
      } : {
        model: activeModel,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.config.history,
          { role: 'user', content: input }
        ],
        seed: activeSeed
      };

      try {
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
          if (this.config.retry && (options.attempt || 0) < this.config.retryAttempts && retryable) {
            await new Promise(r => setTimeout(r, this.config.retryDelay));
            return this.generate(input, { ...options, attempt: (options.attempt || 0) + 1 });
          }
          const errText = await response.text();
          throw new Error(`AI API Error ${response.status}: ${errText}`);
        }

        const data = await response.json();

        if (isImg) {
          // --- IMAGE PROCESSING (Base64 -> Blob) ---
          const b64 = data.data?.[0]?.b64_json;
          if (!b64) throw new Error("No image data returned");
          return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
        } else {
          // --- TEXT PROCESSING ---
          const content = data.choices?.[0]?.message?.content;
          if (!content) throw new Error("Invalid text response");
          
          this.config.history.push({ role: 'user', content: input });
          this.config.history.push({ role: 'assistant', content });
          if (this.config.history.length > this.config.historyLimit * 2) {
            this.config.history.splice(0, 2);
          }
          return content;
        }

      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') {
          if (this.config.retry && (options.attempt || 0) < this.config.retryAttempts) {
            return this.generate(input, { ...options, attempt: (options.attempt || 0) + 1 });
          }
          throw new Error("AI Request Timeout");
        }
        throw err;
      }
    }

    // --- Internal Streaming Handler ---
    async _handleStreamingText(input, options) {
      const onStream = typeof options.onStream === 'function' ? options.onStream : null;
      const activeModel = options.model || this.config.model;
      
      const url = 'https://gen.pollinations.ai/v1/chat/completions';
      const activeSeed = this.config.seed || Math.floor(Math.random() * 1e9);

      const payload = {
        model: activeModel,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.config.history,
          { role: 'user', content: input }
        ],
        stream: true,
        seed: activeSeed
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.config.timeout);

      try {
        const res = await fetch(url, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json', 
            'Authorization': `Bearer ${this.config.apiKey}` 
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timer);
        if (!res.ok) throw new Error(`Stream Error ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullText = '';

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (let line of lines) {
            line = line.trim();
            if (!line || !line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (jsonStr === '[DONE]') continue;
            try {
              const parsed = JSON.parse(jsonStr);
              const chunk = parsed?.choices?.[0]?.delta?.content;
              if (chunk) {
                fullText += chunk;
                if (onStream) onStream(chunk);
              }
            } catch (e) { /* Ignore parse errors */ }
          }
        }

        this.config.history.push({ role: 'user', content: input });
        this.config.history.push({ role: 'assistant', content: fullText });
        if (this.config.history.length > this.config.historyLimit * 2) {
          this.config.history.splice(0, 2);
        }
        return null; 

      } catch (err) {
        clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error("AI Request Timeout");
        throw err;
      }
    }
  }

  global.AIClient = AIClient;

})(window);
