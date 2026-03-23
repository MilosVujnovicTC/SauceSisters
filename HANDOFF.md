# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage 8-3: Remaining interludes — completed 2026-03-23

## Current stage in progress
- Stage 8-4: Remaining millennial puzzles
- Status: not started

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, visual-mockup.html, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=20` cache-busting parameters
- Working features:
  - Phase 1-7 complete: engine, 8 zones, puzzles, weapons, enemies, power-ups, health, bosses, finale
  - Full game completion path (all recipes → wedding boss → finale → credits)
  - 5 interludes: Drum Solo, Pepe Dash, Tomato Juggling, Air Guitar, Accordion, Sewing Rhythm
  - Pull mechanic, Enchanted Broom, NPC idle behaviors + walking, NPC portraits
- Known issues: none

## Game modes
- overworld, bmx, drum, cooking, finale, pepe_dash, juggling, air_guitar, accordion, sewing_rhythm

## Interludes implemented (all 6 from CLAUDE.md spec)
- Drum Solo (guaranteed after Gym with recipe #3)
- Pepe's Obstacle Dash (random 40% on zone transitions)
- Tomato Juggling (guaranteed after Market with recipe #1)
- Coco's Air Guitar (optional, Canal — interact with Guitar Spot at 4,4)
- Betta's Accordion (optional, Market — interact with Accordion at 8,18)
- Mama's Sewing Rhythm (optional, Sewing Shop — interact with Sewing Machine at 6,12)

## Tile shorthand note
- Original 16: `const` F, W, A, G, C, D, P, S, R, H, T, B, L, K, J, X
- Gym: `var` _MT, _EQ, _JB, _MR
- Piazza: `var` _FN, _CB, _FT
- Pizzeria: `var` _OV, _DI, _SM, _CK
- Sewing Shop: `var` _FB, _SW, _MN, _CP

## Next step
- Stage 8-4: Remaining millennial puzzles. Red rotary phone #1 (Z1 dial combo), Red rotary phone #2 (Z5 Morse code), VHS tape (Z3 rewind tension), CD-ROM (Z3 scratch cleaning → map + weapon), Pager/beeper (Z1 calculator word), Tamagotchi (Z4 timed feeding).
