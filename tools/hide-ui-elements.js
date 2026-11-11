/*!
 * HireHop Tool: Hide UI Elements
 * Injects a <style> on load that hides specific UI controls we don't want
 * users to touch. Bucket for future additions — add selectors to CSS below.
 *
 * Version: 0.1.6
 *
 * Currently hides:
 *   Job page (#job_delivery_address):
 *     - "Collection address" tab
 *     - "Use at address" tab
 *   Job edit dialog (#edit_dialog) / New job dialog (#new_job_dialog):
 *     - "Collection address" tab
 *     - "Use at address" tab
 *     - "Copy company and address to delivery address" button
 *     - "Add to address book" button (title variant)
 *   New job dialog (#new_job_dialog) / New project dialog (#new_proj_dialog):
 *     - "Add to address book" button (person-icon / no-title variant)
 *   New project dialog (#new_proj_dialog):
 *     - "Collection address" tab
 *     - "Use at address" tab
 */
(function () {
  if (document.getElementById("hhtool_hide_ui_elements")) return;
  var s = document.createElement("style");
  s.id = "hhtool_hide_ui_elements";
  s.textContent = [
    '#job_delivery_address .lang.label.collection.address-switcher-unselected,',
    '#job_delivery_address .lang.label.use_at.address-switcher-unselected,',
    '#edit_dialog .label.address-switcher-unselected.collection,',
    '#edit_dialog .label.address-switcher-unselected.use_at,',
    '#edit_dialog button[title="Copy company and address to delivery address"],',
    '#edit_dialog button[title="Add to address book"],',
    '#new_job_dialog .label.address-switcher-unselected.collection,',
    '#new_job_dialog .label.address-switcher-unselected.use_at,',
    '#new_job_dialog button[title="Copy company and address to delivery address"],',
    '#new_job_dialog button[title="Add to address book"],',
    '#new_job_dialog button:has(.ui-icon-person),',
    '#new_proj_dialog .label.address-switcher-unselected.collection,',
    '#new_proj_dialog .label.address-switcher-unselected.use_at,',
    '#new_proj_dialog button:has(.ui-icon-person)',
    '{ display: none !important; }'
  ].join("\n");
  document.head.appendChild(s);
})();
