# AIClient

A modular, promise-based JavaScript wrapper for the Pollinations AI API. This client handles text generation and image creation with zero dependencies, designed for modern browser environments.

## Implementation

```javascript
class AIClient { constructor() { this.config = { apiKey: null, model: null, systemPrompt: 'You are a helpful assistant.', type: 'text', width: 1024, height: 1024, history: [] }; } setApiKey(k) { if (!k) throw new Error("API Key required"); this.config.apiKey = k; return this; } setModel(m) { if (!m) throw new Error("Model ID required"); this.config.model = m; return this; } setSystemPrompt(p) { if (p && typeof p === 'string') this.config.systemPrompt = p; return this; } setType(t) { if (t === 'text' || t === 'image') this.config.type = t; return this; } setWidth(w) { this.config.width = parseInt(w); return this; } setHeight(h) { this.config.height = parseInt(h); return this; } async generate(i) { if (!this.config.apiKey || !this.config.model || !i) throw new Error("Missing credentials or input"); return this.config.type === 'image' ? await this._genImg(i) : await this._genTxt(i); } async _genTxt(p) { const m = [{ role: 'system', content: this.config.systemPrompt }, ...this.config.history, { role: 'user', content: p }]; const r = await fetch('https://gen.pollinations.ai/v1/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${this.config.apiKey}` }, body: JSON.stringify({ model: this.config.model, messages: m }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error?.message || `Error: ${r.status}`); const t = d.choices[0].message.content; this.config.history.push({ role: 'user', content: p }, { role: 'assistant', content: t }); return t; } async _genImg(p) { const s = new URLSearchParams({ key: this.config.apiKey, model: this.config.model, width: this.config.width, height: this.config.height, nologo: 'true' }); const r = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(p)}?${s}`); if (!r.ok) throw new Error(`Error: ${r.status}`); return await r.blob(); } clearHistory() { this.config.history = []; return this; } }
```

---

## Requirements

* **API Key**: Must be set via `.setApiKey()`.
* **Model**: Must be set via `.setModel()`.
* **Environment**: Requires Fetch API support.

---

## Usage

### Text Generation
```javascript
const ai = new AIClient()
  .setApiKey("YOUR_API_KEY")
  .setModel("openai")
  .setType("text");

const response = await ai.generate("Explain quantum physics.");
console.log(response);
```

### Image Generation
The generator returns a literal **Blob** object for images.

```javascript
const ai = new AIClient()
  .setApiKey("YOUR_API_KEY")
  .setModel("flux")
  .setType("image")
  .setWidth(1280)
  .setHeight(720);

const blob = await ai.generate("A futuristic cityscape");
const imageUrl = URL.createObjectURL(blob);
```

---

## API Reference

### Methods

| Method | Description |
| :--- | :--- |
| `setApiKey(key)` | Sets the required authentication key. |
| `setModel(id)` | Sets the required model ID (e.g., 'openai', 'flux'). |
| `setType(type)` | Switches between 'text' and 'image' mode. |
| `setSystemPrompt(str)` | Defines the behavior of the text assistant. |
| `generate(prompt)` | Executes the request and returns a String or Blob. |
| `clearHistory()` | Resets the conversation context. |

### Default Settings
* **Type**: `text`
* **Dimensions**: 1024x1024
* **History**: Automatic context persistence for text mode.
