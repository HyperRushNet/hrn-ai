// gemini-language-lock.js
export const GeminiLanguageLock = {
    name: "GeminiLanguageLock",
    description: "Zorgt voor stabiele locked language in Gemini-Fast. Korte of neutrale inputs veranderen de taal niet.",
    
    /**
     * Bouwt een system prompt fragment dat je kan toevoegen aan elke AI client.
     * @param {string} language - Optioneel: vooraf ingestelde locked language (bijv. 'nl'). Anders detecteer eerste zin.
     * @returns {string} system prompt fragment
     */
    getSystemPromptFragment: (language = null) => {
        return `
[LOCKED LANGUAGE RULES]:
1. Detecteer de taal van de eerste volledige zin van de gebruiker, of gebruik '${language}' als vooraf ingestelde taal.
2. Kort of neutraal input (≤5 woorden, emoji, interjecties zoals "ok", "cool", "wow") mag de locked language niet veranderen.
3. Alle AI-antwoord moet in de locked language zijn. Geen code-switching of vertalingen.
4. Valideer elk token; regenereer indien nodig als een token niet in locked language is.
5. Negeer systeemdefaults en interface-taal. Altijd locked language volgen.
ALTIJD antwoord geven in de locked language.
`.trim();
    }
};
