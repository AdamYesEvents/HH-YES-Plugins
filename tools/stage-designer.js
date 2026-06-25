/*!
 * HireHop Tool: Stage Designer
 * Loaded by loader.js (window.HHTools.register).
 * Dialog: pick metric/imperial + width + depth, pack the area with the largest
 * deck panels first (rotating to fit), show the kit list + a top-down grid, and
 * "Add stage kit" inserts the decks into the job under a "Stage WxD" folder.
 * Deck catalogue + part numbers come from data/stage-designer/decks.json.
 * Legs, fascia, trim and carpet come later.
 *
 * Version: 0.3.1
 */

(function () {

  // ===========================================================================
  // PURE LOGIC (also exported for Node tests at the bottom)
  // ===========================================================================

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

  function fillFor(deckId) {
    var map = {
      "deck-2x1m": "#534AB7", "deck-1x1m": "#7F77DD", "deck-2x05m": "#AFA9EC",
      "deck-1x05m": "#CECBF6", "deck-05x05m": "#EEEDFE",
      "deck-8x4ft": "#534AB7", "deck-4x4ft": "#7F77DD"
    };
    return map[deckId] || "#7F77DD";
  }

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

  function isRealPart(pn) { return typeof pn === "string" && pn.trim() !== "" && !/^TBD/i.test(pn.trim()); }

  // ===========================================================================
  // NODE EXPORT (no-op in the browser)
  // ===========================================================================
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { packStage: packStage, buildGridSvg: buildGridSvg, fillFor: fillFor, isRealPart: isRealPart };
  }

  // ===========================================================================
  // BROWSER: catalogue load + dialog + insertion + registration
  // ===========================================================================
  if (typeof window === "undefined") return;

  var REPO = "AdamYesEvents/HH-YES-Plugins";
  var DATA_REF = "main";
  var DATA_URL = "https://cdn.jsdelivr.net/gh/" + REPO + "@" + DATA_REF + "/data/stage-designer/decks.json";
  var catalogue = null;

  function loadCatalogue(cb) {
    if (catalogue) { cb(catalogue); return; }
    // Cache-bust: jsDelivr edge-caches @main, so without this the catalogue can
    // serve stale part numbers. A unique query fetches the current decks.json.
    fetch(DATA_URL + "?t=" + Date.now()).then(function (r) { return r.json(); })
      .then(function (j) { catalogue = j; cb(j); })
      .catch(function () { cb(null); });
  }

  // ---- HireHop insertion helpers (Route B: resolve -> heading -> batch save) --

  function resolvePart(inst, partNumber, qty) {
    var params = {
      id: "sd_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      qty: qty, part_number: partNumber,
      job_id: inst.options.doc_type == 1 ? inst.options.main_id : 0,
      package_id: 0, no_availability: 0,
      price_group: parseInt(inst.options.job_data.PRICE_GROUP) || 0
    };
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch("/php_functions/items_get_part_number_details.php?" + qs).then(function (r) { return r.json(); });
  }

  function headingIdSet(inst) {
    var ids = {}, tree = inst.items_to_supply_tree.jstree(true);
    (tree.get_json("#", { flat: true }) || []).forEach(function (n) { if (n.data && n.data.kind == 0) ids[n.data.ID] = true; });
    return ids;
  }

  // Create a heading at top level and resolve with its new ID (or null).
  function createHeading(inst, title) {
    var before = headingIdSet(inst);
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all();
    inst.new_item(0);
    inst.heading_name.val(title);
    inst.save_item();
    return new Promise(function (resolve) {
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        var now = headingIdSet(inst);
        var newId = Object.keys(now).filter(function (id) { return !before[id]; })[0];
        if (newId) { clearInterval(iv); resolve(parseInt(newId)); }
        else if (tries > 50) { clearInterval(iv); resolve(null); }
      }, 150);
    });
  }

  // Resolve all kit parts, create the folder, insert the decks under it.
  function addStageKit(inst, items, title, onDone) {
    // resolve sequentially
    var shopping = {}, errors = [];
    var chain = Promise.resolve();
    items.forEach(function (it) {
      chain = chain.then(function () {
        return resolvePart(inst, it.partNumber, it.qty).then(function (d) {
          if (!d || typeof d.error !== "undefined") errors.push(it.label);
          else { var key = (d.TYPE == 1 ? "a" : "b") + d.ID; shopping[key] = (shopping[key] || 0) + it.qty; }
        }, function () { errors.push(it.label); });
      });
    });
    chain.then(function () {
      if (errors.length) { onDone({ ok: false, error: "Could not look up: " + errors.join(", ") }); return; }
      createHeading(inst, title).then(function (headingId) {
        if (!headingId) { onDone({ ok: false, error: "Could not create the stage folder" }); return; }
        inst.set_item_edit_tree_headings();
        var tree = inst.items_to_supply_tree.jstree(true);
        tree.deselect_all(); tree.select_node("a" + headingId); inst.set_parent_vals(true);
        if (inst.picklist_heading.val() != headingId) { onDone({ ok: false, error: "Could not target the stage folder" }); return; }
        inst.save_items_list(shopping);
        onDone({ ok: true, headingId: headingId });
      });
    });
  }

  // ---- dialog ----------------------------------------------------------------

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

      var backdrop = el("div", { id: DIALOG_ID }, "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;");
      var panel = el("div", null, "background:#fff;border-radius:8px;width:760px;max-width:95vw;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);");
      backdrop.appendChild(panel);
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
      function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

      var head = el("div", null, "padding:18px 22px;border-bottom:1px solid #eee;");
      head.innerHTML = '<div style="font-size:18px;font-weight:600;color:#222;">Stage Designer</div>' +
        '<div style="font-size:13px;color:#777;margin-top:2px;">Generate a stage deck kit and add it to this job.</div>';
      panel.appendChild(head);

      var body = el("div", null, "display:flex;gap:20px;padding:22px;");
      var left = el("div", null, "flex:1;min-width:300px;display:flex;align-items:flex-start;justify-content:center;");
      var right = el("div", null, "width:300px;");
      body.appendChild(left); body.appendChild(right);
      panel.appendChild(body);

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

      var foot = el("div", null, "padding:14px 22px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;align-items:center;");
      panel.appendChild(foot);

      var state = { result: null, unit: "", title: "", items: [] };

      function applySystemBounds() {
        var c = cat.systems[sysSel.value];
        [wIn, dIn].forEach(function (i) { i.step = c.increment; i.min = c.min; i.max = c.max; });
        function snap(v, fallback) {
          if (isNaN(v)) v = fallback;
          var s = Math.round(v / c.increment) * c.increment;
          return Math.max(c.min, Math.min(c.max, +s.toFixed(3)));
        }
        wIn.value = snap(parseFloat(wIn.value), 4);
        dIn.value = snap(parseFloat(dIn.value), 3);
      }

      function render() {
        var c = cat.systems[sysSel.value];
        var res = packStage({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), decks: cat.decks, systems: cat.systems });
        state.result = res; state.unit = c.unit;
        if (!res.ok) {
          left.innerHTML = "";
          kitBox.innerHTML = '<div style="color:#b00;font-size:13px;">' + res.error + '</div>';
          renderFooter(false, "");
          return;
        }
        left.innerHTML = buildGridSvg(res, parseFloat(wIn.value), parseFloat(dIn.value));
        // map kit -> items with part numbers
        state.items = res.kit.map(function (k) {
          var deck = cat.decks.filter(function (d) { return d.id === k.deckId; })[0];
          return { label: k.label, partNumber: deck ? deck.partNumber : null, qty: k.qty };
        });
        var missing = state.items.filter(function (it) { return !isRealPart(it.partNumber); });
        state.title = "Stage " + (+parseFloat(wIn.value)) + "x" + (+parseFloat(dIn.value)) + c.unit;

        var rowsHtml = res.kit.map(function (k) {
          return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;">' +
            '<span style="color:#333;">' + k.label + '</span><span style="color:#111;font-weight:500;">x ' + k.qty + '</span></div>';
        }).join("");
        kitBox.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated decks</div>' +
          rowsHtml + '<div style="margin-top:8px;font-size:12px;color:#777;">' + res.totals.panels + ' panels &middot; ' + res.totals.areaCovered + ' ' + c.unit + '&sup2;</div>' +
          (missing.length ? '<div style="margin-top:8px;font-size:12px;color:#b07b00;">No part number yet for: ' + missing.map(function (m) { return m.label; }).join(", ") + '</div>' : "");

        renderFooter(missing.length === 0, missing.length ? "Some panels have no part number" : "");
      }

      function renderFooter(canAdd, disabledReason) {
        foot.innerHTML = "";
        var cancel = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
        cancel.textContent = "Close"; cancel.addEventListener("click", close);
        var add = el("button", canAdd ? null : { disabled: "disabled", title: disabledReason },
          "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:" + (canAdd ? "pointer" : "not-allowed") + ";opacity:" + (canAdd ? "1" : ".5") + ";");
        add.textContent = "Add stage kit";
        if (canAdd) add.addEventListener("click", confirmAdd);
        foot.appendChild(cancel); foot.appendChild(add);
      }

      function confirmAdd() {
        foot.innerHTML = "";
        var msg = el("div", null, "flex:1;font-size:13px;color:#333;");
        msg.textContent = "Add " + state.result.totals.panels + " panels to a '" + state.title + "' folder?";
        var no = el("button", null, "padding:8px 14px;font-size:14px;cursor:pointer;");
        no.textContent = "Cancel"; no.addEventListener("click", render);
        var yes = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
        yes.textContent = "Confirm add"; yes.addEventListener("click", doAdd);
        foot.appendChild(msg); foot.appendChild(no); foot.appendChild(yes);
      }

      function doAdd() {
        foot.innerHTML = '<div style="flex:1;font-size:13px;color:#555;">Adding to the job…</div>';
        addStageKit(inst, state.items, state.title, function (r) {
          if (r.ok) { close(); }
          else {
            foot.innerHTML = "";
            var err = el("div", null, "flex:1;font-size:13px;color:#b00;");
            err.textContent = r.error;
            var back = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
            back.textContent = "Back"; back.addEventListener("click", render);
            foot.appendChild(err); foot.appendChild(back);
          }
        });
      }

      sysSel.addEventListener("change", function () { applySystemBounds(); render(); });
      wIn.addEventListener("input", render);
      dIn.addEventListener("input", render);

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
    loadCatalogue(function () {});
  }

  register();

})();
