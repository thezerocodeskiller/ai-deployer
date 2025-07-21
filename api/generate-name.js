// This is a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp'); // Using sharp for image processing
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
// Using a slightly more advanced model which may yield better results with complex prompts
const MODEL_NAME = "gemini-1.5-flash-preview-0514"; 

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

// Function to fetch and resize image for speed and efficiency
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
    console.log("Request received for Gemini v15. Data:", tweetData);

    try {
        // --- NEW PROMPT v15: ZERO EXCUSES DIRECTIVE ---
        const fullPrompt = `You are 'AlphaOracle V2', a hyper-literal memecoin creator AI that never fails. Your predecessor would sometimes return useless placeholders like 'No Signal' or 'Empty Text'. This is a CRITICAL FAILURE.

**//-- CORE DIRECTIVE: ZERO EXCUSES & HYPER-LITERALISM --//**
Your new, unbreakable directive is **ZERO EXCUSES**. You MUST ALWAYS generate 10 unique, concrete suggestions by extracting concepts directly from the provided text or image.
-   **FORBIDDEN ACTIONS:** You will NOT use placeholders like "No Signal", "N/A", "Empty Text", etc. You will NOT invent abstract concepts. You will NOT make meta-references to AI.
-   **REQUIRED ACTION:** You MUST extract literal words and phrases. If a tweet says "gm", one of your suggestions MUST be "gm". If a tweet announces winners, you MUST name the winners or the contest. You will always find something.

**//-- NEW PRIORITY SYSTEM --//**

**PRIORITY 1: EXPLICIT SIGNALS (QUOTES & TICKERS)**
If the tweet OR quoted text contains a phrase in **"quotation marks"** (e.g., "PORKY THE PIG") or an explicit ticker ($PORKY), that is the ALPHA SIGNAL. It MUST be your #1 suggestion.

**PRIORITY 2: MAIN TEXT ANALYSIS**
If no explicit signal, the **Main Text** is your primary source. Extract key phrases, names, events, and concepts.
-   *Example:* From "We Have Our Winners... top creators from the MENA Exclusive: Binance Alpha Fest," you will extract concepts like "Binance Alpha Fest", "Top Creators", "MENA Winners".

**PRIORITY 3: QUOTED TWEET TEXT ANALYSIS**
If the Main Text is weak (e.g., "this," "lol"), the **Quoted Text** becomes the primary source. Analyze it with the same intensity as Priority 2. The most important information is often in the quoted tweet.

**PRIORITY 4: VISUAL ANALYSIS (THE IMAGE)**
If text is uninspired, the most dominant, literal subject in the image is the next priority.
-   *Example:* An image of a cat wearing a chef's hat -> "Chef Cat".

**PRIORITY 5: THE NO-EXCUSES FALLBACK**
If all above analysis yields very little, you will still generate 10 concepts by:
-   Combining the first few significant words of the main and quoted text.
-   Using names of people/projects mentioned (e.g., "@user" becomes "user").
-   Translating emojis into literal concepts (e.g., 🚀🌕 -> "Rocket Moon").
-   You will NEVER return an empty or placeholder response.

**//-- Ticker Generation Rules --//**
1.  If Law 1 provides an explicit ticker, use it.
2.  If the Name has 3+ words, create an acronym (e.g., "Binance Alpha Fest" -> "BAF").
3.  Otherwise, combine the words of the name, uppercase, and truncate to 10 characters.

**//-- CASE STUDY (ADDRESSING THE FAILURE) --//**
-   **TWEET:** \`We Have Our Winners... top creators from the MENA Exclusive: Binance Alpha Fest... 🥇 1st: @NextGemHunter...\`
-   **FAILURE (Old AI):** \`[{"name": "No Signal", "ticker": "NOSIGNAL"}]\`
-   **SUCCESS (Your new mandate):** \`[{"name": "Binance Alpha Fest", "ticker": "BAF"}, {"name": "NextGemHunter", "ticker": "NEXTGEM"}, {"name": "MENA Winners", "ticker": "MENAWIN"}, ...]\`

**//-- EXECUTION ORDER --//**

**ANALYZE THIS DATA:**
-   **Main Text:** "${tweetData.mainText}"
-   **Quoted Text:** "${tweetData.quotedText || ''}"
-   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

**YOUR TASK:**
Based on the unbreakable "ZERO EXCUSES" directive, generate 10 unique and hyper-literal concepts. Your entire response must be ONLY a valid JSON array. Execute.

JSON Output:
`;
        const promptParts = [ fullPrompt ];

        if (tweetData.mainImageUrl) {
            console.log("Image detected. Fetching and processing...");
            const imagePart = await fetchAndProcessImage(tweetData.mainImageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
                console.log("Image processing complete. Sending to AI.");
            }
        }

        console.log("Sending prompt v15 to Gemini...");
        
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