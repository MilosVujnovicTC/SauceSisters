# Sauce Sisters — Visual Overhaul Plan
## 2-Week Stardew Valley Style, Italian Palette
> Hand this entire file to Claude Code on Day 1. It contains every prompt, every task, every file change needed.

---

## Style Reference

**Primary reference image:** Pelican Town square screenshot from the Stardew Valley wiki  
→ https://stardewvalleywiki.com/mediawiki/images/0/04/Pelican_Town.png  
Upload this image to PixelLab on every generation session as the style reference.

**Palette shift:** Stardew Valley style + Italian warmth  
- Grass → warm olive green (not Pacific Northwest cool green)  
- Paths → terracotta/warm stone (not grey)  
- Water → Mediterranean teal-blue (not dark blue-grey)  
- Buildings → warm cream plaster, terracotta roofs  
- Characters → warm skin tones, saturated clothing colors  
- UI → warm parchment background, deep red/gold accents  

**Tile size:** 32×32px for all tiles and characters  
**Output format:** PNG with transparent background (all characters/objects)  
**Style keywords to include in every prompt:**  
`Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette, terracotta, olive green, Mediterranean blue, chunky outlines, warm lighting`

---

## What Claude Code Does (99% of the work)

Claude Code handles all of the following — you only drop PNG files into the right folder and approve results:

1. Rebuild `js/sprites.js` from procedural drawing → spritesheet/image loader
2. Create `assets/sprites/manifest.json` defining every sprite and its frame layout
3. Update all render calls in `engine.js`, `world.js`, `entities.js`, `weapons.js`, `ui.js`
4. Add full-screen scaling with `image-rendering: pixelated`
5. Add `devicePixelRatio` handling for retina screens
6. Apply zone color palette tinting in code (no extra PixelLab credits needed)
7. Wire up 4-directional player sprites
8. Wire up animation frame cycling for Giulia walk + Brodo idle
9. Update NPC portrait rendering to use generated sprites
10. Update CLAUDE.md, BACKLOG.md, HANDOFF.md on completion

---

## Asset Folder Structure

Claude Code creates this on Day 1 before any assets arrive:

```
assets/
  sprites/
    manifest.json         ← master sprite registry
    characters/
      giulia.png          ← 4-dir walk spritesheet (128x128: 4 cols × 4 rows)
      brodo.png           ← 5-state spritesheet
      npc-betta.png       ← static, 4-dir (128x32: 4 cols × 1 row)
      npc-papa.png
      npc-enzo.png
      npc-mama-rosa.png
      npc-luigi.png
      npc-carmela.png
      npc-lucia.png
      npc-gatto.png
      npc-fabio.png
      npc-jenny.png
      npc-tony.png
      npc-gianluca.png
      npc-viola.png
      npc-carlo.png
      npc-threads.png
      npc-tomas.png
      npc-marco-jr.png
      npc-sofia.png
      boss-enzo.png       ← static boss sprite (32x32 or 48x48)
      boss-bridget.png
      enemy-goon.png      ← enemy spritesheet
      broom.png
    tiles/
      universal.png       ← master tileset (256x256 or larger)
    items/
      weapons.png         ← all 8 weapons on one sheet (8x1 grid of 32x32)
      powerups.png        ← all 7 powerups on one sheet (7x1 grid of 32x32)
      recipes.png         ← 5 recipe fragments (5x1 grid of 32x32)
      objects.png         ← interactive objects (nokia, cartridge, bmx, vhs, cd, phones, pager, tamagotchi, printer)
    ui/
      hud.png             ← hearts, inventory slots, weapon slot, powerup bar
      dialogue.png        ← dialogue box frame
      portraits.png       ← all 17 NPC portraits (17x1 grid of 64x64)
```

---

## Week 1 — Asset Generation + Integration

---

### Day 1 (You — ~2 hours in PixelLab)

**Goal:** Lock the art style. Everything else follows from Giulia.

#### GIULIA — Player Character
**What to generate:** 4-directional walk cycle spritesheet  
**PixelLab tool:** Generate character → Rotation tool (4-dir) → Animate (walk cycle)  
**Output:** Single PNG, 4 columns (down/left/right/up) × 4 rows (walk frames) = 128×128px  

