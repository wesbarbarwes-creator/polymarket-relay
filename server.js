const express = require("express");
const https = require("https");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.raw({ type: "*/*", limit: "10mb" }));

const ALLOWED_HEADERS = [
  "content-type", "authorization", "poly_address", "poly_signature",
  "poly_timestamp", "poly_nonce", "poly_api_key", "poly_passphrase", "accept",
];

app.get("/debug", async (req, res) => {
  try {
    const ipData = await fetchJSON("https://api.ipify.org?format=json");
    res.json({ serverIP: ipData.ip, platform: "render" });
  } catch (e) { res.json({ error: e.message }); }
});

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.options("*", (req, res) => {
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("access-control-allow-methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("access-control-allow-headers", ALLOWED_HEADERS.join(", "));
  res.sendStatus(204);
});

app.all("*", (req, res) => {
  const targetUrl = "https://clob.polymarket.com" + req.originalUrl;
  const cleanHeaders = {
    host: "clob.polymarket.com",
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  };
  for (const key of ALLOWED_HEADERS) {
    if (req.headers[key]) cleanHeaders[key] = req.headers[key];
  }
  const parsed = new URL(targetUrl);
  const options = {
    hostname: parsed.hostname, port: 443,
    path: parsed.pathname + parsed.search,
    method: req.method, headers: cleanHeaders,
  };
  const proxyReq = https.request(options, (proxyRes) => {
    res.setHeader("access-control-allow-origin", "*");
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  proxyReq.on("error", (e) => res.status(502).json({ error: e.message }));
  if (req.body && req.body.length > 0) proxyReq.write(req.body);
  proxyReq.end();
});

app.listen(PORT, () => console.log("Relay on port " + PORT));

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let d = ""; res.on("data", (c) => d += c);
      res.on("end", () => { try { resolve(JSON.parse(d)); } catch(e) { reject(e); } });
    }).on("error", reject);
  });
}
