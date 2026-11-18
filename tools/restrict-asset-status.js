/*!
 * HireHop Tool: Restrict Asset Status
 * Limits which asset STATUS values certain permission groups may switch to,
 * in the stock module's asset Edit dialog (select[name="STATUS"]).
 * Client-side UI restriction only (hides disallowed options) — NOT server-enforced.
 *
 * Version: 0.1.0
 *
 * Asset statuses: 0 In stock, 1 Flagged, 2 In repair, 3 Write off, 4 Sold,
 *                 5 Stolen, 6 Lost, 7 Erased.
 *
 * Rule (restricted groups only): the dropdown keeps the CURRENT status plus the
 * targets allowed for that current status; every other option is removed. So a
 * status with no allowed targets (e.g. In repair) is effectively locked.
 *   - default allowed target:  Lost (6)      -- "the only one they may change to"
 *   - In repair (2):           none          -- cannot change
 *   - Lost (6):                In stock (0)   -- may revert
 * Configure RESTRICTED_GROUPS + OVERRIDES below. Empty RESTRICTED_GROUPS = inert.
 */
(function () {
  // ---- CONFIG ---------------------------------------------------------------
  var RESTRICTED_GROUPS = [3];         // user.PERMISSION_GROUP ids to restrict. 3 = Warehouse.
                                       // (1 Manager, 2 Office, 3 Warehouse, 4 Workshop,
                                       //  5 Director, 6 Hire, 7 Finance, 8 Operations)
  var DEFAULT_ALLOWED   = [6];         // Lost — allowed target from any status unless overridden
  var OVERRIDES = { 2: [], 6: [0] };   // 2 In repair -> no change; 6 Lost -> revert to 0 In stock
  // ---------------------------------------------------------------------------

  // Allowed status values a restricted user may select, given the current one.
  function allowedTargets(current) {
    var extra = OVERRIDES.hasOwnProperty(current) ? OVERRIDES[current] : DEFAULT_ALLOWED;
    return [current].concat(extra);
  }

  // self-check (silent unless broken)
  console.assert(allowedTargets(0).join() === "0,6", "in stock -> + lost");
  console.assert(allowedTargets(2).join() === "2",   "in repair -> locked");
  console.assert(allowedTargets(6).join() === "6,0", "lost -> + in stock");

  function restricted() {
    return typeof user !== "undefined" && user &&
           RESTRICTED_GROUPS.indexOf(user.PERMISSION_GROUP) >= 0;
  }

  // The asset-status select, told apart from the item-status select (both name="STATUS")
  // by its 8 options including 6=Lost.
  function isAssetStatus(sel) {
    return sel.name === "STATUS" && sel.options.length >= 8 &&
      Array.prototype.some.call(sel.options, function (o) {
        return o.value === "6" && /lost/i.test(o.text);
      });
  }

  function apply(sel) {
    sel.dataset.hhAsr = "1";
    if (!restricted()) return;
    var allow = allowedTargets(parseInt(sel.value, 10));
    Array.prototype.slice.call(sel.options).forEach(function (o) {
      if (allow.indexOf(parseInt(o.value, 10)) < 0) o.remove();
    });
  }

  // The Edit dialog is rebuilt each time it opens, so poll (same style as loader.js).
  // Only touch a select once it is visible, by which point its value is populated.
  function scan() {
    var list = document.querySelectorAll('select[name="STATUS"]:not([data-hh-asr])');
    Array.prototype.forEach.call(list, function (sel) {
      if (!isAssetStatus(sel)) { sel.dataset.hhAsr = "1"; return; } // not ours; ignore
      if (!sel.offsetParent) return;                                // dialog not shown yet; retry
      apply(sel);
    });
  }

  setInterval(scan, 750);
  scan();
})();
