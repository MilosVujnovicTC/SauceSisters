# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Visual overhaul Phases 4-7 — completed 2026-03-27
- Phase 4: All 18 NPC chibi sprites generated + integrated
- Phase 5: Boss Enzo, Boss Bridget, Enemy Goon, Enchanted Broom sprites
- Phase 6: 16 item sprites (8 weapons, 7 power-ups, 1 recipe fragment) + drawItemById system
- Phase 7: Heart (full/empty) + coin UI sprites

## Current stage in progress
- Visual overhaul complete — ready for testing
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

## Asset inventory
### Characters (assets/sprites/characters/)
- 18 NPC south-facing PNGs (npc-*.png)
- 2 boss PNGs (boss-enzo.png, boss-bridget.png)
- 1 enemy PNG (enemy-goon.png)
- 1 broom PNG (broom.png)
- Giulia chibi walk sheet, Brodo chibi sheet (from prior sessions)

### Items (assets/sprites/items/)
- 8 weapon PNGs: weapon_flour, weapon_tomato, weapon_banana, weapon_spatula, weapon_sock, weapon_rubber_duck, weapon_rolling_pin, weapon_cdrom
- 7 power-up PNGs: powerup_broccoli, powerup_choco_milk, powerup_water, powerup_deli_meat, powerup_gouda, powerup_brownie, powerup_milk
- 1 recipe PNG: recipe_fragment (shared by all 5 recipes)

### UI (assets/sprites/ui/)
- heart_full.png, heart_empty.png, coin.png

## Code changes this session
- **manifest.json:** NPC keys remapped to world.js IDs, added itemSprites section, added UI sprites
- **sprites.js:** Added `drawItemById()`, updated `_loadAllSheets` to load itemSprites, enhanced `drawUI` with scaling
- **world.js:** World item rendering uses `drawItemById` first
- **ui.js:** HUD inventory uses `drawItemById`, hearts use `drawUI` with PixelLab sprites, coin uses `drawUI`
- **weapons.js:** Weapon HUD uses `drawItemById`
- **entities.js:** Power-up world rendering + buff HUD icon use `drawItemById`
- **index.html:** Cache-busting v=48

## CONFIG values
- TILE_SIZE: 32
- CANVAS_W: 768 (dynamic)
- CANVAS_H: 576

## Next steps
- Test the game via HTTP server to verify all PixelLab sprites load
- Optional: Generate sprites for 3 missing NPCs (market_vendor, market_cat_lady, canal_fisherman)
- Optional: Generate interactive object sprites (Nokia, BMX, NES cartridge, etc.)
- Proceed to next BACKLOG stage after visual overhaul is confirmed working
