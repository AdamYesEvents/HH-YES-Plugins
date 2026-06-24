/*!
 * HireHop Plugin: Stage Designer + Videowall Creator
 * Adds custom entries to the bottom of the New (+) menu on the Supplying tab,
 * in BOTH the top-left "New" button dropdown and the right-click context menu:
 *   - Stage Designer    (placeholder: shows a confirmation dialog)
 *   - Videowall Creator (placeholder: shows a confirmation dialog)
 * A separator is added above them to mark the custom section.
 *
 * IMPORTANT: load this via jsDelivr, NOT the raw.githubusercontent.com URL.
 * raw.githubusercontent.com serves files as text/plain with nosniff, so the
 * browser refuses to execute them as JavaScript. Use a tagged, immutable URL:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@v1.9/stage-designer-button.js
 *
 * Usage: Add the jsDelivr URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.9
 */

(function () {

  // Design notes:
  // - We do NOT rely on $(document).ready. The plugin may run before jQuery is
  //   ready, and the items widget that builds the Supplying tab is injected later
  //   and created/rebuilt lazily when the tab is opened. So we wait for jQuery,
  //   then run a light idempotent interval.
  // - The Supplying tab is built by the items widget ($.custom.items). It exposes
  //   two New menus we extend:
  //     * new_item_popup_menu - the top-left "New (+)" button dropdown (a clone)
  //     * new_menu            - the "New" submenu inside the right-click context
  //                             menu (popup_menu); refreshed via popup_menu
  // - All guards are checked inside the tick (HireHop globals like user/doc_type/
  //   hh_api_version may not exist yet when we first run).

  function ready() {
    return typeof user !== "undefined" &&
           typeof doc_type !== "undefined" &&
           typeof hh_api_version !== "undefined" &&
           hh_api_version <= 1.3;
  }

  function openStageDesigner(inst) {
    // Placeholder - simple confirmation dialog echoing the action name.
    // Future: window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + inst.options.job_data.JOB, "stage_designer");
    window.alert("Stage Designer");
  }

  function openVideowallCreator(inst) {
    // Placeholder - simple confirmation dialog echoing the action name.
    // Future: window.open("https://YOUR_PAGES_URL/videowall-creator/?job=" + inst.options.job_data.JOB, "videowall_creator");
    window.alert("Videowall Creator");
  }

  // Build one menu entry matching HireHop's native New-menu markup.
  function buildEntry($, cls, iconClass, label, action, inst) {
    return $("<li>", {
      "class": cls,
      html: '<div><span class="ui-icon ' + iconClass + '"></span>' + label + '</div>'
    }).click(function () {
      $(".ui-menu").hide();                         // close like every native entry
      if ($(this).hasClass("ui-state-disabled")) return;
      action(inst);
    });
  }

  // Append our custom section (separator + both entries) to a menu, once.
  // Returns true if it added anything (so the caller can refresh).
  function addCustomSection($, inst, menu) {
    if (!menu || !menu.length) return false;
    if (menu.find("li.imenu_stage_designer").length) return false; // already added

    $("<hr>", { "class": "imenu_custom_sep" }).appendTo(menu);     // section separator
    buildEntry($, "imenu_stage_designer", "ui-icon-image", "Stage Designer", openStageDesigner, inst).appendTo(menu);
    buildEntry($, "imenu_videowall_creator", "ui-icon-image", "Videowall Creator", openVideowallCreator, inst).appendTo(menu);
    return true;
  }

  function ensure($) {
    if (!ready()) return; // HireHop not fully initialised yet, or unsupported API

    $(".custom_itemsFrame").each(function () {
      var inst = $(this).data("custom-items");
      if (!inst) return;

      // Top-left New (+) button dropdown
      if (addCustomSection($, inst, inst.new_item_popup_menu)) {
        inst.new_item_popup_menu.menu("refresh");
      }

      // Right-click context menu -> New submenu (refresh via the root popup_menu)
      if (inst.new_menu && inst.popup_menu && addCustomSection($, inst, inst.new_menu)) {
        inst.popup_menu.menu("refresh");
      }
    });
  }

  function boot() {
    if (!window.jQuery) { setTimeout(boot, 50); return; } // wait for jQuery if needed
    var $ = window.jQuery;
    setInterval(function () { ensure($); }, 1000);
    ensure($);
  }

  boot();

})();
