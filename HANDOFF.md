# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 7-2: Drum solo interlude — completed 2026-03-23

## Current stage in progress
- Stage 7-3: Zone 5 tilemap (Piazza) + build puzzle
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=9` cache-busting parameters
- js/puzzles.js: ~2000 lines (BMX mini-game + Nokia T9 + cartridge puzzle + drum solo interlude)
- js/world.js: ~1540 lines (5 zones + drum trigger in checkTransitions)
- Working features:
  - Phase 1-5 complete: engine, 4 zones, puzzles, weapons, enemies, power-ups, health
  - Stage V-1: all sprites procedurally generated
  - Stage A-1: Howler.js sample SFX, upgraded Tone.js music, ambient layers
  - Stage 6-1: Papa Marco hint system
  - Stage 7-1: Papa's Gym zone with 3 NPCs, recipe #3, Tamagotchi placeholder
  - Stage 7-2: Drum solo interlude — rhythm game with backing track, grades, rewards
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
- Known issues: none

## Drum solo system (7-2)
- `drum` state in puzzles.js: active, phase, notes[], scoring, music (backing track synths)
- `createDrumChart()`: ~90 notes across 4 sections, 130 BPM, ~30 seconds
- `createDrumMusic()`: bass + guitar + organ + kick/snare/hihat, all Tone.js procedural
- `startDrumMusic()`/`stopDrumMusic()`: manages Transport and disposes synths
- Trigger: checkTransitions() in world.js — fires when leaving gym with recipe_3_found
- Return zone stored in game.drumReturnZone/SpawnX/SpawnY, loaded after interlude
- Rewards: S=activatePowerup('brownie'), A=activatePowerup('chocolate_milk'), B=addToInventory('tomato')
- game.mode === 'drum' routing in engine.js update() and render()

## Zones
- 5 zones active: La Cucina → Market → Canal → Library → Gym
- Transitions: Cucina↔Market, Market↔Canal, Canal↔Library, Library↔Gym
- Recipe fragments: #1 (Market heart puzzle), #2 (Library Nokia/Brodo), #3 (Gym competition form)

## Tile shorthand note
- New tile shorthands use `var` with underscore prefix: _MT, _EQ, _JB, _MR
- Original 16 tile shorthands use `const`: F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X

## Next step
- Stage 7-3: Zone 5 tilemap (Piazza Vecchia) + build puzzle. Open square with fountain, benches, planters. Pushable benches/planters on fill targets to create path to Zone 6. New NPCs.
