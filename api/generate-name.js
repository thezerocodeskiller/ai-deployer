// This is now a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const Anthropic = require("@anthropic-ai/sdk"); // <-- CHANGED: Import Anthropic

// --- CONFIGURATION ---
// IMPORTANT: You will create this environment variable in your Vercel settings
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error("FATAL ERROR: ANTHROPIC_API_KEY is not set in environment variables.");
}
const MODEL_NAME = "claude-3-haiku-20240307"; // <-- CHANGED: Use the Haiku model

const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
});

// --- MODIFIED HELPER FUNCTION: Fetches and converts image for Claude ---
async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        // Claude expects a specific format for image data
        return {
            type: 'image',
            source: {
                type: 'base64',
                media_type: response.headers['content-type'],
                data: Buffer.from(response.data).toString('base64'),
            },
        };
    } catch (error) {
        console.error("Error fetching image:", error.message);
        return null;
    }
}

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    // Set up CORS headers
    await new Promise((resolve, reject) => {
        cors()(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const tweetData = req.body;
    console.log("Request received for Claude. Data:", tweetData);

    try {
        // --- PROMPT CONSTRUCTION FOR CLAUDE ---
        // 1. The System Prompt contains the core instructions
        const systemPrompt = `Task: Generate a memecoin Name and Ticker from the provided context. Prioritize the image if present. Output ONLY a valid JSON object. Context is provided in the user message. Rules: - Name: Highest priority is the image's subject. Second priority is a standout phrase from the text. 1-4 words, max 32 chars. No @usernames or metadata. - Ticker: If text has $XXXX, use XXXX. If name is 3+ words, use acronym. Otherwise, combine words, uppercase, and truncate to 10 chars. Example Output: {"name": "Monad Bankruptcy", "ticker": "MONADBANKR"} JSON Output: `;

        // 2. The User Content contains the data (text and optional image)
        const userContent = [
            {
                type: 'text',
                text: `Here is the content to analyze: - Text: "${tweetData.mainText}" - Quoted Text: "${tweetData.quotedText || 'N/A'}"`
            }
        ];
        
        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) {
                userContent.push(imagePart); // Add the formatted image data
            }
        }

        console.log("Sending request to Claude Haiku...");
        
        // 3. The API Call
        const response = await anthropic.messages.create({
            model: MODEL_NAME,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{
                role: 'user',
                content: userContent
            }]
        });

        // 4. Extract the response text
        const text = response.content[0].text;
        console.log("Received from Claude:", text);

        const aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Error during AI generation with Claude:", error);
        res.status(500).json({ error: "Failed to generate AI concept" });
    }
};