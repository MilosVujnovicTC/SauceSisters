# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Visual polish commit (bd35e2f) — 2026-03-27
- Muted palette, tile fixes, chibi characters, NW lighting, character shadows

## Current stage in progress
- Visual overhaul: Phase 4 — NPC sprite generation
- Status: in progress
- What's done so far:
  - 1/17 NPCs downloaded: Betta (npc-betta.png)
  - 4 generating in PixelLab: Papa Marco, Enzo, Mama Rosa v3, Luigi v3
  - 12 remaining: Carmela, Lucia, Gatto, Fabio, Jenny, Tony, Gianluca, Viola, Carlo, Threads, Tomas, Marco Jr + Sofia
  - NPC drawNPC() updated with displaySize=44 scaling
- What remains:
  - Download remaining batch 1 NPCs when generation completes
  - Generate batches 2 + 3 (12 more NPCs)
  - Download south-facing rotation PNGs as npc-{id}.png
  - Phase 5: bosses + enemies
  - Phase 6: item sprites
  - Phase 7: UI elements

## PixelLab character IDs (do NOT delete)
- **Giulia Chibi:** `cba57e5a-0fa8-439d-9a38-99287b4c6a5f` — walk animation complete
- **Brodo Chibi:** `e47769b0-851e-418c-9760-b0e800a809e0` — walk animation complete
- **Signora Betta:** `e08df1ef-001b-49f8-a4fe-4dcefc6500f7` — downloaded
- **Papa Marco:** `8cb388a2-d6d1-45cc-878d-a34c4fd58978` — generating
- **Enzo:** `7985b943-46a0-48de-bf4f-cc643ae9a289` — generating
- **Mama Rosa v3:** `a0b27d85-7010-4e28-addb-68d5c73fff25` — generating
- **Luigi v3:** `bed70d78-6ad3-47ca-a00e-4e22537e6e6f` — generating
- Failed IDs (safe to delete): ce808124, 9c53b03f, 37e4c0de, bfef416d

## NPC generation settings (use for all remaining NPCs)
```
body_type: humanoid
proportions: {"type": "preset", "name": "chibi"}
size: 32
n_directions: 4
view: high top-down
outline: selective outline
shading: medium shading
detail: medium detail (or omit for default)
```
Download the **south rotation PNG** as the NPC sprite file (npc-{id}.png).

## Remaining NPC descriptions (batch 2 + 3)
| NPC ID | Name | Description |
|--------|------|-------------|
| carmela | Zia Carmela | cute chibi woman, floral blouse, gold earrings, gossipy expression, hand on hip |
| lucia | Signora Lucia | cute chibi woman librarian, pince-nez glasses, chain, neat hair, book |
| gatto | Prof Gatto | cute chibi older man, round glasses, bow tie, cardigan, holding book |
| fabio | Coach Fabio | cute chibi athletic man, tank top, backwards baseball cap, muscular |
| jenny | Juice Bar Jenny | cute chibi young woman, ponytail, juice bar apron, cheerful |
| tony | Big Tony | cute chibi large barrel-chested man, butcher apron, gentle smile |
| gianluca | Vendor Gianluca | cute chibi young man, straw hat, vendor apron, charming smile |
| viola | Nonna Viola | cute chibi elderly woman, purple shawl, round glasses, serene |
| carlo | Accordion Carlo | cute chibi man with beret, open shirt, accordion, mid-song |
| threads | Signora Threads | cute chibi woman, cat-eye glasses, measuring tape on neck, pincushion |
| tomas | Little Tomas | cute chibi young boy ~8, big eyes, freckles, oversized shirt |
| marco-jr | Waiter Marco Jr | cute chibi nervous young man, crooked bow tie, waiter uniform |
| sofia | Waitress Sofia | cute chibi exasperated young woman, ponytail, waiter uniform, eyebrow raised |

## Current state of the codebase
- Files: same as before + updated sprites
- Script cache-busting: ?v=46
- Working features: all gameplay + visual polish (muted tiles, shadows, chibi chars)
- Key code changes this session:
  - js/engine.js: zone palettes desaturated (0.65-0.78 saturate)
  - js/world.js: NW shadow lighting pass in renderTiles(), isSolidTile()
  - js/sprites.js: drawCharacter() displaySize param, drawNPC() displaySize param
  - js/entities.js: drawCharacterShadow(), player/brodo/NPC ground shadows, display scaling
  - assets/sprites/tiles/universal.png: muted palette, opaque edges, border-removed terrain
  - assets/sprites/manifest.json: removed WATER/FOUNTAIN animation frames

## CONFIG values
- TILE_SIZE: 32
- CANVAS_W: 768 (dynamic)
- CANVAS_H: 576

## Next step
- Check if Papa Marco, Enzo, Mama Rosa v3, Luigi v3 are complete
- Download their south rotation PNGs
- Generate remaining 12 NPCs in batches
- Integrate all NPC sprites (south-facing PNGs saved as npc-{id}.png in assets/sprites/characters/)
