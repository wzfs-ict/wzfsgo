/* Study guides: self-check (Got it / Nearly / Revise) saved per browser, and glossary search */
(function () {
  "use strict";
  function load(k) { try { return JSON.parse(localStorage.getItem("wzfs-sg:" + k) || "{}"); } catch (e) { return {}; } }
  function save(k, v) { try { localStorage.setItem("wzfs-sg:" + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  document.querySelectorAll("table.selfcheck").forEach(function (t) {
    var key = t.getAttribute("data-key"), state = load(key), sum = document.getElementById(key + "-sum");
    function paint() {
      var c = { got: 0, nearly: 0, revise: 0 }, rows = t.querySelectorAll("tbody tr");
      rows.forEach(function (tr) {
        var v = state[tr.getAttribute("data-i")];
        tr.className = v || "";
        tr.querySelectorAll("input").forEach(function (r) { r.checked = r.value === v; });
        if (v) c[v]++;
      });
      if (sum) sum.textContent = "😀 Got it: " + c.got + " · 🙂 Nearly: " + c.nearly + " · 📖 Revise: " + c.revise + " · Not ticked: " + (rows.length - c.got - c.nearly - c.revise);
    }
    t.addEventListener("change", function (e) {
      var tr = e.target.closest("tr"); if (!tr) return;
      state[tr.getAttribute("data-i")] = e.target.value; save(key, state); paint();
    });
    paint();
  });
  document.querySelectorAll(".gfilter").forEach(function (inp) {
    var sec = inp.closest("section");
    inp.addEventListener("input", function () {
      var q = inp.value.trim().toLowerCase();
      sec.querySelectorAll(".gloss tbody tr").forEach(function (tr) { tr.style.display = !q || tr.textContent.toLowerCase().indexOf(q) >= 0 ? "" : "none"; });
    });
  });
})();
