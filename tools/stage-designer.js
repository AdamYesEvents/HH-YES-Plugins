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
 * Version: 0.16.0
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

  // Top-down preview: deck panels filled, fascia boards just outside the edges
  // (teal = standard, coral = corner), and trim a thinner strip beyond the fascia
  // (blue = centre, dark blue = corner). fascia/trim are placements arrays.
  function buildGridSvg(result, width, depth, fascia, trim, opts) {
    if (!result || !result.ok) return "";
    opts = opts || {};
    var maxW = opts.maxW || 320, maxH = opts.maxH || 220, pad = 1, m = 20, ft = 7, tt = 4, toff = 10;
    var scale = Math.min(maxW / width, maxH / depth);
    var W = width * scale, H = depth * scale, ox = m, oy = m;
    var deckRects = result.placements.map(function (p) {
      var r = '<rect x="' + (ox + p.x * scale + pad) + '" y="' + (oy + p.y * scale + pad) +
        '" width="' + (p.width * scale - pad * 2) + '" height="' + (p.depth * scale - pad * 2) +
        '" fill="' + fillFor(p.deckId) + '" stroke="#26215C" stroke-width="1"/>';
      if (opts.labelHeight) {
        var bw = Math.max(p.width, p.depth), bd = Math.min(p.width, p.depth);
        var cx = ox + (p.x + p.width / 2) * scale, cy = oy + (p.y + p.depth / 2) * scale;
        r += '<text x="' + cx + '" y="' + cy + '" font-family="Arial,Helvetica,sans-serif" font-size="' + (opts.labelFont || 9) + '" fill="#ffffff" text-anchor="middle" dominant-baseline="central">' + bw + 'x' + bd + ' @ ' + opts.labelHeight + '</text>';
      }
      return r;
    }).join("");
    function band(arr, thickness, gap, colorFn) {
      return (arr || []).map(function (b) {
        var col = colorFn(b), o1 = b.offset * scale, ln = b.length * scale, x, y, w, h;
        if (b.edge === "front") { x = ox + o1; y = oy + H + gap; w = ln; h = thickness; }
        else if (b.edge === "back") { x = ox + o1; y = oy - gap - thickness; w = ln; h = thickness; }
        else if (b.edge === "left") { x = ox - gap - thickness; y = oy + o1; w = thickness; h = ln; }
        else { x = ox + W + gap; y = oy + o1; w = thickness; h = ln; }
        return '<rect x="' + x + '" y="' + y + '" width="' + (w - 1) + '" height="' + (h - 1) + '" fill="' + col + '"/>';
      }).join("");
    }
    var fasciaRects = band(fascia, ft, 2, function (b) { return b.type === "corner" ? "#D85A30" : "#1D9E75"; });
    var trimRects = band(trim, tt, toff, function (b) { return b.type === "corner" ? "#1e40af" : "#3b82f6"; });
    var SW = W + 2 * m, SH = H + 2 * m;
    return '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" xmlns="http://www.w3.org/2000/svg">' +
      deckRects + fasciaRects + trimRects +
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

  // Which cut fit a corner piece uses, per edge end. Front/back: start=L, end=R.
  // Left side: R both ends; right side: L both ends (so mitres meet 1 L + 1 R).
  function fitFor(edge, isStart) {
    if (edge === "front" || edge === "back") return isStart ? "L" : "R";
    return edge === "left" ? "R" : "L";
  }

  // Trim for a fasciad stage (required wherever fascia is). o = { system,width,
  // depth,sides,finish,trim }. Each corner gets a 0.5 m L/R piece (45 mitre);
  // the rest of each run is Center pieces tiled with symTile (fewest parts).
  // Returns { available, items:[{label,partNumber,qty}], placements:[{edge,offset,length,type}] }.
  function trimKit(o) {
    var trim = o.trim || {}, boards = trim.trim || [];
    if (!o.sides) return { available: true, items: [], placements: [] };
    var avail = boards.filter(function (b) { return b.system === o.system && b.finish === o.finish; }).sort(function (a, b) { return b.len - a.len; });
    if (!avail.length) return { available: false, items: [], placements: [] };
    var lengths = avail.map(function (b) { return b.len; }), byLen = {};
    avail.forEach(function (b) { byLen[b.len] = b; });
    if (!byLen[0.5]) return { available: false, items: [], placements: [] };

    var W = o.width, D = o.depth, s = o.sides;
    var hasFront = s >= 2, hasLeft = s >= 2, hasRight = s >= 3, hasBack = s >= 4;
    var edges = [];
    if (hasFront) edges.push({ edge: "front", len: W, cFirst: hasLeft, cLast: hasRight });
    if (hasBack) edges.push({ edge: "back", len: W, cFirst: hasLeft, cLast: hasRight });
    if (hasLeft) edges.push({ edge: "left", len: D, cFirst: hasBack, cLast: hasFront });
    if (hasRight) edges.push({ edge: "right", len: D, cFirst: hasBack, cLast: hasFront });

    var agg = {}, placements = [];
    function add(code, label) { if (!agg[code]) agg[code] = { label: label, partNumber: code, qty: 0 }; agg[code].qty++; }

    edges.forEach(function (e) {
      var offset = 0, centerLen = +(e.len - (e.cFirst ? 0.5 : 0) - (e.cLast ? 0.5 : 0)).toFixed(3);
      if (e.cFirst) { var f1 = fitFor(e.edge, true); add(byLen[0.5][f1], "0.5m trim (" + f1 + ")"); placements.push({ edge: e.edge, offset: offset, length: 0.5, type: "corner" }); offset += 0.5; }
      if (centerLen > 1e-9) symTile(centerLen, lengths).forEach(function (plen) { add(byLen[plen].C, plen + "m trim (centre)"); placements.push({ edge: e.edge, offset: offset, length: plen, type: "centre" }); offset += plen; });
      if (e.cLast) { var f2 = fitFor(e.edge, false); add(byLen[0.5][f2], "0.5m trim (" + f2 + ")"); placements.push({ edge: e.edge, offset: offset, length: 0.5, type: "corner" }); offset += 0.5; }
    });
    return { available: true, items: Object.keys(agg).map(function (k) { return agg[k]; }), placements: placements };
  }

  // All multisets of `widths` (with repetition) of size k.
  function combosWithRep(widths, k) {
    var out = [];
    (function rec(start, cur) {
      if (cur.length === k) { out.push(cur.slice()); return; }
      for (var i = start; i < widths.length; i++) { cur.push(widths[i]); rec(i, cur); cur.pop(); }
    })(0, []);
    return out;
  }

  // Choose roll widths that cover `target`: fewest rolls, then least overshoot,
  // then avoid thin strips (maximise the smallest piece) so 5 -> [3,2] not [4,1].
  function coverWidth(target, widths) {
    var ws = widths.slice().sort(function (a, b) { return a - b; });
    for (var k = 1; k <= 20; k++) {
      var combos = combosWithRep(ws, k).filter(function (c) { return c.reduce(function (s, w) { return s + w; }, 0) >= target - 1e-9; });
      if (!combos.length) continue;
      combos.sort(function (a, b) {
        var sa = a.reduce(function (s, w) { return s + w; }, 0), sb = b.reduce(function (s, w) { return s + w; }, 0);
        if (Math.abs(sa - sb) > 1e-9) return sa - sb;            // least overshoot
        var ma = Math.min.apply(null, a), mb = Math.min.apply(null, b);
        if (ma !== mb) return mb - ma;                            // avoid thin strips
        return 0;
      });
      return combos[0];
    }
    return null;
  }

  // Carpet for the deck top. o = { system,width,depth,colour,carpet }. Runs the
  // cut length along the longer side + overhang; covers the shorter side by
  // combining roll widths. Returns { available, items, cuts, cutLength, combo }.
  function carpetKit(o) {
    var data = o.carpet || {};
    var all = (data.carpet || []).filter(function (b) { return b.system === o.system && b.colour === o.colour; });
    if (!all.length) return { available: false, items: [], cuts: [] };
    var widths = all.map(function (b) { return b.width; }), byW = {};
    all.forEach(function (b) { byW[b.width] = b; });
    var overhang = (typeof data.overhang === "number") ? data.overhang : 1;
    var longer = Math.max(o.width, o.depth), shorter = Math.min(o.width, o.depth);
    // Whole-metre cuts (carpet is ordered per metre) with at least `overhang`
    // spare: round the stage length up to a metre, then add the overhang.
    var cutLength = Math.ceil(longer) + overhang;
    var combo = coverWidth(shorter, widths);
    if (!combo) return { available: false, items: [], cuts: [] };
    // Carpet is sold per linear metre off a roll of a given width, so each width
    // is one stock line and the qty is the total metres cut (cuts x cut length).
    var cap = o.colour.charAt(0).toUpperCase() + o.colour.slice(1);
    var agg = {}, cuts = [];
    combo.forEach(function (w) {
      var b = byW[w], key = b.partNumber;
      if (!agg[key]) agg[key] = { width: w, partNumber: b.partNumber, cuts: 0 };
      agg[key].cuts++;
      cuts.push({ width: w, length: cutLength });
    });
    var items = Object.keys(agg).map(function (k) {
      var a = agg[k], metres = +(a.cuts * cutLength).toFixed(3);
      var desc = a.cuts > 1 ? (a.cuts + " × " + cutLength + "m cuts") : (cutLength + "m cut");
      return { label: cap + " Carpet " + a.width + "m wide (" + desc + ")", partNumber: a.partNumber, qty: metres };
    });
    return { available: true, items: items, cuts: cuts, cutLength: cutLength, combo: combo };
  }

  // Tread units (steps up to the stage). Only valid where a tread height matches
  // the stage height (400 or 600). o = { system,height,units,colour,treads,carpet }.
  // 600mm = the 400mm unit + an extension. Each tread also gets one 1m x 1m carpet
  // (1m-wide roll) in the stage colour, listed per tread (qty = units, not totalled).
  // Returns { available, items, units, height }.
  function treadsKit(o) {
    var data = o.treads || {};
    if (!o.units) return { available: true, items: [], units: 0 };
    var def = (data.treads || []).filter(function (t) { return t.system === o.system && t.height === o.height; })[0];
    if (!def) return { available: false, items: [], units: o.units };
    var items = [];
    (def.parts || []).forEach(function (p) { items.push({ label: p.label, partNumber: p.partNumber, qty: p.qty * o.units }); });
    var roll = ((o.carpet && o.carpet.carpet) || []).filter(function (b) { return b.system === o.system && b.colour === o.colour && b.width === 1; })[0];
    if (roll) {
      var cap = o.colour.charAt(0).toUpperCase() + o.colour.slice(1);
      items.push({ label: cap + " Carpet 1m × 1m (per tread)", partNumber: roll.partNumber, qty: o.units });
    }
    return { available: true, items: items, units: o.units, height: o.height };
  }

  // ===========================================================================
  // NODE EXPORT (no-op in the browser)
  // ===========================================================================
  if (typeof module !== "undefined" && module.exports) {
    module.exports = { packStage: packStage, buildGridSvg: buildGridSvg, fillFor: fillFor, isRealPart: isRealPart, legCount: legCount, fasciaKit: fasciaKit, symTile: symTile, trimKit: trimKit, carpetKit: carpetKit, coverWidth: coverWidth, treadsKit: treadsKit };
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
      getJson("fascia.json").catch(function () { return { boards: [], mounts: [] }; }),
      getJson("trim.json").catch(function () { return { trim: [] }; }),
      getJson("carpet.json").catch(function () { return { carpet: [], overhang: 1 }; }),
      getJson("treads.json").catch(function () { return { treads: [], maxUnits: 4 }; })
    ]).then(function (res) {
      catalogue = {
        systems: res[0].systems, decks: res[0].decks,
        legs: res[1].legs || [], legsPerDeck: res[1].legsPerDeck || 4,
        fascia: { boards: (res[2].boards || []), mounts: (res[2].mounts || []) },
        trim: { trim: (res[3].trim || []) },
        carpet: { carpet: (res[4].carpet || []), overhang: (typeof res[4].overhang === "number" ? res[4].overhang : 1) },
        treads: { treads: (res[5].treads || []), maxUnits: (res[5].maxUnits || 4) }
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

  function createHeading(inst, title, description) {
    var before = headingIdSet(inst);
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all();
    inst.new_item(0);
    inst.heading_name.val(title);
    if (description && inst.heading_desc) inst.heading_desc.val(description);
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
  function addStageKit(inst, items, title, onDone, description) {
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
      createHeading(inst, title, description).then(function (headingId) {
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

  // ---- PDF snapshot + upload to the Files tab --------------------------------
  // Short stage reference (no ambiguous 0/O/1/I) used in the filename and the
  // heading's Item description so the PDF can be matched back to the heading.
  function genCode() {
    var alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", s = "";
    for (var i = 0; i < 6; i++) s += alpha.charAt(Math.floor(Math.random() * alpha.length));
    return s;
  }

  function loadJsPdf() {
    return new Promise(function (resolve, reject) {
      if (window.jspdf && window.jspdf.jsPDF) return resolve(window.jspdf.jsPDF);
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js";
      s.onload = function () { (window.jspdf && window.jspdf.jsPDF) ? resolve(window.jspdf.jsPDF) : reject(new Error("jsPDF unavailable")); };
      s.onerror = function () { reject(new Error("could not load jsPDF")); };
      document.head.appendChild(s);
    });
  }

  // Rasterise an SVG string to a PNG data URL (white background, scaled up).
  function svgToPng(svg, scaleUp) {
    return new Promise(function (resolve, reject) {
      var mm = svg.match(/width="([\d.]+)"\s+height="([\d.]+)"/);
      var w = mm ? parseFloat(mm[1]) : 400, h = mm ? parseFloat(mm[2]) : 300, sU = scaleUp || 3;
      var img = new Image();
      img.onload = function () {
        var c = document.createElement("canvas"); c.width = w * sU; c.height = h * sU;
        var ctx = c.getContext("2d");
        ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        resolve({ dataUrl: c.toDataURL("image/png"), w: w, h: h });
      };
      img.onerror = function () { reject(new Error("svg render failed")); };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    });
  }

  // Build a one-page PDF (labelled layout + kit list) and push it to the Files
  // tab via HireHop's own uploader. Resolves with the filename.
  function buildAndUploadPdf(state, code) {
    return loadJsPdf().then(function (JsPDF) {
      var svg = buildGridSvg(state.result, state.width, state.depth, state.fasciaPlacements, state.trimPlacements,
        { maxW: 470, maxH: 330, labelHeight: state.height || "", labelFont: 9 });
      return svgToPng(svg, 3).then(function (png) {
        var pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        var pageW = 210, margin = 14;
        pdf.setFontSize(15); pdf.setTextColor(30, 30, 30); pdf.text(String(state.title), margin, 18);
        pdf.setFontSize(10); pdf.setTextColor(120, 120, 120);
        pdf.text("Ref: " + code + "     " + new Date().toLocaleDateString(), margin, 25);
        var imgW = pageW - margin * 2, imgH = imgW * (png.h / png.w), maxImgH = 130;
        if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * (png.w / png.h); }
        pdf.addImage(png.dataUrl, "PNG", margin, 31, imgW, imgH);
        var y = 31 + imgH + 11;
        pdf.setFontSize(12); pdf.setTextColor(30, 30, 30); pdf.text("Kit list", margin, y); y += 6;
        pdf.setFontSize(10);
        (state.items || []).forEach(function (it) {
          if (y > 285) { pdf.addPage(); y = 20; }
          pdf.setTextColor(60, 60, 60); pdf.text(String(it.label), margin, y);
          pdf.setTextColor(20, 20, 20); pdf.text("x " + it.qty, pageW - margin, y, { align: "right" });
          y += 6;
        });
        var fileName = state.width + "x" + state.depth + "@" + (state.height || 0) + "mm stage-" + code + ".pdf";
        var file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
        if (typeof window.handleFileUpload === "function") window.handleFileUpload([file]);
        return fileName;
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
      var colPreview = el("div", null, "flex:1;min-width:320px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;");
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

      var carpetWrap = field("Carpet"); var carpetSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      (function () {
        var cols = []; ((cat.carpet && cat.carpet.carpet) || []).forEach(function (b) { if (cols.indexOf(b.colour) < 0) cols.push(b.colour); });
        var opts = [["", "None"]].concat(cols.map(function (c) { return [c, c.charAt(0).toUpperCase() + c.slice(1)]; }));
        opts.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; carpetSel.appendChild(op); });
        if (cols.indexOf("black") >= 0) carpetSel.value = "black";
      })();
      carpetWrap.appendChild(carpetSel); colControls.appendChild(carpetWrap);

      var faceWrap = field("Fascia sides"); var faceSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      [["0", "None"], ["2", "2 sided (left + front)"], ["3", "3 sided"], ["4", "4 sided"]].forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; faceSel.appendChild(op); });
      faceWrap.appendChild(faceSel);
      var fasciaNote = el("div", null, "margin-top:6px;font-size:11px;color:#999;display:none;");
      fasciaNote.textContent = "No fascia at this height — fascia & trim unavailable.";
      faceWrap.appendChild(fasciaNote);
      colControls.appendChild(faceWrap);

      var finishWrap = field("Fascia finish"); var finishSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); finishWrap.appendChild(finishSel); colControls.appendChild(finishWrap);

      var trimWrap = field("Trim finish"); var trimSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); trimWrap.appendChild(trimSel); colControls.appendChild(trimWrap);

      var treadsWrap = field("Treads"); var treadsSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      (function () {
        var maxU = (cat.treads && cat.treads.maxUnits) || 4;
        var opts = [["0", "None"]];
        for (var u = 1; u <= maxU; u++) opts.push([String(u), u + (u > 1 ? " units" : " unit")]);
        opts.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; treadsSel.appendChild(op); });
      })();
      treadsWrap.appendChild(treadsSel);
      var treadsNote = el("div", null, "margin-top:6px;font-size:11px;color:#999;display:none;");
      treadsNote.textContent = "Treads available on 400mm or 600mm stages only.";
      treadsWrap.appendChild(treadsNote);
      colControls.appendChild(treadsWrap);

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
        finishWrap.style.display = (parseInt(faceSel.value) > 0 && finishes.length) ? "" : "none";
      }

      function populateTrimFinishes() {
        var finishes = [];
        ((cat.trim && cat.trim.trim) || []).filter(function (b) { return b.system === sysSel.value; })
          .forEach(function (b) { if (finishes.indexOf(b.finish) < 0) finishes.push(b.finish); });
        trimSel.innerHTML = "";
        finishes.forEach(function (f) { var o = el("option"); o.value = f; o.textContent = f.charAt(0).toUpperCase() + f.slice(1); trimSel.appendChild(o); });
        trimWrap.style.display = (parseInt(faceSel.value) > 0 && finishes.length) ? "" : "none";
      }

      // Fascia (and therefore trim) only exists at heights with fascia boards.
      // Disable the sides selector and force None where there's no fascia data.
      function syncFasciaControls() {
        var h = currentHeight();
        var fasciaOK = (cat.fascia.boards || []).some(function (b) { return b.system === sysSel.value && b.height === h; });
        faceSel.disabled = !fasciaOK;
        if (!fasciaOK) faceSel.value = "0";
        fasciaNote.style.display = fasciaOK ? "none" : "";
        faceWrap.style.opacity = fasciaOK ? "1" : "0.6";
        populateFinishes();
        populateTrimFinishes();
      }

      // Treads only fit a stage whose height matches a tread unit (400 / 600).
      function syncTreadsControl() {
        var h = currentHeight();
        var treadsOK = ((cat.treads && cat.treads.treads) || []).some(function (t) { return t.system === sysSel.value && t.height === h; });
        treadsSel.disabled = !treadsOK;
        if (!treadsOK) treadsSel.value = "0";
        treadsNote.style.display = treadsOK ? "none" : "";
        treadsWrap.style.opacity = treadsOK ? "1" : "0.6";
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

        // carpet (deck top; not height-dependent)
        var carpetHtml = "", carpetColour = "";
        if (carpetSel.value) {
          var cpt = carpetKit({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), colour: carpetSel.value, carpet: cat.carpet });
          if (cpt.available && cpt.items.length) {
            cpt.items.forEach(function (it) { items.push(it); });
            carpetColour = carpetSel.value;
            carpetHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Carpet (' + carpetColour + ')</div>' +
              cpt.items.map(function (it) { return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>'; }).join("");
          }
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

        // trim (auto-included wherever fascia is)
        var trimHtml = "", trimFinish = "", trimPlacements = [];
        if (sides > 0) {
          var tk = trimKit({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), sides: sides, finish: trimSel.value, trim: cat.trim });
          if (tk.available && tk.items.length) {
            tk.items.forEach(function (it) { items.push(it); });
            trimFinish = trimSel.value;
            trimPlacements = tk.placements;
            trimHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Trim (' + trimFinish + ')</div>' +
              tk.items.map(function (it) { return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>'; }).join("");
          }
        }

        // treads (steps up to the stage; height matches the stage, carpeted in the stage colour)
        var treadsHtml = "", treadBoxHtml = "", treadUnits = parseInt(treadsSel.value) || 0, treadHeight = heightVal;
        if (treadUnits > 0 && treadHeight) {
          var trd = treadsKit({ system: sysSel.value, height: treadHeight, units: treadUnits, colour: (carpetSel.value || "black"), treads: cat.treads, carpet: cat.carpet });
          if (trd.available && trd.items.length) {
            trd.items.forEach(function (it) { items.push(it); });
            treadsHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Treads (' + treadHeight + 'mm)</div>' +
              trd.items.map(function (it) { return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>'; }).join("");
            var hex = ({ black: "#333333", white: "#e8e8e8", grey: "#9a9a9a" })[(carpetSel.value || "black")] || "#333333";
            var boxes = "";
            for (var ti = 0; ti < treadUnits; ti++) boxes += '<div style="width:32px;height:22px;background:' + hex + ';border:1px solid #26215C;border-radius:2px;"></div>';
            treadBoxHtml = '<div style="margin-top:12px;display:flex;flex-direction:column;align-items:center;gap:5px;">' +
              '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;">Treads — ' + treadHeight + 'mm &times; ' + treadUnits + '</div>' +
              '<div style="display:flex;gap:5px;">' + boxes + '</div></div>';
          }
        }

        var sw = function (col, lbl) { return '<span style="display:inline-flex;align-items:center;gap:4px;"><span style="width:10px;height:10px;border-radius:2px;background:' + col + ';"></span>' + lbl + '</span>'; };
        var legend = '<div style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px 12px;margin-top:10px;font-size:11px;color:#666;max-width:320px;">' +
          sw("#7F77DD", "Deck") +
          (fasciaFinish ? sw("#1D9E75", "Fascia") + sw("#D85A30", "Fascia corner") : "") +
          (trimFinish ? sw("#3b82f6", "Trim") + sw("#1e40af", "Trim corner") : "") + '</div>';
        colPreview.innerHTML = buildGridSvg(res, parseFloat(wIn.value), parseFloat(dIn.value), fasciaPlacements, trimPlacements) + treadBoxHtml + legend;
        state.items = items;
        state.width = +parseFloat(wIn.value); state.depth = +parseFloat(dIn.value); state.height = heightVal;
        state.fasciaPlacements = fasciaPlacements; state.trimPlacements = trimPlacements;
        state.treadUnits = treadUnits; state.treadHeight = treadHeight;
        var cap = function (x) { return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
        state.title = "Stage " + (+parseFloat(wIn.value)) + "x" + (+parseFloat(dIn.value)) + (heightLabel ? " @ " + heightLabel + "mm" : "") + (carpetColour ? ", " + cap(carpetColour) + " Carpet" : "") + (fasciaFinish ? ", " + cap(fasciaFinish) + " Fascia" : "") + (trimFinish ? ", " + cap(trimFinish) + " Trim" : "") + (treadsHtml ? ", " + treadUnits + " Tread" + (treadUnits > 1 ? "s" : "") : "");

        var missing = items.filter(function (it) { return !isRealPart(it.partNumber); });
        kitBox.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated kit</div>' +
          '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:4px;">Decks</div>' +
          decksHtml + legsHtml + carpetHtml + fasciaHtml + trimHtml + treadsHtml +
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
        var code = genCode();
        var snapshot = { result: state.result, width: state.width, depth: state.depth, height: state.height, fasciaPlacements: state.fasciaPlacements, trimPlacements: state.trimPlacements, items: state.items.slice(), title: state.title };
        addStageKit(inst, state.items, state.title, function (r) {
          if (r.ok) {
            foot.innerHTML = '<div style="flex:1;font-size:13px;color:#555;">Creating the PDF…</div>';
            buildAndUploadPdf(snapshot, code).then(function () { close(); }, function () { close(); });
          } else {
            foot.innerHTML = "";
            var err = el("div", null, "flex:1;font-size:13px;color:#b00;");
            err.textContent = r.error;
            var back = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
            back.textContent = "Back"; back.addEventListener("click", render);
            foot.appendChild(err); foot.appendChild(back);
          }
        }, code);
      }

      sysSel.addEventListener("change", function () { applySystemBounds(); populateHeights(); syncFasciaControls(); syncTreadsControl(); render(); });
      wIn.addEventListener("input", render);
      dIn.addEventListener("input", render);
      hSel.addEventListener("change", function () { syncFasciaControls(); syncTreadsControl(); render(); });
      faceSel.addEventListener("change", function () { populateFinishes(); populateTrimFinishes(); render(); });
      finishSel.addEventListener("change", render);
      trimSel.addEventListener("change", render);
      carpetSel.addEventListener("change", render);
      treadsSel.addEventListener("change", render);

      document.body.appendChild(backdrop);
      applySystemBounds();
      populateHeights();
      syncFasciaControls();
      syncTreadsControl();
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
