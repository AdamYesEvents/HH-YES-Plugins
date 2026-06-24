/*!
 * HireHop Plugin: Stage Designer
 * Adds a "ðŸŽ­ Stage Designer" entry to the bottom of the New (+) dropdown
 * menu on the Supplying tab. The entry currently does nothing â€” it's a
 * placeholder for the forthcoming stage designer tool.
 *
 * GitHub: https://raw.githubusercontent.com/AdamYesEvents/HH-YES-Plugins/main/stage-designer-button.js
 * Usage: Add the above URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.2
 */

$(document).ready(function () {

  // Safety checks: only run on a HireHop job/document page for a logged-in
  // user, and only against an API version we've verified against (<= 1.3).
  if (
    typeof $.custom === "undefined" ||
    typeof $.custom.items === "undefined" ||
    typeof user === "undefined" ||
    typeof doc_type === "undefined" ||
    typeof hh_api_version === "undefined" ||
    hh_api_version > 1.3
  ) {
    return;
  }

  // The Supplying tab is built by the items widget ($.custom.items, /js/items.js).
  // The New (+) button opens `this.new_item_popup_menu`, a jQuery UI menu that is
  // cloned from `this.new_menu` inside _init_new_button_menu(). We override that
  // method so our entry is appended after the menu exists, then refresh it.

  $.widget("custom.items", $.custom.items, {

    _init_new_button_menu: function () {
      // Build the original New menu first (creates this.new_item_popup_menu)
      this._super(arguments);

      // Only present on editable documents, where the menu is built
      if (typeof this.new_item_popup_menu === "undefined") {
        return;
      }

      var self = this;

      // Match the native menu item markup: <li><div><span icon/>Label</div></li>
      this.imenu_stage_designer = $("<li>", {
        "class": "imenu_stage_designer",
        html: '<div><span class="ui-icon ui-icon-image"></span>ðŸŽ­ Stage Designer</div>'
      })
        .click(function () {
          // Close the menu like every other entry does
          $(".ui-menu").hide();
          if ($(this).hasClass("ui-state-disabled")) return;
          self._open_stage_designer();
        })
        .appendTo(this.new_item_popup_menu);

      // Tell jQuery UI to re-read the menu so the new <li> becomes a menu item
      this.new_item_popup_menu.menu("refresh");
    },

    _open_stage_designer: function () {
      // Placeholder â€” currently does nothing.
      // Future: open the stage designer UI, e.g.
      //   window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + this.options.job_data.JOB, "stage_designer");
    }

  });

});