**Prompt:**
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
young girl ~13 years old, dark curly hair in a ponytail, white chef apron over
a green t-shirt, jeans, brown shoes, warm olive skin tone, determined expression,
chunky outlines, soft warm lighting, transparent background
```

**Iterate until:** You can see her face, her apron reads clearly, she looks like the protagonist of a Pixar short. Spend up to 15 generations here — she's the anchor.

---

#### BRODO — Basset Hound Companion
**What to generate:** 5-state idle spritesheet  
**PixelLab tool:** Generate character (animal)  
**Output:** Single PNG, 5 columns (follow/idle/sit/bark/sniff) × 1 row = 160×32px  

**Prompt:**
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
basset hound dog, tan and white, long droopy ears, sad puppy eyes, small stubby
legs, top-down view, chunky outlines, transparent background, 5 animation states:
walking alongside owner, sitting idle, lying down napping, barking (mouth open),
sniffing ground (nose down)
```

---

#### UNIVERSAL TILESET
**What to generate:** One master tileset covering all zones  
**PixelLab tool:** Create tileset / Create map  
**Output:** Single PNG tileset sheet, ~256×256px  

**Prompt:**
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
tileset sheet with the following tile types in a grid:
- grass (olive green, warm)
- dirt path (terracotta/warm stone)
- cobblestone (warm grey-beige)
- wooden floor planks (warm oak)
- kitchen tile floor (warm cream checkerboard)
- stone wall (warm plaster)
- water (Mediterranean teal-blue, animated shimmer frames)
- roof tile (terracotta red-orange)
- counter/shelf edge (warm wood)
- carpet/rug (deep red, ornate)
- fabric rolls (pink/floral)
- door (wooden arch)
Clean grid layout, each tile 32x32, consistent warm Italian lighting
```

**Save the tileset and note which grid position = which tile type for manifest.json**

---

### Day 1 (Claude Code — parallel, no assets needed yet)

**Task A: Rebuild sprite system architecture**

Replace the entire contents of `js/sprites.js` with a new image-based sprite loader:

```javascript
// NEW js/sprites.js — Image-based sprite loader
// Replaces all procedural canvas drawing

