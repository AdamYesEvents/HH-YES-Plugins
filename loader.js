/*!
 * HireHop Plugin Loader (Stage / Video tools)
 * This is the single URL you put in HireHop -> Settings -> Company Settings -> Plugins.
 * It loads the individual tool scripts from this repo and provides the shared
 * machinery that injects their entries into the Supplying tab's New (+) menu
 * (both the top-left New button dropdown and the right-click context menu).
 *
 * Load via jsDelivr (NOT raw.githubusercontent.com, which serves text/plain+nosniff
 * and will not execute). Pin the loader to a release tag, e.g.:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@v0.1.28/loader.js
 *
 * Version: 0.1.28
 */

(function () {

  var REPO = "AdamYesEvents/HH-YES-Plugins";

  // ===========================================================================
  // CONFIG - turn tools on/off and choose which version of each to load.
  //   on  : load this tool or not
  //   ref : git ref served via jsDelivr - "main" for the latest, or pin to a
  //         tag for stability, e.g. "stage-designer-v0.1.0"
  // To update a tool: edit its file and push (ref "main" + purge jsDelivr), or
  // create a tag and set ref to it here.
  // ===========================================================================
  var TOOLS = {
    "stage-designer":    { on: true, ref: "stage-designer-v0.19.0" },
    "videowall-creator": { on: true, ref: "videowall-creator-v0.1.0" }
  };

  // ---------------------------------------------------------------------------
  // Shared registry + menu injection (tools call HHTools.register(...))
  // ---------------------------------------------------------------------------
  var registry = [];

  window.HHTools = {
    // tool = { id, label, icon (jQuery UI ui-icon-* class), onClick(inst) }
    register: function (tool) {
      if (!tool || !tool.id) return;
      if (registry.some(function (t) { return t.id === tool.id; })) return; // dedupe
      registry.push(tool);
    }
  };

  function ready() {
    return typeof user !== "undefined" &&
           typeof doc_type !== "undefined" &&
           typeof hh_api_version !== "undefined" &&
           hh_api_version <= 1.3;
  }

  function buildEntry($, tool, inst) {
    return $("<li>", {
      "class": "hhtool_" + tool.id,
      html: '<div><span class="ui-icon ' + (tool.icon || "ui-icon-image") + '"></span>' + tool.label + '</div>'
    }).click(function () {
      $(".ui-menu").hide();
      if ($(this).hasClass("ui-state-disabled")) return;
      try { tool.onClick && tool.onClick(inst); } catch (e) { /* tool errors must not break the menu */ }
    });
  }

  // Ensure the separator + every registered tool entry exist in a menu (idempotent).
  function ensureSection($, inst, menu, refresh) {
    if (!menu || !menu.length || !registry.length) return;
    var changed = false;

    if (!menu.find("hr.hhtool_sep").length) {
      $("<hr>", { "class": "hhtool_sep" }).appendTo(menu);
      changed = true;
    }
    registry.forEach(function (tool) {
      if (menu.find("li.hhtool_" + tool.id).length) return; // already present
      buildEntry($, tool, inst).appendTo(menu);
      changed = true;
    });

    if (changed) refresh();
  }

  function ensure($) {
    if (!ready() || !registry.length) return;

    $(".custom_itemsFrame").each(function () {
      var inst = $(this).data("custom-items");
      if (!inst) return;

      // Top-left New (+) button dropdown
      if (inst.new_item_popup_menu) {
        ensureSection($, inst, inst.new_item_popup_menu, function () { inst.new_item_popup_menu.menu("refresh"); });
      }
      // Right-click context menu -> New submenu (refresh via the root popup_menu)
      if (inst.new_menu && inst.popup_menu) {
        ensureSection($, inst, inst.new_menu, function () { inst.popup_menu.menu("refresh"); });
      }
    });
  }

  function loadTools() {
    Object.keys(TOOLS).forEach(function (name) {
      var cfg = TOOLS[name];
      if (!cfg || !cfg.on) return;
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/gh/" + REPO + "@" + (cfg.ref || "main") + "/tools/" + name + ".js";
      s.async = true;
      document.head.appendChild(s);
    });
  }

  function boot() {
    if (!window.jQuery) { setTimeout(boot, 50); return; } // wait for jQuery if needed
    var $ = window.jQuery;
    loadTools();
    setInterval(function () { ensure($); }, 1000);
    ensure($);
  }

  boot();

})();
