const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Keep your original peace voices endpoint
app.get('/api/voices', async (req, res) => {
  try {
    const response = await fetch('https://peace-audio-worker.onrender.com/api/voices');
    if (!response.ok) throw new Error('Failed to fetch voices');
    const voices = await response.json();
    res.json(voices);
  } catch (error) {
    res.status(500).json({ error: 'Failed to load peace voices' });
  }
});

// Main TTS Endpoint
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, language = 'English' } = req.body;

    if (!text || text.length > 4000) {
      return res.status(400).json({ error: 'Text is required and must be under 4000 characters' });
    }

    // Good voice mapping (ElevenLabs multilingual works well)
    const voiceMap = {
      'Amharic': '21m00Tcm4TlvDq8ikWAM',   // Rachel (good multilingual base)
      'Oromo': '21m00Tcm4TlvDq8ikWAM',
      'Tigrinya': '21m00Tcm4TlvDq8ikWAM',
      'Somali': '21m00Tcm4TlvDq8ikWAM',
      'Swahili': '21m00Tcm4TlvDq8ikWAM',
      'English': '21m00Tcm4TlvDq8ikWAM',   // Rachel - very natural
      'French': '21m00Tcm4TlvDq8ikWAM',
      'German': '21m00Tcm4TlvDq8ikWAM',
      'Dutch': '21m00Tcm4TlvDq8ikWAM',
      'default': '21m00Tcm4TlvDq8ikWAM'
    };

    const voiceId = voiceMap[language] || voiceMap.default;

    const ttsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: {
          stability: 0.75,
          similarity_boost: 0.85,
          style: 0.0,
          use_speaker_boost: true
        }
      })
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error('ElevenLabs Error:', ttsResponse.status, errorText);
      return res.status(500).json({ error: `TTS failed: ${ttsResponse.status}` });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Disposition', `attachment; filename="peace-${Date.now()}.mp3"`);
    return res.send(Buffer.from(audioBuffer));

  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: 'Audio generation failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Peace Audio Worker running on port ${PORT}`);
});