const SpriteLoader = {
  images: {},
  loaded: 0,
  total: 0,

  load(manifest, onComplete) {
    // Load all images defined in manifest
    // Call onComplete when all images are loaded
    // Fall back to colored placeholder rectangles if image fails to load
    // Log which assets are missing so developer can see what still needs generating
  },

  draw(ctx, spriteId, frameX, frameY, destX, destY, width=32, height=32) {
    // Draw a specific frame from a spritesheet
    // If image not loaded, draw a colored placeholder rectangle with the spriteId label
  },

  drawTile(ctx, tileType, destX, destY) {
    // Look up tile type in manifest, draw correct frame from universal tileset
  }
};
```

**Task B: Create `assets/sprites/manifest.json`** with placeholder entries for every asset (all pointing to placeholder colors initially):

```json
{
  "tiles": {
    "GRASS":    { "sheet": "tiles/universal.png", "fx": 0, "fy": 0 },
    "PATH":     { "sheet": "tiles/universal.png", "fx": 1, "fy": 0 },
    "COBBLE":   { "sheet": "tiles/universal.png", "fx": 2, "fy": 0 },
    "WOOD":     { "sheet": "tiles/universal.png", "fx": 3, "fy": 0 },
    "FLOOR":    { "sheet": "tiles/universal.png", "fx": 4, "fy": 0 },
    "WALL":     { "sheet": "tiles/universal.png", "fx": 0, "fy": 1 },
    "WATER":    { "sheet": "tiles/universal.png", "fx": 1, "fy": 1, "frames": 4 },
    "ROOF":     { "sheet": "tiles/universal.png", "fx": 2, "fy": 1 },
    "COUNTER":  { "sheet": "tiles/universal.png", "fx": 3, "fy": 1 },
    "CARPET":   { "sheet": "tiles/universal.png", "fx": 4, "fy": 1 },
    "FABRIC":   { "sheet": "tiles/universal.png", "fx": 0, "fy": 2 },
    "DOOR":     { "sheet": "tiles/universal.png", "fx": 1, "fy": 2 },
    "STOVE":    { "sheet": "tiles/universal.png", "fx": 2, "fy": 2 },
    "OVEN":     { "sheet": "tiles/universal.png", "fx": 3, "fy": 2 },
    "FOUNTAIN": { "sheet": "tiles/universal.png", "fx": 4, "fy": 2, "frames": 4 },
    "COBBLE2":  { "sheet": "tiles/universal.png", "fx": 0, "fy": 3 },
    "CHECKERED":{ "sheet": "tiles/universal.png", "fx": 1, "fy": 3 },
    "DINING":   { "sheet": "tiles/universal.png", "fx": 2, "fy": 3 },
    "SAUCEMACH":{ "sheet": "tiles/universal.png", "fx": 3, "fy": 3 },
    "SEWMACH":  { "sheet": "tiles/universal.png", "fx": 4, "fy": 3 },
    "MANNEQUIN":{ "sheet": "tiles/universal.png", "fx": 0, "fy": 4 },
    "SHELF":    { "sheet": "tiles/universal.png", "fx": 1, "fy": 4 },
    "BARREL":   { "sheet": "tiles/universal.png", "fx": 2, "fy": 4 },
    "STALL":    { "sheet": "tiles/universal.png", "fx": 3, "fy": 4 },
    "RUG":      { "sheet": "tiles/universal.png", "fx": 4, "fy": 4 }
  },
  "characters": {
    "giulia": {
      "sheet": "characters/giulia.png",
      "frameW": 32, "frameH": 32,
      "directions": { "down": 0, "left": 1, "right": 2, "up": 3 },
      "walkFrames": 4
    },
    "brodo": {
      "sheet": "characters/brodo.png",
      "frameW": 32, "frameH": 32,
      "states": { "follow": 0, "idle": 1, "sit": 2, "bark": 3, "sniff": 4 }
    }
  },
  "npcs": {
    "betta":    { "sheet": "characters/npc-betta.png",    "frameW": 32, "frameH": 32 },
    "papa":     { "sheet": "characters/npc-papa.png",     "frameW": 32, "frameH": 32 },
    "enzo":     { "sheet": "characters/npc-enzo.png",     "frameW": 32, "frameH": 32 },
    "mama":     { "sheet": "characters/npc-mama-rosa.png","frameW": 32, "frameH": 32 },
    "luigi":    { "sheet": "characters/npc-luigi.png",    "frameW": 32, "frameH": 32 },
    "carmela":  { "sheet": "characters/npc-carmela.png",  "frameW": 32, "frameH": 32 },
    "lucia":    { "sheet": "characters/npc-lucia.png",    "frameW": 32, "frameH": 32 },
    "gatto":    { "sheet": "characters/npc-gatto.png",    "frameW": 32, "frameH": 32 },
    "fabio":    { "sheet": "characters/npc-fabio.png",    "frameW": 32, "frameH": 32 },
    "jenny":    { "sheet": "characters/npc-jenny.png",    "frameW": 32, "frameH": 32 },
    "tony":     { "sheet": "characters/npc-tony.png",     "frameW": 32, "frameH": 32 },
    "gianluca": { "sheet": "characters/npc-gianluca.png", "frameW": 32, "frameH": 32 },
    "viola":    { "sheet": "characters/npc-viola.png",    "frameW": 32, "frameH": 32 },
    "carlo":    { "sheet": "characters/npc-carlo.png",    "frameW": 32, "frameH": 32 },
    "threads":  { "sheet": "characters/npc-threads.png",  "frameW": 32, "frameH": 32 },
    "tomas":    { "sheet": "characters/npc-tomas.png",    "frameW": 32, "frameH": 32 },
    "marco-jr": { "sheet": "characters/npc-marco-jr.png", "frameW": 32, "frameH": 32 },
    "sofia":    { "sheet": "characters/npc-sofia.png",    "frameW": 32, "frameH": 32 }
  },
  "bosses": {
    "enzo-boss":  { "sheet": "characters/boss-enzo.png",    "frameW": 32, "frameH": 32 },
    "bridget":    { "sheet": "characters/boss-bridget.png", "frameW": 32, "frameH": 32 }
  },
  "enemies": {
    "goon":  { "sheet": "characters/enemy-goon.png", "frameW": 32, "frameH": 32 },
    "broom": { "sheet": "characters/broom.png",      "frameW": 32, "frameH": 32 }
  },
  "items": {
    "weapons":  { "sheet": "items/weapons.png",  "frameW": 32, "frameH": 32 },
    "powerups": { "sheet": "items/powerups.png", "frameW": 32, "frameH": 32 },
    "recipes":  { "sheet": "items/recipes.png",  "frameW": 32, "frameH": 32 },
    "objects":  { "sheet": "items/objects.png",  "frameW": 32, "frameH": 32 }
  },
  "ui": {
    "hud":       { "sheet": "ui/hud.png",       "frameW": 32, "frameH": 32 },
    "dialogue":  { "sheet": "ui/dialogue.png",  "frameW": 32, "frameH": 32 },
    "portraits": { "sheet": "ui/portraits.png", "frameW": 64, "frameH": 64 }
  }
}
```

**Task C: Add full-screen scaling to `index.html`**

Add to `<style>` in index.html:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #1a0a00; display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; overflow: hidden; }
#gameCanvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  width: min(100vw, calc(100vh * 4/3));
  height: min(100vh, calc(100vw * 3/4));
}
```

