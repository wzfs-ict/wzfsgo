/* =========================================================
   WZFS ICT · SheetLab — a tiny spreadsheet for formula practice
   Supports: cell refs (A1, $A$1, $A1, A$1), ranges, Sheet!refs,
   named ranges, + - * / ^ & % and comparisons, and the 0417
   functions (SUM AVERAGE MAX MIN INT ROUND COUNT… IF LOOKUP
   VLOOKUP HLOOKUP XLOOKUP) plus COUNTIF/SUMIF/AVERAGEIF(S),
   AND/OR/NOT. Formulas are copied down like the fill handle.
   ========================================================= */
(function () {
  "use strict";

  /* ---------- helpers ---------- */
  function colNum(c) { c = c.toUpperCase(); var n = 0; for (var i = 0; i < c.length; i++) n = n * 26 + (c.charCodeAt(i) - 64); return n; }
  function colName(n) { var s = ""; while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
  function E(code) { return { err: code }; }
  function isErr(v) { return v && typeof v === "object" && v.err; }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

  /* ---------- tokenizer ---------- */
  var RE_REF = /^(?:([A-Za-z_][A-Za-z0-9_]*|'[^']+')!)?(\$?)([A-Za-z]{1,2})(\$?)(\d+)(?![A-Za-z0-9_(])/;
  var RE_NUM = /^(\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/;
  var RE_ID = /^[A-Za-z_][A-Za-z0-9_.]*/;
  function tokenize(src) {
    var out = [], i = 0, m;
    while (i < src.length) {
      var ch = src[i], rest = src.slice(i);
      if (/\s/.test(ch)) { i++; continue; }
      if (ch === '"') {
        var j = i + 1, s = "";
        while (j < src.length) { if (src[j] === '"') { if (src[j + 1] === '"') { s += '"'; j += 2; continue; } break; } s += src[j++]; }
        if (j >= src.length) throw new Error("A text value is missing its closing speech mark \"");
        out.push({ t: "str", v: s, p: i, e: j + 1 }); i = j + 1; continue;
      }
      if ((m = RE_REF.exec(rest))) {
        var sh = m[1] ? m[1].replace(/^'|'$/g, "") : null;
        out.push({ t: "ref", sheet: sh, ac: !!m[2], col: colNum(m[3]), ar: !!m[4], row: parseInt(m[5], 10), p: i, e: i + m[0].length, sheetRaw: m[1] || null });
        i += m[0].length; continue;
      }
      if ((m = RE_NUM.exec(rest))) { out.push({ t: "num", v: parseFloat(m[0]), p: i, e: i + m[0].length }); i += m[0].length; continue; }
      if ((m = RE_ID.exec(rest))) {
        var after = src.slice(i + m[0].length).replace(/^\s+/, "");
        var up = m[0].toUpperCase();
        if (after[0] === "(") out.push({ t: "fn", v: up, p: i, e: i + m[0].length });
        else if (up === "TRUE" || up === "FALSE") out.push({ t: "bool", v: up === "TRUE", p: i, e: i + m[0].length });
        else out.push({ t: "name", v: up, p: i, e: i + m[0].length });
        i += m[0].length; continue;
      }
      var two = src.substr(i, 2);
      if (two === "<=" || two === ">=" || two === "<>") { out.push({ t: "op", v: two, p: i, e: i + 2 }); i += 2; continue; }
      if ("+-*/^&=<>(),:%".indexOf(ch) >= 0) { out.push({ t: "op", v: ch, p: i, e: i + 1 }); i++; continue; }
      if (ch === ";") { out.push({ t: "op", v: ",", p: i, e: i + 1 }); i++; continue; }
      throw new Error("I don't understand the character " + ch);
    }
    return out;
  }

  /* ---------- parser ---------- */
  function parse(src) {
    var toks = tokenize(src), k = 0;
    function peek(v) { var t = toks[k]; return t && t.t === "op" && t.v === v; }
    function take(v) { if (!peek(v)) throw new Error("Expected " + v + (toks[k] ? " near " + src.slice(toks[k].p, toks[k].p + 8) : " at the end")); k++; }
    function expr() { return cmp(); }
    function cmp() { var l = cat(); while (toks[k] && toks[k].t === "op" && /^(=|<>|<|>|<=|>=)$/.test(toks[k].v)) { var op = toks[k++].v; l = { t: "bin", op: op, l: l, r: cat() }; } return l; }
    function cat() { var l = add(); while (peek("&")) { k++; l = { t: "bin", op: "&", l: l, r: add() }; } return l; }
    function add() { var l = mul(); while (peek("+") || peek("-")) { var op = toks[k++].v; l = { t: "bin", op: op, l: l, r: mul() }; } return l; }
    function mul() { var l = pow(); while (peek("*") || peek("/")) { var op = toks[k++].v; l = { t: "bin", op: op, l: l, r: pow() }; } return l; }
    function pow() { var l = un(); while (peek("^")) { k++; l = { t: "bin", op: "^", l: l, r: un() }; } return l; }
    function un() { if (peek("-")) { k++; return { t: "neg", e: un() }; } if (peek("+")) { k++; return un(); } return post(); }
    function post() { var e = prim(); while (peek("%")) { k++; e = { t: "pct", e: e }; } return e; }
    function prim() {
      var t = toks[k];
      if (!t) throw new Error("The formula ends too early");
      if (t.t === "num") { k++; return { t: "num", v: t.v }; }
      if (t.t === "str") { k++; return { t: "str", v: t.v }; }
      if (t.t === "bool") { k++; return { t: "bool", v: t.v }; }
      if (t.t === "ref") {
        k++;
        if (peek(":") && toks[k + 1] && toks[k + 1].t === "ref") { k++; var b = toks[k++]; return { t: "range", a: t, b: b }; }
        return { t: "ref", r: t };
      }
      if (t.t === "name") { k++; return { t: "name", v: t.v }; }
      if (t.t === "fn") {
        k++; take("("); var args = [];
        if (!peek(")")) { args.push(peek(",") ? { t: "missing" } : expr()); while (peek(",")) { k++; args.push(peek(",") || peek(")") ? { t: "missing" } : expr()); } }
        take(")"); return { t: "fn", v: t.v, args: args };
      }
      if (peek("(")) { k++; var e = expr(); take(")"); return e; }
      throw new Error("Unexpected " + src.slice(t.p, t.e));
    }
    var tree = expr();
    if (k < toks.length) throw new Error("Unexpected " + src.slice(toks[k].p, toks[k].e) + " — check commas and brackets");
    return tree;
  }

  /* shift relative row references (fill down) */
  function shiftFormula(src, dr, dc) {
    var toks; try { toks = tokenize(src); } catch (e) { return src; }
    var out = src;
    for (var i = toks.length - 1; i >= 0; i--) {
      var t = toks[i]; if (t.t !== "ref") continue;
      var row = t.ar ? t.row : t.row + dr, col = t.ac ? t.col : t.col + (dc || 0);
      if (row < 1 || col < 1) { out = out.slice(0, t.p) + "#REF!" + out.slice(t.e); continue; }
      var txt = (t.sheetRaw ? t.sheetRaw + "!" : "") + (t.ac ? "$" : "") + colName(col) + (t.ar ? "$" : "") + row;
      out = out.slice(0, t.p) + txt + out.slice(t.e);
    }
    return out;
  }

  /* ---------- workbook ---------- */
  function Book(def) {
    this.sheets = {};   // name -> { cells: {A1: value|"=formula"}, cols, rows, fmt }
    this.names = {};
    var self = this;
    Object.keys(def.sheets).forEach(function (n) {
      var s = def.sheets[n];
      self.sheets[n] = { cells: Object.assign({}, s.cells), cols: s.cols, rows: s.rows, fmt: s.fmt || {}, cellFmt: s.cellFmt || {} };
    });
    Object.keys(def.names || {}).forEach(function (n) { self.names[n.toUpperCase()] = def.names[n]; });
    this.cache = {};
  }
  Book.prototype.clone = function () {
    var b = Object.create(Book.prototype); b.sheets = {}; b.names = this.names; b.cache = {};
    var self = this;
    Object.keys(this.sheets).forEach(function (n) { var s = self.sheets[n]; b.sheets[n] = { cells: Object.assign({}, s.cells), cols: s.cols, rows: s.rows, fmt: s.fmt, cellFmt: s.cellFmt }; });
    return b;
  };
  Book.prototype.sheetName = function (n) {
    if (!n) return null;
    var keys = Object.keys(this.sheets);
    for (var i = 0; i < keys.length; i++) if (keys[i].toLowerCase() === n.toLowerCase()) return keys[i];
    return undefined;
  };
  Book.prototype.set = function (sheet, addr, v) { this.sheets[sheet].cells[addr] = v; this.cache = {}; };
  Book.prototype.raw = function (sheet, addr) { var s = this.sheets[sheet]; return s ? s.cells[addr] : undefined; };
  Book.prototype.value = function (sheet, col, row, stack) {
    var addr = colName(col) + row, key = sheet + "!" + addr;
    if (key in this.cache) return this.cache[key];
    var s = this.sheets[sheet]; if (!s) return E("#REF!");
    var raw = s.cells[addr], v;
    if (typeof raw === "string" && raw[0] === "=") {
      stack = stack || {};
      if (stack[key]) return E("#REF!");
      stack[key] = true;
      try { v = evalNode(parse(raw.slice(1)), this, sheet, stack); } catch (e) { v = E("#NAME?"); }
      delete stack[key];
      if (v && v.range) v = v.rows.length === 1 && v.rows[0].length === 1 ? v.rows[0][0] : E("#VALUE!");
    } else v = raw === undefined || raw === "" ? null : raw;
    this.cache[key] = v;
    return v;
  };
  Book.prototype.evaluate = function (formula, sheet) {
    var src = formula.trim().replace(/^=/, "");
    var v = evalNode(parse(src), this, sheet, {});
    if (v && v.range) v = v.rows.length === 1 && v.rows[0].length === 1 ? v.rows[0][0] : E("#VALUE!");
    return v;
  };

  function resolveName(book, n) {
    var target = book.names[n]; if (!target) return null;
    var toks = tokenize(target);
    return toks;
  }
  function rangeVal(book, sheet, a, b, stack) {
    var sh = a.sheet ? book.sheetName(a.sheet) : sheet;
    if (!sh) return E("#REF!");
    var r1 = Math.min(a.row, b.row), r2 = Math.max(a.row, b.row), c1 = Math.min(a.col, b.col), c2 = Math.max(a.col, b.col);
    var rows = [];
    for (var r = r1; r <= r2; r++) { var line = []; for (var c = c1; c <= c2; c++) line.push(book.value(sh, c, r, stack)); rows.push(line); }
    return { range: true, rows: rows };
  }

  /* ---------- evaluation ---------- */
  function num(v) {
    if (isErr(v)) return v;
    if (v === null || v === undefined) return 0;
    if (typeof v === "boolean") return v ? 1 : 0;
    if (typeof v === "number") return v;
    var t = String(v).trim();
    if (t !== "" && !isNaN(Number(t))) return Number(t);
    return E("#VALUE!");
  }
  function truthy(v) { if (isErr(v)) return v; if (typeof v === "string") { var u = v.toUpperCase(); if (u === "TRUE") return true; if (u === "FALSE") return false; return E("#VALUE!"); } return !!num(v); }
  function text(v) { if (v === null || v === undefined) return ""; if (typeof v === "boolean") return v ? "TRUE" : "FALSE"; return String(v); }
  function compare(a, b) {
    if (a === null) a = typeof b === "string" ? "" : 0;
    if (b === null) b = typeof a === "string" ? "" : 0;
    if (typeof a === "boolean") a = a ? 1 : 0;
    if (typeof b === "boolean") b = b ? 1 : 0;
    if (typeof a === "number" && typeof b === "number") return a < b ? -1 : a > b ? 1 : 0;
    if (typeof a === "number") return -1;
    if (typeof b === "number") return 1;
    a = String(a).toLowerCase(); b = String(b).toLowerCase();
    return a < b ? -1 : a > b ? 1 : 0;
  }
  function evalNode(n, book, sheet, stack) {
    switch (n.t) {
      case "num": return n.v;
      case "str": return n.v;
      case "bool": return n.v;
      case "missing": return null;
      case "ref": {
        var sh = n.r.sheet ? book.sheetName(n.r.sheet) : sheet;
        if (!sh) return E("#REF!");
        return book.value(sh, n.r.col, n.r.row, stack);
      }
      case "range": return rangeVal(book, sheet, n.a, n.b, stack);
      case "name": {
        var toks = resolveName(book, n.v);
        if (!toks) return E("#NAME?");
        var a = toks[0], b = toks[2] || toks[0];
        if (a.t !== "ref") return E("#NAME?");
        return toks.length === 1 ? book.value(book.sheetName(a.sheet) || sheet, a.col, a.row, stack) : rangeVal(book, sheet, a, Object.assign({}, b, { sheet: a.sheet }), stack);
      }
      case "neg": { var x = num(single(evalNode(n.e, book, sheet, stack))); return isErr(x) ? x : -x; }
      case "pct": { var p = num(single(evalNode(n.e, book, sheet, stack))); return isErr(p) ? p : p / 100; }
      case "bin": {
        var l = single(evalNode(n.l, book, sheet, stack)), r = single(evalNode(n.r, book, sheet, stack));
        if (isErr(l)) return l; if (isErr(r)) return r;
        if (n.op === "&") return text(l) + text(r);
        if (/^(=|<>|<|>|<=|>=)$/.test(n.op)) {
          var c = compare(l, r);
          return { "=": c === 0, "<>": c !== 0, "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[n.op];
        }
        var a1 = num(l), b1 = num(r); if (isErr(a1)) return a1; if (isErr(b1)) return b1;
        switch (n.op) {
          case "+": return a1 + b1; case "-": return a1 - b1; case "*": return a1 * b1;
          case "/": return b1 === 0 ? E("#DIV/0!") : a1 / b1;
          case "^": return Math.pow(a1, b1);
        }
        return E("#VALUE!");
      }
      case "fn": {
        var f = FN[n.v];
        if (!f) return E("#NAME?");
        if (f.lazy) return f(n.args, book, sheet, stack);
        var args = n.args.map(function (a) { return evalNode(a, book, sheet, stack); });
        return f(args);
      }
    }
    return E("#VALUE!");
  }
  function single(v) { if (v && v.range) return v.rows.length === 1 && v.rows[0].length === 1 ? v.rows[0][0] : E("#VALUE!"); return v; }
  function cells(v) { if (v && v.range) { var o = []; v.rows.forEach(function (r) { r.forEach(function (x) { o.push(x); }); }); return o; } return [v]; }
  function numbersFrom(args) {
    var out = [];
    for (var i = 0; i < args.length; i++) {
      var a = args[i];
      if (a && a.range) { var cs = cells(a); for (var j = 0; j < cs.length; j++) { if (isErr(cs[j])) return cs[j]; if (typeof cs[j] === "number") out.push(cs[j]); } }
      else { var x = num(a); if (isErr(x)) return x; out.push(x); }
    }
    return out;
  }
  function roundHalfAway(x, d) { var m = Math.pow(10, d || 0); var r = Math.round(Math.abs(x) * m + 1e-9) / m; return x < 0 ? -r : r; }

  /* criteria for COUNTIF / SUMIF … */
  function matcher(crit) {
    if (isErr(crit)) return function () { return false; };
    if (typeof crit === "number" || typeof crit === "boolean") return function (v) { return compare(v, crit) === 0 && v !== null; };
    var s = text(crit), m = /^(<=|>=|<>|<|>|=)?(.*)$/.exec(s), op = m[1] || "=", val = m[2];
    var isNum = val.trim() !== "" && !isNaN(Number(val));
    if (isNum) {
      var nv = Number(val);
      return function (v) {
        if (typeof v !== "number") return op === "<>";
        return { "=": v === nv, "<>": v !== nv, "<": v < nv, ">": v > nv, "<=": v <= nv, ">=": v >= nv }[op];
      };
    }
    if (op === "=" || op === "<>") {
      var re = new RegExp("^" + val.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$", "i");
      return function (v) { var hit = val === "" ? (v === null || v === "") : (v !== null && re.test(text(v))); return op === "=" ? hit : !hit; };
    }
    return function (v) { if (typeof v !== "string") return false; var c = compare(v, val); return { "<": c < 0, ">": c > 0, "<=": c <= 0, ">=": c >= 0 }[op]; };
  }
  function ifs(rangesCrits) {
    // returns list of indexes that match all pairs
    var first = cells(rangesCrits[0][0]), n = first.length, ok = [];
    for (var i = 0; i < n; i++) ok.push(true);
    for (var p = 0; p < rangesCrits.length; p++) {
      var cs = cells(rangesCrits[p][0]), mt = matcher(single(rangesCrits[p][1]));
      if (cs.length !== n) return E("#VALUE!");
      for (var j = 0; j < n; j++) if (!mt(cs[j])) ok[j] = false;
    }
    return ok;
  }
  function lookupExact(v, list) { for (var i = 0; i < list.length; i++) if (list[i] !== null && compare(list[i], v) === 0) return i; return -1; }
  function lookupApprox(v, list) { var best = -1; for (var i = 0; i < list.length; i++) { if (list[i] === null) continue; if (compare(list[i], v) <= 0) best = i; else break; } return best; }

  var FN = {
    SUM: function (a) { var ns = numbersFrom(a); if (isErr(ns)) return ns; return ns.reduce(function (s, x) { return s + x; }, 0); },
    AVERAGE: function (a) { var ns = numbersFrom(a); if (isErr(ns)) return ns; return ns.length ? ns.reduce(function (s, x) { return s + x; }, 0) / ns.length : E("#DIV/0!"); },
    MAX: function (a) { var ns = numbersFrom(a); if (isErr(ns)) return ns; return ns.length ? Math.max.apply(null, ns) : 0; },
    MIN: function (a) { var ns = numbersFrom(a); if (isErr(ns)) return ns; return ns.length ? Math.min.apply(null, ns) : 0; },
    COUNT: function (a) { var c = 0; a.forEach(function (x) { cells(x).forEach(function (v) { if (typeof v === "number") c++; }); }); return c; },
    COUNTA: function (a) { var c = 0; a.forEach(function (x) { cells(x).forEach(function (v) { if (v !== null && v !== "") c++; }); }); return c; },
    COUNTBLANK: function (a) { var c = 0; cells(a[0]).forEach(function (v) { if (v === null || v === "") c++; }); return c; },
    INT: function (a) { var x = num(single(a[0])); return isErr(x) ? x : Math.floor(x); },
    ROUND: function (a) { var x = num(single(a[0])), d = num(single(a[1] === undefined ? 0 : a[1])); if (isErr(x)) return x; if (isErr(d)) return d; return roundHalfAway(x, d); },
    ROUNDUP: function (a) { var x = num(single(a[0])), d = num(single(a[1] === undefined ? 0 : a[1])); if (isErr(x)) return x; var m = Math.pow(10, d); var r = Math.ceil(Math.abs(x) * m - 1e-9) / m; return x < 0 ? -r : r; },
    ROUNDDOWN: function (a) { var x = num(single(a[0])), d = num(single(a[1] === undefined ? 0 : a[1])); if (isErr(x)) return x; var m = Math.pow(10, d); var r = Math.floor(Math.abs(x) * m + 1e-9) / m; return x < 0 ? -r : r; },
    ABS: function (a) { var x = num(single(a[0])); return isErr(x) ? x : Math.abs(x); },
    MOD: function (a) { var x = num(single(a[0])), d = num(single(a[1])); if (isErr(x)) return x; if (isErr(d)) return d; if (d === 0) return E("#DIV/0!"); return x - d * Math.floor(x / d); },
    AND: function (a) { for (var i = 0; i < a.length; i++) { var cs = cells(a[i]); for (var j = 0; j < cs.length; j++) { var t = truthy(cs[j]); if (isErr(t)) return t; if (!t) return false; } } return true; },
    OR: function (a) { for (var i = 0; i < a.length; i++) { var cs = cells(a[i]); for (var j = 0; j < cs.length; j++) { var t = truthy(cs[j]); if (isErr(t)) return t; if (t) return true; } } return false; },
    NOT: function (a) { var t = truthy(single(a[0])); return isErr(t) ? t : !t; },
    COUNTIF: function (a) { if (a.length < 2) return E("#N/A"); var mt = matcher(single(a[1])), c = 0; cells(a[0]).forEach(function (v) { if (mt(v)) c++; }); return c; },
    COUNTIFS: function (a) { var pairs = []; for (var i = 0; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); var ok = ifs(pairs); if (isErr(ok)) return ok; return ok.filter(Boolean).length; },
    SUMIF: function (a) {
      if (a.length < 2) return E("#N/A");
      var mt = matcher(single(a[1])), rc = cells(a[0]), sc = a[2] ? cells(a[2]) : rc, s = 0;
      for (var i = 0; i < rc.length; i++) if (mt(rc[i]) && typeof sc[i] === "number") s += sc[i];
      return s;
    },
    SUMIFS: function (a) { var pairs = []; for (var i = 1; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); var ok = ifs(pairs); if (isErr(ok)) return ok; var sc = cells(a[0]), s = 0; ok.forEach(function (k, i) { if (k && typeof sc[i] === "number") s += sc[i]; }); return s; },
    AVERAGEIF: function (a) {
      var mt = matcher(single(a[1])), rc = cells(a[0]), sc = a[2] ? cells(a[2]) : rc, s = 0, n = 0;
      for (var i = 0; i < rc.length; i++) if (mt(rc[i]) && typeof sc[i] === "number") { s += sc[i]; n++; }
      return n ? s / n : E("#DIV/0!");
    },
    AVERAGEIFS: function (a) { var pairs = []; for (var i = 1; i + 1 < a.length; i += 2) pairs.push([a[i], a[i + 1]]); var ok = ifs(pairs); if (isErr(ok)) return ok; var sc = cells(a[0]), s = 0, n = 0; ok.forEach(function (k, i) { if (k && typeof sc[i] === "number") { s += sc[i]; n++; } }); return n ? s / n : E("#DIV/0!"); },
    VLOOKUP: function (a) {
      var v = single(a[0]), t = a[1], c = num(single(a[2])), approx = a.length < 4 || a[3] === null ? true : truthy(single(a[3]));
      if (isErr(v)) return v; if (!t || !t.range) return E("#VALUE!"); if (isErr(c)) return c;
      if (c < 1 || c > t.rows[0].length) return E("#REF!");
      var first = t.rows.map(function (r) { return r[0]; });
      var i = approx ? lookupApprox(v, first) : lookupExact(v, first);
      return i < 0 ? E("#N/A") : t.rows[i][c - 1];
    },
    HLOOKUP: function (a) {
      var v = single(a[0]), t = a[1], r = num(single(a[2])), approx = a.length < 4 || a[3] === null ? true : truthy(single(a[3]));
      if (isErr(v)) return v; if (!t || !t.range) return E("#VALUE!"); if (isErr(r)) return r;
      if (r < 1 || r > t.rows.length) return E("#REF!");
      var i = approx ? lookupApprox(v, t.rows[0]) : lookupExact(v, t.rows[0]);
      return i < 0 ? E("#N/A") : t.rows[r - 1][i];
    },
    LOOKUP: function (a) {
      var v = single(a[0]), lv = cells(a[1]), rv = a[2] ? cells(a[2]) : lv;
      if (isErr(v)) return v;
      var i = lookupApprox(v, lv);
      return i < 0 ? E("#N/A") : rv[i];
    },
    XLOOKUP: function (a) {
      var v = single(a[0]), lv = cells(a[1]), rv = cells(a[2]), nf = a[3], mode = a[4] ? num(single(a[4])) : 0;
      if (isErr(v)) return v;
      if (lv.length !== rv.length) return E("#VALUE!");
      var i = lookupExact(v, lv);
      if (i < 0 && (mode === -1 || mode === 1)) {
        var best = -1;
        for (var k = 0; k < lv.length; k++) {
          if (lv[k] === null) continue; var c = compare(lv[k], v);
          if (mode === -1 && c < 0 && (best < 0 || compare(lv[k], lv[best]) > 0)) best = k;
          if (mode === 1 && c > 0 && (best < 0 || compare(lv[k], lv[best]) < 0)) best = k;
        }
        i = best;
      }
      if (i < 0) return nf !== undefined && nf !== null ? single(nf) : E("#N/A");
      return rv[i];
    }
  };
  FN.IF = function (args, book, sheet, stack) {
    if (args.length < 2) return E("#N/A");
    var c = truthy(single(evalNode(args[0], book, sheet, stack)));
    if (isErr(c)) return c;
    if (c) return evalNode(args[1], book, sheet, stack);
    return args[2] && args[2].t !== "missing" ? evalNode(args[2], book, sheet, stack) : false;
  };
  FN.IF.lazy = true;

  /* ---------- formatting ---------- */
  function fmtVal(v, f) {
    if (isErr(v)) return v.err;
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
    if (typeof v === "number") {
      if (f === "cur") return (v < 0 ? "-¥" : "¥") + Math.abs(v).toFixed(2);
      if (f === "pct") return roundHalfAway(v * 100, 2) + "%";
      if (Math.abs(v) >= 1e12) return v.toExponential(4);
      return String(Math.round(v * 1e9) / 1e9);
    }
    return String(v);
  }
  function same(a, b) {
    if (isErr(a) || isErr(b)) return isErr(a) && isErr(b) && a.err === b.err;
    if (typeof a === "number" && typeof b === "number") return Math.abs(a - b) < 0.005;
    if (a === null || b === null) return (a === null || a === "") && (b === null || b === "");
    return String(a).toLowerCase() === String(b).toLowerCase();
  }
  function parseAddr(a) { var m = /^([A-Z]{1,2})(\d+)$/.exec(a.toUpperCase().replace(/\$/g, "")); return m ? { col: colNum(m[1]), row: parseInt(m[2], 10) } : null; }
  function rangeAddrs(r) {
    var p = r.split(":"), a = parseAddr(p[0]), b = parseAddr(p[1] || p[0]), out = [];
    for (var row = a.row; row <= b.row; row++) for (var c = a.col; c <= b.col; c++) out.push(colName(c) + row);
    return out;
  }
  function refsOf(formula) { try { return tokenize(formula.replace(/^=/, "")).filter(function (t) { return t.t === "ref" || t.t === "name"; }); } catch (e) { return []; } }

  /* =========================================================
     UI
     ========================================================= */
  function Lab(host, def) {
    var book = new Book(def), self = this;
    var tasks = def.tasks || [];
    var sheetNames = Object.keys(book.sheets);
    var current = def.start || sheetNames[0];
    var sel = null; // {sheet, addr}
    var marks = {}; // "Sheet!A1" -> "ok"|"bad"
    var state = {}; try { state = JSON.parse(localStorage.getItem("sheetlab:" + def.id) || "{}"); } catch (e) { state = {}; }
    function persist() { try { localStorage.setItem("sheetlab:" + def.id, JSON.stringify(state)); } catch (e) { /* ignore */ } }

    (def.prefill || []).forEach(function (p) { fillDown(book, p.sheet || current, p.fill, p.answer); });
    // restore saved student work
    Object.keys(state.cells || {}).forEach(function (k) { var i = k.indexOf("!"); if (book.sheets[k.slice(0, i)]) book.set(k.slice(0, i), k.slice(i + 1), state.cells[k]); });

    host.classList.add("sheetlab");
    host.innerHTML =
      '<div class="sl-bar"><span class="sl-box" aria-live="polite">—</span><span class="sl-fx">fx</span>' +
      '<input class="sl-input" type="text" spellcheck="false" autocomplete="off" aria-label="Formula bar" placeholder="Click a cell, then type a formula starting with =">' +
      '<button type="button" class="btn small primary sl-enter">Enter ↵</button></div>' +
      '<div class="sl-msg" aria-live="polite"></div>' +
      '<div class="sl-grid-wrap"><table class="sl-grid"></table></div>' +
      '<div class="sl-tabs"></div>' +
      (tasks.length ? '<div class="sl-tasks"></div>' : "") +
      '<div class="toolbar noprint"><button type="button" class="btn small sl-reset">↺ Reset the sheet</button><button type="button" class="btn small sl-formulas">Show formulas</button></div>';
    var input = host.querySelector(".sl-input"), box = host.querySelector(".sl-box"), msg = host.querySelector(".sl-msg"), grid = host.querySelector(".sl-grid"), tabs = host.querySelector(".sl-tabs");
    var showFormulas = false, hlRefs = [];

    function key(sh, a) { return sh + "!" + a; }
    function render() {
      var s = book.sheets[current], html = "<thead><tr><th></th>";
      for (var c = 1; c <= s.cols; c++) html += '<th class="col">' + colName(c) + "</th>";
      html += "</tr></thead><tbody>";
      for (var r = 1; r <= s.rows; r++) {
        html += '<tr><th class="row">' + r + "</th>";
        for (c = 1; c <= s.cols; c++) {
          var a = colName(c) + r, raw = s.cells[a], v = book.value(current, c, r);
          var cls = [];
          if (typeof raw === "string" && raw[0] === "=") cls.push("f");
          if (r === 1 || (s.cellFmt[a] === "h")) cls.push("h");
          if (isErr(v)) cls.push("err");
          if (marks[key(current, a)]) cls.push(marks[key(current, a)]);
          if (sel && sel.sheet === current && sel.addr === a) cls.push("sel");
          if (hlRefs.indexOf(key(current, a)) >= 0) cls.push("hl");
          var shown = showFormulas && typeof raw === "string" && raw[0] === "=" ? raw : fmtVal(v, s.cellFmt[a] && s.cellFmt[a] !== "h" ? s.cellFmt[a] : s.fmt[colName(c)]);
          html += '<td data-a="' + a + '" class="' + cls.join(" ") + '"' + (typeof raw === "string" && raw[0] === "=" ? ' title="' + esc(raw) + '"' : "") + ">" + esc(shown) + "</td>";
        }
        html += "</tr>";
      }
      grid.innerHTML = html + "</tbody>";
      tabs.innerHTML = sheetNames.map(function (n) { return '<button type="button" class="sl-tab' + (n === current ? " on" : "") + '" data-s="' + esc(n) + '">' + esc(n) + "</button>"; }).join("");
      if (def.names && Object.keys(def.names).length) tabs.innerHTML += '<span class="sl-names">Named ranges: ' + Object.keys(def.names).map(function (n) { return "<code>" + esc(n) + "</code> = " + esc(def.names[n]); }).join(" · ") + "</span>";
    }
    function select(sheet, a) {
      sel = { sheet: sheet, addr: a };
      var raw = book.raw(sheet, a);
      box.textContent = (sheet !== sheetNames[0] ? sheet + "!" : "") + a;
      input.value = raw === undefined || raw === null ? "" : fmtRaw(raw, sheet, a);
      hlRefs = [];
      if (typeof raw === "string" && raw[0] === "=") highlight(raw, sheet);
      render(); input.focus();
    }
    function fmtRaw(raw, sheet, a) { if (typeof raw === "number") { var f = book.sheets[sheet].cellFmt[a] || book.sheets[sheet].fmt[a.replace(/\d+/, "")]; if (f === "pct") return raw * 100 + "%"; } return String(raw); }
    function highlight(formula, sheet) {
      hlRefs = [];
      var toks = refsOf(formula), i;
      for (i = 0; i < toks.length; i++) {
        var t = toks[i];
        if (t.t === "name") {
          var nt = resolveName(book, t.v); if (!nt) continue;
          var a0 = nt[0], b0 = nt[2] || nt[0], shn = book.sheetName(a0.sheet) || sheet;
          for (var r = Math.min(a0.row, b0.row); r <= Math.max(a0.row, b0.row); r++) for (var c = Math.min(a0.col, b0.col); c <= Math.max(a0.col, b0.col); c++) hlRefs.push(key(shn, colName(c) + r));
          continue;
        }
        var sh = t.sheet ? book.sheetName(t.sheet) : sheet;
        var nx = toks[i + 1];
        if (nx && nx.t === "ref" && formula.replace(/^=/, "").slice(t.e, nx.p).trim() === ":") {
          for (var r2 = Math.min(t.row, nx.row); r2 <= Math.max(t.row, nx.row); r2++) for (var c2 = Math.min(t.col, nx.col); c2 <= Math.max(t.col, nx.col); c2++) hlRefs.push(key(sh, colName(c2) + r2));
          i++;
        } else hlRefs.push(key(sh, colName(t.col) + t.row));
      }
    }
    function parseEntry(txt) {
      txt = txt.trim();
      if (txt === "") return null;
      if (txt[0] === "=") return txt;
      if (/^-?\d+(\.\d+)?%$/.test(txt)) return parseFloat(txt) / 100;
      if (!isNaN(Number(txt))) return Number(txt);
      return txt;
    }
    function taskFor(sheet, a) { for (var i = 0; i < tasks.length; i++) { if ((tasks[i].sheet || sheetNames[0]) === sheet && rangeAddrs(tasks[i].fill)[0] === a) return tasks[i]; } return null; }

    function enter() {
      if (!sel) { msg.className = "sl-msg warn"; msg.textContent = "Click a cell first, then type in the formula bar."; return; }
      var entry = parseEntry(input.value);
      if (typeof entry === "string" && entry[0] === "=") { try { parse(entry.slice(1)); } catch (e) { msg.className = "sl-msg bad"; msg.textContent = "⚠ " + e.message; return; } }
      var t = taskFor(sel.sheet, sel.addr);
      if (t && typeof entry === "string" && entry[0] === "=") { checkTask(t, entry); return; }
      if (typeof entry === "string" && entry[0] !== "=" && /^[A-Za-z]+\(|^(SUM|IF|VLOOKUP|COUNT)/i.test(entry)) { msg.className = "sl-msg warn"; msg.textContent = "Tip: a formula must start with = — otherwise the spreadsheet treats it as text."; }
      else msg.textContent = "";
      book.set(sel.sheet, sel.addr, entry === null ? undefined : entry);
      state.cells = state.cells || {}; state.cells[key(sel.sheet, sel.addr)] = entry; persist();
      delete marks[key(sel.sheet, sel.addr)];
      select(sel.sheet, sel.addr);
    }

    function fillDown(b, sheet, fill, formula) {
      var addrs = rangeAddrs(fill), base = parseAddr(addrs[0]);
      addrs.forEach(function (a) { var p = parseAddr(a); b.set(sheet, a, p.row === base.row && p.col === base.col ? formula : shiftFormula(formula, p.row - base.row, p.col - base.col)); });
      return addrs;
    }
    function referenceBook(except) {
      var b = book.clone();
      tasks.forEach(function (t) { if (t !== except) fillDown(b, t.sheet || sheetNames[0], t.fill, t.answer); });
      return b;
    }

    function checkTask(t, formula) {
      var sh = t.sheet || sheetNames[0];
      var addrs = fillDown(book, sh, t.fill, formula);
      state.cells = state.cells || {}; addrs.forEach(function (a) { state.cells[key(sh, a)] = book.raw(sh, a); });
      // compare in an isolated book where every other task holds the correct answer
      var mine = referenceBook(t); fillDown(mine, sh, t.fill, formula);
      var ref = referenceBook(t); fillDown(ref, sh, t.fill, t.answer);
      var wrong = [], firstOk = null;
      addrs.forEach(function (a, i) {
        var p = parseAddr(a), v1 = mine.value(sh, p.col, p.row), v2 = ref.value(sh, p.col, p.row), ok = same(v1, v2);
        marks[key(sh, a)] = ok ? "ok" : "bad";
        if (!ok) wrong.push({ a: a, got: v1, want: v2 });
        if (i === 0) firstOk = ok;
      });
      var res = host.querySelector('.sl-task[data-id="' + t.id + '"] .sl-res');
      var fb;
      if (!wrong.length) {
        fb = "✓ Correct" + (addrs.length > 1 ? " in all " + addrs.length + " rows" : "") + ".";
        state.done = state.done || {}; state.done[t.id] = true;
      } else {
        var w = wrong[0];
        fb = "✗ " + wrong.length + " of " + addrs.length + " cell" + (addrs.length > 1 ? "s" : "") + " wrong. " + w.a + " shows " + (fmtVal(w.got) || "(blank)") + " but should be " + fmtVal(w.want) + ".";
        if (addrs.length > 1 && firstOk) fb += " The first row is right but the copied rows are wrong — click " + wrong[0].a + " and look at the copied formula. Should a reference be absolute ($)?";
        else if (isErr(w.got) && w.got.err === "#NAME?") fb += " #NAME? means a function name is misspelt, a named range doesn't exist, or text is missing its speech marks.";
        else if (isErr(w.got) && w.got.err === "#N/A") fb += " #N/A means the lookup value was not found — check the table range and FALSE for an exact match.";
        else if (isErr(w.got) && w.got.err === "#REF!") fb += " #REF! means the column/row number is outside the table.";
        if (state.done) delete state.done[t.id];
      }
      persist();
      if (res) { res.className = "sl-res " + (wrong.length ? "bad" : "ok"); res.textContent = fb; }
      msg.className = "sl-msg " + (wrong.length ? "bad" : "ok");
      msg.textContent = (addrs.length > 1 ? "Copied down " + addrs[0] + ":" + addrs[addrs.length - 1] + " (like dragging the fill handle). " : "") + fb;
      select(sh, sel.addr);
      updateTaskMarks();
    }

    function updateTaskMarks() {
      tasks.forEach(function (t) {
        var el = host.querySelector('.sl-task[data-id="' + t.id + '"]');
        if (el) el.classList.toggle("done", !!(state.done && state.done[t.id]));
      });
      var sc = host.querySelector(".sl-score");
      if (sc) { var d = tasks.filter(function (t) { return state.done && state.done[t.id]; }).length; sc.textContent = d + " / " + tasks.length + " tasks correct"; }
    }

    if (tasks.length) {
      var tl = host.querySelector(".sl-tasks");
      tl.innerHTML = '<div class="sl-score"></div>' + tasks.map(function (t, i) {
        var first = rangeAddrs(t.fill)[0];
        return '<div class="sl-task" data-id="' + t.id + '"><div class="sl-thead"><span class="sl-tn">' + (i + 1) + '</span><strong>' + esc(t.title) + "</strong>" + (t.marks ? '<span class="m">[' + t.marks + "]</span>" : "") + "</div>" +
          "<p>" + t.prompt + "</p>" +
          '<div class="toolbar"><button type="button" class="btn small primary sl-go" data-a="' + first + '">Go to ' + first + "</button>" +
          '<button type="button" class="btn small sl-hint">Hint</button><button type="button" class="btn small sl-ans">Show answer</button></div>' +
          '<div class="sl-hinttxt" hidden>💡 ' + t.hint + "</div>" +
          '<div class="sl-anstxt" hidden>Model answer: <code>' + esc(t.answer) + "</code>" + (t.alt ? "<br>Also accepted: " + t.alt.map(function (x) { return "<code>" + esc(x) + "</code>"; }).join(" ") : "") + "</div>" +
          '<div class="sl-res"></div></div>';
      }).join("");
      tl.addEventListener("click", function (e) {
        var b = e.target.closest("button"); if (!b) return;
        var card = b.closest(".sl-task"), t = tasks.filter(function (x) { return x.id === card.getAttribute("data-id"); })[0];
        if (b.classList.contains("sl-go")) { current = t.sheet || sheetNames[0]; select(current, b.getAttribute("data-a")); host.querySelector(".sl-bar").scrollIntoView({ block: "nearest" }); msg.className = "sl-msg"; msg.textContent = t.title + ": type your formula for " + b.getAttribute("data-a") + " and press Enter. It will be copied down for you."; }
        if (b.classList.contains("sl-hint")) card.querySelector(".sl-hinttxt").hidden = !card.querySelector(".sl-hinttxt").hidden;
        if (b.classList.contains("sl-ans")) card.querySelector(".sl-anstxt").hidden = !card.querySelector(".sl-anstxt").hidden;
      });
    }

    grid.addEventListener("click", function (e) { var td = e.target.closest("td[data-a]"); if (td) select(current, td.getAttribute("data-a")); });
    tabs.addEventListener("click", function (e) { var b = e.target.closest(".sl-tab"); if (!b) return; current = b.getAttribute("data-s"); sel = null; box.textContent = "—"; hlRefs = []; render(); });
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); enter(); } });
    input.addEventListener("input", function () { if (sel && input.value[0] === "=") { highlight(input.value, sel.sheet); render(); } });
    host.querySelector(".sl-enter").addEventListener("click", enter);
    host.querySelector(".sl-formulas").addEventListener("click", function (e) { showFormulas = !showFormulas; e.target.textContent = showFormulas ? "Show values" : "Show formulas"; render(); });
    host.querySelector(".sl-reset").addEventListener("click", function () {
      if (!window.confirm("Clear everything you typed in this sheet?")) return;
      state = {}; persist(); marks = {};
      book = new Book(def); (def.prefill || []).forEach(function (p) { fillDown(book, p.sheet || sheetNames[0], p.fill, p.answer); });
      host.querySelectorAll(".sl-res").forEach(function (r) { r.textContent = ""; r.className = "sl-res"; });
      sel = null; box.textContent = "—"; input.value = ""; msg.textContent = ""; render(); updateTaskMarks();
    });

    /* public: run a formula in a scratch cell (used by the glossary) */
    this.tryFormula = function (formula, at) {
      var spot = at || def.scratch || "N2", sh = def.scratchSheet || sheetNames[0];
      current = sh; book.set(sh, spot, formula); select(sh, spot);
      var v = book.value(sh, parseAddr(spot).col, parseAddr(spot).row);
      msg.className = "sl-msg " + (isErr(v) ? "bad" : "ok");
      msg.innerHTML = "<code>" + esc(formula) + "</code> → <strong>" + esc(fmtVal(v)) + "</strong>" + (isErr(v) ? "" : "  (placed in " + spot + ")");
      host.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    render(); updateTaskMarks();
  }

  window.SheetLab = { create: function (host, def) { return new Lab(host, def); }, _parse: parse, _shift: shiftFormula, _Book: Book };
})();
