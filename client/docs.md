# AIClient Reference

A modular, promise-based JavaScript wrapper for generating text and images via the Pollinations AI API. Zero dependencies, ready for the browser.

## Installation

```javascript
class AIClient {
  constructor() {
    this.config = {
      apiKey: null,
      model: null,
      systemPrompt: 'You are a helpful assistant.',
      type: 'text',
      width: 1024,
      height: 1024,
      history: []
    };
  }

  setApiKey(key) {
    if (!key) throw new Error("API Key is required.");
    this.config.apiKey = key;
    return this;
  }

  setModel(modelId) {
    if (!modelId) throw new Error("Model ID is required.");
    this.config.model = modelId;
    return this;
  }

  setSystemPrompt(prompt) {
    if (prompt && typeof prompt === 'string') this.config.systemPrompt = prompt;
    return this;
  }

  setType(type) {
    if (type === 'text' || type === 'image') this.config.type = type;
    return this;
  }

  setWidth(w) { this.config.width = parseInt(w); return this; }
  setHeight(h) { this.config.height = parseInt(h); return this; }

  async generate(input) {
    if (!this.config.apiKey) throw new Error("API Key must be set before generating.");
    if (!this.config.model) throw new Error("Model must be set before generating.");
    if (!input) throw new Error("Input prompt is required.");

    return this.config.type === 'image' 
      ? await this._genImg(input) 
      : await this._genTxt(input);
  }

  async _genTxt(prompt) {
    this.config.history.push({ role: 'user', content: prompt });
    const body = {
      model: this.config.model,
      messages: [{ role: 'system', content: this.config.systemPrompt }, ...this.config.history]
    };
    
    const r = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify(body)
    });

    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || `Error: ${r.status}`);
    const t = d.choices[0].message.content;
    this.config.history.push({ role: 'assistant', content: t });
    return t;
  }

  async _genImg(prompt) {
    const p = new URLSearchParams();
    p.append('key', this.config.apiKey);
    p.append('model', this.config.model);
    p.append('width', this.config.width);
    p.append('height', this.config.height);
    p.append('nologo', 'true');

    const r = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${p}`);
    if (!r.ok) throw new Error(`Error: ${r.status}`);
    
    return await r.blob();
  }
}
```

---

## Requirements

* **API Key**: Use `.setApiKey('key')`. Verplicht.
* **Model**: Use `.setModel('id')`. Verplicht.

---

## Methods

### `.setType(type)`
* `"text"`: Geeft een **string** terug.
* `"image"`: Geeft een **Blob object** terug.

### `.generate(prompt)` (Async)
Start de API aanvraag.

---

## Voorbeelden

### Text
```javascript
const ai = new AIClient()
  .setApiKey("jouw_key")
  .setModel("openai");

const text = await ai.generate("Hallo!");
```

### Image (Blob)
```javascript
const ai = new AIClient()
  .setApiKey("jouw_key")
  .setModel("flux")
  .setType("image");

const blob = await ai.generate("Een kat");
const url = URL.createObjectURL(blob);
```
