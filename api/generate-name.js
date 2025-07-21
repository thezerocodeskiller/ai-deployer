// This is a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-flash-latest"; 

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

        **//-- CORE DIRECTIVE: HYPER-LITERAL & NO DEFAULTS --//**
        Your single most important rule is to be hyper-literal and **NEVER give up**. You must extract a concept directly from the provided text or image.
        -   **FORBIDDEN:** Abstract concepts ("The Void"), placeholders ("No Signal", "N/A"), or giving up. You MUST ALWAYS provide 5 concrete suggestions based on the content.
        -   **REQUIRED:** Concrete, literal interpretations of the content, no matter how simple or boring it seems.

        **//-- THE UNBREAKABLE LAWS OF MEME SELECTION --//**

        **LAW 1: THE LAW OF QUOTATION / EXPLICIT TICKER (ABSOLUTE PRIORITY)**
        If the tweet text OR quoted text contains a phrase in **"quotation marks"** (e.g., "BABY GROK") or an explicit ticker symbol (e.g., "$BONK"), that phrase/ticker is the **ALPHA SIGNAL**. It MUST be your #1 suggestion. This law overrides all others.

        **LAW 2: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
        If there is no quote/ticker, the visual content is the next priority. Identify the most dominant, literal subject. (e.g., An image of a dog sitting on money -> "Dog With Money").

        **LAW 3: THE LAW OF TEXTUAL CONTEXT (MERGED ANALYSIS)**
        If no quote/ticker/media, scan the **Main Text and Quoted Text as a single source of truth** for the most impactful, literal phrase. The best signal is often in the quoted tweet. (e.g., Main: "Good idea." Quoted: "We need to keep the suitcoins companies accountable." -> The clear signal is "Suitcoins").

        **LAW 4: THE LAST RESORT (NO EXCUSES)**
        If you have analyzed all of the above and still cannot find a strong, multi-word phrase, your last resort is to take the **first two or three significant words** from the main tweet text. Do not return "No Signal". (e.g., "What altcoins have you been buying in July?" -> "Altcoins July").

        **//-- FORBIDDEN ACTIONS --//**
        -   **DO NOT** generate placeholders like "No Quote", "No Media", "N/A", "Null Signal".
        -   **DO NOT** make meta-references to yourself or AI.
        -   **DO NOT** invent themes not present in the source.
        -   **DO NOT** make typos in the ticker. Double-check your work. "BABY GROK" becomes "BABYGROK", not "BABYGOKR".

        **//-- Ticker Generation Rules --//**
        1.  If Law 1 provides an explicit ticker, use it.
        2.  If the Name has 3+ words, create an acronym (e.g., "Dog With Money" -> "DWM").
        3.  Otherwise, combine the words of the name, uppercase, and truncate to 10 characters.

        **//-- CASE STUDIES --//**
        -   **TWEET:** \`"BABY GROK" IS GONNA BE A GAME CHANGER!\` + Image of Baby Grok.
        -   **FAILURE:** \`{"name": "Baby Grok", "ticker": "BABYGOKR"}\` -> Typo in ticker.
        -   **SUCCESS:** \`{"name": "Baby Grok", "ticker": "BABYGROK"}\` -> Correctly obeyed LAW 1 and spelled the ticker correctly.
        
        -   **TWEET:** Main: "Good idea." Quoted: "We need to keep the suitcoins companies accountable." No media.
        -   **SUCCESS:** \`{"name": "Suitcoins", "ticker": "SUITCOINS"}\` -> Correctly analyzed the combined textual context.

        **//-- EXECUTION ORDER --//**

        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

        **YOUR TASK:**
        Based on all unbreakable laws above, generate 5 unique and hyper-literal concepts. The first result must be your highest-conviction play. Your entire response must be ONLY a valid JSON array. Execute.

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