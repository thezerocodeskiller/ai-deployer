// This is now a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-flash-latest";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

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

// --- MAIN HANDLER FUNCTION ---
// This is the function Vercel will run when the endpoint is called.
module.exports = async (req, res) => {
    // Set up CORS headers manually for the serverless environment
    await new Promise((resolve, reject) => {
        cors()(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });

    // We only accept POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const tweetData = req.body;
    console.log("Request received. Data:", tweetData);

    try {
        const fullPrompt = `Task: Generate a memecoin Name and Ticker from the provided context. Prioritize the image if present. Output ONLY a valid JSON object. Context: - Text: "${tweetData.mainText}" - Quoted Text: "${tweetData.quotedText || 'N/A'}" - Media Attached: ${tweetData.imageUrl || tweetData.videoUrl ? 'Yes' : 'No'} Rules: - Name: Highest priority is the image's subject. Second priority is a standout phrase from the text. 1-4 words, max 32 chars. No @usernames or metadata. - Ticker: If text has $XXXX, use XXXX. If name is 3+ words, use acronym. Otherwise, combine words, uppercase, and truncate to 10 chars. Example Output: {"name": "Monad Bankruptcy", "ticker": "MONADBANKR"} JSON Output: `;
        const promptParts = [fullPrompt];

        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) promptParts.push(imagePart);
        }

        console.log("Sending request to Gemini...");
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received from Gemini:", text);

        const aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Error during AI generation:", error);
        res.status(500).json({ error: "Failed to generate AI concept" });
    }
};