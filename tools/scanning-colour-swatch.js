/*!
 * HireHop Tool: Heading Colour Swatch (Scanning + Supplying)
 * Standalone — NOT loaded by loader.js. Load directly on the scanning popup
 * and/or the job page (bookmarklet, Tampermonkey, or paste-and-run) via:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@scanning-colour-swatch-v0.2.0/tools/scanning-colour-swatch.js
 *
 * Reads the job's headings via /frames/items_to_supply_list.php, finds the
 * first custom-field value on each heading that looks like a hex colour
 * (#RRGGBB) or a hex pair (#RRGGBB/#RRGGBB for 2-tone), and applies a swatch
 * to every row whose top-most (level-0) heading ancestor carries a colour.
 *
 * Two surfaces:
 *   • /modules/scanning/...   -> new "colour" column in the tree grid (pqgrid6)
 *                                before the Item/TITLE column. Clicking the
 *                                page's Refresh button re-fetches colours.
 *   • /job.php               -> in-anchor swatch on every visible node of the
 *                                Supplying tab's jsTree (#items_tree1).
 *
 * Convention (user-defined, plugin doesn't care about the field name):
 *   solid   = "#E30613"           - a single hex value
 *   2-tone  = "#FFD500/#00843D"   - two hex values joined by "/" (diagonal)
 *
 * Version: 0.2.0
 */

(function () {
  'use strict';

  var isScanning = /\/modules\/scanning\//i.test(location.pathname);
  var isJob      = /\/job\.php/i.test(location.pathname);
  if (!isScanning && !isJob) return;

  var HEX_RE      = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
  var HEX_PAIR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})\/#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

  var params = new URLSearchParams(location.search);
  var jobId  = params.get('main_id') || params.get('id') || params.get('job');
  if (!jobId) return;

  var colourById = new Map();     // headingId (string) -> hex or hex-pair
  var fetched    = false;

  function loadColours(force) {
    if (fetched && !force) return Promise.resolve();
    fetched = true;
    if (force) colourById.clear();
    return fetch('/frames/items_to_supply_list.php?job=' + encodeURIComponent(jobId), { credentials: 'include' })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var items = (j && j.items) || [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          if (String(it.kind) !== '0') continue;         // headings only
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

  // Two style variants: the pqgrid cell is centred in a fixed-width column,
  // so it uses no right-margin. The jsTree in-anchor swatch sits next to text.
  function swatchHtml(hex, marginRightPx) {
    var mr = marginRightPx || 0;
    var base = 'display:inline-block;width:14px;height:14px;border:1px solid #888;border-radius:2px;vertical-align:middle;margin-right:' + mr + 'px;';
    if (HEX_PAIR_RE.test(hex)) {
      var parts = hex.split('/');
      return '<span class="hh-swatch" style="' + base + 'background:linear-gradient(135deg,' + parts[0] + ' 50%,' + parts[1] + ' 50%)"></span>';
    }
    return '<span class="hh-swatch" style="' + base + 'background:' + hex + '"></span>';
  }

  // ---------------------------------------------------------------------------
  // Scanning module — pqgrid6 tree grid
  // ---------------------------------------------------------------------------

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

  function injectScanColumn() {
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
        var hex  = colourById.get(level0HeadingId(row, data));
        return hex ? swatchHtml(hex, 0) : '';
      }
    });

    try {
      $g.pqGrid('option', 'colModel', cm);
      $g.pqGrid('refresh');
    } catch (e) {}
  }

  function bindScanRefresh() {
    var $ = window.jQuery;
    if (!$ || window.__hh_scanRefreshBound) return;
    window.__hh_scanRefreshBound = true;
    // The top-level scanning-module Refresh button lives inside #button_bar
    // as <button class="func ...">Refresh</button>. Rebuild the colour map
    // then force pqgrid6 to redraw so its render fn re-runs with fresh data.
    $(document).on('click', '#button_bar button.func', function () {
      var txt = $.trim($(this).text());
      if (txt !== 'Refresh') return;
      loadColours(true).then(function () {
        var $g = $('#pqgrid6');
        if ($g.length) { try { $g.pqGrid('refresh'); } catch (e) {} }
      });
    });
  }

  function bootstrapScanning() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var $ = window.jQuery;
      if ($ && $('#pqgrid6').length) {
        loadColours().then(injectScanColumn);
        bindScanRefresh();
        clearInterval(timer);
        setInterval(injectScanColumn, 2000);
      } else if (tries > 60) {
        clearInterval(timer);
      }
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Supplying tab — jsTree (#items_tree1)
  // ---------------------------------------------------------------------------

  function paintTreeNode(li, hex) {
    // Clean up any prior swatch (may live directly on the LI or, from older
    // versions, inside the anchor)
    var stale = li.querySelectorAll(':scope > .hh-swatch, :scope > .jstree-anchor > .hh-swatch');
    for (var s = 0; s < stale.length; s++) stale[s].remove();
    if (!hex) return;
    var wrap = document.createElement('span');
    wrap.innerHTML = swatchHtml(hex, 4);
    var span = wrap.firstChild;
    // Insert as the LI's first child so it appears before every jstree icon
    // (expand/collapse chevron, theme icon) and the label.
    li.insertBefore(span, li.firstChild);
  }

  function paintSupplyingTree() {
    var $ = window.jQuery;
    if (!$) return;
    var $tree = $('#items_tree1');
    if (!$tree.length) return;
    var inst = $tree.jstree(true);
    if (!inst || !inst.get_children_dom) return;
    var roots = inst.get_children_dom('#').toArray();
    for (var i = 0; i < roots.length; i++) {
      var li = roots[i];
      if (!li.classList.contains('node_heading')) continue;
      var headingId = li.id.replace(/^[a-z]/, '');
      var hex = colourById.get(String(headingId));
      paintTreeNode(li, hex);
      var descendants = li.querySelectorAll('.jstree-node');
      for (var j = 0; j < descendants.length; j++) {
        paintTreeNode(descendants[j], hex);
      }
    }
  }

  function bindSupplyingEvents() {
    var $ = window.jQuery;
    if (!$ || window.__hh_supplyBound) return;
    var $tree = $('#items_tree1');
    if (!$tree.length) return;
    window.__hh_supplyBound = true;
    // Repaint whenever jstree changes structure or draws new nodes
    $tree.on('after_open.jstree redraw.jstree refresh.jstree load_node.jstree create_node.jstree move_node.jstree', function () {
      setTimeout(paintSupplyingTree, 0);
    });
  }

  function bootstrapSupplying() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var $ = window.jQuery;
      if ($ && $('#items_tree1').length && $('#items_tree1').jstree(true)) {
        loadColours().then(function () {
          paintSupplyingTree();
          bindSupplyingEvents();
        });
        clearInterval(timer);
        // Cheap safety net — repaint every 2s covers any event we didn't hook
        setInterval(paintSupplyingTree, 2000);
      } else if (tries > 120) {
        clearInterval(timer);
      }
    }, 500);
  }

  if (isScanning) bootstrapScanning();
  if (isJob)      bootstrapSupplying();
})();
