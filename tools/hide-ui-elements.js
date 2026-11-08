/*!
 * HireHop Tool: Hide UI Elements
 * Injects a <style> on load that hides specific UI controls we don't want
 * users to touch. Bucket for future additions — add selectors to CSS below.
 *
 * Version: 0.1.0
 *
 * Currently hides (Job edit dialog only):
 *   - "Collection address" tab
 *   - "Use at address" tab
 *   - "Copy company and address to delivery address" button
 *   - "Add to address book" button
 */
(function () {
  if (document.getElementById("hhtool_hide_ui_elements")) return;
  var s = document.createElement("style");
  s.id = "hhtool_hide_ui_elements";
  s.textContent = [
    '#edit_dialog .label.address-switcher-unselected.collection,',
    '#edit_dialog .label.address-switcher-unselected.use_at,',
    '#edit_dialog button[title="Copy company and address to delivery address"],',
    '#edit_dialog button[title="Add to address book"]',
    '{ display: none !important; }'
  ].join("\n");
  document.head.appendChild(s);
})();
