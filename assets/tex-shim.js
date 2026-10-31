/* Lets pages written for MathJax render with the bundled KaTeX instead (works offline). */
window.MathJax = {
  startup: { promise: Promise.resolve() },
  tex2svg(src, opts) {
    const el = document.createElement(opts && opts.display ? "div" : "span");
    try { katex.render(src, el, { displayMode: !!(opts && opts.display), throwOnError: false, strict: "ignore" }); }
    catch (e) { el.textContent = src; }
    return el;
  }
};
