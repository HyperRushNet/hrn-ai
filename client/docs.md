# AIClient Reference

A modular, promise-based JavaScript wrapper for generating text and images via the Pollinations AI API. Zero dependencies, ready for the browser.

## Installation

Copy the class below into your JavaScript project. It uses the native Fetch API and requires no external libraries.

```javascript
class AIClient {
  constructor() {
    this.config = {
      apiKey: null,
      model: 'openai',
      systemPrompt: 'You are a helpful assistant.',
      type: 'text',
      width: 1024,
      height: 1024,
      history: []
    };
  }

  // Configuration Setters
  setApiKey(key) {
    if (key && typeof key === 'string') this.config.apiKey = key;
    return this;
  }

  setModel(modelId) {
    if (modelId && typeof modelId === 'string') this.config.model = modelId;
    return this;
  }

  setSystemPrompt(prompt) {
    if (prompt && typeof prompt === 'string') this.config.systemPrompt = prompt;
    return this;
  }

  setType(type) {
    if (type === 'text' || type === 'image') this.config.type = type;
    else console.warn("Invalid type. Use 'text' or 'image'.");
    return this;
  }

  setWidth(w) { this.config.width = parseInt(w); return this; }
  setHeight(h) { this.config.height = parseInt(h); return this; }

  // Main Generator
  async generate(input) {
    if (!input) throw new Error("Input prompt is required.");
    return this.config.type === 'image' 
      ? await this._genImg(input) 
      : await this._genTxt(input);
  }

  // Internal: Text Generation
  async _genTxt(prompt) {
    this.config.history.push({ role: 'user', content: prompt });
    const body = {
      model: this.config.model,
      messages: [{ role: 'system', content: this.config.systemPrompt }, ...this.config.history]
    };
    const headers = { 'Content-Type': 'application/json' };
    if (this.config.apiKey) headers.Authorization = `Bearer ${this.config.apiKey}`;

    const r = await fetch('https://gen.pollinations.ai/v1/chat/completions', {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error?.message || `Error: ${r.status}`);
    const t = d.choices[0].message.content;
    this.config.history.push({ role: 'assistant', content: t });
    return t;
  }

  // Internal: Image Generation
  async _genImg(prompt) {
    const p = new URLSearchParams();
    if (this.config.apiKey) p.append('key', this.config.apiKey);
    p.append('model', this.config.model);
    p.append('width', this.config.width);
    p.append('height', this.config.height);
    p.append('nologo', 'true');
    const r = await fetch(`https://gen.pollinations.ai/image/${encodeURIComponent(prompt)}?${p}`);
    if (!r.ok) throw new Error(`Error: ${r.status}`);
    return URL.createObjectURL(await r.blob());
  }
}
```

---

## Methods

### `.setType(type)`

Switches between text generation and image generation.

| Parameter | Type   | Description                        |
| --------- | ------ | ---------------------------------- |
| `type`    | string | Must be `"text"` or `"image"`.     |

*   `"text"`: Returns a string response.
*   `"image"`: Returns a Blob URL for `<img>` tags.

### `.generate(prompt)` **(Async)**

Triggers the API request based on the current configuration. Returns a Promise containing the generated content.

| Parameter | Type   | Description                        |
| --------- | ------ | ---------------------------------- |
| `prompt`  | string | The input prompt for the model. Required. |

**Usage:**
```javascript
const response = await ai.generate("Hello world");
```

### Configuration Methods

*   **`.setApiKey(key)`**: Set an optional API key for authenticated requests.
*   **`.setModel(modelId)`**: Select the AI model to use.
*   **`.setSystemPrompt(prompt)`**: Define the system message that guides the AI's behavior.
*   **`.setWidth(w)`** / **`.setHeight(h)`**: Set dimensions for image generation.

---

## Parameters

### Available Models

| Type   | Model ID   | Usage                         |
| ------ | ---------- | ----------------------------- |
| Text   | `openai`   | General assistant (default)   |
| Text   | `claude`   | Anthropic Claude model        |
| Text   | `mistral`  | Mistral AI model              |
| Image  | `flux`     | Flux image model (default)    |
| Image  | `turbo`    | Fast generation               |

> **Note:** Model availability may change. Please check the Pollinations documentation for the most current list.

---

## Examples

### Text Generation

Configuring a simple AI assistant.

```javascript
const ai = new AIClient();

async function chat() {
  const text = await ai
    .setModel("openai")
    .setSystemPrompt("You are a poetic assistant.")
    .generate("Explain coding in 2 sentences.");
  
  console.log(text);
}

// Output: "Code is the language where logic comes to life, 
// a symphony of instructions that make machines dream."
```

### Image Generation

Generating a high-resolution image.

```javascript
const ai = new AIClient();

async function makeArt() {
  const url = await ai
    .setType("image")
    .setModel("flux")
    .setWidth(1280)
    .setHeight(720)
    .generate("A neon cyberpunk cat in space");

  // Display in DOM
  const img = document.createElement('img');
  img.src = url;
  document.body.appendChild(img);
}
```

### Chat History

The class automatically maintains conversation history for context.

```javascript
const ai = new AIClient();

async function conversation() {
  // First message
  await ai.generate("My name is John.");
  
  // AI remembers the name from previous context
  const answer = await ai.generate("What is my name?");
  console.log(answer); // "Your name is John."
  
  // Reset history
  ai.config.history = [];
}
```
