/*!
 * HireHop Plugin: Stage Designer
 * Adds a "ðŸŽ­ Stage Designer" entry to the bottom of the New (+) dropdown
 * menu on the Supplying tab. The entry currently does nothing â€” it's a
 * placeholder for the forthcoming stage designer tool.
 *
 * IMPORTANT: load this via jsDelivr, NOT the raw.githubusercontent.com URL.
 * raw.githubusercontent.com serves files as text/plain with nosniff, so the
 * browser refuses to execute them as JavaScript. Use:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@main/stage-designer-button.js
 *
 * Usage: Add the jsDelivr URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.7
 */

(function () {

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
    if (!ready()) return; // HireHop not fully initialised yet, or unsupported API

    // The items widget instance is stored on its tab panel (.custom_itemsFrame).
    $(".custom_itemsFrame").each(function () {
      var inst = $(this).data("custom-items");
      if (!inst || typeof inst.new_item_popup_menu === "undefined") return;

      var menu = inst.new_item_popup_menu;            // the New (+) dropdown
      if (menu.find("li.imenu_stage_designer").length) return; // already added

      $("<li>", {
        "class": "imenu_stage_designer",
        html: '<div><span class="ui-icon ui-icon-image"></span>ðŸŽ­ Stage Designer</div>'
      })
        .click(function () {
          // Close the menu like every native entry does
          $(".ui-menu").hide();
          if ($(this).hasClass("ui-state-disabled")) return;
          openStageDesigner(inst);
        })
        .appendTo(menu);

      menu.menu("refresh"); // let jQuery UI register the new <li>
    });
  }

  function openStageDesigner(inst) {
    // Placeholder â€” currently does nothing.
    // Future: open the stage designer UI, e.g.
    //   window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + inst.options.job_data.JOB, "stage_designer");
  }

  function boot() {
    if (!window.jQuery) { setTimeout(boot, 50); return; } // wait for jQuery if needed
    var $ = window.jQuery;
    setInterval(function () { ensure($); }, 1000);
    ensure($);
  }

  boot();

})();