Add to engine.js `init()`:
```javascript
function handleResize() {
  const dpr = window.devicePixelRatio || 1;
  // Canvas internal resolution stays fixed at 768x576
  // CSS handles visual scaling via the style rules above
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', handleResize);
handleResize();
```

**Task D: Keep game fully playable with placeholder art**  
All existing procedural drawing in sprites.js should be preserved as fallback. If a sprite image hasn't loaded, fall back to the existing colored rectangle. This ensures the game plays throughout the overhaul.

---

### Day 2 (You — ~1 hour in PixelLab)

**Goal:** All 17 NPCs as static standing sprites.  
**PixelLab tool:** Style-consistent generation — upload Giulia as reference image for every NPC.  
**Output per NPC:** Single 32×32 PNG (or 4-direction 128×32 sheet if credits allow)

Use this base prompt for every NPC, swapping the description:

```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
[CHARACTER DESCRIPTION BELOW], chunky outlines, warm lighting, transparent background,
style consistent with reference image (Giulia character)
```

**NPC descriptions — copy/paste one per generation:**

| NPC ID | Description for prompt |
|--------|----------------------|
| `npc-betta` | elderly woman, grey bun, reading glasses, floral apron, warm smile, slightly hunched |
| `npc-papa` | tall adult man, headset/earpiece, coaching whistle around neck, track jacket, salt-pepper hair |
| `npc-enzo` | adult man, tall white chef hat, pointed handlebar mustache, red chef jacket, arms crossed, smug expression |
| `npc-mama-rosa` | warm middle-aged woman, flour-dusted apron over floral dress, dark hair with grey streaks, warm maternal expression |
| `npc-luigi` | stocky middle-aged man, grocer apron, little mustache, proud expression, holding a tomato |
| `npc-carmela` | middle-aged woman, floral blouse, gold earrings, gossipy expression, hand on hip |
| `npc-lucia` | teenage girl, school uniform, backpack, curious expression, slightly scruffy |
| `npc-gatto` | older man, round glasses, bow tie, cardigan, holding a book, professorial expression |
| `npc-fabio` | athletic adult man, tank top, baseball cap backwards, energetic expression, muscular |
| `npc-jenny` | young woman, ponytail, juice bar apron, holding a smoothie, cheerful expression |
| `npc-tony` | large barrel-chested man, butcher apron, friendly giant expression, gentle smile |
| `npc-gianluca` | young man, straw hat tilted, vendor apron, holding a cannoli, charming smile |
| `npc-viola` | elderly woman, purple shawl, round glasses, pigeons perching on her arms, serene |
| `npc-carlo` | middle-aged man, beret, open shirt, holding an accordion, always mid-song expression |
| `npc-threads` | eccentric older woman, cat-eye glasses, measuring tape around neck, pincushion wristband |
| `npc-tomas` | eager young boy ~8 years old, big eyes, freckles, oversized work shirt, enthusiastic |
| `npc-marco-jr` | young man, nervous expression, bow tie slightly crooked, waiter uniform |
| `npc-sofia` | young woman, exasperated expression, ponytail, waiter uniform, one eyebrow raised |

---

### Day 2 (Claude Code — parallel)

**Task:** Integrate Giulia and Brodo sprites + tileset into live game.

- Update `entities.js` player render function to use `SpriteLoader.draw()` with directional frames
- Map existing `player.facing` values (up/down/left/right) to correct spritesheet rows
- Add simple 4-frame walk cycle animation cycling (frame advances every 8 game ticks while moving, resets to frame 0 when still)
- Update `entities.js` Brodo render to use `brodo.png` with correct state frame
- Update `world.js` tile rendering to use `SpriteLoader.drawTile()` for all tile types
- Update `manifest.json` tile grid positions to match the actual tileset PNG you receive

