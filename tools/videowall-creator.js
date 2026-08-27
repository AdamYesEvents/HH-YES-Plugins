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
 * STILL TBD after v0.13.0 (targeted at v0.14.0 - cabling):
 *   - Cabling, primary AND backup. RULE RESOLVED (Adam, 2026-08-27): one cable
 *     per line for both, length = wall width + that line's row height. The
 *     backup lands on the far end of the chain, which is what forces the full
 *     wall width in; the input is spec'd the same way. This SUPERSEDES the older
 *     "REM 5/10/20m by width, Uniview 15m flat" spec.
 *     Still blocked on: the stock cable lengths carried, and their YW part
 *     codes. Computed lengths must round up to a real stock length, and without
 *     codes every cable would drop to a free-text line on every job.
 *
 * PDF generation is TEMPORARILY BLOCKED - see PDF_ENABLED below. When ready,
 * flip the flag on and reformat buildVideowallPdf() to match the final layout
 * (do not delete the scaffolding).
 *
 * Version: 0.13.0
 */

(function () {

  // ===========================================================================
  // PURE LOGIC
  // ===========================================================================

  var EPS = 1e-6;
  function isMult(v, step) { var q = v / step; return Math.abs(q - Math.round(q)) < EPS; }

  var TOOL_VERSION = "0.13.0";  // shown in the dialog header; keep in sync with the banner above.

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

  // 2.6mm indoor ground support - kits (2m bays) with a 0.5m spare per case.
  // Cases needed = max(1, ceil((W - 0.5) / 2)) because each additional case
  // adds 2m of coverage; the very first case's 0.5m spare bridges to 2.5m.
  //   4.0m -> 2 kits (4x 1m)
  //   4.5m -> 2 kits (4x 1m + 1x 0.5m)
  //   5.0m -> 3 kits (5x 1m)
  // Each kit contains 2x 1m + 1x 0.5m bars.
  function ground26Kit(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    var whole = Math.floor(W + EPS);
    var half  = Math.abs(W - whole - 0.5) < EPS ? 1 : 0;
    var kits  = Math.max(1, Math.ceil((W - 0.5 - EPS) / 2));
    return {
      ok: true,
      kits: kits,
      bars_1: whole,
      bars_05: half,
      kitContents: { bars_1: 2 * kits, bars_05: 1 * kits }
    };
  }

  // 3.9mm ground support - primary bays of 1.5m or 2m ONLY. No 1m filler bars.
  // Capped at 6m (Adam, 2026-08-27) - taller / wider rigs need engineering.
  // Achievable widths (0.5m step, 1.5m-6m):
  //   1.5 -> 1 x 1.5
  //   2.0 -> 1 x 2
  //   2.5 -> NOT achievable
  //   3.0 -> 2 x 1.5
  //   3.5 -> 1 x 1.5 + 1 x 2
  //   4.0 -> 2 x 2                (was 2 x 1.5 + 1 x 1)
  //   4.5 -> 3 x 1.5              (was 1 x 1.5 + 1 x 1 + 1 x 2)
  //   5.0 -> 2 x 1.5 + 1 x 2
  //   5.5 -> 1 x 1.5 + 2 x 2      (was 3 x 1.5 + 1 x 1)
  //   6.0 -> 3 x 2                (was 4 x 1.5)
  // Compute LSU sets from total connecting-bar count. Each LSU Set (YW-00169)
  // ships 2 uprights; N bars in a row need N+1 uprights.
  function lsuSets(bars_15, bars_2) {
    var totalBars = (bars_15 || 0) + (bars_2 || 0);
    if (totalBars <= 0) return 0;
    return Math.ceil((totalBars + 1) / 2);
  }

  var GROUND_39_MAX_W = 6.0;

  function ground39Kit(W) {
    if (!(W > 0) || !isMult(W, 0.5)) return { ok: false, error: "Width must be a multiple of 0.5m" };
    if (W < 1.5 - EPS) return { ok: false, error: "3.9mm ground support minimum is 1.5m" };
    if (W > GROUND_39_MAX_W + EPS)
      return { ok: false, error: "3.9mm ground support maxes out at " + GROUND_39_MAX_W + "m" };
    if (Math.abs(W - 2.5) < EPS) return { ok: false, error: "2.5m not achievable in 3.9mm (bar sizes are 1.5m and 2m)" };
    function pack(bars_15, bars_2) {
      return { ok: true, kits: lsuSets(bars_15, bars_2), bars_15: bars_15, bars_2: bars_2, bars_1: 0 };
    }
    var TABLE = {
      "1.5": [1, 0], "2.0": [0, 1], "3.0": [2, 0], "3.5": [1, 1],
      "4.0": [0, 2], "4.5": [3, 0], "5.0": [2, 1], "5.5": [1, 2], "6.0": [0, 3]
    };
    var row = TABLE[W.toFixed(1)];
    if (!row) return { ok: false, error: W + "m not achievable in 3.9mm" };
    return pack(row[0], row[1]);
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

  // Minimum ground-support wall heights (Adam, 2026-08-27): REM 2m, Uniview
  // 1.5m. Uniview's 1.5m sits below the table, so it clamps up to the 2.0m row
  // rather than being extrapolated downwards.
  var GROUND_MIN_H = { uniview: 1.5, rem: 2.0 };

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
      var minH = GROUND_MIN_H[isUniview ? "uniview" : "rem"];
      if (H < minH - EPS)
        return { ok: false, error: (isUniview ? "2.6mm" : "3.9mm") +
          " ground support minimum wall height is " + minH + "m" };

      var uprights;
      var gp = PARTS.ground[fam];
      if (isUniview) {
        var g26 = ground26Kit(W);
        if (!g26.ok) return { ok: false, error: g26.error };
        items.push({ category: "Rigging", label: gp.kit.label, partNumber: gp.kit.pn, qty: g26.kits });
        uprights = 2 * g26.kits;
      } else {
        var g39 = ground39Kit(W);
        if (!g39.ok) return { ok: false, error: g39.error };
        items.push({ category: "Rigging", label: gp.set.label, partNumber: gp.set.pn, qty: g39.kits });
        if (g39.bars_15 > 0) items.push({ category: "Rigging", label: gp.bar15.label, partNumber: gp.bar15.pn, qty: g39.bars_15 });
        if (g39.bars_2  > 0) items.push({ category: "Rigging", label: gp.bar2.label,  partNumber: gp.bar2.pn,  qty: g39.bars_2 });
        uprights = (g39.bars_15 + g39.bars_2) + 1;
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
      ballast: ballast
    };
  }

  // Distinct fills per data line. Cycles past 10 ports; the per-panel port
  // number is the real disambiguator, colour is just the quick read.
  var PORT_COLOURS = [
    "#2563eb", "#0a7d5a", "#b45309", "#7c3aed", "#be123c",
    "#0369a1", "#4d7c0f", "#a21caf", "#c2410c", "#115e59"
  ];
  function portColour(n) { return PORT_COLOURS[(n - 1) % PORT_COLOURS.length]; }

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
    // Panels are 0.5m wide x 1m high in real units; scale so the wall fits the box.
    var wPx = (maxW - pad * 2) / (cols * 0.5);
    var hPx = (maxH - pad * 2 - extraTop - extraFoot) / height;
    var unit = Math.max(6, Math.min(wPx, hPx));             // px per metre
    var panelW = 0.5 * unit, panelH = 1.0 * unit;
    var W = panelW * cols, H = unit * height;
    var SW = W + pad * 2, SH = H + pad * 2 + extraTop + extraFoot;
    var ox = pad, oy = pad + extraTop;
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

    // Hardware overlays (v0.13.0). Top rigging bar for flown walls; base/foot bar
    // for ground walls (both systems). Drawn as a dark bar with an inline label
    // so the crew sees at a glance what runs above / below the panels.
    var overlays = "";
    if (topBar) {
      var tby = oy - 10, tbh = 6;
      overlays += '<rect x="' + (ox - 4) + '" y="' + tby + '" width="' + (W + 8) + '" height="' + tbh +
        '" rx="2" fill="#26215C" stroke="#0f0e2a" stroke-width="1"/>';
      overlays += '<text x="' + (ox + W / 2) + '" y="' + (tby - 4) +
        '" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#26215C" text-anchor="middle">' +
        (topBar.label || "Rigging bar") + '</text>';
    }
    if (footBar) {
      var fby = oy + H + 6, fbh = 6;
      overlays += '<rect x="' + (ox - 4) + '" y="' + fby + '" width="' + (W + 8) + '" height="' + fbh +
        '" rx="2" fill="#26215C" stroke="#0f0e2a" stroke-width="1"/>';
      // Upright dots on the base bar - one per erected upright, evenly spaced.
      if (footBar.uprights && footBar.uprights > 1) {
        var n = footBar.uprights;
        for (var u = 0; u < n; u++) {
          var ux = ox + (W * u / (n - 1));
          overlays += '<circle cx="' + ux.toFixed(1) + '" cy="' + (fby + fbh / 2).toFixed(1) +
            '" r="3" fill="#e5b100" stroke="#0f0e2a" stroke-width="0.8"/>';
        }
      }
      overlays += '<text x="' + (ox + W / 2) + '" y="' + (fby + fbh + 11) +
        '" font-family="Arial,Helvetica,sans-serif" font-size="10" fill="#26215C" text-anchor="middle">' +
        (footBar.label || "Base bar") + '</text>';
    }

    return '<svg width="' + SW + '" height="' + SH + '" viewBox="0 0 ' + SW + ' ' + SH + '" xmlns="http://www.w3.org/2000/svg">' +
      cells + nums + paths + overlays + frame + wLbl + hLbl + '</svg>';
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
  var INSERT_ORDER  = ["Screen", "Spares", "Processor", "Rigging"];
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
      portHtml += '<div style="margin-top:4px;font-size:11px;color:#b07b00;">Starter cables not in the kit yet (v0.10.0).</div>';
      portHtml += '</div>';

      // Hardware overlays: flown -> top rigging bar; ground -> base bar (with
      // dots for each erected upright on both systems).
      var svgOpts = { height: res.height, ports: res.ports };
      if (supSel.value === "flown") {
        svgOpts.topBar = { label: (pitchSel.value === "2.6mm" ? "Uniview UR Pro" : "Chauvet REM") +
          " Rigging Bar (" + (pitchSel.value === "3.9mm" && rigSel.value === "clamp" ? "clamp" : "sling") + ")" };
      } else {
        var uprights = res.ballast && res.ballast.uprights;
        var baseLabel = (pitchSel.value === "2.6mm")
          ? "Uniview UR Pro Ground Support base"
          : "LSU Connecting Bars (bottom)";
        svgOpts.footBar = { label: baseLabel, uprights: uprights };
      }
      colPreview.innerHTML = buildWallSvg(res.cols, res.rows, svgOpts) + portHtml;

      var byCat = {};
      res.items.forEach(function (it) { (byCat[it.category] = byCat[it.category] || []).push(it); });
      // Display order matches the sub-headings we'll create in HireHop: Screen,
      // Spares (always empty for now - manual add reminder), Rigging.
      var order = ["Screen", "Spares", "Processor", "Rigging"];
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
      html += '<div style="margin-top:6px;font-size:11px;color:#b07b00;">Cable sub-heading deferred (starter cables still TBD).</div>';
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
