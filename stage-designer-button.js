/*!
 * HireHop Plugin: Stage Designer
 * Adds a "ðŸŽ­ Stage Designer" entry to the bottom of the New (+) dropdown
 * menu on the Supplying tab. The entry currently does nothing â€” it's a
 * placeholder for the forthcoming stage designer tool.
 *
 * GitHub: https://raw.githubusercontent.com/AdamYesEvents/HH-YES-Plugins/main/stage-designer-button.js
 * Usage: Add the above URL to Settings -> Company Settings -> Plugins
 *
 * Version: 1.3
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

  // IMPORTANT timing note:
  // The items widget ($.custom.items, /js/items.js) that builds the Supplying
  // tab is loaded AFTER this plugin (it is injected later in the page), so at
  // $(document).ready it may not yet be defined. We therefore poll until the
  // widget exists before extending it, and also patch any instance that was
  // already built before our override landed.

  var MAX_WAIT_MS = 20000; // stop waiting for the widget after 20s
  var started = Date.now();

  // Append our entry to one items-widget instance's New dropdown (idempotent).
  function injectIntoInstance(inst) {
    if (!inst || typeof inst.new_item_popup_menu === "undefined") return;
    var menu = inst.new_item_popup_menu;
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
  }

  // Placeholder action â€” currently does nothing.
  function openStageDesigner(inst) {
    // Future: open the stage designer UI, e.g.
    //   window.open("https://YOUR_PAGES_URL/stage-designer/?job=" + inst.options.job_data.JOB, "stage_designer");
  }

  // Find all live items-widget instances on the page.
  function findInstances() {
    var found = [];
    $("*").each(function () {
      var i = $(this).data("custom-items");
      if (i && found.indexOf(i) === -1) found.push(i);
    });
    return found;
  }

  function applyOverrideAndPatch() {
    // Extend the widget so any NEW instances get the entry automatically.
    $.widget("custom.items", $.custom.items, {
      _init_new_button_menu: function () {
        this._super(arguments);      // build the original New menu first
        injectIntoInstance(this);    // then append our entry
      }
    });

    // Patch any instance that was already created before the override landed.
    findInstances().forEach(injectIntoInstance);
  }

  // Wait for the items widget to be defined, then apply.
  var timer = setInterval(function () {
    if (typeof $.custom !== "undefined" && typeof $.custom.items === "function") {
      clearInterval(timer);
      applyOverrideAndPatch();
    } else if (Date.now() - started > MAX_WAIT_MS) {
      clearInterval(timer); // widget never appeared; give up quietly
    }
  }, 200);

});
