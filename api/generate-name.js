// This is a dedicated serverless function for Vercel.
const cors = require('cors');
// No need for 'axios' since we are no longer fetching images
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

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

    const tweetData = req.body;
    console.log("Request received for FAST AI. Data (text only):", tweetData);

    try {
        // --- SPEED TRICK: Simplified Prompt for maximum speed ---
        const fullPrompt = `
You are a fast memecoin name and ticker generator. Extract the most obvious, literal concept from the text.

**RULES:**
1.  If the text contains "quotation marks", that is the #1 concept.
2.  Otherwise, use the most impactful 2-3 word phrase from the text.
3.  Be extremely literal. Do not invent concepts.
4.  Generate 3 unique concepts in a valid JSON array of objects, like this: [{"name": "My Coin", "ticker": "MYCOIN"}]. Your entire response must be ONLY this JSON array.

**DATA:**
-   Main Text: "${tweetData.mainText}"
-   Quoted Text: "${tweetData.quotedText || ''}"

JSON Output:
`;        
        // --- SPEED TRICK: We are no longer passing images to the AI ---
        const promptParts = [ fullPrompt ];

        console.log("Sending FAST prompt to Gemini...");
        
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received from FAST Gemini:", text);

        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) { throw new Error("AI did not return a valid JSON array."); }

        const aiResponse = JSON.parse(jsonMatch[0]);
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Full error during FAST AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};