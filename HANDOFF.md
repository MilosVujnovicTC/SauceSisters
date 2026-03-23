# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 8-4: Remaining millennial puzzles — completed 2026-03-24

## Current stage in progress
- Stage 8-5: Pepe gap mechanic + dog throws
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=21` cache-busting parameters
- Working features:
  - Phase 1-7 complete: engine, 8 zones, puzzles, weapons, enemies, power-ups, health, bosses, finale
  - Full game completion path (all recipes → wedding boss → finale → credits)
  - 6 interludes: Drum Solo, Pepe Dash, Tomato Juggling, Air Guitar, Accordion, Sewing Rhythm
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
  - 10 millennial puzzles: Nokia T9, NES Cartridge, BMX Bike, Dot-Matrix Printer, Rotary Phone #1, Pager, VHS Tape, CD-ROM, Piazza Payphone (Morse), Tamagotchi
- Known issues: none

## Overlay puzzles (active-flag based, not game.mode)
- Nokia T9 (nokia.active), NES Cartridge (cartridge.active), Dot-Matrix Printer (printer.active)
- Rotary Phone #1 (rotary1.active), Pager (pager.active), VHS Tape (vhs.active)
- CD-ROM (cdrom.active), Morse Payphone (morse.active), Tamagotchi (tama.active)

## Game modes
- overworld, bmx, drum, cooking, finale, pepe_dash, juggling, air_guitar, accordion, sewing_rhythm

## Tile shorthand note
- Original 16: `const` F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym: `var` _MT, _EQ, _JB, _MR
- Piazza: `var` _FN, _CB, _FT
- Pizzeria: `var` _OV, _DI, _SM, _CK
- Sewing Shop: `var` _FB, _SW, _MN, _CP

## Next step
- Stage 8-5: Pepe gap mechanic + dog throws. Pepe auto-activates at 1-tile-wide gaps, squeezes through to trigger switches/collect items on other side. Both dogs throwable as gag weapons (brief stun, bounce back unharmed). Dogs cannot be lost or permanently separated.
