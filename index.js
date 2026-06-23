const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Status Page
app.get('/', (req, res) => {
  res.send('<h1>✅ Peace Audio Worker is Running</h1><p>Use POST /api/generate-audio</p>');
});

// Get Voices from Supabase
app.get('/api/voices', async (req, res) => {
  try {
    const SUPABASE_URL = 'https://rnafjznurgnrdonyxfgs.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYWZqem51cmducmRvbnl4ZmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzA1OTEsImV4cCI6MjA5NzM0NjU5MX0.lfJYkGg37CdOwsrvcgvD7I4T054yrPQj-ztfsSo2S0s';

    const response = await fetch(`${SUPABASE_URL}/rest/v1/ethiopian_voices?select=*&is_published=eq.true&order=created_at.desc`, {
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`
      }
    });

    const data = await response.json();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: 'Failed to load voices' });
  }
});

// Generate Audio
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) return res.status(400).json({ error: 'Text is required' });

    const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.slice(0, 4000),
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.75, similarity_boost: 0.85 }
      })
    });

    if (!ttsResponse.ok) throw new Error('ElevenLabs failed');

    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', 'attachment; filename="peace-voice.mp3"');
    return res.send(audioBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Audio generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
