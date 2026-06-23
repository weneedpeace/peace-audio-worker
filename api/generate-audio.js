export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // Root / Status
    if (url.pathname === '/' || url.pathname === '') {
      return new Response('<h1>✅ Peace Audio Worker is Running</h1>', {
        headers: { 'Content-Type': 'text/html' }
      });
    }

    // Get Voices
    if (url.pathname === '/api/voices') {
      try {
        const SUPABASE_URL = 'https://rnafjznurgnrdonyxfgs.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJuYWZqem51cmducmRvbnl4ZmdzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3NzA1OTEsImV4cCI6MjA5NzM0NjU5MX0.lfJYkGg37CdOwsrvcgvD7I4T054yrPQj-ztfsSo2S0s';

        const res = await fetch(`${SUPABASE_URL}/rest/v1/ethiopian_voices?select=*&is_published=eq.true&order=created_at.desc`, {
          headers: {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`
          }
        });

        const data = await res.json();
        return new Response(JSON.stringify(data), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500, headers: corsHeaders 
        });
      }
    }

    // Generate Audio - Simplified
    if (url.pathname === '/api/generate-audio' && request.method === 'POST') {
      try {
        const { text } = await request.json();

        if (!text) {
          return new Response(JSON.stringify({ error: 'Text is required' }), { 
            status: 400, headers: corsHeaders 
          });
        }

        // ElevenLabs TTS
        const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'xi-api-key': env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text.slice(0, 4000),
            model_id: 'eleven_multilingual_v2',
            voice_settings: { stability: 0.75, similarity_boost: 0.85 }
          })
        });

        if (!ttsResponse.ok) {
          return new Response(JSON.stringify({ error: 'ElevenLabs failed' }), { 
            status: 500, headers: corsHeaders 
          });
        }

        const audioBuffer = await ttsResponse.arrayBuffer();

        // Return audio directly (simpler - no Cloudinary for now)
        return new Response(audioBuffer, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'audio/mpeg',
            'Content-Disposition': 'attachment; filename="peace-voice.mp3"'
          }
        });

      } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), { 
          status: 500, headers: corsHeaders 
        });
      }
    }

    return new Response('Not found', { status: 404, headers: corsHeaders });
  }
};
