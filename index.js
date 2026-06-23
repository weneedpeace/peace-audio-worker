const express = require('express');
const cors = require('cors');
const { v2: cloudinary } = require('cloudinary');

const app = express();
app.use(cors());
app.use(express.json());

// Status page
app.get('/', (req, res) => {
  res.send('<h1>✅ Peace Audio Worker is Running</h1><p>POST to /api/generate-audio</p>');
});

// Voices (from your original source)
app.get('/api/voices', async (req, res) => {
  try {
    // Use your Supabase directly to avoid loops
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
    res.status(500).json({ error: 'Failed to fetch voices' });
  }
});

// Generate Audio Endpoint
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, language = 'English' } = req.body;
    if (!text || text.length < 5) {
      return res.status(400).json({ error: 'Valid text is required' });
    }

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
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.75, similarity_boost: 0.85 }
      })
    });

    if (!ttsRes.ok) throw new Error('ElevenLabs failed');

    const audioBuffer = Buffer.from(await ttsRes.arrayBuffer());

    // Upload to Cloudinary
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
    res.status(500).json({ error: error.message || 'Audio generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Peace Audio Worker running on port ${PORT}`));
