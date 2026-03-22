class AIClient {
  constructor(options = {}) {
    this.config = {
      apiKey: options.apiKey || null,
      model: options.model || 'openai', // Default to a text model
      systemPrompt: options.systemPrompt || 'You are a helpful assistant.',
      // Dimensions only used if model turns out to be image
      width: options.width || 1024,
      height: options.height || 1024,
      history: options.history || [],
      historyLimit: options.historyLimit || 10,
      timeout: options.timeout || 60000,
      seed: options.seed || null,
      retry: options.retry !== undefined ? options.retry : true,
      retryAttempts: options.retryAttempts || 2,
      retryDelay: options.retryDelay || 1000
    };
    
    // Internal cache for model metadata
    this._modelCache = null;
  }

  setHistory(h) { 
    this.config.history = Array.isArray(h) ? h.slice(-this.config.historyLimit) : []; 
    return this; 
  }

  clearHistory() { 
    this.config.history = []; 
    return this; 
  }

  /**
   * Fetches models from /v1/models and caches them.
   * Returns the model info object for the configured model.
   */
  async _getModelInfo() {
    if (this._modelCache) return this._modelCache.find(m => m.id === this.config.model);

    try {
      // Fetching the model list does not strictly require an API key according to docs
      const res = await fetch('https://gen.pollinations.ai/v1/models', {
        headers: this.config.apiKey ? { 'Authorization': `Bearer ${this.config.apiKey}` } : {}
      });
      
      if (!res.ok) throw new Error("Failed to fetch model list");
      
      const data = await res.json();
      this._modelCache = data.data || []; // Store the list
      
      const modelInfo = this._modelCache.find(m => m.id === this.config.model);
      if (!modelInfo) {
        // If model ID is not found, we assume text by default or throw error
        console.warn(`AIClient: Model '${this.config.model}' not found in registry. Assuming text endpoint.`);
        return null;
      }
      return modelInfo;
    } catch (err) {
      console.warn("AIClient: Could not fetch model registry. Falling back to text.", err);
      return null;
    }
  }

  async generate(input, attempt = 0) {
    if (!input || typeof input !== 'string' || !input.trim()) throw new Error("AIClient: Input prompt cannot be empty.");

    // 1. Determine Model Capabilities
    const modelInfo = await this._getModelInfo();
    
    // Default fallback values
    let type = 'text';
    let endpoint = 'https://gen.pollinations.ai/v1/chat/completions';

    if (modelInfo) {
      const hasImageOutput = modelInfo.output_modalities?.includes('image');
      const hasTextOutput = modelInfo.output_modalities?.includes('text');
      const supportedEndpoints = modelInfo.supported_endpoints || [];

      // Logic to decide type
      if (hasImageOutput && !hasTextOutput) {
        type = 'image';
      } else {
        type = 'text';
      }

      // Logic to decide endpoint (Prefer the first supported endpoint)
      if (supportedEndpoints.length > 0) {
        // Normalize relative vs absolute URLs if needed, but API gives relative paths mostly
        // For safety we map known paths
        const path = supportedEndpoints[0];
        if (path.startsWith('/v1')) {
             endpoint = `https://gen.pollinations.ai${path}`;
        } else if (path.startsWith('http')) {
             endpoint = path;
        } else {
             // Handle legacy style like /text/{prompt} -> usually implies base URL
             endpoint = `https://gen.pollinations.ai${path}`;
        }
      }
    }

    const isImg = (type === 'image');
    
    // Override endpoint for images if we are using the POST standard (which is usually /v1/images/generations)
    // The registry might return specific paths, but for images we need the generation endpoint.
    if (isImg) {
        endpoint = 'https://gen.pollinations.ai/v1/images/generations';
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const activeSeed = this.config.seed ?? Math.floor(Math.random() * 1e9);

      const payload = isImg ? {
        prompt: input,
        model: this.config.model,
        size: `${this.config.width}x${this.config.height}`,
        response_format: "b64_json",
        nologo: true,
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

      const headers = { 'Content-Type': 'application/json' };
      if (this.config.apiKey) {
        headers['Authorization'] = `Bearer ${this.config.apiKey}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: headers,
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
        
        let errMsg = `API Error: ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error?.message) errMsg = errJson.error.message;
        } catch { /* Ignore */ }
        
        throw new Error(errMsg);
      }

      const data = await response.json();

      if (isImg) {
        if (!data?.data?.[0]?.b64_json) throw new Error("Invalid image response structure.");
        const b64 = data.data[0].b64_json;
        return new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], { type: 'image/png' });
      } else {
        const content = data?.choices?.[0]?.message?.content;
        if (!content) throw new Error("Invalid text response structure.");
        
        this.config.history.push({ role: 'user', content: input });
        this.config.history.push({ role: 'assistant', content: content });
        
        if (this.config.history.length > this.config.historyLimit * 2) {
           this.config.history = this.config.history.slice(-this.config.historyLimit * 2);
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIClient;
}
