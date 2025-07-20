const express = require('express');
const cors = require('cors');
const axios = require('axios'); // We need this to fetch the image
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = "AIzaSyA240WnSmytWudQBqSXO4eGDTycgB3QEUE"; // Make sure your API key is here
const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; // Optimized for speed and multimodal tasks

// Initialize the Generative AI client
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

const app = express();
const port = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// --- NEW HELPER FUNCTION: Fetches an image and converts it to Base64 ---
async function fetchImageAsBase64(imageUrl) {
    try {
        console.log(`Fetching image from: ${imageUrl}`);
        const response = await axios.get(imageUrl, {
            responseType: 'arraybuffer' // Important for handling binary image data
        });
        const contentType = response.headers['content-type'];
        const base64Data = Buffer.from(response.data, 'binary').toString('base64');
        return {
            inlineData: {
                data: base64Data,
                mimeType: contentType
            }
        };
    } catch (error) {
        console.error("Error fetching or converting image:", error.message);
        return null; // Return null if the image can't be fetched
    }
}

// --- The Main AI Logic Function (NOW MULTIMODAL!) ---
// --- The Main AI Logic Function (Final Version) ---
// --- The Main AI Logic Function (OPTIMIZED FOR SPEED) ---
async function generateCoinConcept(tweetData) {
    const { mainText, quotedText, imageUrl } = tweetData;
    
    // 1. Construct the new, streamlined prompt
    const fullPrompt = `Task: Generate a memecoin Name and Ticker from the provided context. Prioritize the image if present. Output ONLY a valid JSON object.

Context:
- Text: "${mainText}"
- Quoted Text: "${quotedText || 'N/A'}"
- Media Attached: ${imageUrl || tweetData.videoUrl ? 'Yes' : 'No'}

Rules:
- Name: Highest priority is the image's subject. Second priority is a standout phrase from the text. 1-4 words, max 32 chars. No @usernames or metadata.
- Ticker: If text has $XXXX, use XXXX. If name is 3+ words, use acronym. Otherwise, combine words, uppercase, and truncate to 10 chars.

Example Output: {"name": "Monad Bankruptcy", "ticker": "MONADBANKR"}

JSON Output:
`;

    const promptParts = [fullPrompt];
    
    // 2. Fetch the image and add it to the prompt parts if it exists
    if (imageUrl) {
        const imagePart = await fetchImageAsBase64(imageUrl);
        if (imagePart) {
            promptParts.push(imagePart);
        }
    }
    
    // 3. Call the Gemini API
    const result = await model.generateContent(promptParts);
    const response = result.response;
    const text = response.text();

    console.log("--- Received from Gemini ---\n", text, "\n--------------------------\n");

    // 4. Parse the JSON response
    try {
        const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanedText);
    } catch (e) {
        console.error("Error parsing JSON from AI:", e, "Raw text was:", text);
        return { name: "AI PARSE ERROR", ticker: "ERROR" };
    }
}

// --- The API Endpoint (no changes needed here) ---
app.post('/generate-name', async (req, res) => {
    console.log("Received a request to /generate-name");
    const tweetData = req.body;
    console.log("Tweet Data received:", tweetData);

    try {
        const aiResponse = await generateCoinConcept(tweetData);
        console.log("Sending back AI response:", aiResponse);
        res.json(aiResponse);
    } catch (error) {
        console.error("Error during AI generation:", error);
        res.status(500).json({ error: "Failed to generate AI concept" });
    }
});

// Start the server
app.listen(port, () => {
    console.log(`Uxento AI server is running on http://localhost:${port}`);
});