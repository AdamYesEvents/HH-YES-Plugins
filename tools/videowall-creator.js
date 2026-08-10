/*!
 * HireHop Tool: Videowall Creator
 * Loaded by loader.js (window.HHTools.register).
 *
 * Baseline-questions wizard that produces a videowall kit and (later) inserts
 * it into the job under a "Videowall WxH ..." heading. The framework mirrors
 * stage-designer.js (self-contained overlay dialog, pure logic + browser UI).
 *
 * Q0  Pitch          2.6mm Uniview UR Pro (indoor only) / 3.9mm Chauvet REM
 * Q1  Environment    Indoor / Outdoor (Outdoor disabled for 2.6mm)
 * Q2  Support        Flown / Ground supported
 * Q2.5 Rigging       Clamp / Sling  -  ONLY for Chauvet 3.9mm + Flown.
 *                    Uniview 2.6mm + Flown is sling-only, so Q2.5 is skipped.
 * Q3  Width, Height  metres, 0.5m increments (panels are 500 x 1000)
 * Q4  Processor      Behind screen / Within 70m  (signal cables STILL TBD)
 *
 * Hardware part numbers wired in (v0.5.0): panels + flown rigging + ground
 * support kit line. Still TBD:
 *   - LSU connecting bar YW-codes (product code LSU-CONNB-L150 used as label
 *     placeholder; Adam to supply YW codes)
 *   - LSU weight plates YW-02892 - not auto-added yet; ballast formula on the
 *     backlog (a 3m wall needs 3 plates even though the kits supply 4)
 *   - LSU 30cm topper YW-04062 - height rule TBD
 *   - Processor + signal cables - hardware-first release; Chauvet has no
 *     starter cable, Uniview has YW-04070 Ethercon, but neither wired yet
 *
 * Job insertion wired in (v0.6.0): mirrors stage-designer's addStageKit flow.
 * Creates a top-level Grouped heading, then sub-headings Screen / Spares /
 * Rigging. Processor + Cable sub-headings intentionally skipped this release
 * (parts still TBD); the top-level title still says "inc Processor" as a
 * reminder for the pick crew.
 *
 * Spares logic (v0.7.0): panels are cased (1000x500 = 4/case, 500x500 = 8/case).
 * We round the used qty up to the next case and put the leftover in the Spares
 * sub-heading; if the wall lands exactly on a full case (no natural spare) we
 * add a whole extra case as spares. Each spare line then gets HireHop's "100%
 * applied" state (unit_price preserved, price forced to 0) via a follow-up POST
 * to items_save.php after the batch save settles.
 *
 * PDF generation is TEMPORARILY BLOCKED - see PDF_ENABLED below. When ready,
 * flip the flag on and reformat buildVideowallPdf() to match the final layout
 * (do not delete the scaffolding).
 *
 * Version: 0.7.0
 */

