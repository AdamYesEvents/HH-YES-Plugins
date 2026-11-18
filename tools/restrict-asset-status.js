/*!
 * HireHop Tool: Restrict Asset Status
 * For configured permission groups, limits the asset STATUS control in the stock
 * module's asset Edit dialog (select[name="STATUS"]):
 *   - from an "active" status the only change allowed is to Lost;
 *   - for any other (terminal) status the whole Status field is hidden.
 * Client-side UI restriction only (hides options / the field) — NOT server-enforced.
 *
 * Version: 0.1.3
 *
 * Asset statuses: 0 In stock, 1 Flagged, 2 In repair, 3 Write off, 4 Sold,
 *                 5 Stolen, 6 Lost, 7 Erased.
 * HireHop pre-selects the <select> value only for "active" statuses (In stock,
 * Flagged, In repair give value 0/1/2 with all 8 options); for disposed ones
 * (Write off/Sold/Stolen/Lost/Erased) it blanks the value and offers only revert
 * targets. So a current status we don't allow is detected either by its value
 * being in ALLOW_FROM or not (NaN for the blanked ones -> not allowed -> hidden).
 *
 * Rule for restricted groups:
 *   - current status in ALLOW_FROM -> keep it, allow only -> Lost, remove the rest
 *   - any other current status      -> hide the whole Status field (label + control)
 */
(function () {
  // ---- CONFIG ---------------------------------------------------------------
  var RESTRICTED_GROUPS = [2, 9];   // user.PERMISSION_GROUP ids: 2 = Office, 9 = WarehouseManager
  var ALLOW_FROM = [0, 1];          // statuses a change is allowed from: In stock, Flagged
  var ALLOW_TARGET = 6;             // the only status they may change TO: Lost
  // Any status not in ALLOW_FROM (In repair, Write off, Sold, Stolen, Lost, Erased) -> field hidden.
  // ---------------------------------------------------------------------------

  function restricted() {
    return typeof user !== "undefined" && user &&
           RESTRICTED_GROUPS.indexOf(user.PERMISSION_GROUP) >= 0;
  }

  // The asset-status <select> (has a "Lost" option), told apart from the
  // item-status one (Active/Hidden/Deleted, no "Lost").
  function isAssetStatus(sel) {
    return sel.name === "STATUS" &&
      Array.prototype.some.call(sel.options, function (o) { return o.value === "6" && /lost/i.test(o.text); });
  }

  function apply(sel) {
    if (!restricted()) return;
    var tr = sel.closest("tr");
    var cur = parseInt(sel.value, 10);           // NaN for HireHop's blanked (terminal) statuses
    if (ALLOW_FROM.indexOf(cur) >= 0) {
      if (tr) tr.style.display = "";             // active & allowed: show field + prune to {cur, Lost}
      Array.prototype.slice.call(sel.options).forEach(function (o) {
        var v = parseInt(o.value, 10);
        if (v !== cur && v !== ALLOW_TARGET) o.remove();
      });
    } else if (tr) {
      tr.style.display = "none";                 // terminal / disallowed: hide the whole field
    }
  }

  // self-check (silent unless broken): which action each current status triggers
  (function () {
    function action(v) { return ALLOW_FROM.indexOf(parseInt(v, 10)) >= 0 ? "prune" : "hide"; }
    console.assert(action("0") === "prune", "in stock -> prune");
    console.assert(action("1") === "prune", "flagged -> prune");
    console.assert(action("2") === "hide",  "in repair -> hide");
    console.assert(action("3") === "hide",  "write off -> hide");
    console.assert(action("")  === "hide",  "blanked terminal -> hide");
  })();

  // The Edit dialog's DOM is reused across assets and repopulated on each open, so
  // re-apply whenever a select's state (value + option count) changes, not just once.
  // Gate on the dialog FORM's visibility, not the select's: once we hide the Status
  // row the select itself has no layout, but we still must re-show it for the next
  // (active) asset in the reused dialog.
  function scan() {
    Array.prototype.forEach.call(document.querySelectorAll('select[name="STATUS"]'), function (sel) {
      if (!isAssetStatus(sel)) return;
      var form = sel.closest("form");
      if (!form || form.getClientRects().length === 0) return;   // Edit dialog not open
      var sig = sel.value + "|" + sel.options.length;
      if (sel.__hhAsrSig === sig) return;
      sel.__hhAsrSig = sig;
      apply(sel);
    });
  }

  setInterval(scan, 500);
  scan();
})();
