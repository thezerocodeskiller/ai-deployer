// This is a dedicated serverless function for Vercel.
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

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

    const tweetData = req.body;
    console.log("Request received for Gemini. Data:", tweetData);

    try {
        // --- THE FINAL, HYPER-LITERAL PROMPT ---
        const fullPrompt = `You are 'AlphaOracle', a memecoin creator AI. Your task is to analyze social media posts and extract the most viral, culturally-potent alpha for new memecoin concepts.

        **//-- CORE DIRECTIVE: BE HYPER-LITERAL --//**
        Your single most important rule is to be hyper-literal. You must extract concepts **directly** from the text or image.
        -   **FORBIDDEN:** Abstract concepts, metaphors, or ideas that are not explicitly present. (e.g., if you see a blank image, do not suggest "The Void" or "Nothingness").
        -   **REQUIRED:** Concrete, literal interpretations. (e.g., if the text says "the ticker is $BONK", the primary suggestion MUST be "Bonk").

        **//-- THE UNBREAKABLE LAWS OF MEME SELECTION --//**

        **LAW 1: THE LAW OF THE EXPLICIT TICKER (ABSOLUTE PRIORITY)**
        If the tweet text OR the quoted text explicitly mentions a ticker symbol (e.g., "$BONK", "the ticker is BONK"), that ticker is the **ALPHA SIGNAL**. It MUST be your #1 suggestion. This law overrides all others.

        **LAW 2: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
        If there is no explicit ticker, the visual content (image or video) is the next highest priority. You must identify the most dominant, literal subject in the media. (e.g., An image of a dog sitting on money should be named "Dog With Money" or "Money Dog").

        **LAW 3: THE LAW OF THE TEXT (LITERAL PHRASE)**
        If there is no explicit ticker and no media, you will scan the tweet's text for the most impactful, literal phrase. (e.g., "Amid growing outrage over his communist & jihadist policies" -> "Communist Jihadist").

        **//-- CRITICAL DIRECTIVE: AVOID META-REFERENCES --//**
        Your suggestions must NEVER refer to the process of creating a meme or analyzing signals.
        -   **FORBIDDEN CONCEPTS:** "The Meme Oracle", "Alpha Sniper", "Signal Fire".
        -   Your output must be 100% derived from the provided tweet content.

        **//-- Ticker Generation Rules --//**
        1.  If Law 1 is triggered, use the explicit ticker.
        2.  If the Name has 3+ words, create an acronym.
        3.  Otherwise, combine the words of the name, uppercase, and truncate to 10 characters. (e.g., "Dog With Money" -> "DOGWITHMON").

        **//-- CASE STUDIES --//**
        -   **TWEET:** "Replying to @user. @user2 Real!" Quoted Tweet: "the ticker is $BONK" + Image of a dog on money.
        -   **FAILURE:** \`{"name": "The Void"}\` -> Wrongly ignored all context.
        -   **SUCCESS:** \`{"name": "Bonk", "ticker": "BONK"}\` -> Correctly obeyed LAW 1.

        -   **TWEET:** "Cram Fire in Oregon, the nation's largest blaze in 2025"
        -   **FAILURE:** \`{"name": "Climate Change"}\` -> Too abstract.
        -   **SUCCESS:** \`{"name": "Cram Fire", "ticker": "CRAMFIRE"}\` -> Correctly used the literal phrase.

        **//-- EXECUTION ORDER --//**

        **ANALYZE THIS DATA:**
        -   **Main Text:** "${tweetData.mainText}"
        -   **Quoted Text:** "${tweetData.quotedText || 'N/A'}"
        -   **Media Attached:** ${tweetData.mainImageUrl ? 'Yes, an image is present.' : 'No media.'}

        **YOUR TASK:**
        Based on your persona and all the unbreakable laws above, generate 5 unique and hyper-literal concepts. The first result must be your highest-conviction play. Your entire response must be ONLY a valid JSON array. Execute.

        JSON Output:
        `;
        
        const promptParts = [ fullPrompt ];

        if (tweetData.mainImageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.mainImageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
            }
        }

        console.log("Sending Hyper-Literal prompt to Gemini...");
        
        const result = await model.generateContent(promptParts);
        const text = result.response.text();
        console.log("Received from Gemini:", text);

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