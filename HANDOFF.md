# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 7-3: Zone 5 tilemap (Piazza) + build puzzle — completed 2026-03-23

## Current stage in progress
- Stage 7-4: Zone 6 tilemap (Enzo's Pizzeria)
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=10` cache-busting parameters
- js/world.js: ~1700 lines (6 zones + piazza puzzle + drum trigger in checkTransitions)
- js/sprites.js: ~2300 lines (all pixel art + bench/planter sprites)
- Working features:
  - Phase 1-5 complete: engine, 4 zones, puzzles, weapons, enemies, power-ups, health
  - Stage V-1: all sprites procedurally generated
  - Stage A-1: Howler.js sample SFX, upgraded Tone.js music, ambient layers
  - Stage 6-1: Papa Marco hint system
  - Stage 7-1: Papa's Gym zone with 3 NPCs, recipe #3, Tamagotchi placeholder
  - Stage 7-2: Drum solo interlude — rhythm game with backing track, grades, rewards
  - Stage 7-3: Piazza Vecchia zone with build puzzle, 3 NPCs, bench/planter sprites
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
- Known issues: none

## Piazza system (7-3)
- 30x22 cobblestone zone with animated fountain, flower planters, cross-shaped path network
- Build puzzle: 4 pushables (2 bench, 2 planter) → 4 fill targets at col 25, rows 10-13
- `checkPiazzaPuzzle()`: checks all targets filled, calls `completePiazzaPath()`
- `completePiazzaPath()`: converts east wall tiles (cols 25-29, rows 10-13) to walkable cobble+doors
- `restorePiazzaState()`: restores tiles on zone re-entry if already completed
- Pushable reset on re-entry if puzzle not yet solved (same pattern as Market heart puzzle)
- `renderPushables()` now uses `p.type` for sprite selection: 'crate', 'bench', 'planter'
- Piazza music: F major, 95 BPM (mandolin + accordion pad + walking bass)
- Ambient: crowd murmur (pink noise) + fountain trickle (white noise bandpass)
- CONFIG.PIAZZA_TARGETS in engine.js

## Zones
- 6 zones active: La Cucina → Market → Canal → Library → Gym → Piazza
- Transitions: Cucina↔Market, Market↔Canal, Canal↔Library, Library↔Gym, Gym↔Piazza
- Gym south exit (row 21, cols 13-14) → Piazza north-right (cols 23-25)
- Piazza north-right (row 0, cols 23-25) → Gym south (row 20)
- Recipe fragments: #1 (Market heart puzzle), #2 (Library Nokia/Brodo), #3 (Gym competition form)

## Tile shorthand note
- Original 16 tile shorthands use `const`: F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym shorthands use `var`: _MT, _EQ, _JB, _MR
- Piazza shorthands use `var`: _FN, _CB, _FT

## Next step
- Stage 7-4: Zone 6 tilemap (Enzo's Pizzeria). Kitchen, dining area, sauce machine room. Enzo NPC with scripted dialogue. Zone locked until piazza_puzzle_complete flag is set. East passage from Piazza leads here.
