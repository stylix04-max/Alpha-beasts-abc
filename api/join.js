// Website launch-list sign-ups (replaces Netlify Forms). Each sign-up is saved as a small file in Vercel Blob.
let blob = null; try { blob = require("@vercel/blob"); } catch (e) { blob = null; }

module.exports = async (req, res) => {
  if (req.method !== "POST") { res.statusCode = 405; return res.end("POST only"); }
  const b = typeof req.body === "object" && req.body ? req.body : Object.fromEntries(new URLSearchParams(String(req.body || "")));
  const email = String(b.email || "").trim().slice(0, 200);
  const wantsHtml = !(req.headers["content-type"] || "").includes("x-www-form-urlencoded") || (req.headers.accept || "").includes("text/html");
  if (b["bot-field"]) return done(res, wantsHtml);                       // spam bot: pretend it worked
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { res.statusCode = 400; return res.end("Please enter a valid email address."); }
  if (!blob || !process.env.BLOB_READ_WRITE_TOKEN) { res.statusCode = 503; return res.end("Storage not set up."); }
  const entry = { when: new Date().toISOString(), name: String(b.name || "").trim().slice(0, 100), email, interested_in: String(b.interested_in || "").slice(0, 200) };
  await blob.put("signups/" + entry.when.replace(/[:.]/g, "-") + ".json", JSON.stringify(entry), { access: "public", contentType: "application/json", addRandomSuffix: true });
  try { await welcome(entry); } catch (e) { /* the sign-up is saved even if the email fails */ }
  return done(res, wantsHtml);
};
function done(res, html){
  if (html){ res.statusCode = 303; res.setHeader("Location", "/?joined=1#join"); return res.end(); }
  res.setHeader("Content-Type", "application/json"); res.end('{"ok":true}');
}

// Welcome email from Queen Quilla, sent through Resend (resend.com) once RESEND_API_KEY and RESEND_FROM are set in Vercel.
async function welcome(entry){
  const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM;
  if (!key || !from) return;
  const hi = entry.name ? entry.name.replace(/[<>&"]/g, "") : "friend";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#fbf6ec;border-radius:16px;color:#222">
  <h1 style="margin:0 0 4px;font-size:28px">A<span style="color:#e2553f">Z</span>oomals</h1>
  <p style="margin:0 0 20px;color:#8a7f6a;letter-spacing:2px;font-size:12px">EVERY LETTER AN ADVENTURE</p>
  <p style="font-size:17px">Welcome, welcome, ${hi}!</p>
  <p style="font-size:16px;line-height:1.5">I am Queen Quilla, ruler of New Rainbow Land, and your name is now on my royal launch list. Security Shark has stamped your Pazooport himself.</p>
  <p style="font-size:16px;line-height:1.5">You'll be the very first to hear when the AZoomals books, trading cards and shop open their gates. Until then, the AZoomals are waiting to play:</p>
  <p style="text-align:center;margin:26px 0"><a href="https://abc.azoomals.co.uk" style="background:#2db59b;color:#fff;text-decoration:none;font-weight:bold;padding:14px 26px;border-radius:999px;display:inline-block">Play the free AZoomals ABC app</a></p>
  <p style="font-size:16px;line-height:1.5">Let the AZoomal Games begin!<br><b>Queen Quilla</b> 👑</p>
  <p style="font-size:12px;color:#8a7f6a;margin-top:28px">You're getting this because you joined the launch list at azoomals.co.uk. Don't want these emails? Just reply and say so.</p></div>`;
  const text = `Welcome, welcome, ${hi}!

I am Queen Quilla, ruler of New Rainbow Land, and your name is now on my royal launch list. Security Shark has stamped your Pazooport himself.

You'll be the very first to hear when the AZoomals books, trading cards and shop open their gates. Until then, play the free AZoomals ABC app: https://abc.azoomals.co.uk

Let the AZoomal Games begin!
Queen Quilla

You're getting this because you joined the launch list at azoomals.co.uk. Don't want these emails? Just reply and say so.`;
  const msg = { from, to: [entry.email], subject: "👑 You're on the AZoomals launch list!", html, text };
  if (process.env.RESEND_REPLY_TO){
    msg.reply_to = process.env.RESEND_REPLY_TO;
    msg.headers = { "List-Unsubscribe": "<mailto:" + process.env.RESEND_REPLY_TO + "?subject=Unsubscribe%20me%20from%20AZoomals>" };
  }
  const r = await fetch("https://api.resend.com/emails", { method: "POST",
    headers: { Authorization: "Bearer " + key, "Content-Type": "application/json", "Idempotency-Key": "welcome-" + entry.email.toLowerCase() },
    body: JSON.stringify(msg) });
  if (!r.ok) console.error("Welcome email failed:", r.status, await r.text());
}
