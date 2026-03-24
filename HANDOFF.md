# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 9-1: Save/load system — completed 2026-03-24

## Current stage in progress
- Stage 9-2: Title screen + pause menu
- Status: not started
- Note: Stage 9-1 already implemented title screen + pause menu as part of the save/load system. Stage 9-2 adds settings (volume controls, API key input). Review BACKLOG.md acceptance criteria.

## Deferred stages
- Stage 8-5: Pepe gap mechanic + dog throws — deferred. May return behind sister/player selection screen.

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=24` cache-busting parameters
- Working features:
  - Phase 1-7 complete: engine, 8 zones, puzzles, weapons, enemies, power-ups, health, bosses, finale
  - Full game completion path (all recipes → wedding boss → finale → credits)
  - 6 interludes: Drum Solo, Pepe Dash, Tomato Juggling, Air Guitar, Accordion, Sewing Rhythm
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
  - 10 millennial puzzles: Nokia T9, NES Cartridge, BMX Bike, Dot-Matrix Printer, Rotary Phone #1, Pager, VHS Tape, CD-ROM, Piazza Payphone (Morse), Tamagotchi
  - Save/load system: auto-save on zone transition, manual save from pause menu, title screen with Continue/New Game, save slot display
- Known issues: none

## Game modes
- overworld, bmx, drum, cooking, finale, pepe_dash, juggling, air_guitar, accordion, sewing_rhythm

## UI modes
- titleScreen.active — title screen (blocks all game updates)
- pauseMenu.open — pause menu overlay (blocks game updates)
- remapUI.open — controls remap overlay
- dialogue.active — NPC dialogue
- game.showScrollOverlay — scroll pattern overlay
- 9 puzzle overlays (nokia, cartridge, printer, rotary1, pager, vhs, cdrom, morse, tama)

## Save system
- SAVE_KEY: 'sauce_sisters_save' in localStorage
- Auto-saves on zone transition (after loadZone)
- Manual save from pause menu
- Save data: version, timestamp, zone, playerCol/Row, facing, hp, lives, inventory, equipped, ammo, flags, playtime, recipesFound, zoneName

## Next step
- Stage 9-2: Title screen + pause menu. Title screen and pause menu already exist from 9-1. This stage adds: Settings screen (music volume, SFX volume, API key input). May be partially complete — review what's missing vs BACKLOG.md acceptance criteria.
