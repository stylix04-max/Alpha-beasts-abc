// Alpha-Beasts natural voice.
// The app asks for /api/tts?t=Some+words (plus &v=C for a beast's own voice, &ts=1 for word timings).
// Every recording is saved permanently in Vercel Blob storage the first time it's made,
// so it keeps playing for ever, even after the ElevenLabs subscription ends.
const crypto = require("crypto");
let blob = null; try { blob = require("@vercel/blob"); } catch (e) { blob = null; }

module.exports = async (req, res) => {
  const q = req.query || {};
  const text = String(q.t || "").trim().replace(/\s+/g, " ");
  const beast = /^[A-Z]$/.test(String(q.v || "")) ? String(q.v) : "";
  const timed = String(q.ts || "") === "1";
  // only short, plain lines: stops anyone using your credits for anything else
  if (!text || text.length > 700 || /[<>{}\[\]\\]/.test(text)) return fail(res, 400, "That line is too long or has odd characters.");

  const key = process.env.ELEVENLABS_API_KEY;
  const voice = (beast && process.env["ELEVEN_VOICE_" + beast]) || process.env.ELEVEN_VOICE_ID;
  const model = process.env.ELEVEN_MODEL || "eleven_multilingual_v2";
  const store = !!(blob && process.env.BLOB_READ_WRITE_TOKEN);
  const name = "voices/" + crypto.createHash("sha1").update([voice, model, text].join("|")).digest("hex") + (timed ? ".json" : ".mp3");

  // 1. already recorded? play the saved copy (costs no credits)
  if (store) {
    try {
      const found = await blob.head(name);
      const r = await fetch(found.url);
      if (r.ok) return send(res, timed, Buffer.from(await r.arrayBuffer()));
    } catch (e) { /* not recorded yet */ }
  }
  if (!key || !voice) return fail(res, 503, "The ElevenLabs settings are missing in Vercel.");

  // 2. record it with ElevenLabs
  try {
    const url = `https://api.elevenlabs.io/v1/text-to-speech/${voice}${timed ? "/with-timestamps" : ""}?output_format=mp3_44100_64`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", "Accept": timed ? "application/json" : "audio/mpeg" },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.25, use_speaker_boost: true } })
    });
    if (!r.ok) {
      let detail = ""; try { const j = await r.json(); detail = (j.detail && (j.detail.message || j.detail.status)) || JSON.stringify(j.detail || j); } catch (e) { detail = await r.text().catch(() => ""); }
      console.error("ElevenLabs said", r.status, detail);
      return fail(res, 502, `ElevenLabs ${r.status}: ${String(detail).slice(0, 300)}`);
    }
    let body;
    if (timed) {
      const j = await r.json(), al = j.alignment || j.normalized_alignment || {};
      body = Buffer.from(JSON.stringify({ a: j.audio_base64, c: al.characters || [], s: al.character_start_times_seconds || [] }));
    } else body = Buffer.from(await r.arrayBuffer());
    // 3. save it for ever
    if (store) {
      try { await blob.put(name, body, { access: "public", contentType: timed ? "application/json" : "audio/mpeg", addRandomSuffix: false, allowOverwrite: true }); }
      catch (e) { console.error("Couldn't save to Blob:", e && e.message); }
    }
    return send(res, timed, body);
  } catch (e) {
    console.error("Voice error:", e && e.message);
    return fail(res, 500, "The voice server hit an error: " + (e && e.message));
  }
};

function send(res, timed, body) {
  res.setHeader("Content-Type", timed ? "application/json" : "audio/mpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.status(200).send(body);
}
function fail(res, status, detail) {
  res.setHeader("Cache-Control", "no-store");
  res.status(status).json({ status, detail });
}
