const express = require('express');
const cors = require('cors');
require('dotenv').config(); // Added: Load environment variables from .env file
const app = express();

app.use(cors());
app.use(express.json());

// ============================================================
// 1. GET /api/voices - Fetch ElevenLabs voices
// ============================================================
app.get('/api/voices', async (req, res) => {
  try {
    // Added: Check if API key exists
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }

    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY }
    });
    
    // Added: Check response status
    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return res.status(response.status).json({ 
        error: 'Failed to fetch voices',
        details: errorData
      });
    }
    
    const data = await response.json();
    res.json(data.voices || []);
  } catch (error) {
    console.error('Voices fetch error:', error);
    res.status(500).json({ error: 'Failed to fetch voices', details: error.message });
  }
});

// ============================================================
// 2. POST /api/generate-audio - ElevenLabs TTS + Cloudinary
// ============================================================
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { voiceId, text } = req.body;

    // Added: Input validation
    if (!voiceId || !text) {
      return res.status(400).json({ error: 'voiceId and text are required' });
    }

    // Added: Check if API keys exist
    if (!process.env.ELEVENLABS_API_KEY) {
      return res.status(500).json({ error: 'ElevenLabs API key not configured' });
    }
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ error: 'Cloudinary configuration missing' });
    }

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
      const errorData = await ttsResponse.json().catch(() => null);
      return res.status(ttsResponse.status).json({ 
        error: 'ElevenLabs API error',
        details: errorData
      });
    }

    const audioBuffer = await ttsResponse.arrayBuffer();

    // Fixed: Use Buffer instead of Blob (Node.js environment)
    const audioBlob = Buffer.from(audioBuffer);
    
    // Fixed: Using form-data package for Node.js
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('file', audioBlob, {
      filename: 'audio.mp3',
      contentType: 'audio/mpeg'
    });
    formData.append('upload_preset', 'peace-voices'); // Fixed: Changed from public_id to upload_preset
    formData.append('public_id', `peace-voices/${Date.now()}`);

    const cloudinaryResponse = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/video/upload`,
      {
        method: 'POST',
        body: formData,
        headers: {
          ...formData.getHeaders(),
          Authorization: `Basic ${Buffer.from(
            process.env.CLOUDINARY_API_KEY + ':' + process.env.CLOUDINARY_API_SECRET
          ).toString('base64')}`
        }
      }
    );

    if (!cloudinaryResponse.ok) {
      const errorData = await cloudinaryResponse.json().catch(() => null);
      return res.status(cloudinaryResponse.status).json({ 
        error: 'Cloudinary upload failed',
        details: errorData
      });
    }

    const cloudinaryData = await cloudinaryResponse.json();

    res.json({ success: true, audioUrl: cloudinaryData.secure_url });

  } catch (error) {
    console.error('Audio generation error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================
// 3. POST /api/generate-text - Hugging Face (Text Generation)
// ============================================================
app.post('/api/generate-text', async (req, res) => {
  try {
    const { type, topic, tone } = req.body;

    // Added: Input validation
    if (!type || !topic) {
      return res.status(400).json({ error: 'type and topic are required' });
    }

    // Added: Check if API key exists
    if (!process.env.HUGGINGFACE_API_KEY) {
      return res.status(500).json({ error: 'Hugging Face API key not configured' });
    }

    const prompt = `Write a premium, high-quality ${type} on the topic: "${topic}". 
    Tone: ${tone || 'neutral'}. 
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
          parameters: { 
            max_length: 1000, 
            temperature: 0.7,
            return_full_text: false // Added: Don't return the prompt in the output
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return res.status(response.status).json({ 
        error: 'Hugging Face API error',
        details: errorData
      });
    }

    const data = await response.json();
    const content = Array.isArray(data) ? data[0].generated_text : data.generated_text;

    res.json({ success: true, content });

  } catch (error) {
    console.error('Text generation error:', error);
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
