const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());
app.use(express.json());

// ============================================
// 1. STATUS PAGE
// ============================================
app.get('/', (req, res) => {
  res.send('<h1>✅ Peace Audio Worker is Running</h1><p>Use POST /api/generate-audio</p><p>Use POST /api/generate-text</p>');
});

// ============================================
// 2. GET VOICES FROM SUPABASE
// ============================================
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

// ============================================
// 3. GENERATE AUDIO (ElevenLabs)
// ============================================
app.post('/api/generate-audio', async (req, res) => {
  try {
    const { text, language = 'English' } = req.body;

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

// ============================================
// 4. NEW: GENERATE TEXT (Hugging Face via Vercel)
// ============================================
app.post('/api/generate-text', async (req, res) => {
  try {
    const { type, topic, tone } = req.body;
    if (!topic) return res.status(400).json({ error: 'Topic is required' });

    // Build the prompt based on type and tone
    const prompts = {
      article: `Write a premium, ${tone} article about "${topic}". Include a compelling title, introduction, 3-5 main sections with headings, and a powerful conclusion. Use markdown ## for headings.`,
      lesson: `Create a structured ${tone} lesson about "${topic}". Include learning objectives, key concepts, examples, and a summary. Use markdown ## for sections.`,
      essay: `Write a thoughtful ${tone} essay about "${topic}". Include an introduction, 3-4 body paragraphs, and a conclusion. Use markdown ## for headings.`,
      analysis: `Provide a deep ${tone} analysis of "${topic}". Include key insights, data points, implications, and future outlook. Use markdown ## for headings.`,
      report: `Generate a professional ${tone} report on "${topic}". Include an executive summary, findings, recommendations, and conclusion. Use markdown ## for headings.`,
      speech: `Write a powerful ${tone} speech about "${topic}". Include a strong opening, 3-5 key points, and an inspiring closing. Use markdown ## for sections.`,
      proposal: `Draft a ${tone} proposal for "${topic}". Include an introduction, problem statement, solution, timeline, and budget overview. Use markdown ## for headings.`,
      social: `Write a ${tone} social media post about "${topic}" for LinkedIn and Twitter. Include hashtags.`
    };
    const prompt = prompts[type] || prompts.article;

    // Call Hugging Face via Mistral-7B
    const hfResponse = await fetch('https://api-inference.huggingface.co/models/mistralai/Mistral-7B-Instruct-v0.1', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          temperature: 0.7,
          top_p: 0.9,
          do_sample: true,
          return_full_text: false
        }
      })
    });

    if (!hfResponse.ok) throw new Error('Hugging Face request failed');

    const result = await hfResponse.json();
    const text = Array.isArray(result) ? result[0]?.generated_text || '' : result.generated_text || '';

    res.json({ content: text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || 'Text generation failed' });
  }
});

// ============================================
// 5. START SERVER
// ============================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Peace Audio Worker running on port ${PORT}`));
