# Videowall Creator + Stage Designer — session context / handover

**Written:** 2026-08-25
**Purpose:** durable backup of everything established about these two HireHop plugins,
so a lost session can be resumed from this file alone.

---

## 1. Where the code lives

| Thing | Location |
|---|---|
| GitHub repo | `AdamYesEvents/HH-YES-Plugins` (**public**) |
| Local clone | `C:\temp\hh-repo` |
| Clone state | clean, level with `origin/main` @ `0664b82` (27 Aug 2026) |
| This docs folder | `C:\Claude Code\Videowall Designer` |
| Sibling project folders | `C:\Claude Code\Mendo`, `C:\Claude Code\Org Chart` |

The other repo on the account, **`AdamYesEvents/HH-Workshop`** (private), is the separate
Mendo workshop / SvelteKit + Prisma app. It has **nothing** to do with these plugins —
don't go looking for videowall code in there.

Repo stats: 220 commits, 196 tags. Both tools are versioned independently of the loader.

---

## 2. Repo structure — loader + tools

```
HH-YES-Plugins/
├── loader.js                        v0.1.91  — BOTH tools
├── loader-stage-designer.js         v0.1.91  — Stage Designer ONLY
├── README.md
├── tools/
│   ├── stage-designer.js            v0.31.15  (1620 lines)
│   ├── videowall-creator.js         v0.8.0    (898 lines)
│   └── scanning-colour-swatch.js    (NOT wired into loader TOOLS block)
├── data/stage-designer/
│   ├── decks.json  legs.json  carpet.json  fascia.json
│   ├── trim.json   treads.json  branding.json  accessories.json
└── docs/
    ├── stage-designer-spec.md
    └── scanning-colour-swatch-spec.md
```

### How the loader works

`loader.js` is the single URL pasted into **HireHop → Settings → Company Settings → Plugins**:

```
https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@v0.1.96/loader.js
```

It waits for jQuery, script-injects each enabled tool from jsDelivr, then runs a 1s
idempotent interval that injects a separator + one `<li>` per registered tool into the
Supplying tab's two New menus:

- `inst.new_item_popup_menu` — top-left **New (+)** button dropdown
- `inst.new_menu` — the **New** submenu inside the right-click `popup_menu`

Tools self-register via `window.HHTools.register({ id, label, icon, onClick(inst) })`.
The interval approach is used because hooking the widget init is racy against the lazy
creation / re-render of the Supplying tab.

`loader-stage-designer.js` is a byte-identical loader that ships only Stage Designer —
for a HireHop instance that should not receive the video tool.

### Current pins (in `loader.js` TOOLS block)

```js
var TOOLS = {
  "stage-designer":    { on: true, ref: "1c051bfd5f997759eff4f49d204a1761f919de52" },
  "videowall-creator": { on: true, ref: "videowall-creator-v0.12.0" }
};
```

### ⚠️ Push before assuming anything is live (learned 2026-08-27)

Videowall v0.9.0 → v0.10.0 were committed **and tagged locally but never pushed**, so for
days the published tool was still v0.8.0 while the local repo looked finished. Symptom: Adam
reported the refresh-rate and backup questions were missing from the popup — they were in
the code, just never on jsDelivr. Tags don't publish themselves.

**After any release, verify the CDN, don't trust the local log:**

```bash
cd "C:\temp\hh-repo" && git log --oneline origin/main..HEAD   # must be empty
```

```bash
curl -s "https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@main/loader.js" | grep videowall-creator
```

⚠️ **Inconsistency to tidy:** stage-designer is pinned to a raw **commit SHA** even
though the tag `stage-designer-v0.31.15` exists and points at the same commit. Videowall
is pinned by tag. Make them both tags.

**Note on the loader version:** the loader is at v0.1.91 and climbing fast, but that is
almost entirely **stage-designer churn** — every stage-designer release requires a re-pin
and therefore a new loader version. The loader number is effectively a stage-designer
changelog and says nothing about the state of the videowall tool (which has only cut 8
releases). Don't read a high loader version as videowall progress. Expect the loader to
keep drifting past whatever number is recorded here.

### jsDelivr rules (important, learned the hard way)

- **Never** use `raw.githubusercontent.com` — it serves `text/plain` + `X-Content-Type-Options: nosniff`,
  so browsers silently refuse to execute it. jsDelivr serves `application/javascript`.
- Tags are immutable and served instantly. `@main` is cached ~7 days and **ignores `?v=`**
  query strings. To refresh a `main` ref quickly:
  `https://purge.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@main/tools/<tool>.js`
- Plugins only load on paid HireHop accounts, and **not** on the Settings page.
- `?no_plugins=1` on any HireHop URL disables plugins for debugging.
- Never put API tokens in plugin JS — it runs in the browser and is public.
- HireHop's minified JS is readable by appending `.MAX`: `https://myhirehop.com/js/items.MAX.js`.
  The Supplying tab is the **items** widget (`$.custom.items`), not a "supplying" widget.

---

## 3. Videowall Creator — v0.8.0

File: `tools/videowall-creator.js`. Architecture deliberately mirrors stage-designer:
pure logic at the top (Node-exported for tests), then browser dialog + HireHop insertion.

### The wizard questions

