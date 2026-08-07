/*!
 * HireHop Tool: Videowall Creator
 * Loaded by loader.js (window.HHTools.register).
 *
 * Baseline-questions wizard that produces a videowall kit and (later) inserts
 * it into the job under a "Videowall WxH ..." heading. The framework mirrors
 * stage-designer.js (self-contained overlay dialog, pure logic + browser UI).
 *
 * Q0  Pitch          2.6mm (indoor only) / 3.9mm (indoor or outdoor)
 * Q1  Environment    Indoor / Outdoor (Outdoor disabled for 2.6mm)
 * Q2  Support        Flown / Ground supported
 * Q2.5 Rigging       Clamp / Sling  -  ONLY for Outdoor + Flown
 * Q3  Width, Height  metres, 0.5m increments (panels are 500 x 1000)
 * Q4  Processor      Behind screen / Within 70m
 *
 * Part numbers are intentionally blank for now (TBD placeholders); the
 * data/videowall-creator/*.json catalogue and job-insertion wiring will follow
 * once the parts list is finalised.
 *
 * PDF generation is TEMPORARILY BLOCKED - see PDF_ENABLED below. When ready,
 * flip the flag on and reformat buildVideowallPdf() to match the final layout
 * (do not delete the scaffolding).
 *
 * Version: 0.4.0
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

    var envLabel = opts.environment === "outdoor" ? "Outdoor" : "Indoor";
    if (fullPanels > 0) {
      items.push({
        category: "Panels",
        label: "LED Panel 500x1000mm " + envLabel + " " + opts.pitch,
        partNumber: "", qty: fullPanels
      });
    }
    if (halfPanels > 0) {
      items.push({
        category: "Panels",
        label: "LED Panel 500x500mm " + envLabel + " " + opts.pitch,
        partNumber: "", qty: halfPanels
      });
    }

    // ---- Rigging / support --------------------------------------------------
    if (opts.support === "flown") {
      var rig = flownRig(W);
      if (rig) {
        if (rig.bars_1 > 0)  items.push({ category: "Rigging", label: "Flying bar 1m",  partNumber: "", qty: rig.bars_1 });
        if (rig.bars_05 > 0) items.push({ category: "Rigging", label: "Flying bar 0.5m", partNumber: "", qty: rig.bars_05 });
      }
      // Clamp/sling is an OUTDOOR question only.
      if (opts.environment === "outdoor") {
        if (!opts.rigging) return { ok: false, error: "Choose Clamp or Sling for an outdoor flown wall" };
        if (opts.rigging === "clamp") {
          items.push({ category: "Rigging", label: "Flying clamp (per column)", partNumber: "", qty: cols });
        } else {
          items.push({ category: "Rigging", label: "Flying sling",              partNumber: "", qty: 2 });
        }
      }
    } else {
      // Ground support - kit differs by pitch.
      if (opts.pitch === "2.6mm") {
        var g26 = ground26Kit(W);
        if (!g26.ok) return { ok: false, error: g26.error };
        items.push({ category: "Support", label: "2.6mm ground support kit (2m bay, incl. 2x 1m + 1x 0.5m bars)", partNumber: "", qty: g26.kits });
      } else {
        var g39 = ground39Kit(W);
        if (!g39.ok) return { ok: false, error: g39.error };
        items.push({ category: "Support", label: "3.9mm ground support base case (incl. 2x 1m comb bars)", partNumber: "", qty: g39.kits });
        if (g39.bars_15 > 0) items.push({ category: "Support", label: "3.9mm Comb bar 1.5m", partNumber: "", qty: g39.bars_15 });
        if (g39.bars_2  > 0) items.push({ category: "Support", label: "3.9mm Comb bar 2m",   partNumber: "", qty: g39.bars_2 });
      }
    }

    // ---- Processor + signal -------------------------------------------------
    items.push({ category: "Processor", label: "Video processor", partNumber: "", qty: 1 });
    if (opts.processor === "behind") {
      items.push({ category: "Signal", label: "Short signal cable (behind screen)", partNumber: "", qty: 1 });
    } else {
      items.push({ category: "Signal", label: "Long-run signal cable (>= 70m)",     partNumber: "", qty: 1 });
    }

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
      flownRig: flownRig, ground26Kit: ground26Kit, ground39Kit: ground39Kit
    };
  }

  // ===========================================================================
  // BROWSER: dialog + registration
  // ===========================================================================
  if (typeof window === "undefined") return;

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

    // Rigging (clamp/sling) only for Outdoor + Flown.
    function syncRiggingVisibility() {
      rigWrap.style.display = (supSel.value === "flown" && envSel.value === "outdoor") ? "" : "none";
    }

    function render() {
      syncEnvOptions();
      syncRiggingVisibility();
      var res = computeKit({
        pitch:       pitchSel.value,
        environment: envSel.value,
        support:     supSel.value,
        rigging:     (supSel.value === "flown" && envSel.value === "outdoor") ? rigSel.value : null,
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
      var order = ["Panels", "Rigging", "Support", "Processor", "Signal"];
      var html = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated kit</div>';
      order.forEach(function (cat) {
        var arr = byCat[cat]; if (!arr) return;
        html += '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">' + cat + '</div>';
        arr.forEach(function (it) {
          html += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;gap:8px;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;white-space:nowrap;">x ' + it.qty + '</span></div>';
        });
      });
      html += '<div style="margin-top:10px;font-size:12px;color:#777;">' + res.panels + ' panels &middot; ' + res.width + ' &times; ' + res.height + ' m</div>';
      html += '<div style="margin-top:6px;font-size:11px;color:#b07b00;">Part numbers TBD - insertion into the job will be wired up next.</div>';
      kitBox.innerHTML = html;

      var envLabel = envSel.value === "outdoor" ? "Outdoor" : "Indoor";
      var supLabel;
      if (supSel.value === "flown") {
        supLabel = envSel.value === "outdoor"
          ? ("Flown - " + (rigSel.value === "clamp" ? "Clamp" : "Sling"))
          : "Flown";
      } else {
        supLabel = "Ground Supported";
      }
      var procLabel = procSel.value === "behind" ? "Processor behind screen" : "Processor within 70m";
      state.items = res.items;
      state.title = "Videowall " + res.width + "x" + res.height + "m " + pitchSel.value + ", " + envLabel + ", " + supLabel + ", " + procLabel;

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
      // Part numbers are TBD - job insertion is not wired up yet.
      // When we're ready, mirror stage-designer's addStageKit() flow (resolve
      // part numbers -> create heading -> save_items_list -> handle autopull),
      // and then call buildVideowallPdf() once PDF_ENABLED is flipped back on.
      foot.innerHTML = "";
      var msg = el("div", null, "flex:1;font-size:13px;color:#333;");
      msg.textContent = "Would add " + state.items.length + " item(s) under '" + state.title + "'. Part numbers TBD - insertion coming next.";
      var ok = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
      ok.textContent = "OK"; ok.addEventListener("click", close);
      foot.appendChild(msg); foot.appendChild(ok);

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
