// This is now a dedicated serverless function for Vercel.
const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY; 
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-flash-latest"; // Using the upgraded, more capable model

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
        const fullPrompt = `You are an expert memecoin creator and a crypto-native degen. Your goal is to analyze a tweet's content (text, quotes, and images) to find the most viral, funny, edgy, or absurd element and transform it into 5 high-quality, Solana-based memecoin concepts.

        **Primary Directive: Find the Meme.**
        Analyze the content with the following priority:
        1.  **Image/Video Content:** The visual is the most powerful part. A picture of a cat in a hat is more important than the text "good morning." The primary concept MUST come from the visual if one exists.
        2.  **Quoted Text & Headlines:** Direct quotes or headlines are often the most meme-worthy text.
        3.  **Standout Phrases:** Look for short, punchy, ironic, or absurd phrases in the main tweet body.
        4.  **Overall Vibe:** If the content is generic, capture the theme (e.g., politics, wholesome, crypto drama).

        **Style Guide for Names:**
        -   **Be Clever:** Use humor, irony, and cultural references.
        -   **Be Edgy (but not hateful):** Memes often live on the edge. Dark humor is acceptable.
        -   **Create Portmanteaus:** Combine words creatively (e.g., "Fiscal Farce").
        -   **Keep it Punchy:** 1-3 words is ideal. Max 32 characters.
        -   **IGNORE METADATA:** Do NOT use usernames, handles, URLs, hashtags, or "replying to" text. Focus only on the core content.

        **Style Guide for Tickers:**
        -   **Be Memorable:** Use clever abbreviations, phonetic spellings (like $WIF for "with"), or condensed words.
        -   **Must be Uppercase & Short:** Max 10 characters.
        -   The ticker should feel like a natural fit for the name.

        **High-Quality Examples of What I Expect:**
        -   For a tweet about a "white van abduction," you generate: {"name": "White Van", "ticker": "VAN"}
        -   For a Babylon Bee article about debt, you generate: {"name": "Trillion Dollar Cut", "ticker": "TRILCUT"}
        -   For a philosophical tweet "Love is evolved biotechnology," you generate: {"name": "Evolved Biotechnology", "ticker": "EVOBIO"}

        **Tweet Content to Analyze:**
        -   **Main Text:** "${tweetData.mainText}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.imageUrl ? 'Yes, an image is present and is the highest priority.' : 'No media.'}

        **Your Task:**
        Based on all the rules above, provide 5 diverse and high-quality concepts. The first result should be the absolute best and most viral option. Output ONLY a valid JSON array of objects. Do not write any other text or explanations.

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