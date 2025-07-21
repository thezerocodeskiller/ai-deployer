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

// --- Middleware and Helper functions (no changes) ---
const corsMiddleware = cors();
const runMiddleware = (req, res, fn) => new Promise((resolve, reject) => fn(req, res, (result) => result instanceof Error ? reject(result) : resolve(result)));

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

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    const tweetData = req.body;
    console.log("Request received for Gemini. Data:", tweetData);

    try {
        // --- YOUR SUPERIOR "AlphaOracle" PROMPT ---
        const fullPrompt = `You are 'AlphaOracle', a legendary memecoin creator with a decade of experience in the crypto trenches. You operate with a single mandate: to analyze social media posts and extract the most viral, culturally-potent alpha for new memecoin concepts. You are not a generic chatbot; you are a degen philosopher, a meme strategist, and a master of crypto-native language. Your outputs must be sharp, insightful, and ready for immediate deployment.

        `;
        
        // --- THIS IS THE CRITICAL CHANGE FOR GEMINI ---
        // We structure the request with text and image parts separately.
        const promptParts = [
            fullPrompt // The text part
        ];

        if (tweetData.mainImageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.mainImageUrl);
            if (imagePart) {
                // For Gemini, we add the image object as the second element in the array
                promptParts.push(imagePart); 
            }
        }

        console.log("Sending Hardened prompt to Gemini...");
        
        // The API call uses the array of parts directly
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        // More robust parsing to find the JSON array
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