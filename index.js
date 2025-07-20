const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    // This will cause a controlled crash if the API key is not set in Vercel, which is good for debugging.
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-flash-latest";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// --- CREATE THE EXPRESS APP ---
const app = express();
app.use(cors()); // Enable CORS for all routes
app.use(express.json());

// --- HELPER FUNCTION: Fetches and converts image ---
async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        return { inlineData: { data: Buffer.from(response.data).toString('base64'), mimeType: response.headers['content-type'] } };
    } catch (error) {
        console.error("Error fetching image:", error.message);
        return null;
    }
}

// --- AI LOGIC FUNCTION ---
async function generateCoinConcept(tweetData) {
    // (This entire function remains the same as before)
    const { mainText, quotedText, imageUrl } = tweetData;
    const fullPrompt = `Task: Generate a memecoin Name and Ticker from the provided context. Prioritize the image if present. Output ONLY a valid JSON object. Context: - Text: "${mainText}" - Quoted Text: "${quotedText || 'N/A'}" - Media Attached: ${imageUrl || tweetData.videoUrl ? 'Yes' : 'No'} Rules: - Name: Highest priority is the image's subject. Second priority is a standout phrase from the text. 1-4 words, max 32 chars. No @usernames or metadata. - Ticker: If text has $XXXX, use XXXX. If name is 3+ words, use acronym. Otherwise, combine words, uppercase, and truncate to 10 chars. Example Output: {"name": "Monad Bankruptcy", "ticker": "MONADBANKR"} JSON Output: `;
    const promptParts = [fullPrompt];
    if (imageUrl) {
        const imagePart = await fetchImageAsBase64(imageUrl);
        if (imagePart) promptParts.push(imagePart);
    }
    const result = await model.generateContent(promptParts);
    const text = result.response.text();
    console.log("Received from Gemini:", text);
    try {
        return JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
    } catch (e) {
        console.error("Error parsing JSON from AI:", text);
        return { name: "AI PARSE ERROR", ticker: "ERROR" };
    }
}

// --- CORRECTED API ENDPOINT ---
// We are now using '/generate-name' as the route, not '/api/generate-name'
app.post('/generate-name', async (req, res) => {
    console.log("Request received at /generate-name");
    try {
        const aiResponse = await generateCoinConcept(req.body);
        res.status(200).json(aiResponse);
    } catch (error) {
        console.error("Error during AI generation:", error);
        res.status(500).json({ error: "Failed to generate AI concept" });
    }
});

// --- EXPORT THE APP FOR VERCEL ---
module.exports = app;