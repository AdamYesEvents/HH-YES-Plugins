/*!
 * HireHop Tool: Stage Designer
 * Loaded by loader.js (window.HHTools.register).
 * Opens a dialog to generate a stage deck kit list from width x depth, packing
 * the area with the largest deck panels first (rotating to fit). Deck catalogue
 * + part numbers come from data/stage-designer/decks.json.
 * Legs, fascia, trim, carpet and "add to job" come later.
 *
 * Version: 0.2.1
 */

(function () {

  // ===========================================================================
  // PURE LOGIC (also exported for Node tests at the bottom)
  // ===========================================================================

  // Pack a width x depth stage with deck panels, largest-first, rotation allowed.
  function packStage(opts) {
    var system = opts.system, width = opts.width, depth = opts.depth;
    var decks = opts.decks, systems = opts.systems;

    var cfg = systems && systems[system];
    if (!cfg) return { ok: false, error: "Unknown system: " + system };
    var inc = cfg.increment;

    function isMultiple(v) { var q = v / inc; return Math.abs(q - Math.round(q)) < 1e-9; }
    if (typeof width !== "number" || typeof depth !== "number" || isNaN(width) || isNaN(depth))
      return { ok: false, error: "Enter a width and depth" };
    if (!isMultiple(width)) return { ok: false, error: "Width must be a multiple of " + inc + " " + cfg.unit };
    if (!isMultiple(depth)) return { ok: false, error: "Depth must be a multiple of " + inc + " " + cfg.unit };
    if (width < cfg.min || width > cfg.max) return { ok: false, error: "Width must be between " + cfg.min + " and " + cfg.max + " " + cfg.unit };
    if (depth < cfg.min || depth > cfg.max) return { ok: false, error: "Depth must be between " + cfg.min + " and " + cfg.max + " " + cfg.unit };

    var cols = Math.round(width / inc), rows = Math.round(depth / inc);
    var pal = decks.filter(function (d) { return d.system === system; });

    var pieces = pal.map(function (d) {
      var cw = Math.round(d.width / inc), ch = Math.round(d.depth / inc);
      var orients = [{ cw: cw, ch: ch, pw: d.width, pd: d.depth, rotated: false }];
      if (cw !== ch) orients.push({ cw: ch, ch: cw, pw: d.depth, pd: d.width, rotated: true });
      return { id: d.id, orients: orients };
    });

    var grid = [];
    for (var r = 0; r < rows; r++) grid.push(new Array(cols).fill(false));
    function fits(r, c, cw, ch) {
      if (c + cw > cols || r + ch > rows) return false;
      for (var rr = r; rr < r + ch; rr++) for (var cc = c; cc < c + cw; cc++) if (grid[rr][cc]) return false;
      return true;
    }
    function fill(r, c, cw, ch) {
      for (var rr = r; rr < r + ch; rr++) for (var cc = c; cc < c + cw; cc++) grid[rr][cc] = true;
    }

    var placements = [];
    for (var r2 = 0; r2 < rows; r2++) {
      for (var c2 = 0; c2 < cols; c2++) {
        if (grid[r2][c2]) continue;
        var placed = false;
        for (var pi = 0; pi < pieces.length && !placed; pi++) {
          for (var oi = 0; oi < pieces[pi].orients.length && !placed; oi++) {
            var o = pieces[pi].orients[oi];
            if (fits(r2, c2, o.cw, o.ch)) {
              fill(r2, c2, o.cw, o.ch);
              placements.push({ deckId: pieces[pi].id, x: +(c2 * inc).toFixed(3), y: +(r2 * inc).toFixed(3), width: o.pw, depth: o.pd, rotated: o.rotated });
              placed = true;
            }
          }
        }
        if (!placed) return { ok: false, error: "No panel small enough to fill the stage" };
      }
    }

    var kit = pal.map(function (d) {
      var qty = placements.filter(function (pl) { return pl.deckId === d.id; }).length;
      return { deckId: d.id, label: d.label, partNumber: d.partNumber, qty: qty };
    }).filter(function (k) { return k.qty > 0; });

    return { ok: true, placements: placements, kit: kit, totals: { panels: placements.length, areaCovered: +(width * depth).toFixed(3) } };
  }

  // Shade by panel size (largest = darkest) — purple ramp.
  function fillFor(deckId) {
    var map = {
      "deck-2x1m": "#534AB7", "deck-1x1m": "#7F77DD", "deck-2x05m": "#AFA9EC",
      "deck-1x05m": "#CECBF6", "deck-05x05m": "#EEEDFE",
      "deck-8x4ft": "#534AB7", "deck-4x4ft": "#7F77DD"
    };
    return map[deckId] || "#7F77DD";
  }

  // Build a top-down SVG of the packed stage. Pure -> returns an SVG string.
  function buildGridSvg(result, width, depth) {
    if (!result || !result.ok) return "";
    var maxW = 340, maxH = 240, pad = 1;
    var scale = Math.min(maxW / width, maxH / depth);
    var W = width * scale, H = depth * scale;
    var rects = result.placements.map(function (p) {
      return '<rect x="' + (p.x * scale + pad) + '" y="' + (p.y * scale + pad) +
        '" width="' + (p.width * scale - pad * 2) + '" height="' + (p.depth * scale - pad * 2) +
        '" fill="' + fillFor(p.deckId) + '" stroke="#26215C" stroke-width="1"/>';
    }).join("");
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">' +
      rects + '<rect x="0.5" y="0.5" width="' + (W - 1) + '" height="' + (H - 1) + '" fill="none" stroke="#26215C" stroke-width="2"/></svg>';
  }

  // ===========================================================================
  // NODE EXPORT (no-op in the browser)
  // ===========================================================================
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { packStage: packStage, buildGridSvg: buildGridSvg, fillFor: fillFor };
  }

  // ===========================================================================
  // BROWSER: catalogue load + dialog + registration
  // ===========================================================================
  if (typeof window === "undefined") return;

  var REPO = "AdamYesEvents/HH-YES-Plugins";
  var DATA_REF = "main"; // git ref for the deck catalogue (pin to a tag for stability)
  var DATA_URL = "https://cdn.jsdelivr.net/gh/" + REPO + "@" + DATA_REF + "/data/stage-designer/decks.json";
  var catalogue = null;

  function loadCatalogue(cb) {
    if (catalogue) { cb(catalogue); return; }
    fetch(DATA_URL).then(function (r) { return r.json(); })
      .then(function (j) { catalogue = j; cb(j); })
      .catch(function () { cb(null); });
  }

  var DIALOG_ID = "hh-stage-designer-dialog";

  function el(tag, attrs, css) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (css) n.style.cssText = css;
    return n;
  }

  function openDialog(inst) {
    loadCatalogue(function (cat) {
      var existing = document.getElementById(DIALOG_ID);
      if (existing) existing.parentNode.removeChild(existing);
      if (!cat) { window.alert("Stage Designer: could not load the deck catalogue."); return; }

      var backdrop = el("div", { id: DIALOG_ID },
        "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;");
      var panel = el("div", null,
        "background:#fff;border-radius:8px;width:760px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);");
      backdrop.appendChild(panel);
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
      function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

      // header
      var head = el("div", null, "padding:18px 22px;border-bottom:1px solid #eee;");
      head.innerHTML = '<div style="font-size:18px;font-weight:600;color:#222;">Stage Designer</div>' +
        '<div style="font-size:13px;color:#777;margin-top:2px;">Generate a stage deck kit from width and depth.</div>';
      panel.appendChild(head);

      // body: grid (left) + controls/kit (right)
      var body = el("div", null, "display:flex;gap:20px;padding:22px;");
      var left = el("div", null, "flex:1;min-width:300px;display:flex;align-items:flex-start;justify-content:center;");
      var right = el("div", null, "width:300px;");
      body.appendChild(left); body.appendChild(right);
      panel.appendChild(body);

      // controls
      var systems = Object.keys(cat.systems);
      function field(label) { var w = el("div", null, "margin-bottom:14px;"); w.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>'; return w; }

      var sysWrap = field("System");
      var sysSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      systems.forEach(function (s) { var o = el("option"); o.value = s; o.textContent = s.charAt(0).toUpperCase() + s.slice(1); sysSel.appendChild(o); });
      sysWrap.appendChild(sysSel); right.appendChild(sysWrap);

      var wWrap = field("Width"); var wIn = el("input", { type: "number" }, "width:100%;padding:8px;font-size:14px;"); wWrap.appendChild(wIn); right.appendChild(wWrap);
      var dWrap = field("Depth"); var dIn = el("input", { type: "number" }, "width:100%;padding:8px;font-size:14px;"); dWrap.appendChild(dIn); right.appendChild(dWrap);

      var kitBox = el("div", null, "margin-top:6px;border-top:1px solid #eee;padding-top:12px;");
      right.appendChild(kitBox);

      function applySystemBounds() {
        var c = cat.systems[sysSel.value];
        [wIn, dIn].forEach(function (i) { i.step = c.increment; i.min = c.min; i.max = c.max; });
        // Snap current values to this system's increment and clamp to its range,
        // so switching metric<->imperial always leaves a valid width/depth.
        function snap(v, fallback) {
          if (isNaN(v)) v = fallback;
          var s = Math.round(v / c.increment) * c.increment;
          return Math.max(c.min, Math.min(c.max, +s.toFixed(3)));
        }
        wIn.value = snap(parseFloat(wIn.value), 4);
        dIn.value = snap(parseFloat(dIn.value), 3);
      }

      function render() {
        var res = packStage({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), decks: cat.decks, systems: cat.systems });
        if (!res.ok) {
          left.innerHTML = "";
          kitBox.innerHTML = '<div style="color:#b00;font-size:13px;">' + res.error + '</div>';
          return;
        }
        var unit = cat.systems[sysSel.value].unit;
        left.innerHTML = buildGridSvg(res, parseFloat(wIn.value), parseFloat(dIn.value));
        var rowsHtml = res.kit.map(function (k) {
          return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;">' +
            '<span style="color:#333;">' + k.label + '</span>' +
            '<span style="color:#111;font-weight:500;">x ' + k.qty + '</span></div>';
        }).join("");
        kitBox.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated decks</div>' +
          rowsHtml +
          '<div style="margin-top:8px;font-size:12px;color:#777;">' + res.totals.panels + ' panels &middot; ' + res.totals.areaCovered + ' ' + unit + '&sup2;</div>';
      }

      sysSel.addEventListener("change", function () { applySystemBounds(); render(); });
      wIn.addEventListener("input", render);
      dIn.addEventListener("input", render);

      // footer
      var foot = el("div", null, "padding:14px 22px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;");
      var cancel = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
      cancel.textContent = "Close"; cancel.addEventListener("click", close);
      var add = el("button", { disabled: "disabled", title: "Insertion into the job comes in a later version" },
        "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;opacity:.5;cursor:not-allowed;");
      add.textContent = "Add stage kit";
      foot.appendChild(cancel); foot.appendChild(add);
      panel.appendChild(foot);

      document.body.appendChild(backdrop);
      applySystemBounds();
      render();
    });
  }

  function register() {
    if (!window.HHTools || !window.HHTools.register) { setTimeout(register, 50); return; }
    window.HHTools.register({
      id: "stage-designer",
      label: "Stage Designer",
      icon: "ui-icon-image",
      onClick: function (inst) { openDialog(inst); }
    });
    loadCatalogue(function () {}); // warm the catalogue cache
  }

  register();

})();
