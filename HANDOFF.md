# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 8-1: Pepe's obstacle dash interlude — completed 2026-03-23

## Current stage in progress
- Stage 8-2: Tomato juggling interlude
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=18` cache-busting parameters
- Working features:
  - Phase 1-7 complete: engine, 8 zones, puzzles, weapons, enemies, power-ups, health, bosses, finale
  - Stage V-1: all sprites procedurally generated
  - Stage A-1: Howler.js sample SFX, upgraded Tone.js music, ambient layers
  - Stage 6-1: Papa Marco hint system
  - Stage 7-9: Full game completion path (all recipes → wedding boss → finale → credits)
  - Stage 8-1: Pepe's obstacle dash (random ~40% on zone transitions)
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
- Known issues: none

## Zones
- 8 zones active: La Cucina → Market → Canal → Library → Gym → Piazza → Pizzeria → Sewing Shop
- 2 boss fights: Enzo (Pizzeria), Bridget (Sewing Shop)

## Game modes
- overworld, bmx, drum, cooking, finale, pepe_dash

## Interludes implemented
- Drum Solo (guaranteed after Gym with recipe #3)
- Pepe's Obstacle Dash (random 40% on zone transitions)

## Tile shorthand note
- Original 16: `const` F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym: `var` _MT, _EQ, _JB, _MR
- Piazza: `var` _FN, _CB, _FT
- Pizzeria: `var` _OV, _DI, _SM, _CK
- Sewing Shop: `var` _FB, _SW, _MN, _CP

## Next step
- Stage 8-2: Tomato juggling interlude. Multi-lane reflex game: tomatoes fall, catch in correct lane. Triggers after completing Zone 1. Left/right to move, up/down for lane switch. Score-based rewards.