**After this day:** Game should show Giulia with real sprite walking on real tiles.

---

### Day 3 (You — ~1 hour in PixelLab)

**Goal:** Bosses, enemies, broom.

#### BOSS: ENZO (chef boss form — larger/angrier than NPC version)
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
angry chef boss, tall white hat, red chef jacket, pointed mustache, dramatic evil
expression, arms raised in attack pose, slightly larger than normal NPC, chunky
outlines, transparent background
```

#### BOSS: BRIDGET (Wedding Planner)
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
stressed wedding planner boss, purple blazer, auburn hair in tight bun, clipboard
in hand, forehead vein visible, heels, overwhelmed but dangerous expression,
chunky outlines, transparent background
```

#### ENEMY: MARKET GOON
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
generic henchman enemy, dark vest, cap pulled low, sneaky expression, arms out
in chase pose, chunky outlines, transparent background
```

#### ENCHANTED BROOM
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
magical flying broom, classic witch broom shape, golden glow around it, slightly
tilted, straw bristles at bottom, chunky outlines, transparent background
```

---

### Day 3 (Claude Code — parallel)

**Task:** Integrate all NPC sprites.

- Update `entities.js` NPC render function to use `SpriteLoader.draw()` keyed by `npc.id`
- NPC sprites are static (no walk animation needed — direction flip only)
- Flip sprite horizontally when NPC faces right vs left (canvas `scale(-1,1)` trick)
- Integrate boss sprites into boss fight render functions in `entities.js`
- Integrate enemy goon sprites
- Integrate broom sprite

---

### Day 4 (You — ~1 hour in PixelLab)

**Goal:** All items, weapons, power-ups, objects.

**Approach:** Generate each category as a single horizontal sprite sheet (all on one PNG) — faster and easier to integrate.

#### WEAPONS SHEET (8 items in a row, each 32×32)
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
horizontal sprite sheet of 8 kitchen weapons, each in its own 32x32 cell:
1. bag of flour (white sack with puff cloud)
2. red tomato (ripe, with stem)
3. yellow banana (curved)
4. wooden spatula (kitchen spatula)
5. dirty sock (grey, wavy stink lines)
6. colorful plastic toy (small rubber duck or similar)
7. rolling pin (wooden, classic)
8. CD-ROM disc (shiny silver disc)
clean white/transparent background, item icons style, consistent scale
```

#### POWER-UPS SHEET (7 items in a row, each 32×32)
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
horizontal sprite sheet of 7 food power-up items, each in its own 32x32 cell:
1. broccoli (green floret)
2. chocolate milk carton (brown, straw)
3. water bottle (clear blue)
4. deli meat slice (pink, folded)
5. wedge of gouda cheese (yellow-orange)
6. brownie/muffin (chocolate, crumbles)
7. milk carton (white, red cap)
clean transparent background, item icons, warm Italian palette
```

#### RECIPE FRAGMENTS SHEET (5 items in a row, each 32×32)
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
horizontal sprite sheet of 5 recipe fragments, each in its own 32x32 cell:
aged paper fragments with handwritten Italian text visible, torn/scorched edges,
each fragment slightly different shape and stain pattern, warm parchment tones,
golden glow effect, transparent background
```

#### OBJECTS SHEET (9 items in a row, each 32×32)
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
horizontal sprite sheet of 9 interactive objects, each in its own 32x32 cell:
1. Nokia 3210 phone (small, grey, classic brick phone)
2. red rotary phone (classic dial phone)
3. BMX bicycle (small top-down view)
4. VHS tape (black cassette, label)
5. pager/beeper (small black rectangle, green display)
6. NES cartridge (grey game cartridge)
7. Tamagotchi (egg-shaped virtual pet device)
8. dot-matrix printer (boxy printer, paper coming out)
9. CD-ROM in case (jewel case)
transparent background, consistent scale, warm palette
```

---

### Day 4 (Claude Code — parallel)

**Task:** Integrate all items and objects.

- Update `weapons.js` item render to use weapons sheet with correct frame index
- Update power-up world item render to use powerups sheet
- Update recipe fragment render to use recipes sheet
- Update all interactive object renders in `world.js` to use objects sheet
- Update `manifest.json` with exact frame indices for each item

---

### Day 5 (You — ~30 min in PixelLab)

**Goal:** UI elements + review pass.

