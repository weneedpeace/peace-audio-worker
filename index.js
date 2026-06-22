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

    // Call ElevenLabs
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

    // Upload to Cloudinary
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
// 3. POST /api/generate-text - OpenRouter (Premium Text Generation)
// ============================================================
app.post('/api/generate-text', async (req, res) => {
  try {
    const { type, topic, tone } = req.body;

    const prompt = `Write a premium, high-quality ${type} on the topic: "${topic}". 
    Tone: ${tone}. 
    Length: 800-1200 words. 
    Use headings, subheadings, and bullet points where appropriate. 
    The content must be peaceful, educational, and inspiring. 
    Write in a warm, professional, and deeply human voice.`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-70b-instruct:free',
        messages: [
          { role: 'system', content: 'You are a world-class peace writer, educator, and researcher.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      return res.status(500).json({ error: 'OpenRouter API error' });
    }

    const data = await response.json();
    const content = data.choices[0].message.content;

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
