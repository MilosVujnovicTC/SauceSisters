# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Visual rendering polish (V-6) — completed 2026-03-28
- Y-sorted render pipeline, drop shadows, wall highlights, ambient light
- Multi-tile objects (connected counters, 2x2 stoves/stalls, 1x2 bookshelves, trees)
- Tile transitions, BMX mini-game polish

## Current stage in progress
- Visual overhaul fully complete — ready for testing
- Status: awaiting user confirmation

## PixelLab character IDs (do NOT delete)
- **Giulia Chibi:** `cba57e5a-0fa8-439d-9a38-99287b4c6a5f`
- **Brodo Chibi:** `e47769b0-851e-418c-9760-b0e800a809e0`
- **Signora Betta:** `e08df1ef-001b-49f8-a4fe-4dcefc6500f7`
- **Papa Marco:** `8cb388a2-d6d1-45cc-878d-a34c4fd58978`
- **Enzo:** `7985b943-46a0-48de-bf4f-cc643ae9a289`
- **Mama Rosa:** `a0b27d85-7010-4e28-addb-68d5c73fff25`
- **Luigi:** `2fb9bca8-e788-4175-bd13-f35f5541a201`
- **Zia Carmela:** `f752c70a-3426-4d79-8480-75aaf37a71e4`
- **Signora Lucia:** `d9bbb88e-5b2c-4687-8f8a-45467e9102fb`
- **Prof Gatto:** `6bb50c18-1fe1-42d9-8cf8-962f19837876`
- **Coach Fabio:** `faf9000d-66d0-4199-94a3-4ad2e5ebf345`
- **Juice Bar Jenny:** `d06190ea-18da-46f1-97b4-91a43cf7cdc1`
- **Big Tony:** `b935410b-cff5-4b88-8bcf-41208fc7f470`
- **Vendor Gianluca:** `f7ddea5e-8025-407e-b123-7354415fc75d`
- **Nonna Viola:** `34f5082a-7090-40d8-8a18-744307c7e343`
- **Accordion Carlo:** `b26e81d7-95b9-4b06-8aac-8fb60211b2dc`
- **Signora Threads:** `156aab17-96b7-478d-9931-dc11f6995337`
- **Little Tomas:** `c3e4e91b-1188-4b41-824f-b426a100d868`
- **Waiter Marco Jr:** `9b6a0aa5-1ae7-4274-9544-54fd3e574c03`
- **Waitress Sofia:** `3a441d69-8266-4852-b52c-366f28582c45`
- **Boss Enzo:** `fd30a69f-eeb4-4872-8c33-c609ef09757b`
- **Boss Bridget:** `33191a1a-a287-450d-abbb-8a88b9e61cbe`
- **Market Goon:** `f7038ac0-cade-4fd6-a04e-77dd05c12492`
- **Enchanted Broom:** `38b4e039-8044-49bc-9877-c37fdb7d7d50`

## NPC ID mapping (manifest key → sprite file)
| manifest key (= world.js npc.id) | sprite file | NPC name |
|---|---|---|
| signora_betta | npc-betta.png | Signora Betta |
| papa | npc-papa.png | Papa Marco (hint system) |
| enzo | npc-enzo.png | Enzo |
| mama_rosa | npc-mama-rosa.png | Mama Rosa |
| chef_tutorial | npc-luigi.png | Sous Chef Luigi |
| canal_duck_lady | npc-carmela.png | Zia Carmela |
| librarian | npc-lucia.png | Signora Lucia |
| library_reader | npc-gatto.png | Professor Gatto |
| gym_trainer | npc-fabio.png | Coach Fabio |
| gym_smoothie | npc-jenny.png | Juice Bar Jenny |
| gym_lifter | npc-tony.png | Big Tony |
| piazza_vendor | npc-gianluca.png | Vendor Gianluca |
| piazza_nonna | npc-viola.png | Nonna Viola |
| piazza_musician | npc-carlo.png | Accordion Carlo |
| shop_cat_lady | npc-threads.png | Signora Threads |
| shop_assistant | npc-tomas.png | Little Tomás |
| pizzeria_waiter1 | npc-marco-jr.png | Waiter Marco Jr |
| pizzeria_waiter2 | npc-sofia.png | Waitress Sofia |

**NPCs without sprites (procedural fallback):** market_vendor, market_cat_lady, canal_fisherman

## Code changes this session (V-6)

### js/engine.js
- Replaced fixed-order render calls (lines 734-777) with Y-sorted entity pass
- Collects NPCs, pushables, objects, enemies, bosses, broom, Brodo, player, items, power-ups, tree decorations into sortList
- Sorted by bottom-edge Y ascending, rendered in depth order
- Ground effects (sparkles, traps) before Y-sort; overlays (projectiles, boss attacks) after
- Interaction prompts (renderNPCPrompt, renderInteractionPrompts) after Y-sort

### js/entities.js
- Extracted renderSingleNPC() from renderNPCs() loop body
- Extracted renderSingleEnemy() from renderEnemies() loop body
- Extracted renderSinglePowerup() from renderPowerups() loop body
- Split NPC interaction prompt into renderNPCPrompt()
- Original batch functions now delegate to single-entity functions

### js/world.js
- Extracted renderSinglePushable() from renderPushables()
- Extracted renderSingleObject() from renderObjects()
- Extracted renderSingleWorldItem() from renderWorldItems()
- Split object interaction prompt into renderInteractionPrompts()
- Added drop shadows to pushables (radiusX=13), objects (radiusX=10), world items (radiusX=8)
- Added ZONE_DECORATIONS data (trees in Market + Piazza)
- renderTiles() new passes: tile transition blending, multi-tile overlay, wall top-face highlights, ambient light gradient

### js/sprites.js
- Added multi-tile overlay sprites in generateTileSprites():
  - counter_left, counter_mid, counter_right (connected counter variants with stone top)
  - stove_2x2 (64x64 — 4 burners + oven door with chrome handle)
  - stall_2x2 (64x64 — candy-striped awning + goods on counter)
  - shelf_1x2 (32x64 — tall bookshelf with 4 rows of colored spines)
  - tree (64x96 — 2x3 canopy+trunk decoration)

### js/puzzles.js
- BMX renderBMX(): added 3rd far parallax hill layer, wispy high-altitude clouds
- Compound sine curves for organic hill profiles (no flat tops)
- Scrolling dashed road center line
- Rotating wheel spokes based on bmx.scrollX

### index.html
- Cache-busting v=51

## CONFIG values
- TILE_SIZE: 32
- CANVAS_W: 768 (dynamic)
- CANVAS_H: 576

## Next steps
- Test the game via HTTP server to verify all visual improvements
- Optional: Phase 6 decorative elements (cats, buckets, bollards, hanging pots)
- Optional: Generate sprites for 3 missing NPCs (market_vendor, market_cat_lady, canal_fisherman)
- Proceed to next BACKLOG stage after visual overhaul is confirmed working
