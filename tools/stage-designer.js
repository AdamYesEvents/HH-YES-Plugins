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
 * Version: 0.31.4
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
    // Extra outer padding when edge labels (FRONT/BACK/LEFT/RIGHT) are shown,
    // so the words don't crowd the fascia/trim bands.
    var labelPad = opts.edgeLabels ? 16 : 0;
    var maxW = opts.maxW || 320, maxH = opts.maxH || 220, pad = 1, m = 20 + labelPad, ft = 7, tt = 4, toff = 10;
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
    // treads: a row of 1m boxes at the front edge (only drawn when requested, e.g. the PDF)
    var treadSvg = "", bottomExtra = 0;
    if (opts.treads && opts.treads.units > 0) {
      var tu = opts.treads.units, tcol = opts.treads.colour || "#333333";
      var tw = scale, td = Math.min(scale * 0.5, 28), ty = oy + H + 16;
      var totalW = tu * tw, startX = Math.max(4, ox + W / 2 - totalW / 2);
      for (var i = 0; i < tu; i++) treadSvg += '<rect x="' + (startX + i * tw + 1) + '" y="' + ty + '" width="' + (tw - 2) + '" height="' + td + '" fill="' + tcol + '" stroke="#26215C" stroke-width="1"/>';
      treadSvg += '<text x="' + (ox + W / 2) + '" y="' + (ty + td + 12) + '" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#555555" text-anchor="middle">Treads &#215; ' + tu + (opts.treads.height ? ' @ ' + opts.treads.height : '') + '</text>';
      bottomExtra = 16 + td + 18;
    }
    var SW = W + 2 * m, SH = H + 2 * m + bottomExtra;
    // Edge labels (Front/Back/Left/Right) - only when opts.edgeLabels is true
    // (typically the PDF; on-screen preview keeps them off to reduce clutter).
    var edgeSvg = "";
    if (opts.edgeLabels) {
      var cxMid = ox + W / 2, cyMid = oy + H / 2, ls = 11, edgeGap = 8;
      edgeSvg += '<text x="' + cxMid + '" y="' + edgeGap + '" font-family="Arial,Helvetica,sans-serif" font-size="' + ls + '" fill="#666" text-anchor="middle" letter-spacing="1">BACK</text>';
      edgeSvg += '<text x="' + cxMid + '" y="' + (SH - edgeGap + 3) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + ls + '" fill="#666" text-anchor="middle" letter-spacing="1">FRONT</text>';
      edgeSvg += '<text x="' + edgeGap + '" y="' + cyMid + '" font-family="Arial,Helvetica,sans-serif" font-size="' + ls + '" fill="#666" text-anchor="middle" letter-spacing="1" transform="rotate(-90 ' + edgeGap + ' ' + cyMid + ')">LEFT</text>';
      edgeSvg += '<text x="' + (SW - edgeGap) + '" y="' + cyMid + '" font-family="Arial,Helvetica,sans-serif" font-size="' + ls + '" fill="#666" text-anchor="middle" letter-spacing="1" transform="rotate(90 ' + (SW - edgeGap) + ' ' + cyMid + ')">RIGHT</text>';
    }
    return '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" xmlns="http://www.w3.org/2000/svg">' +
      deckRects + fasciaRects + trimRects + treadSvg + edgeSvg +
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

  function colourAbbr(c) {
    var map = { "black": "BLK", "off white": "OWH", "grey": "GRY", "silver": "SIL", "gold": "GLD", "custom": "CUS", "white": "WHT" };
    return map[c] || String(c || "").replace(/[^a-z]/gi, "").slice(0, 3).toUpperCase();
  }

  // Fascia for a fasciad stage. o = { system,width,depth,sides(0/2/3/4),height,
  // finishType,finishColour,fascia }. Panels are colour-independent (structural);
  // the finish (Felt/HIPS/Print + colour) is one per-metre line priced on the
  // total fascia meterage. Corner panels sit on the FRONT/back edges; sides are
  // all standard. Edges tile with symTile (fewest panels).
  // Returns { available, items, placements, meterage, finishCost, rate, ... }.
  // Build the per-metre finish line for a given meterage. Uses the real stock
  // code for (type, height, colour) from the data; falls back to a generated one.
  function fasciaFinishInfo(finishes, o, meterage) {
    var fin = (finishes || []).filter(function (f) { return f.type === o.finishType; })[0];
    var rate = fin ? (fin.pricePerM || 0) : 0, finishCost = +(rate * meterage).toFixed(2), item = null;
    if (fin && meterage > 0) {
      var byHeight = fin.codes && fin.codes[o.height];
      var code = (byHeight && byHeight[o.finishColour]) || ("FASC-" + fin.type.toUpperCase() + "-" + o.height + "-" + colourAbbr(o.finishColour));
      item = { label: fin.label + " finish - " + o.finishColour + " (" + o.height + "mm)", partNumber: code, qty: meterage, unitPrice: rate, isFinish: true };
    }
    return { item: item, rate: rate, finishCost: finishCost, finishLabel: fin ? fin.label : "" };
  }

  // Imperial (4ft) fascia: 4-sided only, one 4ft board per edge - front/back are
  // 2x-corner boards, left/right are standard - plus one support fixing per board.
  // Finish meterage = perimeter rounded up to the next whole metre.
  function fasciaKitImperial(o, panels, mounts, finishes) {
    var panel = panels.filter(function (b) { return b.system === "imperial" && b.height === o.height; })[0];
    if (!panel) return { available: false, items: [], placements: [] };
    var mount = mounts.filter(function (m) { return m.system === "imperial"; })[0];
    var edges = [
      { edge: "front", len: o.width, corner: true }, { edge: "back", len: o.width, corner: true },
      { edge: "left", len: o.depth, corner: false }, { edge: "right", len: o.depth, corner: false }
    ];
    var agg = {}, order = [], placements = [], perimFt = 0;
    function add(code, label) { if (!agg[code]) { agg[code] = { label: label, partNumber: code, qty: 0 }; order.push(code); } agg[code].qty++; }
    edges.forEach(function (e) {
      add(e.corner ? panel.corner : panel.standard, o.width + "ft fascia board (" + (e.corner ? "2x corner" : "standard") + ")");
      if (mount) add(mount.partNumber, o.width + "ft fascia support fixing");
      placements.push({ edge: e.edge, offset: 0, length: e.len, type: e.corner ? "corner" : "standard" });
      perimFt += e.len;
    });
    var items = order.map(function (k) { return agg[k]; });
    var meterage = Math.ceil(perimFt * 0.3048); // perimeter in metres, up to next metre
    var fi = fasciaFinishInfo(finishes, o, meterage);
    if (fi.item) items.push(fi.item);
    return { available: true, items: items, placements: placements, meterage: meterage, finishCost: fi.finishCost, rate: fi.rate, finishLabel: fi.finishLabel, finishColour: o.finishColour };
  }

  // Small-stage fascia builder: given a hardcoded per-edge rule (see SMALL_STAGE_RULES),
  // place one panel per edge + a mount per panel length + a finish line for the perimeter.
  function fasciaKitSmall(o, rule, byLen, mounts, finishes) {
    var mountLens = mounts.filter(function (m) { return m.system === o.system; }).sort(function (a, b) { return b.len - a.len; });
    var agg = {}, order = [], placements = [], meterage = 0;
    function add(code, label) { if (!agg[code]) { agg[code] = { label: label, partNumber: code, qty: 0 }; order.push(code); } agg[code].qty++; }
    rule.forEach(function (r) {
      var b = byLen[r.len], code = r.type === "corner" ? b.corner : b.standard;
      add(code, r.len + "m fascia panel (" + r.type + ")");
      placements.push({ edge: r.edge, offset: 0, length: r.len, type: r.type });
      // mounts along this edge
      var rem = r.len;
      mountLens.forEach(function (m) { while (rem >= m.len - 1e-9) { add(m.partNumber, m.len + "m fascia mount"); rem -= m.len; } });
      meterage += r.len;
    });
    meterage = +meterage.toFixed(3);
    var items = order.map(function (k) { return agg[k]; });
    var fi = fasciaFinishInfo(finishes, o, meterage);
    if (fi.item) items.push(fi.item);
    return { available: true, items: items, placements: placements, meterage: meterage, finishCost: fi.finishCost, rate: fi.rate, finishLabel: fi.finishLabel, finishColour: o.finishColour };
  }

  // Small-stage fascia rules override the general symTile algorithm because on
  // very short edges the algorithm produces awkward panel counts. Data-driven,
  // keyed by "{width}x{depth}m {sides}-sided". Each rule lists one entry per
  // edge: which panel length (m) and which type (standard/corner). Only applied
  // when metric AND all required panels exist at that length + height.
  //   1x1m 2-sided:  front=1m corner  |  left=1m standard
  //   1x1m 3-sided:  front=1m corner  |  left=1m corner  |  right=1m standard
  //   1x1m 4-sided:  front + back + left + right all 1m corner
  var SMALL_STAGE_RULES = {
    // 1x1m
    "1x1m 2": [{ edge: "front", len: 1, type: "corner" }, { edge: "left", len: 1, type: "standard" }],
    "1x1m 3": [{ edge: "front", len: 1, type: "corner" }, { edge: "left", len: 1, type: "corner" }, { edge: "right", len: 1, type: "standard" }],
    "1x1m 4": [{ edge: "front", len: 1, type: "corner" }, { edge: "back", len: 1, type: "corner" }, { edge: "left", len: 1, type: "corner" }, { edge: "right", len: 1, type: "corner" }],

    // 1.5x1m (per spec: front=1.5m corner; sides=1m)
    "1.5x1m 2": [{ edge: "front", len: 1.5, type: "corner" }, { edge: "left", len: 1, type: "standard" }],
    "1.5x1m 3": [{ edge: "front", len: 1.5, type: "corner" }, { edge: "left", len: 1, type: "corner" }, { edge: "right", len: 1, type: "standard" }],
    "1.5x1m 4": [{ edge: "front", len: 1.5, type: "corner" }, { edge: "back", len: 1.5, type: "corner" }, { edge: "left", len: 1, type: "corner" }, { edge: "right", len: 1, type: "corner" }],

    // 1x1.5m (mirror: same total parts as 1.5x1m for 2/4-sided; 3-sided differs due to asymmetric perimeter)
    "1x1.5m 2": [{ edge: "front", len: 1, type: "standard" }, { edge: "left", len: 1.5, type: "corner" }],
    "1x1.5m 3": [{ edge: "front", len: 1, type: "corner" }, { edge: "left", len: 1.5, type: "corner" }, { edge: "right", len: 1.5, type: "standard" }],
    "1x1.5m 4": [{ edge: "front", len: 1, type: "corner" }, { edge: "back", len: 1, type: "corner" }, { edge: "left", len: 1.5, type: "corner" }, { edge: "right", len: 1.5, type: "corner" }],

    // 2x1m (same pattern extended to 2m long edges)
    "2x1m 2": [{ edge: "front", len: 2, type: "corner" }, { edge: "left", len: 1, type: "standard" }],
    "2x1m 3": [{ edge: "front", len: 2, type: "corner" }, { edge: "left", len: 1, type: "corner" }, { edge: "right", len: 1, type: "standard" }],
    "2x1m 4": [{ edge: "front", len: 2, type: "corner" }, { edge: "back", len: 2, type: "corner" }, { edge: "left", len: 1, type: "corner" }, { edge: "right", len: 1, type: "corner" }],

    // 1x2m (mirror of 2x1)
    "1x2m 2": [{ edge: "front", len: 1, type: "standard" }, { edge: "left", len: 2, type: "corner" }],
    "1x2m 3": [{ edge: "front", len: 1, type: "corner" }, { edge: "left", len: 2, type: "corner" }, { edge: "right", len: 2, type: "standard" }],
    "1x2m 4": [{ edge: "front", len: 1, type: "corner" }, { edge: "back", len: 1, type: "corner" }, { edge: "left", len: 2, type: "corner" }, { edge: "right", len: 2, type: "corner" }],

    // 1.5x1.5m (square, same shape as 1x1m rules but with 1.5m panels)
    "1.5x1.5m 2": [{ edge: "front", len: 1.5, type: "corner" }, { edge: "left", len: 1.5, type: "standard" }],
    "1.5x1.5m 3": [{ edge: "front", len: 1.5, type: "corner" }, { edge: "left", len: 1.5, type: "corner" }, { edge: "right", len: 1.5, type: "standard" }],
    "1.5x1.5m 4": [{ edge: "front", len: 1.5, type: "corner" }, { edge: "back", len: 1.5, type: "corner" }, { edge: "left", len: 1.5, type: "corner" }, { edge: "right", len: 1.5, type: "corner" }]
  };
  function smallStageRule(system, w, d, sides) {
    if (system !== "metric") return null;
    return SMALL_STAGE_RULES[w + "x" + d + "m " + sides] || null;
  }

  function fasciaKit(o) {
    var fascia = o.fascia || {};
    var panels = fascia.panels || fascia.boards || [], mounts = fascia.mounts || [], finishes = fascia.finishes || [];
    if (!o.sides) return { available: true, items: [], placements: [], meterage: 0, finishCost: 0 };
    if (o.system === "imperial") return fasciaKitImperial(o, panels, mounts, finishes);

    var avail = panels.filter(function (b) { return b.system === o.system && b.height === o.height; })
      .sort(function (a, b) { return b.len - a.len; });
    if (!avail.length) return { available: false, items: [], placements: [] };

    // Small-stage rule (1x1m for now, 1.5x1.5m to follow): if a rule matches
    // AND the required panels exist at this height, use it instead of symTile.
    var rule = smallStageRule(o.system, o.width, o.depth, o.sides);
    if (rule) {
      var byLen = {}; avail.forEach(function (b) { byLen[b.len] = b; });
      var ok = rule.every(function (r) { var b = byLen[r.len]; return b && (r.type === "corner" ? b.corner : b.standard); });
      if (ok) return fasciaKitSmall(o, rule, byLen, mounts, finishes);
    }
    var lengths = avail.map(function (b) { return b.len; });
    var mountLens = mounts.filter(function (m) { return m.system === o.system; }).sort(function (a, b) { return b.len - a.len; });

    var W = o.width, D = o.depth, s = o.sides;
    var hasFront = s >= 2, hasLeft = s >= 2, hasRight = s >= 3, hasBack = s >= 4;
    var edges = [];
    if (hasFront) edges.push({ edge: "front", len: W, cFirst: hasLeft, cLast: hasRight });
    if (hasBack) edges.push({ edge: "back", len: W, cFirst: hasLeft, cLast: hasRight });
    if (hasLeft) edges.push({ edge: "left", len: D, cFirst: false, cLast: false });
    if (hasRight) edges.push({ edge: "right", len: D, cFirst: false, cLast: false });

    var agg = {}, order = [], placements = [], meterage = 0;
    function add(code, label) { if (!agg[code]) { agg[code] = { label: label, partNumber: code, qty: 0 }; order.push(code); } agg[code].qty++; }

    edges.forEach(function (e) {
      var pieces = symTile(e.len, lengths);
      // Both ends need a corner panel but it tiled to a single panel (e.g. a 2m
      // front): one panel can only corner one end, so re-tile into >=2 panels
      // (a 2m edge becomes 2x 1m corners).
      if (e.cFirst && e.cLast && pieces.length < 2) {
        var alt = symTile(e.len, lengths.filter(function (l) { return l < e.len; }));
        if (alt.length >= 2) pieces = alt;
      }
      var offset = 0;
      pieces.forEach(function (plen, idx) {
        var isCorner = (idx === 0 && e.cFirst) || (idx === pieces.length - 1 && e.cLast);
        var board = avail.filter(function (b) { return Math.abs(b.len - plen) < 1e-9; })[0];
        add(isCorner ? board.corner : board.standard, plen + "m fascia panel (" + (isCorner ? "corner" : "standard") + ")");
        placements.push({ edge: e.edge, offset: offset, length: plen, type: isCorner ? "corner" : "standard" });
        offset += plen;
      });
      var rem = e.len;
      mountLens.forEach(function (m) { while (rem >= m.len - 1e-9) { add(m.partNumber, m.len + "m fascia mount"); rem -= m.len; } });
      meterage += e.len;
    });
    meterage = +meterage.toFixed(3);

    var items = order.map(function (k) { return agg[k]; });
    var fi = fasciaFinishInfo(finishes, o, meterage);
    if (fi.item) items.push(fi.item);
    return { available: true, items: items, placements: placements, meterage: meterage, finishCost: fi.finishCost, rate: fi.rate, finishLabel: fi.finishLabel, finishColour: o.finishColour };
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

    // Imperial (4ft): one 4ft trim per edge (2x 45 deg cuts), 4-sided.
    if (o.system === "imperial") {
      var it = boards.filter(function (b) { return b.system === "imperial" && b.finish === o.finish; })[0];
      if (!it) return { available: false, items: [], placements: [] };
      var iedges = [{ edge: "front", len: o.width }, { edge: "back", len: o.width }, { edge: "left", len: o.depth }, { edge: "right", len: o.depth }];
      var iagg = {}, iplace = [];
      iedges.forEach(function (e) {
        if (!iagg[it.C]) iagg[it.C] = { label: o.width + "ft trim (2x 45° cuts)", partNumber: it.C, qty: 0 };
        iagg[it.C].qty++;
        iplace.push({ edge: e.edge, offset: 0, length: e.len, type: "corner" });
      });
      return { available: true, items: Object.keys(iagg).map(function (k) { return iagg[k]; }), placements: iplace };
    }

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
    // Imperial 4x4ft: 1m carpet isn't wide enough for a 4ft (1.22m) deck, so use
    // 2x the 2m-wide carpet.
    if (o.system === "imperial") {
      var roll = (data.carpet || []).filter(function (b) { return b.colour === o.colour && b.width === 2; })[0];
      if (!roll) return { available: false, items: [], cuts: [] };
      var cp = o.colour.charAt(0).toUpperCase() + o.colour.slice(1);
      return { available: true, items: [{ label: cp + " Carpet 2m wide", partNumber: roll.partNumber, qty: 2 }], cuts: [{ width: 2, length: 2 }], cutLength: 2, combo: [2, 2] };
    }
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
    // Treads (and their 1m carpet) are shared physical units, matched by height.
    var def = (data.treads || []).filter(function (t) { return t.height === o.height; })[0];
    if (!def) return { available: false, items: [], units: o.units };
    var items = [];
    // Parts flagged onlyWhenNoFascia (the 600mm adaptor plate) are dropped when
    // the stage has fascia around it - the fascia provides the structural
    // support the tread would otherwise need the adaptor for.
    (def.parts || []).forEach(function (p) {
      if (p.onlyWhenNoFascia && o.hasFascia) return;
      items.push({ label: p.label, partNumber: p.partNumber, qty: p.qty * o.units });
    });
    var roll = ((o.carpet && o.carpet.carpet) || []).filter(function (b) { return b.colour === o.colour && b.width === 1; })[0];
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
  // Load data from this tool's own release tag (immutable + served instantly by
  // jsDelivr) rather than @main, which edge-caches and can lag / throttle purges.
  // Bump this to match the tag on each release so data ships with the code.
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
      getJson("fascia.json").catch(function () { return { panels: [], mounts: [], finishes: [] }; }),
      getJson("trim.json").catch(function () { return { trim: [] }; }),
      getJson("carpet.json").catch(function () { return { carpet: [], overhang: 1 }; }),
      getJson("treads.json").catch(function () { return { treads: [], maxUnits: 4 }; }),
      getJson("branding.json").catch(function () { return { depots: {}, default: {} }; }),
      getJson("accessories.json").catch(function () { return { byCategory: {} }; })
    ]).then(function (res) {
      catalogue = {
        systems: res[0].systems, decks: res[0].decks,
        legs: res[1].legs || [], legsPerDeck: res[1].legsPerDeck || 4,
        fascia: { panels: (res[2].panels || res[2].boards || []), mounts: (res[2].mounts || []), finishes: (res[2].finishes || []) },
        trim: { trim: (res[3].trim || []) },
        carpet: { carpet: (res[4].carpet || []), overhang: (typeof res[4].overhang === "number" ? res[4].overhang : 1) },
        treads: { treads: (res[5].treads || []), maxUnits: (res[5].maxUnits || 4) },
        branding: res[6] || { depots: {}, default: {} },
        accessories: (res[7] && res[7].byCategory) || {}
      };
      cb(catalogue);
    }).catch(function () { cb(null); });
  }

  // ---- HireHop insertion helpers (resolve -> heading -> batch save) -----------

  var RESOLVE_MAX_TRIES = 3;    // total attempts before giving up on a code
  var RESOLVE_RETRY_MS = 800;   // delay between retries (small, but enough to clear a race)

  // Look up a part number in HireHop's stock. Retries on ANY failure - a network
  // hiccup, a non-JSON response, or an "error" field in the reply - because these
  // are usually transient (rate limit, HireHop's own cache race) and shouldn't
  // silently drop a real stock item to a custom line. On the final failure we
  // return the last response (or an error placeholder) so the caller can decide.
  function resolvePart(inst, partNumber, qty) {
    return resolvePartAttempt(inst, partNumber, qty, 0, null);
  }
  function resolvePartAttempt(inst, partNumber, qty, tries, lastReply) {
    if (tries >= RESOLVE_MAX_TRIES) return Promise.resolve(lastReply || { error: -1 });
    var params = {
      id: "sd_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      qty: qty, part_number: partNumber,
      job_id: inst.options.doc_type == 1 ? inst.options.main_id : 0,
      package_id: 0, no_availability: 0,
      price_group: parseInt(inst.options.job_data.PRICE_GROUP) || 0
    };
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch("/php_functions/items_get_part_number_details.php?" + qs)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (!d || typeof d.error !== "undefined") {
          if (tries + 1 < RESOLVE_MAX_TRIES) {
            try { console.warn("[stage-designer] resolve retry", tries + 1, "for", partNumber, "reply:", d && d.error); } catch (e) { }
            return new Promise(function (res) { setTimeout(function () { res(resolvePartAttempt(inst, partNumber, qty, tries + 1, d)); }, RESOLVE_RETRY_MS); });
          }
          try { console.warn("[stage-designer] resolve failed after", tries + 1, "for", partNumber, "-> custom fallback (reply:", d, ")"); } catch (e) { }
          return d;
        }
        if (tries > 0) { try { console.info("[stage-designer] resolve succeeded on retry", tries + 1, "for", partNumber); } catch (e) { } }
        return d;
      })
      .catch(function (err) {
        if (tries + 1 < RESOLVE_MAX_TRIES) {
          try { console.warn("[stage-designer] resolve error retry", tries + 1, "for", partNumber, err && err.message); } catch (e) { }
          return new Promise(function (res) { setTimeout(function () { res(resolvePartAttempt(inst, partNumber, qty, tries + 1, { error: -2 })); }, RESOLVE_RETRY_MS); });
        }
        try { console.warn("[stage-designer] resolve error after", tries + 1, "for", partNumber, err && err.message); } catch (e) { }
        return { error: -2 };
      });
  }

  function headingIdSet(inst) {
    var ids = {}, tree = inst.items_to_supply_tree.jstree(true);
    (tree.get_json("#", { flat: true }) || []).forEach(function (n) { if (n.data && n.data.kind == 0) ids[n.data.ID] = true; });
    return ids;
  }

  // parentHeadingId: nest under this heading (both user-selected folders and our
  // own sub-headings). After the heading save, settle for HEADING_SETTLE_MS so the
  // next transaction doesn't slam HireHop's server-side "too many transactions"
  // rate limit (which triggers around a save every 1.5s sustained).
  var HEADING_SETTLE_MS = 3000;
  var HEADING_MAX_RETRIES = 2;
  var HEADING_RETRY_BACKOFF_MS = 9000; // long pause so a hit rate limit clears
  var HEADING_TIMEOUT_MS = 20000;      // per-attempt wait for the new node to appear

  function findVisibleErrorDialog() {
    return Array.prototype.slice.call(document.querySelectorAll(".ui-dialog")).filter(function (d) {
      if (d.offsetParent === null) return false;
      var t = d.querySelector(".ui-dialog-title") || {};
      return /error/i.test(t.textContent || "");
    })[0];
  }
  function closeErrorDialog(d) {
    if (!d) return;
    var btn = Array.prototype.slice.call(d.querySelectorAll(".ui-dialog-buttonpane button")).filter(function (b) { return /close|ok/i.test(b.textContent.trim()); })[0];
    if (btn) btn.click(); else { var x = d.querySelector(".ui-dialog-titlebar-close"); if (x) x.click(); }
  }

  // flag: HireHop heading flag (0=None, 1=Hidden, 2=Crew, 3=Technical, 4=Transport, 5=Grouped).
  // The root stage heading is set to 5 (Grouped) so the whole package rolls up into a
  // single line on customer-facing quotes/invoices; sub-headings stay 0 so the internal
  // Supplying tree still shows the Deck/Fascia/Trim/Treads/Carpet breakdown.
  function createHeading(inst, title, description, memo, parentHeadingId, flag) {
    return createHeadingAttempt(inst, title, description, memo, parentHeadingId, flag, 0);
  }
  function createHeadingAttempt(inst, title, description, memo, parentHeadingId, flag, attempt) {
    var before = headingIdSet(inst);
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all();
    if (parentHeadingId) {
      // Directly stamp the parent onto the widget's internal fields BEFORE
      // opening the edit dialog. Relying on tree.select_node + set_parent_vals()
      // is unreliable across HireHop's post-batch-save tree refreshes: the tree
      // gets re-rendered, select_node silently no-ops on the freshly-recreated
      // node, and set_parent_vals(true) then reads "no selection" and defaults
      // parent to 0 (root). Direct assignment survives all of that. Tree
      // select_node is still called for visual feedback.
      try { tree.select_node("a" + parentHeadingId); } catch (e) { }
      try { inst.item_edit_heading.val(parentHeadingId); } catch (e) { }
      try { inst.picklist_heading.val(parentHeadingId); } catch (e) { }
    }
    inst.new_item(0);
    // new_item(0) may reset item_edit_heading — re-stamp after opening the dialog.
    if (parentHeadingId) {
      try { inst.item_edit_heading.val(parentHeadingId); } catch (e) { }
    }
    inst.heading_name.val(title);
    if (description && inst.heading_desc) inst.heading_desc.val(description); // Item description
    if (memo && inst.heading_int) inst.heading_int.val(memo);                 // Item memo (internal)
    if (typeof flag === "number" && inst.item_edit_flag) inst.item_edit_flag.val(flag); // Grouped etc.
    inst.save_item();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        var now = headingIdSet(inst);
        var newId = Object.keys(now).filter(function (id) { return !before[id]; })[0];
        if (newId) { clearInterval(iv); setTimeout(function () { resolve(parseInt(newId)); }, HEADING_SETTLE_MS); return; }
        // Retry if HireHop shows an Error dialog (usually a transient rate-limit warning).
        var errDlg = findVisibleErrorDialog();
        if (errDlg && attempt < HEADING_MAX_RETRIES) {
          clearInterval(iv);
          closeErrorDialog(errDlg);
          try { if (inst.item_edit_dlg && inst.item_edit_dlg.dialog("isOpen")) inst.item_edit_dlg.dialog("close"); } catch (e) { }
          try { console.warn("[stage-designer] heading retry", attempt + 1, "after error dialog"); } catch (e) { }
          setTimeout(function () {
            createHeadingAttempt(inst, title, description, memo, parentHeadingId, flag, attempt + 1).then(resolve);
          }, HEADING_RETRY_BACKOFF_MS);
          return;
        }
        if (Date.now() - start > HEADING_TIMEOUT_MS) {
          clearInterval(iv);
          if (attempt < HEADING_MAX_RETRIES) {
            try { if (inst.item_edit_dlg && inst.item_edit_dlg.dialog("isOpen")) inst.item_edit_dlg.dialog("close"); } catch (e) { }
            try { console.warn("[stage-designer] heading retry", attempt + 1, "after timeout"); } catch (e) { }
            setTimeout(function () {
              createHeadingAttempt(inst, title, description, memo, parentHeadingId, flag, attempt + 1).then(resolve);
            }, HEADING_RETRY_BACKOFF_MS);
          } else resolve(null);
        }
      }, 200);
    });
  }

  // Walk from the currently selected node up to the nearest heading (kind 0).
  // Returns its ID, or null if nothing suitable is selected. Used so an "Add
  // stage kit" click respects whatever folder the user has selected in the tree.
  function selectedParentHeadingId(inst) {
    try {
      var tree = inst.items_to_supply_tree.jstree(true);
      var sel = tree.get_selected(true);
      if (!sel || !sel.length) return null;
      var n = sel[0];
      while (n && n.data) {
        if (n.data.kind === 0) return n.data.ID;
        if (!n.parent || n.parent === "#") return null;
        n = tree.get_node(n.parent);
      }
    } catch (e) { }
    return null;
  }

  var CUSTOM_ROW_GAP_MS = 3000; // gap between custom rows (HireHop's rate limit trips around 1.5s sustained)

  // Insert each unresolved item as a custom (free-text) line under the heading,
  // one at a time, spaced by CUSTOM_ROW_GAP_MS. Name is "[partNumber] label" for
  // easy find/replace later. If the item carries a unitPrice (e.g. the fascia
  // finish £/m), stamp it on the line so the cost shows until it becomes stock.
  function insertCustoms(inst, headingId, customs, done) {
    var tree = inst.items_to_supply_tree.jstree(true), i = 0;
    (function next() {
      if (i >= customs.length) { done(); return; }
      var it = customs[i++];
      try {
        tree.deselect_all(); tree.select_node("a" + headingId);
        inst.new_item(3);
        inst.custom_name.val("[" + it.partNumber + "] " + it.label);
        inst.priced_edit.find("[name='qty']").val(it.qty).trigger("change");
        if (it.unitPrice != null && inst.unit_price && inst.unit_price.length) {
          inst.unit_price.val(Number(it.unitPrice).toFixed(2)).trigger("change");
        }
        inst.save_item();
      } catch (e) { try { console.warn("[stage-designer] custom row failed:", it.partNumber, e && e.message); } catch (x) { } }
      setTimeout(next, CUSTOM_ROW_GAP_MS); // always continue, even if a row throws
    })();
  }

  // Group items by their category tag, preserving first-seen order.
  function groupByCategory(items) {
    var groups = {}, order = [];
    items.forEach(function (it) {
      var cat = it.category || "Other";
      if (!groups[cat]) { groups[cat] = []; order.push(cat); }
      groups[cat].push(it);
    });
    return { order: order, groups: groups };
  }

  // Resolve every part in one pass (serial, gentle), then hand back { shoppingByCat, customsByCat }.
  function resolveAllByCategory(inst, grouped) {
    var shoppingByCat = {}, customsByCat = {};
    grouped.order.forEach(function (c) { shoppingByCat[c] = {}; customsByCat[c] = []; });
    var chain = Promise.resolve();
    grouped.order.forEach(function (cat) {
      grouped.groups[cat].forEach(function (it) {
        chain = chain.then(function () {
          return resolvePart(inst, it.partNumber, it.qty).then(function (d) {
            if (!d || typeof d.error !== "undefined") customsByCat[cat].push(it);
            else { var key = (d.TYPE == 1 ? "a" : "b") + d.ID; shoppingByCat[cat][key] = (shoppingByCat[cat][key] || 0) + it.qty; }
          }, function () { customsByCat[cat].push(it); });
        });
      });
    });
    return chain.then(function () { return { shoppingByCat: shoppingByCat, customsByCat: customsByCat }; });
  }

  // Insert one category's items under a sub-heading: batch save the resolved
  // parts, wait for the autopull prompt (deck), then insert customs.
  function insertOneCategory(inst, subHeadingId, shopping, customs, hasAutopull, done) {
    inst.set_item_edit_tree_headings();
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all(); tree.select_node("a" + subHeadingId); inst.set_parent_vals(true);
    function doCustoms() {
      var t = inst.items_to_supply_tree.jstree(true);
      t.deselect_all(); t.select_node("a" + subHeadingId); inst.set_parent_vals(true);
      insertCustoms(inst, subHeadingId, customs, done);
    }
    if (Object.keys(shopping).length && inst.picklist_heading.val() == subHeadingId) {
      inst.save_items_list(shopping);
      // Only the Deck category triggers HireHop's Autopull modal (the boltset).
      if (hasAutopull) dismissAutopullThen(doCustoms);
      else setTimeout(doCustoms, 3500);
    } else {
      doCustoms();
    }
  }

  // Build a tree under an optional user-selected folder:
  //   parentSel (optional) -> "Stage ..." main heading -> "Deck" / "Fascia" / ... sub-headings -> items
  function addStageKit(inst, items, title, onDone, description, memo, parentHeadingId) {
    var grouped = groupByCategory(items);
    resolveAllByCategory(inst, grouped).then(function (res) {
      createHeading(inst, title, description, memo, parentHeadingId, 5 /* Grouped */).then(function (mainId) {
        if (!mainId) { onDone({ ok: false, error: "Could not create the stage folder" }); return; }
        var i = 0, parts = 0, customs = 0;
        function nextCategory() {
          if (i >= grouped.order.length) {
            // Final sweep: HireHop can fire another Autopull dialog after the
            // full kit finishes (linked items etc.). Auto-Save it, then hit the
            // Supplying refresh button so the newly-inserted rows appear, then
            // finish.
            dismissAutopullThen(function () {
              clickSupplyingRefresh(inst);
              onDone({ ok: true, headingId: mainId, parts: parts, customs: customs });
            });
            return;
          }
          var cat = grouped.order[i++];
          var shopping = res.shoppingByCat[cat], customList = res.customsByCat[cat];
          if (!Object.keys(shopping).length && !customList.length) { nextCategory(); return; }
          createHeading(inst, cat, "", "", mainId).then(function (subId) {
            if (!subId) { console.warn("[stage-designer] sub-heading failed:", cat); nextCategory(); return; }
            parts += Object.keys(shopping).length;
            customs += customList.length;
            insertOneCategory(inst, subId, shopping, customList, cat === "Deck", nextCategory);
          });
        }
        nextCategory();
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
        resolve({ dataUrl: c.toDataURL("image/jpeg", 0.92), w: w, h: h });
      };
      img.onerror = function () { reject(new Error("svg render failed")); };
      img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svg)));
    });
  }

  // Load an image URL to a data URL for embedding. Same-origin (e.g. HireHop's
  // own /uploads_img/) works directly. For external URLs we set crossOrigin so
  // the source needs CORS headers to avoid tainting the canvas. Resolves null
  // on any failure (image not found, network error, canvas taint).
  function loadImageDataUrl(url) {
    return new Promise(function (resolve) {
      if (!url) return resolve(null);
      var isSameOrigin = /^\//.test(url) || url.indexOf(location.origin) === 0;
      var img = new Image();
      if (!isSameOrigin) img.crossOrigin = "anonymous";
      img.onload = function () {
        try {
          var c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          resolve({ dataUrl: c.toDataURL("image/png"), w: img.naturalWidth, h: img.naturalHeight });
        } catch (e) { resolve(null); }
      };
      img.onerror = function () { resolve(null); };
      img.src = url;
    });
  }

  function fmtDate(s) {
    var mm = String(s || "").match(/(\d{4})-(\d{2})-(\d{2})/);
    return mm ? (mm[3] + "/" + mm[2] + "/" + mm[1]) : "";
  }

  // Build the one-page PDF (logo, job header, labelled layout, kit list).
  // Resolves { pdf, fileName }. Reads job number / delivery date from job_data.
  // Logo is grabbed off the <img id="comp_logo"> element HireHop already renders
  // in every page header - each company has a versioned filename like
  // /uploads_img/{COMPANY_ID}_{hash}.png that we can't compute. branding.logoUrl
  // in the JSON is a manual override; final fallback is /uploads_img/{ID}.png.
  function buildPdf(snapshot, code, branding) {
    var jd = window.job_data || {};
    var brand = branding || {};
    var companyId = (typeof user !== "undefined" && user && user.COMPANY_ID) || null;
    var pageLogo = document.getElementById("comp_logo");
    var pageLogoSrc = (pageLogo && pageLogo.getAttribute("src")) || "";
    var logoUrl = brand.logoUrl || pageLogoSrc || (companyId ? ("/uploads_img/" + companyId + ".png") : "");
    var box = brand.logoBox || { width: 38, height: 28 };
    return Promise.all([loadJsPdf(), loadImageDataUrl(logoUrl)]).then(function (r) {
      var JsPDF = r[0], logo = r[1];
      var svg = buildGridSvg(snapshot.result, snapshot.width, snapshot.depth, snapshot.fasciaPlacements, snapshot.trimPlacements,
        { maxW: 470, maxH: 330, labelHeight: snapshot.height || "", labelFont: 9, edgeLabels: true, treads: snapshot.treadUnits > 0 ? { units: snapshot.treadUnits, height: snapshot.treadHeight, colour: snapshot.treadColour } : null });
      return svgToPng(svg, 3).then(function (png) {
        var pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
        var pageW = 210, margin = 14;
        var logoWidth = 0;
        if (logo) {
          var lw = box.width, lh = box.height, ar = logo.w / logo.h;
          if (lw / lh > ar) lw = lh * ar; else lh = lw / ar;
          pdf.addImage(logo.dataUrl, "PNG", pageW - margin - lw, 12, lw, lh);
          logoWidth = lw;
        }
        // Top line: HireHop job name (JOB_NAME preferred, falls back to NAME).
        // Wraps if long so it never overruns the logo.
        var jobName = String(jd.JOB_NAME || jd.NAME || "");
        var textWidth = pageW - margin * 2 - (logoWidth ? logoWidth + 4 : 0);
        var hy = 17;
        if (jobName) {
          pdf.setFontSize(16); pdf.setTextColor(20, 20, 20);
          var lines = pdf.splitTextToSize(jobName, textWidth);
          pdf.text(lines, margin, hy);
          hy += lines.length * 6 + 2;
        }
        pdf.setFontSize(13); pdf.setTextColor(50, 50, 50); pdf.text(String(snapshot.title), margin, hy); hy += 6;
        pdf.setFontSize(10); pdf.setTextColor(90, 90, 90);
        if (snapshot.memo) { pdf.text(String(snapshot.memo), margin, hy); hy += 6; }
        pdf.text("Job " + (jd.ID || ""), margin, hy);
        pdf.text("Delivery: " + (fmtDate(jd.OUT_DATE) || "-") + "      Ref: " + code, margin, hy + 6);
        var top = hy + 13, imgW = pageW - margin * 2, imgH = imgW * (png.h / png.w), maxImgH = 130;
        if (imgH > maxImgH) { imgH = maxImgH; imgW = imgH * (png.w / png.h); }
        // Centre the plan horizontally when it's narrower than the text column.
        var imgX = margin + Math.max(0, ((pageW - margin * 2) - imgW) / 2);
        pdf.addImage(png.dataUrl, "JPEG", imgX, top, imgW, imgH);
        var y = top + imgH + 6;
        // Legend: only include swatches for elements actually present in the snapshot
        var hasFasciaStd = (snapshot.fasciaPlacements || []).some(function (p) { return p.type === "standard"; });
        var hasFasciaCorner = (snapshot.fasciaPlacements || []).some(function (p) { return p.type === "corner"; });
        var hasTrimCentre = (snapshot.trimPlacements || []).some(function (p) { return p.type === "centre"; });
        var hasTrimCorner = (snapshot.trimPlacements || []).some(function (p) { return p.type === "corner"; });
        var hasTreads = snapshot.treadUnits > 0;
        var legend = [{ col: [127, 119, 221], label: "Deck" }];
        if (hasFasciaStd) legend.push({ col: [29, 158, 117], label: "Fascia" });
        if (hasFasciaCorner) legend.push({ col: [216, 90, 48], label: "Fascia corner" });
        if (hasTrimCentre) legend.push({ col: [59, 130, 246], label: "Trim" });
        if (hasTrimCorner) legend.push({ col: [30, 64, 175], label: "Trim corner" });
        if (hasTreads) legend.push({ col: [154, 154, 154], label: "Treads" });
        pdf.setFontSize(9); pdf.setTextColor(90, 90, 90);
        var lx = margin, sw = 3, gap = 5, itemGap = 8;
        legend.forEach(function (it) {
          pdf.setFillColor(it.col[0], it.col[1], it.col[2]);
          pdf.rect(lx, y - 2.6, sw, sw, "F");
          pdf.text(it.label, lx + sw + 1.5, y);
          lx += sw + 1.5 + pdf.getTextWidth(it.label) + itemGap;
        });
        y += 8;
        pdf.setFontSize(12); pdf.setTextColor(30, 30, 30); pdf.text("Kit list", margin, y); y += 6;
        // Group by category, same order + labels as the Supplying tree sub-headings.
        var CAT_ORDER = ["Deck", "Carpet", "Fascia", "Trim", "Treads"];
        var grouped = {}, other = [];
        (snapshot.items || []).forEach(function (it) {
          var cat = it.category || "Other";
          if (CAT_ORDER.indexOf(cat) >= 0) { (grouped[cat] = grouped[cat] || []).push(it); }
          else other.push(it);
        });
        function drawGroup(label, list) {
          if (!list || !list.length) return;
          if (y > 275) { pdf.addPage(); y = 20; }
          pdf.setFontSize(10); pdf.setTextColor(90, 90, 90); pdf.text(label.toUpperCase(), margin, y);
          pdf.setDrawColor(200, 200, 200); pdf.line(margin + pdf.getTextWidth(label) + 3, y - 1, pageW - margin, y - 1);
          y += 5;
          pdf.setFontSize(10);
          list.forEach(function (it) {
            if (y > 285) { pdf.addPage(); y = 20; }
            pdf.setTextColor(60, 60, 60); pdf.text(String(it.label), margin + 2, y);
            pdf.setTextColor(20, 20, 20); pdf.text("x " + it.qty, pageW - margin, y, { align: "right" });
            y += 5.5;
          });
          y += 3;
        }
        CAT_ORDER.forEach(function (c) { drawGroup(c, grouped[c]); });
        drawGroup("Other", other);
        var fileName = (jd.ID ? jd.ID + " - " : "") + snapshot.width + "x" + snapshot.depth + (snapshot.sysUnit || "") + "@" + (snapshot.height || 0) + "mm stage-" + code + ".pdf";
        return { pdf: pdf, fileName: fileName };
      });
    });
  }

  // Offer a local "save as" (File System Access API), falling back to a download.
  // Aborting the picker cancels quietly (no fallback download).
  function savePdfLocal(pdf, fileName) {
    var blob = pdf.output("blob");
    if (window.showSaveFilePicker) {
      return window.showSaveFilePicker({ suggestedName: fileName, types: [{ description: "PDF", accept: { "application/pdf": [".pdf"] } }] })
        .then(function (h) { return h.createWritable(); })
        .then(function (w) { return Promise.resolve(w.write(blob)).then(function () { return w.close(); }); })
        .catch(function (e) { if (e && e.name === "AbortError") return; try { pdf.save(fileName); } catch (x) {} });
    }
    try { pdf.save(fileName); } catch (e) {}
    return Promise.resolve();
  }

  function uploadPdf(pdf, fileName) {
    var file = new File([pdf.output("blob")], fileName, { type: "application/pdf" });
    if (typeof window.handleFileUpload === "function") window.handleFileUpload([file]);
  }

  // Inject the spinner CSS once (used for the loading overlay + footer states).
  function injectSpinStyle() {
    if (document.getElementById("hh-spin-style")) return;
    var st = document.createElement("style");
    st.id = "hh-spin-style";
    st.textContent = ".hh-spin{width:22px;height:22px;border:3px solid rgba(0,0,0,.15);border-top-color:#2563eb;border-radius:50%;animation:hh-spin .8s linear infinite;display:inline-block;vertical-align:middle;box-sizing:border-box;}@keyframes hh-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(st);
  }

  function findAutopullDialog() {
    return Array.prototype.slice.call(document.querySelectorAll(".ui-dialog")).filter(function (d) {
      return d.offsetParent !== null && /autopull/i.test((d.querySelector(".ui-dialog-title") || {}).textContent || "");
    })[0];
  }

  // Click the Supplying tab's refresh button (the one next to the New/menu
  // buttons). HireHop doesn't re-render the tree after a batch save, so parts
  // added via our kit only appear once the user hits refresh. Idempotent - no-op
  // if the button isn't found.
  function clickSupplyingRefresh(inst) {
    try {
      var root = (inst && inst.element && inst.element[0]) || document;
      var sels = [
        "a[title='Refresh' i]", "button[title='Refresh' i]",
        "[title*='refresh' i]",
        ".ui-icon-refresh", ".ui-icon-arrowrefresh-1-w",
        ".ui-icon-arrowrefresh-1-e", ".ui-icon-arrowrefresh-1-s"
      ];
      for (var i = 0; i < sels.length; i++) {
        var el = root.querySelector(sels[i]);
        if (el) {
          var btn = el.closest && (el.closest("button, a, li, .ui-button, [role='button']") || el);
          (btn || el).click();
          return;
        }
      }
    } catch (e) { /* refresh is best-effort */ }
  }

  // The batch insert (deck) makes HireHop prompt a modal "Autopull" dialog (the
  // boltset). It must be dismissed BEFORE the custom rows start, or its modal
  // blocks the tree and the custom saves collide. Poll for it, press Save, wait
  // for it to close, then continue. Proceeds anyway if it never appears.
  function dismissAutopullThen(cb) {
    var tries = 0, dismissed = false;
    var iv = setInterval(function () {
      tries++;
      var d = findAutopullDialog();
      if (d) {
        var btns = Array.prototype.slice.call(d.querySelectorAll(".ui-dialog-buttonpane button"));
        var save = btns.filter(function (b) { return /save|ok|yes/i.test(b.textContent.trim()); })[0] || btns[0];
        if (save) { save.click(); dismissed = true; }
      }
      if ((dismissed && !findAutopullDialog()) || tries > 30) { clearInterval(iv); setTimeout(cb, 3000); }
    }, 200);
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
    injectSpinStyle();
    // show a loading spinner immediately while the catalogue fetches
    var pre = document.getElementById(DIALOG_ID);
    if (pre) pre.parentNode.removeChild(pre);
    var loading = el("div", { id: DIALOG_ID }, "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;");
    loading.innerHTML = '<div style="background:#fff;border-radius:8px;padding:24px 32px;display:flex;gap:14px;align-items:center;font-size:14px;color:#333;"><span class="hh-spin"></span>Loading Stage Designer&hellip;</div>';
    document.body.appendChild(loading);
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
        carpetSel.value = ""; // default to None; user opts in per stage
      })();
      carpetWrap.appendChild(carpetSel); colControls.appendChild(carpetWrap);

      var faceWrap = field("Fascia sides"); var faceSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
      faceWrap.appendChild(faceSel);
      var fasciaNote = el("div", null, "margin-top:6px;font-size:11px;color:#999;display:none;");
      fasciaNote.textContent = "No fascia at this height — fascia & trim unavailable.";
      faceWrap.appendChild(fasciaNote);
      colControls.appendChild(faceWrap);

      var finishWrap = field("Fascia finish"); var finishSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); finishWrap.appendChild(finishSel); colControls.appendChild(finishWrap);

      var finishColWrap = field("Finish colour"); var finishColSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); finishColWrap.appendChild(finishColSel); colControls.appendChild(finishColWrap);

      var trimWrap = field("Trim finish"); var trimSel = el("select", null, "width:100%;padding:8px;font-size:14px;"); trimWrap.appendChild(trimSel); colControls.appendChild(trimWrap);

      var treadsWrap = field("Treads"); var treadsSel = el("select", null, "width:100%;padding:8px;font-size:14px;");
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

      // Legs are mm scaff legs shared by both systems; imperial falls back to them.
      function legsForSystem() {
        var own = cat.legs.filter(function (l) { return l.system === sysSel.value; });
        return own.length ? own : cat.legs.filter(function (l) { return l.system === "metric"; });
      }

      // Imperial is 4-sided only; metric offers 2/3/4-sided.
      function populateFasciaSides() {
        var opts = sysSel.value === "imperial"
          ? [["0", "None"], ["4", "4 sided"]]
          : [["0", "None"], ["2", "2 sided (left + front)"], ["3", "3 sided"], ["4", "4 sided"]];
        var cur = faceSel.value;
        faceSel.innerHTML = "";
        opts.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; faceSel.appendChild(op); });
        if (opts.some(function (o) { return o[0] === cur; })) faceSel.value = cur;
      }

      // Imperial (4x4ft) can only take 1 tread unit; metric up to maxUnits.
      function populateTreads() {
        var maxU = sysSel.value === "imperial" ? 1 : ((cat.treads && cat.treads.maxUnits) || 4);
        var cur = treadsSel.value;
        treadsSel.innerHTML = "";
        var opts = [["0", "None"]];
        for (var u = 1; u <= maxU; u++) opts.push([String(u), u + (u > 1 ? " units" : " unit")]);
        opts.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; treadsSel.appendChild(op); });
        if (opts.some(function (o) { return o[0] === cur; })) treadsSel.value = cur;
      }

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

      var titleCase = function (f) { return String(f || "").replace(/\b\w/g, function (m2) { return m2.toUpperCase(); }); };

      // Fascia finish = type (Felt/HIPS/Print). The colour selector then follows the type.
      function populateFinishes() {
        var fins = (cat.fascia.finishes || []);
        var cur = finishSel.value;
        finishSel.innerHTML = "";
        fins.forEach(function (f) { var o = el("option"); o.value = f.type; o.textContent = f.label; finishSel.appendChild(o); });
        if (cur && fins.some(function (f) { return f.type === cur; })) finishSel.value = cur;
        finishWrap.style.display = (parseInt(faceSel.value) > 0 && fins.length) ? "" : "none";
        populateFinishColours();
      }

      function populateFinishColours() {
        var fin = (cat.fascia.finishes || []).filter(function (f) { return f.type === finishSel.value; })[0];
        var cols = fin ? (fin.colours || []) : [], cur = finishColSel.value;
        finishColSel.innerHTML = "";
        cols.forEach(function (c) { var o = el("option"); o.value = c; o.textContent = titleCase(c); finishColSel.appendChild(o); });
        if (cur && cols.indexOf(cur) >= 0) finishColSel.value = cur;
        finishColWrap.style.display = (parseInt(faceSel.value) > 0 && cols.length) ? "" : "none";
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
        var fasciaOK = (cat.fascia.panels || []).some(function (b) { return b.system === sysSel.value && b.height === h; });
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
        var treadsOK = ((cat.treads && cat.treads.treads) || []).some(function (t) { return t.height === h; });
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
          return { label: k.label, partNumber: deck ? deck.partNumber : null, qty: k.qty, category: "Deck" };
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
          items.push({ label: leg.label, partNumber: leg.partNumber, qty: legQty, category: "Deck" });
          heightLabel = leg.height; heightVal = leg.height;
          legsHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Legs</div>' +
            '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + leg.label + '</span><span style="color:#111;font-weight:500;">x ' + legQty + '</span></div>';
        }

        // carpet (deck top; not height-dependent)
        var carpetHtml = "", carpetColour = "";
        if (carpetSel.value) {
          var cpt = carpetKit({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), colour: carpetSel.value, carpet: cat.carpet });
          state.carpetKit = cpt; // stash for tape-metreage calc later
          if (cpt.available && cpt.items.length) {
            cpt.items.forEach(function (it) { items.push(Object.assign({}, it, { category: "Carpet" })); });
            carpetColour = carpetSel.value;
            carpetHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Carpet (' + carpetColour + ')</div>' +
              cpt.items.map(function (it) { return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>'; }).join("");
          }
        }

        // fascia (colour-independent panels + a per-metre finish line)
        var sides = parseInt(faceSel.value) || 0;
        var fasciaHtml = "", fasciaFinish = "", fasciaPlacements = [], fasciaFinishCost = 0, fasciaFinishType = "";
        if (sides > 0 && heightVal != null) {
          var fk = fasciaKit({ system: sysSel.value, width: parseFloat(wIn.value), depth: parseFloat(dIn.value), sides: sides, height: heightVal, finishType: finishSel.value, finishColour: finishColSel.value, fascia: cat.fascia });
          if (!fk.available) {
            fasciaHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Fascia</div>' +
              '<div style="font-size:12px;color:#b07b00;">No fascia at ' + heightVal + 'mm</div>';
          } else if (fk.items.length) {
            fk.items.forEach(function (it) { items.push(Object.assign({}, it, { category: "Fascia" })); });
            fasciaFinish = finishColSel.value;
            fasciaFinishType = fk.finishLabel;
            fasciaPlacements = fk.placements;
            fasciaFinishCost = fk.finishCost;
            fasciaHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Fascia (' + fk.finishLabel + ' &ndash; ' + fasciaFinish + ')</div>' +
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
            tk.items.forEach(function (it) { items.push(Object.assign({}, it, { category: "Trim" })); });
            trimFinish = trimSel.value;
            trimPlacements = tk.placements;
            trimHtml = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">Trim (' + trimFinish + ')</div>' +
              tk.items.map(function (it) { return '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>'; }).join("");
          }
        }

        // treads (steps up to the stage; height matches the stage, carpeted in the stage colour)
        var treadsHtml = "", treadBoxHtml = "", treadUnits = parseInt(treadsSel.value) || 0, treadHeight = heightVal;
        if (treadUnits > 0 && treadHeight) {
          var trd = treadsKit({ system: sysSel.value, height: treadHeight, units: treadUnits, colour: (carpetSel.value || "black"), hasFascia: fasciaPlacements.length > 0, treads: cat.treads, carpet: cat.carpet });
          if (trd.available && trd.items.length) {
            trd.items.forEach(function (it) { items.push(Object.assign({}, it, { category: "Treads" })); });
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

        // Accessories: appended per-category (Deck / Carpet / Trim). NOT shown in
        // the preview kit list. Trim Corner Clip uses qtyPerCorner * corner count
        // (sides 2 -> 1, 3 -> 2, 4 -> 4).
        function pushAccessories(catName, corners) {
          var list = (cat.accessories && cat.accessories[catName]) || [];
          list.forEach(function (a) {
            var qty = (typeof a.qtyPerCorner === "number") ? (a.qtyPerCorner * corners) : (a.qty || 0);
            if (qty > 0) items.push({ label: a.label, partNumber: a.partNumber, qty: qty, category: catName });
          });
        }
        pushAccessories("Deck", 0);
        if (carpetHtml) pushAccessories("Carpet", 0);
        if (trimHtml) {
          var cornerCount = sides === 4 ? 4 : (sides === 3 ? 2 : (sides === 2 ? 1 : 0));
          pushAccessories("Trim", cornerCount);
        }

        // Tape consumables (dynamic, not in accessories.json):
        //   Has carpet + colour X -> TAPE-01 (rolls calc'd from perimeter + seams,
        //   50m per roll) + colour-matched gaffer pair under CARPET sub-heading.
        //   No carpet -> a single TAPE-04 (white 25mm gaffer) under DECK.
        // Colour rules: black -> 50mm black + 25mm white; white -> 50mm white +
        // 25mm black; grey -> black+white (same as black rule per spec).
        var TAPE_GAFFER = {
          black: [{ pn: "TAPE-03", label: "Black Gaffer Tape 50mm", qty: 1 }, { pn: "TAPE-04", label: "White Gaffer Tape 25mm", qty: 1 }],
          white: [{ pn: "TAPE-02", label: "White Gaffer Tape 50mm", qty: 1 }, { pn: "TAPE-05", label: "Black Gaffer Tape 25mm", qty: 1 }],
          grey:  [{ pn: "TAPE-03", label: "Black Gaffer Tape 50mm", qty: 1 }, { pn: "TAPE-04", label: "White Gaffer Tape 25mm", qty: 1 }]
        };
        var TAPE_ROLL_M = 50;
        if (carpetHtml && state.carpetKit && carpetColour) {
          var strips = (state.carpetKit.combo || []).length;
          var seamLen = state.carpetKit.cutLength || 0;
          var perim = 2 * (parseFloat(wIn.value) + parseFloat(dIn.value));
          var tapeM = perim + Math.max(0, strips - 1) * seamLen;
          var dsRolls = Math.max(1, Math.ceil(tapeM / TAPE_ROLL_M));
          items.push({ label: "Double Sided Tape (" + tapeM + "m: perimeter+seams)", partNumber: "TAPE-01", qty: dsRolls, category: "Carpet" });
          // Fascia covers the deck edge, so the gaffer pair (edge-finishing) is
          // redundant when fascia is present. Carpet + fascia => TAPE-01 only.
          if (!fasciaHtml) {
            (TAPE_GAFFER[carpetColour] || []).forEach(function (t) {
              items.push({ label: t.label, partNumber: t.pn, qty: t.qty, category: "Carpet" });
            });
          }
        } else if (!carpetHtml) {
          items.push({ label: "White Gaffer Tape 25mm", partNumber: "TAPE-04", qty: 1, category: "Deck" });
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
        state.treadUnits = treadsHtml ? treadUnits : 0; state.treadHeight = treadHeight;
        state.treadColour = ({ black: "#333333", white: "#e8e8e8", grey: "#9a9a9a" })[(carpetSel.value || "black")] || "#333333";
        var cap = function (x) { return x ? x.charAt(0).toUpperCase() + x.slice(1) : x; };
        // Short heading name + a full finishing breakdown for the memo/description.
        var memoParts = [];
        if (fasciaFinish) memoParts.push(sides + " Sided");
        if (carpetColour) memoParts.push(cap(carpetColour) + " Carpet");
        if (trimFinish) memoParts.push(cap(trimFinish) + " Trim");
        if (fasciaFinish) memoParts.push(cap(fasciaFinish) + " " + fasciaFinishType + " Fascia");
        if (treadsHtml) memoParts.push(treadUnits + " Tread" + (treadUnits > 1 ? "s" : ""));
        state.memo = memoParts.join(", ");
        var sysUnit = (cat.systems[sysSel.value] && cat.systems[sysSel.value].unit) || "";
        state.title = "Stage " + (+parseFloat(wIn.value)) + "x" + (+parseFloat(dIn.value)) + sysUnit + (heightLabel ? " @ " + heightLabel + "mm" : "") + (state.memo ? " with Finishing" : "");

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
        // Re-read the tree selection now (user may have selected a folder while the dialog was open)
        state.parentHeadingId = selectedParentHeadingId(inst);
        state.parentHeadingTitle = state.parentHeadingId ? (function () {
          try { var n = inst.items_to_supply_tree.jstree(true).get_node("a" + state.parentHeadingId); return n && n.data ? n.data.title : ""; } catch (e) { return ""; }
        })() : "";
        foot.innerHTML = "";
        var msg = el("div", null, "flex:1;font-size:13px;color:#333;");
        msg.textContent = "Add '" + state.title + "'" + (state.parentHeadingTitle ? " inside '" + state.parentHeadingTitle + "'" : " as a new folder") + "?";
        var no = el("button", null, "padding:8px 14px;font-size:14px;cursor:pointer;");
        no.textContent = "Cancel"; no.addEventListener("click", render);
        var yes = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
        yes.textContent = "Confirm add"; yes.addEventListener("click", doAdd);
        foot.appendChild(msg); foot.appendChild(no); foot.appendChild(yes);
      }

      var busyFoot = function (txt) { foot.innerHTML = '<div style="flex:1;display:flex;align-items:center;gap:10px;font-size:13px;color:#555;"><span class="hh-spin" style="width:16px;height:16px;border-width:2px;"></span>' + txt + '</div>'; };

      function doAdd() {
        busyFoot("Building the PDF&hellip;");
        var code = genCode();
        var memo = state.memo || "";
        var description = memo ? (code + " - " + memo) : code; // Item description = code + finishing breakdown
        var parentHeadingId = state.parentHeadingId || null; // "insert at cursor": nest under the user-selected folder
        var snapshot = { result: state.result, width: state.width, depth: state.depth, height: state.height, sysUnit: ((cat.systems[sysSel.value] && cat.systems[sysSel.value].unit) || ""), fasciaPlacements: state.fasciaPlacements, trimPlacements: state.trimPlacements, items: state.items.slice(), title: state.title, memo: memo, treadUnits: state.treadUnits, treadHeight: state.treadHeight, treadColour: state.treadColour };
        function insert(built) {
          busyFoot("Adding to the job&hellip;"); // autopull is handled inside addStageKit, before the custom rows
          addStageKit(inst, state.items, state.title, function (r) {
            if (r.ok) { if (built) uploadPdf(built.pdf, built.fileName); close(); }
            else {
              foot.innerHTML = "";
              var err = el("div", null, "flex:1;font-size:13px;color:#b00;");
              err.textContent = r.error;
              var back = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
              back.textContent = "Back"; back.addEventListener("click", render);
              foot.appendChild(err); foot.appendChild(back);
            }
          }, description, memo, parentHeadingId);
        }
        // Build the PDF. On the click's user gesture, offer a local "Save As"
        // ONLY for companies opted into the pdfSavePrompt feature in branding.json
        // (whitelist of user.COMPANY_ID). All companies still get the PDF uploaded
        // to the Files tab via insert->uploadPdf.
        var myCompanyId = (typeof user !== "undefined" && user && user.COMPANY_ID) || null;
        var savePromptIds = ((cat.branding && cat.branding.features && cat.branding.features.pdfSavePrompt && cat.branding.features.pdfSavePrompt.companyIds) || []).map(function (n) { return +n; });
        var wantsLocalSave = savePromptIds.indexOf(+myCompanyId) >= 0;
        buildPdf(snapshot, code, cat.branding).then(function (built) {
          if (wantsLocalSave) return savePdfLocal(built.pdf, built.fileName).then(function () { insert(built); });
          insert(built);
        }).catch(function () { insert(null); });
      }

      sysSel.addEventListener("change", function () { applySystemBounds(); populateHeights(); populateFasciaSides(); populateTreads(); syncFasciaControls(); syncTreadsControl(); render(); });
      wIn.addEventListener("input", render);
      dIn.addEventListener("input", render);
      hSel.addEventListener("change", function () { syncFasciaControls(); syncTreadsControl(); render(); });
      faceSel.addEventListener("change", function () { populateFinishes(); populateTrimFinishes(); render(); });
      finishSel.addEventListener("change", function () { populateFinishColours(); render(); });
      finishColSel.addEventListener("change", render);
      trimSel.addEventListener("change", render);
      carpetSel.addEventListener("change", render);
      treadsSel.addEventListener("change", render);

      document.body.appendChild(backdrop);
      applySystemBounds();
      populateHeights();
      populateFasciaSides();
      populateTreads();
      syncFasciaControls();
      syncTreadsControl();
      render();
      loadJsPdf().catch(function () { }); // warm up so the save dialog stays within the click gesture
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
