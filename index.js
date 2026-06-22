// ============================================
// ETHIOPIAN PEACE ARCHIVE - AI BACKEND
// ============================================

const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');
const FormData = require('form-data');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ============================================
// CONFIGURATION
// ============================================

const SUPABASE_URL = 'https://rnafjznurgnrdonyxfgs.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYWZqem51cmducmRvbnl4ZmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzA1OTEsImV4cCI6MjA5NzM0NjU5MX0.lfJYkGg37CdOwsrvcgvD7I4T054yrPQj-ztfsSo2S0s';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Environment variables (set in Vercel)
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const HUGGINGFACE_API_KEY = process.env.HUGGINGFACE_API_KEY;

// ============================================
// ENDPOINT 1: GET ALL VOICES
// ============================================

app.get('/api/voices', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ethiopian_voices')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT 2: GENERATE TEXT (Hugging Face)
// ============================================

app.post('/api/generate-text', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

        const response = await fetch(
            'https://api-inference.huggingface.co/models/google/flan-t5-base',
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${HUGGINGFACE_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: prompt,
                    parameters: {
                        max_length: 200,
                        temperature: 0.7,
                        top_p: 0.9
                    }
                })
            }
        );

        const result = await response.json();
        
        // Handle Hugging Face response format
        const generatedText = Array.isArray(result) 
            ? result[0]?.generated_text || result[0]?.summary_text || ''
            : result.generated_text || result.summary_text || '';

        res.json({ text: generatedText });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT 3: GENERATE AUDIO (ElevenLabs + Cloudinary)
// ============================================

app.post('/api/generate-audio', async (req, res) => {
    try {
        const { text, voice_id = '21m00Tcm4TlvDq8ikWAM' } = req.body;
        if (!text) return res.status(400).json({ error: 'Text is required' });

        // 1. Generate audio with ElevenLabs
        const audioResponse = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voice_id}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': ELEVENLABS_API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    model_id: 'eleven_monolingual_v1',
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                })
            }
        );

        if (!audioResponse.ok) {
            const error = await audioResponse.text();
            throw new Error(`ElevenLabs error: ${error}`);
        }

        const audioBuffer = await audioResponse.buffer();

        // 2. Upload to Cloudinary
        const cloudinaryUrl = `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/upload`;
        
        const formData = new FormData();
        formData.append('file', audioBuffer, 'audio.mp3');
        formData.append('upload_preset', 'peace_archive');
        formData.append('api_key', CLOUDINARY_API_KEY);
        formData.append('timestamp', Date.now());
        formData.append('folder', 'peace_audio');

        const cloudinaryResponse = await fetch(cloudinaryUrl, {
            method: 'POST',
            body: formData
        });

        if (!cloudinaryResponse.ok) {
            const error = await cloudinaryResponse.text();
            throw new Error(`Cloudinary error: ${error}`);
        }

        const cloudinaryData = await cloudinaryResponse.json();

        // 3. Return the audio URL
        res.json({
            success: true,
            audio_url: cloudinaryData.secure_url,
            duration: cloudinaryData.duration || 0,
            format: 'mp3'
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// ENDPOINT 4: SAVE VOICE TO SUPABASE
// ============================================

app.post('/api/save-voice', async (req, res) => {
    try {
        const {
            document_id,
            region,
            year,
            language,
            quote_original,
            quote_english,
            themes,
            sentiment,
            audio_url,
            is_published = true
        } = req.body;

        const { data, error } = await supabase
            .from('ethiopian_voices')
            .insert([{
                document_id,
                region,
                year,
                language,
                quote_original,
                quote_english,
                themes,
                sentiment,
                audio_url,
                is_published
            }]);

        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Peace Archive AI Engine running on port ${PORT}`);
});
