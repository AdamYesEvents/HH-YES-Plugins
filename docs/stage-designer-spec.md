# Stage Designer — design spec (step 1: deck blocks)

Status: **draft / not yet implemented.** This documents the agreed shape before
coding. Part numbers are placeholders (`TBD-…`).

## Scope of step 1

Generate a **stage deck kit list** from a simple dialog:

`System (metric / imperial)` → `Width × Depth` → packing → **kit list (part # + qty)** → visual grid.

Deferred to later versions: deck legs / height, carpet, fascia, trim, staging box,
stairs, weight/volume totals, and the isometric 3D view.

## Data: `data/stage-designer/decks.json`

Each component category gets its own file (`decks.json` now; `legs.json`,
`fascia.json`, `trim.json` later) so they version, cache, and diff independently.
They share the `id` convention so later files can reference decks.

```json
{
  "schema": "stage-designer/decks",
  "dataVersion": "0.1.0",
  "systems": {
    "metric":   { "unit": "m",  "increment": 0.5, "min": 2, "max": 10 },
    "imperial": { "unit": "ft", "increment": 4,   "min": 4, "max": 24 }
  },
  "decks": [
    { "id": "deck-2x1m",   "system": "metric",   "label": "2 x 1m LiteDeck Panel",     "width": 2,   "depth": 1,   "partNumber": "TBD-M201",  "weightKg": null },
    { "id": "deck-1x1m",   "system": "metric",   "label": "1 x 1m LiteDeck Panel",     "width": 1,   "depth": 1,   "partNumber": "TBD-M101",  "weightKg": null },
    { "id": "deck-2x05m",  "system": "metric",   "label": "2 x 0.5m LiteDeck Panel",   "width": 2,   "depth": 0.5, "partNumber": "TBD-M205",  "weightKg": null },
    { "id": "deck-1x05m",  "system": "metric",   "label": "1 x 0.5m LiteDeck Panel",   "width": 1,   "depth": 0.5, "partNumber": "TBD-M105",  "weightKg": null },
    { "id": "deck-05x05m", "system": "metric",   "label": "0.5 x 0.5m LiteDeck Panel", "width": 0.5, "depth": 0.5, "partNumber": "TBD-M0505", "weightKg": null },
    { "id": "deck-8x4ft",  "system": "imperial", "label": "8 x 4ft Stage Deck",        "width": 8,   "depth": 4,   "partNumber": "TBD-I804",  "weightKg": null },
    { "id": "deck-4x4ft",  "system": "imperial", "label": "4 x 4ft Stage Deck",        "width": 4,   "depth": 4,   "partNumber": "TBD-I404",  "weightKg": null }
  ]
}
```

### Field notes
- `systems` is the single source of truth for unit, increment, and min/max — the
  size steppers and the packer both read it (limits live in data, not code).
- **Array order = placement priority.** Decks are listed largest-first, with
  `deck-1x1m` *before* `deck-2x05m`, which encodes the agreed tie-break
  ("prefer 1×1"). Reorder the file to change preference; no code change.
- `partNumber` is a placeholder; swapping real HireHop stock numbers in later is a
  pure data edit.
- `weightKg` is optional (`null` for now) — reserved for the future weight total.

## Packing contract: `packStage(...)`

### Input
```
packStage({
  system,     // "metric" | "imperial"
  width,      // number, in the system's unit
  depth,      // number, in the system's unit
  decks,      // decks[] filtered to this system, in priority (array) order
  increment   // 0.5 or 4, from systems config
})
```

### Output
```
{
  ok: true,
  placements: [
    { deckId, x, y, width, depth, rotated }   // geometry — the source of truth
  ],
  kit: [
    { deckId, label, partNumber, qty }        // derived: placements grouped by deckId
  ],
  totals: { panels, areaCovered }
}

// invalid input:
{ ok: false, error: "Depth 2.3 m is not a multiple of 0.5 m" }
```

- **Coordinates:** origin `(0,0)` top-left; `x` increases along width (right),
  `y` along depth (down); units = the system's unit. `width`/`depth` on a placement
  is the *placed* footprint (already rotated); `rotated` flags it.
- The same `placements` geometry renders the **2D top-down grid now** and the
  **isometric 3D view later** — designed this way so 3D is a renderer swap, not a
  rewrite.
- `placements` is canonical; `kit` is just a group-and-count of it. The future
  "add to job" step reads `kit` → `{ partNumber, qty }`.

### Validation
- `system` is known.
- `width` and `depth` are multiples of `increment` and within `[min, max]`.
- Otherwise return `ok: false` with a human-readable `error`.

### Algorithm (behaviour, not final code)
Snap to the grid, then fill **largest-first in priority order**, rotating each panel
to fit the remaining run, using a core-block + edge-strip decomposition so
half-metre remainders come out near-minimal. Deterministic (same input → same
layout); full coverage is guaranteed because the smallest panel equals one grid cell.

## Worked examples (first test cases)

### Metric 4 × 3 — clean
```
placements: 6 × deck-2x1m at (0,0)(2,0)(0,1)(2,1)(0,2)(2,2), width:2 depth:1 rotated:false
kit:        [ { deckId:"deck-2x1m", qty:6 } ]
totals:     { panels:6, areaCovered:12 }
```

### Metric 3.5 × 2 — rotation + remainder strip
```
placements: 3 × deck-2x1m  rotated:true (width:1 depth:2)  at (0,0)(1,0)(2,0)
            1 × deck-2x05m rotated:true (width:0.5 depth:2) at (3,0)
kit:        [ { deckId:"deck-2x1m", qty:3 }, { deckId:"deck-2x05m", qty:1 } ]
totals:     { panels:4, areaCovered:7 }
```
(The 0.5×2 m strip is one rotated 2×0.5 m panel — the packer finds this automatically.)

## Future (noted, not in step 1)
- `legs.json` (height), `fascia.json`, `trim.json` — separate files, same `id` style.
- Isometric 3D view driven by the same `placements` plus leg heights (Z axis).
- Weight / volume totals from `weightKg` (and a volume field) per panel.
