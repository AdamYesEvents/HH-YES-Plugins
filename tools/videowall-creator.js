/*!
 * HireHop Tool: Videowall Creator
 * Loaded by loader.js (window.HHTools.register).
 *
 * Baseline-questions wizard that produces a videowall kit and (later) inserts
 * it into the job under a "Videowall WxH ..." heading. The framework mirrors
 * stage-designer.js (self-contained overlay dialog, pure logic + browser UI).
 *
 * Q0  Pitch          2.6mm Uniview UR Pro (indoor only) / 3.9mm Chauvet REM
 * Q1  Environment    Indoor / Outdoor (Outdoor disabled for 2.6mm)
 * Q2  Support        Flown / Ground supported
 * Q2.5 Rigging       Clamp / Sling  -  ONLY for Chauvet 3.9mm + Flown.
 *                    Uniview 2.6mm + Flown is sling-only, so Q2.5 is skipped.
 * Q3  Width, Height  metres, 0.5m increments (panels are 500 x 1000)
 * Q4  Processor      Behind screen / Within 70m  (signal cables STILL TBD)
 *
 * Hardware part numbers wired in (v0.5.0): panels + flown rigging + ground
 * support kit line. Still TBD:
 *   - LSU connecting bar YW-codes (product code LSU-CONNB-L150 used as label
 *     placeholder; Adam to supply YW codes)
 *   - Processor + signal cables - hardware-first release; Chauvet has no
 *     starter cable, Uniview has YW-04070 Ethercon, but neither wired yet
 *
 * Job insertion wired in (v0.6.0): mirrors stage-designer's addStageKit flow.
 * Creates a top-level Grouped heading, then sub-headings Screen / Spares /
 * Rigging. Processor + Cable sub-headings intentionally skipped this release
 * (parts still TBD); the top-level title still says "inc Processor" as a
 * reminder for the pick crew.
 *
 * Spares logic (v0.7.0): panels are cased (1000x500 = 4/case, 500x500 = 8/case).
 * We round the used qty up to the next case and put the leftover in the Spares
 * sub-heading; if the wall lands exactly on a full case (no natural spare) we
 * add a whole extra case as spares. Each spare line then gets HireHop's "100%
 * applied" state (unit_price preserved, price forced to 0) via a follow-up POST
 * to items_save.php after the batch save settles.
 *
 * v0.8.0:
 *   - Q5 Processor added: Novastar MX30 (YW-04071) or MX40 Pro (YW-00347).
 *     Insertion now creates a Processor sub-heading; title drops the "inc
 *     Processor" reminder since the processor is now really in the kit.
 *   - LSU Set (YW-00169) qty on 3.9mm ground now scales to the uprights
 *     needed (ceil((totalBars + 1) / 2)) instead of always being 1.
 *   - Ground 3.9mm decomposition for 4.5m fixed to 1.5m + 1m + 2m per Adam
 *     (was 3 x 1.5m). Wider widths (5m+) still use the "max 1.5s + one 2 or
 *     1 filler" pattern - re-decompose if Adam supplies a preferred table.
 *
 * v0.9.0 - PORT MAPPING:
 *   - Q6 Refresh rate (25/50/60hz) and Q7 Bit depth (8/10/12bit) added. Bit
 *     depth is clamped by processor: the MX30 is 8/10bit only, so 12bit is
 *     disabled when an MX30 is selected (same pattern as 2.6mm -> Indoor).
 *   - BANDWIDTH lookup: percentage of ONE PORT's capacity consumed by ONE
 *     panel, per (processor, panel family, panel size, refresh, bit depth).
 *     Supplied by Adam 2026-08-25 and confirmed per-port, not per-processor.
 *   - mapPorts() splits the wall into data lines.
 *   - Preview now colour-codes each port's panels, draws the feed path with a
 *     start marker, and reports panels + % used per port.
 *   Worked example (Adam's): 4m x 3m Uniview @ 60hz/8bit = 24 panels x 12%
 *   = 288% -> 3 lines of 8 panels / 96% each, one per row.
 *
 * v0.9.1 - WIRING RULES (Adam). These override pure bandwidth efficiency and
 * replace v0.9.0's serpentine packing:
 *   - A line NEVER mixes panel sizes. 1000x500 and 500x500 cannot share a port,
 *     so the 500h top row always gets its own line(s).
 *   - Wiring always runs LEFT TO RIGHT. No serpentine / no reversing on
 *     alternate rows - every line starts at its leftmost panel.
 *   - Lines are ROW-ALIGNED: a line never spans two rows, so 3 rows gives at
 *     least 3 lines. Deliberately NOT the minimum port count - you build and fly
 *     a wall row by row, and one line per row lets you test each row as it goes
 *     up. minPortsByBandwidth reports what bandwidth alone would allow, for
 *     reference only; the row rule wins.
 *   A row too wide for one port is split into contiguous left-to-right chunks,
 *   sized as evenly as possible.
 *
 * v0.10.0 - PROCESSORS + REDUNDANCY:
 *   - Real port counts (Adam): MX30 has 10 ports, MX40 Pro has 20.
 *   - Q8 Backup added. Running backup pairs each primary with a backup port, so
 *     only HALF the ports are usable as primaries - an MX30 drops to 5 lines,
 *     an MX40 Pro to 10. Two schemes, both in use:
 *       "pairs"  - adjacent:     1&2, 3&4, 5&6 ...
 *       "offset" - half-offset:  MX40 1&11, 2&12 ...  MX30 1&6, 2&7 ...
 *   - Processor QUANTITY is now computed and written into the kit, instead of
 *     always being 1. A wall that needs more lines than one box has ports for
 *     now adds the extra processors.
 *   - Upgrade hint: because backup halves an MX30 to 5 primaries, walls spill
 *     onto a second box quickly. When an MX40 Pro would do it in fewer boxes,
 *     the panel says so - upgrading is often cheaper than doubling up.
 *   - Panels are now stamped with the PHYSICAL port being plugged (e.g. "3", or
 *     "2:3" for processor 2 port 3), not the line index - with backup running,
 *     line 2 lands on port 3 under the pairs scheme.
 *
 * v0.11.0 - BALLAST + TOPPER:
 *   - Weight plates YW-00259 (12.5kg each) now auto-added on every
 *     ground-supported wall, BOTH systems, off the "Ballast loading" table from
 *     the technical guidelines for Exhibitions in Germany (Adam, 2026-08-27).
 *     kg is PER UPRIGHT; plates round up per upright, then multiply by the
 *     upright count. Safety factor 1.5 is already baked into the table - do not
 *     apply another. (Supersedes the old YW-02892 placeholder note.)
 *   - Minimum ground-support wall heights enforced: REM 2m, Uniview 1.5m.
 *     Uniview's 1.5m sits below the table's first row so it clamps up to the
 *     2.0m figure. Ground walls over 6m are rejected - off the end of the table.
 *   - LSU 30cm topper YW-04062 added on every REM ground wall, one per upright.
 *     REM-only; the Uniview system does not take it.
 *
 * v0.12.0 - EXTERNAL PART CATALOGUE + DIALOG POLISH:
 *   - Part numbers, the ballast table and the bandwidth tables now load from
 *     data/videowall-creator/{parts,ballast,bandwidth}.json on jsDelivr at
 *     dialog-open time, the same way stage-designer loads its catalogue. A part
 *     number change is now a PURE DATA EDIT - no code release, no tag, no loader
 *     re-pin. The inline PARTS / BALLAST / BANDWIDTH values are the fallback and
 *     must stay in sync with the JSON; if a fetch fails the tool runs on them.
 *   - Version number shown in the dialog header (TOOL_VERSION), matching
 *     stage-designer.
 *   - Loading bar: the footer shows a spinner + progress bar while the catalogue
 *     downloads, and again during insertion. addVideowallKit now takes an
 *     onProgress callback with the same {phase, category, doneItems, totalItems}
 *     contract as stage-designer's addStageKit.
 *
 * v0.13.0 - GROUND DECOMP CLEANUP + PROCESSOR-LINK CABLES + HARDWARE OVERLAYS:
 *   - REM ground: cap raised to 6m HARD MAX (Adam, 2026-08-28). 1m connecting
 *     bars retired - decomposition uses ONLY 1.5m and 2m bars. Changed rows:
 *     4.0m 2x2 (was 2x1.5+1m), 4.5m 3x1.5 (was 1.5+1+2), 5.5m 1.5+2x2 (was
 *     3x1.5+1m), 6.0m 3x2 (was 4x1.5). LSU-CONNB-L100 no longer generated.
 *   - Inter-processor cables: one set per additional processor
 *     (processorCount - 1 sets) - 3m network + 3m HDMI + 2m SDI. Codes are
 *     placeholders (TBD-*) until Adam supplies real YWs; today they drop to
 *     free-text rows on the job.
 *   - Preview overlays: flown walls get a top rigging-bar bar; ground walls
 *     (both systems) get a base bar with a dot per erected upright.
 *
 * v0.14.0 - STARTER CABLES:
 *   - One cable per line, doubled if backup is running. Length rule (Adam):
 *     wall width + row top height above the floor. Backup lands on the far end
 *     of the chain, which is what forces the full wall width in; the input is
 *     spec'd the same way.
 *   - REM uses BANDED Ethercon stock (5m YW-00448, 10m YW-00434, 20m YW-00438).
 *     Pick the smallest that fits. A required length above 20m is emitted as a
 *     free-text row - Adam has not stocked anything longer.
 *   - Uniview uses a FIXED 15m starter per line (YW-04070), width-insensitive.
 *     Different mode from REM - matches Adam's original spec.
 *   - Cable sub-heading now inserts on the job (was skipped since v0.6.0).
 *   - Preview shows per-line required length, best-fit stock length, and totals
 *     grouped by part number.
 *
 * v0.15.0 - LSU DECOMP FIX + COLOURED BAR SEGMENTS:
 *   - 6m REM ground is 2 x 1.5m + 3 x 1m (Adam 2026-08-28) - fixes v0.13.0's
 *     3 x 2m. Restores 1m bars across the full table (4m: 2 x 1.5 + 1, 4.5m:
 *     1.5 + 1 + 2, 5.5m: 3 x 1.5 + 1).
 *   - 1m LSU bars are BUNDLED in the LSU Set (YW-00169), not a separate SKU.
 *     They count for uprights / toppers / ballast but do NOT appear as a kit
 *     line item. The LSU Set label carries an "(incl. N x 1m bar)" note so
 *     the pick crew knows.
 *   - Preview overlays now draw bars as coloured SEGMENTS per physical length:
 *     0.5m teal, 1.0m blue, 1.5m amber, 2.0m purple. Same palette on flown
 *     rigging (top) and both ground bases (bottom). A legend under the wall
 *     shows which colour is which length.
 *
 * v0.16.0 - GROUND CAPS + 5m DECOMP + BAR PLACEMENT + UNIVIEW OVERFLOW FIX:
 *   - REM ground cap raised 6m -> 20m (Adam, 2026-08-28). Widths 6.5m-20m use
 *     a symmetric algorithm: 2 x 1.5m on the outside + fill middle with 1m
 *     bars (+1 x 1.5m in middle if the width has a 0.5m remainder). The algo
 *     never uses 2m bars, matching Adam's preference for 1m (bundled) over 2m
 *     (separate SKU).
 *   - Uniview ground CAPPED at 4m width (Adam) - was uncapped.
 *   - 5m REM ground: 2 x 1.5m + 2 x 1m (was 2 x 1.5 + 1 x 2). Adam's reason:
 *     the 2m bar is an extra SKU to carry, but 1m bars ship inside the LSU
 *     Set the crew is already loading. Costs one extra LSU Set (3 vs 2), but
 *     saves a separate line on the pick list.
 *   - REM bottom-bar preview: 1.5m bars anchor the OUTSIDE, middle fills with
 *     1m bars first, then any middle 1.5m, then any 2m bars (Adam preference).
 *     6m REM now renders as 1.5-1-1-1-1.5 instead of 1.5-1-1-1.5-1 etc.
 *     buildWallSvg drawBar now accepts { flatBars: [1.5, 1, 1, 1.5] } for
 *     explicit ordering; older { bars: [{lengthM,count}] } still works.
 *   - Uniview ground preview no longer overflows the wall. Was rendering the
 *     kit's TOTAL contents (2 x 1m + 1 x 0.5m per kit = 5m for a 4m wall);
 *     now uses bars_1 / bars_05 (actual bars placed on the wall).
 *
 * v0.17.0 - UNIVIEW CAP FIX + CABLE SPARES + JOINER + REM UPRIGHT RULE:
 *   - Uniview ground: WIDTH cap removed (was 4m, from misread of Adam's spec),
 *     HEIGHT capped at 4m instead (structural). REM ground still caps at 6m
 *     tall (via the ballast table).
 *   - Starter cables (both systems) now include ONE SPARE per unique stock
 *     length used per wall. Listed as separate "... (spare)" rows in the
 *     Cable sub-heading. Adam: "start cables need to include spares for each
 *     length in the count."
 *   - REM cable over max stock (>20m required): auto-emits max stock cable +
 *     Ethercon Joiner YW-00453 + smallest stock covering the remainder. If
 *     even that can't cover (>40m), drops to free-text. Uniview lines >15m
 *     drop to free-text (no auto-extend - proprietary connector).
 *   - REM ground upright positioning (Adam 2026-08-28): outer uprights inset
 *     0.5m from each wall end + interior every 1m. For half-metre widths
 *     (3.5, 4.5, 5.5, 6.5, ...) the last two uprights are 0.5m apart on the
 *     half-metre side. Formula: uprights = ceil(W). This is +1 vs the old
 *     bars+1 rule on half-metre widths - which ripples into +1 topper and
 *     more ballast plates on those widths. LSU Sets = ceil(uprights / 2), so
 *     4.5m and 6.5m are now +1 LSU Set too. Preview dots sit at Adam's
 *     positions instead of at bar seams.
 *
 * v0.17.1 - REM UPRIGHT POSITION TWEAK (half-metre widths):
 *   Second-to-last upright shifts 0.5m LEFT on half-metre widths (Adam,
 *   2026-08-28: "5.5 the second dot from the right is 0.5m too far right,
 *   same for all 6.5 + 7.5 and so on"). The tight 0.5m gap now sits between
 *   the third-to-last and second-to-last uprights, not adjacent to the right
 *   end. Applies uniformly to 3.5m, 4.5m, 5.5m, 6.5m, ..., 19.5m.
 *   Positions before -> after (5.5m):
 *     [0.5, 1.5, 2.5, 3.5, 4.5, 5.0]  ->  [0.5, 1.5, 2.5, 3.5, 4.0, 5.0]
 *   Upright COUNT unchanged (still ceil(W)); only positions shift.
 *
 * v0.18.0 - UNIVIEW UPRIGHT RULE:
 *   Uniview panels are 500mm wide; dots go in the MIDDLE OF A PANEL, not at
 *   bar seams (Adam, 2026-08-28). Specific rules per width:
 *     0.5m -> 1 upright at 0.25m
 *     1.0m -> 2 uprights at 0.25, 0.75 ("for the 1m header bar")
 *     1.5m -> 2 uprights at 0.25, 1.25 (1m gap, skip middle panel)
 *     2.0m -> 2 uprights at 0.75, 1.25 (central 2 columns)
 *     2.5m+ -> N = ceil(W) uprights at 0.25, 1.25, 2.25, ... (1m apart)
 *   Rule of thumb: "middle of the panels about 1m apart. for every 2m there
 *   should be 2 uprights."
 *
 *   Applies to both:
 *   - Uniview FLOWN top rigging bar (preview dots only, no ballast)
 *   - Uniview GROUND foot bar (preview dots + upright count + kit count +
 *     ballast plates)
 *
 *   Ground kit count is now driven by uprights (kits = ceil(uprights / 2)),
 *   replacing the old coverage-based formula (max(1, ceil((W-0.5)/2))). For
 *   odd Uniview widths (2.5, 4.5) this may over-supply by 1 upright, but
 *   ensures the crew has enough hardware.
 *
 *   Sample deltas from v0.17.1:
 *     2.5m Uniview ground: kits 1 -> 2 (uprights 2 -> 3, plates +6 at 3m tall)
 *     3.0m Uniview ground: kits 2 (same), uprights 4 -> 3, plates -6 at 3m tall
 *     4.5m Uniview ground: kits 2 -> 3, uprights 4 -> 5, plates +6 at 3m tall
 *
 * v0.19.0 - UNIVIEW UPRIGHT REFINEMENT + 0.5m BAR IN MIDDLE + AXIS LABELS:
 *   Adam 2026-08-28 refined the Uniview upright specs from v0.18.0. Explicit
 *   table now (positions in metres, cols = which panel columns from the left):
 *     0.5m -> [0.25]                     col 1
 *     1.0m -> [0.25, 0.75]               cols 1, 2
 *     1.5m -> [0.25, 1.25]               cols 1, 3
 *     2.0m -> [0.75, 1.25]               cols 2, 3
 *     2.5m -> [0.25, 1.25, 2.25]         cols 1, 3, 5
 *     3.0m -> [0.25, 1.25, 1.75, 2.75]   cols 1, 3, 4, 6  (add col 4, use both kits)
 *     3.5m -> [0.25, 1.25, 2.25, 3.25]   cols 1, 3, 5, 7  (unchanged)
 *     4.0m -> [0.75, 1.75, 2.25, 3.25]   cols 2, 4, 5, 7  (second col in + central pair)
 *     4.5m -> [0.75, 1.75, 2.75, 3.75]   cols 2, 4, 6, 8  (0.5m bar to middle, no extra kit)
 *   W >= 5m: extrapolated as alternate cols starting col 2 (0.75, 1.75, ...),
 *   floor(W) uprights - PENDING ADAM CONFIRMATION.
 *
 *   Kit count is still ceil(uprights / 2), so 3m stays at 2 kits (was 2 in
 *   v0.18.0), 4.5m drops to 2 kits (was 3). Ballast:
 *     3.0m at 3m tall: 4 x 6 = 24 plates (was 18 in v0.18.0 with 3 uprights)
 *     4.5m at 3m tall: 4 x 6 = 24 plates (was 30 in v0.18.0 with 5 uprights)
 *
 *   0.5m Uniview ground bar now placed in the MIDDLE of the wall for
 *   half-metre widths (Adam: "move the 0.5m bar to the middle of screen").
 *   Adds visual centre, avoids the tight-end-cluster in the old layout.
 *
 *   Preview now labels the COLUMNS (1..cols) along the top and ROWS
 *   (A..) down the left side, with A = BOTTOM row (physical build order).
 *
 * STILL TBD after v0.19.0:
 *
 * PDF generation is TEMPORARILY BLOCKED - see PDF_ENABLED below. When ready,
 * flip the flag on and reformat buildVideowallPdf() to match the final layout
 * (do not delete the scaffolding).
 *
 * Version: 0.19.0
 */