(function () {

  // ===========================================================================
  // PURE LOGIC
  // ===========================================================================

  var EPS = 1e-6;
  function isMult(v, step) { var q = v / step; return Math.abs(q - Math.round(q)) < EPS; }

  // Flown rigging bars: prefer 1m, allow one 0.5m add-on. Width must be a
  // multiple of 0.5m.
  //   4.0m -> 4x 1m
  //   4.5m -> 4x 1m + 1x 0.5m
  //   5.0m -> 5x 1m
  function flownRig(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return null;
    var whole = Math.floor(W + EPS);
    var half  = Math.abs(W - whole - 0.5) < EPS ? 1 : 0;
    return { bars_1: whole, bars_05: half };
  }

  // 2.6mm indoor ground support - kits (2m bays) with a 0.5m spare per case.
  // Cases needed = max(1, ceil((W - 0.5) / 2)) because each additional case
  // adds 2m of coverage; the very first case's 0.5m spare bridges to 2.5m.
  //   4.0m -> 2 kits (4x 1m)
  //   4.5m -> 2 kits (4x 1m + 1x 0.5m)
  //   5.0m -> 3 kits (5x 1m)
  // Each kit contains 2x 1m + 1x 0.5m bars.
  function ground26Kit(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    var whole = Math.floor(W + EPS);
    var half  = Math.abs(W - whole - 0.5) < EPS ? 1 : 0;
    var kits  = Math.max(1, Math.ceil((W - 0.5 - EPS) / 2));
    return {
      ok: true,
      kits: kits,
      bars_1: whole,
      bars_05: half,
      kitContents: { bars_1: 2 * kits, bars_05: 1 * kits }
    };
  }

  // 3.9mm ground support - primary bays of 1.5m or 2m, plus one optional 1m
  // filler.  Base case contains 2x 1m comb bars (fillers).  Extra 1.5m and 2m
  // bars are spec'd separately.
  // Achievable widths and preferred decomposition (matches the spec):
  //   1.5 -> 1 x 1.5
  //   2.0 -> 1 x 2
  //   2.5 -> NOT achievable
  //   3.0 -> 2 x 1.5
  //   3.5 -> 1 x 1.5 + 1 x 2
  //   4.0 -> 2 x 1.5 + 1 x 1
  //   4.5 -> 3 x 1.5
  //   5.0 -> 2 x 1.5 + 1 x 2
  //   5.5 -> 3 x 1.5 + 1 x 1
  //   6.0 -> 4 x 1.5
  //   6.5 -> 3 x 1.5 + 1 x 2
  //   7.0 -> 4 x 1.5 + 1 x 1
  function ground39Kit(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    if (W < 1.5 - EPS) return { ok: false, error: "3.9mm ground support minimum is 1.5m" };
    if (Math.abs(W - 1.5) < EPS) return { ok: true, kits: 1, bars_15: 1, bars_2: 0, bars_1: 0 };
    if (Math.abs(W - 2.0) < EPS) return { ok: true, kits: 1, bars_15: 0, bars_2: 1, bars_1: 0 };
    if (W < 3.0 - EPS) return { ok: false, error: W + "m not achievable in 3.9mm (try 2m or 3m)" };
    for (var N = 2; N <= 40; N++) {
      var base = 1.5 * N;
      if (Math.abs(W - base) < EPS)         return { ok: true, kits: 1, bars_15: N,     bars_2: 0, bars_1: 0 };
      if (Math.abs(W - (base + 0.5)) < EPS) return { ok: true, kits: 1, bars_15: N - 1, bars_2: 1, bars_1: 0 };
      if (Math.abs(W - (base + 1.0)) < EPS) return { ok: true, kits: 1, bars_15: N,     bars_2: 0, bars_1: 1 };
      if (W < base) break;
    }
    return { ok: false, error: W + "m not achievable with 3.9mm system" };
  }

  // Spare panels come cased - one leftover partial case worth, OR a whole
  // extra case if the wall lands exactly on a full case.
  //   caseSize 4:   3 used -> 1 spare, 4 -> 4, 5 -> 3, 8 -> 4, 18 -> 2, 20 -> 4
  //   caseSize 8:   6 used -> 2 spare, 8 -> 8, 10 -> 6
  function computeSpares(used, caseSize) {
    if (!(used > 0)) return 0;
    var rem = used % caseSize;
    return rem === 0 ? caseSize : (caseSize - rem);
  }

  // Compute the full kit from the answered questions.
  //   opts = { pitch:       "2.6mm" | "3.9mm",
  //            environment: "indoor" | "outdoor",
  //            support:     "flown" | "ground",
  //            rigging:     "clamp" | "sling"       (Outdoor + Flown only),
  //            width:       metres, multiples of 0.5,
  //            height:      metres, multiples of 0.5,
  //            processor:   "behind" | "far" }
  function computeKit(opts) {
    opts = opts || {};
    if (!opts.pitch || !opts.environment || !opts.support || !opts.processor)
      return { ok: false, error: "Answer every question" };
    if (opts.pitch !== "2.6mm" && opts.pitch !== "3.9mm")
      return { ok: false, error: "Pitch must be 2.6mm or 3.9mm" };
    if (opts.pitch === "2.6mm" && opts.environment === "outdoor")
      return { ok: false, error: "2.6mm is indoor only" };

    var W = +opts.width, H = +opts.height;
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    if (!(H > 0) || !isMult(H, 0.5)) return { ok: false, error: "Height must be a multiple of 0.5m" };

    // Panel geometry - 500w panels in two heights (1000h and 500h).
    // Per column stack: N x 1000h + (1 x 500h if H has a 0.5m remainder).
    //   1.5m column -> 1x 1000 + 1x 500
    //   2.0m column -> 2x 1000
    //   2.5m column -> 2x 1000 + 1x 500
    var cols = Math.round(W / 0.5);
    var fullPerCol = Math.floor(H + EPS);
    var halfPerCol = Math.abs(H - fullPerCol - 0.5) < EPS ? 1 : 0;
    var rows = fullPerCol + halfPerCol;
    var fullPanels = cols * fullPerCol;
    var halfPanels = cols * halfPerCol;
    var panels = fullPanels + halfPanels;

    var items = [];

    // Panels branch by pitch (product family).
    //   3.9mm - Chauvet REM (indoor OR outdoor):  YW-00341 1000x500, YW-00342 500x500
    //   2.6mm - Uniview UR Pro (indoor only):     YW-04066 1000x500, YW-04067 500x500
    var isUniview = (opts.pitch === "2.6mm");
    var panelFullLabel = isUniview
      ? "Uniview UR Pro 2.6mm panel 1000x500"
      : "Chauvet REM 3.9mm panel 1000x500";
    var panelHalfLabel = isUniview
      ? "Uniview UR Pro 2.6mm panel 500x500"
      : "Chauvet REM 3.9mm panel 500x500";
    var panelFullPN = isUniview ? "YW-04066" : "YW-00341";
    var panelHalfPN = isUniview ? "YW-04067" : "YW-00342";
    if (fullPanels > 0) {
      items.push({ category: "Screen", label: panelFullLabel, partNumber: panelFullPN, qty: fullPanels });
      var spareFull = computeSpares(fullPanels, 4);
      if (spareFull > 0) items.push({ category: "Spares", label: panelFullLabel, partNumber: panelFullPN, qty: spareFull, hundredPercent: true });
    }
    if (halfPanels > 0) {
      items.push({ category: "Screen", label: panelHalfLabel, partNumber: panelHalfPN, qty: halfPanels });
      var spareHalf = computeSpares(halfPanels, 8);
      if (spareHalf > 0) items.push({ category: "Spares", label: panelHalfLabel, partNumber: panelHalfPN, qty: spareHalf, hundredPercent: true });
    }

    // ---- Rigging / support --------------------------------------------------
    if (opts.support === "flown") {
      var rig = flownRig(W);
      // Rigging bars: Chauvet has clamp OR sling; Uniview is sling-only.
      // Chauvet REM Header Bar:   1m clamp YW-00343, 1m sling YW-00344,
      //                           0.5m curve clamp YW-00345, 0.5m curve sling YW-00346.
      // Uniview UR Pro Rigging Bar (sling only): 1m YW-04068, 0.5m YW-04069.
      var useClamp = false;
      if (isUniview) {
        // Uniview flown - always sling.
      } else {
        if (!opts.rigging) return { ok: false, error: "Choose Clamp or Sling for a flown Chauvet wall" };
        if (opts.rigging !== "clamp" && opts.rigging !== "sling")
          return { ok: false, error: "Rigging must be clamp or sling" };
        useClamp = (opts.rigging === "clamp");
      }
      if (rig) {
        if (isUniview) {
          if (rig.bars_1 > 0)  items.push({ category: "Rigging", label: "Uniview UR Pro Rigging Bar 1m on Sling",    partNumber: "YW-04068", qty: rig.bars_1 });
          if (rig.bars_05 > 0) items.push({ category: "Rigging", label: "Uniview UR Pro Rigging Bar 0.5m on Sling", partNumber: "YW-04069", qty: rig.bars_05 });
        } else if (useClamp) {
          if (rig.bars_1 > 0)  items.push({ category: "Rigging", label: "Chauvet REM 1m Header Bar on Clamp",         partNumber: "YW-00343", qty: rig.bars_1 });
          if (rig.bars_05 > 0) items.push({ category: "Rigging", label: "Chauvet REM 0.5m Curve Header Bar on Clamp", partNumber: "YW-00345", qty: rig.bars_05 });
        } else {
          if (rig.bars_1 > 0)  items.push({ category: "Rigging", label: "Chauvet REM 1m Header Bar on Sling",         partNumber: "YW-00344", qty: rig.bars_1 });
          if (rig.bars_05 > 0) items.push({ category: "Rigging", label: "Chauvet REM 0.5m Curve Header Bar on Sling", partNumber: "YW-00346", qty: rig.bars_05 });
        }
      }
    } else {
      // Ground support - kit differs by pitch.
      // Uniview 2.6mm:  YW-04065 Ground Support Kit (2 uprights).
      // Chauvet 3.9mm:  YW-00169 LSU Set (2 uprights) + LSU Connecting Bars
      //                 (LSU-CONNB-L150 - YW code to follow).
      // Weight plates (YW-02892) NOT auto-added yet - ballast formula on the
      // backlog (a 3m wall needs 3 plates even though the kits supply 4).
      // LSU 30cm topper (YW-04062) also TBD - height threshold undecided.
      if (isUniview) {
        var g26 = ground26Kit(W);
        if (!g26.ok) return { ok: false, error: g26.error };
        items.push({ category: "Rigging", label: "Uniview UR Pro Ground Support Kit (2 uprights)", partNumber: "YW-04065", qty: g26.kits });
      } else {
        var g39 = ground39Kit(W);
        if (!g39.ok) return { ok: false, error: g39.error };
        items.push({ category: "Rigging", label: "LSU Set (2 uprights) Kit", partNumber: "YW-00169", qty: g39.kits });
        if (g39.bars_15 > 0) items.push({ category: "Rigging", label: "LSU Connecting Bar 1.5m", partNumber: "LSU-CONNB-L150", qty: g39.bars_15 });
        if (g39.bars_2  > 0) items.push({ category: "Rigging", label: "LSU Connecting Bar 2m",   partNumber: "LSU-CONNB-L200", qty: g39.bars_2 });
      }
    }

    // ---- Processor + signal -------------------------------------------------
    // Deferred: no part numbers yet. Chauvet has no starter cable; Uniview has
    // YW-04070 Ethercon; a processor code is still TBD. When ready, add items
    // here with category "Processor" and "Cable" (also un-skip those categories
    // in the ORDER + INSERT arrays in the browser section, and switch the
    // "inc Processor" suffix to reflect what's actually shipping).

    return {
      ok: true,
      items: items,
      cols: cols, rows: rows, panels: panels,
      fullPanels: fullPanels, halfPanels: halfPanels,
      width: W, height: H
    };
  }

  // Front-elevation SVG of the wall - grid of 500w panels. Top row is drawn
  // at half height when the wall's H has a 0.5m remainder (500h panels).
  function buildWallSvg(cols, rows, opts) {
    opts = opts || {};
    var maxW = opts.maxW || 420, maxH = opts.maxH || 260, pad = 24;
    var height = opts.height || rows;                       // wall height in metres
    var trim = Math.max(0, rows - height);                  // 0 or 0.5 typically
    // Panels are 0.5m wide x 1m high in real units; scale so the wall fits the box.
    var wPx = (maxW - pad * 2) / (cols * 0.5);
    var hPx = (maxH - pad * 2) / height;
    var unit = Math.max(6, Math.min(wPx, hPx));             // px per metre
    var panelW = 0.5 * unit, panelH = 1.0 * unit;
    var W = panelW * cols, H = unit * height;
    var SW = W + pad * 2, SH = H + pad * 2;
    var ox = pad, oy = pad;
    var cells = "";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        // The TOP row (r==0) is trimmed when height isn't a whole metre.
        var y = oy + (r === 0 ? 0 : (r - trim) * panelH);
        var h = r === 0 ? (1 - trim) * panelH : panelH;
        cells += '<rect x="' + (ox + c * panelW + 1) + '" y="' + (y + 1) +
          '" width="' + (panelW - 2) + '" height="' + (h - 2) +
          '" fill="#1D1D3C" stroke="#26215C" stroke-width="1"/>';
      }
    }
    var frame = '<rect x="' + (ox - 0.5) + '" y="' + (oy - 0.5) + '" width="' + (W + 1) + '" height="' + (H + 1) + '" fill="none" stroke="#26215C" stroke-width="2"/>';
    var wLbl = '<text x="' + (ox + W / 2) + '" y="' + (SH - 6) + '" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#666" text-anchor="middle">' + (cols * 0.5) + ' m wide</text>';
    var hLbl = '<text x="' + (SW - 8) + '" y="' + (oy + H / 2) + '" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#666" text-anchor="middle" transform="rotate(90 ' + (SW - 8) + ' ' + (oy + H / 2) + ')">' + height + ' m high</text>';
    return '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" xmlns="http://www.w3.org/2000/svg">' + cells + frame + wLbl + hLbl + '</svg>';
  }

  // ===========================================================================
  // PDF - TEMP BLOCK. Keep the scaffolding; reformat + re-enable when ready.
  // ===========================================================================
  var PDF_ENABLED = false;

  // Placeholder that mirrors stage-designer's buildPdf() signature. When
  // re-enabling: copy the loadJsPdf() + branding-logo + jsPDF layout from
  // stage-designer.js, adapt to the wall front-elevation, and flip PDF_ENABLED.
  function buildVideowallPdf(/* snapshot, branding */) {
    return Promise.reject(new Error("PDF generation temporarily disabled"));
  }

  // ===========================================================================
  // NODE EXPORT (no-op in the browser)
  // ===========================================================================
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      computeKit: computeKit, buildWallSvg: buildWallSvg,
      flownRig: flownRig, ground26Kit: ground26Kit, ground39Kit: ground39Kit,
      computeSpares: computeSpares
    };
  }

  // ===========================================================================
  // BROWSER: dialog + registration
  // ===========================================================================
  if (typeof window === "undefined") return;

  // ===========================================================================
  // HireHop insertion machinery (adapted from stage-designer.js's addStageKit).
  // Adds a top-level Grouped heading with sub-headings (Screen / Spares /
  // Rigging), resolves each part number to a stock item, batch-saves resolved
  // items under each sub-heading, and falls back to a custom "[code] label"
  // line for anything HireHop doesn't recognise (e.g. LSU-CONNB-L150 until it
  // gets a real YW code).
  // ===========================================================================

  var RESOLVE_MAX_TRIES        = 3;
  var RESOLVE_RETRY_MS         = 800;
  var HEADING_SETTLE_MS        = 3000;
  var HEADING_MAX_RETRIES      = 2;
  var HEADING_RETRY_BACKOFF_MS = 9000;
  var HEADING_TIMEOUT_MS       = 20000;
  var CUSTOM_ROW_GAP_MS        = 3000;
  // Sub-heading order in HireHop. "Spares" is always created empty for now -
  // a placeholder for manual entry until spare-count logic is designed.
  // Processor + Cable intentionally omitted this release.
  var INSERT_ORDER  = ["Screen", "Spares", "Rigging"];
  var ALWAYS_CREATE = { Spares: true };

  function resolvePart(inst, partNumber, qty) {
    return resolvePartAttempt(inst, partNumber, qty, 0, null);
  }
  function resolvePartAttempt(inst, partNumber, qty, tries, lastReply) {
    if (tries >= RESOLVE_MAX_TRIES) return Promise.resolve(lastReply || { error: -1 });
    var params = {
      id: "vw_" + Date.now() + "_" + Math.random().toString(36).slice(2),
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
            return new Promise(function (res) { setTimeout(function () { res(resolvePartAttempt(inst, partNumber, qty, tries + 1, d)); }, RESOLVE_RETRY_MS); });
          }
          try { console.warn("[videowall-creator] resolve failed for", partNumber, "-> custom fallback"); } catch (e) { }
          return d;
        }
        return d;
      })
      .catch(function (err) {
        if (tries + 1 < RESOLVE_MAX_TRIES) {
          return new Promise(function (res) { setTimeout(function () { res(resolvePartAttempt(inst, partNumber, qty, tries + 1, { error: -2 })); }, RESOLVE_RETRY_MS); });
        }
        try { console.warn("[videowall-creator] resolve error for", partNumber, err && err.message); } catch (e) { }
        return { error: -2 };
      });
  }

  function headingIdSet(inst) {
    var ids = {}, tree = inst.items_to_supply_tree.jstree(true);
    (tree.get_json("#", { flat: true }) || []).forEach(function (n) { if (n.data && n.data.kind == 0) ids[n.data.ID] = true; });
    return ids;
  }

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

  function findAutopullDialog() {
    return Array.prototype.slice.call(document.querySelectorAll(".ui-dialog")).filter(function (d) {
      return d.offsetParent !== null && /autopull/i.test((d.querySelector(".ui-dialog-title") || {}).textContent || "");
    })[0];
  }
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

  function createHeading(inst, title, parentHeadingId, flag) {
    return createHeadingAttempt(inst, title, parentHeadingId, flag, 0);
  }
  function createHeadingAttempt(inst, title, parentHeadingId, flag, attempt) {
    var before = headingIdSet(inst);
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all();
    if (parentHeadingId) {
      tree.select_node("a" + parentHeadingId);
      try { inst.set_item_edit_tree_headings(); } catch (e) { }
    }
    inst.new_item(0);
    inst.heading_name.val(title);
    if (typeof flag === "number" && inst.item_edit_flag) inst.item_edit_flag.val(flag);
    inst.save_item();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        var now = headingIdSet(inst);
        var newId = Object.keys(now).filter(function (id) { return !before[id]; })[0];
        if (newId) { clearInterval(iv); setTimeout(function () { resolve(parseInt(newId)); }, HEADING_SETTLE_MS); return; }
        var errDlg = findVisibleErrorDialog();
        if (errDlg && attempt < HEADING_MAX_RETRIES) {
          clearInterval(iv);
          closeErrorDialog(errDlg);
          try { if (inst.item_edit_dlg && inst.item_edit_dlg.dialog("isOpen")) inst.item_edit_dlg.dialog("close"); } catch (e) { }
          setTimeout(function () {
            createHeadingAttempt(inst, title, parentHeadingId, flag, attempt + 1).then(resolve);
          }, HEADING_RETRY_BACKOFF_MS);
          return;
        }
        if (Date.now() - start > HEADING_TIMEOUT_MS) {
          clearInterval(iv);
          if (attempt < HEADING_MAX_RETRIES) {
            try { if (inst.item_edit_dlg && inst.item_edit_dlg.dialog("isOpen")) inst.item_edit_dlg.dialog("close"); } catch (e) { }
            setTimeout(function () {
              createHeadingAttempt(inst, title, parentHeadingId, flag, attempt + 1).then(resolve);
            }, HEADING_RETRY_BACKOFF_MS);
          } else resolve(null);
        }
      }, 200);
    });
  }

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
        inst.save_item();
      } catch (e) { try { console.warn("[videowall-creator] custom row failed:", it.partNumber, e && e.message); } catch (x) { } }
      setTimeout(next, CUSTOM_ROW_GAP_MS);
    })();
  }

  function groupByCategory(items) {
    var groups = {};
    items.forEach(function (it) {
      var cat = it.category || "Other";
      (groups[cat] = groups[cat] || []).push(it);
    });
    return groups;
  }

  function resolveAllByCategory(inst, groups) {
    var shoppingByCat = {}, customsByCat = {};
    INSERT_ORDER.forEach(function (c) { shoppingByCat[c] = {}; customsByCat[c] = []; });
    var chain = Promise.resolve();
    INSERT_ORDER.forEach(function (cat) {
      (groups[cat] || []).forEach(function (it) {
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

  function insertOneCategory(inst, subHeadingId, shopping, customs, done) {
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
      // Videowall kits don't trigger HireHop's Autopull dialog the way stage's
      // Deck bolts do, but we still give it a beat before starting customs.
      setTimeout(doCustoms, 3500);
    } else {
      doCustoms();
    }
  }

  // ---- Post-insert: apply HireHop's "100% applied" state (price = 0) to a
  // set of freshly-inserted stock lines. Called for the Spares sub-heading
  // after its batch save has settled. Best-effort: logs and continues on any
  // per-line failure so a bad row doesn't strand the rest of the kit.
  function lineIdsUnder(inst, headingId) {
    try {
      var tree = inst.items_to_supply_tree.jstree(true);
      var node = tree.get_node("a" + headingId);
      if (!node || !node.children) return {};
      var ids = {};
      node.children.forEach(function (cid) {
        var kid = tree.get_node(cid);
        if (kid && kid.data && kid.data.kind !== 0 && kid.data.ID != null) {
          ids[kid.data.ID] = kid;
        }
      });
      return ids;
    } catch (e) { return {}; }
  }

  function saveLineHundredPercent(inst, lineNode) {
    var d = (lineNode && lineNode.data) || {};
    // Reconstruct enough of the items_save.php payload to preserve the line
    // while dropping the price to 0. Field set matches the payload Adam
    // captured (kind=2 stock line). Anything we don't have goes to defaults
    // that match a fresh HireHop insert.
    var payload = {
      id:               d.ID,
      kind:             (d.kind != null) ? d.kind : 2,
      job:              (inst.options && inst.options.main_id) || 0,
      parent:           d.parent || 0,
      list_id:          d.list_id || 0,
      qty:              d.qty || 1,
      unit_price:       (d.unit_price != null) ? d.unit_price : 0,
      price:            0,
      price_type:       (d.price_type != null) ? d.price_type : 2,
      flag:             0,
      priority_confirm: 0,
      weight:           d.weight || 0,
      vat_rate:         d.vat_rate || 0,
      value:            0,
      acc_nominal:      d.acc_nominal || 17,
      acc_nominal_po:   d.acc_nominal_po || 27,
      cost_price:       d.cost_price || 0,
      country_origin:   "",
      hs_code:          "",
      memo:             "",
      no_availability:  0,
      ignore:           0,
      name:             "",
      add:              "",
      cust_add:         "",
      outgoing:         "",
      returning:        "",
      start:            "",
      end:              "",
      local:            new Date().toISOString().slice(0, 19).replace("T", "+")
    };
    var body = Object.keys(payload).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(payload[k]);
    }).join("&");
    return fetch("/php_functions/items_save.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
      credentials: "same-origin"
    })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, body: t }; }); })
      .then(function (r) {
        if (!r.ok) { try { console.warn("[videowall-creator] items_save.php HTTP", r.status, "for line", d.ID); } catch (e) { } }
        return r;
      })
      .catch(function (err) {
        try { console.warn("[videowall-creator] items_save.php error for line", d.ID, err && err.message); } catch (e) { }
        return { ok: false, error: err };
      });
  }

  var DISCOUNT_GAP_MS = 800; // gentle spacing between line edits
  function applyHundredPercentToChildren(inst, headingId, before, done) {
    var after = lineIdsUnder(inst, headingId);
    var newIds = Object.keys(after).filter(function (id) { return !before[id]; });
    if (!newIds.length) { done(); return; }
    var i = 0;
    (function next() {
      if (i >= newIds.length) { done(); return; }
      var node = after[newIds[i++]];
      saveLineHundredPercent(inst, node).then(function () {
        setTimeout(next, DISCOUNT_GAP_MS);
      });
    })();
  }

  function addVideowallKit(inst, items, title, onDone) {
    var groups = groupByCategory(items);
    var parentId = selectedParentHeadingId(inst);
    resolveAllByCategory(inst, groups).then(function (res) {
      createHeading(inst, title, parentId, 5 /* Grouped */).then(function (mainId) {
        if (!mainId) { onDone({ ok: false, error: "Could not create the videowall folder" }); return; }
        var i = 0, parts = 0, customs = 0;
        function nextCategory() {
          if (i >= INSERT_ORDER.length) {
            dismissAutopullThen(function () {
              clickSupplyingRefresh(inst);
              onDone({ ok: true, headingId: mainId, parts: parts, customs: customs });
            });
            return;
          }
          var cat = INSERT_ORDER[i++];
          var shopping = res.shoppingByCat[cat] || {}, customList = res.customsByCat[cat] || [];
          var hasContent = Object.keys(shopping).length || customList.length;
          if (!hasContent && !ALWAYS_CREATE[cat]) { nextCategory(); return; }
          createHeading(inst, cat, mainId).then(function (subId) {
            if (!subId) { console.warn("[videowall-creator] sub-heading failed:", cat); nextCategory(); return; }
            parts += Object.keys(shopping).length;
            customs += customList.length;
            if (!hasContent) { nextCategory(); return; }
            // For Spares, snapshot existing line IDs so we can identify the
            // freshly-created ones and force their price to 0 afterwards.
            var isSpares = (cat === "Spares");
            var beforeIds = isSpares ? lineIdsUnder(inst, subId) : null;
            insertOneCategory(inst, subId, shopping, customList, function () {
              if (isSpares) applyHundredPercentToChildren(inst, subId, beforeIds, nextCategory);
              else nextCategory();
            });
          });
        }
        nextCategory();
      });
    });
  }

  var DIALOG_ID = "hh-videowall-creator-dialog";

  function el(tag, attrs, css) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (css) n.style.cssText = css;
    return n;
  }

  function injectSpinStyle() {
    if (document.getElementById("hh-vw-spin-style")) return;
    var s = document.createElement("style"); s.id = "hh-vw-spin-style";
    s.textContent = "@keyframes hh-vw-spin{to{transform:rotate(360deg)}} .hh-vw-spin{display:inline-block;width:20px;height:20px;border:3px solid #ddd;border-top-color:#2563eb;border-radius:50%;animation:hh-vw-spin .8s linear infinite;}";
    document.head.appendChild(s);
  }

  function openDialog(inst) {
    injectSpinStyle();
    var pre = document.getElementById(DIALOG_ID);
    if (pre) pre.parentNode.removeChild(pre);

    var backdrop = el("div", { id: DIALOG_ID }, "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;");
    var panel = el("div", null, "background:#fff;border-radius:8px;width:980px;max-width:96vw;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);");
    backdrop.appendChild(panel);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

    var head = el("div", null, "padding:18px 22px;border-bottom:1px solid #eee;");
    head.innerHTML =
      '<div style="font-size:18px;font-weight:600;color:#222;">Videowall Creator</div>' +
      '<div style="font-size:13px;color:#777;margin-top:2px;">Answer the baseline questions and we\'ll build the wall kit for this job.</div>';
    panel.appendChild(head);

    var body = el("div", null, "display:flex;gap:24px;padding:22px;");
    var colPreview  = el("div", null, "flex:1;min-width:320px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;");
    var colKit      = el("div", null, "width:260px;flex-shrink:0;");
    var colControls = el("div", null, "width:240px;flex-shrink:0;");
    body.appendChild(colPreview); body.appendChild(colKit); body.appendChild(colControls);
    panel.appendChild(body);

    function field(label) {
      var w = el("div", null, "margin-bottom:14px;");
      w.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>';
      return w;
    }
    function select(options) {
      var s = el("select", null, "width:100%;padding:8px;font-size:14px;");
      options.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
      return s;
    }

    // Q0 Pitch
    var pitchWrap = field("Pitch");
    var pitchSel  = select([["2.6mm", "2.6mm (indoor only)"], ["3.9mm", "3.9mm (indoor or outdoor)"]]);
    pitchWrap.appendChild(pitchSel); colControls.appendChild(pitchWrap);

    // Q1 Environment (options depend on pitch)
    var envWrap = field("Environment");
    var envSel  = select([["indoor", "Indoor"], ["outdoor", "Outdoor"]]);
    envWrap.appendChild(envSel); colControls.appendChild(envWrap);

    // Q2 Support
    var supWrap = field("Support");
    var supSel  = select([["ground", "Ground supported"], ["flown", "Flown"]]);
    supWrap.appendChild(supSel); colControls.appendChild(supWrap);

    // Q2.5 Rigging - ONLY for Outdoor + Flown
    var rigWrap = field("Rigging");
    var rigSel  = select([["clamp", "Clamp"], ["sling", "Sling"]]);
    rigWrap.appendChild(rigSel); colControls.appendChild(rigWrap);

    // Q3 W / H (0.5m increments)
    var wWrap = field("Width (m)");
    var wIn = el("input", { type: "number", min: "0.5", step: "0.5" }, "width:100%;padding:8px;font-size:14px;");
    wIn.value = "4"; wWrap.appendChild(wIn); colControls.appendChild(wWrap);

    var hWrap = field("Height (m)");
    var hIn = el("input", { type: "number", min: "1", step: "0.5" }, "width:100%;padding:8px;font-size:14px;");
    hIn.value = "3"; hWrap.appendChild(hIn); colControls.appendChild(hWrap);

    // Q4 Processor location
    var procWrap = field("Processor location");
    var procSel  = select([["behind", "Behind screen"], ["far", "Within 70m distance"]]);
    procWrap.appendChild(procSel); colControls.appendChild(procWrap);

    var kitBox = el("div", null, "font-size:13px;");
    colKit.appendChild(kitBox);

    var foot = el("div", null, "padding:14px 22px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;align-items:center;");
    panel.appendChild(foot);

    var state = { result: null, items: [], title: "" };

    // 2.6mm is indoor-only; disable Outdoor and force back to Indoor.
    function syncEnvOptions() {
      var outdoorOpt = Array.prototype.slice.call(envSel.options).filter(function (o) { return o.value === "outdoor"; })[0];
      if (pitchSel.value === "2.6mm") {
        outdoorOpt.disabled = true;
        if (envSel.value === "outdoor") envSel.value = "indoor";
      } else {
        outdoorOpt.disabled = false;
      }
    }

    // Rigging (clamp/sling) only for Chauvet 3.9mm + Flown.
    // Uniview 2.6mm flown is sling-only, so we skip the question.
    function syncRiggingVisibility() {
      rigWrap.style.display = (supSel.value === "flown" && pitchSel.value === "3.9mm") ? "" : "none";
    }

    function render() {
      syncEnvOptions();
      syncRiggingVisibility();
      var res = computeKit({
        pitch:       pitchSel.value,
        environment: envSel.value,
        support:     supSel.value,
        rigging:     (supSel.value === "flown" && pitchSel.value === "3.9mm") ? rigSel.value : null,
        width:       parseFloat(wIn.value),
        height:      parseFloat(hIn.value),
        processor:   procSel.value
      });
      state.result = res;

      if (!res.ok) {
        colPreview.innerHTML = "";
        kitBox.innerHTML = '<div style="color:#b00;font-size:13px;">' + res.error + '</div>';
        renderFooter(false, res.error);
        return;
      }

      colPreview.innerHTML = buildWallSvg(res.cols, res.rows, { height: res.height });

      var byCat = {};
      res.items.forEach(function (it) { (byCat[it.category] = byCat[it.category] || []).push(it); });
      // Display order matches the sub-headings we'll create in HireHop: Screen,
      // Spares (always empty for now - manual add reminder), Rigging.
      var order = ["Screen", "Spares", "Rigging"];
      var html = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated kit</div>';
      order.forEach(function (cat) {
        var arr = byCat[cat] || [];
        html += '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">' + cat +
          (cat === "Spares" ? ' <span style="color:#0a7;text-transform:none;letter-spacing:0;font-weight:400;">(100% applied)</span>' : '') +
          '</div>';
        if (!arr.length) {
          html += '<div style="font-size:12px;color:#b07b00;padding:3px 0;">Empty sub-heading - add manually per job.</div>';
          return;
        }
        arr.forEach(function (it) {
          var pn = it.partNumber
            ? '<span style="color:#666;font-size:11px;margin-right:6px;">' + it.partNumber + '</span>'
            : '<span style="color:#b07b00;font-size:11px;margin-right:6px;">TBD</span>';
          html += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;gap:8px;align-items:baseline;">' +
            '<span style="color:#333;">' + pn + it.label + '</span>' +
            '<span style="color:#111;font-weight:500;white-space:nowrap;">x ' + it.qty + '</span></div>';
        });
      });
      html += '<div style="margin-top:10px;font-size:12px;color:#777;">' + res.panels + ' panels &middot; ' + res.width + ' &times; ' + res.height + ' m</div>';
      html += '<div style="margin-top:6px;font-size:11px;color:#b07b00;">Processor + Cable sub-headings deferred to a later release (parts still TBD).</div>';
      kitBox.innerHTML = html;

      var envLabel = envSel.value === "outdoor" ? "Outdoor" : "Indoor";
      var supLabel;
      if (supSel.value === "flown") {
        if (pitchSel.value === "3.9mm") {
          supLabel = "Flown-" + (rigSel.value === "clamp" ? "Clamp" : "Sling");
        } else {
          supLabel = "Flown-Sling";
        }
      } else {
        supLabel = "Ground Supported";
      }
      // Title format follows Adam's shape: "Indoor Videowall 4w x 3h 3.9mm
      // Flown-Sling inc Processor". The "inc Processor" suffix is a promise
      // to the pick crew - even though the processor line isn't inserted in
      // v0.6.0, one is always needed.
      state.items = res.items;
      state.title = envLabel + " Videowall " + res.width + "w x " + res.height + "h " + pitchSel.value + " " + supLabel + " inc Processor";

      renderFooter(true, "");
    }

    function renderFooter(canAdd, disabledReason) {
      foot.innerHTML = "";
      var cancel = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
      cancel.textContent = "Close"; cancel.addEventListener("click", close);
      var add = el("button", canAdd ? null : { disabled: "disabled", title: disabledReason },
        "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:" + (canAdd ? "pointer" : "not-allowed") + ";opacity:" + (canAdd ? "1" : ".5") + ";");
      add.textContent = "Add videowall kit";
      if (canAdd) add.addEventListener("click", confirmAdd);
      foot.appendChild(cancel); foot.appendChild(add);
    }

    function confirmAdd() {
      foot.innerHTML = "";
      var msg = el("div", null, "flex:1;font-size:13px;color:#333;");
      msg.textContent = "Add '" + state.title + "' to this job?";
      var no = el("button", null, "padding:8px 14px;font-size:14px;cursor:pointer;");
      no.textContent = "Cancel"; no.addEventListener("click", render);
      var yes = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
      yes.textContent = "Confirm add"; yes.addEventListener("click", doAdd);
      foot.appendChild(msg); foot.appendChild(no); foot.appendChild(yes);
    }

    function doAdd() {
      foot.innerHTML = "";
      var busy = el("div", null, "flex:1;font-size:13px;color:#333;display:flex;align-items:center;gap:10px;");
      busy.innerHTML = '<span class="hh-vw-spin"></span><span>Adding to the job&hellip;</span>';
      foot.appendChild(busy);

      addVideowallKit(inst, state.items, state.title, function (r) {
        foot.innerHTML = "";
        var msg = el("div", null, "flex:1;font-size:13px;");
        if (r && r.ok) {
          msg.style.color = "#0a7";
          msg.textContent = "Added '" + state.title + "' - " + r.parts + " resolved item(s), " + r.customs + " custom row(s).";
        } else {
          msg.style.color = "#b00";
          msg.textContent = (r && r.error) ? r.error : "Insert failed - see console for details.";
        }
        var ok = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
        ok.textContent = "Close"; ok.addEventListener("click", close);
        foot.appendChild(msg); foot.appendChild(ok);
      });

      if (PDF_ENABLED) {
        buildVideowallPdf({ title: state.title, items: state.items, result: state.result }).catch(function () {});
      }
    }

    pitchSel.addEventListener("change", render);
    envSel  .addEventListener("change", render);
    supSel  .addEventListener("change", render);
    rigSel  .addEventListener("change", render);
    wIn     .addEventListener("input",  render);
    hIn     .addEventListener("input",  render);
    procSel .addEventListener("change", render);

    document.body.appendChild(backdrop);
    render();
  }

  function register() {
    if (!window.HHTools || !window.HHTools.register) { setTimeout(register, 50); return; }
    window.HHTools.register({
      id: "videowall-creator",
      label: "Videowall Creator",
      icon: "ui-icon-image",
      onClick: function (inst) { openDialog(inst); }
    });
  }

  register();

})();