| Q | Field | Options / notes |
|---|---|---|
| Q0 | Pitch | 2.6mm Uniview UR Pro (**indoor only**) / 3.9mm Chauvet REM |
| Q1 | Environment | Indoor / Outdoor — Outdoor auto-disabled + forced back to Indoor when 2.6mm |
| Q2 | Support | Flown / Ground supported |
| Q2.5 | Rigging | Clamp / Sling — **only shown for Chauvet 3.9mm + Flown**. Uniview flown is sling-only so the question is hidden |
| Q3 | Width, Height | metres, 0.5m increments |
| Q4 | Processor location | Behind screen / Within 70m — **currently inert**, collected but affects nothing |
| Q5 | Processor model | Novastar MX30 (YW-04071) / MX40 Pro (YW-00347) |

### Panel geometry

Panels are 500mm wide in two heights (1000h and 500h).

```
cols       = W / 0.5
fullPerCol = floor(H)                       // 1000h panels
halfPerCol = 1 if H has a 0.5 remainder     // 500h panel, sits on the TOP row
rows       = fullPerCol + halfPerCol
fullPanels = cols * fullPerCol
halfPanels = cols * halfPerCol
```

e.g. a 1.5m column = 1× 1000h + 1× 500h; a 2.5m column = 2× 1000h + 1× 500h.
`buildWallSvg()` draws the front elevation and renders the **top** row at half height
when there's a 0.5m remainder.

### Part numbers wired in

**Panels**

| | 1000×500 | 500×500 |
|---|---|---|
| 3.9mm Chauvet REM | `YW-00341` | `YW-00342` |
| 2.6mm Uniview UR Pro | `YW-04066` | `YW-04067` |

**Flown rigging** — `flownRig(W)`: prefer 1m bars, allow one 0.5m add-on.
4.0m → 4×1m; 4.5m → 4×1m + 1×0.5m; 5.0m → 5×1m.

| | 1m | 0.5m |
|---|---|---|
| Chauvet Header Bar on **Clamp** | `YW-00343` | `YW-00345` (curve) |
| Chauvet Header Bar on **Sling** | `YW-00344` | `YW-00346` (curve) |
| Uniview Rigging Bar (sling only) | `YW-04068` | `YW-04069` |

**Ground support — 2.6mm Uniview**, `ground26Kit(W)`: kits cover 2m bays with a 0.5m
spare per case. `kits = max(1, ceil((W - 0.5) / 2))` — the first case's 0.5m spare bridges
to 2.5m. 4.0m → 2 kits; 4.5m → 2 kits; 5.0m → 3 kits. Each kit = 2× 1m + 1× 0.5m bars.
Part: `YW-04065` Ground Support Kit (2 uprights).

**Ground support — 3.9mm Chauvet**, `ground39Kit(W)`: bays of 1.5m or 2m plus one
optional 1m filler.

```
1.5 -> 1 x 1.5          4.5 -> 1 x 1.5 + 1 x 1 + 1 x 2   (SPECIAL CASE, per Adam)
2.0 -> 1 x 2            5.0 -> 2 x 1.5 + 1 x 2
2.5 -> NOT achievable   5.5 -> 3 x 1.5 + 1 x 1
3.0 -> 2 x 1.5          6.0 -> 4 x 1.5
3.5 -> 1 x 1.5 + 1 x 2  6.5 -> 3 x 1.5 + 1 x 2
4.0 -> 2 x 1.5 + 1 x 1  7.0 -> 4 x 1.5 + 1 x 1
```

`lsuSets(bars_15, bars_2, bars_1) = ceil((totalBars + 1) / 2)` — each LSU Set `YW-00169`
ships 2 uprights; N bars in a row need N+1 uprights, adjacent bars share uprights.
(v0.8.0 fix: this used to be hardcoded to qty 1.)

Connecting bars use **placeholder** codes `LSU-CONNB-L150 / L200 / L100` — see TBD #1.

**Processor** — `YW-04071` MX30 or `YW-00347` MX40 Pro, qty 1.

### Spares logic (v0.7.0)

Panels come cased: **1000×500 = 4/case, 500×500 = 8/case**.

```js
computeSpares(used, caseSize) {
  var rem = used % caseSize;
  return rem === 0 ? caseSize : (caseSize - rem);
}
```

Round the used qty up to the next full case, put the leftover in **Spares**. If the wall
lands exactly on a full case (no natural spare) add a **whole extra case**.
Worked: caseSize 4 → 3 used gives 1 spare, 4→4, 5→3, 8→4, 18→2, 20→4.

