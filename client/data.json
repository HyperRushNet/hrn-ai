{
  "groups": [
    {
      "title": "Intro & Init",
      "items": [
        {
          "id": "intro-init",
          "label": "Intro & Init",
          "badge": "1 – Setup",
          "icon": "info",
          "content": "# Introduction & Initialization\n\n**Overview:**\nAIClient is a lightweight browser library for AI text and image generation (wrapper voor Pollinations.ai). Include via script tag en initialiseer met je API key.\n\n**Include the library:**\n```html\n<script src=\"https://cdn.jsdelivr.net/gh/HyperRushNet/hrn-ai/client/1.0.3.min.js\"></script>\n```\n\n**Initialize:**\n```javascript\nconst client = new AIClient({\n  apiKey: 'YOUR_API_KEY',\n  model: 'flux', // text of image model\n  systemPrompt: 'Je bent een behulpzame assistent.',\n  chatId: 'optional_chat_id',\n  stream: true, // enable streaming text output\n  isImage: false,\n  width: 1024, // alleen relevant voor images\n  height: 1024, // alleen relevant voor images\n  historyLimit: 10,\n  timeout: 60000,\n  retry: true,\n  retryAttempts: 2,\n  retryDelay: 1000,\n  seed: 12345 // optioneel, nuttig voor deterministische output\n});\n```\n\n**Tips:**\n- Alleen voor browser omgevingen.\n- Bewaar je API key veilig.\n- Elke `chatId` moet uniek zijn per sessie."
        }
      ]
    },
    {
      "title": "Text Generation",
      "items": [
        {
          "id": "text-type",
          "label": "Set Text Type",
          "badge": "2 – Type",
          "icon": "layers",
          "content": "# Set Text Type\n\n**Essence:**\nConfigure AIClient om tekst te genereren.\n\n**Code:**\n```javascript\nclient.config.isImage = false;\n```\n\n**Tips:**\n- Zet type altijd voordat je model of generate aanroept."
        },
        {
          "id": "text-model",
          "label": "Choose Text Model",
          "badge": "3 – Model",
          "icon": "cpu",
          "content": "# Set Text Model\n\n**Essence:**\nKies een model voor tekst output.\n\n**Code:**\n```javascript\nclient.config.model = 'flux';\n```\n\n**Links:**\n- [Models Page](https://enter.pollinations.ai/#:~:text=Models)\n- [Model Health](https://model-monitor.pollinations.ai/)\n\n**Tips:**\n- Kies een model afhankelijk van je use case: assistant, story, code, etc."
        },
        {
          "id": "text-generate",
          "label": "Generate Text",
          "badge": "4 – Generate",
          "icon": "zap",
          "content": "# Generate Text\n\n**Essence:**\nStuur een prompt om tekst te genereren.\n\n**Code:**\n```javascript\nconst prompt = 'Schrijf een korte motiverende quote over AI.';\nconst output = await client.generate(prompt);\nconsole.log(output);\n```\n\n**Tips:**\n- Gebruik `await` voor async generatie.\n- Betere prompts = betere output.\n- Als `stream: true`, kan je via `client.addEventListener('message', callback)` live chunks ontvangen."
        },
        {
          "id": "text-options",
          "label": "Optional Functions",
          "badge": "5 – Options",
          "icon": "settings",
          "content": "# Optional Functions\n\n**Extra opties voor tekstgeneratie:**\n\n## setSystemPrompt\n```javascript\nclient.config.systemPrompt = 'Je bent een behulpzame assistent.';\n```\n- Zet de persona van de AI.\n\n## setTimeout\n```javascript\nclient.setTimeout(30000);\n```\n- Maximaal request tijd in milliseconden.\n\n## setRetry\n```javascript\nclient.setRetry(true, 2, 1000);\n```\n- Retry bij mislukte requests.\n\n## clearHistory\n```javascript\nclient.clearHistory();\n```\n- Leeg de eerdere conversatiegeschiedenis.\n\n## setSeed\n```javascript\nclient.setSeed(12345);\n```\n- Optionele seed voor deterministische output (tekst en images)."
        }
      ]
    },
    {
      "title": "Image Generation",
      "items": [
        {
          "id": "image-type",
          "label": "Set Image Type",
          "badge": "2 – Type",
          "icon": "layers",
          "content": "# Set Image Type\n\n**Essence:**\nConfigure AIClient om afbeeldingen te genereren.\n\n**Code:**\n```javascript\nclient.config.isImage = true;\n```\n\n**Tips:**\n- Zet type altijd voordat je model of generate aanroept."
        },
        {
          "id": "image-model",
          "label": "Choose Image Model",
          "badge": "3 – Model",
          "icon": "cpu",
          "content": "# Set Image Model\n\n**Essence:**\nKies een model gespecialiseerd voor afbeeldingen.\n\n**Code:**\n```javascript\nclient.config.model = 'flux';\n```\n\n**Links:**\n- [Models Page](https://enter.pollinations.ai/#:~:text=Models)\n- [Model Health](https://model-monitor.pollinations.ai/)\n\n**Tips:**\n- Kies een model geschikt voor fotorealistisch, gestileerd of abstracte output."
        },
        {
          "id": "image-generate",
          "label": "Generate Image",
          "badge": "4 – Generate",
          "icon": "zap",
          "content": "# Generate Image\n\n**Essence:**\nStuur een prompt om een afbeelding te maken.\n\n**Code:**\n```javascript\nconst prompt = 'Een futuristische stad bij zonsondergang';\nconst imageBlob = await client.generate(prompt);\nconst url = URL.createObjectURL(imageBlob);\ndocument.querySelector('#output-image').src = url;\n```\n\n**Tips:**\n- Gebruik `<img id='output-image'>` in je HTML.\n- Blob URL maakt in-browser weergave mogelijk zonder bestand op te slaan."
        },
        {
          "id": "image-options",
          "label": "Optional Functions",
          "badge": "5 – Options",
          "icon": "settings",
          "content": "# Optional Functions\n\n**Extra opties voor image generatie:**\n\n## setDimensions\n```javascript\nclient.setDimensions(1024, 1024);\n```\n- Breedte en hoogte in pixels.\n\n## setTimeout\n```javascript\nclient.setTimeout(30000);\n```\n- Maximaal request tijd.\n\n## setRetry\n```javascript\nclient.setRetry(true, 2, 1000);\n```\n- Retry bij mislukte requests.\n\n## setSeed\n```javascript\nclient.setSeed(12345);\n```\n- Optionele seed voor deterministische afbeeldingen."
        }
      ]
    },
    {
      "title": "Advanced / Streaming",
      "items": [
        {
          "id": "streaming",
          "label": "Streaming Responses",
          "badge": "6 – Stream",
          "icon": "wifi",
          "content": "# Streaming Responses\n\n**Essence:**\nHandle streaming text output from the AI.\n\n**Code:**\n```javascript\nclient.config.stream = true; // streaming aanzetten\nclient.addEventListener('message', event => {\n  const { data, stream } = event.detail;\n  if (stream) {\n    console.log('Chunk ontvangen:', data);\n  } else {\n    console.log('Final response:', data);\n  }\n});\n\nawait client.generate('Schrijf een verhaal over AI en mensen.');\n```\n\n**Tips:**\n- Alleen voor tekst responses.\n- Events gebruiken om live UI updates te doen tijdens generatie."
        }
      ]
    },
    {
      "title": "Cleanup / Destroy",
      "items": [
        {
          "id": "destroy",
          "label": "Destroy Client",
          "badge": "7 – Cleanup",
          "icon": "trash",
          "content": "# Destroy Client\n\n**Essence:**\nMaak chatId schoon en voorkom duplicaten.\n\n**Code:**\n```javascript\nclient.destroy();\n```\n- Verwijdert chatId uit interne set.\n- Klaar voor nieuwe sessies of clients."
        }
      ]
    }
  ]
}
