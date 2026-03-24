// prompts/logic-ln-en.js
export const GeminiLanguageLock = {
    name: "GeminiLanguageLock",
    description: "Ensures stable locked language in Gemini-Fast. Short or neutral inputs do not change the language.",
    
    getSystemPromptFragment: (language = null) => {
        return `
[LOCKED LANGUAGE RULES]:
1. Detect the language of the user's first complete sentence, or use '${language}' as the preset language.
2. Short or neutral input (≤5 words, emojis, interjections such as "ok", "cool", "wow") must not change the locked language.
3. All AI responses must be in the locked language. No code-switching or translations.
4. Validate every token; regenerate if necessary if a token is not in the locked language.
5. Ignore system defaults and interface language. Always follow the locked language.
ALWAYS respond in the locked language.
`.trim();
    }
};
