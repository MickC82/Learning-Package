/* Second Pass shared runtime: navigation bar, progress storage, spaced-repetition scheduling. Requires data.js. */
(function(){
  const store = {
    get(k, d){ try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch(e){} }
  };
  const ROOT = document.documentElement.dataset.root || "";   // "" at top level, "../" inside pages/
  const href = p => ROOT + p;

  /* ---------- navigation bar ----------
     <html data-root="../" data-course="3" data-page="workbook"> gives context. */
  function navBar(){
    if (document.querySelector(".spbar")) return;
    const d = document.documentElement.dataset, c = d.course ? +d.course : null, pg = d.page || "";
    const links = [`<a class="home" href="${href("index.html")}">⌂ Home</a>`];
    if (c){
      const C = SP.courses.find(x => x.n === c) || SP.pilot;
      links.push('<span class="sep"></span>', `<a href="${href("course.html")}?n=${c}"${pg === "course" ? ' aria-current="page"' : ""}>${c === 23 ? "Module 2.3" : "Course " + c}</a>`);
      if (C.wb) links.push(`<a href="${href(C.wb)}"${pg === "workbook" ? ' aria-current="page"' : ""}>Workbook</a>`);
      if (C.ex) links.push(`<a href="${href(C.ex)}"${pg === "explorer" ? ' aria-current="page"' : ""}>${C.exn || "Explorer"}</a>`);
      links.push(`<a href="${href("quiz.html")}?c=${c}"${pg === "quiz" ? ' aria-current="page"' : ""}>Quiz</a>`, `<a href="${href("flashcards.html")}?c=${c}"${pg === "cards" ? ' aria-current="page"' : ""}>Flashcards</a>`);
    } else {
      links.push(`<a href="${href("flashcards.html")}"${pg === "cards" ? ' aria-current="page"' : ""}>Flashcards</a>`, `<a href="${href("quiz.html")}"${pg === "quiz" ? ' aria-current="page"' : ""}>Quizzes</a>`, `<a href="${href("pages/warm-up.html")}"${pg === "warmup" ? ' aria-current="page"' : ""}>Warm-up</a>`);
    }
    const bar = document.createElement("nav"); bar.className = "spbar"; bar.setAttribute("aria-label", "Second Pass");
    bar.innerHTML = `<div class="in">${links.join("")}</div>`;
    document.body.insertBefore(bar, document.body.firstChild);
    const cur = bar.querySelector('[aria-current="page"]'); if (cur) cur.scrollIntoView({ inline:"center", block:"nearest" });
  }

  /* ---------- progress ---------- */
  const ticks = () => store.get("sp-hub", {});
  function setTick(id, v){ const t = ticks(); t[id] = v; store.set("sp-hub", t); }
  const quizBest = () => store.get("sp-quiz", {});
  function recordQuiz(key, score, total){ const q = quizBest(), prev = q[key]; if (!prev || score/total > prev.s/prev.t) q[key] = { s:score, t:total, d:Date.now() }; store.set("sp-quiz", q); }

  /* ---------- spaced repetition (Leitner-style boxes) ---------- */
  const DAY = 864e5, INTERVALS = [0, 1, 3, 7, 16, 35, 90];
  const srs = () => store.get("sp-srs", {});
  function rate(id, r){            // r: 0 again, 1 hard, 2 good, 3 easy
    const s = srs(), st = s[id] || { b:0 }; let b = st.b;
    if (r === 0) b = 0; else if (r === 1) b = Math.max(1, b); else if (r === 2) b = Math.min(6, b + 1); else b = Math.min(6, b + 2);
    const wait = r === 0 ? 60e3 : INTERVALS[b]*DAY*(r === 1 ? 0.6 : 1);
    s[id] = { b, due:Date.now() + Math.max(60e3, wait), n:(st.n || 0) + 1 }; store.set("sp-srs", s); return s[id];
  }
  function cardsFor(filter){ return SP_CARDS.filter(c => !filter || (filter.m ? c.m === filter.m : filter.c ? c.c === filter.c : true)); }
  function dueInfo(cards){ const s = srs(), now = Date.now(); let due = 0, fresh = 0, learnt = 0;
    cards.forEach(c => { const st = s[c.id]; if (!st) fresh++; else { if (st.due <= now) due++; if (st.b >= 3) learnt++; } }); return { due, fresh, learnt, total:cards.length }; }
  function todayDeck(){ const t = ticks(), s = srs(), now = Date.now();
    const started = new Set(SP_CARDS.filter(c => s[c.id]).map(c => c.m));
    return SP_CARDS.filter(c => t[c.m] || started.has(c.m)).filter(c => !s[c.id] || s[c.id].due <= now); }

  window.SPX = { store, href, navBar, ticks, setTick, quizBest, recordQuiz, srs, rate, cardsFor, dueInfo, todayDeck };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", navBar); else navBar();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(href("sw.js")).catch(() => {});
})();