Each spare line then gets HireHop's **"100% applied"** state — `unit_price` preserved,
`price` forced to 0 — via a follow-up POST to `/php_functions/items_save.php` after the
batch save settles (`saveLineHundredPercent`, 800ms gap between lines, best-effort with
console warnings so one bad row doesn't strand the kit).

### Job insertion (v0.6.0)

`addVideowallKit()` mirrors stage-designer's `addStageKit`:

1. `selectedParentHeadingId(inst)` — walk up from the tree selection to find a parent heading
2. Resolve every part number via `/php_functions/items_get_part_number_details.php`
   (3 tries, 800ms apart). Resolved → batch "shopping" map keyed `a|b + ID`; unresolved →
   custom free-text line `[PART-NUMBER] label`
3. `createHeading(title, parentId, flag 5 /* Grouped */)` — the main folder
4. Sub-headings in `INSERT_ORDER = ["Screen", "Spares", "Processor", "Rigging"]`.
   `ALWAYS_CREATE = { Spares: true }` so Spares appears even when empty
5. `save_items_list(shopping)` per sub-heading, then customs at 3s spacing
6. For Spares only: snapshot line IDs before, then force the new ones to 100% applied
7. `dismissAutopullThen(...)` then `clickSupplyingRefresh(inst)`

Timing constants: `RESOLVE_RETRY_MS 800`, `HEADING_SETTLE_MS 3000`, `HEADING_TIMEOUT_MS 20000`,
`HEADING_RETRY_BACKOFF_MS 9000`, `CUSTOM_ROW_GAP_MS 3000`, `DISCOUNT_GAP_MS 800`.

**Heading title format:**
`"{Indoor|Outdoor} Videowall {W}w x {H}h {pitch} {Flown-Clamp|Flown-Sling|Ground Supported} {MX30|MX40 Pro}"`
e.g. `Indoor Videowall 4w x 3h 3.9mm Flown-Sling MX30`.

### Version history

| Tag | What landed |
|---|---|
| v0.2.0 | baseline-questions wizard (+ loader v0.1.72) |
| v0.3.0 | pitch 2.6/3.9, 500×1000 panels @ 0.5m grid, pitch-aware ground support, outdoor-only clamp/sling |
| v0.4.0 | split panels into 500×1000h + 500×500h; preview draws top row half-height |
| v0.5.0 | real Chauvet + Uniview + LSU part numbers |
| v0.6.0 | job insertion (Screen / Spares / Rigging) |
| v0.7.0 | cased spare panels + force 100% applied |
| v0.8.0 | Q5 processor, LSU set qty scaling, 4.5m decomposition fix |
| v0.9.0 | **port mapping** — Q6 refresh + Q7 bit depth, BANDWIDTH lookup, `mapPorts()`, port-coloured preview with feed paths and % per port. Loader v0.1.92 |
| v0.9.1 | **wiring rules** — no mixed panel sizes on a port, always left-to-right, one line per row. Replaced v0.9.0's serpentine packing. Loader v0.1.93 |
| v0.10.0 | **processors + redundancy** — real port counts (MX30 10 / MX40 20), Q8 backup with both pairing schemes, computed processor quantity in the kit, upgrade hint, physical port numbers stamped on panels. Loader v0.1.94 |
| v0.11.0 | **ballast + topper** — `YW-00259` 12.5kg weight plates auto-added per upright off the German exhibition table, both ground systems; `YW-04062` 30cm topper on every REM ground wall; ground-support minimum heights enforced. Loader v0.1.95 |
| **v0.12.0** | **external catalogue + dialog polish** — parts/ballast/bandwidth moved to `data/videowall-creator/*.json` on jsDelivr (part changes are now a pure data edit); version in the dialog header; loading bar on catalogue fetch and on insert. Loader v0.1.96 |

### External part catalogue (v0.12.0) — the stage-designer pattern, finally adopted

```
data/videowall-creator/
├── parts.json        panels, flown bars, ground kits, ballast plate, processors
├── ballast.json      the German exhibition table + min/max heights
└── bandwidth.json    per-port % per panel, per processor/family/size/refresh/depth
```

Loaded from `https://cdn.jsdelivr.net/gh/AdamYesEvents/HH-YES-Plugins@main/data/videowall-creator/`
at dialog-open time, cache-busted with `?t=<now>`. **A part number change is now a pure
data edit — no code release, no tag, no loader re-pin.** This kills the release cycle that
backlog item #8 complained about.

⚠️ **The inline `PARTS` / `BALLAST` / `BANDWIDTH` values in the JS are the FALLBACK and must
stay in sync with the JSON.** If a fetch fails the tool runs on the inline values rather than
breaking. There's a test (`vwcat.js` pattern) that deep-compares the two — run it after
editing either side. `mergeInto` is a deep merge, so a JSON file that overrides one part
number keeps every other default, and `_comment`-prefixed keys are ignored.

`bandwidth.json` uses string keys (`"60"`, `"8"`); JS numeric indexing coerces, so the
lookups work unchanged. **Omitting the `"12"` key under `mx30` is what disables 12bit for
the MX30** — don't add it back.

**Loading bar + version.** `TOOL_VERSION` now shows in the dialog header next to the title.
`addVideowallKit(inst, items, title, onDone, onProgress)` takes an optional progress
callback with the same `{phase, category, doneItems, totalItems}` contract as
stage-designer's `addStageKit`, driving a spinner + bar in the footer. Phases:
`catalogue`, `resolving`, `wall-folder`, `subheading`, `item`, `finalising`.

**Refresh rate and backup were already in the popup** since v0.10.0 (Q6 / Q8) — if they
aren't visible in HireHop, the Plugins setting is pinned to a loader older than v0.1.94.

### Ballast (Adam, 2026-08-27) — implemented v0.11.0

Source: **"Ballast loading", technical guidelines for Exhibitions in Germany.**
The table is indexed by height only — no width term — because the figure is **per
upright (per bay support)**. A wider wall gets *more* uprights, not heavier ones.
**Safety factor 1.5 is already baked into the kg column — do not apply another.**

| Height | Overturning moment | Ballast/upright | Plates (12.5kg, round up) |
|---|---|---|---|
| 2.0 m | 0.25 kNm | 17 kg | 2 |
| 2.5 m | 0.39 kNm | 38 kg | 4 |
| 3.0 m | 0.56 kNm | 64 kg | 6 |
| 3.5 m | 0.77 kNm | 95 kg | 8 |
| 4.0 m | 1.00 kNm | 131 kg | 11 |
| 4.5 m | 1.13 kNm | 151 kg | 13 |
| 5.0 m | 1.28 kNm | 173 kg | 14 |
| 5.5 m | 1.45 kNm | 198 kg | 16 |
| 6.0 m | 1.63 kNm | 226 kg | 19 |

Weight plate is **`YW-00259`, 12.5 kg**. Plates round up **per upright**, then multiply
by the upright count — rounding once at the end would under-ballast individual towers.
**Same weight system on both ground support systems** (Uniview 2.6mm and Chauvet REM).

**Upright count** — the number *erected*, which is not always what the kits supply:

- **REM / LSU**: `uprights = totalBars + 1`. (LSU Sets ship 2 uprights each and round up,
  so a 2-bar run needs 3 uprights but is supplied 4. Ballast follows the 3.)
- **Uniview**: `uprights = 2 × kits` — each `YW-04065` kit is a self-contained 2-upright tower.

**Height limits (Adam):** REM ground minimum **2m**, Uniview ground minimum **1.5m**, both
now enforced in `computeKit`. Uniview's 1.5m falls below the table's first row so it
**clamps up to the 2.0m figure** (conservative). A ground wall **over 6m is rejected** —
off the end of the table, needs engineering sign-off.

⚠️ The old code comment *"a 3m wall needs 3 plates even though the kits supply 4"* predates
this table and does not reconcile with it under any reading. The table is now authoritative;
the comment has been removed. **Worth a sanity check against a real 3m rig.**

**Topper:** `YW-04062` LSU 30cm topper is **REM-only** and goes on **every** REM ground wall,
one per upright, at any height. Uniview does not take it.

⚠️ **Assumption to confirm:** the lookup uses the **wall height as entered**. If the table's
"height" means overall *structure* height, the REM topper (+0.3m) and any base/clearance
should push the lookup up a row.

### Bandwidth per panel — per processor (supplied by Adam, 2026-08-25)

Percentage of capacity consumed by **one panel**, at a given refresh rate and colour bit
depth. **The tables differ by processor** — MX40 and MX30 each have their own.

#### MX40

**Uniview UR Pro 2.6mm**

| 1000×500 | 8bit | 10bit | 12bit |   | 500×500 | 8bit | 10bit | 12bit |
|---|---|---|---|---|---|---|---|---|
| 25hz | 5% | 7% | 10% |   | 25hz | 3% | 4% | 5% |
| 50hz | 10% | 13% | 19% |   | 50hz | 5% | 7% | 10% |
| 60hz | 12% | 15% | 23% |   | 60hz | 6% | 8% | 12% |

**Chauvet REM 3IP 3.9mm**

| 1000×500 | 8bit | 10bit | 12bit |   | 500×500 | 8bit | 10bit | 12bit |
|---|---|---|---|---|---|---|---|---|
| 25hz | 3% | 3% | 5% |   | 25hz | 2% | 2% | 3% |
| 50hz | 5% | 6% | 9% |   | 50hz | 3% | 3% | 5% |
| 60hz | 5% | 7% | 10% |   | 60hz | 3% | 4% | 5% |

#### MX30

**No 12bit column.** The MX30 supports **8bit and 10bit only** — the wizard must prevent
12bit being selected with an MX30, the same way 2.6mm already forces Indoor.

**Uniview UR Pro 2.6mm**

| 1000×500 | 8bit | 10bit |   | 500×500 | 8bit | 10bit |
|---|---|---|---|---|---|---|
| 25hz | 5% | 7% |   | 25hz | 3% | 4% |
| 50hz | 10% | 13% |   | 50hz | 5% | 7% |
| 60hz | 12% | 15% |   | 60hz | 6% | 8% |

**Chauvet REM 3IP 3.9mm**

| 1000×500 | 8bit | 10bit |   | 500×500 | 8bit | 10bit |
|---|---|---|---|---|---|---|
| 25hz | 4% | 5% |   | 25hz | 2% | 3% |
| 50hz | 7% | 9% |   | 50hz | 4% | 5% |
| 60hz | 8% | 10% |   | 60hz | 4% | 5% |

#### Key differences between the two

1. **Uniview figures are identical on MX30 and MX40** — every cell in the 8bit and 10bit
   columns matches exactly. Pitch 2.6mm costs the same on either processor.
2. **Chauvet REM 3IP costs noticeably more on the MX30.** At 60hz/8bit a 1000×500 REM panel
   is **8% on MX30 vs 5% on MX40** — 60% more expensive. A REM wall therefore needs
   materially more MX30 capacity than MX40 capacity, while a Uniview wall needs the same.
   Practical consequence: **processor choice matters much more for Chauvet walls than for
   Uniview walls.**
3. MX30 loses 12bit entirely.

> **6% confirmed independently.** The MX30 table lists Uniview 500×500 @ 60hz/8bit as **6%**,
> matching the correction Adam confirmed for the MX40 table (the source spreadsheet had 3%).
> Two tables now agree on 6%, so the correction is settled.

**Verification / sanity model.** Working backwards, 100% on the **MX40** consistently
equals ~615–655k px at 8bit/60Hz — the capacity of a single Gigabit port:

| Panel | Pixels | Implied 100% (MX40) |
|---|---|---|
| REM 3IP 3.9mm 1000×500 | 256 × 128 = 32,768 | 655,360 |
| REM 3IP 3.9mm 500×500 | 128 × 128 = 16,384 | ~546,000 (3% is rounded up from 2.5%) |
| Uniview 2.6mm 1000×500 | 384 × 192 = 73,728 | 614,400 |
| Uniview 2.6mm 500×500 | 192 × 192 = 36,864 | 614,400 |

⚠️ **The MX30 numbers break the pure-pixel model.** On MX30, Uniview still implies
614,400 px = 100% (identical to MX40), but REM implies only **~410,000 px = 100%**
(32,768 / 0.08). The same physical panel cannot have two different pixel counts, so the
REM figures are **not** explained by pixel bandwidth alone — something processor-specific
(receiving-card handling, port mapping, or a deliberately conservative derating) caps the
Chauvet panels on the MX30.

**Treat both tables as authoritative lookup data, not as something to compute.** Do not
"fix" the REM/MX30 figures to match a bandwidth formula — they are what Adam supplied and
they encode real behaviour the formula doesn't capture. Store them as data; look them up.

Within each table these hold: a 500×500 costs half a 1000×500 of the same pitch (rounded
up), halving the refresh rate halves the cost, and 10bit costs ~×1.25–1.4 of 8bit.

**Derived form the tool needs** — max panels per 100% = `floor(100 / pct)`, at 60hz:

| @ 60hz | MX40 8bit | MX40 10bit | MX40 12bit | MX30 8bit | MX30 10bit |
|---|---|---|---|---|---|
| Uniview 1000×500 | 8 | 6 | 4 | 8 | 6 |
| Uniview 500×500 | 16 | 12 | 8 | 16 | 12 |
| REM 1000×500 | 20 | 14 | 10 | 12 | 10 |
| REM 500×500 | 33 | 25 | 20 | 25 | 20 |

```
unitsNeeded      = ceil( sum(panels x pct) / 100 )      // "units" = ports OR processors,
                                                        // pending the question below
processorsNeeded = ceil( unitsNeeded / portsPerProcessor )   // only if units = ports
```

✅ **RESOLVED (Adam, 2026-08-25): 100% = ONE PORT.** The percentage is what a single panel
consumes of **one port's** capacity, with the processor set in that mode (refresh + bit
depth). So a port is full at 100% and `maxPanelsPerPort = floor(100 / pct)`. This settles
the earlier port-vs-processor ambiguity — it is per port, not per processor.

