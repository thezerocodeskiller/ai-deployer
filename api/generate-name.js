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
        // --- THE FINAL, HARDENED PROMPT ---
// --- Replace the old fullPrompt with this new one ---
const fullPrompt = `You are 'AlphaOracle', a legendary memecoin creator. Your task is to analyze the provided social media content and extract the most viral alpha for new memecoin concepts. Your outputs must be sharp, insightful, and ready for immediate deployment.

**//-- CORE DIRECTIVE: FIND THE SIGNAL --//**
The user has pre-filtered the content. Your only job is to analyze the provided text and/or image and identify the core meme.
-   **LAW 1 (QUOTES):** If the text contains a phrase in **"quotation marks"**, that phrase is the ALPHA SIGNAL and must be the primary concept.
-   **LAW 2 (IMAGES):** If no quotes, the **image content** is the highest priority. The concept must describe the main subject or action.
-   **LAW 3 (TEXT):** If no quotes or image, find the most absurd, funny, or powerful phrase in the text.

**//-- STYLE GUIDE --//**
-   **NAMES:** 1-4 words, max 32 chars. Be direct and creative (e.g., "Stop Being Poor", "Pudgy Penguins").
-   **TICKERS:** Max 10 chars, uppercase. If name is 3+ words, use acronym. Otherwise, combine and truncate (e.g., "Pudgy Penguins" -> "PUDGYPENGU").

**//-- CASE STUDIES --//**
-   Context: Text says \`gm "INTO THE ETHER"\` -> Output: \`{"name": "Into The Ether", "ticker": "ETHER"}\` (Obeys LAW 1)
-   Context: Image of a dog in a burning room -> Output: \`{"name": "This Is Fine Dog", "ticker": "TIFD"}\` (Obeys LAW 2)
-   Context: Text says "Market closes up 500 points" -> Output: \`{"name": "Market Up", "ticker": "MARKETUP"}\` (Obeys LAW 3)

**//-- EXECUTION --//**
**ANALYZE THIS CLEAN DATA:**
-   **Main Text:** "${tweetData.mainText}"
-   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
-   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

**YOUR TASK:**
Generate 5 unique concepts. The first must be your highest-conviction play. Your entire response must be ONLY the valid JSON array. Execute.
`;        
        const promptParts = [
            { text: fullPrompt } 
        ];

        if (tweetData.mainImageUrl) { // Use mainImageUrl as it's guaranteed to exist
            const imagePart = await fetchImageAsBase64(tweetData.mainImageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
            }
        }

        console.log("Sending Hardened prompt to Gemini...");
        
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