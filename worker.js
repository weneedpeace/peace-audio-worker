export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/generate-audio' && request.method === 'POST') {
      try {
        const { voiceId, text } = await request.json();

        const ttsResponse = await fetch('https://api.elevenlabs.io/v1/text-to-speech/21m00Tcm4TlvDq8ikWAM', {
          method: 'POST',
          headers: {
            'xi-api-key': env.ELEVENLABS_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            text: text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: { stability: 0.5, similarity_boost: 0.5 }
          })
        });

        if (!ttsResponse.ok) {
          return new Response(JSON.stringify({ error: 'ElevenLabs error' }), { status: 500 });
        }

        const audioBuffer = await ttsResponse.arrayBuffer();

        const formData = new FormData();
        formData.append('file', new Blob([audioBuffer], { type: 'audio/mp3' }));
        formData.append('public_id', `peace-voices/${voiceId}`);

        const cloudinaryResponse = await fetch(
          `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/video/upload`,
          {
            method: 'POST',
            body: formData,
            headers: {
              'Authorization': `Basic ${btoa(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`)}`
            }
          }
        );

        if (!cloudinaryResponse.ok) {
          return new Response(JSON.stringify({ error: 'Cloudinary upload failed' }), { status: 500 });
        }

        const cloudinaryData = await cloudinaryResponse.json();
        const audioUrl = cloudinaryData.secure_url;

        return new Response(JSON.stringify({ success: true, audioUrl }));

      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};