✅ **Port counts (Adam, 2026-08-25): MX30 = 10 ports, MX40 Pro = 20 ports.**

### Redundancy / backup (Adam, 2026-08-25) — implemented v0.10.0

Running backup **pairs each primary port with a backup port, so only HALF the ports are
usable as primaries**: an MX30 drops from 10 lines to **5**, an MX40 Pro from 20 to **10**.

Two pairing schemes, both in use — the tool supports both:

| Mode | Scheme | MX40 Pro (20 ports) | MX30 (10 ports) |
|---|---|---|---|
| `pairs` | adjacent | 1&2, 3&4, 5&6 … | 1&2, 3&4 … 9&10 |
| `offset` | half-offset | 1&11, 2&12 … 10&20 | 1&6, 2&7 … 5&10 |

The offset is always **half the processor's port count**, which is why the same option gives
1&11 on an MX40 and 1&6 on an MX30.

**Processor quantity is now computed** (`processorCount`) and written into the kit — the
Processor line item qty follows it instead of always being 1.

**Upgrade hint.** Because backup halves an MX30 to 5 primaries, walls spill onto a second
box fast. A 4m × 6m Uniview wall is 6 lines — fine on a bare MX30, but with backup it needs
**2 × MX30**, where a single **MX40 Pro** (10 primaries) covers it. When a bigger box would
do it in fewer, `upgradeSuggestion` says so and the panel shows it in amber. This is Adam's
point that *"sometimes it might be better for the processor to be upgraded depending on the
ports required."*

