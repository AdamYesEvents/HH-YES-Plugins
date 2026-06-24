/*!
 * HireHop Plugin: Stage Designer
 * Adds a "ðŸŽ­ Stage Designer" entry to the bottom of the New (+) dropdown
 * menu on the Supplying tab. The entry currently does nothing â€” it's a
 * placeholder for the forthcoming stage designer tool.
 *
 * GitHub: https://raw.githubusercontent.com/AdamYesEvents/HH-YES-Plugins/main/stage-designer-button.js
 * Usage: Add the above URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.6
 */

(function () {

  // Diagnostics marker (harmless) so behaviour can be inspected via the console:
  //   window.__stageDesigner  -> { booted, ticks, lastState, lastError }
  var diag = window.__stageDesigner = { ver: "1.6", booted: false, ticks: 0, lastState: "init", lastError: null };

  // Design notes:
  // - We do NOT rely on $(document).ready. The plugin may run before jQuery is
  //   ready, and the items widget that builds the Supplying tab is injected later
  //   and created/rebuilt lazily when the tab is opened. So we wait for jQuery,
  //   then run a light idempotent interval that adds our entry whenever the
  //   Supplying tab's New (+) menu exists.
  // - All guards are checked inside the tick (HireHop globals like user/doc_type/
  //   hh_api_version may not exist yet when we first run).

  function ready() {
    return typeof user !== "undefined" &&
           typeof doc_type !== "undefined" &&
           typeof hh_api_version !== "undefined" &&
           hh_api_version <= 1.3;
  }

  function ensure($) {
    diag.ticks++;
    if (!ready()) { diag.lastState = "globals-not-ready"; return; }

    var frames = $(".custom_itemsFrame");
    if (!frames.length) { diag.lastState = "no-supplying-frame"; return; }

    frames.each(function () {
      var inst = $(this).data("custom-items");
      if (!inst || typeof inst.new_item_popup_menu === "undefined") { diag.lastState = "no-new-menu"; return; }

      var menu = inst.new_item_popup_menu;            // the New (+) dropdown
      if (menu.find("li.imenu_stage_designer").length) { diag.lastState = "present"; return; }

      $("<li>", {
        "class": "imenu_stage_designer",
        html: '<div><span class="ui-icon ui-icon-image"></span>ðŸŽ­ Stage Designer</div>'
      })
        .click(function () {
          $(".ui-menu").hide();
          if ($(this).hasClass("ui-state-disabled")) return;
          openStageDesigner(inst);
        })
        .appendTo(menu);

      menu.menu("refresh");
      diag.lastState = "added";
    });
  }

  function openStageDesigner(inst) {
    // Placeholder â€” currently does nothing.
    // Future: window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + inst.options.job_data.JOB, "stage_designer");
  }

  function boot() {
    if (!window.jQuery) { setTimeout(boot, 50); return; }   // wait for jQuery if needed
    var $ = window.jQuery;
    diag.booted = true;
    setInterval(function () {
      try { ensure($); } catch (e) { diag.lastError = String(e); }
    }, 1000);
    try { ensure($); } catch (e) { diag.lastError = String(e); }
  }

  boot();

})();
