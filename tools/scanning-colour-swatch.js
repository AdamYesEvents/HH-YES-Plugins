/*!
 * HireHop Tool: Heading Colour Swatch (Scanning + Supplying)
 * Standalone — NOT loaded by loader.js. Load directly on the scanning popup
 * and/or the job page (bookmarklet, Tampermonkey, or paste-and-run) via:
 *   https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@scanning-colour-swatch-v0.3.3/tools/scanning-colour-swatch.js
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
 *   • /job.php               -> a real table column ("column_HH_COLOUR") is
 *                                appended to the Supplying header (with a 🎨
 *                                symbol) AND to every row's cust_node table.
 *                                A matching item is added to the column-cog
 *                                menu so the user can show/hide it, and its
 *                                position follows the header's sortable order.
 *
 * Convention (user-defined, plugin doesn't care about the field name):
 *   solid   = "#E30613"           - a single hex value
 *   2-tone  = "#FFD500/#00843D"   - two hex values joined by "/" (diagonal)
 *
 * Version: 0.3.3
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
  // Supplying tab — real table column integrated with HireHop's cog menu
  //
  // The Supplying tree is a jsTree whose header lives in a separate table
  // (.supplying_list_heads) and each row's cells live in a table.cust_node
  // inside the jstree-anchor. HireHop's column-cog menu toggles cells by their
  // shared "column_<FIELD>" class. We add:
  //   1. a header cell   .column_HH_COLOUR (with the 🎨 symbol)
  //   2. matching row cell .column_HH_COLOUR on every cust_node table
  //   3. a menu item     [data-field="HH_COLOUR"] with its own toggle handler
  // Hiding/showing then just flips display on every .column_HH_COLOUR cell.
  // ---------------------------------------------------------------------------

  var COL_CLASS  = 'column_HH_COLOUR';
  var COL_FIELD  = 'HH_COLOUR';
  var COL_LABEL  = 'Colour';
  var COL_SYMBOL = '🎨';   // 🎨 palette
  var COL_WIDTH  = '24px';
  var hhHidden   = false;            // last-known toggle state, applied to fresh row cells

  function cleanLegacySupplyingSwatches() {
    // v0.1.x — v0.2.1 injected swatches into anchors and mutated tree padding.
    // Wipe those so the new column doesn't collide with them.
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
      for (var j = 0; j < stale.length; j++) {
        // Only remove old-style swatches (not those inside our new column cells)
        if (!stale[j].closest('.' + COL_CLASS)) stale[j].remove();
      }
    }
  }

  function swatchElement(hex) {
    var span = document.createElement('span');
    span.className = 'hh-swatch';
    span.style.cssText = 'display:inline-block;width:14px;height:14px;border:1px solid #888;border-radius:2px;vertical-align:middle;';
    if (HEX_PAIR_RE.test(hex)) {
      var parts = hex.split('/');
      span.style.background = 'linear-gradient(135deg,' + parts[0] + ' 50%,' + parts[1] + ' 50%)';
    } else {
      span.style.background = hex;
    }
    return span;
  }

  function ensureHeaderCell() {
    var header = document.querySelector('.supplying_list_heads');
    if (!header || !header.rows[0]) return false;
    var row = header.rows[0];
    if (row.querySelector('.' + COL_CLASS)) return true;
    // HireHop's sortable is set up with items: "th:not(.compulsory)" — must be <th>
    var th = document.createElement('th');
    th.className = COL_CLASS + ' ltr ui-sortable-handle';
    th.style.width     = COL_WIDTH;
    th.style.textAlign = 'center';
    th.title           = COL_LABEL;
    th.textContent     = COL_SYMBOL;
    if (hhHidden) th.style.display = 'none';
    row.appendChild(th);
    // Tell the sortable widget about the new item
    var $ = window.jQuery;
    if ($) { try { $(header).sortable('refresh'); } catch (e) {} }
    return true;
  }

  function fieldOf(el) {
    var m = el.className.match(/column_([A-Z_0-9]+)/);
    return m ? m[1] : null;
  }

  // Insert row cells at the position that matches HH_COLOUR's index in the
  // header, so they line up with the header's current sort order.
  function ensureRowCell(li, hex) {
    var table = li.querySelector(':scope > .jstree-anchor > table.cust_node');
    if (!table) return;
    var header = document.querySelector('.supplying_list_heads');
    var headerCells = header && header.rows[0] ? header.rows[0].cells : [];
    var targetIndex = -1;
    for (var h = 0; h < headerCells.length; h++) {
      if (fieldOf(headerCells[h]) === COL_FIELD) { targetIndex = h; break; }
    }
    for (var r = 0; r < table.rows.length; r++) {
      var row = table.rows[r];
      var existing = row.querySelector('.' + COL_CLASS);
      if (existing) existing.remove();
      var td = document.createElement('td');
      td.className = COL_CLASS;
      // Match HireHop's standard column visuals: right-side grey separator
      td.style.cssText = 'width:' + COL_WIDTH + ';text-align:center;padding:0;border-right:1px solid #aaa;';
      if (hhHidden) td.style.display = 'none';
      if (hex) td.appendChild(swatchElement(hex));
      var before = (targetIndex >= 0 && row.cells[targetIndex]) ? row.cells[targetIndex] : null;
      row.insertBefore(td, before);
    }
  }

  // Rebuild every row's cell order to match the header. Called after a
  // header drag lands, and defensively after paintAllRows finishes.
  function reorderRowsToMatchHeader() {
    var header = document.querySelector('.supplying_list_heads');
    if (!header || !header.rows[0]) return;
    var headerCells = header.rows[0].cells;
    var rowTables = document.querySelectorAll('table.cust_node');
    for (var t = 0; t < rowTables.length; t++) {
      var trow = rowTables[t].rows[0];
      if (!trow) continue;
      var byField = {};
      var compulsory = null;
      for (var c = 0; c < trow.cells.length; c++) {
        var cell = trow.cells[c];
        var f = fieldOf(cell);
        if (f) byField[f] = cell;
        else if (!compulsory) compulsory = cell;
      }
      for (var i = 0; i < headerCells.length; i++) {
        var hf = fieldOf(headerCells[i]);
        if (hf && byField[hf]) trow.appendChild(byField[hf]);
        else if (!hf && compulsory) { trow.appendChild(compulsory); compulsory = null; }
      }
    }
  }

  function paintAllRows() {
    var $ = window.jQuery;
    if (!$) return;
    var $tree = $('#items_tree1');
    if (!$tree.length) return;
    var inst = $tree.jstree(true);
    if (!inst || !inst.get_children_dom) return;
    ensureHeaderCell();
    var roots = inst.get_children_dom('#').toArray();
    for (var i = 0; i < roots.length; i++) {
      var li = roots[i];
      if (!li.classList.contains('node_heading')) continue;
      var hex = colourById.get(String(li.id.replace(/^[a-z]/, '')));
      ensureRowCell(li, hex);
      var descendants = li.querySelectorAll('.jstree-node');
      for (var j = 0; j < descendants.length; j++) {
        ensureRowCell(descendants[j], hex);
      }
    }
    // Defensive re-align in case a header drag happened between paints
    reorderRowsToMatchHeader();
  }

  function toggleColumn(hide) {
    hhHidden = !!hide;
    var cells = document.querySelectorAll('.' + COL_CLASS);
    for (var i = 0; i < cells.length; i++) cells[i].style.display = hhHidden ? 'none' : '';
  }

  function ensureMenuItem() {
    // Find any currently-visible column config menu (cog opens it)
    var menus = document.querySelectorAll('.ui-menu.ui-menu-icons');
    for (var i = 0; i < menus.length; i++) {
      var menu = menus[i];
      if (menu.offsetParent === null) continue;
      if (menu.querySelector('[data-field="' + COL_FIELD + '"]')) continue;
      // Only inject into menus that already have data-field items (i.e. column menus)
      if (!menu.querySelector('[data-field]')) continue;

      var li = document.createElement('li');
      li.className   = 'ui-menu-item';
      li.dataset.field = COL_FIELD;
      li.innerHTML = '<div class="ui-menu-item-wrapper" role="menuitem">' +
                     '<span class="ui-icon ' + (hhHidden ? 'ui-icon-blank' : 'ui-icon-check') + '"></span>' +
                     '<span>' + COL_LABEL + '</span>' +
                     '</div>';
      li.addEventListener('click', function (e) {
        e.stopPropagation();
        var icon = li.querySelector('.ui-icon');
        var currentlyChecked = icon.classList.contains('ui-icon-check');
        toggleColumn(currentlyChecked);   // if checked, hide
        icon.classList.toggle('ui-icon-check', !currentlyChecked);
        icon.classList.toggle('ui-icon-blank', currentlyChecked);
      });
      menu.appendChild(li);
    }
  }

  function bindSupplyingEvents() {
    var $ = window.jQuery;
    if (!$ || window.__hh_supplyBound) return;
    window.__hh_supplyBound = true;

    $('#items_tree1').on('after_open.jstree redraw.jstree refresh.jstree load_node.jstree create_node.jstree move_node.jstree', function () {
      setTimeout(paintAllRows, 0);
    });

    // When user drops a header cell, reorder every row to match
    $('.supplying_list_heads').on('sortupdate.hh_swatch sortstop.hh_swatch', function () {
      setTimeout(reorderRowsToMatchHeader, 0);
    });

    // Watch for the cog menu appearing so we can inject our item.
    // Menu is rebuilt each time HireHop shows it, so hook the whole document.
    $(document).on('mouseup click', function () {
      setTimeout(ensureMenuItem, 0);
      setTimeout(ensureMenuItem, 150);
    });
  }

  function bootstrapSupplying() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      var $ = window.jQuery;
      if ($ && $('#items_tree1').length && $('#items_tree1').jstree(true)) {
        cleanLegacySupplyingSwatches();
        loadColours().then(function () {
          paintAllRows();
          bindSupplyingEvents();
        });
        clearInterval(timer);
        // Safety net — re-ensure header + row cells periodically in case
        // HireHop rebuilds the tree DOM (e.g. tab switch, refresh)
        setInterval(paintAllRows, 2000);
      } else if (tries > 120) {
        clearInterval(timer);
      }
    }, 500);
  }

  if (isScanning) bootstrapScanning();
  if (isJob)      bootstrapSupplying();
})();
