const crypto = require('crypto');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { urls } = req.body;
    const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;

    if (!urls || !Array.isArray(urls)) {
        return res.status(400).json({ error: 'Invalid URLs provided' });
    }

    if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET || !CLOUDINARY_CLOUD_NAME) {
        return res.status(500).json({ error: 'Server configuration missing' });
    }

    try {
        const results = await Promise.all(urls.map(async (url) => {
            // Extract Public ID from URL
            // Format: https://res.cloudinary.com/[cloud_name]/image/upload/v[version]/[public_id].[ext]
            const parts = url.split('/');
            const fileName = parts[parts.length - 1];
            const publicId = fileName.split('.')[0];

            const timestamp = Math.round(new Date().getTime() / 1000);
            const signature = crypto
                .createHash('sha1')
                .update(`public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`)
                .digest('hex');

            const formData = new URLSearchParams();
            formData.append('public_id', publicId);
            formData.append('timestamp', timestamp);
            formData.append('api_key', CLOUDINARY_API_KEY);
            formData.append('signature', signature);

            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`, {
                method: 'POST',
                body: formData
            });

            return await response.json();
        }));

        res.status(200).json({ success: true, results });
    } catch (err) {
        console.error('Deletion error:', err);
        res.status(500).json({ error: 'Failed to delete photos', details: err.message });
    }
}
