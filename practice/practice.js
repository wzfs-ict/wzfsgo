/* =========================================================
   WZFS ICT · Practice Guides — shared engine
   Each page sets window.PRACTICE = { id, quiz, blanks, exam, cards }
   and provides empty containers: #quiz #blanks #exam #cards #glossary #progress
   ========================================================= */
(function () {
  "use strict";

  var P = window.PRACTICE || {};
  var NS = "wzfs-practice:" + (P.id || location.pathname) + ":";

  /* ---------- storage (never trusted, never required) ---------- */
  function load(k, d) {
    try { var v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function save(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); } catch (e) { /* private mode etc. */ }
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }
  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /* ---------- theme toggle ---------- */
  function initTheme() {
    var t = load("theme", null);
    if (t) document.documentElement.setAttribute("data-theme", t);
    var b = document.querySelector(".theme-btn");
    if (!b) return;
    b.addEventListener("click", function () {
      var cur = document.documentElement.getAttribute("data-theme");
      var dark = cur ? cur === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      save("theme", next);
    });
  }

  /* =========================================================
     MCQ QUIZ
     item: { t: topic, q: question html, o: [options], a: index, e: explanation }
     ========================================================= */
  var quizState = load("quiz", {}); // id -> chosen index
  function initQuiz() {
    var host = document.getElementById("quiz");
    if (!host || !P.quiz) return;
    var items = P.quiz.map(function (x, i) { x.id = i; return x; });
    var topics = [];
    items.forEach(function (x) { if (x.t && topics.indexOf(x.t) < 0) topics.push(x.t); });
    var filter = "All", onlyWrong = false, order = items.slice();

    var bar = el("div", "toolbar noprint");
    var chips = el("div", "chips");
    ["All"].concat(topics).forEach(function (t) {
      var c = el("button", "chip-btn" + (t === "All" ? " on" : ""), esc(t));
      c.type = "button";
      c.addEventListener("click", function () {
        filter = t;
        chips.querySelectorAll(".chip-btn").forEach(function (b) { b.classList.toggle("on", b === c); });
        render();
      });
      chips.appendChild(c);
    });
    var bShuffle = el("button", "btn small", "🔀 Shuffle"); bShuffle.type = "button";
    var bWrong = el("button", "btn small", "Show only my mistakes"); bWrong.type = "button";
    var bReset = el("button", "btn small", "↺ Reset quiz"); bReset.type = "button";
    var score = el("span", "score");
    bar.appendChild(chips);
    var bar2 = el("div", "toolbar noprint");
    bar2.appendChild(bShuffle); bar2.appendChild(bWrong); bar2.appendChild(bReset); bar2.appendChild(score);
    var list = el("div");
    host.appendChild(bar); host.appendChild(bar2); host.appendChild(list);

    bShuffle.addEventListener("click", function () { order = shuffle(items.slice()); render(); });
    bWrong.addEventListener("click", function () {
      onlyWrong = !onlyWrong;
      bWrong.textContent = onlyWrong ? "Show all questions" : "Show only my mistakes";
      render();
    });
    bReset.addEventListener("click", function () { quizState = {}; save("quiz", quizState); render(); });

    function updateScore() {
      var done = 0, right = 0;
      items.forEach(function (x) {
        if (quizState[x.id] != null) { done++; if (quizState[x.id] === x.a) right++; }
      });
      score.textContent = right + " / " + done + " correct  ·  " + done + " of " + items.length + " answered";
      updateProgress();
    }

    function render() {
      list.innerHTML = "";
      var n = 0;
      order.forEach(function (x) {
        if (filter !== "All" && x.t !== filter) return;
        var chosen = quizState[x.id];
        if (onlyWrong && (chosen == null || chosen === x.a)) return;
        n++;
        var q = el("div", "q");
        q.innerHTML = '<div class="topic">' + esc(x.t || "") + '</div><div class="qhead"><span class="qn">Q' + n + '.</span><span class="qt">' + x.q + "</span></div>";
        var opts = el("div", "opts");
        var exp = el("div", "explain");
        exp.style.display = "none";
        x.o.forEach(function (o, i) {
          var b = el("button", "opt", String.fromCharCode(65 + i) + ".&nbsp; " + o);
          b.type = "button";
          b.addEventListener("click", function () {
            quizState[x.id] = i; save("quiz", quizState); paint(); updateScore();
          });
          opts.appendChild(b);
        });
        function paint() {
          var c = quizState[x.id];
          if (c == null) return;
          opts.querySelectorAll(".opt").forEach(function (b, i) {
            b.disabled = true;
            if (i === x.a) b.classList.add("right");
            if (i === c && c !== x.a) b.classList.add("wrong");
          });
          exp.className = "explain " + (c === x.a ? "ok" : "no");
          exp.innerHTML = x.e || "";
          exp.style.display = "block";
        }
        q.appendChild(opts); q.appendChild(exp);
        paint();
        list.appendChild(q);
      });
      if (!n) list.appendChild(el("p", "lead", onlyWrong ? "No mistakes to show — great work! 🎉" : "No questions in this topic."));
      updateScore();
    }
    render();
  }

  /* =========================================================
     FILL IN THE BLANKS
     item: { t: topic, s: "text with {{answer|alt}} blanks", code: bool, h: hint }
     ========================================================= */
  var blankState = load("blanks", {}); // "i-j" -> typed value
  function norm(s, code) {
    s = String(s || "").trim().toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    if (code) return s.replace(/\s+/g, "").replace(/'/g, '"');
    return s.replace(/\s+/g, " ").replace(/[.]$/, "");
  }
  function initBlanks() {
    var host = document.getElementById("blanks");
    if (!host || !P.blanks) return;
    var bar = el("div", "toolbar noprint");
    var bCheck = el("button", "btn primary", "Check all answers"); bCheck.type = "button";
    var bShow = el("button", "btn small", "Show all answers"); bShow.type = "button";
    var bReset = el("button", "btn small", "↺ Clear"); bReset.type = "button";
    var score = el("span", "score");
    bar.appendChild(bCheck); bar.appendChild(bShow); bar.appendChild(bReset); bar.appendChild(score);
    host.appendChild(bar);
    var inputs = [];

    P.blanks.forEach(function (x, i) {
      var box = el("div", "blank-item" + (x.code ? " code" : ""));
      var line = el("div", "line");
      var parts = x.s.split(/\{\{(.+?)\}\}/);
      var answers = [];
      parts.forEach(function (p, j) {
        if (j % 2 === 0) {
          var span = document.createElement("span");
          if (x.code) span.textContent = p; else span.innerHTML = p;
          line.appendChild(span);
        } else {
          var key = i + "-" + j;
          var alts = p.split("|");
          var inp = document.createElement("input");
          inp.type = "text";
          inp.autocomplete = "off"; inp.spellcheck = false;
          inp.setAttribute("aria-label", "blank");
          inp.size = Math.max(5, Math.min(22, alts[0].length + 2));
          inp.value = blankState[key] || "";
          inp.addEventListener("input", function () {
            inp.classList.remove("right", "wrong");
            blankState[key] = inp.value; save("blanks", blankState);
          });
          inp.addEventListener("keydown", function (ev) { if (ev.key === "Enter") { check(inp); updateBlankScore(); } });
          inp._alts = alts; inp._code = !!x.code;
          inputs.push(inp);
          answers.push(alts[0]);
          line.appendChild(inp);
        }
      });
      var tl = el("div", null, esc(x.t || ""));
      tl.style.cssText = "font-size:.72rem;color:var(--muted);text-transform:uppercase;letter-spacing:.06em";
      box.appendChild(tl);
      box.appendChild(line);
      var rev = el("div", "reveal");
      rev.style.display = "none";
      rev.innerHTML = "Answer: <strong>" + answers.map(esc).join(" · ") + "</strong>" + (x.h ? " — " + x.h : "");
      box.appendChild(rev);
      box._rev = rev;
      host.appendChild(box);
    });

    function check(inp) {
      if (!inp.value.trim()) { inp.classList.remove("right", "wrong"); return false; }
      var v = norm(inp.value, inp._code);
      var ok = inp._alts.some(function (a) { return norm(a, inp._code) === v; });
      inp.classList.toggle("right", ok); inp.classList.toggle("wrong", !ok);
      return ok;
    }
    function updateBlankScore() {
      var r = 0;
      inputs.forEach(function (inp) { if (inp.classList.contains("right")) r++; });
      score.textContent = r + " / " + inputs.length + " correct";
      save("blanksScore", r);
      updateProgress();
    }
    bCheck.addEventListener("click", function () { inputs.forEach(check); updateBlankScore(); });
    bShow.addEventListener("click", function () {
      host.querySelectorAll(".blank-item").forEach(function (b) { b._rev.style.display = b._rev.style.display === "none" ? "block" : "none"; });
    });
    bReset.addEventListener("click", function () {
      inputs.forEach(function (inp) { inp.value = ""; inp.classList.remove("right", "wrong"); });
      blankState = {}; save("blanks", blankState); updateBlankScore();
    });
    // re-check anything already typed
    inputs.forEach(function (inp) { if (inp.value) check(inp); });
    updateBlankScore();
  }

  /* =========================================================
     EXAM-STYLE QUESTIONS
     item: { n, cmd, q, m, pts: [marking points], model, trap, max }
     ========================================================= */
  var examState = load("exam", {}); // n -> { text, ticks: [] }
  function initExam() {
    var host = document.getElementById("exam");
    if (!host || !P.exam) return;
    var total = 0;
    var bar = el("div", "toolbar noprint");
    var score = el("span", "score");
    var bOpen = el("button", "btn small", "Open all mark schemes"); bOpen.type = "button";
    var bReset = el("button", "btn small", "↺ Clear my answers"); bReset.type = "button";
    bar.appendChild(bOpen); bar.appendChild(bReset); bar.appendChild(score);
    host.appendChild(bar);
    var tallies = [];

    P.exam.forEach(function (x) {
      total += x.m;
      var st = examState[x.n] || { text: "", ticks: [] };
      var box = el("div", "exam-q");
      box.innerHTML =
        (x.cmd ? '<span class="cmd">' + esc(x.cmd) + "</span>" : "") +
        '<div class="top"><span class="qn">' + esc(x.n) + '</span><div class="qbody">' + x.q + '</div><span class="marks">[' + x.m + "]</span></div>";
      var ta = document.createElement("textarea");
      ta.placeholder = "Write your answer here — one clear point per mark…";
      ta.value = st.text || "";
      ta.rows = Math.max(3, Math.min(10, x.m + 1));
      ta.addEventListener("input", function () { st.text = ta.value; examState[x.n] = st; save("exam", examState); });
      box.appendChild(ta);

      var btn = el("button", "btn small noprint", "Show mark scheme & self-mark"); btn.type = "button";
      btn.style.marginTop = "8px";
      box.appendChild(btn);
      var ms = el("div", "ms");
      var h = '<div class="label" style="font-weight:700;color:var(--navy)">Mark scheme — tick each point you made' + (x.max ? " (" + esc(x.max) + ")" : "") + "</div>";
      ms.innerHTML = h;
      var boxes = [];
      (x.pts || []).forEach(function (p, i) {
        var lab = document.createElement("label");
        var cb = document.createElement("input");
        cb.type = "checkbox"; cb.checked = !!st.ticks[i];
        cb.addEventListener("change", function () { st.ticks[i] = cb.checked; examState[x.n] = st; save("exam", examState); upd(); });
        boxes.push(cb);
        var sp = document.createElement("span"); sp.innerHTML = p;
        lab.appendChild(cb); lab.appendChild(sp);
        ms.appendChild(lab);
      });
      var self = el("div", "selfmark");
      ms.appendChild(self);
      if (x.trap) ms.appendChild(el("div", "trap", "<strong>⚠ Zero-mark trap:</strong> " + x.trap));
      if (x.model) ms.appendChild(el("div", "model", '<div class="label">Model answer</div>' + x.model));
      box.appendChild(ms);
      btn.addEventListener("click", function () { ms.classList.toggle("open"); btn.textContent = ms.classList.contains("open") ? "Hide mark scheme" : "Show mark scheme & self-mark"; });
      function got() { var c = 0; boxes.forEach(function (b) { if (b.checked) c++; }); return Math.min(c, x.m); }
      function upd() { self.textContent = "Your mark: " + got() + " / " + x.m; updTotal(); }
      tallies.push(got);
      upd();
      host.appendChild(box);
    });
    function updTotal() {
      var s = 0; tallies.forEach(function (f) { s += f(); });
      score.textContent = "Self-marked total: " + s + " / " + total;
      save("examScore", [s, total]);
      updateProgress();
    }
    bOpen.addEventListener("click", function () { host.querySelectorAll(".ms").forEach(function (m) { m.classList.add("open"); }); });
    bReset.addEventListener("click", function () {
      if (!window.confirm("Clear all your written answers and ticks?")) return;
      examState = {}; save("exam", examState); location.reload();
    });
    updTotal();
  }

  /* =========================================================
     FLASHCARDS + GLOSSARY  item: { en, ko, d }
     ========================================================= */
  function initCards() {
    if (!P.cards) return;
    var host = document.getElementById("cards");
    if (host) {
      var bar = el("div", "toolbar noprint");
      var bS = el("button", "btn small", "🔀 Shuffle cards"); bS.type = "button";
      var bF = el("button", "btn small", "Flip all"); bF.type = "button";
      bar.appendChild(bS); bar.appendChild(bF);
      bar.appendChild(el("span", "score", "Tap a card to flip it"));
      var grid = el("div", "flash-grid");
      host.appendChild(bar); host.appendChild(grid);
      var draw = function (arr) {
        grid.innerHTML = "";
        arr.forEach(function (c) {
          var f = el("button", "flash");
          f.type = "button";
          f.innerHTML = '<div class="inner"><div class="face front"><div class="t">' + esc(c.en) + '</div><div class="k">' + esc(c.ko || "") + '</div></div><div class="face back">' + c.d + "</div></div>";
          f.addEventListener("click", function () { f.classList.toggle("flipped"); });
          grid.appendChild(f);
        });
      };
      draw(P.cards);
      bS.addEventListener("click", function () { draw(shuffle(P.cards.slice())); });
      bF.addEventListener("click", function () { grid.querySelectorAll(".flash").forEach(function (f) { f.classList.toggle("flipped"); }); });
    }
    var g = document.getElementById("glossary");
    if (g) {
      var rows = P.cards.map(function (c) { return "<tr><th>" + esc(c.en) + "</th><td>" + esc(c.ko || "") + "</td><td>" + c.d + "</td></tr>"; }).join("");
      g.innerHTML = '<div class="tbl-wrap"><table><thead><tr><th>English</th><th>한국어</th><th>Meaning (plain English)</th></tr></thead><tbody>' + rows + "</tbody></table></div>";
    }
  }

  /* =========================================================
     LIVE CODE SANDBOX
     <div class="sandbox-host" data-kind="svg|html" data-src="scriptId"></div>
     source: <script type="text/plain" id="scriptId">…</script>
     ========================================================= */
  function initSandboxes() {
    document.querySelectorAll(".sandbox-host").forEach(function (host, idx) {
      var src = document.getElementById(host.dataset.src);
      var start = src ? src.textContent.replace(/^\n/, "") : "";
      var kind = host.dataset.kind || "html";
      var key = "sb-" + (host.dataset.src || idx);
      var wrap = el("div", "sandbox");
      var left = el("div"); var right = el("div");
      left.appendChild(el("div", "lbl", kind === "svg" ? "Your SVG code — edit me" : "Your HTML / CSS — edit me"));
      right.appendChild(el("div", "lbl", "Live result"));
      var ta = document.createElement("textarea");
      ta.spellcheck = false;
      ta.value = load(key, start);
      var fr = document.createElement("iframe");
      fr.setAttribute("sandbox", "");
      fr.setAttribute("title", "Live preview");
      left.appendChild(ta); right.appendChild(fr);
      wrap.appendChild(left); wrap.appendChild(right);
      var tb = el("div", "toolbar noprint");
      var bR = el("button", "btn small", "↺ Reset code"); bR.type = "button";
      tb.appendChild(bR);
      host.appendChild(wrap); host.appendChild(tb);
      var tmr;
      function run() {
        var code = ta.value;
        fr.srcdoc = kind === "svg"
          ? '<!doctype html><meta charset="utf-8"><body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#fff">' + code + "</body>"
          : code;
      }
      ta.addEventListener("input", function () { clearTimeout(tmr); tmr = setTimeout(function () { save(key, ta.value); run(); }, 300); });
      ta.addEventListener("keydown", function (e) {
        if (e.key === "Tab") { e.preventDefault(); var s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); }
      });
      bR.addEventListener("click", function () { ta.value = start; save(key, start); run(); });
      run();
    });
  }

  /* =========================================================
     CHECKLISTS  <ul class="checklist" data-key="x"><li>text</li></ul>
     ========================================================= */
  var checks = load("checks", {});
  function initChecklists() {
    document.querySelectorAll("ul.checklist").forEach(function (ul, u) {
      var k = ul.dataset.key || "c" + u;
      ul.querySelectorAll("li").forEach(function (li, i) {
        var id = k + "-" + i;
        var lab = document.createElement("label");
        var cb = document.createElement("input"); cb.type = "checkbox"; cb.checked = !!checks[id];
        var sp = document.createElement("span"); sp.innerHTML = li.innerHTML;
        cb.addEventListener("change", function () { checks[id] = cb.checked; save("checks", checks); updateProgress(); });
        lab.appendChild(cb); lab.appendChild(sp);
        li.innerHTML = ""; li.appendChild(lab);
      });
    });
  }

  /* ---------- grades (WZFS grade guide: A* 30–35, A 26–29, B 22–25, C 18–21, D 14–17, E 11–13 out of 35) ---------- */
  var BANDS = [[30, "A*", "#1e7d4f"], [26, "A", "#1e7d4f"], [22, "B", "#0e7c86"], [18, "C", "#0e7c86"], [14, "D", "#b7791f"], [11, "E", "#b7791f"], [0, "U", "#b42318"]];
  function gradeFor(pct) {
    var m = pct * 35 + 1e-9;
    for (var i = 0; i < BANDS.length; i++) if (m >= BANDS[i][0]) return { g: BANDS[i][1], c: BANDS[i][2] };
    return { g: "U", c: "#b42318" };
  }
  window.WZFSGrade = gradeFor;

  /* ---------- progress panel ---------- */
  function updateProgress() {
    var host = document.getElementById("progress");
    if (!host) return;
    var qa = 0, qr = 0, qt = (P.quiz || []).length;
    (P.quiz || []).forEach(function (x, i) { var c = quizState[i]; if (c != null) { qa++; if (c === x.a) qr++; } });
    var bt = 0; (P.blanks || []).forEach(function (x) { bt += (x.s.match(/\{\{/g) || []).length; });
    var br = load("blanksScore", 0);
    var ex = load("examScore", [0, 0]);
    var boxes = document.querySelectorAll("ul.checklist input");
    var cd = 0; boxes.forEach(function (b) { if (b.checked) cd++; });
    function stat(v, l, pct) { return '<div class="stat"><div class="v">' + v + '</div><div class="l">' + l + '</div><div class="bar"><i style="width:' + Math.round(pct * 100) + '%"></i></div></div>'; }
    var got = qr + br + (ex[0] || 0), max = qt + bt + (ex[1] || 0);
    var gradeHtml = "";
    if (max) {
      var pct = got / max, g = gradeFor(pct);
      var finished = qa === qt;
      gradeHtml = '<div class="stat grade-stat" style="border-color:' + g.c + '"><div class="v" style="color:' + g.c + '">' + g.g + '</div><div class="l">' +
        (finished ? "Your grade" : "Grade so far") + " · " + Math.round(pct * 100) + "% of all marks" + (finished ? "" : " — answer every question for your final grade") + "</div></div>";
    }
    host.innerHTML = gradeHtml +
      stat(qr + "/" + qt, "Quiz questions correct", qt ? qr / qt : 0) +
      stat(br + "/" + bt, "Blanks filled correctly", bt ? br / bt : 0) +
      stat(ex[0] + "/" + (ex[1] || 0), "Exam marks (self-marked)", ex[1] ? ex[0] / ex[1] : 0) +
      stat(cd + "/" + boxes.length, "Checklist items ticked", boxes.length ? cd / boxes.length : 0);
  }

  function initToolkit() {
  // answer toolkit: reveal plan points one per click
  document.querySelectorAll(".tk-next").forEach(function (b) {
    b.addEventListener("click", function () {
      var box = document.getElementById(b.dataset.target);
      var next = box && box.querySelector(".tk-pt[hidden]");
      if (next) next.hidden = false;
      if (!box.querySelector(".tk-pt[hidden]")) { b.disabled = true; b.textContent = "All points shown"; }
    });
  });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTheme();
    initChecklists();
    initQuiz();
    initBlanks();
    initExam();
    initCards();
    initSandboxes();
    initToolkit();
    updateProgress();
    var y = document.getElementById("year");
    if (y) y.textContent = "2026–27";
  });
})();