⚠️ **Backup cabling is NOT done.** Redundancy doubles the data runs, and the backup feed
conventionally lands on the **far end** of each chain (so data can flow back the other way
if the primary drops) — meaning **backup cable lengths are not the same as primary
lengths**. Needs Adam's rule before it goes in the kit. Port allocation is complete; only
the cables are missing.

Once resolved, this table wires into `computeKit()` and Q4 stops being inert.

### Port mapping + cabling — **port mapping SHIPPED in v0.9.0**, cabling still open

Status: everything under "Port packing" and "Preview / report output" below is
**implemented and tested** in v0.9.0. The starter-cable half is **not** — still blocked on
part numbers. Read on for the spec as agreed with Adam 2026-08-25.

#### ⚠️ WIRING RULES (Adam, 2026-08-25) — these override bandwidth efficiency

Implemented in **v0.9.1**, which replaced v0.9.0's bandwidth-optimal serpentine packing.
Do not "optimise" these away — they exist for build and test practicality, not throughput.

1. **A line NEVER mixes panel sizes.** 1000×500 and 500×500 cannot share a port. Rows are
   uniform, so row-aligned lines satisfy this automatically and the 500h top row always
   gets its own line.
2. **Wiring always runs LEFT TO RIGHT.** No serpentine, no reversing on alternate rows.
   Every line starts at its leftmost panel. (v0.9.0 serpentined so ports started at
   alternating ends — rejected.)
