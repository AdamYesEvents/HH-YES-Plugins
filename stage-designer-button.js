/*!
 * HireHop Plugin: Stage Designer
 * Adds a "ðŸŽ­ Stage Designer" entry to the bottom of the New (+) dropdown
 * menu on the Supplying tab. The entry currently does nothing â€” it's a
 * placeholder for the forthcoming stage designer tool.
 *
 * GitHub: https://raw.githubusercontent.com/AdamYesEvents/HH-YES-Plugins/main/stage-designer-button.js
 * Usage: Add the above URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.5
 */

$(document).ready(function () {

  // NOTE on the design:
  // The Supplying tab is built by the items widget ($.custom.items, /js/items.js),
  // which is injected AFTER this plugin and whose instance is created lazily (and
  // re-rendered) when the user opens the Supplying tab. On top of that, HireHop's
  // globals (user, doc_type, hh_api_version) may not be defined yet at the moment
  // this $(document).ready fires. So we do NOT guard up-front (that previously
  // caused the plugin to bail before doing anything). Instead we start a light
  // interval immediately and re-check everything on each tick. Once the page is
  // ready and the Supplying tab exists, the entry is added. The work is idempotent
  // and cheap: ".custom_itemsFrame" is a fast class lookup and we bail the moment
  // the entry already exists.

  function ready() {
    return typeof user !== "undefined" &&
           typeof doc_type !== "undefined" &&
           typeof hh_api_version !== "undefined" &&
           hh_api_version <= 1.3;
  }

  function openStageDesigner(inst) {
    // Placeholder â€” currently does nothing.
    // Future: open the stage designer UI, e.g.
    //   window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + inst.options.job_data.JOB, "stage_designer");
  }

  function ensureStageDesignerEntry() {
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

  setInterval(ensureStageDesignerEntry, 1000);
  ensureStageDesignerEntry();

});
