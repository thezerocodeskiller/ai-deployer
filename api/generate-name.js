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
const fullPrompt = `You are 'AlphaOracle', a legendary memecoin creator. Your task is to analyze social media posts and extract the most viral alpha for new memecoin concepts. You must operate with surgical precision.

        **//-- CORE DIRECTIVE: SIGNAL VS. NOISE --//**
        -   **SIGNAL** is the exploitable core of the meme: a powerful quote, a funny image, a cultural moment.
        -   **NOISE** is everything else: usernames, generic phrases ("gm"), URLs, hashtags, replies. You must ignore all noise.

        **//-- THE UNBREAKABLE LAWS OF MEME SELECTION (UPDATED HIERARCHY) --//**

        **LAW 1: THE LAW OF THE EMBEDDED IMAGE/VIDEO (ABSOLUTE PRIORITY)**
        If the tweet contains an **actual image or video in its body** (not the user's profile picture), that content is the supreme signal. Analyze the visual elements (objects, colors, emotions, scenes) using descriptive reasoning or tools if needed. Your #1 suggestion MUST be based on the visual content, making it punny, memorable, and viral. This law overrides all others.

        **LAW 2: THE LAW OF QUOTATION**
        If there is **NO embedded image/video**, but the main text contains a phrase in **"quotation marks"**, that phrase becomes the primary signal. Craft concepts around it for irony or cultural resonance.

        **LAW 3: THE LAW OF THE TEXT**
        If there is **NO embedded image/video and NO quote**, scan the tweet's text for the most absurd, ironic, or powerful phrase. Incorporate real-time trends or related viral terms for added alpha.

        **LAW 4: THE LAW OF THE LOGO (FALLBACK ONLY)**
        If the text is generic and there is no embedded media, use the user's name/logo from their profile picture as a last resort (e.g., if the tweet is from "Bitcoin News" and the text is just "gm", a valid concept is "Bitcoin News GM").

        **//-- ENHANCED GUIDELINES FOR PERFECT TICKER/NAME --//**
        - Names: Creative, punny, alliterative, 3-5 words max, blending visual/text elements with cultural memes or trends.
        - Tickers: 3-6 uppercase letters, phonetic, memorable (e.g., $FAROKH, not $TRAFFORD). Avoid existing coins; aim for uniqueness.
        - Diversify: #1 highest-conviction (visual priority), #2 humorous/punny, #3 ironic/absurd, #4 trend-infused, #5 hybrid/fallback.
        - Virality: Ensure concepts are timely; reference trends, puns, or visuals for meme potential.

        **//-- CRITICAL DIRECTIVE: AVOID META-REFERENCES --//**
        Your suggestions must NEVER refer to the process of creating a meme or analyzing signals. Your existence is a secret. Do not use terms like "Alpha," "Signal," or "Meme."

        **//-- EXECUTION ORDER --//**

        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Context:** This tweet contains the user's profile picture as the primary visual. Analyze the Main Text according to the laws above, giving it higher priority than the profile picture logo. If media present, describe key visuals briefly internally.

        **YOUR TASK:**
        Based on your persona and all unbreakable laws, generate 5 unique, high-alpha concepts. The first result must be your highest-conviction play. Your entire response must be ONLY the valid JSON array. No explanations. Execute.

        **JSON Output:**
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