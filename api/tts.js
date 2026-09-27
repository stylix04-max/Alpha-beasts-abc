// Alpha-Beasts natural voice.
// The app asks for /api/tts?t=Some+words. The first time a line is asked for,
// this fetches it from ElevenLabs; Vercel then caches the recording, so every
// later play of the same line is free and instant.
module.exports = async (req, res) => {
  const text = String((req.query && req.query.t) || "").trim().replace(/\s+/g, " ");
  // only short, plain lines: stops anyone using your credits for anything else
  if (!text || text.length > 700 || /[<>{}\[\]\\]/.test(text)) { res.status(400).end(); return; }
  const key = process.env.ELEVENLABS_API_KEY, voice = process.env.ELEVEN_VOICE_ID;
  if (!key || !voice) { res.status(503).end(); return; }
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": "audio/mpeg" },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVEN_MODEL || "eleven_multilingual_v2",
        voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true }
      })
    });
    if (!r.ok) { res.status(502).end(); return; }
    const audio = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
    res.status(200).send(audio);
  } catch (e) {
    res.status(500).end();
  }
};
