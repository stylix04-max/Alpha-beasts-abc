// See everyone on the launch list: /api/signups?pin=YOUR-PIN   (add &csv=1 to download a spreadsheet file)
let blob = null; try { blob = require("@vercel/blob"); } catch (e) { blob = null; }
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

module.exports = async (req, res) => {
  const pin = process.env.SIGNUP_PIN;
  if (!pin || String((req.query || {}).pin || "") !== pin) { res.statusCode = 403; return res.end("Wrong PIN."); }
  const rows = []; let cursor;
  do { const r = await blob.list({ prefix: "signups/", cursor, limit: 1000 }); cursor = r.cursor;
       for (const f of r.blobs) { try { rows.push(await (await fetch(f.url)).json()); } catch (e) {} } } while (cursor);
  rows.sort((a, b) => (a.when < b.when ? 1 : -1));
  res.setHeader("Cache-Control", "no-store");
  if ((req.query || {}).csv) {
    res.setHeader("Content-Type", "text/csv"); res.setHeader("Content-Disposition", 'attachment; filename="azoomals-launch-list.csv"');
    return res.end("date,name,email,interested in\n" + rows.map(r => [r.when.slice(0, 10), r.name, r.email, r.interested_in].map(v => '"' + String(v || "").replace(/"/g, '""') + '"').join(",")).join("\n"));
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Launch list</title>
<body style="font-family:system-ui;margin:16px"><h2>AZoomals launch list: ${rows.length}</h2>
<p><a href="?pin=${encodeURIComponent(pin)}&csv=1">Download as spreadsheet (CSV)</a></p>
<table style="border-collapse:collapse;font-size:14px">${rows.map(r => `<tr><td style="padding:6px;border-bottom:1px solid #ddd">${esc(r.when.slice(0, 10))}</td><td style="padding:6px;border-bottom:1px solid #ddd">${esc(r.name)}<br><b>${esc(r.email)}</b></td><td style="padding:6px;border-bottom:1px solid #ddd">${esc(r.interested_in)}</td></tr>`).join("")}</table></body>`);
};
