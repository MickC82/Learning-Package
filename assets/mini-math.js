/* Second Pass mini-math: a small, safe expression parser that stands in for the parts of math.js
   the workbooks use (parse, compile/evaluate, symbol listing, toTex). Supports + − × ÷ ^, implicit
   multiplication (2x, 4pi r, 2(x+1), (a)(b)), unary minus, and sqrt cbrt ln log log10 exp sin cos tan abs. */
(function(){
  const FN = { sqrt:Math.sqrt, cbrt:Math.cbrt, ln:Math.log, log:Math.log, log10:Math.log10, exp:Math.exp, sin:Math.sin, cos:Math.cos, tan:Math.tan, abs:Math.abs, nthRoot:(x, n) => Math.pow(x, 1/n) };
  const CONST = { pi:Math.PI, e:Math.E };
  function tokenize(s){
    const t = []; let i = 0;
    while (i < s.length){
      const c = s[i];
      if (/\s/.test(c)){ i++; continue; }
      if (/[0-9.]/.test(c)){ let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++;
        if (s[j] === "e" && /[0-9+\-]/.test(s[j + 1] || "") && !/[a-z]/i.test(s[j + 2] || "") || (s[j] === "e" && /[0-9]/.test(s[j + 1] || ""))){ j++; if (/[+\-]/.test(s[j])) j++; while (j < s.length && /[0-9]/.test(s[j])) j++; }
        t.push({ k:"num", v:parseFloat(s.slice(i, j)) }); i = j; continue; }
      if (/[A-Za-z_]/.test(c)){ let j = i; while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++; t.push({ k:"id", v:s.slice(i, j) }); i = j; continue; }
      if ("+-*/^(),".includes(c)){ t.push({ k:c }); i++; continue; }
      throw new Error("Unexpected character " + c);
    }
    // implicit multiplication
    const out = [];
    for (let k = 0; k < t.length; k++){
      const a = out[out.length - 1], b = t[k];
      const aEnds = a && (a.k === "num" || a.k === "id" || a.k === ")"), bStarts = b.k === "num" || b.k === "id" || b.k === "(";
      if (aEnds && bStarts && !(a.k === "id" && b.k === "(" && FN[a.v])) out.push({ k:"*" });
      out.push(b);
    }
    return out;
  }
  function parse(src){
    const t = tokenize(src); let p = 0;
    const peek = () => t[p], eat = k => { if (!t[p] || t[p].k !== k) throw new Error("Expected " + k); return t[p++]; };
    function expr(){ let n = term(); while (peek() && (peek().k === "+" || peek().k === "-")){ const op = t[p++].k; n = { type:"op", op, a:n, b:term() }; } return n; }
    function term(){ let n = unary(); while (peek() && (peek().k === "*" || peek().k === "/")){ const op = t[p++].k; n = { type:"op", op, a:n, b:unary() }; } return n; }
    function unary(){ if (peek() && peek().k === "-"){ p++; return { type:"neg", a:unary() }; } if (peek() && peek().k === "+"){ p++; return unary(); } return power(); }
    function power(){ const base = atom(); if (peek() && peek().k === "^"){ p++; return { type:"op", op:"^", a:base, b:unary() }; } return base; }
    function atom(){
      const x = peek(); if (!x) throw new Error("Unexpected end");
      if (x.k === "num"){ p++; return { type:"num", v:x.v }; }
      if (x.k === "id"){ p++;
        if (peek() && peek().k === "(" && FN[x.v]){ p++; const args = [expr()]; while (peek() && peek().k === ","){ p++; args.push(expr()); } eat(")"); return { type:"fn", name:x.v, args }; }
        return { type:"sym", name:x.v }; }
      if (x.k === "("){ p++; const n = expr(); eat(")"); return { type:"paren", a:n }; }
      throw new Error("Unexpected " + x.k);
    }
    const root = expr(); if (p < t.length) throw new Error("Unexpected " + t[p].k); return root;
  }
  function ev(n, s){
    switch (n.type){
      case "num": return n.v;
      case "sym": if (s && Object.prototype.hasOwnProperty.call(s, n.name)) return s[n.name]; if (n.name in CONST) return CONST[n.name]; throw new Error("Undefined symbol " + n.name);
      case "paren": return ev(n.a, s);
      case "neg": return -ev(n.a, s);
      case "fn": { if (n.name === "log" && n.args.length === 2) return Math.log(ev(n.args[0], s))/Math.log(ev(n.args[1], s)); return FN[n.name](...n.args.map(a => ev(a, s))); }
      case "op": { const a = ev(n.a, s), b = ev(n.b, s); return n.op === "+" ? a + b : n.op === "-" ? a - b : n.op === "*" ? a*b : n.op === "/" ? a/b : Math.pow(a, b); }
    }
  }
  function tex(n){
    switch (n.type){
      case "num": return String(n.v);
      case "sym": return n.name === "pi" ? "\\pi" : n.name.replace(/^([A-Za-z]+)(\d+)$/, "$1_{$2}");
      case "paren": return "\\left(" + tex(n.a) + "\\right)";
      case "neg": return "-" + tex(n.a);
      case "fn": return n.name === "sqrt" ? "\\sqrt{" + tex(n.args[0]) + "}" : n.name === "cbrt" ? "\\sqrt[3]{" + tex(n.args[0]) + "}" : "\\" + (["ln", "log", "exp", "sin", "cos", "tan"].includes(n.name) ? n.name : "operatorname{" + n.name + "}") + "\\left(" + n.args.map(tex).join(",") + "\\right)";
      case "op": { const strip = x => x.type === "paren" ? x.a : x;
        if (n.op === "/") return "\\frac{" + tex(strip(n.a)) + "}{" + tex(strip(n.b)) + "}";
        if (n.op === "^") return "{" + tex(n.a) + "}^{" + tex(strip(n.b)) + "}";
        if (n.op === "*") return tex(n.a) + "\\," + tex(n.b);
        return tex(n.a) + n.op + tex(n.b); }
    }
  }
  function walk(n, f){ f(n); ["a", "b"].forEach(k => n[k] && walk(n[k], f)); (n.args || []).forEach(a => walk(a, f)); }
  function wrap(root){
    return {
      filter(pred){ const out = []; walk(root, x => { const node = x.type === "sym" ? { isSymbolNode:true, name:x.name } : x.type === "fn" ? { isSymbolNode:true, name:x.name } : {}; if (pred(node)) out.push(node); }); return out; },
      compile(){ return { evaluate:s => ev(root, s) }; },
      evaluate(s){ return ev(root, s); },
      toTex(){ return tex(root); }
    };
  }
  window.math = {
    parse:s => wrap(parse(s)),
    compile:s => { const r = parse(s); return { evaluate:sc => ev(r, sc) }; },
    evaluate:(s, sc) => ev(parse(s), sc),
    import(){}, log:Math.log
  };
})();
