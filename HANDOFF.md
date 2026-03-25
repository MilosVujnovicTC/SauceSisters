# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 9-4: Score, rewards, and balancing — completed 2026-03-25

## Current stage in progress
- Stage 9-5: Full playtest + bug fix pass
- Status: not started

## Deferred stages
- Stage 8-5: Pepe gap mechanic + dog throws — deferred. May return behind sister/player selection screen.
- Pepe obstacle dash interlude: code intact but random trigger disabled (commented out in world.js checkTransitions).

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=27` cache-busting parameters
- Working features:
  - Phase 1-7 complete: engine, 8 zones, puzzles, weapons, enemies, power-ups, health, bosses, finale
  - Full game completion path (all recipes → wedding boss → finale → credits)
  - 6 interludes: Drum Solo, Pepe Dash (disabled trigger), Tomato Juggling, Air Guitar, Accordion, Sewing Rhythm
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
  - 10 millennial puzzles: Nokia T9, NES Cartridge, BMX Bike, Dot-Matrix Printer, Rotary Phone #1, Pager, VHS Tape, CD-ROM, Piazza Payphone (Morse), Tamagotchi
  - Save/load system: auto-save on zone transition, manual save from pause menu, title screen with Continue/New Game, save slot display
  - Settings: volume sliders, API key input, persist in localStorage
  - Score/coin system: earn coins from enemies, bosses, interludes, recipes. HUD display + floating popups. Persists in save.
  - Weapon ammo pickups in Piazza (tomato) and Gym (flour) for boss fight prep
- Known issues: none

## Game modes
- overworld, bmx, drum, cooking, finale, pepe_dash, juggling, air_guitar, accordion, sewing_rhythm

## UI modes
- titleScreen.active — title screen (blocks all game updates)
- pauseMenu.open — pause menu overlay (blocks game updates)
- settingsScreen.active — settings overlay
- remapUI.open — controls remap overlay
- dialogue.active — NPC dialogue
- game.showScrollOverlay — scroll pattern overlay
- 9 puzzle overlays (nokia, cartridge, printer, rotary1, pager, vhs, cdrom, morse, tama)

## Save system
- SAVE_KEY: 'sauce_sisters_save' in localStorage
- Auto-saves on zone transition (after loadZone)
- Manual save from pause menu
- Save data: version, timestamp, zone, playerCol/Row, facing, hp, lives, inventory, equipped, ammo, flags, playtime, score, recipesFound, zoneName

## Score system
- game.score — total coins earned
- game.scorePopups — floating "+N" popups in world space
- COIN_REWARDS in save.js: enemy kill 10, waiter 5, broom 15, bosses 50, recipes 20, interludes S40/A25/B15/C5
- Displayed in HUD (top-right, below weapon slot)

## Next step
- Stage 9-5: Full playtest + bug fix pass. Play through entire game start to finish, fix softlocks/broken transitions/missing states, verify all 5 recipes collectible, verify finale+credits, check 60fps performance.
