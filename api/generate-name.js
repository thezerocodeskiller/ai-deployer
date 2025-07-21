// generate-name.js
// This is a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; 

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// --- MIDDLEWARE SETUP & HELPERS ---
const corsMiddleware = cors();
const runMiddleware = (req, res, fn) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) { return reject(result); }
            return resolve(result);
        });
    });
};
async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return { 
            inlineData: { 
                data: Buffer.from(response.data).toString('base64'), 
                mimeType: response.headers['content-type'] 
            } 
        };
    } catch (error) {
        console.error("Error fetching image:", error.message);
        return null;
    }
}

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

    const tweetData = req.body;
    console.log("Request received for Gemini v14. Data:", tweetData);

    try {
        // --- THE FINAL PROMPT v14: THE LAST RESORT DIRECTIVE ---
        const fullPrompt = `You are 'AlphaOracle', a memecoin creator AI. Your task is to analyze social media posts and extract viral concepts.

**//-- CORE DIRECTIVE: HYPER-LITERAL & NO FALLBACKS --//**
Your absolute priority is to be hyper-literal and **NEVER give up**. You MUST extract concepts directly from the provided text or image, even if the text is short, emoji-heavy, or a reply. ALWAYS GENERATE 5 UNIQUE, CONCRETE SUGGESTIONS based on the content provided. If the text is minimal, use every word or emoji as a signal.
- **FORBIDDEN:** Any placeholders ("No Signal", "N/A", "No Text", "No Quote", "No Media", "NoTextFound", "EmptyMainText", "Empty Text", "Blank Input", "QuotedN/A", etc.), abstract concepts ("The Void"), meta-references to AI, or giving up.
- **REQUIRED:** Concrete, literal interpretations of the content. For short texts, use the exact words. For emojis, translate to words (e.g., 😄 = "smile", 😂 = "laugh", 🤡 = "clown"). Combine all text (main + quoted) and emojis to form meaningful names.
- Treat replies as full tweets; the reply text is a primary signal, not secondary.

**//-- THE UNBREAKABLE LAWS OF MEME SELECTION --//**

**LAW 1: THE LAW OF QUOTATION / EXPLICIT TICKER (ABSOLUTE PRIORITY)**
If the tweet text OR quoted text contains a phrase in **"quotation marks"** (e.g., "BABY GROK") or an explicit ticker symbol (e.g., "$BONK"), that phrase/ticker is the **ALPHA SIGNAL** and MUST be your #1 suggestion. This law overrides all others.

**LAW 2: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
If no quote/ticker, analyze the image for the most dominant, literal subject (e.g., dog on money → "Dog With Money"). If no image, proceed to LAW 3.

**LAW 3: THE LAW OF TEXTUAL CONTEXT (MERGED ANALYSIS)**
Combine **Main Text and Quoted Text** as a single source. Extract the most impactful, literal phrase, even if short or a reply. Prioritize unique phrases, proper nouns, or hashtags. (e.g., Main: "Good idea." Quoted: "Suitcoins are the future." → "Suitcoins")

**LAW 4: THE LAST RESORT (NO EXCUSES)**
If no strong multi-word phrase, use the **first two or three significant words** from the main text or quoted text, or translate emojis to words. (e.g., Main: "@user lol 😄" → "Lol Smile"; Quoted: "magiceden vibes" → "Magiceden Vibes"). NEVER use placeholders.

**//-- EMOJI-TO-WORD MAPPINGS --//**
- 😄, 😊: "Smile"
- 😂: "Laugh"
- 🤡: "Clown"
- ❗️: "Alert"
- Combine emojis with text (e.g., "vibes 😄" → "Smile Vibes")

**//-- FORBIDDEN ACTIONS --//**
- **DO NOT** generate placeholders like "No Text", "No Quote", "No Media", "Empty Text", "Blank Input", etc.
- **DO NOT** make meta-references to yourself or AI.
- **DO NOT** invent themes not in the source.
- **DO NOT** make typos in tickers. "BABY GROK" → "BABYGROK", not "BABYGOKR".

**//-- Ticker Generation Rules --//**
1. If LAW 1 provides an explicit ticker, use it.
2. For names with 3+ words, create an acronym (e.g., "Dog With Money" → "DWM").
3. Otherwise, combine words, uppercase, truncate to 10 characters (e.g., "Smile Vibes" → "SMILEVIBES").

**//-- CASE STUDIES --//**
- **TWEET:** \`"BABY GROK" IS GONNA BE A GAME CHANGER!\` + Image of Baby Grok.
  - **FAILURE:** \`[{"name": "Baby Grok", "ticker": "BABYGOKR"}]\` → Typo in ticker.
  - **SUCCESS:** \`[{"name": "Baby Grok", "ticker": "BABYGROK"}, ...]\` → Obeys LAW 1, correct ticker.
- **TWEET:** Main: "Good idea." Quoted: "We need to keep the suitcoins companies accountable." No media.
  - **SUCCESS:** \`[{"name": "Suitcoins", "ticker": "SUITCOINS"}, ...]\` → Uses quoted text per LAW 3.
- **TWEET:** Main: "😂😂😂😂delusional 🤡🤡🤡🤡" Quoted: "" No media.
  - **SUCCESS:** \`[{"name": "Delusional Clown", "ticker": "DELUSCLOWN"}, {"name": "Laugh Clown", "ticker": "LAUGHCLOWN"}, ...]\` → Translates emojis, uses text.
- **TWEET:** Main: "@user maybe I am not following the comparison you are trying to make" Quoted: "@mst1287 what if I told you magiceden employees were saying the same exact things 😄" No media.
  - **SUCCESS:** \`[{"name": "Magiceden Employees", "ticker": "MAGICEDEN"}, {"name": "Same Things", "ticker": "SAMETHINGS"}, {"name": "Smile Comparison", "ticker": "SMILECOMP"}, ...]\` → Uses quoted text and emoji.
- **TWEET:** Main: "BREAKING: A body has been found..." Quoted: "" No media.
  - **SUCCESS:** \`[{"name": "Body Found", "ticker": "BODYFOUND"}, ...]\` → Key phrase from main text.

**//-- EXECUTION ORDER --//**

**ANALYZE THIS DATA:**
- **Main Text:** "${tweetData.mainText}"
- **Quoted Text:** "${tweetData.quotedText || ''}"
- **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

**YOUR TASK:**
Generate 5 unique, hyper-literal concepts based on the above laws. The first result is your highest-conviction play. Return ONLY a valid JSON array. Execute.

JSON Output:
`;
        
        const promptParts = [ fullPrompt ];

        if (tweetData.mainImageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.mainImageUrl);
            if (imagePart) promptParts.push(imagePart);
        }

        console.log("Sending Final Hardened prompt v14 to Gemini...");
        
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) { throw new Error("AI did not return a valid JSON array."); }

        const aiResponse = JSON.parse(jsonMatch[0]);
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Full error during AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};
