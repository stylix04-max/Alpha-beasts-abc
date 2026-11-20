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
  return done(res, wantsHtml);
};
function done(res, html){
  if (html){ res.statusCode = 303; res.setHeader("Location", "/?joined=1#join"); return res.end(); }
  res.setHeader("Content-Type", "application/json"); res.end('{"ok":true}');
}
