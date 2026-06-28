/*!
 * HireHop Tool: Stage Designer
 * Loaded by loader.js (window.HHTools.register).
 * Dialog: pick metric/imperial + width + depth + height, pack the area with the
 * largest deck panels first (rotating to fit), add deck legs (panels x legsPerDeck
 * of the chosen height), show the kit + a top-down grid, and "Add stage kit"
 * inserts everything into the job under a "Stage WxD height" folder.
 * Catalogue: data/stage-designer/decks.json + legs.json.
 * Fascia, trim and carpet come later (fascia will match the chosen height).
 *
 * Version: 0.9.0
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

  // Top-down preview: deck panels filled, plus fascia boards drawn just outside
  // the stage edges (teal = standard, coral = corner). fascia = placements array.
  function buildGridSvg(result, width, depth, fascia) {
    if (!result || !result.ok) return "";
    var maxW = 320, maxH = 220, pad = 1, m = 14, ft = 7;
    var scale = Math.min(maxW / width, maxH / depth);
    var W = width * scale, H = depth * scale, ox = m, oy = m;
    var deckRects = result.placements.map(function (p) {
      return '<rect x="' + (ox + p.x * scale + pad) + '" y="' + (oy + p.y * scale + pad) +
        '" width="' + (p.width * scale - pad * 2) + '" height="' + (p.depth * scale - pad * 2) +
        '" fill="' + fillFor(p.deckId) + '" stroke="#26215C" stroke-width="1"/>';
    }).join("");
    var fasciaRects = (fascia || []).map(function (b) {
      var col = b.type === "corner" ? "#D85A30" : "#1D9E75";
      var o1 = b.offset * scale, ln = b.length * scale, x, y, w, h;
      if (b.edge === "front") { x = ox + o1; y = oy + H + 2; w = ln; h = ft; }
      else if (b.edge === "back") { x = ox + o1; y = oy - 2 - ft; w = ln; h = ft; }
      else if (b.edge === "left") { x = ox - 2 - ft; y = oy + o1; w = ft; h = ln; }
      else { x = ox + W + 2; y = oy + o1; w = ft; h = ln; }
      return '<rect x="' + x + '" y="' + y + '" width="' + (w - 1) + '" height="' + (h - 1) + '" fill="' + col + '"/>';
    }).join("");
    var SW = W + 2 * m, SH = H + 2 * m;
    return '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" xmlns="http://www.w3.org/2000/svg">' +
      deckRects + fasciaRects +
      '<rect x="' + (ox + 0.5) + '" y="' + (oy + 0.5) + '" width="' + (W - 1) + '" height="' + (H - 1) + '" fill="none" stroke="#26215C" stroke-width="2"/></svg>';
  }

  function isRealPart(pn) { return typeof pn === "string" && pn.trim() !== "" && !/^TBD/i.test(pn.trim()); }

  // Legs required for a packed stage: panels x legsPerDeck. Returns 0 if no leg.
  function legCount(result, legsPerDeck) {
    if (!result || !result.ok) return 0;
    return result.totals.panels * (legsPerDeck || 0);
  }

  // Tile a run of length L from board lengths (descending) using the FEWEST
  // boards; among fewest-board options prefer no 0.5 m slivers, then uniform,
  // then larger boards; arranged symmetrically (palindrome) when the chosen
  // multiset allows. 3->[1.5,1.5], 4->[2,2], 4.5->[1.5,1.5,1.5], 3.5->[2,1.5],
  // 5->[2,1,2], 2.5->[1.5,1].
  function symTile(L, lens) {
    var u = 0.5, M = Math.round(L / u);
    if (M <= 0) return [];
    var pcs = lens.map(function (l) { return Math.round(l / u); }).filter(function (p) { return p > 0; }).sort(function (a, b) { return b - a; });
    var INF = 1e9, dp = []; for (var d = 0; d <= M; d++) dp[d] = INF; dp[0] = 0;
    for (var i = 1; i <= M; i++) for (var pi = 0; pi < pcs.length; pi++) { var p = pcs[pi]; if (p <= i && dp[i - p] + 1 < dp[i]) dp[i] = dp[i - p] + 1; }
    if (dp[M] >= INF) return [L];
    var minCount = dp[M], n = pcs.length, oneIdx = pcs.indexOf(1), best = null;
    function consider(counts) {
      if (!best) { best = counts.slice(); return; }
      var cs = oneIdx >= 0 ? counts[oneIdx] : 0, bs = oneIdx >= 0 ? best[oneIdx] : 0;
      if (cs !== bs) { if (cs < bs) best = counts.slice(); return; }
      var cd = counts.filter(function (x) { return x > 0; }).length, bd = best.filter(function (x) { return x > 0; }).length;
      if (cd !== bd) { if (cd < bd) best = counts.slice(); return; }
      for (var k = 0; k < n; k++) if (counts[k] !== best[k]) { if (counts[k] > best[k]) best = counts.slice(); return; }
    }
    var counts = []; for (var z = 0; z < n; z++) counts[z] = 0;
    (function rec(idx, remC, remS) {
      if (idx === n) { if (remC === 0 && remS === 0) consider(counts); return; }
      for (var c = 0; c <= remC && c * pcs[idx] <= remS; c++) { counts[idx] = c; rec(idx + 1, remC - c, remS - c * pcs[idx]); }
      counts[idx] = 0;
    })(0, minCount, M);
    var ms = []; for (var k2 = 0; k2 < n; k2++) for (var c2 = 0; c2 < best[k2]; c2++) ms.push(pcs[k2]);
    var cnt = {}; ms.forEach(function (x) { cnt[x] = (cnt[x] || 0) + 1; });
    var odds = Object.keys(cnt).filter(function (k) { return cnt[k] % 2 === 1; });
    var arr;
    if (odds.length > 1) { arr = ms.slice().sort(function (a, b) { return b - a; }); }
    else {
      var sizes = Object.keys(cnt).map(Number).sort(function (a, b) { return b - a; });
      var half = [], center = null;
      sizes.forEach(function (s) { var c = cnt[s]; if (c % 2 === 1) { center = s; c--; } for (var h = 0; h < c / 2; h++) half.push(s); });
      arr = half.concat(center != null ? [center] : []).concat(half.slice().reverse());
    }
    return arr.map(function (x) { return x * u; });
  }

  // Fascia for a fasciad stage. o = { system,width,depth,sides(0/2/3/4),height,finish,fascia }
  // Origin top-left, back (top) open. Corner boards sit on the FRONT (and back)
  // edges at their corner ends; side edges are all standard. All edges tile with
  // symTile (fewest boards, symmetric where possible).
  // Returns { available, items:[{label,partNumber,qty}], placements:[{edge,offset,length,type}] }.
  function fasciaKit(o) {
    var fascia = o.fascia || {};
    var boards = fascia.boards || [], mounts = fascia.mounts || [];
    if (!o.sides) return { available: true, items: [], placements: [] };

    var avail = boards.filter(function (b) { return b.system === o.system && b.height === o.height && b.finish === o.finish; })
      .sort(function (a, b) { return b.len - a.len; });
    if (!avail.length) return { available: false, items: [], placements: [] };
    var lengths = avail.map(function (b) { return b.len; });
    var mountLens = mounts.filter(function (m) { return m.system === o.system; }).sort(function (a, b) { return b.len - a.len; });

    var W = o.width, D = o.depth, s = o.sides;
    var hasFront = s >= 2, hasLeft = s >= 2, hasRight = s >= 3, hasBack = s >= 4;
    var edges = [];
    if (hasFront) edges.push({ edge: "front", len: W, cFirst: hasLeft, cLast: hasRight });
    if (hasBack) edges.push({ edge: "back", len: W, cFirst: hasLeft, cLast: hasRight });
    if (hasLeft) edges.push({ edge: "left", len: D, cFirst: false, cLast: false });
    if (hasRight) edges.push({ edge: "right", len: D, cFirst: false, cLast: false });

    var agg = {}, placements = [];
    function add(code, label) { if (!agg[code]) agg[code] = { label: label, partNumber: code, qty: 0 }; agg[code].qty++; }

    edges.forEach(function (e) {
      var pieces = symTile(e.len, lengths), offset = 0;
      pieces.forEach(function (plen, idx) {
        var isCorner = (idx === 0 && e.cFirst) || (idx === pieces.length - 1 && e.cLast);
        var board = avail.filter(function (b) { return Math.abs(b.len - plen) < 1e-9; })[0];
        add(isCorner ? board.corner : board.standard, plen + "m fascia (" + (isCorner ? "corner" : "standard") + ")");
        placements.push({ edge: e.edge, offset: offset, length: plen, type: isCorner ? "corner" : "standard" });
        offset += plen;
      });
      var rem = e.len;
      mountLens.forEach(function (m) { while (rem >= m.len - 1e-9) { add(m.partNumber, m.len + "m fascia mount"); rem -= m.len; } });
    });
    return { available: true, items: Object.keys(agg).map(function (k) { return agg[k]; }), placements: placements };
  }

  // ===========================================================================
  // NODE EXPORT (no-op in the browser)
  // ===========================================================================
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { packStage: packStage, buildGridSvg: buildGridSvg, fillFor: fillFor, isRealPart: isRealPart, legCount: legCount, fasciaKit: fasciaKit, symTile: symTile };
  }

  // ===========================================================================
  // BROWSER: catalogue load + dialog + insertion + registration
  // ===========================================================================
  if (typeof window === "undefined") return;

  var REPO = "AdamYesEvents/HH-YES-Plugins";
  var DATA_REF = "main";
  var BASE = "https://cdn.jsdelivr.net/gh/" + REPO + "@" + DATA_REF + "/data/stage-designer/";
  var catalogue = null;

  function getJson(file) {
    // Cache-bust: jsDelivr edge-caches @main, so a unique query fetches current data.
    return fetch(BASE + file + "?t=" + Date.now()).then(function (r) { return r.json(); });
  }

  function loadCatalogue(cb) {
    if (catalogue) { cb(catalogue); return; }
    Promise.all([
      getJson("decks.json"),
      getJson("legs.json").catch(function () { return { legs: [], legsPerDeck: 4 }; }),
      getJson("fascia.json").catch(function () { return { boards: [], mounts: [] }; })
    ]).then(function (res) {
      catalogue = {
        systems: res[0].systems, decks: res[0].decks,
        legs: res[1].legs || [], legsPerDeck: res[1].legsPerDeck || 4,
        fascia: { boards: (res[2].boards || []), mounts: (res[2].mounts || []) }
      };
      cb(catalogue);
    }).catch(function () { cb(null); });
  }

  // ---- HireHop insertion helpers (resolve -> heading -> batch save) -----------

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

  // Insert each unresolved item as a custom (free-text) line under the heading,
  // one at a time. Name is "[partNumber] label" for easy find/replace later.
  function insertCustoms(inst, headingId, customs, done) {
    var tree = inst.items_to_supply_tree.jstree(true), i = 0;
    (function next() {
      if (i >= customs.length) { done(); return; }
      var it = customs[i++];
      tree.deselect_all(); tree.select_node("a" + headingId);
      inst.new_item(3);
      inst.custom_name.val("[" + it.partNumber + "] " + it.label);
      inst.priced_edit.find("[name='qty']").val(it.qty);
      inst.save_item();
      setTimeout(next, 1800);
    })();
  }

  // Resolve each kit part, create the folder, then insert resolved parts as a
  // batch and any unresolved codes as custom lines (so a kit can be built even
  // before every stock code exists).
  function addStageKit(inst, items, title, onDone) {
    var shopping = {}, customs = [];
    var chain = Promise.resolve();
    items.forEach(function (it) {
      chain = chain.then(function () {
        return resolvePart(inst, it.partNumber, it.qty).then(function (d) {
          if (!d || typeof d.error !== "undefined") customs.push(it);
          else { var key = (d.TYPE == 1 ? "a" : "b") + d.ID; shopping[key] = (shopping[key] || 0) + it.qty; }
        }, function () { customs.push(it); });
      });
    });
    chain.then(function () {
      createHeading(inst, title).then(function (headingId) {
        if (!headingId) { onDone({ ok: false, error: "Could not create the stage folder" }); return; }
        var tree = inst.items_to_supply_tree.jstree(true);
        inst.set_item_edit_tree_headings();
        tree.deselect_all(); tree.select_node("a" + headingId); inst.set_parent_vals(true);
        function doCustoms() { insertCustoms(inst, headingId, customs, function () { onDone({ ok: true, headingId: headingId, parts: Object.keys(shopping).length, customs: customs.length }); }); }
        if (Object.keys(shopping).length && inst.picklist_heading.val() == headingId) {
          inst.save_items_list(shopping);
          setTimeout(doCustoms, 2600); // let the batch save + tree rebuild settle
        } else {
          doCustoms();
        }
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
      if (!cat) { window.alert("Stage Designer: could not load the catalogue."); return; }

      var backdrop = el("div", { id: DIALOG_ID }, "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;");
      var panel = el("div", null, "background:#fff;border-radius:8px;width:980px;max-width:96vw;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);");
      backdrop.appendChild(panel);
      backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
      function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

      var head = el("div", null, "padding:18px 22px;border-bottom:1px solid #eee;");
      head.innerHTML = '<div style="font-size:18px;font-weight:600;color:#222;">Stage Designer</div>' +
        '<div style="font-size:13px;color:#777;margin-top:2px;">Generate a stage deck + leg kit and add it to this job.</div>';
      panel.appendChild(head);

      var body = el("div", null, "display:flex;gap:24px;padding:22px;");
      var colPreview = el("div", null, "flex:1;min-width:320px;display:flex;align-items:flex-start;justify-content:center;");
      var colKit = el("div", null, "width:240px;flex-shrink:0;");
      var colControls = el("div", null, "width:220px;flex-shrink:0;");
      body.appendChild(colPreview); body.appendChild(colKit); body.appendChild(colControls);
      panel.appendChild(body);

      var systems = Object.keys(cat.systems);
      function field(label) { var w = el("div", null, "margin-bottom:14px;"); w.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>'; return w; }

      var sysWrap = field("System");
      var sysSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      systems.forEach(function (s) { var o = el("option"); o.value = s; o.textContent = s.charAt(0).toUpperCase() + s.slice(1); sysSel.appendChild(o); });
      sysWrap.appendChild(sysSel); colControls.appendChild(sysWrap);

      var wWrap = field("Width"); var wIn = el("input", { type: "number" }, "width:100%;padding:8px;font-size:14px;"); wWrap.appendChild(wIn); colControls.appendChild(wWrap);
      var dWrap = field("Depth"); var dIn = el("input", { type: "number" }, "width:100%;padding:8px;font-size:14px;"); dWrap.appendChild(dIn); colControls.appendChild(dWrap);
      var hWrap = field("Height"); var hSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); hWrap.appendChild(hSel); colControls.appendChild(hWrap);

      var faceWrap = field("Fascia sides"); var faceSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      [["0", "None"], ["2", "2 sided (left + front)"], ["3", "3 sided"], ["4", "4 sided"]].forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; faceSel.appendChild(op); });
      faceWrap.appendChild(faceSel); colControls.appendChild(faceWrap);

      var finishWrap = field("Fascia finish"); var finishSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); finishWrap.appendChild(finishSel); colControls.appendChild(finishWrap);

      var kitBox = el("div", null, "font-size:13px;");
      colKit.appendChild(kitBox);

      var foot = el("div", null, "padding:14px 22px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;align-items:center;");
      panel.appendChild(foot);

      var state = { result: null, unit: "", title: "", items: [] };

      function legsForSystem() { return cat.legs.filter(function (l) { return l.system === sysSel.value; }); }

      function populateHeights() {
        var legs = legsForSystem();
        hSel.innerHTML = "";
        if (!legs.length) { hWrap.style.display = "none"; return; }
        hWrap.style.display = "";
        legs.forEach(function (l) { var o = el("option"); o.value = l.id; o.textContent = l.height + "mm"; hSel.appendChild(o); });
      }

      function currentHeight() {
        var ls = legsForSystem();
        var l = ls.filter(function (x) { return x.id === hSel.value; })[0] || ls[0];
        return l ? l.height : null;
      }

      function populateFinishes() {
        var h = currentHeight();
        var finishes = [];
        (cat.fascia.boards || []).filter(function (b) { return b.system === sysSel.value && b.height === h; })
          .forEach(function (b) { if (finishes.indexOf(b.finish) < 0) finishes.push(b.finish); });
        finishSel.innerHTML = "";
        finishes.forEach(function (f) { var o = el("option"); o.value = f; o.textContent = f.charAt(0).toUpperCase() + f.slice(1); finishSel.appendChild(o); });
        finishWrap.style.display = finishes.length ? "" : "none";
      }

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
          colPreview.innerHTML = "";
          kitBox.innerHTML = '<div style="color:#b00;font-size:13px;">' + res.error + '</div>';
          renderFooter(false, "");
          return;
        }
        // decks
        var items = res.kit.map(function (k) {
          var deck = cat.decks.filter(function (d) { return d.id === k.deckId; })[0];
          return { label: k.label, partNumber: deck ? deck.partNumber : null, qty: k.qty };
        });
        var decksHtml = res.kit.map(function (k) {
          return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + k.label + '</span><span style="color:#111;font-weight:500;">x ' + k.qty + '</span></div>';
        }).join("");

        // legs
        var legs = legsForSystem();
        var leg = legs.filter(function (l) { return l.id === hSel.value; })[0] || legs[0];
        var legsHtml = "", heightLabel = "", heightVal = null;
        if (leg) {
          var legQty = legCount(res, cat.legsPerDeck);
          items.push({ label: leg.label, partNumber: leg.partNumber, qty: legQty });
          heightLabel = leg.height; heightVal = leg.height;
          legsHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Legs</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + leg.label + '</span><span style="color:#111;font-weight:500;">x ' + legQty + '</span></div>';
        }

        // fascia
        var sides = parseInt(faceSel.value) || 0;
        var fasciaHtml = "", fasciaFinish = "", fasciaPlacements = [];
        if (sides > 0 && heightVal != null) {
          var fk = fasciaKit({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), sides: sides, height: heightVal, finish: finishSel.value, fascia: cat.fascia });
          if (!fk.available) {
            fasciaHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Fascia</div>' +
              '<div style="font-size:12px;color:#b07b00;">No fascia at ' + heightVal + 'mm</div>';
          } else if (fk.items.length) {
            fk.items.forEach(function (it) { items.push(it); });
            fasciaFinish = finishSel.value;
            fasciaPlacements = fk.placements;
            fasciaHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Fascia (' + fasciaFinish + ')</div>' +
              fk.items.map(function (it) {
                return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>';
              }).join("");
          }
        }

        colPreview.innerHTML = buildGridSvg(res, parseFloat(wIn.value), parseFloat(dIn.value), fasciaPlacements);
        state.items = items;
        var cap = function (x) { return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
        state.title = "Stage " + (+parseFloat(wIn.value)) + "x" + (+parseFloat(dIn.value)) + (heightLabel ? " @ " + heightLabel + "mm" : "") + (fasciaFinish ? ", " + cap(fasciaFinish) + " Fascia" : "");

        var missing = items.filter(function (it) { return !isRealPart(it.partNumber); });
        kitBox.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated kit</div>' +
          '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:4px;">Decks</div>' +
          decksHtml + legsHtml + fasciaHtml +
          '<div style="margin-top:8px;font-size:12px;color:#777;">' + res.totals.panels + ' panels &middot; ' + res.totals.areaCovered + ' ' + c.unit + '&sup2;</div>' +
          (missing.length ? '<div style="margin-top:8px;font-size:12px;color:#b07b00;">' + missing.length + ' placeholder item(s) will be added as custom lines.</div>' : "") +
          '<div style="margin-top:6px;font-size:11px;color:#999;">Any code not found in stock is added as a custom line.</div>';

        renderFooter(true, "");
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
        msg.textContent = "Add to a '" + state.title + "' folder?";
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

      sysSel.addEventListener("change", function () { applySystemBounds(); populateHeights(); populateFinishes(); render(); });
      wIn.addEventListener("input", render);
      dIn.addEventListener("input", render);
      hSel.addEventListener("change", function () { populateFinishes(); render(); });
      faceSel.addEventListener("change", render);
      finishSel.addEventListener("change", render);

      document.body.appendChild(backdrop);
      applySystemBounds();
      populateHeights();
      populateFinishes();
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
