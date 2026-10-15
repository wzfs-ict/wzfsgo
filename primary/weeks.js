/* Renders the Semester 1 week cards for one grade.
   Page sets <body data-grade="3"> and has <div id="weeks"></div>. Needs weeks-data.js first. */
(function () {
  "use strict";
  var START = new Date(2026, 7, 31); // Monday 31 Aug 2026 = Week 1
  var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  function monday(n) { var d = new Date(START); d.setDate(d.getDate() + 7 * (n - 1)); return d; }
  function fmt(d) { return d.getDate() + " " + MONTHS[d.getMonth()]; }
  function range(n) { var m = monday(n), f = new Date(m); f.setDate(f.getDate() + 4); return fmt(m) + " – " + fmt(f); }
  function currentWeek() {
    var now = new Date(); now.setHours(0, 0, 0, 0);
    var n = Math.floor((now - START) / (7 * 864e5)) + 1;
    return n >= 1 && n <= 18 ? n : 0;
  }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* Block colours follow the real editors' categories */
  function chipColour(b, g) {
    var t = b.toLowerCase().replace(/^(cat|dog): /, "");
    if (g === 2) {
      if (/^start|send message/.test(t)) return "#d4a300";
      if (/^(go|turn|hop)/.test(t)) return "#2563eb";
      if (/^(say|grow|shrink|hide|show)/.test(t)) return "#9333ea";
      if (/sound/.test(t)) return "#16a34a";
      if (/^end/.test(t)) return "#dc2626";
      return "#64748b";
    }
    if (/radio/.test(t)) return "#db2777";
    if (/function|call |celebrate|flash\(|note[cd]/.test(t)) return "#3455db";
    if (/random|time - start|\+ 3/.test(t)) return "#7c3aed";
    if (/^(on button|on shake|tilt|temperature|light level|running time|on a|a \/ b|a\+b)/.test(t)) return "#c026d3";
    if (/tone|tune|sound/.test(t)) return "#ea580c";
    if (/^repeat/.test(t)) return "#15803d";
    if (/^(if|else)|=|>|</.test(t)) return "#0e7490";
    if (/^(set |change )/.test(t)) return "#dc2626";
    if (/^(show|pause|on start|forever)/.test(t)) return "#1d4ed8";
    return "#475569";
  }

  var SHOW_ICON = {
    "Gallery walk": "🖼️", "Predict and Run": "🤔", "Human micro:bit": "🧍", "Class vote": "✋",
    "Bug swap": "🐞", "One-minute demo": "⏱️", "Simple test": "✅"
  };

  function store(k, v) {
    try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var g = parseInt(document.body.getAttribute("data-grade"), 10);
    var host = document.getElementById("weeks");
    if (!host || !window.WEEKS || !window.WEEKS[g]) return;
    var now = currentWeek();
    var key = "wzfs-primary-g" + g;
    var self = store(key) || {};

    window.WEEKS[g].forEach(function (w) {
      var card = document.createElement("article");
      card.className = "week" + (w.week === now ? " now" : "") + (w.check ? " check" : "");
      card.id = "week-" + w.week;
      var chips = w.blocks.map(function (b) {
        return '<span class="chip" style="background:' + chipColour(b, g) + '">' + esc(b) + "</span>";
      }).join("");
      card.innerHTML =
        '<div class="wk-head"><span class="wk-num">Week ' + w.week + '</span><span class="wk-date">' + range(w.week) + "</span>" +
        (w.week === now ? '<span class="badge now">⭐ THIS WEEK</span>' : "") +
        (w.check ? '<span class="badge check">✅ CHECK WEEK</span>' : "") + "</div>" +
        '<div class="wk-body">' +
          '<div><h3 class="wk-title">' + esc(w.task) + '</h3><span class="concept">' + esc(w.concept) + "</span></div>" +
          '<ol class="three">' + w.steps.map(function (s, i) { return "<li><b>" + (i + 1) + "</b><span>" + esc(s) + "</span></li>"; }).join("") + "</ol>" +
          '<div><div class="lbl">Blocks</div><div class="chips">' + chips + "</div></div>" +
          '<div class="say">' + esc(w.stem) + "</div>" +
          '<div class="row2">' +
            '<div class="mini show"><div class="lbl">Show time</div>' + (SHOW_ICON[w.showcase] || "⭐") + " " + esc(w.showcase) + "</div>" +
            '<div class="mini bible"><div class="lbl">' + esc(w.ref) + "</div>" + esc(w.verse) + "</div>" +
          "</div>" +
          '<div class="self" role="group" aria-label="How did I do?">' +
            '<button type="button" data-v="got">😀 Got it</button><button type="button" data-v="nearly">🙂 Nearly</button><button type="button" data-v="not">😟 Not yet</button>' +
          "</div>" +
        "</div>";
      var btns = card.querySelectorAll(".self button");
      function paint() { btns.forEach(function (b) { b.classList.toggle("on", self[w.week] === b.getAttribute("data-v")); }); }
      btns.forEach(function (b) {
        b.addEventListener("click", function () {
          var v = b.getAttribute("data-v");
          self[w.week] = self[w.week] === v ? null : v;
          store(key, self); paint();
        });
      });
      paint();
      host.appendChild(card);
    });

    var go = document.getElementById("go-now");
    if (go) {
      if (now) go.addEventListener("click", function () { document.getElementById("week-" + now).scrollIntoView(); });
      else go.style.display = "none";
    }
    var label = document.getElementById("now-label");
    if (label) label.textContent = now ? "This is Week " + now + " (" + range(now) + ")." : "Semester 1 runs from 31 Aug 2026 to 14 Jan 2027.";
  });
})();
