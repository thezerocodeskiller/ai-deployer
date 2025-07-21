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
        // Your prompt remains the same, requesting 3 suggestions.
        const fullPrompt = `... YOUR PROMPT FOR 3 SUGGESTIONS GOES HERE ...`; // Keep the prompt from the previous step
        
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