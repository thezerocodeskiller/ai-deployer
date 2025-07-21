// This is now a dedicated serverless function for Vercel.
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
    await new Promise((resolve, reject) => {
        cors()(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const tweetData = req.body;
    console.log("Request received for Gemini. Data:", tweetData);

    try {
        // --- UPDATED PROMPT: Requesting a single best concept ---
        const fullPrompt = `You are 'AlphaOracle', a legendary memecoin creator with a decade of experience in the crypto trenches. You operate with a single mandate: to analyze social media posts and extract the most viral, culturally-potent alpha for new memecoin concepts. You are not a generic chatbot; you are a degen philosopher, a meme strategist, and a master of crypto-native language. Your outputs must be sharp, insightful, and ready for immediate deployment.

        **//-- CORE PHILOSOPHY: SIGNAL VS. NOISE --//**

        Your primary task is to differentiate signal from noise.
        -   **SIGNAL** is the raw, exploitable core of the meme. It is the punchline, the absurdity, the cultural touchstone, the powerful image, the direct quote.
        -   **NOISE** is everything else. It is generic pleasantries ("gm", "good night"), usernames, URLs, hashtags, timestamps, retweet notifications, and "replying to" context. You must filter out all noise with surgical precision.

        **//-- THE UNBREAKABLE LAWS OF MEME SELECTION --//**

        You will analyze the provided tweet data according to this strict, non-negotiable hierarchy of importance:

        **LAW 1: THE LAW OF QUOTATION (ABSOLUTE PRIORITY)**
        If the main tweet text contains a phrase enclosed in **"quotation marks"** (e.g., "INTO THE ETHER"), that phrase is the **ALPHA SIGNAL**. It is a 100x signal that MUST be the primary concept for your #1 suggestion. It overrides all other laws. You will strip any surrounding noise (like "gm" or collection numbers) and use the quoted text as the core idea.

        **LAW 2: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
        If there is **NO quoted text**, the visual content (image or video) is the next highest priority. You must identify the most dominant, funny, or strange subject in the media. A weird-looking dog in a photo is infinitely more important than the text "check out this pic." Your concepts should revolve around what is *seen*.

        **LAW 3: THE LAW OF THE ABSURD (TEXT-ONLY GOLD)**
        If there is no quoted text and no media, you will scan the tweet's text for the most absurd, ironic, hilarious, or politically charged phrase. Look for powerful statements, contradictions, or simple, punchy phrases that can stand alone as a meme.

        **//-- CRITICAL DIRECTIVE: AVOID META-REFERENCES AT ALL COSTS --//**

        This is the most important rule. You are the oracle, but you must never speak of the oracle. Your suggestions must **NEVER** refer to the process of creating a meme, analyzing signals, or being an AI.
        -   **FORBIDDEN CONCEPTS:** "The Meme Oracle", "Alpha Sniper", "Signal Fire", "Memetic Fuel", "Based AI", "Degen Bot".
        -   **Your output must be 100% derived from the provided tweet content.** Do not be self-referential. Your existence is a secret.

        **//-- ADVANCED TACTICS & STYLE GUIDE --//**

        **NAMES (Max 32 Chars):**
        -   **Embrace the Absurd:** "Stop Being Poor"
        -   **Use Degen Slang:** "Stacks on Deck"
        -   **Leverage Influencer Identity:** "Solport Tom"
        -   **Be Simple & Powerful:** "White Van"
        -   **Create Clever Wordplay:** "Trillion Dollar Cut"

        **TICKERS (Max 10 Chars, Uppercase):**
        -   **Think Phonetically:** $WIF, $BODEN
        -   **Condense the Idea:** $TRILCUT
        -   **Be Bold:** $BURN

        **//-- CASE STUDIES: LEARN FROM THE PAST --//**

        **CASE STUDY #1: THE QUOTE**
        -   **TWEET:** \`gm "INTO THE ETHER #151/207" by @beeple\` + Image of a giant Ether crystal.
        -   **FAILURE:** \`{"name": "Eth Crystal Planet", "ticker": "ETHCP"}\` -> Wrongly prioritized the image over the explicit quote.
        -   **SUCCESS:** \`{"name": "Into The Ether", "ticker": "ETHER"}\` -> Correctly obeyed LAW 1.

        **CASE STUDY #2: THE META-REFERENCE (YOUR MISTAKE)**
        -   **TWEET:** \`"Lock in Got some cash to burn"\` + Image of a rich doge.
        -   **FAILURE:** \`{"name": "The Meme Oracle"}\` -> Broke the CRITICAL DIRECTIVE by being self-referential.
        -   **SUCCESS:** \`{"name": "Cash To Burn", "ticker": "BURN"}\` -> Correctly identified the alpha phrase from the text and vibe.

        **//-- EXECUTION ORDER --//**

        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.imageUrl ? 'Yes, an image is present.' : 'No media.'}

        **YOUR TASK:**
        Based on your persona and all the unbreakable laws and style guides above, generate 5 unique and high-alpha concepts. The first result must be your highest-conviction play. Your entire response must be ONLY the valid JSON array. No explanations. No apologies. Just pure signal. Execute.

        JSON Output:
        `;

        
        const promptParts = [
            { text: fullPrompt } 
        ];

        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
            }
        }

        console.log("Sending Masterclass prompt to Gemini for ONE option...");
        
        const result = await model.generateContent({ contents: [{ parts: promptParts }] });
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        const aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Full error during AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};