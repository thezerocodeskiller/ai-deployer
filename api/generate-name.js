// This is the complete and final server file with the best prompt yet.

const cors = require('cors');
const axios = require('axios');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// --- CONFIGURATION ---
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("FATAL ERROR: API_KEY (Google) is not set in environment variables.");
}
const MODEL_NAME = "gemini-1.5-flash-latest";

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL_NAME });

// --- MIDDLEWARE SETUP & HELPERS (No changes) ---
const corsMiddleware = cors();
const runMiddleware = (req, res, fn) => new Promise((resolve, reject) => fn(req, res, (result) => result instanceof Error ? reject(result) : resolve(result)));
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
    await runMiddleware(req, res, corsMiddleware);

    if (req.method === 'OPTIONS') { return res.status(200).end(); }
    if (req.method !== 'POST') { return res.status(405).json({ error: 'Method Not Allowed' }); }

    const tweetData = req.body;
    console.log("Request received for Final Gemini Prompt. Data:", tweetData);

    try {
        // --- The Final "AlphaOracle" Prompt v2 ---
        const fullPrompt = `You are 'AlphaOracle', a legendary memecoin creator. Your task is to analyze social media posts and extract the most viral, culturally-potent alpha for new memecoin concepts. Your outputs must be sharp, insightful, and ready for immediate deployment. You must filter out all noise (usernames, generic phrases, URLs) and focus only on the core signal.

        **//-- THE UNBREAKABLE LAWS OF NAME SELECTION --//**
        You will analyze the provided data according to this strict hierarchy:

        **LAW 1: THE LAW OF QUOTATION (ABSOLUTE PRIORITY)**
        If the main text contains a phrase in **"quotation marks"**, that phrase is the ALPHA SIGNAL and MUST be the primary concept. It overrides all other laws.

        **LAW 2: THE LAW OF THE NAMED ENTITY (HIGH PRIORITY)**
        If no quote exists, look for a named subject, especially one introduced with words like "Meet...", "This is...", or a capitalized proper noun. (e.g., "Meet Hero, the latest buddy..."). This is strong signal.

        **LAW 3: THE LAW OF THE IMAGE (VISUAL DOMINANCE)**
        If no quote or named entity, the visual content is the next priority. The concept should revolve around what is *seen* in the image.

        **LAW 4: THE LAW OF THE ABSURD (TEXT-ONLY GOLD)**
        If no quote, named entity, or media, find the most absurd or powerful phrase in the text.

        **//-- TICKER GENERATION: THE ART OF THE MEME --//**
        Your goal is not a literal abbreviation but a memorable, viral symbol. You have several tactics at your disposal. Choose the one that best fits the meme.

        *   **The Acronym:** Use the first letter of each word. (e.g., "Buddies for Paws" -> $BFP).
        *   **The Core Noun:** Use the most powerful noun in the name. (e.g., "Buddies for Paws" -> $PAWS).
        *   **The Subject's Name:** Use the name of the entity. (e.g., "Meet Hero" -> $HERO).
        *   **The Phonetic/Slang:** Condense the name into a cool-sounding word. (e.g., "dog wif hat" -> $WIF).

        **//-- CRITICAL DIRECTIVE: AVOID META-REFERENCES --//**
        Your suggestions must NEVER refer to the process of creating a meme or being an AI. Your existence is a secret.

        **//-- CASE STUDY: LEARN FROM YOUR MISTAKE --//**
        -   **TWEET:** \`Gm Meet Hero, the latest buddy to join the BFP family... Buddies for Paws...\` + Image of a puppy.
        -   **FAILURE:** \`{"name": "Buddies For Paws", "ticker": "BFPAWS"}\` -> Ticker is too literal and not memorable.
        -   **SUCCESS #1 (Best):** \`{"name": "Hero", "ticker": "HERO"}\` -> Correctly obeyed LAW 2 and used The Subject's Name tactic.
        -   **SUCCESS #2 (Good):** \`{"name": "Buddies for Paws", "ticker": "BFP"}\` -> Correctly used The Acronym tactic.

        **//-- EXECUTION ORDER --//**

        **ANALYZE THIS DATA:**
        -   Main Text: "${tweetData.mainText}"
        -   Quoted Text: "${tweetData.quotedText || 'N/A'}"
        -   Media Attached: ${tweetData.mainImageUrl ? 'Yes, an image is present. Analyze its content.' : 'No media attached. Analyze text only.'}

        **YOUR TASK:**
        Generate 5 unique concepts. The first result must be your highest-conviction play. Your entire response must be ONLY the valid JSON array. No explanations. Execute.

        JSON Output:
        `;

        const promptParts = [fullPrompt];

        if (tweetData.mainImageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.mainImageUrl);
            if (imagePart) {
                promptParts.push(imagePart);
            }
        }
        
        console.log("Sending final prompt to Google Gemini...");
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
        console.error("Error during AI generation:", error);
        res.status(500).json({ error: "Failed to generate AI concept", details: error.message });
    }
};