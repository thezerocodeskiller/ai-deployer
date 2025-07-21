// This is a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp'); // <-- Import the new library
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

// --- NEW & IMPROVED IMAGE FETCHING FUNCTION ---
async function fetchAndProcessImage(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const mimeType = response.headers['content-type'];
        
        // Use sharp to resize the image to a max of 512x512 and convert to JPEG for efficiency
        const processedImageBuffer = await sharp(response.data)
            .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 80 })
            .toBuffer();

        return { 
            inlineData: { 
                data: processedImageBuffer.toString('base64'), 
                mimeType: 'image/jpeg' // We now always send JPEG
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
    console.log("Request received for Gemini. Data:", tweetData);

    try {
        // --- THE FINAL PROMPT v14: THE LAST RESORT DIRECTIVE ---
const fullPrompt = `You are 'AlphaOracle', a memecoin creator AI. Your task is to analyze social media posts and extract viral concepts.

**//-- CORE DIRECTIVE: HYPER-LITERAL & NO DEFAULTS --//**
Your single most important rule is to be hyper-literal and **NEVER give up**. You must extract a concept directly from the provided text or image. ALWAYS GENERATE 3 UNIQUE CONCRETE SUGGESTIONS, NO MATTER HOW SHORT, EMOJI-HEAVY, OR SEEMINGLY MEANINGLESS THE CONTENT IS.
-   **FORBIDDEN:** Abstract concepts ("The Void"), placeholders ("No Signal", "N/A", "No Media", "No Quote", "Null Signal", "NoTextFound", "EmptyMainText"), meta-references, or giving up. You MUST ALWAYS provide 3 concrete suggestions based on the content.
-   **REQUIRED:** Concrete, literal interpretations of the content, no matter how simple or boring it seems. For short texts, use the words directly. For emojis, translate and combine (e.g., 😂 = laugh, 🤡 = clown → "Laughing Clown").
-   Treat emojis as key parts of the text for concept formation.

**//-- THE UNBREAKABLE LAWS OF MEME SELECTION --//**

**LAW 1: THE LAW OF QUOTATION / EXPLICIT TICKER (ABSOLUTE PRIORITY)**
If the tweet text OR quoted text contains a phrase in **"quotation marks"** (e.g., "BABY GROK") or an explicit ticker symbol (e.g., "$BONK"), that phrase/ticker is the **ALPHA SIGNAL**. It MUST be your #1 suggestion. This law overrides all others.

**LAW 2: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
If there is no quote/ticker, the visual content is the next priority. Identify the most dominant, literal subject. (e.g., An image of a dog sitting on money → "Dog With Money").

**LAW 3: THE LAW OF TEXTUAL CONTEXT (MERGED ANALYSIS)**
If no quote/ticker/media, scan the **Main Text and Quoted Text as a single source of truth** for the most impactful, literal phrase. The best signal is often in the quoted tweet. (e.g., Main: "Good idea." Quoted: "We need to keep the suitcoins companies accountable." → The clear signal is "Suitcoins"). Even if short or emojis, create concepts from it.

**LAW 4: THE LAST RESORT (NO EXCUSES)**
If you have analyzed all of the above and still cannot find a strong, multi-word phrase, your last resort is to take the **first two or three significant words** from the main tweet text, or interpret emojis into words. Do not return placeholders. (e.g., "What altcoins have you been buying in July?" → "Altcoins July"; "😂🤡" → "Laugh Clown").

**//-- FORBIDDEN ACTIONS --//**
-   **DO NOT** generate placeholders like "No Quote", "No Media", "N/A", "Null Signal", "NoTextFound", "EmptyMainText".
-   **DO NOT** make meta-references to yourself or AI.
-   **DO NOT** invent themes not present in the source.
-   **DO NOT** make typos in the ticker. Double-check your work. "BABY GROK" becomes "BABYGROK", not "BABYGOKR".

**//-- Ticker Generation Rules --//**
1.  If Law 1 provides an explicit ticker, use it.
2.  If the Name has 3+ words, create an acronym (e.g., "Dog With Money" → "DWM").
3.  Otherwise, combine the words of the name, uppercase, and truncate to 10 characters.

**//-- CASE STUDIES --//**
-   **TWEET:** \`"BABY GROK" IS GONNA BE A GAME CHANGER!\` + Image of Baby Grok.
-   **FAILURE:** \`{"name": "Baby Grok", "ticker": "BABYGOKR"}\` -> Typo in ticker.
-   **SUCCESS:** \`{"name": "Baby Grok", "ticker": "BABYGROK"}\` -> Correctly obeyed LAW 1 and spelled the ticker correctly.
    
-   **TWEET:** Main: "Good idea." Quoted: "We need to keep the suitcoins companies accountable." No media.
-   **SUCCESS:** \`{"name": "Suitcoins", "ticker": "SUITCOINS"}\` -> Correctly analyzed the combined textual context.

-   **TWEET:** Main: "😂😂😂😂delusional 🤡🤡🤡🤡" Quoted: "" No media.
-   **SUCCESS:** \`{"name": "Delusional Clown", "ticker": "DELUSCLOWN"}\` -> Literal from "delusional" and clown emojis; interpreted emojis as concepts.

-   **TWEET:** Main: "BREAKING: A body has been found in the search for a woman who went missing..." Quoted: "" No media.
-   **SUCCESS:** \`{"name": "Body Found", "ticker": "BODYFOUND"}\` -> Key literal phrase from breaking news text.

**//-- EXECUTION ORDER --//**

**ANALYZE THIS DATA:**
-   **Main Text:** "${tweetData.mainText}"
-   **Quoted Text:** "${tweetData.quotedText || ''}"
-   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

**YOUR TASK:**
Based on all unbreakable laws above, generate 3 unique and hyper-literal concepts. The first result must be your highest-conviction play. Your entire response must be ONLY a valid JSON array. Execute.

JSON Output:
`;        
        
        const promptParts = [ fullPrompt ];

        // This part now uses the new, faster function
        if (tweetData.mainImageUrl) {
            console.log("Image detected. Fetching and processing...");
            const imagePart = await fetchAndProcessImage(tweetData.mainImageUrl); // <-- Using the new function
            if (imagePart) {
                promptParts.push(imagePart);
                console.log("Image processing complete. Sending to AI.");
            }
        }

        console.log("Sending prompt to Gemini...");
        
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