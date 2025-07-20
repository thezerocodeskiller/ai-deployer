const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; // Using Flash for speed is ideal for generating multiple options quickly.

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// --- HELPER FUNCTION (no changes) ---
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
module.exports = async (req, res) => {
    // CORS setup (no changes)
    await new Promise((resolve, reject) => {
        cors()(req, res, (result) => {
            if (result instanceof Error) return reject(result);
            return resolve(result);
        });
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const tweetData = req.body;
    console.log("Request received. Data:", tweetData);

    try {
        // --- PROMPT UPGRADE ---
        const fullPrompt = `You are a viral memecoin expert for Solana. Your task is to generate 5 unique Name/Ticker options based on the provided context. Prioritize the image if present.

### CONTEXT
- Text: "${tweetData.mainText}"
- Quoted Text: "${tweetData.quotedText || 'N/A'}"
- Media Attached: ${tweetData.imageUrl || tweetData.videoUrl ? 'Yes' : 'No'}

### TASK
Generate an array of 5 unique coin Name and Ticker options. The first option should be the most direct and obvious, while the others can be more creative or focus on different aspects of the context. Output ONLY a single, valid JSON array and nothing else.

### FORMAT
[
  {"name": "First Option Name", "ticker": "FIRST"},
  {"name": "Second Option Name", "ticker": "SECOND"},
  {"name": "Third Option Name", "ticker": "THIRD"},
  {"name": "Fourth Option Name", "ticker": "FOURTH"},
  {"name": "Fifth Option Name", "ticker": "FIFTH"}
]

### RULES (Apply to every option)
- Name: Highest priority is the image's subject. Second priority is a standout phrase from the text. 1-4 words, max 32 chars. No @usernames or metadata.
- Ticker: If text has $XXXX, use XXXX. If name is 3+ words, use an acronym. Otherwise, combine words, uppercase, and truncate to 10 chars.

### EXAMPLE OUTPUT
[
  {"name": "Monad Bankruptcy", "ticker": "MONADBANKR"},
  {"name": "Chapter 11", "ticker": "CHAPTER11"},
  {"name": "Monad Foundation", "ticker": "MONADFOUND"},
  {"name": "Testnet Halted", "ticker": "TESTHALT"},
  {"name": "Fled The Country", "ticker": "FLED"}
]

### FINAL OUTPUT
Now, process the context and return only the JSON array.
`;
        const promptParts = [fullPrompt];

        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) promptParts.push(imagePart);
        }

        console.log("Sending request to Gemini for 5 options...");
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received 5 options from Gemini:", text);

        const aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Error during AI generation:", error);
        res.status(500).json({ error: "Failed to generate AI concept" });
    }
};