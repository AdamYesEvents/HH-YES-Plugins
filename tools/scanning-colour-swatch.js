/*!
 * HireHop Tool: Heading Colour Swatch (Scanning + Supplying)
 * Standalone — NOT loaded by loader.js. Load directly on the scanning popup
 * and/or the job page (bookmarklet, Tampermonkey, or paste-and-run) via:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@scanning-colour-swatch-v0.6.0/tools/scanning-colour-swatch.js
 *
 * Reads the job's headings via /frames/items_to_supply_list.php, collects
 * every custom-field value on each heading that looks like a hex colour
 * (#RRGGBB), and composes them into a single "hex[/hex...]" descriptor:
 *
 *   • /modules/scanning/...   -> adds a narrow "colour" column in the tree
 *                                grid (pqgrid6) before the Item column. Every
 *                                row shows the swatch of its top-level room.
 *                                Also auto-selects the Tree view on load and
 *                                re-fetches on the Refresh button click.
 *
 *   • /job.php  (Supplying)   -> tints the folder icon of every coloured
 *                                heading (and every sub-heading under it) in
 *                                the jsTree. Also hides colour custom-fields
 *                                in the Edit-heading dialog on non-root
 *                                headings, so colour is only picked on the
 *                                top-level room.
 *
 * Colour composition:
 *   1 hex   -> solid                            "#E30613"
 *   2 hex   -> 4 diagonal stripes (2 of each)   "#FFD500/#00843D" (e.g. earth)
 *   N hex   -> 2N diagonal stripes (2 of each)
 * If a heading has both an A-Colour and B-Colour custom field set, the
 * plugin gathers them in the key order returned by the API and joins with
 * "/", so users can compose any 2-tone (or 3-tone) tape colour without a
 * plugin change.
 *
 * Version: 0.6.0
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

  var colourById = new Map();     // headingId (string) -> "hex" or "hex/hex[/hex]"
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
          // Collect every hex-valued custom field on this heading, in key
          // order (A-Colour naturally sorts before B-Colour). A legacy
          // "hex/hex" value in a single field is split into its parts so
          // old data still renders as multi-tone.
          var hexValues = [];
          for (var key in cf) {
            if (!Object.prototype.hasOwnProperty.call(cf, key)) continue;
            var v = cf[key] && cf[key].value;
            if (typeof v !== 'string') continue;
            if (HEX_RE.test(v))      { hexValues.push(v); }
            else if (HEX_PAIR_RE.test(v)) { hexValues.push.apply(hexValues, v.split('/')); }
          }
          if (hexValues.length) colourById.set(String(it.ID), hexValues.join('/'));
        }
      })
      .catch(function () { /* swallow — no swatches if the fetch fails */ });
  }

  // Turn a "hex" or "hex/hex[/hex]" descriptor into a CSS background value.
  // 1 hex -> the hex itself (solid). N hex -> a 2N-stripe diagonal repeat.
  function backgroundForHex(hex) {
    var parts = String(hex).split('/');
    if (parts.length <= 1) return parts[0];
    var stripes = parts.length * 2;
    var seg = 100 / stripes;
    var stops = [];
    for (var i = 0; i < stripes; i++) {
      var c = parts[i % parts.length];
      stops.push(c + ' ' + (i * seg) + '% ' + ((i + 1) * seg) + '%');
    }
    return 'linear-gradient(135deg, ' + stops.join(', ') + ')';
  }

  // ---------------------------------------------------------------------------
  // Scanning module — inject a narrow swatch column into pqgrid6
  //
  // Each row in pqgrid6 gets the swatch of its top-level heading ancestor
  // (walked via parentId in the row data). The column is 28px wide, sits
  // immediately before the Item/TITLE column, and renders solid or
  // multi-stripe backgrounds via backgroundForHex().
  //
  // Also auto-selects the "Tree" view tab once on page load so the coloured
  // rows are visible without the user having to switch view.
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

  function scanSwatchHtml(hex) {
    if (!hex) return '';
    var style = 'display:inline-block;width:16px;height:16px;border:1px solid #888;border-radius:2px;vertical-align:middle;background:' + backgroundForHex(hex) + ';';
    return '<span class="hh-swatch" style="' + style + '"></span>';
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
      title:     '',
      dataIndx:  '__hh_colour_swatch',
      width:     28,
      minWidth:  28,
      maxWidth:  28,
      sortable:  false,
      resizable: false,
      menuIcon:  false,
      halign:    'center',
      render: function (ui) {
        var row = ui && ui.rowData;
        if (!row) return '';
        var data = ($g.pqGrid('option', 'dataModel') || {}).data || [];
        return scanSwatchHtml(colourById.get(level0HeadingId(row, data)));
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
    // as <button class="func ...">Refresh</button>. Reload the colour map
    // then force a grid refresh so the render fn re-runs with fresh data.
    $(document).on('click', '#button_bar button.func', function () {
      var txt = $.trim($(this).text());
      if (txt !== 'Refresh') return;
      loadColours(true).then(function () {
        var $g = $('#pqgrid6');
        if ($g.length) { try { $g.pqGrid('refresh'); } catch (e) {} }
      });
    });
  }

  // One-shot: on first page load, click the "Tree" view tab so the coloured
  // headings are visible without the user having to switch view.
  function selectTreeViewOnce() {
    if (window.__hh_scanTreeSelected) return;
    var anchors = document.querySelectorAll('.ui-tabs-anchor');
    for (var i = 0; i < anchors.length; i++) {
      if ((anchors[i].textContent || '').trim() !== 'Tree') continue;
      var tab = anchors[i].closest('.ui-tabs-tab');
      if (tab && tab.classList.contains('ui-tabs-active')) {
        window.__hh_scanTreeSelected = true;   // already active, done
        return;
      }
      anchors[i].click();
      window.__hh_scanTreeSelected = true;
      return;
    }
  }

  function bootstrapScanning() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var $ = window.jQuery;
      if ($ && $('#pqgrid6').length) {
        selectTreeViewOnce();
        loadColours().then(injectScanColumn);
        bindScanRefresh();
        clearInterval(timer);
        // Safety net — pqgrid rebuilds on scroll/filter/refresh; make sure
        // the column comes back if it's lost.
        setInterval(injectScanColumn, 2000);
        // Every 30s refetch colours in case a heading was added/recoloured
        setInterval(function () {
          loadColours(true).then(function () {
            try { $('#pqgrid6').pqGrid('refresh'); } catch (e) {}
          });
        }, 30000);
      } else if (tries > 60) {
        clearInterval(timer);
      }
    }, 500);
  }

  // ---------------------------------------------------------------------------
  // Supplying tab — tint the folder icons of coloured headings
  //
  // Each heading in the jsTree carries a folder icon (jstree-themeicon) drawn
  // from the sprite at /js/jstree/themes/default/32px.png. We overwrite the
  // icon's background-image with a CSS mask that reuses the same sprite
  // shape, then paint any hex/hex-pair colour behind it. Sub-headings inside
  // a coloured top-level heading inherit the same colour.
  //
  // No table cells, no header changes, no cog integration — HireHop's own
  // machinery is untouched. We only re-tint on jstree events (open, close,
  // redraw, load, create, move) and via a 1s safety net.
  // ---------------------------------------------------------------------------

  var HH_ICON_SPRITE = 'https://myhirehop.com/js/jstree/themes/default/32px.png';
  var HH_POS_CLOSED  = '-260px -4px';
  var HH_POS_OPEN    = '-228px -4px';

  function cleanLegacySupplyingArtifacts() {
    // v0.1.x — v0.3.6 injected swatch cells, header cells, tree padding
    // and anchor styles. Wipe them so nothing lingers.
    var tree = document.getElementById('items_tree1');
    if (tree) {
      tree.style.paddingLeft = '';
      tree.style.position    = '';
      delete tree.dataset.hhPadded;
      var container = tree.parentElement;
      if (container) {
        container.style.paddingLeft = '';
        container.style.position    = '';
      }
      var anchors = tree.querySelectorAll('.jstree-anchor');
      for (var i = 0; i < anchors.length; i++) {
        anchors[i].style.position = '';
        anchors[i].style.overflow = '';
      }
      var stale = tree.querySelectorAll('.hh-swatch');
      for (var j = 0; j < stale.length; j++) stale[j].remove();
    }
    var oldCols = document.querySelectorAll('.column_HH_COLOUR');
    for (var k = 0; k < oldCols.length; k++) oldCols[k].remove();
    var oldMenu = document.querySelectorAll('[data-field="HH_COLOUR"]');
    for (var m = 0; m < oldMenu.length; m++) oldMenu[m].remove();
  }

  function tintHeadingIcon(li, hex) {
    var icon = li.querySelector(':scope > .jstree-anchor > i.jstree-themeicon');
    if (!icon) return;
    var pos = li.classList.contains('jstree-open') ? HH_POS_OPEN : HH_POS_CLOSED;
    var maskValue = 'url("' + HH_ICON_SPRITE + '") ' + pos + ' no-repeat';
    icon.style.setProperty('background-image', 'none',    'important');
    icon.style.setProperty('mask',              maskValue, 'important');
    icon.style.setProperty('-webkit-mask',      maskValue, 'important');
    icon.style.setProperty('background', backgroundForHex(hex), 'important');
    icon.dataset.hhTinted = '1';
  }

  function paintAllHeadings() {
    var $ = window.jQuery;
    if (!$) return;
    var $tree = $('#items_tree1');
    if (!$tree.length) return;
    var inst = $tree.jstree(true);
    if (!inst || !inst.get_children_dom) return;
    var roots = inst.get_children_dom('#').toArray();
    for (var i = 0; i < roots.length; i++) {
      var rootLi = roots[i];
      if (!rootLi.classList.contains('node_heading')) continue;
      var hex = colourById.get(String(rootLi.id.replace(/^[a-z]/, '')));
      if (!hex) continue;
      tintHeadingIcon(rootLi, hex);
      var subHeadings = rootLi.querySelectorAll('.jstree-node.node_heading');
      for (var j = 0; j < subHeadings.length; j++) {
        tintHeadingIcon(subHeadings[j], hex);
      }
    }
  }

  function refreshColoursThenPaint() {
    loadColours(true).then(paintAllHeadings);
  }

  // Hide the colour custom-field on non-root headings so the user only sets
  // colour on top-level rooms. Colour field = any .custom_field_container
  // whose <select> has at least one hex-valued option.
  function applyColourFieldVisibility() {
    var $ = window.jQuery;
    if (!$) return;
    var dialog = null;
    var dialogs = document.querySelectorAll('.ui-dialog');
    for (var i = 0; i < dialogs.length; i++) {
      var d = dialogs[i];
      if (d.offsetParent === null) continue;   // not visible
      var t = d.querySelector('.ui-dialog-title');
      if (t && t.innerText.trim() === 'Edit heading') { dialog = d; break; }
    }
    if (!dialog) return;
    var inst = $('#items_tree1').jstree(true);
    if (!inst) return;
    var selected = inst.get_selected(true)[0];
    if (!selected) return;
    var isRootLevel = selected.parent === '#';
    var containers = dialog.querySelectorAll('.custom_field_container');
    for (var c = 0; c < containers.length; c++) {
      var container = containers[c];
      var select = container.querySelector('select.custom_field');
      if (!select) continue;
      var hasHexOption = false;
      for (var o = 0; o < select.options.length; o++) {
        if (HEX_RE.test(select.options[o].value) || HEX_PAIR_RE.test(select.options[o].value)) {
          hasHexOption = true; break;
        }
      }
      if (hasHexOption) container.style.display = isRootLevel ? '' : 'none';
    }
  }

  function bindSupplyingEvents() {
    var $ = window.jQuery;
    if (!$ || window.__hh_supplyBound) return;
    window.__hh_supplyBound = true;
    var $tree = $('#items_tree1');
    // Cheap events (no map change) — just re-tint with the current map
    $tree.on(
      'after_open.jstree after_close.jstree redraw.jstree load_node.jstree move_node.jstree',
      function () { setTimeout(paintAllHeadings, 0); }
    );
    // Structural events that could add a new heading or change its custom
    // fields — refetch the colour map first, then re-tint.
    $tree.on(
      'create_node.jstree rename_node.jstree refresh.jstree set_text.jstree',
      function () { setTimeout(refreshColoursThenPaint, 0); }
    );
    // Whenever a jQuery-UI dialog opens (delegated at the document level),
    // sync the colour custom-field visibility if it's the Edit-heading one.
    $(document).on('dialogopen.hh_swatch', function () {
      setTimeout(applyColourFieldVisibility, 0);
    });
  }

  function bootstrapSupplying() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var $ = window.jQuery;
      if ($ && $('#items_tree1').length && $('#items_tree1').jstree(true)) {
        cleanLegacySupplyingArtifacts();
        loadColours().then(function () {
          paintAllHeadings();
          bindSupplyingEvents();
        });
        clearInterval(timer);
        // Safety net — re-tint every second so HireHop tree rebuilds don't
        // leave stale (or reverted-to-default) icons for long. Also enforces
        // colour-field visibility in case the dialogopen event was missed.
        setInterval(function () {
          paintAllHeadings();
          applyColourFieldVisibility();
        }, 1000);
        // And every 30s refetch the colour map so headings the user just
        // created / recoloured pick up their tint without a page reload.
        setInterval(refreshColoursThenPaint, 30000);
      } else if (tries > 120) {
        clearInterval(timer);
      }
    }, 500);
  }

  if (isScanning) bootstrapScanning();
  if (isJob)      bootstrapSupplying();
})();
