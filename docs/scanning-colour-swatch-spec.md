# Scanning Colour Swatch — design & history

**Tool:** `tools/scanning-colour-swatch.js`
**Current release:** `scanning-colour-swatch-v1.0.0` (tagged from `v0.7.1`)
**Loaded by:** `loader.js` `TOOLS["scanning-colour-swatch"].ref`

Standalone tool that surfaces per-heading "room colours" on two HireHop surfaces so operators can tell at a glance which room a row belongs to.

---

## Data model

Colour lives on **root-level headings** as one or more custom fields whose value is a hex colour. The plugin doesn't care what the fields are named — anything with a value matching `#RRGGBB` or `#RRGGBB/#RRGGBB` counts. Convention:

- Field 1 (e.g. `A-Colour`) — primary colour
- Field 2 (e.g. `B-Colour`) — optional secondary
- Extra fields (`C-Colour`, …) — also supported

Each field renders as **one tile**. A legacy "Earth" preset that stored a single field as `#FFD500/#00843D` renders as one diagonally-striped tile. Two solid picks (A=Red, B=Blue) render as two side-by-side solid tiles.

Colour is loaded once from `/frames/items_to_supply_list.php?job=<ID>`, cached in `colourById: Map<headingId, string[]>`, and refetched on jstree change events + every 30s.

---

## Surfaces

### Scanning module — `/modules/scanning/...`

- Injects a narrow "colour" column into the tree grid **`pqgrid6`**, immediately before the Item (TITLE) column.
- Each row's swatch = the colour descriptor of its top-level heading ancestor (walks `parentId` in the pqgrid data).
- Column width **flexes** to fit the widest room: `12 + 16·N + 2·(N-1)` px where N is the max tile count in the current data.
- Renders **one solid tile per hex** side by side (never a blended stripe unless a single field carries the pair).
- Auto-selects the **Tree view** tab once on page load (guarded by `window.__hh_scanTreeSelected`).
- The scanning module's Refresh button re-fetches the colour map and force-refreshes the grid.

### Supplying tab — `/job.php` (`#items_tree1`)

- Appends the swatch tiles **inline** right after each row's name text, inside `.name_cell > div`. **No new column, no header cell, no width fiddling** — HireHop's tree/table layout is completely untouched.
- Tiles cascade: every row (root heading, sub-heading, item) under a coloured room shows that room's tiles.
- Repaints on jstree events (`after_open`, `after_close`, `redraw`, `refresh`, `load_node`, `create_node`, `move_node`) plus a 1s safety-net interval.

### Edit-heading dialog (Supplying) — colour-field UX

- **Non-root headings:** every colour custom field (identified as any `.custom_field_container` whose `<select>` has a hex-valued option) is hidden entirely. Colour is only settable on the top-level room.
- **Root headings:** progressive-disclosure interlock across colour fields (sorted alphabetically by label so `A-Colour` < `B-Colour` < …):
  - Field N is hidden until field N−1 is set to a real hex.
  - Field N locks (disabled + opacity 0.5 + tooltip) as soon as any later field has a hex value — user must clear later fields back to "none" before changing earlier ones.
  - Live `change` handlers keep this in sync as the user picks.

---

## Design history — why the final shape

Every intermediate approach ran into a wall. Documenting so future me knows why.

| Version | Supplying approach | Killed by |
|---|---|---|
| v0.1.x | Absolute-positioned swatch inside the anchor | Not a column, overlapped tree icons |
| v0.2.x | Left-gutter via container `padding-left` + absolute swatch | Padding shifted the tree right of the header — cell borders drifted |
| v0.3.x | Real `column_HH_COLOUR` table column integrated with HireHop's cog menu | HireHop's `move_column` rebuilt row cells, wiped our column, and the drag/hide logic never stopped fighting us |
| v0.4.x | Folder-icon tint via mask + `background` on `.jstree-themeicon` | HireHop's rebuild wiped inline styles; item icons not tinted; user preferred a real swatch |
| v0.5.x | Solid-block folder icons (Font-Awesome glyph hidden, element painted as block) | Not a swatch column — user preferred a proper swatch next to text |
| v0.6.2/6.3 | Left-gutter swatches (side by side, flex width) | Alignment vs the header table drifted whenever tiles didn't fit |
| v0.6.4 | Real `<th>` header cell | Table auto-layout stole width from Quantity & Item, shifted every downstream column 46px in the header vs the rows |
| v0.6.5 | Overlay 🎨 heading inside Qty&Item via text-indent | Alignment fine, but the row swatches sat in the empty jstree indent zone and overlapped the expand/theme icons |
| v0.6.6 | `<th>` in header + matching `<td>` in every row's `cust_node` | Alignment correct, but any table structural change (add column, resize) required exact matching row-cell handling every tick and was fragile |
| **v0.7.0** | **Inline swatch inside `.name_cell > div`** | ✅ Tree/table untouched. Cascades naturally. |
| v0.7.1 → v1.0.0 | + progressive A/B interlock in the Edit dialog | Ship. |

Two things kept biting us and shaped the final answer:

1. **HireHop rebuilds row DOM.** Anything we put inside its structural tables (headers, `cust_node` rows) gets stomped by `move_column`, tab switches, or the Job refresh button. Anything at `.name_cell > div` level survives because the row-item text content is the LAST thing HireHop touches — its rebuild logic writes the value into that div rather than replacing the div.

2. **Table auto-layout is a redistributive zero-sum game.** Adding a `<th>` doesn't grow the header; it steals width from other cells. Matching row cells rebalance both tables the same way, but keeping every row's leftmost cell in sync with a periodic loop is a lot of moving parts for a visual cue.

## Colour rendering

`backgroundForHex(hex)` — single hex → solid; `hex/hex` → `repeating-linear-gradient(135deg, a 0 5px, b 5px 10px)` (5px fixed stripes so the pattern is legible on 12–16px tiles).

`sideBySideSwatchHtml(fields, sizePx)` — one `<span>` per field, 14px on the scanning column, 12px on the Supplying inline. Each tile carries `backgroundForHex` of its own hex.

## Reverting

- Loader ref: `TOOLS["scanning-colour-swatch"].ref = "scanning-colour-swatch-v1.0.0"` in `loader.js`.
- Full history: `git log tools/scanning-colour-swatch.js`
- Tags: `git tag -l 'scanning-colour-swatch-*'` (every step from v0.1.0 → v1.0.0 is tagged and immutable on jsDelivr).
- To pin to a specific earlier tag (e.g. rollback to the folder-tint era): change the `ref` string. Every tag URL is `https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@<tag>/tools/scanning-colour-swatch.js`.

## Load convention

- Bookmarklet / Tampermonkey / `@require` at `https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@scanning-colour-swatch-v1.0.0/tools/scanning-colour-swatch.js`
- Or auto-loaded on job.php via `loader.js` (`TOOLS.scanning-colour-swatch.on = true`).
- The tool's IIFE checks `location.pathname` and only activates on `/modules/scanning/...` or `/job.php`.
