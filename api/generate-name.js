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
    console.log("Request received for Gemini. Data:", tweetData);

    try {
        const fullPrompt = `You are 'AlphaOracle', a memecoin creator AI. Your task is to analyze social media posts and extract viral concepts.

        **//-- CRITICAL DIRECTIVE: GROUNDING --//**
        This is your most important rule. **Your suggestions MUST be directly and provably derived from the provided text or image.** You are forbidden from inventing concepts or hallucinating connections that are not explicitly present. If the content is about a crime, your suggestions must be about that crime. If it's about a dog, the suggestions must be about that dog. Do not inject crypto themes where none exist.

        **//-- THE UNBREAKABLE LAWS OF MEME SELECTION --//**

        **LAW 1: THE LAW OF THE EXPLICIT TICKER (ABSOLUTE PRIORITY)**
        If the tweet text or quoted text explicitly mentions a ticker symbol (e.g., "$BONK"), that ticker is the **ALPHA SIGNAL** and must be your #1 suggestion.

        **LAW 2: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
        If there is no explicit ticker, the visual content is the next priority. Identify the most dominant, literal subject. (e.g., An image of a man in a courtroom -> "Courtroom Sketch").

        **LAW 3: THE LAW OF TEXTUAL CONTEXT (MERGED ANALYSIS)**
        If no ticker or media, scan the **Main Text and Quoted Text combined** for the most impactful, literal phrase. (e.g., "Bryan Kohberger prowled room by room" -> "Bryan Kohberger").

        **//-- FORBIDDEN ACTIONS --//**
        -   **DO NOT** generate abstract concepts (e.g., "The Void," "No Signal").
        -   **DO NOT** make meta-references to yourself or AI.
        -   **DO NOT** invent crypto themes (like "Ether") if they are not in the source text/image.

        **//-- Ticker Generation Rules --//**
        1.  If Law 1 is triggered, use the explicit ticker.
        2.  If the Name has 3+ words, create an acronym.
        3.  Otherwise, combine the words of the name, uppercase, and truncate to 10 characters.

        **//-- CASE STUDIES --//**
        -   **TWEET:** "How Bryan Kohberger prowled room by room..." No media.
        -   **FAILURE:** \`{"name": "Into The Ether"}\` -> Ungrounded hallucination. Broke the Grounding Directive.
        -   **SUCCESS:** \`{"name": "Bryan Kohberger", "ticker": "KOHBERGER"}\` -> Correctly extracted the literal subject from the text.

        -   **TWEET:** Main: "Good idea." Quoted: "We need to keep the suitcoins companies accountable." No media.
        -   **SUCCESS:** \`{"name": "Suitcoins", "ticker": "SUITCOINS"}\` -> Correctly analyzed the combined textual context.
        
        **//-- EXECUTION ORDER --//**

        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

        **YOUR TASK:**
        Based on all unbreakable laws above, generate 5 unique and hyper-literal concepts. Your entire response must be ONLY a valid JSON array. Execute.

        JSON Output:
        `;
        
        const promptParts = [ fullPrompt ];

        if (tweetData.mainImageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.mainImageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
            }
        }

        console.log("Sending Hyper-Literal prompt to Gemini...");
        
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        const jsonMatch = text.match(/\[.*\]/s);
        if (!jsonMatch) {
            throw new Error("AI did not return a valid JSON array.");
        }

        const aiResponse = JSON.parse(jsonMatch[0]);
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Full error during AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};