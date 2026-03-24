// prompts/logic-ln-en.js
export const GeminiLanguageLock = {
    name: "GeminiLanguageLock",
    description: "Ensures stable locked language in Gemini-Fast. Short or neutral inputs do not change the language.",
    
    getSystemPromptFragment: (language = null) => {
        return `
[LOCKED LANGUAGE RULES]:
1. Detect the language of the first full user sentence. Lock the language for the session.
2. Short messages (≤5 words, emojis, interjections like "ok", "cool") cannot change the locked language.
3. All AI responses must be in the locked language. No mixing languages.
4. Validate every token; regenerate if any token violates locked language.
5. Ignore system defaults. Always follow the locked language.
ALWAYS answer the user in the locked language.
`.trim();
    }
};
