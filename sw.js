// Second Pass service worker: precache everything for offline use; cache libraries and fonts on first online use.
const VERSION = "757b32838d";
const CORE = "sp-core-" + VERSION, RUNTIME = "sp-runtime";
const FILES = ["./", "docs/C1-Mathematics-Theory-Reader.pdf", "docs/C1-Mathematics-Visual-Companion.pdf", "docs/C1-Mathematics-Workbook.pdf", "docs/C2-Algebra-Theory-Reader.pdf", "docs/C2-Algebra-Visual-Companion.pdf", "docs/C2-Algebra-Workbook.pdf", "docs/C3-Physics-Theory-Reader.pdf", "docs/C3-Physics-Visual-Companion.pdf", "docs/C3-Physics-Workbook.pdf", "docs/C4-Chemistry-Theory-Reader.pdf", "docs/C4-Chemistry-Visual-Companion.pdf", "docs/C4-Chemistry-Workbook.pdf", "docs/C5-Astronomy-Theory-Reader.pdf", "docs/C5-Astronomy-Visual-Companion.pdf", "docs/C5-Astronomy-Workbook.pdf", "docs/C6-Biology-Theory-Reader.pdf", "docs/C6-Biology-Visual-Companion.pdf", "docs/C6-Biology-Workbook.pdf", "docs/M2.3-Theory-Reader.pdf", "docs/M2.3-Visual-Companion.pdf", "docs/M2.3-Workbook.pdf", "icons/apple-touch-icon.png", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "index.html", "manifest.webmanifest", "pages/c1-explorer.html", "pages/c1-workbook.html", "pages/c2-explorer.html", "pages/c2-workbook.html", "pages/c3-explorer.html", "pages/c3-workbook.html", "pages/c4-explorer.html", "pages/c4-workbook.html", "pages/c5-explorer.html", "pages/c5-workbook.html", "pages/c6-explorer.html", "pages/c6-workbook.html", "pages/m23-workbook.html", "pages/untangler.html", "pages/warm-up.html", "video/C1-Mathematics-Animated-Explainer.mp4", "video/C2-Algebra-Animated-Explainer.mp4", "video/C3-Physics-Animated-Explainer.mp4", "video/C4-Chemistry-Animated-Explainer.mp4", "video/C5-Astronomy-Animated-Explainer.mp4", "video/C6-Biology-Animated-Explainer.mp4", "video/M2.3-Animated-Explainer.mp4"];

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CORE);
    let done = 0;
    for (const f of FILES) {
      try { await c.add(new Request(f, { cache: "reload" })); } catch (err) { /* skip a missing file rather than fail the install */ }
      done++;
      if (done % 5 === 0 || done === FILES.length) {
        const cl = await self.clients.matchAll({ includeUncontrolled: true });
        cl.forEach(x => x.postMessage({ type: "progress", done, total: FILES.length }));
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith("sp-core-") && k !== CORE) await caches.delete(k);
    await self.clients.claim();
  })());
});

// Serve byte ranges from cache so videos play offline (Safari always asks for ranges).
async function rangeResponse(req, res) {
  const buf = await res.arrayBuffer(), size = buf.byteLength;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get("range") || "");
  let start = m && m[1] ? +m[1] : 0, end = m && m[2] ? +m[2] : size - 1;
  if (m && !m[1] && m[2]) { start = size - +m[2]; end = size - 1; }
  end = Math.min(end, size - 1);
  return new Response(buf.slice(start, end + 1), { status: 206, statusText: "Partial Content",
    headers: { "Content-Type": res.headers.get("Content-Type") || "video/mp4", "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes" } });
}

self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET") return;
  if (url.origin === location.origin) {
    e.respondWith((async () => {
      const path = url.pathname.endsWith("/") ? url.pathname + "index.html" : url.pathname;
      const cached = await caches.match(path, { ignoreSearch: true }) || await caches.match(req, { ignoreSearch: true });
      if (cached) return req.headers.get("range") ? rangeResponse(req, cached.clone()) : cached;
      try { return await fetch(req); } catch (err) { return caches.match("index.html"); }
    })());
    return;
  }
  // Libraries (MathJax, math.js) and Google Fonts: keep a copy after the first online visit.
  if (/cdnjs\.cloudflare\.com|fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.host)) {
    e.respondWith((async () => {
      const c = await caches.open(RUNTIME), hit = await c.match(req);
      const net = fetch(req).then(r => { if (r.ok || r.type === "opaque") c.put(req, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    })());
  }
});