3. **Lines are ROW-ALIGNED.** A line never spans two rows, so 3 rows gives at least 3
   lines. Deliberately **not** the minimum port count: *you build and fly a wall row by
   row, and one line per row lets you test each row as it goes up.*

A row too wide for one port splits into contiguous left-to-right chunks sized as evenly as
possible — 16 cols at 15% gives 6/5/5, not 6/6/4.

**The cost of rule 3 is real and is surfaced, not hidden.** A 4×3 Chauvet wall on an MX40
at 60hz/8bit is 120% total, so bandwidth alone would fit 2 lines — the row rule uses 3 at
40% each. `computeKit()` returns `minPortsByBandwidth`, and the panel prints "bandwidth
alone would fit N" whenever the row rule costs extra lines.

**Superseded thinking (v0.9.0, kept so it isn't re-derived):** when lines *were* allowed to
span rows, `portCount` was not `ceil(total/100)` — contiguity along a daisy-chain meant the
true floor could be higher (a 4 × 3.5m Uniview wall on an MX30 at 25hz/10bit is exactly
200% but no contiguous 2-way split fits, so it needed 3). Under the row rule this no longer
arises, because line boundaries fall on row boundaries.



**Goal:** the Creator should show **how to plug the wall up in the most logical and
efficient way** — how many lines come off the processor, which ports they are, which panels
each line feeds, and roughly **how much of each port's capacity is used**. Plus generate the
starter cables into the kit.

#### New wizard inputs required

| Input | Options | Notes |
|---|---|---|
| Refresh rate | 25hz / 50hz / 60hz | matches the lookup table rows |
| Bit depth | 8bit / 10bit / 12bit | **must reflect the processor** — MX30 offers 8/10 only, MX40 offers 8/10/12. Same clamp pattern as `syncEnvOptions` |

Neither exists in the tool today. Bit depth is the "bit rate option that reflects the
processor chosen".

#### Port packing

Look up `pct` per panel from `(processor, panelSize, refresh, bitDepth)`. Note a wall with a
0.5m height remainder has **mixed** panel costs — 1000×500 and 500×500 have different `pct`,
so packing must sum per-panel, not assume uniformity.

```
totalPct  = sum(pct of every panel)
portCount = ceil(totalPct / 100)
```

Then **balance** across `portCount` ports rather than greedily filling port 1 to 100% and
leaving the last port nearly empty — an even spread is what a tech would actually patch.

**Worked example — the 4×3 wall Adam cited.** 4m wide × 3m high = 8 cols × 3 rows = 24 ×
1000×500 panels. Uniview @ 60hz/8bit = 12% each:

```
totalPct  = 24 x 12%  = 288%
portCount = ceil(288/100) = 3          <- matches Adam's "3 lines, ports 1-3"
balanced  = 24 / 3 = 8 panels per port = 96% per port
```

8 panels is **exactly one row** of this wall, so the natural map is **one port per row**:
port 1 → row 1, port 2 → row 2, port 3 → row 3, each at 96%. This is the result that should
fall out of the algorithm, not be special-cased.

(Cross-check: this combination is the only one giving 3 ports for a 4×3. REM on MX40 @
60hz/8bit would be 24 × 5% = 120% → 2 ports. So Adam's example is a Uniview wall.)

Runs are **contiguous serpentine chains** — a port feeds a daisy-chain of adjacent panels.
Direction preference (whole rows vs whole columns) is an **open question** — see below.

#### Preview / report output

On the front-elevation SVG:
- **Colour-band or outline each port's region**, labelled `Port 1`, `Port 2`, …
- Show the **serpentine path** (arrows) so the crew can see feed direction
- Show **% used per port** — e.g. `Port 1 — 8 panels — 96%`. Adam explicitly asked for a
  rough per-port utilisation figure on both the preview and the report.
- Roll-up line: total ports, total load, processor count

#### ⚠️ CABLE LENGTH RULE (Adam, 2026-08-27) — SUPERSEDES the banding table below

**One cable per line, primary AND backup, same length rule for both:**

```
cableLength(line) = wall width + height of that line's row
```

Adam: *"backup needs to travel the length of the wall and the height of each row.
same rule for the input."* The backup lands on the far end of the chain, which is
what forces the full wall width into the length — and the input is spec'd the same
way for consistency.

Worked, 4m wide × 3m high (3 rows), one line per row:

| Line | Row height | Length | Cables |
|---|---|---|---|
| 1 (bottom row) | 1 m | 4 + 1 = **5 m** | 1 primary + 1 backup |
| 2 | 2 m | 4 + 2 = **6 m** | 1 primary + 1 backup |
| 3 (top row) | 3 m | 4 + 3 = **7 m** | 1 primary + 1 backup |

Backup cables only exist when Q8 backup is running (`pairs` or `offset`); with
backup off it's one cable per line.

**This replaces** the older "REM ground/behind-screen = 5/10/20m Ethercon by width,
processor centred; Uniview = 15m flat" spec recorded below. That spec is kept for
history only — do not implement it.

🚧 **Still blocked on:** the available **stock cable lengths** and their **YW part
codes**. Computed lengths must round up to a real stock length before they can become
kit lines; without codes they would drop to free-text lines on every job (the same
problem as `LSU-CONNB-L150`). Nothing cable-related is in the kit yet.

Open detail: when a row is too wide for one port and splits into chunks, the rule is
read as **full wall width** for every line in that row (conservative), not the chunk width.

#### Starter cables (processor → first panel of each line) — SUPERSEDED, see above

**One starter cable per line/port.** Length rules differ by product and rig:

| Product | Rig | Rule |
|---|---|---|
| Chauvet REM | Ground support, processor **behind screen** | Ethercon, **5m / 10m / 20m depending on wall width**, processor assumed **centred** behind the wall |
| Chauvet REM | **Flown** | Short links out to a loom (⚠️ see open questions — spec unclear) |
| Uniview | any | **15m** starter cable **per line**; length is not width-sensitive, so no width banding needed |

Processor-behind-centre is why REM ground runs scale with width: each line's start point sits
further from the centred processor as the wall widens.

#### ⚠️ Open questions blocking implementation

1. **REM Ethercon width bands** — what widths map to 5m / 10m / 20m? Need the thresholds.
2. **REM part numbers** for the 5m / 10m / 20m Ethercons.
3. **REM flown cabling** — "short links to get to loom" needs expanding: what links, what
   lengths, what part numbers, and is the loom itself a kit line?
4. **Uniview 15m starter cable part number** — is this the `YW-04070` Ethercon already noted
   as TBD in the file header, or a different code?
5. **Run direction preference** — rows or columns? For the 4×3 example rows fall out
   naturally, but a tall narrow wall (e.g. 2m × 5m) would want columns. Proposed default:
   run along the **longer axis**, override available. Needs Adam's confirmation.
6. **Port count per processor** (MX30, MX40) — determines when a wall needs a second
   processor.
7. **Does Q4 "processor location" (behind screen / within 70m) feed the cable choice?**
   The behind-screen rule above is spec'd; the "within 70m" branch has no rule yet.

---

## 4. Videowall Creator — OPEN BACKLOG (the actual to-do list)

1. **LSU connecting bars have no YW codes.** `LSU-CONNB-L150 / L200 / L100` are
   placeholders, so they fail resolution and drop to custom free-text lines on *every*
   ground-supported 3.9mm job. **Highest-value fix** — Adam to supply the real YW codes.
2. ~~Weight plates not auto-added.~~ **DONE in v0.11.0** — `YW-00259` 12.5kg plates,
   per upright, off the German exhibition ballast table. Note the part code is
   **`YW-00259`**, not the `YW-02892` recorded in earlier notes.
3. ~~LSU 30cm topper `YW-04062` height threshold undecided.~~ **DONE in v0.11.0** —
   REM ground only, one per upright, every height. No threshold.
4. **Signal / starter cables deferred.** No `Cable` category yet. When ready: add items with
   `category: "Cable"` and un-skip `"Cable"` in `INSERT_ORDER`. **Rules now spec'd** — see
   "Target feature: port mapping + cabling" in section 3. One starter cable per line;
   REM ground/behind-screen = 5/10/20m Ethercon by wall width (processor centred), REM flown
   = short links to loom, Uniview = 15m per line. Part numbers still outstanding.
5. **PDF deliberately disabled.** `PDF_ENABLED = false`; `buildVideowallPdf()` is a
   rejecting stub. **Keep the scaffolding.** Plan: port stage-designer's `loadJsPdf()` +
   branding-logo + jsPDF layout, adapt to the wall front elevation, flip the flag.
6. **3.9mm ground decomposition above 4.5m is unverified.** 4.5m is hardcoded to
   1.5+1+2 per Adam; 5m+ falls back to a "max 1.5s + one 2m or 1m filler" loop that has
   not been checked against a real table. Re-decompose if Adam supplies one.
7. **Q4 processor location is still inert** — asked but changes nothing. It is meant to
   drive the starter-cable choice (behind screen → the 5/10/20m banding); the "within 70m"
   branch has no rule at all yet.
7a. ~~Bandwidth / port calculation not implemented.~~ **DONE in v0.9.0.** Q6 refresh and Q7
   bit depth added, `BANDWIDTH` lookup + `mapPorts()` implemented, preview shows port
   colouring, feed paths and % per port.
7b. ~~MX30 must block 12bit.~~ **DONE in v0.9.0** via `bitDepthsFor()` + `syncBitDepthOptions()`,
   which disables the 12bit option and falls back to 10bit when an MX30 is selected.
7c. ~~Processor quantity not computed.~~ **DONE in v0.10.0** — MX30 = 10 ports, MX40 Pro =
   20, halved when backup is running. `processorCount` drives the Processor line item qty,
   and an upgrade hint fires when a bigger box would need fewer.
7f. **Cabling not in the kit — primary or backup.** ~~Blocked on Adam's rule.~~ **Rule
   RESOLVED 2026-08-27:** one cable per line for both primary and backup, length =
   `wall width + row height`. See the cable length rule in section 3. Port allocation is
   done and the maths is trivial — **now blocked only on stock cable lengths + YW part
   codes.**
7d. ~~Run-direction convention unconfirmed.~~ **RESOLVED in v0.9.1** — always left to
   right, one line per row, never mixing panel sizes. See the wiring rules in section 3.
7e. **Port numbering direction unconfirmed.** Ports are numbered from the **top** row down
   (port 1 = top row). The UI labels them by row counted from the **bottom** ("row 3" =
   top of a 3-row wall). If the crew numbers lines bottom-up instead, flip the numbering
   in `mapPorts()` — it is a one-line change.
8. ~~No external catalogue.~~ **DONE in v0.12.0** — parts, ballast and bandwidth now load
   from `data/videowall-creator/*.json` on jsDelivr. Part changes no longer need a release.
   Keep the inline fallbacks in the JS in sync with the JSON.

---

## 5. Stage Designer — v0.31.15 (context / reference implementation)

Dialog: metric/imperial → width × depth × height → packs the area largest-deck-first
(rotating to fit) → legs, carpet, fascia, trim, treads, branding, accessories → top-down
SVG grid + PDF → "Add stage kit" writes it into the job.

- Sub-heading order: `CAT_ORDER = ["Deck", "Carpet", "Fascia", "Trim", "Treads"]`
- Catalogue loaded live from jsDelivr with `DATA_REF = "main"` → part-number changes are
  a **pure data edit, no code release**. (This is the pattern videowall should adopt — TBD #8.)
- PDF via `jspdf@2.5.2` UMD from CDN.
- Packing contract `packStage({system, width, depth, decks, systems})` → `{ok, placements, kit, totals}`.
  `placements` is canonical geometry (origin top-left, x→right, y→down); `kit` is just a
  group-and-count. Designed so a future isometric 3D view is a renderer swap, not a rewrite.
  Full spec in `docs/stage-designer-spec.md`.

### The HireHop tree war — v0.31.6 → v0.31.15 (READ THIS BEFORE TOUCHING INSERTION)

Ten releases in August were all one bug. **Root cause:** HireHop calls
`items_to_supply_tree.jstree('refresh')` after *each* heading/item save, which re-runs
`items_to_supply_list.php` — **30–40s on large jobs**. During that window the tree's node
index is empty, `tree.select_node` silently no-ops, and `save_items_list`'s XHR reads
stale session state → items land under an unrelated top-level folder.

Failed attempts, in order:
- v0.31.7 — `forceParentHeading()` synthetic-option helper applied to `insertOneCategory`
- v0.31.8 — monkey-patch `set_parent_vals` + `set_item_edit_tree_headings` to no-op
- v0.31.9 — monkey-patch `jstree.get_selected` during `save_items_list`
- v0.31.10 — `waitForNodeSelectable` poll (45s) before `save_items_list`
- v0.31.11 — route ALL items via the custom-line path to bypass server-side parent
  inference (worked, but lost stock linkage — **reverted**)

**The fix that stuck (v0.31.12):** monkey-patch `treeJs.refresh` to a no-op for the
*whole* insert, restore + refresh **once** after the final autopull dismiss.

- v0.31.13 — throttle back to 3s (2s was too tight, items dropping)
- v0.31.14 — panel `close()` (backdrop click) now unwinds the monkey-patches if triggered
  mid-insert; previously they persisted until the 20-min failsafe and could interfere with
  normal HireHop use
- v0.31.15 — removed a duplicate end-of-insert refresh (`treeJs.refresh(false)` AND
  `clickSupplyingRefresh(inst)` fired back-to-back = 46s of apparent hang)

Also from v0.31.6: `headingIdSet` throws while the tree is mid-refresh (empty root), which
errored the 200ms `setInterval` callback so the timeout check never fired → **silent
infinite hang**. Wrapped in try/catch. `HEADING_TIMEOUT_MS` also went 20s → 60s.

There is a git tag `restore-before-monkeypatch` as a restore point.

---

## 6. Related loose files (not code)

In `C:\temp`: `URPRO2.6 500X500.ncp`, `URPRO2.6 500X1000.ncp`, `REM3IP ncp V1.00.03.ncp`,
`REM3IPSQ ncp V1.00.03.ncp` — Novastar receiving-card configs for exactly these two panel
families. Related to the walls, unrelated to the plugin code.

Also in `C:\temp`: `stage-designer-parts.txt`, `parts.json`, `iso-*.txt` / `iso-proto.js`
(isometric-view prototyping), `pack-test.js`, `fascia-test.js`, `preview.svg`,
`pdf-snapshot.svg` — scratch/prototype files from earlier stage-designer work.

---

## 7. Quick resume commands

```bash
cd "C:\temp\hh-repo" && git fetch origin --tags && git status --short && git log --oneline -10
```

```bash
cd "C:\temp\hh-repo" && git tag --list "videowall-creator*" | sort -V | tail -5
```

Release routine for a videowall change: edit `tools/videowall-creator.js`, bump the
`Version:` header, commit, tag `videowall-creator-vX.Y.Z`, push tags, then bump the
`ref` in `loader.js` (and `loader-stage-designer.js` if relevant), bump the loader version,
tag `vX.Y.Z`, and update the URL in HireHop's Plugins setting.
