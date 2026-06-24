/*!
 * HireHop Plugin: Stage Designer
 * Adds a "ðŸŽ­ Stage Designer" entry to the bottom of the New (+) dropdown
 * menu on the Supplying tab. The entry currently does nothing â€” it's a
 * placeholder for the forthcoming stage designer tool.
 *
 * GitHub: https://raw.githubusercontent.com/AdamYesEvents/HH-YES-Plugins/main/stage-designer-button.js
 * Usage: Add the above URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.4
 */

$(document).ready(function () {

  // Only run on a HireHop document page for a logged-in user, on an API
  // version we've verified against (<= 1.3).
  if (
    typeof user === "undefined" ||
    typeof doc_type === "undefined" ||
    typeof hh_api_version === "undefined" ||
    hh_api_version > 1.3
  ) {
    return;
  }

  // Why an interval instead of extending the widget:
  // The Supplying tab is built by the items widget ($.custom.items, /js/items.js),
  // which is injected AFTER this plugin and whose instance is created lazily (and
  // can be rebuilt) when the user opens the Supplying tab. Hooking the widget's
  // init is therefore racy. Instead we simply ensure our entry is present on a
  // light interval. The check is idempotent and cheap: ".custom_itemsFrame" is a
  // fast class lookup (usually 0â€“1 elements), and we bail immediately once the
  // entry already exists.

  function openStageDesigner(inst) {
    // Placeholder â€” currently does nothing.
    // Future: open the stage designer UI, e.g.
    //   window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + inst.options.job_data.JOB, "stage_designer");
  }

  function ensureStageDesignerEntry() {
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

  ensureStageDesignerEntry();
  setInterval(ensureStageDesignerEntry, 1000);

});
