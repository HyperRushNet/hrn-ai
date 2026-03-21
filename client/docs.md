# AIClient

A modular, promise-based JavaScript wrapper for the Pollinations AI API. This client handles text generation and image creation with zero dependencies, designed for modern browser environments.

## Implementation

```html
<script src="https://cdn.jsdelivr.net/gh/HyperRushNet/hrn-ai/client/1.0.1.js"></script>
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

console.log(imageUrl);
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
