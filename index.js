const express = require('express');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');

const app = express();
app.use(cors());
app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Peace Voices Endpoint (redirect or proxy)
app.get('/api/voices', async (req, res) => {
  try {
    const response = await fetch('https://peace-audio-worker.onrender.com/api/voices');
    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Generate Audio
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, language = 'English' } = req.body;
    if (!text) return res.status(400).json({ error: 'Text is required' });

    const voiceMap = {
      'Amharic': '21m00Tcm4TlvDq8ikWAM',
      'Oromo': '21m00Tcm4TlvDq8ikWAM',
      'English': '21m00Tcm4TlvDq8ikWAM',
      'default': '21m00Tcm4TlvDq8ikWAM'
    };

    const voiceId = voiceMap[language] || voiceMap.default;

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.75, similarity_boost: 0.85 }
      })
    });

    if (!ttsRes.ok) throw new Error('ElevenLabs error');

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    const uploadResult = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream({
        resource_type: 'video',
        folder: 'peace-voices',
        public_id: `voice-${Date.now()}`,
        format: 'mp3'
      }, (error, result) => error ? reject(error) : resolve(result)).end(audioBuffer);
    });

    res.json({ audio_url: uploadResult.secure_url });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Peace Audio Worker running on port ${PORT}`));
