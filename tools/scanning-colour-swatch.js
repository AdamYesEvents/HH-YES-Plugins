/*!
 * HireHop Tool: Scanning heading colour swatch
 * Standalone — NOT loaded by loader.js. Load directly on the scanning popup
 * (bookmarklet, Tampermonkey, or paste-and-run) via:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@scanning-colour-swatch-v0.1.0/tools/scanning-colour-swatch.js
 *
 * Runs only on /modules/scanning/. Reads the job's headings via
 * /frames/items_to_supply_list.php, finds the first custom-field value on each
 * heading that looks like a hex colour (#RRGGBB) or a hex pair
 * (#RRGGBB/#RRGGBB for 2-tone), and injects a swatch column into the tree grid
 * (pqgrid6) immediately before the Item/TITLE column. Every row shows the
 * colour of its top-most (level-0) heading ancestor.
 *
 * Convention (user-defined, plugin doesn't care about the field name):
 *   solid   = "#E30613"           - a single hex triples/sixes value
 *   2-tone  = "#FFD500/#00843D"   - two hex values joined by "/" (diagonal)
 *
 * Version: 0.1.0
 */

(function () {
  'use strict';

  if (!/\/modules\/scanning\//i.test(location.pathname)) return;

  var HEX_RE      = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  var HEX_PAIR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})\/#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

  var params = new URLSearchParams(location.search);
  var jobId  = params.get('main_id') || params.get('job') || params.get('id');
  if (!jobId) return;

  var colourById = new Map();     // headingId (string) -> hex or hex-pair string
  var fetched    = false;

  function loadColours() {
    if (fetched) return Promise.resolve();
    fetched = true;
    return fetch('/frames/items_to_supply_list.php?job=' + encodeURIComponent(jobId), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var items = (j && j.items) || [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (String(it.kind) !== '0') continue;       // headings only
          var cf = it.CUSTOM_FIELDS;
          if (!cf || typeof cf !== 'object') continue;
          for (var key in cf) {
            if (!Object.prototype.hasOwnProperty.call(cf, key)) continue;
            var v = cf[key] && cf[key].value;
            if (typeof v !== 'string') continue;
            if (HEX_RE.test(v) || HEX_PAIR_RE.test(v)) {
              colourById.set(String(it.ID), v);
              break;
            }
          }
        }
      })
      .catch(function () { /* swallow — no swatches if the fetch fails */ });
  }

  function renderSwatch(hex) {
    if (!hex) return '';
    var base = 'display:inline-block;width:16px;height:16px;border:1px solid #888;border-radius:2px;vertical-align:middle;';
    if (HEX_PAIR_RE.test(hex)) {
      var parts = hex.split('/');
      return '<span style="' + base + 'background:linear-gradient(135deg,' + parts[0] + ' 50%,' + parts[1] + ' 50%)"></span>';
    }
    return '<span style="' + base + 'background:' + hex + '"></span>';
  }

  var cachedData = null, cachedIndex = null;
  function indexRows(data) {
    if (data === cachedData) return cachedIndex;
    cachedData  = data;
    cachedIndex = new Map();
    for (var i = 0; i < data.length; i++) {
      if (data[i] && data[i].item_index) cachedIndex.set(data[i].item_index, data[i]);
    }
    return cachedIndex;
  }

  function level0HeadingId(row, data) {
    if (!row) return null;
    var idx = indexRows(data);
    var cur = row, guard = 0;
    while (cur && cur.parentId && guard++ < 100) {
      var p = idx.get(cur.parentId);
      if (!p) break;
      cur = p;
    }
    return cur ? String(cur.ID) : null;
  }

  function injectColumn() {
    var $ = window.jQuery;
    if (!$) return;
    var $g = $('#pqgrid6');
    if (!$g.length) return;

    var opts;
    try { opts = $g.pqGrid('option'); } catch (e) { return; }
    var cm = opts.colModel || [];
    if (cm.some(function (c) { return c.dataIndx === '__hh_colour_swatch'; })) return;

    var titleIdx = cm.findIndex(function (c) { return c.dataIndx === 'TITLE'; });
    if (titleIdx < 0) titleIdx = 0;

    cm.splice(titleIdx, 0, {
      title:      '',
      dataIndx:   '__hh_colour_swatch',
      width:      28,
      minWidth:   28,
      maxWidth:   28,
      sortable:   false,
      resizable:  false,
      menuIcon:   false,
      halign:     'center',
      render: function (ui) {
        var row = ui && ui.rowData;
        if (!row) return '';
        var data = ($g.pqGrid('option', 'dataModel') || {}).data || [];
        return renderSwatch(colourById.get(level0HeadingId(row, data)));
      }
    });

    try {
      $g.pqGrid('option', 'colModel', cm);
      $g.pqGrid('refresh');
    } catch (e) {}
  }

  var tries = 0;
  var timer = setInterval(function () {
    tries++;
    var $ = window.jQuery;
    if ($ && $('#pqgrid6').length) {
      loadColours().then(injectColumn);
      clearInterval(timer);
      setInterval(injectColumn, 2000);
    } else if (tries > 60) {
      clearInterval(timer); // give up after ~30s
    }
  }, 500);
})();
