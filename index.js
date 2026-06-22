const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ============================================================
// 1. GET /api/voices - Fetch ElevenLabs voices
// ============================================================
app.get('/api/voices', async (req, res) => {
  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    const data = await response.json();
    res.json(data.voices || []);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// ============================================================
// 2. POST /api/generate-audio - ElevenLabs TTS + Cloudinary
// ============================================================
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { voiceId, text } = req.body;

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_monolingual_v1',
        voice_settings: { stability: 0.5, similarity_boost: 0.5 }
      })
    });

    if (!ttsResponse.ok) {
      return res.status(500).json({ error: 'ElevenLabs API error' });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();

    const formData = new FormData();
    formData.append('file', new Blob([audioBuffer], { type: 'audio/mp3' }));
    formData.append('public_id', `peace-voices/${Date.now()}`);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          Authorization: `Basic ${btoa(
            process.env.CLOUDINARY_API_KEY + ':' + process.env.CLOUDINARY_API_SECRET
          )}`
        }
      }
    );

    if (!cloudinaryResponse.ok) {
      return res.status(500).json({ error: 'Cloudinary upload failed' });
    }

    const cloudinaryData = await cloudinaryResponse.json();

    res.json({ success: true, audioUrl: cloudinaryData.secure_url });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 3. POST /api/generate-text - Hugging Face (Text Generation)
// ============================================================
app.post('/api/generate-text', async (req, res) => {
  try {
    const { type, topic, tone } = req.body;

    const prompt = `Write a premium, high-quality ${type} on the topic: "${topic}". 
    Tone: ${tone}. 
    Length: 800-1200 words. 
    Use headings, subheadings, and bullet points where appropriate. 
    The content must be peaceful, educational, and inspiring.`;

    const response = await fetch(
      'https://api-inference.huggingface.co/models/google/flan-t5-large',
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inputs: prompt,
          parameters: { max_length: 1000, temperature: 0.7 }
        })
      }
    );

    if (!response.ok) {
      return res.status(500).json({ error: 'Hugging Face API error' });
    }

    const data = await response.json();
    const content = Array.isArray(data) ? data[0].generated_text : data.generated_text;

    res.json({ success: true, content });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// Start Server
// ============================================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🕊️ Peace Engine running on port ${PORT}`);
});