(function () {

  // ===========================================================================
  // PURE LOGIC
  // ===========================================================================

  var EPS = 1e-6;
  function isMult(v, step) { var q = v / step; return Math.abs(q - Math.round(q)) < EPS; }

  var TOOL_VERSION = "0.19.0";  // shown in the dialog header; keep in sync with the banner above.

  // ---------------------------------------------------------------------------
  // PART CATALOGUE (v0.12.0)
  // ---------------------------------------------------------------------------
  // These are the INLINE DEFAULTS / fallback. At dialog-open time loadCatalogue()
  // fetches data/videowall-creator/*.json from jsDelivr and overwrites them, so a
  // part number change is a pure data edit - no code release, tag or loader
  // re-pin. Same pattern as stage-designer's data/stage-designer/ catalogue.
  // If the fetch fails the tool still works, on these values.
  var PARTS = {
    panels: {
      uniview: {
        full: { pn: "YW-04066", label: "Uniview UR Pro 2.6mm panel 1000x500", caseSize: 4 },
        half: { pn: "YW-04067", label: "Uniview UR Pro 2.6mm panel 500x500",  caseSize: 8 }
      },
      rem: {
        full: { pn: "YW-00341", label: "Chauvet REM 3.9mm panel 1000x500", caseSize: 4 },
        half: { pn: "YW-00342", label: "Chauvet REM 3.9mm panel 500x500",  caseSize: 8 }
      }
    },
    flown: {
      uniview: {
        sling: {
          bar1:  { pn: "YW-04068", label: "Uniview UR Pro Rigging Bar 1m on Sling" },
          bar05: { pn: "YW-04069", label: "Uniview UR Pro Rigging Bar 0.5m on Sling" }
        }
      },
      rem: {
        clamp: {
          bar1:  { pn: "YW-00343", label: "Chauvet REM 1m Header Bar on Clamp" },
          bar05: { pn: "YW-00345", label: "Chauvet REM 0.5m Curve Header Bar on Clamp" }
        },
        sling: {
          bar1:  { pn: "YW-00344", label: "Chauvet REM 1m Header Bar on Sling" },
          bar05: { pn: "YW-00346", label: "Chauvet REM 0.5m Curve Header Bar on Sling" }
        }
      }
    },
    ground: {
      uniview: { kit: { pn: "YW-04065", label: "Uniview UR Pro Ground Support Kit (2 uprights)" } },
      rem: {
        set:    { pn: "YW-00169", label: "LSU Set (2 uprights) Kit" },
        bar15:  { pn: "YW-04072", label: "LSU Connecting Bar 1.5m" },
        bar2:   { pn: "YW-04073", label: "LSU Connecting Bar 2m" },
        topper: { pn: "YW-04062", label: "LSU 30cm Topper" }
      }
    },
    ballastPlate: { pn: "YW-00259", label: "Weight Plate 12.5kg", plateKg: 12.5 },
    processors: {
      mx30:    { pn: "YW-04071", label: "Novastar MX30 Videowall Processor",     name: "Novastar MX30",     ports: 10 },
      mx40pro: { pn: "YW-00347", label: "Novastar MX40 Pro Videowall Processor", name: "Novastar MX40 Pro", ports: 20 }
    },
    // Inter-processor cabling: one set per ADDITIONAL processor (processorCount - 1).
    procCables: {
      network: { pn: "YW-00442", label: "3m Network Cable (processor link)" },
      hdmi:    { pn: "YW-00484", label: "3m HDMI Cable (processor link)" },
      sdi:     { pn: "YW-00497", label: "2m SDI Cable (processor link)" }
    },
    // Starter cables per line. Doubled when backup is running (Adam, 2026-08-27:
    // primary + backup, same length rule: wall width + row height). REM picks
    // the smallest banded Ethercon stock that fits; Uniview uses a fixed 15m
    // starter regardless of wall size. Over-max REM lengths drop to a
    // free-text row (no stock code) until a longer length is stocked.
    cables: {
      rem: {
        mode: "banded",
        stock: [
          { lengthM: 5,  pn: "YW-00448", label: "5m Ethercon Cable" },
          { lengthM: 10, pn: "YW-00434", label: "10m Ethercon Cable" },
          { lengthM: 20, pn: "YW-00438", label: "20m Ethercon Cable" }
        ],
        // Used when a line needs MORE than the longest stock cable (Adam,
        // 2026-08-28). Sequence per over-length line:
        //   1 x longest stock + 1 x joiner + 1 x smallest stock covering the remainder.
        joiner: { pn: "YW-00453", label: "Ethercon Joiner" }
      },
      uniview: {
        mode: "fixed",
        fixed: { lengthM: 15, pn: "YW-04070", label: "15m Uniview Starter Cable" }
      }
    }
  };
  // Product family key for the catalogue: 2.6mm is Uniview, 3.9mm is Chauvet REM.
  function famKey(isUniview) { return isUniview ? "uniview" : "rem"; }

  // Flown rigging bars: prefer 1m, allow one 0.5m add-on. Width must be a
  // multiple of 0.5m.
  //   4.0m -> 4x 1m
  //   4.5m -> 4x 1m + 1x 0.5m
  //   5.0m -> 5x 1m
  function flownRig(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return null;
    var whole = Math.floor(W + EPS);
    var half  = Math.abs(W - whole - 0.5) < EPS ? 1 : 0;
    return { bars_1: whole, bars_05: half };
  }

  // ---------------------------------------------------------------------------
  // UNIVIEW UPRIGHT / REAR-SUPPORT RULE (v0.18.0)
  // ---------------------------------------------------------------------------
  // Adam, 2026-08-28: "the dot needs to be in the middle of the panel. so
  //   a 0.5m wide screen would have 1 upright, a 1w = 2 for a 1m header bar,
  //   1.5m 2 uprights with a 1m gap between uprights. 2w is 2 uprights with
  //   the central 2 columns, 2.5w outside and middle.
  //   rule of thumb: uprights go in the middle of the panels about 1m apart.
  //   for every 2m there should be 2 uprights"
  //
  // Applies to Uniview FLOWN (top rigging bar dots) AND Uniview GROUND (foot
  // bar dots + ballast upright count + LSU kit count).
  //
  // Uniview panels are 500mm wide, so panel centres are at 0.25, 0.75, 1.25,
  // 1.75, ... (every 0.5m offset by 0.25m).
  //
  // Count formula:
  //   W <= 0.5m  -> 1
  //   W == 1.0m  -> 2  (special: 1m header bar needs 2 supports)
  //   W == 1.5m  -> 2
  //   W == 2.0m  -> 2  (central 2 columns)
  //   W >= 2.5m  -> ceil(W)
  //
  // Positions:
  //   0.5m -> [0.25]
  //   1.0m -> [0.25, 0.75]
  //   1.5m -> [0.25, 1.25]                        (skip middle)
  //   2.0m -> [0.75, 1.25]                        (central pair)
  //   W>=2.5 -> [0.25, 1.25, 2.25, ..., 0.25 + (N-1)]  (1m apart from left)
  // Explicit table 0.5m-4.5m (Adam, 2026-08-28 - refined from v0.18.0):
  //   0.5m -> [0.25]                              1 upright, col 1
  //   1.0m -> [0.25, 0.75]                        cols 1, 2 (1m header bar)
  //   1.5m -> [0.25, 1.25]                        cols 1, 3 (skip middle)
  //   2.0m -> [0.75, 1.25]                        cols 2, 3 (central pair)
  //   2.5m -> [0.25, 1.25, 2.25]                  cols 1, 3, 5
  //   3.0m -> [0.25, 1.25, 1.75, 2.75]            cols 1, 3, 4, 6 (add col 4 symmetric, uses both kits)
  //   3.5m -> [0.25, 1.25, 2.25, 3.25]            cols 1, 3, 5, 7
  //   4.0m -> [0.75, 1.75, 2.25, 3.25]            cols 2, 4, 5, 7 (second col in + central pair)
  //   4.5m -> [0.75, 1.75, 2.75, 3.75]            cols 2, 4, 6, 8 (0.5m bar goes to middle - no extra kit)
  //
  // W >= 5m (extrapolation - NEEDS ADAM CONFIRMATION):
  //   alternate columns starting col 2 (extending the 4.5m pattern).
  //   uprights count = floor(W)
  var UNIVIEW_UPRIGHT_TABLE = {
    "0.5": [0.25],
    "1.0": [0.25, 0.75],
    "1.5": [0.25, 1.25],
    "2.0": [0.75, 1.25],
    "2.5": [0.25, 1.25, 2.25],
    "3.0": [0.25, 1.25, 1.75, 2.75],
    "3.5": [0.25, 1.25, 2.25, 3.25],
    "4.0": [0.75, 1.75, 2.25, 3.25],
    "4.5": [0.75, 1.75, 2.75, 3.75]
  };

  function univiewUprightPositions(W) {
    if (!(W > 0)) return [];
    var row = UNIVIEW_UPRIGHT_TABLE[W.toFixed(1)];
    if (row) return row.slice();
    // W >= 5m: alternate cols starting col 2 (0.75, 1.75, 2.75, ...).
    // Col 2k center is at (k - 0.25) metres from the left wall edge.
    var positions = [];
    for (var k = 1; k <= Math.floor(W + EPS); k++) positions.push(k - 0.25);
    return positions;
  }

  function univiewUprightCount(W) {
    return univiewUprightPositions(W).length;
  }

  // Bar layout for Uniview GROUND: puts the 0.5m rigging bar in the MIDDLE of
  // the wall for half-metre widths (4.5m, 6.5m, ...), not at the right end
  // (Adam, 2026-08-28: "move the 0.5m bar to the middle of screen").
  // For half-metre widths with an EVEN number of 1m bars (4.5m, 6.5m, ...),
  // the 0.5m sits exactly at the wall centre. For ODD 1m bar counts (5.5m,
  // 7.5m, ...) it sits one bar left of centre (arbitrary tie-break).
  function univiewGroundBarLayout(bars_1, bars_05) {
    var flat = [];
    if (!bars_05) {
      for (var i = 0; i < bars_1; i++) flat.push(1.0);
      return flat;
    }
    var insertAt = Math.floor(bars_1 / 2);
    for (var i = 0; i < insertAt; i++) flat.push(1.0);
    flat.push(0.5);
    for (var j = insertAt; j < bars_1; j++) flat.push(1.0);
    return flat;
  }

  // 2.6mm indoor ground support - each kit (YW-04065) ships 2 uprights +
  // 2x 1m bars + 1x 0.5m bar. Kit count is now driven by Adam's Uniview
  // upright rule (v0.18.0): kits = ceil(uprights / 2). The old coverage
  // formula (max(1, ceil((W-0.5)/2))) is superseded - Adam's rule gives kit
  // counts that also cover the wall width for every valid W.
  //
  // NO WIDTH CAP (Adam, 2026-08-28) - Uniview ground supports arbitrary width.
  // The cap is on HEIGHT instead - see GROUND_MAX_H below.
  function ground26Kit(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    var whole = Math.floor(W + EPS);
    var half  = Math.abs(W - whole - 0.5) < EPS ? 1 : 0;
    var uprights = univiewUprightCount(W);
    var kits = Math.ceil(uprights / 2);
    return {
      ok: true,
      kits: kits,
      uprights: uprights,
      uprightPositions: univiewUprightPositions(W),
      bars_1: whole,
      bars_05: half,
      kitContents: { bars_1: 2 * kits, bars_05: 1 * kits }
    };
  }

  // 3.9mm ground support - primary bays of 1.5m or 2m, plus 1m filler bars
  // where needed. 1m bars are BUNDLED in the LSU Set (YW-00169) and are NOT a
  // separate line item on the kit (Adam, 2026-08-28) - but they count towards
  // upright / kit / preview.
  //
  // Capped at 20m (Adam, 2026-08-28 - was 6m).
  //
  // Hardcoded widths 1.5m to 6m (spec'd explicitly by Adam):
  //   1.5 -> 1 x 1.5
  //   2.0 -> 1 x 2
  //   2.5 -> NOT achievable
  //   3.0 -> 2 x 1.5
  //   3.5 -> 1 x 1.5 + 1 x 2
  //   4.0 -> 2 x 1.5 + 1 x 1
  //   4.5 -> 1 x 1.5 + 1 x 1 + 1 x 2       (special case per Adam)
  //   5.0 -> 2 x 1.5 + 2 x 1                (Adam 2026-08-28 - was 2x1.5 + 1x2)
  //   5.5 -> 3 x 1.5 + 1 x 1
  //   6.0 -> 2 x 1.5 + 3 x 1                (Adam 2026-08-28 - was 4 x 1.5)
  //
  // Algorithmic widths 6.5m to 20m: 2 x 1.5m outside + fill middle with 1m
  // (prefer) + a single 1.5m in the middle if the width has a 0.5m remainder.
  // Rule: NO 2m bars used in the algo - Adam prefers 1m bars because they ship
  // inside the LSU Set (no extra SKU to carry).
  //
  // Upright count and positions for REM ground (Adam, 2026-08-28):
  //   Outer uprights are inset 0.5m from each wall end. Interior uprights are
  //   at 1m intervals. For half-metre widths (3.5, 4.5, ...), the last two
  //   uprights end up 0.5m apart (not 1m) on the half-metre side.
  //   Formula:  uprights = ceil(W).
  //   Positions: 0.5, 1.5, ..., floor(W)-0.5, then W-0.5 for half-metre widths.
  //
  // Each LSU Set (YW-00169) ships 2 uprights, so LSU Set qty = ceil(uprights / 2).
  var GROUND_39_MAX_W = 20.0;

  function remUprightPositions(W) {
    var positions = [];
    var isHalf = Math.abs((W * 2) - Math.round(W * 2)) < EPS &&
                 Math.round(W * 2) % 2 === 1;
    if (isHalf) {
      // Half-metre widths: fill from the LEFT with 1m gaps up to W - 1.5, then
      // second-to-last upright at W - 1.5 (creating the tight 0.5m gap here),
      // then the LAST upright at W - 0.5. So the pattern is:
      //   0.5, 1.5, ..., (W - 2.5), (W - 1.5), (W - 0.5)
      // The tight 0.5m gap sits between the third-to-last and second-to-last
      // uprights, NOT between the last two.
      // Adam 2026-08-28 (v0.17.1): "5.5 the second dot from the right is 0.5m
      // too far right. same for all 6.5 + 7.5 and so on."
      for (var x = 0.5; x < W - 1.5 - EPS; x += 1) positions.push(x);
      positions.push(W - 1.5);
      positions.push(W - 0.5);
    } else {
      // Whole widths: uniform 1m spacing from 0.5 to W - 0.5.
      var wholeCount = Math.floor(W + EPS);
      for (var i = 0; i < wholeCount; i++) positions.push(0.5 + i);
    }
    return positions;
  }

  function ground39Kit(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    if (W < 1.5 - EPS) return { ok: false, error: "3.9mm ground support minimum is 1.5m" };
    if (W > GROUND_39_MAX_W + EPS)
      return { ok: false, error: "3.9mm ground support maxes out at " + GROUND_39_MAX_W + "m" };
    if (Math.abs(W - 2.5) < EPS) return { ok: false, error: "2.5m not achievable in 3.9mm (bar sizes are 1m, 1.5m and 2m)" };
    function pack(bars_15, bars_2, bars_1) {
      var uprights = Math.ceil(W - EPS);
      return {
        ok: true,
        kits: Math.ceil(uprights / 2),
        uprights: uprights,
        uprightPositions: remUprightPositions(W),
        bars_15: bars_15, bars_2: bars_2, bars_1: bars_1
      };
    }
    var TABLE = {
      "1.5": [1, 0, 0], "2.0": [0, 1, 0], "3.0": [2, 0, 0], "3.5": [1, 1, 0],
      "4.0": [2, 0, 1], "4.5": [1, 1, 1], "5.0": [2, 0, 2], "5.5": [3, 0, 1], "6.0": [2, 0, 3]
    };
    var row = TABLE[W.toFixed(1)];
    if (row) return pack(row[0], row[1], row[2]);
    // Algorithmic 6.5m..20m: 2 x 1.5m outside, middle prefers 1m, 1 x 1.5m
    // extra in the middle if the width has a 0.5m half-metre remainder.
    var middle = W - 3;                            // 3m consumed by the 2 outside 1.5m bars
    var hasHalf = Math.abs((middle * 2) - Math.round(middle * 2)) < EPS &&
                  Math.round(middle * 2) % 2 === 1;
    if (hasHalf) {
      // +1 x 1.5m in the middle absorbs the 0.5m; the rest is whole metres in 1m bars.
      return pack(3, 0, Math.round(middle - 1.5));
    }
    return pack(2, 0, Math.round(middle));
  }

  // ---------------------------------------------------------------------------
  // BALLAST (v0.11.0)
  // ---------------------------------------------------------------------------
  // Source: "Ballast loading" excerpt from the technical guidelines for
  // Exhibitions in Germany, supplied by Adam 2026-08-27. Ballast is already
  // calculated with a safety factor of 1.5 - do NOT apply another one.
  //
  // The kg figure is PER UPRIGHT (per bay support), confirmed by Adam. The table
  // is indexed by height only and carries no width term, which is consistent
  // with a per-support figure - a wider wall gets more uprights, not heavier
  // ones.
  //
  // Same weight system on BOTH ground support systems (Uniview 2.6mm and
  // Chauvet REM 3.9mm) - Adam, 2026-08-27.
  // Plate weight and part code live in PARTS.ballastPlate (catalogue-driven).
  // String keys - a bare 2.0 would collapse to "2" and miss a toFixed(1) lookup.
  var BALLAST = {
    "2.0": { kg: 17,  moment: 0.25 },
    "2.5": { kg: 38,  moment: 0.39 },
    "3.0": { kg: 64,  moment: 0.56 },
    "3.5": { kg: 95,  moment: 0.77 },
    "4.0": { kg: 131, moment: 1.00 },
    "4.5": { kg: 151, moment: 1.13 },
    "5.0": { kg: 173, moment: 1.28 },
    "5.5": { kg: 198, moment: 1.45 },
    "6.0": { kg: 226, moment: 1.63 }
  };
  var BALLAST_MIN_H = 2.0, BALLAST_MAX_H = 6.0;

  // Ground-support wall height limits (per system):
  //   Min - Adam 2026-08-27: REM 2m, Uniview 1.5m. Uniview 1.5m sits below the
  //         ballast table's first row (2.0m) so it clamps up to that figure.
  //   Max - Adam 2026-08-28: Uniview 4m (structural). REM caps at 6m via the
  //         ballast table (no separate rule).
  var GROUND_MIN_H = { uniview: 1.5, rem: 2.0 };
  var GROUND_MAX_H = { uniview: 4.0 };  // rem falls back to BALLAST_MAX_H (6m)

  // Ballast for a ground-supported wall.
  //   H        wall height in metres (0.5m steps)
  //   uprights number of uprights actually erected
  // Returns { ok, kgPerUpright, platesPerUpright, uprights, totalPlates,
  //           totalKg, lookupH, clamped, moment }.
  function ballastFor(H, uprights) {
    if (!(H > 0)) return { ok: false, error: "Height must be a positive number" };
    if (!(uprights > 0)) return { ok: false, error: "Ballast needs an upright count" };
    if (H > BALLAST_MAX_H + EPS)
      return { ok: false, error: "The ballast table stops at " + BALLAST_MAX_H +
        "m - a ground-supported wall over " + BALLAST_MAX_H + "m needs engineering sign-off" };
    // Below 2m the table has no row; clamp up to the 2.0m figure (conservative).
    var lookupH = (H < BALLAST_MIN_H - EPS) ? BALLAST_MIN_H : H;
    var row = BALLAST[lookupH.toFixed(1)];
    if (!row) return { ok: false, error: "No ballast figure for " + H + "m" };
    var plateKg = PARTS.ballastPlate.plateKg;
    var platesPerUpright = Math.ceil(row.kg / plateKg - EPS);
    return {
      ok: true,
      kgPerUpright: row.kg,
      moment: row.moment,
      platesPerUpright: platesPerUpright,
      uprights: uprights,
      totalPlates: platesPerUpright * uprights,
      totalKg: platesPerUpright * uprights * plateKg,
      lookupH: lookupH,
      clamped: Math.abs(lookupH - H) > EPS
    };
  }

  // ---------------------------------------------------------------------------
  // CABLING (v0.14.0)
  // ---------------------------------------------------------------------------
  // Rule (Adam, 2026-08-27): one starter cable per line, PRIMARY and BACKUP if
  // backup is running. Length = wall width + row height (row's top edge above
  // the floor). Backup lands on the far end of the chain, which is what forces
  // the full wall width into the length - and the input is spec'd the same way.
  //
  // REM stock is banded: pick the smallest length that fits (5/10/20m today).
  // Uniview is fixed at 15m per line, width-insensitive - its cable is a
  // starter, not a stock reel.

  // r=0 is the TOP row. Returns the row's TOP edge height above the floor in
  // metres, which is the highest point the cable has to reach. Conservative -
  // guarantees enough cable, worst case slight slack.
  function rowTopFromFloor(r, halfPerCol, H) {
    if (r === 0) return H;
    return H - (halfPerCol ? 0.5 : 1) - (r - 1);
  }

  // Given a REM cable stock list (ascending by lengthM), return the smallest
  // that fits requiredM, or null if the required length exceeds every stock
  // entry (caller then emits a free-text row).
  function pickCableStock(stock, requiredM) {
    for (var i = 0; i < stock.length; i++) {
      if (stock[i].lengthM >= requiredM - EPS) return stock[i];
    }
    return null;
  }

  // Compute the cable line items for a wall. Ports have their row on the first
  // panel (v0.9.1: lines are row-aligned and left-to-right).
  //   ports        - portMap.ports (each has .panels[0].r and .port index)
  //   halfPerCol   - 1 if the top row is a 500h half-row, else 0
  //   height       - wall height in metres
  //   width        - wall width in metres
  //   isBackupOn   - true if Q8 backup is running
  //   fam          - "uniview" or "rem"
  //   catalogue    - PARTS.cables entry for the family
  // Returns { items: [...kit lines], perLine: [...preview rows] }.
  function cablesForWall(ports, halfPerCol, height, width, isBackupOn, fam, catalogue) {
    var perLine = [];
    ports.forEach(function (pt) {
      if (!pt.panels || !pt.panels.length) return;
      var r = pt.panels[0].r;
      var required = width + rowTopFromFloor(r, halfPerCol, height);
      perLine.push({ port: pt.port, primaryPort: pt.primaryPort, row: r, requiredM: required, isBackupOn: !!isBackupOn });
    });

    var items = [];
    if (!catalogue) return { items: items, perLine: perLine };

    // Every "run" is one physical cable (or one composite primary+joiner+ext
    // group). Backup adds a second run per line.
    var runsPerLine = isBackupOn ? 2 : 1;
    var byPn = {}, joinerCount = 0, oversize = [];
    function bookStock(pn, label, lengthM) {
      byPn[pn] = byPn[pn] || { partNumber: pn, label: label, qty: 0, lengthM: lengthM };
      byPn[pn].qty += 1;
    }

    if (catalogue.mode === "fixed") {
      // Uniview: fixed cable, one per line. If a line requires MORE than the
      // fixed cable can reach, we can't auto-extend (proprietary connector) -
      // drop a flag to the caller; kit line still emits at qty.
      var fx = catalogue.fixed;
      perLine.forEach(function (line) {
        for (var i = 0; i < runsPerLine; i++) bookStock(fx.pn, fx.label, fx.lengthM);
        if (line.requiredM > fx.lengthM + EPS) {
          oversize.push({ requiredM: line.requiredM, port: line.port, stockLengthM: fx.lengthM });
        }
        line.stock = fx;
      });
    } else {
      // REM banded stock. Over-max lines use max + joiner + smallest extension.
      var stock = (catalogue.stock || []).slice().sort(function (a, b) { return a.lengthM - b.lengthM; });
      var joiner = catalogue.joiner;
      var maxStock = stock[stock.length - 1];
      perLine.forEach(function (line) {
        for (var i = 0; i < runsPerLine; i++) {
          var s = pickCableStock(stock, line.requiredM);
          if (s) {
            bookStock(s.pn, s.label, s.lengthM);
            if (i === 0) line.stock = s;
          } else if (joiner && maxStock) {
            // Extend: max stock + joiner + smallest that covers the remainder.
            var remaining = line.requiredM - maxStock.lengthM;
            var ext = pickCableStock(stock, remaining);
            if (ext) {
              bookStock(maxStock.pn, maxStock.label, maxStock.lengthM);
              bookStock(ext.pn, ext.label, ext.lengthM);
              joinerCount += 1;
              if (i === 0) line.stock = { extended: true, primary: maxStock, extension: ext };
            } else {
              // Even primary + ext can't cover it - drop to free-text.
              oversize.push({ requiredM: line.requiredM, port: line.port });
              if (i === 0) line.stock = null;
            }
          } else {
            oversize.push({ requiredM: line.requiredM, port: line.port });
            if (i === 0) line.stock = null;
          }
        }
      });
    }

    // Emit stock cable lines (sorted by length asc for readability).
    Object.keys(byPn).sort(function (a, b) { return byPn[a].lengthM - byPn[b].lengthM; })
      .forEach(function (pn) {
        items.push({ category: "Cable", label: byPn[pn].label, partNumber: byPn[pn].partNumber, qty: byPn[pn].qty });
      });
    // Ethercon joiners (REM only), aggregated.
    if (joinerCount > 0 && catalogue.joiner) {
      items.push({ category: "Cable", label: catalogue.joiner.label, partNumber: catalogue.joiner.pn, qty: joinerCount });
    }
    // Spares (Adam, 2026-08-28): one spare per unique stock length used, per
    // family. Listed as separate rows so the pick crew can see what's spare.
    Object.keys(byPn).sort(function (a, b) { return byPn[a].lengthM - byPn[b].lengthM; })
      .forEach(function (pn) {
        items.push({ category: "Cable", label: byPn[pn].label + " (spare)", partNumber: byPn[pn].partNumber, qty: 1 });
      });
    // Oversize / uncoverable: free-text row so the crew knows to spec these
    // manually. Grouped by required length for a legible list.
    if (oversize.length) {
      var byLen = {};
      oversize.forEach(function (o) { byLen[o.requiredM.toFixed(1)] = (byLen[o.requiredM.toFixed(1)] || 0) + 1; });
      Object.keys(byLen).forEach(function (m) {
        items.push({ category: "Cable",
          label: (fam === "uniview"
            ? "Uniview line needs " + m + "m - exceeds 15m starter, spec extension"
            : "Cable " + m + "m (over max stock even with joiner, spec extension)"),
          partNumber: null, qty: byLen[m] });
      });
    }
    return { items: items, perLine: perLine, oversize: oversize, joinerCount: joinerCount };
  }

  // Spare panels come cased - one leftover partial case worth, OR a whole
  // extra case if the wall lands exactly on a full case.
  //   caseSize 4:   3 used -> 1 spare, 4 -> 4, 5 -> 3, 8 -> 4, 18 -> 2, 20 -> 4
  //   caseSize 8:   6 used -> 2 spare, 8 -> 8, 10 -> 6
  function computeSpares(used, caseSize) {
    if (!(used > 0)) return 0;
    var rem = used % caseSize;
    return rem === 0 ? caseSize : (caseSize - rem);
  }

  // ===========================================================================
  // PORT BANDWIDTH + PORT MAPPING (v0.9.0)
  // ===========================================================================

  // Percentage of ONE PORT's capacity consumed by ONE panel, with the processor
  // set in that mode. Confirmed by Adam 2026-08-25: per PORT, not per processor
  // - a port is full at 100%, so maxPanelsPerPort = floor(100 / pct).
  //
  //   BANDWIDTH[processor][family][size][refreshHz][bitDepth]
  //     processor : "mx30" | "mx40pro"
  //     family    : "uniview" (UR Pro 2.6mm) | "chauvet" (REM 3IP 3.9mm)
  //     size      : "full" (1000x500) | "half" (500x500)
  //
  // Notes on the data - do NOT "tidy" these into a formula:
  //  - The MX30 has NO 12bit column. It is 8/10bit only.
  //  - Uniview figures are IDENTICAL on MX30 and MX40.
  //  - Chauvet REM costs noticeably more on the MX30 (8% vs 5% at 60hz/8bit for
  //    a 1000x500). That is real and is NOT explained by pixel bandwidth alone,
  //    so this is authoritative lookup data, not something to compute.
  //  - Uniview 500x500 @ 60hz/8bit is 6%. An early spreadsheet said 3%; that was
  //    wrong (it was below the 50hz figure, and not half the 1000x500 figure).
  //    Both the MX30 and MX40 tables agree on 6%.
  var BANDWIDTH = {
    mx30: {
      uniview: {
        full: { 25: { 8: 5, 10: 7 }, 50: { 8: 10, 10: 13 }, 60: { 8: 12, 10: 15 } },
        half: { 25: { 8: 3, 10: 4 }, 50: { 8: 5,  10: 7  }, 60: { 8: 6,  10: 8  } }
      },
      chauvet: {
        full: { 25: { 8: 4, 10: 5 }, 50: { 8: 7, 10: 9 }, 60: { 8: 8, 10: 10 } },
        half: { 25: { 8: 2, 10: 3 }, 50: { 8: 4, 10: 5 }, 60: { 8: 4, 10: 5  } }
      }
    },
    mx40pro: {
      uniview: {
        full: { 25: { 8: 5, 10: 7, 12: 10 }, 50: { 8: 10, 10: 13, 12: 19 }, 60: { 8: 12, 10: 15, 12: 23 } },
        half: { 25: { 8: 3, 10: 4, 12: 5  }, 50: { 8: 5,  10: 7,  12: 10 }, 60: { 8: 6,  10: 8,  12: 12 } }
      },
      chauvet: {
        full: { 25: { 8: 3, 10: 3, 12: 5 }, 50: { 8: 5, 10: 6, 12: 9 }, 60: { 8: 5, 10: 7, 12: 10 } },
        half: { 25: { 8: 2, 10: 2, 12: 3 }, 50: { 8: 3, 10: 3, 12: 5 }, 60: { 8: 3, 10: 4, 12: 5  } }
      }
    }
  };

  var PORT_CAPACITY = 100;
  var REFRESH_RATES = [25, 50, 60];
  var BIT_DEPTHS    = [8, 10, 12];

  // Physical Gigabit output ports per processor (Adam 2026-08-25).
  // Port count and display name now come from PARTS.processors (catalogue-driven).
  function processorPorts(model) { var p = PARTS.processors[model]; return p && p.ports; }
  function processorName(model)  { var p = PARTS.processors[model]; return (p && p.name) || model; }

  // Redundancy. Running backup pairs each primary port with a backup port, so
  // only HALF the ports are available as primaries - an MX30 drops from 10
  // usable lines to 5, an MX40 Pro from 20 to 10. Two schemes are in use:
  //   "none"   - no redundancy, every port is a primary
  //   "pairs"  - adjacent: 1&2, 3&4, 5&6 ...
  //   "offset" - half-offset: MX40 (20 ports) 1&11, 2&12 ...
  //                           MX30 (10 ports) 1&6,  2&7  ...
  var BACKUP_MODES = ["none", "pairs", "offset"];

  // Work out which physical port (and which processor) each data line lands on.
  function allocatePorts(processorModel, backup, lines) {
    var total = processorPorts(processorModel);
    if (!total || !(lines > 0)) return null;
    var half = total / 2;
    var redundant = (backup && backup !== "none");
    var perProcessor = redundant ? half : total;

    var assignments = [];
    for (var i = 0; i < lines; i++) {
      var slot = i % perProcessor;
      var primary, back = null;
      if (!redundant)              { primary = slot + 1; }
      else if (backup === "pairs") { primary = slot * 2 + 1; back = slot * 2 + 2; }
      else                         { primary = slot + 1;     back = slot + 1 + half; }
      assignments.push({
        processor: Math.floor(i / perProcessor) + 1,
        primary: primary,
        backup: back
      });
    }
    return {
      assignments: assignments,
      totalPorts: total,
      perProcessor: perProcessor,
      processors: Math.ceil(lines / perProcessor),
      redundant: redundant
    };
  }

  // Bit depths this processor can actually run. The MX30 has no 12bit column.
  function bitDepthsFor(processorModel) {
    var proc = BANDWIDTH[processorModel];
    if (!proc) return [8, 10];
    var row = proc.uniview.full[60] || {};
    return BIT_DEPTHS.filter(function (b) { return typeof row[b] === "number"; });
  }

  function bandwidthPct(processorModel, isUniview, size, refresh, bitDepth) {
    var proc = BANDWIDTH[processorModel];
    if (!proc) return null;
    var fam = proc[isUniview ? "uniview" : "chauvet"];
    var bySize = fam && fam[size];
    var byRefresh = bySize && bySize[refresh];
    var v = byRefresh && byRefresh[bitDepth];
    return (typeof v === "number") ? v : null;
  }

  // Split the wall into data lines (ports).
  //
  // WIRING RULES (Adam, 2026-08-25) - these override pure bandwidth efficiency:
  //  1. A line NEVER mixes panel sizes. 1000x500 and 500x500 cannot share a
  //     port. Rows are uniform, so keeping lines inside a row satisfies this
  //     automatically - the 500h top row always gets its own line(s).
  //  2. Wiring always runs LEFT TO RIGHT. No serpentine, no reversing on
  //     alternate rows: every line starts at its leftmost panel.
  //  3. Lines are ROW-ALIGNED - a line never spans two rows, so 3 rows gives at
  //     least 3 lines. This is deliberately not the minimum port count. You
  //     build and fly a wall row by row, and having each row on its own line
  //     lets you test that row as it goes up. Bandwidth alone would often allow
  //     fewer lines; `minPortsByBandwidth` reports that figure for reference,
  //     but the row rule wins.
  //
  // A row wider than one port's capacity is split into several contiguous
  // left-to-right chunks, sized as evenly as possible.
  //
  // Grid convention matches the rest of the tool: r = 0 is the TOP row, which is
  // the 500h row when the wall height has a 0.5m remainder.
  //
  //   o = { cols, rows, halfTopRow, pctFull, pctHalf }
  // Returns { ok, ports[], portCount, totalPct, minPortsByBandwidth } where each
  // port is { port, row, panels[{r,c,half,pct,port}], pct }.
  function mapPorts(o) {
    var cols = o.cols, rows = o.rows, halfTopRow = !!o.halfTopRow;
    var pctFull = o.pctFull, pctHalf = o.pctHalf;
    if (!(pctFull > 0)) return { ok: false, error: "No bandwidth figure for that mode" };
    if (halfTopRow && !(pctHalf > 0)) return { ok: false, error: "No 500x500 bandwidth figure for that mode" };
    if (!(cols > 0) || !(rows > 0)) return { ok: false, error: "Nothing to map" };
    if (pctFull > PORT_CAPACITY + EPS || (halfTopRow && pctHalf > PORT_CAPACITY + EPS))
      return { ok: false, error: "A single panel exceeds one port at that refresh / bit depth" };

    var ports = [], total = 0;
    for (var r = 0; r < rows; r++) {
      var isHalf = halfTopRow && r === 0;
      var pct = isHalf ? pctHalf : pctFull;

      // How many lines this row needs, then spread the row's panels across them
      // as evenly as possible so no line is left carrying scraps.
      var maxPerLine = Math.floor((PORT_CAPACITY + EPS) / pct);
      var lines = Math.ceil(cols / maxPerLine);
      var base = Math.floor(cols / lines), extra = cols % lines;

      var c = 0;
      for (var i = 0; i < lines; i++) {
        var n = base + (i < extra ? 1 : 0);
        var panels = [];
        for (var k = 0; k < n; k++, c++) {
          panels.push({ r: r, c: c, half: isHalf, pct: pct });   // always left to right
        }
        ports.push({ row: r, panels: panels, pct: +(n * pct).toFixed(2) });
        total += n * pct;
      }
    }

    ports.forEach(function (pt, idx) {
      pt.port = idx + 1;
      pt.panels.forEach(function (p) { p.port = idx + 1; });
    });

    return {
      ok: true, ports: ports, portCount: ports.length,
      totalPct: +total.toFixed(2),
      // What bandwidth alone would allow, ignoring the row rule. Reported so the
      // trade-off is visible; never used to reduce the line count.
      minPortsByBandwidth: Math.max(1, Math.ceil((total - EPS) / PORT_CAPACITY))
    };
  }

  // Compute the full kit from the answered questions.
  //   opts = { pitch:          "2.6mm" | "3.9mm",
  //            environment:    "indoor" | "outdoor",
  //            support:        "flown" | "ground",
  //            rigging:        "clamp" | "sling"       (Outdoor + Flown only),
  //            width:          metres, multiples of 0.5,
  //            height:         metres, multiples of 0.5,
  //            processor:      "behind" | "far",
  //            processorModel: "mx30" | "mx40pro"      (default mx30),
  //            refresh:        25 | 50 | 60            (default 60),
  //            bitDepth:       8 | 10 | 12             (default 8; MX30 max 10) }
  function computeKit(opts) {
    opts = opts || {};
    if (!opts.pitch || !opts.environment || !opts.support || !opts.processor)
      return { ok: false, error: "Answer every question" };
    if (opts.pitch !== "2.6mm" && opts.pitch !== "3.9mm")
      return { ok: false, error: "Pitch must be 2.6mm or 3.9mm" };
    if (opts.pitch === "2.6mm" && opts.environment === "outdoor")
      return { ok: false, error: "2.6mm is indoor only" };

    // Processor mode - drives the port bandwidth lookup.
    var procModel = (opts.processorModel === "mx40pro") ? "mx40pro" : "mx30";
    var refresh   = (opts.refresh  != null) ? +opts.refresh  : 60;
    var bitDepth  = (opts.bitDepth != null) ? +opts.bitDepth : 8;
    if (REFRESH_RATES.indexOf(refresh) < 0)
      return { ok: false, error: "Refresh must be 25, 50 or 60hz" };
    if (BIT_DEPTHS.indexOf(bitDepth) < 0)
      return { ok: false, error: "Bit depth must be 8, 10 or 12 bit" };
    if (bitDepthsFor(procModel).indexOf(bitDepth) < 0)
      return { ok: false, error: "The MX30 does not support " + bitDepth + "bit - choose 8 or 10 bit, or an MX40 Pro" };
    var backup = opts.backup || "none";
    if (BACKUP_MODES.indexOf(backup) < 0)
      return { ok: false, error: "Backup must be none, pairs or offset" };

    var W = +opts.width, H = +opts.height;
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    if (!(H > 0) || !isMult(H, 0.5)) return { ok: false, error: "Height must be a multiple of 0.5m" };

    // Panel geometry - 500w panels in two heights (1000h and 500h).
    // Per column stack: N x 1000h + (1 x 500h if H has a 0.5m remainder).
    //   1.5m column -> 1x 1000 + 1x 500
    //   2.0m column -> 2x 1000
    //   2.5m column -> 2x 1000 + 1x 500
    var cols = Math.round(W / 0.5);
    var fullPerCol = Math.floor(H + EPS);
    var halfPerCol = Math.abs(H - fullPerCol - 0.5) < EPS ? 1 : 0;
    var rows = fullPerCol + halfPerCol;
    var fullPanels = cols * fullPerCol;
    var halfPanels = cols * halfPerCol;
    var panels = fullPanels + halfPanels;

    var items = [];
    var ballast = null;                 // set only on ground-supported walls

    // Panels branch by pitch (product family).
    //   3.9mm - Chauvet REM (indoor OR outdoor):  YW-00341 1000x500, YW-00342 500x500
    //   2.6mm - Uniview UR Pro (indoor only):     YW-04066 1000x500, YW-04067 500x500
    var isUniview = (opts.pitch === "2.6mm");
    var fam = famKey(isUniview);
    var panelFull = PARTS.panels[fam].full, panelHalf = PARTS.panels[fam].half;
    if (fullPanels > 0) {
      items.push({ category: "Screen", label: panelFull.label, partNumber: panelFull.pn, qty: fullPanels });
      var spareFull = computeSpares(fullPanels, panelFull.caseSize);
      if (spareFull > 0) items.push({ category: "Spares", label: panelFull.label, partNumber: panelFull.pn, qty: spareFull, hundredPercent: true });
    }
    if (halfPanels > 0) {
      items.push({ category: "Screen", label: panelHalf.label, partNumber: panelHalf.pn, qty: halfPanels });
      var spareHalf = computeSpares(halfPanels, panelHalf.caseSize);
      if (spareHalf > 0) items.push({ category: "Spares", label: panelHalf.label, partNumber: panelHalf.pn, qty: spareHalf, hundredPercent: true });
    }

    // ---- Rigging / support --------------------------------------------------
    if (opts.support === "flown") {
      var rig = flownRig(W);
      // Rigging bars: Chauvet has clamp OR sling; Uniview is sling-only.
      // Chauvet REM Header Bar:   1m clamp YW-00343, 1m sling YW-00344,
      //                           0.5m curve clamp YW-00345, 0.5m curve sling YW-00346.
      // Uniview UR Pro Rigging Bar (sling only): 1m YW-04068, 0.5m YW-04069.
      var rigMode;
      if (isUniview) {
        rigMode = "sling";                    // Uniview flown - always sling.
      } else {
        if (!opts.rigging) return { ok: false, error: "Choose Clamp or Sling for a flown Chauvet wall" };
        if (opts.rigging !== "clamp" && opts.rigging !== "sling")
          return { ok: false, error: "Rigging must be clamp or sling" };
        rigMode = opts.rigging;
      }
      if (rig) {
        var bars = PARTS.flown[fam][rigMode];
        if (rig.bars_1 > 0)  items.push({ category: "Rigging", label: bars.bar1.label,  partNumber: bars.bar1.pn,  qty: rig.bars_1 });
        if (rig.bars_05 > 0) items.push({ category: "Rigging", label: bars.bar05.label, partNumber: bars.bar05.pn, qty: rig.bars_05 });
      }
    } else {
      // Ground support - kit differs by pitch.
      // Uniview 2.6mm:  YW-04065 Ground Support Kit (2 uprights).
      // Chauvet 3.9mm:  YW-00169 LSU Set (2 uprights) + LSU Connecting Bars
      //                 (LSU-CONNB-L150 - YW code to follow).
      // Both systems then take the SAME ballast: YW-00259 12.5kg weight plates,
      // per upright, off the German exhibition-guideline table (v0.11.0).
      // The 30cm topper (YW-04062) is REM-only and goes on every REM ground
      // wall, one per upright (Adam, 2026-08-27).
      //
      // uprights = the number actually ERECTED, which is what gets ballasted.
      // That is not always what the kits supply: an LSU Set ships 2 uprights, so
      // a 3-bar run needs 4 uprights but rounds up to 2 sets = 4 supplied, while
      // a 2-bar run needs 3 and gets 4.
      var famH = isUniview ? "uniview" : "rem";
      var minH = GROUND_MIN_H[famH];
      var maxH = GROUND_MAX_H[famH];    // may be undefined (falls back to ballast max)
      if (H < minH - EPS)
        return { ok: false, error: (isUniview ? "2.6mm" : "3.9mm") +
          " ground support minimum wall height is " + minH + "m" };
      if (maxH != null && H > maxH + EPS)
        return { ok: false, error: (isUniview ? "2.6mm" : "3.9mm") +
          " ground support maxes out at " + maxH + "m tall" };

      var uprights;
      var gp = PARTS.ground[fam];
      if (isUniview) {
        var g26 = ground26Kit(W);
        if (!g26.ok) return { ok: false, error: g26.error };
        items.push({ category: "Rigging", label: gp.kit.label, partNumber: gp.kit.pn, qty: g26.kits });
        // Uniview upright count now follows Adam's rule (v0.18.0); ballast
        // and preview dots both use this. Each kit ships 2 uprights, so we
        // may over-supply by 1 on odd upright counts - accepted trade-off.
        uprights = g26.uprights;
      } else {
        var g39 = ground39Kit(W);
        if (!g39.ok) return { ok: false, error: g39.error };
        var setLabel = gp.set.label;
        if (g39.bars_1 > 0) setLabel += " (incl. " + g39.bars_1 + " x 1m bar" + (g39.bars_1 === 1 ? "" : "s") + ")";
        items.push({ category: "Rigging", label: setLabel, partNumber: gp.set.pn, qty: g39.kits });
        if (g39.bars_15 > 0) items.push({ category: "Rigging", label: gp.bar15.label, partNumber: gp.bar15.pn, qty: g39.bars_15 });
        if (g39.bars_2  > 0) items.push({ category: "Rigging", label: gp.bar2.label,  partNumber: gp.bar2.pn,  qty: g39.bars_2 });
        // 1m bars ship inside the LSU Set (Adam, 2026-08-28) - no line item.
        // Upright count follows Adam's 0.5m-inset + 1m-interval rule
        // (see remUprightPositions), NOT the bars+1 sum.
        uprights = g39.uprights;
        // 30cm topper - REM ground only, one per upright, every height.
        items.push({ category: "Rigging", label: gp.topper.label, partNumber: gp.topper.pn, qty: uprights });
      }

      ballast = ballastFor(H, uprights);
      if (!ballast.ok) return { ok: false, error: ballast.error };
      items.push({
        category: "Rigging",
        label: PARTS.ballastPlate.label + " (" + ballast.platesPerUpright + " per upright x " + uprights + ")",
        partNumber: PARTS.ballastPlate.pn,
        qty: ballast.totalPlates
      });
    }

    // ---- Processor -----------------------------------------------------------
    // Novastar MX30 (YW-04071) or MX40 Pro (YW-00347) - user picks via Q5.
    // qty is patched below once the port map says how many processors it takes.
    var procPart = PARTS.processors[procModel];
    var processorItem = { category: "Processor", label: procPart.label, partNumber: procPart.pn, qty: 1 };
    items.push(processorItem);
    // Inter-processor cables inserted below once processorCount is known - one
    // set per ADDITIONAL processor (linking box N-1 to box N).
    var procCableItems = [
      { category: "Processor", label: PARTS.procCables.network.label, partNumber: PARTS.procCables.network.pn, qty: 0 },
      { category: "Processor", label: PARTS.procCables.hdmi.label,    partNumber: PARTS.procCables.hdmi.pn,    qty: 0 },
      { category: "Processor", label: PARTS.procCables.sdi.label,     partNumber: PARTS.procCables.sdi.pn,     qty: 0 }
    ];
    procCableItems.forEach(function (it) { items.push(it); });
    // Signal / starter cables still deferred (hardware first). When ready,
    // add items with category "Cable" and un-skip "Cable" in INSERT_ORDER.

    // ---- Port map ------------------------------------------------------------
    // How the wall gets plugged up: how many lines come off the processor, which
    // panels each line feeds, and how loaded each port is.
    var pctFull = bandwidthPct(procModel, isUniview, "full", refresh, bitDepth);
    var pctHalf = bandwidthPct(procModel, isUniview, "half", refresh, bitDepth);
    if (pctFull == null || (halfPanels > 0 && pctHalf == null))
      return { ok: false, error: "No bandwidth figure for " + procModel + " at " + refresh + "hz " + bitDepth + "bit" };

    var portMap = mapPorts({
      cols: cols, rows: rows, halfTopRow: halfPerCol === 1,
      pctFull: pctFull, pctHalf: pctHalf
    });
    if (!portMap.ok) return { ok: false, error: portMap.error };

    // ---- Physical port allocation + how many processors that takes -----------
    var alloc = allocatePorts(procModel, backup, portMap.portCount);
    portMap.ports.forEach(function (pt, i) {
      var a = alloc.assignments[i];
      pt.processor   = a.processor;
      pt.primaryPort = a.primary;
      pt.backupPort  = a.backup;
      // What gets stamped on the panels: the physical port you actually plug.
      // Prefixed with the processor number only when there's more than one.
      pt.label = (alloc.processors > 1 ? a.processor + ":" : "") + a.primary;
    });
    processorItem.qty = alloc.processors;
    // One cable set per link between boxes = processorCount - 1. Drop the lines
    // when there is only one processor so they don't clutter the kit.
    var linkSets = Math.max(0, alloc.processors - 1);
    procCableItems.forEach(function (it) { it.qty = linkSets; });
    if (linkSets === 0) {
      items = items.filter(function (it) { return procCableItems.indexOf(it) < 0; });
    }

    // ---- Starter cables ------------------------------------------------------
    // One per line, doubled if backup on. Length = wall width + row top height.
    var cableRes = cablesForWall(portMap.ports, halfPerCol, H, W, alloc.redundant, fam, PARTS.cables && PARTS.cables[fam]);
    cableRes.items.forEach(function (it) { items.push(it); });

    // Would a bigger processor do it in fewer boxes? Worth saying out loud -
    // with backup running, an MX30 only offers 5 primaries, so walls spill onto
    // a second box quickly and an MX40 Pro (10 primaries) often collapses it
    // back to one.
    var upgrade = null;
    if (procModel === "mx30") {
      var asMx40 = allocatePorts("mx40pro", backup, portMap.portCount);
      if (asMx40 && asMx40.processors < alloc.processors) {
        upgrade = portMap.portCount + " lines needs " + alloc.processors + " x MX30 (" +
          alloc.perProcessor + " usable port" + (alloc.perProcessor === 1 ? "" : "s") +
          " each" + (alloc.redundant ? " with backup" : "") + ") - " +
          (asMx40.processors === 1 ? "a single MX40 Pro" : asMx40.processors + " x MX40 Pro") +
          " would cover it.";
      }
    }

    return {
      ok: true,
      items: items,
      cols: cols, rows: rows, panels: panels,
      fullPanels: fullPanels, halfPanels: halfPanels,
      width: W, height: H,
      // Port mapping
      ports: portMap.ports, portCount: portMap.portCount,
      totalPct: portMap.totalPct, minPortsByBandwidth: portMap.minPortsByBandwidth,
      pctFull: pctFull, pctHalf: pctHalf,
      refresh: refresh, bitDepth: bitDepth, processorModel: procModel,
      // Processors + redundancy
      backup: backup, redundant: alloc.redundant,
      processorCount: alloc.processors, portsPerProcessor: alloc.perProcessor,
      totalPortsPerProcessor: alloc.totalPorts, upgradeSuggestion: upgrade,
      // Ballast (null when flown)
      ballast: ballast,
      // Cabling
      cables: cableRes,
      // Bar decomposition for preview overlays. Populated only for the branch
      // that actually built the bars; other branches leave it null.
      barsFlown: (opts.support === "flown") ? (typeof rig !== "undefined" ? rig : null) : null,
      barsGround26: (opts.support === "ground" && isUniview) ? (typeof g26 !== "undefined" ? g26 : null) : null,
      barsGround39: (opts.support === "ground" && !isUniview) ? (typeof g39 !== "undefined" ? g39 : null) : null
    };
  }

  // Distinct fills per data line. Cycles past 10 ports; the per-panel port
  // number is the real disambiguator, colour is just the quick read.
  var PORT_COLOURS = [
    "#2563eb", "#0a7d5a", "#b45309", "#7c3aed", "#be123c",
    "#0369a1", "#4d7c0f", "#a21caf", "#c2410c", "#115e59"
  ];
  function portColour(n) { return PORT_COLOURS[(n - 1) % PORT_COLOURS.length]; }

  // Bar segments colour by physical length so mixed-length runs (LSU 1.5+2+1
  // on a 4.5m REM ground; rigging bars 1m + 0.5m on 4.5m flown) read at a
  // glance. Same palette used on top (flown) and bottom (ground) bars.
  var BAR_COLOUR = {
    "0.5": "#0d9488",   // teal
    "1.0": "#2563eb",   // blue
    "1.5": "#d97706",   // amber
    "2.0": "#7c3aed"    // purple
  };

  // Front-elevation SVG of the wall - grid of 500w panels. Top row is drawn
  // at half height when the wall's H has a 0.5m remainder (500h panels).
  // When opts.ports is supplied (v0.9.0) each panel is filled with its port's
  // colour and stamped with the port number, and the serpentine feed path is
  // drawn over the top with a start marker on the first panel of each line.
  function buildWallSvg(cols, rows, opts) {
    opts = opts || {};
    var maxW = opts.maxW || 420, maxH = opts.maxH || 260, pad = 24;
    var height = opts.height || rows;                       // wall height in metres
    var trim = Math.max(0, rows - height);                  // 0 or 0.5 typically
    // Hardware overlays draw outside the wall grid, so we need vertical head/foot
    // room. topBar = flown rigging bar above the wall; footBar = ground base bar
    // beneath. Their heights are the reserved gap in SVG pixels.
    var topBar  = opts.topBar  || null;    // { label } or null (flown)
    var footBar = opts.footBar || null;    // { label, uprights? } or null (ground)
    var extraTop  = topBar  ? 22 : 0;
    var extraFoot = footBar ? 26 : 0;
    // Column numbers on top + row letters on left (Adam v0.19.0).
    var labelSize = 10;
    var colLabelGap = 14;                  // space above the wall for col numbers
    var rowLabelGap = 16;                  // space left of the wall for row letters
    // Panels are 0.5m wide x 1m high in real units; scale so the wall fits the box.
    var wPx = (maxW - pad * 2 - rowLabelGap) / (cols * 0.5);
    var hPx = (maxH - pad * 2 - extraTop - extraFoot - colLabelGap) / height;
    var unit = Math.max(6, Math.min(wPx, hPx));             // px per metre
    var panelW = 0.5 * unit, panelH = 1.0 * unit;
    var W = panelW * cols, H = unit * height;
    var SW = W + pad * 2 + rowLabelGap, SH = H + pad * 2 + extraTop + extraFoot + colLabelGap;
    var ox = pad + rowLabelGap, oy = pad + extraTop + colLabelGap;
    var ports = opts.ports || null;

    // The TOP row (r==0) is trimmed when height isn't a whole metre.
    function cellY(r) { return oy + (r === 0 ? 0 : (r - trim) * panelH); }
    function cellH(r) { return r === 0 ? (1 - trim) * panelH : panelH; }
    function cx(c)    { return ox + c * panelW + panelW / 2; }
    function cy(r)    { return cellY(r) + cellH(r) / 2; }

    // r_c -> { colour index, printed label }. The label is the PHYSICAL port
    // being plugged (e.g. "3", or "2:3" for processor 2 port 3), not the line
    // index - with backup running, line 2 can land on port 3.
    var portOf = {};
    if (ports) {
      ports.forEach(function (pt) {
        var lbl = (pt.label != null) ? String(pt.label) : String(pt.port);
        pt.panels.forEach(function (p) { portOf[p.r + "_" + p.c] = { n: pt.port, lbl: lbl }; });
      });
    }

    var fs = Math.max(7, Math.min(13, panelW * 0.38));
    var showNums = ports && panelW >= 15 && (panelH * (1 - trim)) >= 12;

    var cells = "", nums = "";
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var y = cellY(r), h = cellH(r);
        var pn = portOf[r + "_" + c];
        var fill = pn ? portColour(pn.n) : "#1D1D3C";
        cells += '<rect x="' + (ox + c * panelW + 1) + '" y="' + (y + 1) +
          '" width="' + (panelW - 2) + '" height="' + (h - 2) +
          '" fill="' + fill + '" stroke="#26215C" stroke-width="1"/>';
        if (showNums && pn) {
          nums += '<text x="' + cx(c) + '" y="' + cy(r) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + fs.toFixed(1) +
            '" fill="#ffffff" fill-opacity="0.75" text-anchor="middle" dominant-baseline="central">' + pn.lbl + '</text>';
        }
      }
    }

    // Serpentine feed path + start marker per line.
    var paths = "";
    if (ports) {
      ports.forEach(function (pt) {
        if (!pt.panels.length) return;
        var pts = pt.panels.map(function (p) { return cx(p.c).toFixed(1) + "," + cy(p.r).toFixed(1); }).join(" ");
        paths += '<polyline points="' + pts + '" fill="none" stroke="#ffffff" stroke-opacity="0.85" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>';
        var s = pt.panels[0], lbl = (pt.label != null) ? String(pt.label) : String(pt.port);
        var rad = Math.max(6, Math.min(11, panelW * 0.3));
        // Longer labels ("2:13") need a wider badge than a plain circle.
        var rx = Math.max(rad, rad * 0.55 * lbl.length);
        paths += '<rect x="' + (cx(s.c) - rx).toFixed(1) + '" y="' + (cy(s.r) - rad).toFixed(1) +
          '" width="' + (rx * 2).toFixed(1) + '" height="' + (rad * 2).toFixed(1) +
          '" rx="' + rad.toFixed(1) + '" fill="#ffffff" stroke="' + portColour(pt.port) + '" stroke-width="2"/>';
        paths += '<text x="' + cx(s.c).toFixed(1) + '" y="' + cy(s.r).toFixed(1) + '" font-family="Arial,Helvetica,sans-serif" font-size="' +
          Math.max(7, rad * 1.05).toFixed(1) + '" font-weight="bold" fill="' + portColour(pt.port) +
          '" text-anchor="middle" dominant-baseline="central">' + lbl + '</text>';
      });
    }

    var frame = '<rect x="' + (ox - 0.5) + '" y="' + (oy - 0.5) + '" width="' + (W + 1) + '" height="' + (H + 1) + '" fill="none" stroke="#26215C" stroke-width="2"/>';
    var wLbl = '<text x="' + (ox + W / 2) + '" y="' + (SH - 6) + '" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#666" text-anchor="middle">' + (cols * 0.5) + ' m wide</text>';
    var hLbl = '<text x="' + (SW - 8) + '" y="' + (oy + H / 2) + '" font-family="Arial,Helvetica,sans-serif" font-size="11" fill="#666" text-anchor="middle" transform="rotate(90 ' + (SW - 8) + ' ' + (oy + H / 2) + ')">' + height + ' m high</text>';

    // Column numbers along the TOP (1..cols, left to right) and row letters
    // down the LEFT (A = bottom row, B above, ...). Adam v0.19.0.
    var axes = "";
    for (var cc = 0; cc < cols; cc++) {
      axes += '<text x="' + (ox + cc * panelW + panelW / 2).toFixed(1) +
        '" y="' + (oy - 4) + '" font-family="Arial,Helvetica,sans-serif" font-size="' + labelSize +
        '" fill="#888" text-anchor="middle">' + (cc + 1) + '</text>';
    }
    // Row letters: A at BOTTOM row (physical build order). Rows are indexed with
    // r=0 at the TOP, so bottom row index = rows - 1 gets label A.
    for (var rr = 0; rr < rows; rr++) {
      var letterIdx = (rows - 1) - rr;   // r=0 (top) -> letter index (rows-1)
      var letter = String.fromCharCode(65 + letterIdx);  // A=65
      axes += '<text x="' + (ox - 6) + '" y="' + (cellY(rr) + cellH(rr) / 2).toFixed(1) +
        '" font-family="Arial,Helvetica,sans-serif" font-size="' + labelSize +
        '" fill="#888" text-anchor="end" dominant-baseline="central">' + letter + '</text>';
    }

    // Hardware overlays (v0.13.0 / colour-coded v0.15.0). Top rigging bar for
    // flown walls; base/foot bar for ground walls (both systems). Bars are
    // drawn as coloured SEGMENTS - one per physical bar - so mixed decomps
    // (LSU 1.5 + 2 + 1m mix on a 4.5m REM ground) read at a glance.
    //   BAR_COLOUR[lengthM] -> fill
    // opts.topBar / opts.footBar may pass:
    //   { label, bars: [{ lengthM, count }, ...], uprights?, totalM? }
    // Uprights are drawn as dots on the base bar seams.
    function drawBar(y, bh, bar, above) {
      var out = "";
      var total = bar.totalM || cols * 0.5;
      // Caller may supply an EXPLICIT left-to-right layout as `flatBars`
      // (metres per bar, in placement order). Otherwise we explode
      // `bars: [{lengthM, count}, ...]` into a flat list. flatBars wins when
      // both are set - REM ground uses it to put 1.5m on the outside.
      var flat;
      if (bar.flatBars && bar.flatBars.length) {
        flat = bar.flatBars.slice();
      } else {
        flat = [];
        (bar.bars || []).forEach(function (b) { for (var i = 0; i < (b.count || 0); i++) flat.push(b.lengthM); });
      }
      // Fallback: no per-length data -> single solid bar (legacy behaviour).
      if (!flat.length) {
        out += '<rect x="' + (ox - 4) + '" y="' + y + '" width="' + (W + 8) + '" height="' + bh +
          '" rx="2" fill="#26215C" stroke="#0f0e2a" stroke-width="1"/>';
      } else {
        var px = ox, gap = 1;
        var scale = W / total;
        flat.forEach(function (lm, i) {
          var sw = lm * scale - (i < flat.length - 1 ? gap : 0);
          var fill = BAR_COLOUR[lm.toFixed(1)] || "#26215C";
          out += '<rect x="' + px.toFixed(1) + '" y="' + y + '" width="' + Math.max(1, sw).toFixed(1) +
            '" height="' + bh + '" rx="1.5" fill="' + fill + '" stroke="#0f0e2a" stroke-width="0.8"/>';
          px += lm * scale;
        });
      }
      // Upright dots. Three modes, in priority order:
      //   1. bar.uprightPositions - explicit metres array (REM ground rule:
      //      0.5m inset + every 1m, plus tight 0.5m gap for half-metre widths).
      //   2. bar.uprights count with flat.length + 1 matching - placed at bar
      //      seams (bars share uprights).
      //   3. bar.uprights count only - evenly-spaced fallback.
      var positions = [];
      if (bar.uprightPositions && bar.uprightPositions.length) {
        var pxPerM = W / total;
        bar.uprightPositions.forEach(function (m) { positions.push(ox + m * pxPerM); });
      } else if (bar.uprights && bar.uprights > 1) {
        var n = bar.uprights;
        if (flat.length && flat.length + 1 === n) {
          var acc = ox;
          positions.push(acc);
          flat.forEach(function (lm) { acc += lm * (W / total); positions.push(acc); });
        } else {
          for (var i = 0; i < n; i++) positions.push(ox + (W * i / (n - 1)));
        }
      }
      positions.forEach(function (ux) {
        out += '<circle cx="' + ux.toFixed(1) + '" cy="' + (y + bh / 2).toFixed(1) +
          '" r="3" fill="#e5b100" stroke="#0f0e2a" stroke-width="0.8"/>';
      });
      // Label
      var ly = above ? (y - 4) : (y + bh + 11);
      out += '<text x="' + (ox + W / 2) + '" y="' + ly +
        '" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#26215C" text-anchor="middle">' +
        (bar.label || "") + '</text>';
      return out;
    }
    var overlays = "";
    if (topBar)  overlays += drawBar(oy - 10, 6, topBar, true);
    if (footBar) overlays += drawBar(oy + H + 6, 6, footBar, false);

    return '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" xmlns="http://www.w3.org/2000/svg">' +
      cells + nums + paths + overlays + frame + wLbl + hLbl + axes + '</svg>';
  }

  // ===========================================================================
  // PDF - TEMP BLOCK. Keep the scaffolding; reformat + re-enable when ready.
  // ===========================================================================
  var PDF_ENABLED = false;

  // Placeholder that mirrors stage-designer's buildPdf() signature. When
  // re-enabling: copy the loadJsPdf() + branding-logo + jsPDF layout from
  // stage-designer.js, adapt to the wall front-elevation, and flip PDF_ENABLED.
  function buildVideowallPdf(/* snapshot, branding */) {
    return Promise.reject(new Error("PDF generation temporarily disabled"));
  }

  // ===========================================================================
  // NODE EXPORT (no-op in the browser)
  // ===========================================================================
  if (typeof module !== "undefined" && module.exports) {
    module.exports = {
      computeKit: computeKit, buildWallSvg: buildWallSvg,
      flownRig: flownRig, ground26Kit: ground26Kit, ground39Kit: ground39Kit,
      computeSpares: computeSpares,
      // v0.11.0 ballast
      ballastFor: ballastFor, BALLAST: BALLAST, GROUND_MIN_H: GROUND_MIN_H,
      // v0.12.0 catalogue
      PARTS: PARTS, TOOL_VERSION: TOOL_VERSION,
      // v0.14.0 cabling
      cablesForWall: cablesForWall, rowTopFromFloor: rowTopFromFloor, pickCableStock: pickCableStock,
      // v0.18.0 Uniview upright rule
      univiewUprightCount: univiewUprightCount, univiewUprightPositions: univiewUprightPositions,
      // v0.9.0 port mapping / v0.10.0 processors + redundancy
      mapPorts: mapPorts, bandwidthPct: bandwidthPct, allocatePorts: allocatePorts,
      bitDepthsFor: bitDepthsFor, BANDWIDTH: BANDWIDTH, PORT_CAPACITY: PORT_CAPACITY,
      processorPorts: processorPorts, BACKUP_MODES: BACKUP_MODES
    };
  }

  // ===========================================================================
  // BROWSER: dialog + registration
  // ===========================================================================
  if (typeof window === "undefined") return;

  // ===========================================================================
  // HireHop insertion machinery (adapted from stage-designer.js's addStageKit).
  // Adds a top-level Grouped heading with sub-headings (Screen / Spares /
  // Rigging), resolves each part number to a stock item, batch-saves resolved
  // items under each sub-heading, and falls back to a custom "[code] label"
  // line for anything HireHop doesn't recognise (e.g. LSU-CONNB-L150 until it
  // gets a real YW code).
  // ===========================================================================

  var RESOLVE_MAX_TRIES        = 3;
  var RESOLVE_RETRY_MS         = 800;
  var HEADING_SETTLE_MS        = 3000;
  var HEADING_MAX_RETRIES      = 2;
  var HEADING_RETRY_BACKOFF_MS = 9000;
  var HEADING_TIMEOUT_MS       = 20000;
  var CUSTOM_ROW_GAP_MS        = 3000;
  // Sub-heading order in HireHop. "Spares" is always created empty for now -
  // a placeholder for manual entry until spare-count logic is designed.
  // Processor + Cable intentionally omitted this release.
  var INSERT_ORDER  = ["Screen", "Spares", "Processor", "Rigging", "Cable"];
  var ALWAYS_CREATE = { Spares: true };

  function resolvePart(inst, partNumber, qty) {
    return resolvePartAttempt(inst, partNumber, qty, 0, null);
  }
  function resolvePartAttempt(inst, partNumber, qty, tries, lastReply) {
    if (tries >= RESOLVE_MAX_TRIES) return Promise.resolve(lastReply || { error: -1 });
    var params = {
      id: "vw_" + Date.now() + "_" + Math.random().toString(36).slice(2),
      qty: qty, part_number: partNumber,
      job_id: inst.options.doc_type == 1 ? inst.options.main_id : 0,
      package_id: 0, no_availability: 0,
      price_group: parseInt(inst.options.job_data.PRICE_GROUP) || 0
    };
    var qs = Object.keys(params).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch("/php_functions/items_get_part_number_details.php?" + qs)
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (d) {
        if (!d || typeof d.error !== "undefined") {
          if (tries + 1 < RESOLVE_MAX_TRIES) {
            return new Promise(function (res) { setTimeout(function () { res(resolvePartAttempt(inst, partNumber, qty, tries + 1, d)); }, RESOLVE_RETRY_MS); });
          }
          try { console.warn("[videowall-creator] resolve failed for", partNumber, "-> custom fallback"); } catch (e) { }
          return d;
        }
        return d;
      })
      .catch(function (err) {
        if (tries + 1 < RESOLVE_MAX_TRIES) {
          return new Promise(function (res) { setTimeout(function () { res(resolvePartAttempt(inst, partNumber, qty, tries + 1, { error: -2 })); }, RESOLVE_RETRY_MS); });
        }
        try { console.warn("[videowall-creator] resolve error for", partNumber, err && err.message); } catch (e) { }
        return { error: -2 };
      });
  }

  function headingIdSet(inst) {
    var ids = {}, tree = inst.items_to_supply_tree.jstree(true);
    (tree.get_json("#", { flat: true }) || []).forEach(function (n) { if (n.data && n.data.kind == 0) ids[n.data.ID] = true; });
    return ids;
  }

  function findVisibleErrorDialog() {
    return Array.prototype.slice.call(document.querySelectorAll(".ui-dialog")).filter(function (d) {
      if (d.offsetParent === null) return false;
      var t = d.querySelector(".ui-dialog-title") || {};
      return /error/i.test(t.textContent || "");
    })[0];
  }
  function closeErrorDialog(d) {
    if (!d) return;
    var btn = Array.prototype.slice.call(d.querySelectorAll(".ui-dialog-buttonpane button")).filter(function (b) { return /close|ok/i.test(b.textContent.trim()); })[0];
    if (btn) btn.click(); else { var x = d.querySelector(".ui-dialog-titlebar-close"); if (x) x.click(); }
  }

  function findAutopullDialog() {
    return Array.prototype.slice.call(document.querySelectorAll(".ui-dialog")).filter(function (d) {
      return d.offsetParent !== null && /autopull/i.test((d.querySelector(".ui-dialog-title") || {}).textContent || "");
    })[0];
  }
  function dismissAutopullThen(cb) {
    var tries = 0, dismissed = false;
    var iv = setInterval(function () {
      tries++;
      var d = findAutopullDialog();
      if (d) {
        var btns = Array.prototype.slice.call(d.querySelectorAll(".ui-dialog-buttonpane button"));
        var save = btns.filter(function (b) { return /save|ok|yes/i.test(b.textContent.trim()); })[0] || btns[0];
        if (save) { save.click(); dismissed = true; }
      }
      if ((dismissed && !findAutopullDialog()) || tries > 30) { clearInterval(iv); setTimeout(cb, 3000); }
    }, 200);
  }

  function clickSupplyingRefresh(inst) {
    try {
      var root = (inst && inst.element && inst.element[0]) || document;
      var sels = [
        "a[title='Refresh' i]", "button[title='Refresh' i]",
        "[title*='refresh' i]",
        ".ui-icon-refresh", ".ui-icon-arrowrefresh-1-w",
        ".ui-icon-arrowrefresh-1-e", ".ui-icon-arrowrefresh-1-s"
      ];
      for (var i = 0; i < sels.length; i++) {
        var el = root.querySelector(sels[i]);
        if (el) {
          var btn = el.closest && (el.closest("button, a, li, .ui-button, [role='button']") || el);
          (btn || el).click();
          return;
        }
      }
    } catch (e) { /* refresh is best-effort */ }
  }

  function createHeading(inst, title, parentHeadingId, flag) {
    return createHeadingAttempt(inst, title, parentHeadingId, flag, 0);
  }
  function createHeadingAttempt(inst, title, parentHeadingId, flag, attempt) {
    var before = headingIdSet(inst);
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all();
    if (parentHeadingId) {
      tree.select_node("a" + parentHeadingId);
      try { inst.set_item_edit_tree_headings(); } catch (e) { }
    }
    inst.new_item(0);
    inst.heading_name.val(title);
    if (typeof flag === "number" && inst.item_edit_flag) inst.item_edit_flag.val(flag);
    inst.save_item();
    return new Promise(function (resolve) {
      var start = Date.now();
      var iv = setInterval(function () {
        var now = headingIdSet(inst);
        var newId = Object.keys(now).filter(function (id) { return !before[id]; })[0];
        if (newId) { clearInterval(iv); setTimeout(function () { resolve(parseInt(newId)); }, HEADING_SETTLE_MS); return; }
        var errDlg = findVisibleErrorDialog();
        if (errDlg && attempt < HEADING_MAX_RETRIES) {
          clearInterval(iv);
          closeErrorDialog(errDlg);
          try { if (inst.item_edit_dlg && inst.item_edit_dlg.dialog("isOpen")) inst.item_edit_dlg.dialog("close"); } catch (e) { }
          setTimeout(function () {
            createHeadingAttempt(inst, title, parentHeadingId, flag, attempt + 1).then(resolve);
          }, HEADING_RETRY_BACKOFF_MS);
          return;
        }
        if (Date.now() - start > HEADING_TIMEOUT_MS) {
          clearInterval(iv);
          if (attempt < HEADING_MAX_RETRIES) {
            try { if (inst.item_edit_dlg && inst.item_edit_dlg.dialog("isOpen")) inst.item_edit_dlg.dialog("close"); } catch (e) { }
            setTimeout(function () {
              createHeadingAttempt(inst, title, parentHeadingId, flag, attempt + 1).then(resolve);
            }, HEADING_RETRY_BACKOFF_MS);
          } else resolve(null);
        }
      }, 200);
    });
  }

  function selectedParentHeadingId(inst) {
    try {
      var tree = inst.items_to_supply_tree.jstree(true);
      var sel = tree.get_selected(true);
      if (!sel || !sel.length) return null;
      var n = sel[0];
      while (n && n.data) {
        if (n.data.kind === 0) return n.data.ID;
        if (!n.parent || n.parent === "#") return null;
        n = tree.get_node(n.parent);
      }
    } catch (e) { }
    return null;
  }

  function insertCustoms(inst, headingId, customs, done) {
    var tree = inst.items_to_supply_tree.jstree(true), i = 0;
    (function next() {
      if (i >= customs.length) { done(); return; }
      var it = customs[i++];
      try {
        tree.deselect_all(); tree.select_node("a" + headingId);
        inst.new_item(3);
        inst.custom_name.val("[" + it.partNumber + "] " + it.label);
        inst.priced_edit.find("[name='qty']").val(it.qty).trigger("change");
        inst.save_item();
      } catch (e) { try { console.warn("[videowall-creator] custom row failed:", it.partNumber, e && e.message); } catch (x) { } }
      setTimeout(next, CUSTOM_ROW_GAP_MS);
    })();
  }

  function groupByCategory(items) {
    var groups = {};
    items.forEach(function (it) {
      var cat = it.category || "Other";
      (groups[cat] = groups[cat] || []).push(it);
    });
    return groups;
  }

  function resolveAllByCategory(inst, groups) {
    var shoppingByCat = {}, customsByCat = {};
    INSERT_ORDER.forEach(function (c) { shoppingByCat[c] = {}; customsByCat[c] = []; });
    var chain = Promise.resolve();
    INSERT_ORDER.forEach(function (cat) {
      (groups[cat] || []).forEach(function (it) {
        chain = chain.then(function () {
          return resolvePart(inst, it.partNumber, it.qty).then(function (d) {
            if (!d || typeof d.error !== "undefined") customsByCat[cat].push(it);
            else { var key = (d.TYPE == 1 ? "a" : "b") + d.ID; shoppingByCat[cat][key] = (shoppingByCat[cat][key] || 0) + it.qty; }
          }, function () { customsByCat[cat].push(it); });
        });
      });
    });
    return chain.then(function () { return { shoppingByCat: shoppingByCat, customsByCat: customsByCat }; });
  }

  function insertOneCategory(inst, subHeadingId, shopping, customs, done) {
    inst.set_item_edit_tree_headings();
    var tree = inst.items_to_supply_tree.jstree(true);
    tree.deselect_all(); tree.select_node("a" + subHeadingId); inst.set_parent_vals(true);
    function doCustoms() {
      var t = inst.items_to_supply_tree.jstree(true);
      t.deselect_all(); t.select_node("a" + subHeadingId); inst.set_parent_vals(true);
      insertCustoms(inst, subHeadingId, customs, done);
    }
    if (Object.keys(shopping).length && inst.picklist_heading.val() == subHeadingId) {
      inst.save_items_list(shopping);
      // Videowall kits don't trigger HireHop's Autopull dialog the way stage's
      // Deck bolts do, but we still give it a beat before starting customs.
      setTimeout(doCustoms, 3500);
    } else {
      doCustoms();
    }
  }

  // ---- Post-insert: apply HireHop's "100% applied" state (price = 0) to a
  // set of freshly-inserted stock lines. Called for the Spares sub-heading
  // after its batch save has settled. Best-effort: logs and continues on any
  // per-line failure so a bad row doesn't strand the rest of the kit.
  function lineIdsUnder(inst, headingId) {
    try {
      var tree = inst.items_to_supply_tree.jstree(true);
      var node = tree.get_node("a" + headingId);
      if (!node || !node.children) return {};
      var ids = {};
      node.children.forEach(function (cid) {
        var kid = tree.get_node(cid);
        if (kid && kid.data && kid.data.kind !== 0 && kid.data.ID != null) {
          ids[kid.data.ID] = kid;
        }
      });
      return ids;
    } catch (e) { return {}; }
  }

  function saveLineHundredPercent(inst, lineNode) {
    var d = (lineNode && lineNode.data) || {};
    // Reconstruct enough of the items_save.php payload to preserve the line
    // while dropping the price to 0. Field set matches the payload Adam
    // captured (kind=2 stock line). Anything we don't have goes to defaults
    // that match a fresh HireHop insert.
    var payload = {
      id:               d.ID,
      kind:             (d.kind != null) ? d.kind : 2,
      job:              (inst.options && inst.options.main_id) || 0,
      parent:           d.parent || 0,
      list_id:          d.list_id || 0,
      qty:              d.qty || 1,
      unit_price:       (d.unit_price != null) ? d.unit_price : 0,
      price:            0,
      price_type:       (d.price_type != null) ? d.price_type : 2,
      flag:             0,
      priority_confirm: 0,
      weight:           d.weight || 0,
      vat_rate:         d.vat_rate || 0,
      value:            0,
      acc_nominal:      d.acc_nominal || 17,
      acc_nominal_po:   d.acc_nominal_po || 27,
      cost_price:       d.cost_price || 0,
      country_origin:   "",
      hs_code:          "",
      memo:             "",
      no_availability:  0,
      ignore:           0,
      name:             "",
      add:              "",
      cust_add:         "",
      outgoing:         "",
      returning:        "",
      start:            "",
      end:              "",
      local:            new Date().toISOString().slice(0, 19).replace("T", "+")
    };
    var body = Object.keys(payload).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(payload[k]);
    }).join("&");
    return fetch("/php_functions/items_save.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body,
      credentials: "same-origin"
    })
      .then(function (r) { return r.text().then(function (t) { return { ok: r.ok, status: r.status, body: t }; }); })
      .then(function (r) {
        if (!r.ok) { try { console.warn("[videowall-creator] items_save.php HTTP", r.status, "for line", d.ID); } catch (e) { } }
        return r;
      })
      .catch(function (err) {
        try { console.warn("[videowall-creator] items_save.php error for line", d.ID, err && err.message); } catch (e) { }
        return { ok: false, error: err };
      });
  }

  var DISCOUNT_GAP_MS = 800; // gentle spacing between line edits
  function applyHundredPercentToChildren(inst, headingId, before, done) {
    var after = lineIdsUnder(inst, headingId);
    var newIds = Object.keys(after).filter(function (id) { return !before[id]; });
    if (!newIds.length) { done(); return; }
    var i = 0;
    (function next() {
      if (i >= newIds.length) { done(); return; }
      var node = after[newIds[i++]];
      saveLineHundredPercent(inst, node).then(function () {
        setTimeout(next, DISCOUNT_GAP_MS);
      });
    })();
  }

  // onProgress (optional) is called with {phase, category, doneItems, totalItems}
  // so the dialog can drive a spinner + progress bar, same contract as
  // stage-designer's addStageKit.
  function addVideowallKit(inst, items, title, onDone, onProgress) {
    var groups = groupByCategory(items);
    var parentId = selectedParentHeadingId(inst);
    // Total line count across every category - the denominator for the bar.
    var totalItems = items.length;
    var doneItems = 0;
    function report(phase, category) {
      if (typeof onProgress !== "function") return;
      try { onProgress({ phase: phase, category: category, doneItems: doneItems, totalItems: totalItems }); }
      catch (e) { /* a broken progress callback must never strand the insert */ }
    }
    report("resolving");
    resolveAllByCategory(inst, groups).then(function (res) {
      report("wall-folder");
      createHeading(inst, title, parentId, 5 /* Grouped */).then(function (mainId) {
        if (!mainId) { onDone({ ok: false, error: "Could not create the videowall folder" }); return; }
        var i = 0, parts = 0, customs = 0;
        function nextCategory() {
          if (i >= INSERT_ORDER.length) {
            report("finalising");
            dismissAutopullThen(function () {
              clickSupplyingRefresh(inst);
              onDone({ ok: true, headingId: mainId, parts: parts, customs: customs });
            });
            return;
          }
          var cat = INSERT_ORDER[i++];
          var shopping = res.shoppingByCat[cat] || {}, customList = res.customsByCat[cat] || [];
          var hasContent = Object.keys(shopping).length || customList.length;
          if (!hasContent && !ALWAYS_CREATE[cat]) { nextCategory(); return; }
          report("subheading", cat);
          createHeading(inst, cat, mainId).then(function (subId) {
            if (!subId) { console.warn("[videowall-creator] sub-heading failed:", cat); nextCategory(); return; }
            parts += Object.keys(shopping).length;
            customs += customList.length;
            if (!hasContent) { nextCategory(); return; }
            doneItems += Object.keys(shopping).length + customList.length;
            report("item", cat);
            // For Spares, snapshot existing line IDs so we can identify the
            // freshly-created ones and force their price to 0 afterwards.
            var isSpares = (cat === "Spares");
            var beforeIds = isSpares ? lineIdsUnder(inst, subId) : null;
            insertOneCategory(inst, subId, shopping, customList, function () {
              if (isSpares) applyHundredPercentToChildren(inst, subId, beforeIds, nextCategory);
              else nextCategory();
            });
          });
        }
        nextCategory();
      });
    });
  }

  // ===========================================================================
  // CATALOGUE LOADING (v0.12.0)
  // ===========================================================================
  // Mirrors stage-designer: fetch the part data from jsDelivr at dialog-open
  // time and overwrite the inline defaults. A part number change is then a pure
  // data edit on data/videowall-creator/*.json - no code release, no tag, no
  // loader re-pin. Every file is individually optional; a failed fetch leaves
  // that section on its inline default rather than breaking the tool.
  var REPO = "AdamYesEvents/HH-YES-Plugins";
  var DATA_REF = "main";
  var DATA_BASE = "https://cdn.jsdelivr.net/gh/" + REPO + "@" + DATA_REF + "/data/videowall-creator/";
  var catalogueLoaded = false;

  function getJson(file) {
    // Cache-bust: jsDelivr edge-caches @main, so a unique query fetches current data.
    return fetch(DATA_BASE + file + "?t=" + Date.now()).then(function (r) {
      if (!r.ok) throw new Error(file + " " + r.status);
      return r.json();
    });
  }

  // Shallow-merge a fetched section over the inline default, one level deep per
  // leaf object, so a JSON file that only overrides one part number keeps the
  // rest of the defaults.
  function mergeInto(target, src) {
    if (!src || typeof src !== "object") return target;
    Object.keys(src).forEach(function (k) {
      if (k.charAt(0) === "_") return;                 // _comment / _note keys
      var v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v) &&
          target[k] && typeof target[k] === "object" && !Array.isArray(target[k])) {
        mergeInto(target[k], v);
      } else {
        target[k] = v;
      }
    });
    return target;
  }

  function loadCatalogue(cb) {
    if (catalogueLoaded || typeof fetch !== "function") { cb(); return; }
    Promise.all([
      getJson("parts.json").catch(function () { return null; }),
      getJson("ballast.json").catch(function () { return null; }),
      getJson("bandwidth.json").catch(function () { return null; })
    ]).then(function (res) {
      if (res[0]) mergeInto(PARTS, res[0]);
      if (res[1]) {
        if (res[1].table) BALLAST = res[1].table;
        if (res[1].minHeight) mergeInto(GROUND_MIN_H, res[1].minHeight);
        if (typeof res[1].maxHeight === "number") BALLAST_MAX_H = res[1].maxHeight;
      }
      if (res[2] && res[2].table) BANDWIDTH = res[2].table;
      catalogueLoaded = true;
      cb();
    }).catch(function () { cb(); });   // never block the dialog on a data failure
  }

  var DIALOG_ID = "hh-videowall-creator-dialog";

  function el(tag, attrs, css) {
    var n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (css) n.style.cssText = css;
    return n;
  }

  function injectSpinStyle() {
    if (document.getElementById("hh-vw-spin-style")) return;
    var s = document.createElement("style"); s.id = "hh-vw-spin-style";
    s.textContent = "@keyframes hh-vw-spin{to{transform:rotate(360deg)}} .hh-vw-spin{display:inline-block;width:20px;height:20px;border:3px solid #ddd;border-top-color:#2563eb;border-radius:50%;animation:hh-vw-spin .8s linear infinite;}";
    document.head.appendChild(s);
  }

  function openDialog(inst) {
    injectSpinStyle();
    var pre = document.getElementById(DIALOG_ID);
    if (pre) pre.parentNode.removeChild(pre);

    var backdrop = el("div", { id: DIALOG_ID }, "position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:100000;display:flex;align-items:center;justify-content:center;font-family:sans-serif;");
    var panel = el("div", null, "background:#fff;border-radius:8px;width:980px;max-width:96vw;max-height:90vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.3);");
    backdrop.appendChild(panel);
    backdrop.addEventListener("click", function (e) { if (e.target === backdrop) close(); });
    function close() { if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop); }

    var head = el("div", null, "padding:18px 22px;border-bottom:1px solid #eee;");
    head.innerHTML =
      '<div style="font-size:18px;font-weight:600;color:#222;">Videowall Creator' +
        '<span style="font-size:10px;font-weight:400;color:#aaa;margin-left:6px;">v' + TOOL_VERSION + '</span></div>' +
      '<div style="font-size:13px;color:#777;margin-top:2px;">Answer the baseline questions and we\'ll build the wall kit for this job.</div>';
    panel.appendChild(head);

    var body = el("div", null, "display:flex;gap:24px;padding:22px;");
    var colPreview  = el("div", null, "flex:1;min-width:320px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;");
    var colKit      = el("div", null, "width:260px;flex-shrink:0;");
    var colControls = el("div", null, "width:240px;flex-shrink:0;");
    body.appendChild(colPreview); body.appendChild(colKit); body.appendChild(colControls);
    panel.appendChild(body);

    function field(label) {
      var w = el("div", null, "margin-bottom:14px;");
      w.innerHTML = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:4px;">' + label + '</div>';
      return w;
    }
    function select(options) {
      var s = el("select", null, "width:100%;padding:8px;font-size:14px;");
      options.forEach(function (o) { var op = el("option"); op.value = o[0]; op.textContent = o[1]; s.appendChild(op); });
      return s;
    }

    // Q0 Pitch
    var pitchWrap = field("Pitch");
    var pitchSel  = select([["2.6mm", "2.6mm (indoor only)"], ["3.9mm", "3.9mm (indoor or outdoor)"]]);
    pitchWrap.appendChild(pitchSel); colControls.appendChild(pitchWrap);

    // Q1 Environment (options depend on pitch)
    var envWrap = field("Environment");
    var envSel  = select([["indoor", "Indoor"], ["outdoor", "Outdoor"]]);
    envWrap.appendChild(envSel); colControls.appendChild(envWrap);

    // Q2 Support
    var supWrap = field("Support");
    var supSel  = select([["ground", "Ground supported"], ["flown", "Flown"]]);
    supWrap.appendChild(supSel); colControls.appendChild(supWrap);

    // Q2.5 Rigging - ONLY for Outdoor + Flown
    var rigWrap = field("Rigging");
    var rigSel  = select([["clamp", "Clamp"], ["sling", "Sling"]]);
    rigWrap.appendChild(rigSel); colControls.appendChild(rigWrap);

    // Q3 W / H (0.5m increments)
    var wWrap = field("Width (m)");
    var wIn = el("input", { type: "number", min: "0.5", step: "0.5" }, "width:100%;padding:8px;font-size:14px;");
    wIn.value = "4"; wWrap.appendChild(wIn); colControls.appendChild(wWrap);

    var hWrap = field("Height (m)");
    var hIn = el("input", { type: "number", min: "1", step: "0.5" }, "width:100%;padding:8px;font-size:14px;");
    hIn.value = "3"; hWrap.appendChild(hIn); colControls.appendChild(hWrap);

    // Q4 Processor location
    var procWrap = field("Processor location");
    var procSel  = select([["behind", "Behind screen"], ["far", "Within 70m distance"]]);
    procWrap.appendChild(procSel); colControls.appendChild(procWrap);

    // Q5 Processor model (Novastar)
    var procModelWrap = field("Processor model");
    var procModelSel  = select([["mx30", "Novastar MX30"], ["mx40pro", "Novastar MX40 Pro"]]);
    procModelWrap.appendChild(procModelSel); colControls.appendChild(procModelWrap);

    // Q6 Refresh rate - drives the per-port bandwidth lookup.
    var refreshWrap = field("Refresh rate");
    var refreshSel  = select([["60", "60 Hz"], ["50", "50 Hz"], ["25", "25 Hz"]]);
    refreshWrap.appendChild(refreshSel); colControls.appendChild(refreshWrap);

    // Q7 Bit depth - options depend on the processor (MX30 is 8/10bit only).
    var bitWrap = field("Bit depth");
    var bitSel  = select([["8", "8 bit"], ["10", "10 bit"], ["12", "12 bit"]]);
    bitWrap.appendChild(bitSel); colControls.appendChild(bitWrap);

    // Q8 Backup - halves the usable ports, so it can change the processor count.
    var bkpWrap = field("Backup");
    var bkpSel  = select([["none", "None"], ["pairs", "Pairs (1&2, 3&4)"], ["offset", "Offset (1&11, 2&12)"]]);
    bkpWrap.appendChild(bkpSel); colControls.appendChild(bkpWrap);

    var kitBox = el("div", null, "font-size:13px;");
    colKit.appendChild(kitBox);

    var foot = el("div", null, "padding:14px 22px;border-top:1px solid #eee;display:flex;justify-content:flex-end;gap:10px;align-items:center;");
    panel.appendChild(foot);

    var state = { result: null, items: [], title: "" };

    // 2.6mm is indoor-only; disable Outdoor and force back to Indoor.
    function syncEnvOptions() {
      var outdoorOpt = Array.prototype.slice.call(envSel.options).filter(function (o) { return o.value === "outdoor"; })[0];
      if (pitchSel.value === "2.6mm") {
        outdoorOpt.disabled = true;
        if (envSel.value === "outdoor") envSel.value = "indoor";
      } else {
        outdoorOpt.disabled = false;
      }
    }

    // Rigging (clamp/sling) only for Chauvet 3.9mm + Flown.
    // Uniview 2.6mm flown is sling-only, so we skip the question.
    function syncRiggingVisibility() {
      rigWrap.style.display = (supSel.value === "flown" && pitchSel.value === "3.9mm") ? "" : "none";
    }

    // The MX30 has no 12bit mode - disable it and fall back to 10bit.
    function syncBitDepthOptions() {
      var allowed = bitDepthsFor(procModelSel.value);
      Array.prototype.slice.call(bitSel.options).forEach(function (o) {
        o.disabled = allowed.indexOf(parseInt(o.value, 10)) < 0;
      });
      if (allowed.indexOf(parseInt(bitSel.value, 10)) < 0) {
        bitSel.value = String(allowed[allowed.length - 1]);
      }
    }

    function render() {
      syncEnvOptions();
      syncRiggingVisibility();
      syncBitDepthOptions();
      var res = computeKit({
        pitch:          pitchSel.value,
        environment:    envSel.value,
        support:        supSel.value,
        rigging:        (supSel.value === "flown" && pitchSel.value === "3.9mm") ? rigSel.value : null,
        width:          parseFloat(wIn.value),
        height:         parseFloat(hIn.value),
        processor:      procSel.value,
        processorModel: procModelSel.value,
        refresh:        parseInt(refreshSel.value, 10),
        bitDepth:       parseInt(bitSel.value, 10),
        backup:         bkpSel.value
      });
      state.result = res;

      if (!res.ok) {
        colPreview.innerHTML = "";
        kitBox.innerHTML = '<div style="color:#b00;font-size:13px;">' + res.error + '</div>';
        renderFooter(false, res.error);
        return;
      }

      // Preview: the wall, colour-coded by data line, plus a per-port load
      // readout so you can see at a glance how hard each port is working.
      var portHtml = '<div style="width:100%;margin-top:12px;font-size:12px;">' +
        '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">' +
        'Cabling &middot; ' + res.portCount + ' line' + (res.portCount === 1 ? '' : 's') + ' from the processor ' +
        '<span style="text-transform:none;letter-spacing:0;">(one per row, left to right)</span></div>';
      res.ports.forEach(function (pt) {
        var col = portColour(pt.port);
        var rowLbl = "row " + (res.rows - pt.row);   // label rows from the bottom up
        var portLbl = (res.processorCount > 1 ? "P" + pt.processor + " " : "") + "port " + pt.primaryPort;
        var bkpLbl  = pt.backupPort ? '<span style="color:#0a7;">+' + pt.backupPort + '</span>' : '';
        portHtml += '<div style="display:flex;align-items:center;gap:8px;padding:2px 0;">' +
          '<span style="width:13px;height:13px;border-radius:3px;background:' + col + ';flex-shrink:0;"></span>' +
          '<span style="width:72px;color:#333;">' + portLbl + '</span>' +
          '<span style="width:26px;font-size:11px;">' + bkpLbl + '</span>' +
          '<span style="width:44px;color:#999;font-size:11px;">' + rowLbl + '</span>' +
          '<span style="width:60px;color:#666;">' + pt.panels.length + ' panel' + (pt.panels.length === 1 ? '' : 's') + '</span>' +
          '<span style="flex:1;height:6px;background:#eee;border-radius:3px;overflow:hidden;min-width:34px;">' +
            '<span style="display:block;height:100%;width:' + Math.min(100, pt.pct) + '%;background:' + col + ';"></span>' +
          '</span>' +
          '<span style="width:36px;text-align:right;color:#111;font-weight:500;">' + pt.pct.toFixed(0) + '%</span>' +
        '</div>';
      });
      portHtml += '<div style="margin-top:8px;font-size:11px;color:#777;">' +
        res.pctFull + '% per 1000x500' + (res.halfPanels ? ', ' + res.pctHalf + '% per 500x500' : '') +
        ' at ' + res.refresh + 'hz ' + res.bitDepth + 'bit &middot; ' + res.totalPct.toFixed(0) + '% total load</div>';
      if (res.portCount > res.minPortsByBandwidth) {
        portHtml += '<div style="margin-top:2px;font-size:11px;color:#777;">' +
          'Bandwidth alone would fit ' + res.minPortsByBandwidth + ' line' + (res.minPortsByBandwidth === 1 ? '' : 's') +
          ' - kept one per row so each row can be tested as it goes up.</div>';
      }
      // Processor / port budget.
      var procName = res.processorModel === "mx40pro" ? "MX40 Pro" : "MX30";
      portHtml += '<div style="margin-top:8px;font-size:12px;color:#333;">' +
        '<b>' + res.processorCount + ' x ' + procName + '</b> ' +
        '<span style="color:#777;">&middot; ' + res.portsPerProcessor + ' usable port' +
        (res.portsPerProcessor === 1 ? '' : 's') + ' each' +
        (res.redundant ? ' (' + res.totalPortsPerProcessor + ' ports, halved for backup)' : '') +
        ' &middot; ' + res.portCount + ' used of ' + (res.processorCount * res.portsPerProcessor) + '</span></div>';
      if (res.upgradeSuggestion) {
        portHtml += '<div style="margin-top:4px;font-size:11px;color:#b07b00;">' + res.upgradeSuggestion + '</div>';
      }
      // Starter-cable summary. Grouped by stock length; flags oversize runs.
      if (res.cables && res.cables.items && res.cables.items.length) {
        portHtml += '<div style="margin-top:8px;font-size:12px;color:#333;">' +
          '<b>Starter cables</b>' +
          (res.redundant ? ' <span style="color:#777;font-size:11px;">(primary + backup, same length rule)</span>' : '') +
          '</div>';
        res.cables.items.forEach(function (it) {
          var isOversize = !it.partNumber;
          portHtml += '<div style="margin-top:2px;font-size:12px;color:' + (isOversize ? '#b07b00' : '#333') + ';">' +
            '<span style="color:#666;font-size:11px;margin-right:6px;">' + (it.partNumber || 'TBD') + '</span>' +
            it.label + ' <span style="color:#111;font-weight:500;">x ' + it.qty + '</span></div>';
        });
        // Per-line breakdown so the crew can trace which line got which cable.
        if (res.cables.perLine && res.cables.perLine.length) {
          portHtml += '<div style="margin-top:4px;font-size:11px;color:#777;">';
          res.cables.perLine.forEach(function (l) {
            var stockLbl = l.stock ? (l.stock.lengthM + 'm') : ('needs ' + l.requiredM.toFixed(1) + 'm - oversize');
            portHtml += 'port ' + l.primaryPort + ': ' + l.requiredM.toFixed(1) + 'm required &rarr; ' + stockLbl +
              (l.isBackupOn ? ' (primary+backup)' : '') + '<br/>';
          });
          portHtml += '</div>';
        }
      }
      portHtml += '</div>';

      // Hardware overlays with coloured bar segments per physical length.
      var svgOpts = { height: res.height, ports: res.ports };
      var pitch = pitchSel.value;
      function barsFromCounts(c15, c2, c1, c05) {
        var out = [];
        if (c2  > 0) out.push({ lengthM: 2.0, count: c2  });
        if (c15 > 0) out.push({ lengthM: 1.5, count: c15 });
        if (c1  > 0) out.push({ lengthM: 1.0, count: c1  });
        if (c05 > 0) out.push({ lengthM: 0.5, count: c05 });
        return out;
      }
      // REM ground bar order (Adam, 2026-08-28): 1.5m bars anchor the OUTSIDE
      // (left + right). Middle fills with 1m bars first, then any middle 1.5m,
      // then any 2m bars. Symmetric where possible.
      function remBarLayout(bars_15, bars_2, bars_1) {
        var out = [];
        var leftAnchor  = bars_15 >= 1 ? 1 : 0;
        var rightAnchor = bars_15 >= 2 ? 1 : 0;
        var middle_15   = bars_15 - leftAnchor - rightAnchor;
        if (leftAnchor) out.push(1.5);
        for (var i = 0; i < bars_1; i++) out.push(1.0);
        for (var j = 0; j < middle_15; j++) out.push(1.5);
        for (var k = 0; k < bars_2; k++) out.push(2.0);
        if (rightAnchor) out.push(1.5);
        return out;
      }
      if (supSel.value === "flown") {
        var f = res.barsFlown || {};
        // Uniview flown: rear-support dots per Adam's Uniview rule (v0.18.0).
        // REM flown: no Adam-specific rule yet - dots fall back to bars+1 seams.
        var topPositions = null;
        var uprightsF;
        if (pitch === "2.6mm") {
          topPositions = univiewUprightPositions(res.width);
          uprightsF = topPositions.length;
        } else {
          uprightsF = (f.bars_1 || 0) + (f.bars_05 || 0) + 1;
        }
        svgOpts.topBar = {
          label: (pitch === "2.6mm" ? "Uniview UR Pro" : "Chauvet REM") +
            " Rigging Bar (" + (pitch === "3.9mm" && rigSel.value === "clamp" ? "clamp" : "sling") + ")",
          bars: barsFromCounts(0, 0, f.bars_1 || 0, f.bars_05 || 0),
          totalM: res.width,
          uprights: uprightsF,
          uprightPositions: topPositions
        };
      } else {
        var uprightsG = res.ballast && res.ballast.uprights;
        if (pitch === "2.6mm") {
          // Uniview ground: bars_1 / bars_05 are ACTUAL bars placed (kit
          // contents include spares that overflow the wall). 0.5m bar goes
          // in the MIDDLE for half-metre widths (Adam v0.19.0). Dots follow
          // Adam's Uniview rule.
          var g26 = res.barsGround26 || {};
          svgOpts.footBar = {
            label: "Uniview UR Pro Ground Support base",
            flatBars: univiewGroundBarLayout(g26.bars_1 || 0, g26.bars_05 || 0),
            totalM: res.width,
            uprightPositions: g26.uprightPositions || null
          };
        } else {
          var g = res.barsGround39 || {};
          svgOpts.footBar = {
            label: "LSU Connecting Bars (bottom)",
            flatBars: remBarLayout(g.bars_15 || 0, g.bars_2 || 0, g.bars_1 || 0),
            totalM: res.width,
            // Explicit positions (Adam 2026-08-28): 0.5m inset + every 1m, plus
            // a tight 0.5m gap on the half-metre side of half-metre widths.
            uprightPositions: g.uprightPositions || null
          };
        }
      }
      // Legend: colour swatches for every distinct length actually in use.
      var lenSet = {};
      if (svgOpts.topBar && svgOpts.topBar.bars)  svgOpts.topBar.bars.forEach(function (b)  { lenSet[b.lengthM.toFixed(1)] = 1; });
      if (svgOpts.footBar && svgOpts.footBar.bars) svgOpts.footBar.bars.forEach(function (b) { lenSet[b.lengthM.toFixed(1)] = 1; });
      if (svgOpts.footBar && svgOpts.footBar.flatBars) svgOpts.footBar.flatBars.forEach(function (m) { lenSet[m.toFixed(1)] = 1; });
      var lens = Object.keys(lenSet).sort();
      var legend = "";
      if (lens.length) {
        legend = '<div style="margin-top:4px;font-size:11px;color:#777;display:flex;gap:12px;flex-wrap:wrap;">';
        lens.forEach(function (lm) {
          legend += '<span style="display:inline-flex;align-items:center;gap:4px;">' +
            '<span style="width:12px;height:6px;border-radius:2px;background:' + (({"0.5":"#0d9488","1.0":"#2563eb","1.5":"#d97706","2.0":"#7c3aed"})[lm] || "#26215C") + ';"></span>' +
            lm.replace(/\.0$/, "") + 'm</span>';
        });
        legend += '</div>';
      }
      colPreview.innerHTML = buildWallSvg(res.cols, res.rows, svgOpts) + legend + portHtml;

      var byCat = {};
      res.items.forEach(function (it) { (byCat[it.category] = byCat[it.category] || []).push(it); });
      // Display order matches the sub-headings we'll create in HireHop: Screen,
      // Spares (always empty for now - manual add reminder), Rigging.
      var order = ["Screen", "Spares", "Processor", "Rigging", "Cable"];
      var html = '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin-bottom:6px;">Generated kit</div>';
      order.forEach(function (cat) {
        var arr = byCat[cat] || [];
        html += '<div style="font-size:11px;letter-spacing:.04em;color:#888;text-transform:uppercase;margin:10px 0 4px;">' + cat +
          (cat === "Spares" ? ' <span style="color:#0a7;text-transform:none;letter-spacing:0;font-weight:400;">(100% applied)</span>' : '') +
          '</div>';
        if (!arr.length) {
          html += '<div style="font-size:12px;color:#b07b00;padding:3px 0;">Empty sub-heading - add manually per job.</div>';
          return;
        }
        arr.forEach(function (it) {
          var pn = it.partNumber
            ? '<span style="color:#666;font-size:11px;margin-right:6px;">' + it.partNumber + '</span>'
            : '<span style="color:#b07b00;font-size:11px;margin-right:6px;">TBD</span>';
          html += '<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0;gap:8px;align-items:baseline;">' +
            '<span style="color:#333;">' + pn + it.label + '</span>' +
            '<span style="color:#111;font-weight:500;white-space:nowrap;">x ' + it.qty + '</span></div>';
        });
      });
      html += '<div style="margin-top:10px;font-size:12px;color:#777;">' + res.panels + ' panels &middot; ' + res.width + ' &times; ' + res.height + ' m</div>';
      if (res.ballast) {
        html += '<div style="margin-top:6px;font-size:12px;color:#777;">Ballast: <b style="color:#111;">' +
          res.ballast.kgPerUpright + 'kg per upright</b> &times; ' + res.ballast.uprights + ' uprights &middot; ' +
          res.ballast.totalPlates + ' plates (' + res.ballast.totalKg + 'kg)</div>';
        html += '<div style="margin-top:2px;font-size:11px;color:#999;">Table @ ' + res.ballast.lookupH.toFixed(1) +
          'm, ' + res.ballast.moment.toFixed(2) + ' kNm, safety factor 1.5 already applied' +
          (res.ballast.clamped ? ' &middot; clamped up from ' + res.height + 'm' : '') + '</div>';
      }
      kitBox.innerHTML = html;

      var envLabel = envSel.value === "outdoor" ? "Outdoor" : "Indoor";
      var supLabel;
      if (supSel.value === "flown") {
        if (pitchSel.value === "3.9mm") {
          supLabel = "Flown-" + (rigSel.value === "clamp" ? "Clamp" : "Sling");
        } else {
          supLabel = "Flown-Sling";
        }
      } else {
        supLabel = "Ground Supported";
      }
      // Title format follows Adam's shape: "Indoor Videowall 4w x 3h 3.9mm
      // Flown-Sling MX30". Processor model appears at the end so the pick
      // crew sees which processor is in the kit at a glance.
      var procModelLabel = procModelSel.value === "mx40pro" ? "MX40 Pro" : "MX30";
      state.items = res.items;
      state.title = envLabel + " Videowall " + res.width + "w x " + res.height + "h " + pitchSel.value + " " + supLabel + " " + procModelLabel;

      renderFooter(true, "");
    }

    function renderFooter(canAdd, disabledReason) {
      foot.innerHTML = "";
      var cancel = el("button", null, "padding:8px 16px;font-size:14px;cursor:pointer;");
      cancel.textContent = "Close"; cancel.addEventListener("click", close);
      var add = el("button", canAdd ? null : { disabled: "disabled", title: disabledReason },
        "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:" + (canAdd ? "pointer" : "not-allowed") + ";opacity:" + (canAdd ? "1" : ".5") + ";");
      add.textContent = "Add videowall kit";
      if (canAdd) add.addEventListener("click", confirmAdd);
      foot.appendChild(cancel); foot.appendChild(add);
    }

    function confirmAdd() {
      foot.innerHTML = "";
      var msg = el("div", null, "flex:1;font-size:13px;color:#333;");
      msg.textContent = "Add '" + state.title + "' to this job?";
      var no = el("button", null, "padding:8px 14px;font-size:14px;cursor:pointer;");
      no.textContent = "Cancel"; no.addEventListener("click", render);
      var yes = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
      yes.textContent = "Confirm add"; yes.addEventListener("click", doAdd);
      foot.appendChild(msg); foot.appendChild(no); foot.appendChild(yes);
    }

    // Progress footer: spinner + status line + horizontal bar. Driven by
    // addVideowallKit's onProgress callback. Matches stage-designer's footer.
    function progressFoot(p) {
      var label;
      if (p.phase === "resolving")        label = "Looking up part numbers&hellip;";
      else if (p.phase === "wall-folder") label = "Creating videowall folder&hellip;";
      else if (p.phase === "subheading")  label = "Creating sub-heading: " + (p.category || "") + "&hellip;";
      else if (p.phase === "item")        label = "Adding " + (p.category || "") + " (" + p.doneItems + "/" + p.totalItems + ")&hellip;";
      else if (p.phase === "finalising")  label = "Finalising&hellip;";
      else if (p.phase === "catalogue")   label = "Loading part catalogue&hellip;";
      else                                label = "Adding to the job&hellip;";
      var pct = p.totalItems ? Math.min(100, Math.round(100 * p.doneItems / p.totalItems)) : 0;
      foot.innerHTML =
        '<div style="flex:1;display:flex;flex-direction:column;gap:6px;">' +
          '<div style="display:flex;align-items:center;gap:10px;font-size:13px;color:#555;">' +
            '<span class="hh-vw-spin" style="width:16px;height:16px;border-width:2px;"></span>' +
            '<span>' + label + '</span>' +
          '</div>' +
          '<div style="height:6px;background:#eee;border-radius:3px;overflow:hidden;">' +
            '<div style="width:' + pct + '%;height:100%;background:#2563eb;transition:width .2s;"></div>' +
          '</div>' +
        '</div>';
    }

    function doAdd() {
      progressFoot({ phase: "start", doneItems: 0, totalItems: state.items.length });

      addVideowallKit(inst, state.items, state.title, function (r) {
        foot.innerHTML = "";
        var msg = el("div", null, "flex:1;font-size:13px;");
        if (r && r.ok) {
          msg.style.color = "#0a7";
          msg.textContent = "Added '" + state.title + "' - " + r.parts + " resolved item(s), " + r.customs + " custom row(s).";
        } else {
          msg.style.color = "#b00";
          msg.textContent = (r && r.error) ? r.error : "Insert failed - see console for details.";
        }
        var ok = el("button", null, "padding:8px 16px;font-size:14px;background:#2563eb;color:#fff;border:none;border-radius:4px;cursor:pointer;");
        ok.textContent = "Close"; ok.addEventListener("click", close);
        foot.appendChild(msg); foot.appendChild(ok);
      }, progressFoot);

      if (PDF_ENABLED) {
        buildVideowallPdf({ title: state.title, items: state.items, result: state.result }).catch(function () {});
      }
    }

    pitchSel     .addEventListener("change", render);
    envSel       .addEventListener("change", render);
    supSel       .addEventListener("change", render);
    rigSel       .addEventListener("change", render);
    wIn          .addEventListener("input",  render);
    hIn          .addEventListener("input",  render);
    procSel      .addEventListener("change", render);
    procModelSel .addEventListener("change", render);
    refreshSel   .addEventListener("change", render);
    bitSel       .addEventListener("change", render);
    bkpSel       .addEventListener("change", render);

    document.body.appendChild(backdrop);

    // Show a loading bar in the footer while the part catalogue comes down from
    // jsDelivr, then render. loadCatalogue never rejects - on a failed fetch it
    // falls back to the inline defaults - so the dialog always reaches render().
    progressFoot({ phase: "catalogue", doneItems: 0, totalItems: 0 });
    kitBox.innerHTML = '<div style="font-size:12px;color:#888;">Loading part catalogue&hellip;</div>';
    loadCatalogue(function () {
      syncBitDepthOptions();
      render();
    });
  }

  function register() {
    if (!window.HHTools || !window.HHTools.register) { setTimeout(register, 50); return; }
    window.HHTools.register({
      id: "videowall-creator",
      label: "Videowall Creator",
      icon: "ui-icon-image",
      onClick: function (inst) { openDialog(inst); }
    });
  }

  register();

})();