#### HUD ELEMENTS SHEET
```
Stardew Valley style, top-down RPG, 32x32 pixel art, warm Italian color palette,
horizontal sprite sheet of HUD elements:
- heart (full, half, empty — 3 frames)
- inventory slot background (warm wood frame)
- weapon slot background (slightly larger, warm gold frame)
- power-up bar background (rounded, warm parchment)
- coin icon (gold coin with shine)
transparent background, warm Italian UI style
```

#### DIALOGUE BOX FRAME
```
Stardew Valley style, top-down RPG, pixel art, warm Italian color palette,
dialogue box frame/border for a game UI, wide horizontal box,
warm parchment/cream background with terracotta/dark red ornate border,
aged paper texture, slight drop shadow, Italian manuscript style,
no text inside, just the frame, 384x96 pixels
```

#### REVIEW PASS
Go through the full game in the browser. Flag any sprites that look wrong — wrong size, wrong style, wrong color. List them. Claude Code will note them for Day 9 regeneration.

---

### Day 5 (Claude Code — parallel)

**Task:** Integrate UI + full audit.

- Update `ui.js` HUD rendering to use `hud.png` sprite sheet
  - Hearts: draw correct frame (full/half/empty) from sheet
  - Inventory slots: draw frame behind each item
  - Weapon slot: draw frame behind weapon icon
  - Power-up bar: draw frame + fill based on timer
  - Coin icon: draw from sheet next to score counter
- Update `ui.js` dialogue box to use `dialogue.png` as the box background frame
- Update NPC portrait rendering: use NPC sprite scaled to 64×64 inside the portrait frame area in dialogue box
- **Full asset audit:** Walk through every zone, log to console any sprite still using placeholder colored rectangle
- Fix any misaligned sprites, wrong frame indices, scaling issues

---

### Day 6–7: Buffer (Claude Code)

Fix everything flagged during testing:
- Any zones with missing tile sprites
- Any NPCs not showing correct directional flip
- Any items with wrong frame indices
- Any UI elements misaligned

---

## Week 2 — Polish + Full-Screen + Quality Pass

---

### Day 8 (Claude Code)

**Task: Zone color palette differentiation**

Since all zones share one tileset, use canvas color tinting to make each zone feel distinct. No PixelLab credits needed.

Implement a `ZonePalette` system in `engine.js`:

```javascript
const ZONE_PALETTES = {
  'lacucina':  { hue: 0,    saturation: 1.0, brightness: 1.0, name: 'Warm kitchen gold' },
  'market':    { hue: 15,   saturation: 1.1, brightness: 1.05, name: 'Sunny market orange' },
  'canal':     { hue: -20,  saturation: 0.9, brightness: 0.95, name: 'Cool Mediterranean blue' },
  'library':   { hue: 30,   saturation: 0.8, brightness: 0.9,  name: 'Amber amber dusk' },
  'gym':       { hue: -10,  saturation: 1.2, brightness: 1.1,  name: 'Energetic bright' },
  'piazza':    { hue: 10,   saturation: 1.0, brightness: 1.05, name: 'Warm plaza afternoon' },
  'pizzeria':  { hue: 5,    saturation: 1.3, brightness: 0.95, name: 'Hot kitchen red' },
  'sewingshop':{ hue: -5,   saturation: 0.85, brightness: 1.0, name: 'Soft pink workshop' }
};
```

Apply via CSS filter on canvas during zone transitions (fade transition already exists — apply tint after fade).

---

### Day 8 (Claude Code continued)

**Task: Full-screen scaling verification**

Test and confirm at these scenarios:
- 1920×1080 browser (most common) — game fills screen, no stretch
- 1280×720 browser — game fills screen
- Narrow/tall window — letterboxed with black bars, not stretched
- Browser zoom in/out — game scales correctly
- Retina/HiDPI screen — pixels are sharp, not blurry

Fix any edge cases found.

---

### Day 9 (You — ~1 hour in PixelLab)

**Goal:** Regenerate the 3–5 assets that look weakest at full-screen size.

