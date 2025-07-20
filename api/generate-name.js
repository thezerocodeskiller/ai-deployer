// This is now a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-pro";

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
        const fullPrompt = `Task: Generate 5 creative and relevant memecoin Name and Ticker pairs from the provided context. Prioritize the image if present. Output ONLY a valid JSON array of objects.
        
        Context: 
        - Text: "${tweetData.mainText}" 
        - Quoted Text: "${tweetData.quotedText || 'N/A'}" 
        - Media Attached: ${tweetData.imageUrl || tweetData.videoUrl ? 'Yes' : 'No'}

        Rules:
        - Each Name should be 1-4 words, max 32 chars. Do not use @usernames.
        - Each Ticker should be an uppercase acronym or condensed version of the name, max 10 chars.
        - The very first result in the array should be the most direct and highest quality suggestion.

        Example Output:
        [
            {"name": "Radical Left Lunatics", "ticker": "LUNATICS"},
            {"name": "Trump Testimony", "ticker": "TRUMPTAPE"},
            {"name": "Grand Jury", "ticker": "JURY"},
            {"name": "Epstein Won't Satisfy", "ticker": "SATISFY"},
            {"name": "Washington Times", "ticker": "WASHTIMES"}
        ]

        JSON Output: `;
        
        // --- THIS IS THE FIX ---
        // The text prompt must be wrapped in a {text: ...} object to be a valid "Part".
        const promptParts = [
            { text: fullPrompt } 
        ];

        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) {
                promptParts.push(imagePart); // imagePart is already a valid "Part" object
            }
        }

        console.log("Sending request to Gemini for 5 options...");
        
        // The generateContent call itself was correct. The data inside was not.
        const result = await model.generateContent({ contents: [{ parts: promptParts }] });
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        const aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        res.status(200).json(aiResponse);

    } catch (error) {
        // Log the full error for better debugging on the server side
        console.error("Full error during AI generation:", error); 
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};