# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage V-3: PixelLab asset generation (Phases 1-3) — completed 2026-03-26

## Current stage in progress
- Visual overhaul: PixelLab asset generation
- Status: in progress — Phases 1-3 done (Giulia, Brodo, tiles), Phases 4-7 remaining (NPCs, bosses, items, UI)
- What's done so far:
  - SpriteLoader system + manifest.json + full-screen CSS scaling
  - Zone color palettes, walk sprite bob, power-up glow upgrade, warm title screen, portrait vignette
  - Giulia: 4-dir walk cycle spritesheet (128x128) — chibi, pink shirt, pale skin, large eyes
  - Brodo: 5-state strip (160x32) — walk, idle, sit, bark, sniff
  - Universal tileset: 35 tiles (160x224 grid) — terrain tiles regenerated flat for seamless tiling
- What remains:
  - Phase 4: 17 NPC sprites (create_character → extract south-facing frame)
  - Phase 5: 2 bosses + 2 enemies
  - Phase 6: 4 item sheets (weapons, powerups, recipes, objects)
  - Phase 7: UI elements (HUD, dialogue box)

## PixelLab state
- **Subscription:** Active (paid)
- **Existing characters (do NOT delete):**
  - Giulia v3: `c53fb1de-aa81-435a-a029-80c48c43d030` — walk animation complete
  - Brodo: `4f0c4a32-6c61-4a56-a066-e2afcac5b014` — walk/idle/bark/sneaking animations
- **Tile batches generated:** 7 total (5 original + 2 flat regenerations)
- **MCP server required:** PixelLab MCP must be configured for asset generation

## Current state of the codebase
- Files: CLAUDE.md, BACKLOG.md, HANDOFF.md, IDEAS-CHANGES.md, visual-overhaul-plan.md, index.html, assets/tiles.js, js/engine.js, js/sprites.js, js/save.js, js/audio.js, js/puzzles.js, js/entities.js, js/weapons.js, js/world.js, js/ui.js, assets/sprites/manifest.json, assets/sprites/characters/giulia.png, assets/sprites/characters/brodo.png, assets/sprites/tiles/universal.png, assets/audio/sfx/*.ogg (54 files)
- Script load order: Tone.js (CDN) → Howler.js (CDN) → tiles → engine → sprites → save → audio → puzzles → entities → weapons → world → ui
- All script tags have `?v=35` cache-busting parameters
- **IMPORTANT:** Game must be served via HTTP server (e.g., `python3 -m http.server 8080`) for SpriteLoader to load manifest.json. The `file://` protocol blocks XMLHttpRequest.
- Working features: all gameplay features from Phase 9-5 + visual overhaul infrastructure + 3 PixelLab asset sets (Giulia, Brodo, tiles)
- Known issues: NPC/boss/enemy/item sprites still use procedural fallback (not yet generated)

## CONFIG values
- TILE_SIZE: 32
- CANVAS_W: 768 (dynamic, adapts to screen aspect)
- CANVAS_H: 576

## Next step
- Continue PixelLab asset generation: Phase 4 (17 NPC sprites)
- Use `create_character` with chibi proportions, extract south-facing frame per NPC
- See visual-overhaul-plan.md and CLAUDE.md changelog for full details
