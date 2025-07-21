const cors = require('cors');
const axios = require('axios');

const corsMiddleware = cors();
const runMiddleware = (req, res, fn) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) { return reject(result); }
            return resolve(result);
        });
    });
};

module.exports = async (req, res) => {
    await runMiddleware(req, res, corsMiddleware);

    const { imageUrl } = req.query; // Get the image URL from a query parameter

    if (!imageUrl) {
        return res.status(400).json({ error: 'imageUrl query parameter is required.' });
    }

    try {
        const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
        const base64Data = Buffer.from(response.data).toString('base64');
        const mimeType = response.headers['content-type'];
        
        res.status(200).json({
            base64: base64Data,
            mimeType: mimeType
        });

    } catch (error) {
        console.error("Error fetching image via proxy:", error.message);
        res.status(500).json({ error: "Failed to fetch image." });
    }
};