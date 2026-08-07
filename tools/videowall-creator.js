/*!
 * HireHop Tool: Videowall Creator
 * Loaded by loader.js (window.HHTools.register).
 *
 * Baseline-questions wizard that produces a videowall kit and (later) inserts
 * it into the job under a "Videowall WxH ..." heading. The framework mirrors
 * stage-designer.js (self-contained overlay dialog, pure logic + browser UI).
 *
 * Part numbers are intentionally blank for now (TBD placeholders); the
 * data/videowall-creator/*.json catalogue and job-insertion wiring will follow
 * once the parts list is finalised.
 *
 * PDF generation is TEMPORARILY BLOCKED - see PDF_ENABLED below. When ready,
 * flip the flag on and reformat buildVideowallPdf() to match the final layout
 * (do not delete the scaffolding).
 *
 * Version: 0.2.0
 */

(function () {

  // ===========================================================================
  // PURE LOGIC
  // ===========================================================================

  // Compute the kit from the answered questions.
  //   opts = { environment: "indoor"|"outdoor",
  //            support:     "flown"|"ground",
  //            rigging:     "clamp"|"sling"   (only when support==="flown"),
  //            width:       number (whole metres),
  //            height:      number (whole metres),
  //            processor:   "behind"|"far" }
  // Returns { ok, error?, items, cols, rows, panels }.
  function computeKit(opts) {
    opts = opts || {};
    var w = +opts.width, h = +opts.height;
    if (!(w > 0) || Math.abs(w - Math.round(w)) > 1e-6) return { ok: false, error: "Width must be a whole number of metres" };
    if (!(h > 0) || Math.abs(h - Math.round(h)) > 1e-6) return { ok: false, error: "Height must be a whole number of metres" };
    if (opts.support === "flown" && !opts.rigging) return { ok: false, error: "Choose Clamp or Sling for a flown wall" };
    if (!opts.environment || !opts.support || !opts.processor) return { ok: false, error: "Answer every question" };

    var cols = Math.round(w), rows = Math.round(h), panels = cols * rows;
    var items = [];

    items.push({ category: "Panels",   label: "LED Panel 1x1m",                partNumber: "", qty: panels });

    if (opts.support === "flown") {
      if (opts.rigging === "clamp") {
        items.push({ category: "Rigging", label: "Flying clamp (per column)",  partNumber: "", qty: cols });
      } else {
        items.push({ category: "Rigging", label: "Flying sling",               partNumber: "", qty: 2 });
      }
      items.push({ category: "Rigging",   label: "Flying bar",                 partNumber: "", qty: 1 });
    } else {
      items.push({ category: "Support",   label: "Ground support frame",       partNumber: "", qty: 1 });
      items.push({ category: "Support",   label: "Base plate / ballast",       partNumber: "", qty: cols });
    }

    items.push({ category: "Processor",   label: "Video processor",            partNumber: "", qty: 1 });

    if (opts.processor === "behind") {
      items.push({ category: "Signal",    label: "Short signal cable (behind screen)", partNumber: "", qty: 1 });
    } else {
      items.push({ category: "Signal",    label: "Long-run signal cable (>= 70m)",     partNumber: "", qty: 1 });
    }

    if (opts.environment === "outdoor") {
      items.push({ category: "Environment", label: "Weatherproof cover / kit", partNumber: "", qty: 1 });
    }

    return { ok: true, items: items, cols: cols, rows: rows, panels: panels };
  }

  // Front-elevation SVG of the wall - grid of 1x1m cells with W/H labels.
  function buildWallSvg(cols, rows, opts) {
    opts = opts || {};
    var maxW = opts.maxW || 420, maxH = opts.maxH || 260, pad = 24;
    var cellPx = Math.max(8, Math.min((maxW - pad * 2) / cols, (maxH - pad * 2) / rows));
    var W = cellPx * cols, H = cellPx * rows;
    var SW = W + pad * 2, SH = H + pad * 2;
    var ox = pad, oy = pad;
    var cells = "";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        cells += '<rect x="' + (ox + c * cellPx + 1) + '" y="' + (oy + r * cellPx + 1) +
          '" width="' + (cellPx - 2) + '" height="' + (cellPx - 2) +
          '" fill="#1D1D3C" stroke="#26215C" stroke-width="1"/>';
      }
    }
    var frame = '<rect x="' + (ox - 0.5) + '" y="' + (oy - 0.5) + '" width="' + (W + 1) + '" height="' + (H + 1) + '" fill="none" stroke="#26215C" stroke-width="2"/>';
    var wLbl = '<text x="' + (ox + W / 2) + '" y="' + (SH - 6) + '" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#666" text-anchor="middle">' + cols + ' m wide</text>';
    var hLbl = '<text x="' + (SW - 8) + '" y="' + (oy + H / 2) + '" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#666" text-anchor="middle" transform="rotate(90 ' + (SW - 8) + ' ' + (oy + H / 2) + ')">' + rows + ' m high</text>';
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
    module.exports = { computeKit: computeKit, buildWallSvg: buildWallSvg };
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
    var colKit      = el("div", null, "width:240px;flex-shrink:0;");
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

    // Q1
    var envWrap = field("Environment");
    var envSel  = select([["indoor", "Indoor"], ["outdoor", "Outdoor"]]);
    envWrap.appendChild(envSel); colControls.appendChild(envWrap);

    // Q2
    var supWrap = field("Support");
    var supSel  = select([["ground", "Ground supported"], ["flown", "Flown"]]);
    supWrap.appendChild(supSel); colControls.appendChild(supWrap);

    // Q2.5 - only shown when Flown
    var rigWrap = field("Rigging");
    var rigSel  = select([["clamp", "Clamp"], ["sling", "Sling"]]);
    rigWrap.appendChild(rigSel); colControls.appendChild(rigWrap);

    // Q3 - width + height (m increments)
    var wWrap = field("Width (m)");
    var wIn = el("input", { type: "number", min: "1", step: "1" }, "width:100%;padding:8px;font-size:14px;");
    wIn.value = "4"; wWrap.appendChild(wIn); colControls.appendChild(wWrap);

    var hWrap = field("Height (m)");
    var hIn = el("input", { type: "number", min: "1", step: "1" }, "width:100%;padding:8px;font-size:14px;");
    hIn.value = "3"; hWrap.appendChild(hIn); colControls.appendChild(hWrap);

    // Q4
    var procWrap = field("Processor location");
    var procSel  = select([["behind", "Behind screen"], ["far", "Within 70m distance"]]);
    procWrap.appendChild(procSel); colControls.appendChild(procWrap);

    var kitBox = el("div", null, "font-size:13px;");
    colKit.appendChild(kitBox);

    var foot = el("div", null, "padding:14px 22px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;align-items:center;");
    panel.appendChild(foot);

    var state = { result: null, items: [], title: "" };

    function syncRiggingVisibility() {
      rigWrap.style.display = supSel.value === "flown" ? "" : "none";
    }

    function render() {
      syncRiggingVisibility();
      var res = computeKit({
        environment: envSel.value,
        support:     supSel.value,
        rigging:     supSel.value === "flown" ? rigSel.value : null,
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

      colPreview.innerHTML = buildWallSvg(res.cols, res.rows);

      // Group items by category for a tidy list.
      var byCat = {};
      res.items.forEach(function (it) { (byCat[it.category] = byCat[it.category] || []).push(it); });
      var order = ["Panels", "Rigging", "Support", "Processor", "Signal", "Environment"];
      var html = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated kit</div>';
      order.forEach(function (cat) {
        var arr = byCat[cat]; if (!arr) return;
        html += '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">' + cat + '</div>';
        arr.forEach(function (it) {
          html += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;"><span style="color:#333;">' + it.label + '</span><span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>';
        });
      });
      html += '<div style="margin-top:10px;font-size:12px;color:#777;">' + res.panels + ' panels &middot; ' + res.cols + ' &times; ' + res.rows + ' m</div>';
      html += '<div style="margin-top:6px;font-size:11px;color:#b07b00;">Part numbers TBD - insertion into the job will be wired up in the next iteration.</div>';
      kitBox.innerHTML = html;

      // Title mirrors stage-designer's "Stage WxD @ Hmm ..." style.
      var envLabel = envSel.value === "outdoor" ? "Outdoor" : "Indoor";
      var supLabel = supSel.value === "flown"
        ? ("Flown - " + (rigSel.value === "clamp" ? "Clamp" : "Sling"))
        : "Ground Supported";
      var procLabel = procSel.value === "behind" ? "Processor behind screen" : "Processor within 70m";
      state.items = res.items;
      state.title = "Videowall " + res.cols + "x" + res.rows + "m, " + envLabel + ", " + supLabel + ", " + procLabel;

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

    envSel.addEventListener("change", render);
    supSel.addEventListener("change", render);
    rigSel.addEventListener("change", render);
    wIn.addEventListener("input", render);
    hIn.addEventListener("input", render);
    procSel.addEventListener("change", render);

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
