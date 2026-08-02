/*!
 * HireHop Tool: Heading Colour Swatch (Scanning + Supplying)
 * Standalone — NOT loaded by loader.js. Load directly on the scanning popup
 * and/or the job page (bookmarklet, Tampermonkey, or paste-and-run) via:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@scanning-colour-swatch-v0.4.2/tools/scanning-colour-swatch.js
 *
 * Reads the job's headings via /frames/items_to_supply_list.php, finds the
 * first custom-field value on each heading that looks like a hex colour
 * (#RRGGBB) or a hex pair (#RRGGBB/#RRGGBB for 2-tone), and:
 *
 *   • /modules/scanning/...   -> new "colour" column in the tree grid (pqgrid6)
 *                                before the Item/TITLE column. Clicking the
 *                                page's Refresh button re-fetches colours.
 *
 *   • /job.php  (Supplying)   -> tints the folder icon of every coloured
 *                                heading (and every sub-heading under it) in
 *                                the jsTree. No extra column, no fighting
 *                                HireHop's row/header/cog machinery. Also
 *                                hides the colour custom-field (any field
 *                                whose select options carry hex values) in
 *                                the Edit-heading dialog for any non-root
 *                                heading, so users only pick colour on the
 *                                top-level room.
 *
 * Convention (user-defined, plugin doesn't care about the field name):
 *   solid   = "#E30613"           - a single hex value
 *   2-tone  = "#FFD500/#00843D"   - two hex values joined by "/" (diagonal)
 *
 * Version: 0.4.2
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
    if (HEX_PAIR_RE.test(hex)) {
      var parts = hex.split('/');
      icon.style.setProperty('background', 'linear-gradient(135deg,' + parts[0] + ' 50%,' + parts[1] + ' 50%)', 'important');
    } else {
      icon.style.setProperty('background-color', hex, 'important');
    }
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
