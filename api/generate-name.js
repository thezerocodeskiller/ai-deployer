// This is now a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-2.5-flash-lite-preview-06-17"; // Using the upgraded, more capable model

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
        // --- THE NEW, HIGH-QUALITY PROMPT ---
        const fullPrompt = `You are a master memecoin creator and a crypto-native degen. Your sole purpose is to identify the single most viral, catchy, and culturally relevant phrase or concept within a tweet and build 5 diverse and high-quality Solana memecoin ideas around it.

**The Golden Rules of Meme Selection:**
1.  **QUOTED TEXT IS KING:** If the tweet text contains a phrase inside quotation marks (e.g., "INTO THE ETHER"), that phrase is ALWAYS the #1 priority for the name. It overrides everything else.
2.  **IMAGE IS QUEEN:** If there is NO quoted text, the primary subject of the image or video becomes the priority.
3.  **ABSURD PHRASES WIN:** If there is no media, find the most absurd, funny, or powerful short phrase in the main text.

**Style Guide for Names:**
-   **Strip Boilerplate:** Ignore generic text like "gm," "retweeted," collection numbers (#151/207), and "by @user". Focus on the core message.
-   **Be Clever & Ironic:** Capture the cultural context. A satirical headline should have a satirical name.
-   **Use Portmanteaus:** Creatively combine words (e.g., "Fiscal Farce" becomes $FISCAL).
-   **Keep it Punchy:** 1-4 words is ideal. Max 32 characters.
-   **IGNORE METADATA:** Absolutely no usernames, handles, URLs, or hashtags in the final name/ticker.

**Style Guide for Tickers:**
-   **Be Creative:** Think phonetically ($WIF for "with"), use memorable acronyms, or create clever, condensed words.
-   **Must Relate Directly to the Name.**
-   **Must be Uppercase & Short:** Max 10 characters.

**PERFECT EXAMPLE (Your Use Case):**
-   For a tweet: 'gm "INTO THE ETHER #151/207" by @beeple' with an image of an Ether crystal.
-   CORRECT OUTPUT #1: {"name": "Into The Ether", "ticker": "ETHER"}
-   INCORRECT OUTPUT: {"name": "Eth Crystal Planet", "ticker": "ETHCP"} (This wrongly prioritized the image over the explicit quote).

**Tweet Content to Analyze:**
-   **Main Text:** "${tweetData.mainText}"
-   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
-   **Media Attached:** ${tweetData.imageUrl ? 'Yes, an image is present.' : 'No media.'}

**Your Task:**
Based on all the rules above, provide 5 diverse and high-quality concepts. The first result must be the absolute best option according to the Golden Rules. Output ONLY a valid JSON array of objects.

JSON Output:
`;
        
        // Correctly structure the prompt parts for the Gemini API
        const promptParts = [
            { text: fullPrompt } 
        ];

        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
            }
        }

        console.log("Sending new expert prompt to Gemini for 5 options...");
        
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