By now you've seen everything at actual game scale. The most common things to regenerate:
- Giulia (she's on screen 100% of the time — worth getting perfect)
- The tileset (grass/path transitions most visible)
- The most frequently seen NPC (Signora Betta in Zone 1)

No new prompts needed — reuse Day 1 prompts with small tweaks.

---

### Day 9 (Claude Code)

**Task: Giulia walk animation polish**

Upgrade from 4-frame walk to a more expressive cycle:
- Frame 0: neutral stand
- Frame 1: left foot forward, slight lean
- Frame 2: neutral stand
- Frame 3: right foot forward, slight lean

Add subtle sprite bob: player y-position gets ±1px offset in sync with walk frame (gives weight/life to movement even with simple sprite).

Add **power-up glow effect** when buff is active:
- Draw a soft colored halo behind Giulia using canvas `shadowBlur` + `shadowColor`
- Color matches power-up type (green = Iron Legs, brown = Sugar Rush, blue = Cool Head, etc.)

---

### Day 10 (Claude Code)

**Task: Animated tiles**

Two tiles have animation defined in the manifest (`WATER` and `FOUNTAIN` — 4 frames each):
- Add `tileAnimFrame` counter to engine game loop (increments every 15 ticks)
- Water tiles cycle through 4 shimmer frames
- Fountain tiles cycle through 4 splash frames
- Firefly/shimmer effect on Brodo sniff radius (existing sparkle effect gets a sprite glow)

---

### Day 11 (Claude Code)

**Task: Portraits + title screen**

- Update `ui.js` dialogue portrait to use NPC sprites scaled and centered in the portrait box
- Add a warm vignette border around portraits (canvas radial gradient overlay)
- Update title screen: replace existing canvas-drawn title with the game's warm palette
  - Background: deep warm terracotta gradient instead of black
  - Title text: same but with warm gold/cream color
  - Starfield: replace with subtle floating tomatoes/herbs at low opacity
- Update CLAUDE.md, BACKLOG.md, HANDOFF.md to document the new visual system

---

### Day 12–13: Full Playtest (You)

Play through the entire game start to finish. For each zone, note:
- Any sprite that looks obviously wrong
- Any tile that breaks the visual style
- Any UI element that's hard to read
- Anything that looks better than expected (to keep)

Claude Code fixes everything flagged.

---

### Day 14: Final Pass (Claude Code)

- Bump cache-busting version to `?v=29` on all scripts
- Remove all console.log placeholder warnings from sprite loader
- Confirm all 8 zones have correct palette tint applied
- Confirm full-screen works at 1080p and 720p
- Final CLAUDE.md update with complete visual system documentation

---

## Quick Reference: PixelLab Settings

Use these settings for every generation session:

| Setting | Value |
|---------|-------|
| Reference image | Pelican Town screenshot (upload every session) |
| Output size | 32×32 (characters), 256×256 (tilesets), 384×96 (dialogue box) |
| Style | Upload reference image — don't rely on text alone |
| Background | Transparent (all characters and items) |
| Model | Use basic model (1 credit) for items/tiles; Pro model (40 credits) for characters where style consistency matters |

## Credit Budget (Tier 1 — ~1,000 credits/month)

| Day | Asset category | Model | Est. credits |
|-----|---------------|-------|-------------|
| 1 | Giulia (with iterations) | Pro | ~60 |
| 1 | Brodo | Basic | ~5 |
| 1 | Tileset | Basic | ~10 |
| 2 | 17 NPCs | Mix | ~120 |
| 3 | Bosses + enemies + broom | Basic | ~20 |
| 4 | Weapons + power-ups + recipes + objects | Basic | ~20 |
| 5 | UI elements | Basic | ~10 |
| 9 | Regeneration pass | Pro | ~40 |
| **Total** | | | **~285 credits** |

Well within Tier 1 limits. You'll use roughly 30% of your monthly allowance.

---

## Files Changed by Claude Code

| File | What changes |
|------|-------------|
| `js/sprites.js` | Complete rewrite — image loader replaces procedural drawing |
| `js/engine.js` | Full-screen scaling, palette tinting, walk animation |
| `js/entities.js` | All character/NPC/enemy render calls |
| `js/world.js` | All tile render calls, object render calls |
| `js/weapons.js` | Item/weapon sprite rendering |
| `js/ui.js` | HUD, dialogue box, portraits |
| `index.html` | CSS scaling rules |
| `assets/sprites/manifest.json` | New file — master sprite registry |
| `CLAUDE.md` | Document new visual system |
| `BACKLOG.md` | Mark visual overhaul stages complete |
| `HANDOFF.md` | Update with new asset pipeline info |

---

*End of visual overhaul plan. Hand this file to Claude Code at the start of Day 1.*
