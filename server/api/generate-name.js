// --------------------------------------------
// generate-name.js  –  Vercel serverless
// --------------------------------------------
const cors = require('cors');
const axios = require('axios');
const sharp = require('sharp');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const API_KEY = process.env.API_KEY;
if (!API_KEY) throw new Error('Missing API_KEY env var');

const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash-8b',
  safetySettings: [
    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
  ]
});

const corsMiddleware = cors();
const runMiddleware = (req, res, fn) =>
  new Promise((resolve, reject) =>
    fn(req, res, (r) => (r instanceof Error ? reject(r) : resolve(r)))
  );

// ---------- image helper ----------
async function fetchAndProcessImage(url) {
  try {
    const { data } = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = await sharp(data)
      .resize(384, 384, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 70 })
      .toBuffer();
    return { inlineData: { data: buffer.toString('base64'), mimeType: 'image/jpeg' } };
  } catch {
    return null;
  }
}

// ---------- handler ----------
module.exports = async (req, res) => {
  await runMiddleware(req, res, corsMiddleware);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const tweetData = req.body;

  // 1. build single clean text
  const combinedText = [
    tweetData.mainText,
    tweetData.quotedText
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  // 2. system prompt – zero excuses
  const systemPrompt = `
You are 'AlphaOracle V6', The Ultimate Memecoin AI.
Your primary goal is to be creative, but you will NEVER output placeholders like "Default", "Empty", "No Signal", "N/A", etc.

OUTPUT RULES:
- Name ≤ 32 chars
- Ticker ≤ 10 chars

PRIORITY ORDER (highest → lowest):
1. Explicit phrases in "quotes" or tickers like $XYZ
2. Named entities (person, project, handles, hashtags)
3. Creative fusion of WHO + WHAT + ACTION
4. Literal impactful phrases from the tweet
5. Key nouns from tweet or image
6. **HYPER-LITERAL GUARANTEE** – use the first 3–4 meaningful words of the tweet as both name and ticker (truncate ticker to 10). Never placeholders.

EXAMPLES:
Tweet: "Watch Falcon 9 launch the @SES_Satellites O3b mPOWER mission to orbit"
→ [{"name":"Falcon 9 Launch","ticker":"F9LAUNCH"}, ...]

Tweet: "@0xSweep 🤝"
→ [{"name":"Sweep Handshake","ticker":"SWEEP"}, ...]

Return **only** a valid JSON array like:
[{"name":"Example","ticker":"EX"}]
`;

  // 3. build prompt parts
  const userParts = [
    {
      text: `Tweet: "${combinedText || 'Empty tweet'}"
Media: ${tweetData.mainImageUrl ? 'Yes' : 'No'}`
    }
  ];
  if (tweetData.mainImageUrl) {
    const img = await fetchAndProcessImage(tweetData.mainImageUrl);
    if (img) userParts.push(img);
  }

  // 4. call Gemini
  try {
    const chat = model.startChat({ history: [{ role: 'user', parts: [{ text: systemPrompt }] }] });
    const result = await chat.sendMessage(userParts);
    const text = result.response.text();
    const match = text.match(/\[.*\]/s);
    if (!match) throw new Error('No JSON array returned');

    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    res.status(200).json(JSON.parse(match[0]));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'AI generation failed', details: e.message });
  }
};