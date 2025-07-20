const cors = require('cors');
const axios = require('axios');
const Anthropic = require("@anthropic-ai/sdk");

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
    throw new Error("FATAL ERROR: ANTHROPIC_API_KEY is not set in environment variables.");
}
const MODEL_NAME = "claude-3-haiku-20240307";

const anthropic = new Anthropic({
    apiKey: ANTHROPIC_API_KEY,
});

async function fetchImageAsBase64(imageUrl) {
    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
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

module.exports = async (req, res) => {
    await new Promise((resolve, reject) => {
        cors()(req, res, (result) => (result instanceof Error ? reject(result) : resolve(result)));
    });

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    const tweetData = req.body;
    console.log("Request received for Claude. Data:", tweetData);

    try {
        const systemPrompt = `Task: Generate a memecoin Name and Ticker from the provided context. Prioritize the image if present. Output ONLY a valid JSON object. Context is provided in the user message. Rules: - Name: Highest priority is the image's subject. Second priority is a standout phrase from the text. 1-4 words, max 32 chars. No @usernames or metadata. - Ticker: If text has $XXXX, use XXXX. If name is 3+ words, use acronym. Otherwise, combine words, uppercase, and truncate to 10 chars. Example Output: {"name": "Monad Bankruptcy", "ticker": "MONADBANKR"} JSON Output: `;

        // --- CORRECTED LOGIC ---
        // The user message content must be an array that holds both the text and the image objects.
        const userMessageContent = [
            {
                type: 'text',
                text: `Here is the content to analyze: - Text: "${tweetData.mainText}" - Quoted Text: "${tweetData.quotedText || 'N/A'}"`
            }
        ];
        
        if (tweetData.imageUrl) {
            const imagePart = await fetchImageAsBase64(tweetData.imageUrl);
            if (imagePart) {
                // Push the image directly into the same content array
                userMessageContent.push(imagePart);
            }
        }

        console.log("Sending request to Claude Haiku...");
        
        const response = await anthropic.messages.create({
            model: MODEL_NAME,
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{
                role: 'user',
                // The 'content' key should now hold the array with both text and image
                content: userMessageContent 
            }]
        });

        const text = response.content[0].text;
        console.log("Received from Claude:", text);

        const aiResponse = JSON.parse(text.replace(/```json/g, '').replace(/```/g, '').trim());
        res.status(200).json(aiResponse);

    } catch (error) {
        console.error("Error during AI generation with Claude:", error);
        // Provide a more detailed error response during development
        res.status(500).json({ 
            error: "Failed to generate AI concept",
            details: error.message 
        });
    }
};