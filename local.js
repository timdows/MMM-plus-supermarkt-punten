const http = require("http");
const path = require("path");
const { scrapePoints } = require("./plus-scraper");

const settingsPath = path.resolve(__dirname, "settings.json");
let current = { status: "loading", message: "PLUS-punten worden opgehaald…" };
let refreshPromise = null;

function loadSettings() {
  delete require.cache[require.resolve(settingsPath)];
  return require(settingsPath);
}

async function refresh() {
  if (refreshPromise) return refreshPromise;

  current = { status: "loading", message: "PLUS-punten worden opgehaald…" };
  refreshPromise = scrapePoints(loadSettings())
    .then((result) => {
      current = { status: "success", ...result };
    })
    .catch((error) => {
      current = {
        status: "error",
        message: error.message,
        code: error.code,
        details: error.details || []
      };
    })
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

function html() {
  return `<!doctype html>
<html lang="nl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>PLUS-punten lokaal</title>
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; background:#111; color:#eee; font:20px Arial,sans-serif }
    main { width:min(600px,85vw); padding:32px; text-align:center; background:#222; border-radius:16px }
    h1 { margin-top:0; font-size:24px } #value { color:#80bd1d; font-size:64px; font-weight:700 }
    #message { font-size:16px; white-space:pre-wrap } button { padding:10px 18px; cursor:pointer }
  </style>
</head>
<body><main><h1>Mijn PLUS punten</h1><div id="value">…</div><p id="message">Laden…</p><button id="refresh">Vernieuwen</button></main>
<script>
  async function render() {
    const data = await fetch('/api/status').then(r => r.json());
    document.querySelector('#value').textContent = data.status === 'success' ? data.points : '—';
    document.querySelector('#message').textContent = data.status === 'success'
      ? data.fullCards + ' volle kaarten + ' + data.loosePoints + ' van ' + data.pointsPerCard + ' punten' +
        (data.redeemableValue ? '\\nInwisselbaar: €' + data.redeemableValue : '') +
        '\\nBijgewerkt: ' + new Date(data.fetchedAt).toLocaleString('nl-NL')
      : (data.message || 'Laden…') + (data.details?.length ? '\\n' + data.details.join('\\n') : '');
    if (data.status === 'loading') setTimeout(render, 1000);
  }
  document.querySelector('#refresh').onclick = async () => { await fetch('/api/refresh', {method:'POST'}); render(); };
  render();
</script></body></html>`;
}

const settings = loadSettings();
const port = settings.localPort || 8080;
const server = http.createServer(async (request, response) => {
  if (request.url === "/api/status") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    return response.end(JSON.stringify(current));
  }

  if (request.url === "/api/refresh" && request.method === "POST") {
    refresh();
    response.writeHead(202).end();
    return;
  }

  response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  response.end(html());
});

server.listen(port, () => {
  console.log(`Lokale PLUS-weergave: http://localhost:${port}`);
  refresh();
});
