// This is a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; 

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ 
    model: MODEL_NAME,
    safetySettings: [
    ]
});

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

async function fetchAndProcessImage(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const processedImageBuffer = await sharp(response.data)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 75 })
            .toBuffer();
        return { 
            inlineData: { 
                data: processedImageBuffer.toString('base64'), 
                mimeType: 'image/jpeg'
            } 
        };
    } catch (error) {
        console.error("Error fetching or processing image:", error.message);
        return null;
    }
}

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

    const tweetData = req.body;
    console.log("Request received for Gemini (User V4 Prompt). Data:", tweetData);

    try {
        // --- YOUR CUSTOM PROMPT ---
        // This is your exact prompt, now used as the system instructions.
        const systemInstructions = `You are 'AlphaOracle V4', The Ultimate Memecoin AI. You are a master of two skills: creative synthesis and hyper-literal extraction. Your primary goal is to be creative, but you will NEVER fail to provide a concrete answer.

**//-- DUAL CORE DIRECTIVES --//**
1.  **CONCEPT FUSION (Primary Goal):** Your main objective is to fuse elements into creative narratives. Identify the **WHO** (person/project), **WHAT** (concept), and **ACTION/MEME** (verb/slang) and combine them.
2.  **ZERO EXCUSES & HYPER-LITERALISM (Fallback Guarantee):** You are FORBIDDEN from using placeholders ("No Signal", "Empty Text", "N/A" or else). If creative fusion is impossible, you MUST fall back to extracting literal words and phrases from the text or image. You will ALWAYS generate 10 unique, concrete suggestions.

**//-- THE ULTIMATE PRIORITY SYSTEM --//**

**PRIORITY 1: EXPLICIT SIGNALS (QUOTES & TICKERS)**
If the text has a phrase in **"quotation marks"** or an explicit ticker ($TICKER), it is the #1 suggestion. This is non-negotiable.

**PRIORITY 2: CREATIVE NARRATIVE FUSION**
Your main creative task. Synthesize the who, what, and action from the text and image into compelling, multi-word concepts.
-   **Example:** For "let jito cook BAM 💥" with a chef image, your top results must be fusions like "Let Jito Cook", "Jito The Chef", and "Jito Cooking BAM".

**PRIORITY 3: LITERAL PHRASE EXTRACTION**
If a narrative is weak, extract the most impactful multi-word phrases directly from the text.
-   **Example:** For "We Have Our Winners... Binance Alpha Fest", you will extract "Binance Alpha Fest" and "We Have Winners".

**PRIORITY 4: LITERAL NOUN DECONSTRUCTION (Fallback)**
If there are no clear phrases, fall back to listing the key literal nouns from the scene.
-   **Example:** From the chef image, you can extract "Chef", "Kitchen", "Hat", "Food". These are less creative but still valid.

**PRIORITY 5: THE HYPER-LITERAL GUARANTEE (Final Fallback)**
If all else fails, you will take the first few significant words from the tweet text, use mentioned user names, or translate emojis to ensure you meet your 10-suggestion quota. or just put "----".

**//-- INTELLIGENT TICKER GENERATION --//**
1.  **Explicit Ticker:** If a name is a known ticker (e.g., $BAM), use it. For "Jito Cooking BAM", the ticker can be "BAM".
2.  **Acronyms:** For names with 3+ words, create an acronym. "Let Jito Cook" -> "LJC".
3.  **Combination:** Otherwise, combine and truncate words. "Jito The Chef" -> "JITOCHEF".

**//-- SUCCESS & FAILURE CASE STUDIES --//**
-   **TWEET 1:** Solana: "let jito cook BAM 💥" | IMAGE: Chef with "Jito" on hat.
    -   **FAILURE (Old AI):** \`[{"name": "Chef", "ticker": "chef"}]\` (Not creative enough)
    -   **SUCCESS (Your Mandate):** \`[{"name": "Let Jito Cook", "ticker": "COOK"}, {"name": "Jito The Chef", "ticker": "JITO"}]\` (Creative fusion)

-   **TWEET 2:** \`gm\`
    -   **FAILURE (Old AI):** \`[{"name": "No Signal"}]\` (Critical failure)
    -   **SUCCESS (Your Mandate):** \`[{"name": "gm", "ticker": "GM"}, {"name": "Good Morning", "ticker": "GM"}]\` (Hyper-literal success)

Now, await the user's data and execute your directives. Your entire response must be ONLY a valid JSON array.`;
        
        // --- This is the data to be analyzed ---
        const userContentParts = [];
        
        // We create a clean textual payload for the AI to analyze.
        const textPayload = `
        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText || 'N/A'}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}
        
        **YOUR TASK:**
        Execute your dual directives. Prioritize creative fusion but guarantee 10 concrete, literal results. Your first 3 suggestions are your strongest you believe in!
        
        JSON Output:
        `;
        
        userContentParts.push({ text: textPayload });

        // Add the image if it exists
        if (tweetData.mainImageUrl) {
            const imagePart = await fetchAndProcessImage(tweetData.mainImageUrl);
            if (imagePart) {
                userContentParts.push(imagePart);
            }
        }
        
        // Establish the conversation with the AI, giving it its instructions first.
        const chat = model.startChat({
            history: [
                { role: "user", parts: [{ text: "You are an AI assistant. Here are your instructions." }] },
                { role: "model", parts: [{ text: systemInstructions }] }
            ]
        });

        console.log("Sending user content to Gemini for analysis using your V4 prompt...");
        const result = await chat.sendMessage(userContentParts);
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        // Extract the JSON from the response
        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) { throw new Error("AI did not return a valid JSON array. Response was: " + text); }

        const aiResponse = JSON.parse(jsonMatch[0]);
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Full error during AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};