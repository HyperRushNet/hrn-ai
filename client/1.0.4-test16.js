(function(global) {
  'use strict';

  class AIClient {
    static _chatIds = new Set();

    constructor(options = {}) {
      const cfg = {
        apiKey: options.apiKey || null,
        model: options.model || 'openai',
        systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
        width: options.width || 1024,
        height: options.height || 1024,
        historyLimit: options.historyLimit || 10,
        timeout: options.timeout || 60000,
        seed: options.seed ?? null,
        retry: options.retry !== undefined ? options.retry : true,
        retryAttempts: options.retryAttempts || 2,
        retryDelay: options.retryDelay || 1000,
        chatId: options.chatId ?? null,
        stream: options.stream ?? false,
        baseUrl: options.baseUrl || 'https://gen.pollinations.ai/v1'
      };

      if (cfg.chatId) {
        if (AIClient._chatIds.has(cfg.chatId)) {
          throw new Error(`chatId "${cfg.chatId}" already exists`);
        }
        AIClient._chatIds.add(cfg.chatId);
      }

      this.config = { ...cfg, history: [] };
      this._modelCache = null;
    }

    async _getModelInfo() {
      if (this._modelCache) {
        return this._modelCache.find(m => m.id === this.config.model);
      }
      try {
        const res = await fetch(`${this.config.baseUrl}/models`, {
          headers: this._getHeaders(true)
        });
        if (!res.ok) return null;
        const data = await res.json();
        this._modelCache = data.data || [];
        return this._modelCache.find(m => m.id === this.config.model) || null;
      } catch (e) {
        return null;
      }
    }

    _getHeaders(isGet = false) {
      const headers = {};
      if (!isGet) headers['Content-Type'] = 'application/json';
      if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      return headers;
    }

    async generate(prompt, options = {}) {
      if (!prompt || typeof prompt !== 'string') throw new Error('Prompt required');

      const streamOpt = options.stream !== undefined ? options.stream : this.config.stream;
      const onStream = typeof options.onStream === 'function' ? options.onStream : null;

      const payload = {
        model: this.config.model,
        messages: [
          { role: 'system', content: this.config.systemPrompt },
          ...this.config.history,
          { role: 'user', content: prompt }
        ],
        stream: streamOpt,
        seed: this.config.seed ?? Math.floor(Math.random() * 1e9),
        response_format: streamOpt ? { type: 'json_object' } : undefined
      };

      const executeRequest = async (attempt = 1) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.config.timeout);

        try {
          const res = await fetch(`${this.config.baseUrl}/chat/completions`, {
            method: 'POST',
            headers: this._getHeaders(),
            body: JSON.stringify(payload),
            signal: controller.signal
          });

          clearTimeout(timer);

          if (!res.ok) {
            const errText = await res.text();
            throw new Error(`API Error ${res.status}: ${errText}`);
          }

          if (streamOpt && res.body) {
            return await this._handleStreamResponse(res.body, onStream);
          } else {
            const data = await res.json();
            const text = data?.choices?.[0]?.message?.content;
            if (!text) throw new Error('Invalid response');
            this._updateHistory(prompt, text);
            return text;
          }
        } catch (e) {
          clearTimeout(timer);
          if (e.name === 'AbortError') throw new Error('Request timed out');
          
          if (this.config.retry && attempt < this.config.retryAttempts) {
            await new Promise(r => setTimeout(r, this.config.retryDelay));
            return executeRequest(attempt + 1);
          }
          throw e;
        }
      };

      return executeRequest();
    }

    async _handleStreamResponse(body, onStream) {
      const reader = body.getReader();
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
          
          const jsonStr = line.slice(6);
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            const chunk = parsed?.choices?.[0]?.delta?.content;
            if (chunk) {
              fullText += chunk;
              if (onStream) onStream(chunk);
            }
          } catch (parseError) {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
      
      this._updateHistory(payload.messages[payload.messages.length - 1].content, fullText);
      return null; 
    }

    async generateImage(prompt, options = {}) {
      if (!prompt) throw new Error('Prompt required for image generation');
      
      const payload = {
        prompt: prompt,
        model: options.model || this.config.model,
        size: options.size || `${this.config.width}x${this.config.height}`,
        response_format: options.response_format || 'url',
        seed: options.seed ?? this.config.seed
      };

      try {
        const res = await fetch(`${this.config.baseUrl}/images/generations`, {
          method: 'POST',
          headers: this._getHeaders(),
          body: JSON.stringify(payload)
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Image API Error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        return data.data?.[0]?.url || data.data?.[0]?.b64_json;
      } catch (e) {
        throw e;
      }
    }

    async listModels() {
      try {
        const res = await fetch(`${this.config.baseUrl}/models`, {
          headers: this._getHeaders(true)
        });
        if (!res.ok) throw new Error('Failed to fetch models');
        const data = await res.json();
        return data.data || [];
      } catch (e) {
        throw e;
      }
    }

    _updateHistory(userMsg, assistantMsg) {
      this.config.history.push({ role: 'user', content: userMsg });
      this.config.history.push({ role: 'assistant', content: assistantMsg });
      if (this.config.history.length > this.config.historyLimit * 2) {
        const excess = this.config.history.length - (this.config.historyLimit * 2);
        this.config.history.splice(0, excess);
      }
    }

    clearHistory() {
      this.config.history = [];
    }

    destroy() {
      if (this.config.chatId) {
        AIClient._chatIds.delete(this.config.chatId);
      }
    }
  }

  global.AIClient = AIClient;

})(window);
