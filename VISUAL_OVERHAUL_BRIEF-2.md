# VISUAL OVERHAUL BRIEF — The Sauce Sisters
> For Claude Code. Read sprites.js and all zone tile definitions before touching any code.
> This brief covers problems visible across multiple zones. Apply fixes to ALL zones, not just the ones shown.

---

## What you're looking at (screenshots analysed)

**Screenshot 1 — Papa's Gym (indoor zone)**
- Massive uniform orange-brick wall tiles dominating ~80% of the screen
- Gym equipment (weight racks/mirrors) is tiny, flat, and lacks visual hierarchy
- Two large exercise benches/mats in center look like plain striped rectangles
- Characters are almost invisible against the busy tile background
- The space feels like an empty brick warehouse, not a gym

**Screenshot 2 — Canal zone (outdoor)**
- Grass tiles are a single flat olive-green color with minimal texture variation
- The canal/dock area reads okay structurally but the water is a flat teal band
- Stone dock edges are a single gray tone — no depth or mortar variation
- Bridge planks render as plain brown rectangles with no wood grain character
- Decorative barrels/crates are small and muddy

---

## ROOT PROBLEMS (apply fixes everywhere)

### 1. Wall/floor tiles dominate the screen — they need to RECEDE visually
The brick wall tile is too saturated, too uniformly textured, and the same color as the floor in some zones. Players' eyes should go to entities and objects first, NOT the background.

**Fix in `sprites.js` → all `drawTile*` functions:**
- **Walls:** Darken base color by ~20%. Add subtle darker mortar lines. Keep texture noise but reduce contrast between brick face and mortar. Result: walls look solid but don't compete with foreground.
- **Floors:** Add 2–3 very subtle tile variation colors (±5% brightness variation per-tile, seeded by tile position). This breaks up the uniform carpet look without being busy.
- **Outdoor grass:** Use 3–4 grass color variants (dark green, medium green, light yellow-green, occasional flower pixel). Scatter short grass strokes (2–3px diagonal lines) pseudo-randomly seeded by tile `(col * 31 + row * 17) % 4`. This matches Stardew Valley's grass feel.

### 2. Indoor zones need a proper FLOOR vs WALL visual separation
Right now gym/kitchen/library all look like "wall everywhere." Real interior zones in Stardew/ALTTP have a clearly lighter floor color that contrasts with darker walls.

**Fix:**
- Gym `MAT` tile: warm beige/cream with subtle seam lines, not orange-red
- Gym `EQUIPMENT` area background: use a slightly darker floor variant
- La Cucina floor: warm wood-plank brown with horizontal grain lines
- Library floor: dark wood with subtle parquet pattern
- All indoor zones: top wall row should be significantly darker than the floor — this creates the illusion of height and depth

### 3. Zone objects need DROP SHADOWS and OUTLINES
Everything sits flat on the tile. Stardew Valley and ALTTP both use pixel drop shadows (1–2px offset, dark semi-transparent) on all solid objects.

**Fix in `sprites.js` → all object draw functions:**
Add this pattern to every object that's rendered on a floor tile:
```javascript
// Drop shadow (draw BEFORE the object)
ctx.fillStyle = 'rgba(0,0,0,0.25)';
ctx.fillRect(x + 2, y + 3, w, h); // offset 2px right, 3px down
// Then draw the object on top
```
Apply to: crates, benches, weight racks, mirrors, Nokia, cartridge, bike, barrels, bookshelves, sewing machines, counters, stalls, all interactables.

### 4. Objects need to be TALLER and have an ISOMETRIC-FEEL top face
Right now objects are mostly square blobs. Real top-down RPG objects have:
- A **top face** (lighter, 4–8px tall) suggesting a 3D top surface
- A **front face** (slightly darker, main visible surface)
- A **dark bottom edge** (1–2px, the deepest shadow)

**Fix for crates** (and apply pattern to all blocky objects):
```javascript
// Top face (light)
ctx.fillStyle = '#c8a060';
ctx.fillRect(x+1, y+1, size-2, 5);
// Front face (main)
ctx.fillStyle = '#a07840';
ctx.fillRect(x+1, y+5, size-2, size-7);
// Bottom shadow edge
ctx.fillStyle = '#604820';
ctx.fillRect(x+1, y+size-3, size-2, 2);
// Wood grain lines on front face
ctx.strokeStyle = '#8a6530';
ctx.lineWidth = 1;
for (let i = 0; i < 3; i++) {
  ctx.beginPath();
  ctx.moveTo(x+3, y+7+i*4);
  ctx.lineTo(x+size-3, y+7+i*4);
  ctx.stroke();
}
```

### 5. Characters are lost in the scene — they need to POP
Characters are dark-clothed figures on a dark/medium background with no outline. In ALTTP and Stardew, characters have:
- A **1px black outline** around the entire sprite
- A **small cast shadow** ellipse under their feet

**Fix in `sprites.js` → `generatePlayerSprite()` and all NPC sprite generators:**
After drawing the character, add an outline pass:
```javascript
// Draw black outline by rendering the sprite offset in 4 directions at -1 alpha first
// Simpler approach: thicken the existing dark pixel borders
// At minimum: ensure the hair/head has a 1px darker-than-background outline
// Add foot shadow:
ctx.fillStyle = 'rgba(0,0,0,0.3)';
ctx.beginPath();
ctx.ellipse(cx, cy + spriteH/2 - 1, spriteW/3, 3, 0, 0, Math.PI*2);
ctx.fill();
```

### 6. Water tiles need ANIMATED depth, not a flat teal band
The canal water is a static solid teal color. Water in Stardew/Zelda has:
- Darker base color (deep teal-blue, not bright)
- Lighter animated shimmer lines (sine-wave horizontal streaks)
- Subtle foam/edge pixels where it meets dock tiles

**Fix in `sprites.js` → `drawWaterTile()` and in `engine.js` update loop:**
```javascript
function drawWaterTile(ctx, x, y, size, time) {
  // Base deep water
  ctx.fillStyle = '#2a6480';
  ctx.fillRect(x, y, size, size);
  
  // Animated shimmer lines (3 per tile)
  const shimmerY = [0.25, 0.5, 0.75];
  shimmerY.forEach((offset, i) => {
    const wave = Math.sin(time * 0.002 + x * 0.05 + i * 1.2) * 2;
    ctx.fillStyle = 'rgba(100, 200, 220, 0.35)';
    ctx.fillRect(x + 2, y + size * offset + wave, size - 4, 2);
  });
  
  // Dark edge on south side (depth illusion)
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x, y + size - 2, size, 2);
}
```
Pass `game.time` (accumulating ms) into the water tile render call.

### 7. The GYM needs a complete visual identity overhaul
The gym currently looks like an empty orange brick room. It should look like a warm, lived-in Italian gym.

**Fix — specific Gym tile/object changes:**

**MAT tile** (`drawTileMAT`):
- Base: soft beige/cream `#e8d8b0` 
- Add parallel dark seam lines every 4px (like wrestling mat sections)
- Center cross-mark in faded red: `+` symbol, 50% opacity

**EQUIPMENT tile** (`drawTileEQUIPMENT`):
- Background: rubberized dark floor `#3a3028`
- Draw a barbell/weight rack suggestion: two circles (weights) connected by a bar
- Slight metallic sheen: highlights on circles

**MIRROR tile** (`drawTileMIRROR`):
- Silver/chrome frame: 2px border `#c0c0c0` with corner details
- Reflective interior: light gradient from `#d8eef8` top to `#a8c8e0` bottom
- Horizontal reflection line through middle (lighter stripe)
- This is the biggest win — mirrors on gym walls make it look like a real gym

**JUICEBAR tile** (`drawTileJUICEBAR`):
- Warm wood counter top: horizontal grain in `#8a5c2a`
- Small fruit/cup sprites on counter surface (just 2–3 colored pixels = cups)
- Overhead menu board hint: dark rectangle above counter

**Wall tiles in gym:**
- Use `#5c3820` (darker reddish-brown) for gym walls — gym walls should feel solid, not orange
- Reduce brick mortar line contrast

### 8. Stall/Market tiles need color and life
Market stalls currently look like brown rectangles. Real market stalls have:
- Colored awning stripe (alternating 2px stripes: red/white, green/white, blue/white)
- Visible produce on the counter (colored dots/shapes)
- Hanging goods suggestion (small shapes above counter)

**Fix in `sprites.js` → `drawTileSTALL()`:**
```javascript
function drawTileSTALL(ctx, x, y, size, col, row) {
  // Stall counter (wood)
  ctx.fillStyle = '#8a6040';
  ctx.fillRect(x, y + size*0.5, size, size*0.5);
  
  // Awning (colored stripes — vary by col to give each stall identity)
  const awningColors = [['#e83030','#f8f0e0'], ['#2060c0','#f8f0e0'], ['#20a040','#f8f0e0']];
  const [c1, c2] = awningColors[(col + row) % 3];
  for (let i = 0; i < size; i += 4) {
    ctx.fillStyle = i % 8 < 4 ? c1 : c2;
    ctx.fillRect(x + i, y, 4, size * 0.45);
  }
  
  // Produce dots on counter
  const produce = ['#e83020','#f8c820','#40b840']; // tomato, lemon, herb
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = produce[i];
    ctx.beginPath();
    ctx.arc(x + 5 + i*8, y + size*0.65, 3, 0, Math.PI*2);
    ctx.fill();
  }
}
```

### 9. Grass tile variation (outdoor zones: Market, Canal, Piazza)
The grass is a solid olive-green slab. 

**Fix in `sprites.js` → `drawTileGRASS()`:**
```javascript
function drawTileGRASS(ctx, x, y, size, col, row) {
  // Base color (slight variation by position)
  const bases = ['#4a7a30','#527834','#486e2c','#4e7632'];
  ctx.fillStyle = bases[(col * 3 + row * 7) % 4];
  ctx.fillRect(x, y, size, size);
  
  // Grass detail strokes (short diagonal lines)
  const seed = (col * 31 + row * 17);
  ctx.strokeStyle = 'rgba(60,100,30,0.5)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    const gx = x + ((seed * (i+1) * 13) % (size-4)) + 2;
    const gy = y + ((seed * (i+1) * 7) % (size-4)) + 2;
    ctx.beginPath();
    ctx.moveTo(gx, gy);
    ctx.lineTo(gx + 2, gy - 3);
    ctx.stroke();
  }
  
  // Occasional flower pixel (1 in 8 tiles)
  if (seed % 8 === 0) {
    ctx.fillStyle = '#f8f040'; // yellow flower
    ctx.fillRect(x + (seed % (size-4)) + 2, y + ((seed*3) % (size-4)) + 2, 2, 2);
  }
}
```

### 10. Bridge planks need wood grain and direction
Current planks look like brown boxes. They should look like actual laid wooden planks.

**Fix in `sprites.js` → bridge/plank rendering:**
- Draw planks as horizontal stripes (perpendicular to bridge direction)
- Each plank: `#8a5c2a` base with `#6a4018` grain lines every 4px
- Plank edges: darker `#4a2808` border top and bottom
- Nail dots at plank ends: 2px dark circles

---

## NEW ISSUES (from follow-up screenshots)

### 11. MULTIPLE SMALL DOORS — replace with one large double-door
**What's wrong:** Zone exits currently show 2 individual single-tile door sprites stacked vertically side-by-side. This looks like two separate cupboards, not a real building entrance. Visible in the Canal zone east exit and likely other transitions too.

**Fix in `world.js` AND `sprites.js`:**

In `sprites.js`, create a `generateLargeDoorSprite(w, h)` function that draws a proper double-door at 2×2 or 2×3 tile size:
```javascript
// Large double door structure:
// - Stone arch surround: dark grey curved top, 3px thick
// - Left door panel: warm oak (#8a5020), vertical plank lines, round brass knob on right edge
// - Right door panel: mirror of left, brass knob on left edge
// - Door frame divider: 2px dark line between panels
// - Stone step at base: lighter grey rect, 4px tall
// - Subtle door shadow on floor below
```

In `world.js`, find every zone transition that uses 2–3 adjacent `DOOR` tile entries and replace them with a single `type: 'large_door'` interactable object with `w: 2, h: 2` (drawn by the object renderer spanning 2 tile widths). The transition trigger zone and spawn coordinates stay unchanged — only the visual changes.

**Zones to audit:** Canal (east wall), Library (south exit to Gym), every zone boundary. Search `world.js` for all `DOOR` tile placements that appear at the same column or row in groups.

### 12. OBJECTS SITTING ON VISIBLE SQUARE PLATFORM (barrel, basket, etc.)
**What's wrong:** Round and organic objects — barrels, tomato baskets, flower pots — are drawn on top of a visible square background fill. The square shows around all edges of the circular sprite and makes every round object look like it's sitting on a display pedestal. Especially jarring on grass tiles where the tan/beige square clashes with the green background.

**Root cause:** Each object sprite generator in `sprites.js` begins with `ctx.fillRect(0, 0, size, size)` in a flat background color. This base rect leaks out around the circular content on all four sides.

**Fix in `sprites.js` — ALL round/organic object generators:**

1. Remove the `ctx.fillRect(0, 0, size, size)` background call from every circular object sprite.
2. Ensure the offscreen canvas for each sprite starts as fully transparent: it should begin with `ctx.clearRect(0, 0, w, h)`, not a filled rect.
3. Replace the square background with a soft elliptical ground shadow only:
```javascript
// Foot shadow — soft ellipse, no square
ctx.fillStyle = 'rgba(0,0,0,0.18)';
ctx.beginPath();
ctx.ellipse(size/2 + 1, size - 5, size/2 - 4, 4, 0, 0, Math.PI*2);
ctx.fill();
// Then draw the circular object — NO background rect
```

**Objects requiring this fix (search for large fillRect at start of generator):**
- Barrel / `generateBarrelSprite`
- Tomato basket / `generateTomatoBasketSprite`
- Flower / `generateFlowerSprite`
- Planter / `generatePlanterSprite`
- Fountain (Piazza) tiles
- All circular power-up pickups (Gouda wheel, broccoli, etc.)

### 13. BARREL RENDERING ON WRONG BACKGROUND COLOR IN INDOOR ZONES
**What's wrong:** In the Library and other indoor zones, the barrel sprite appears on a bright green square — the barrel's background fill is a grass-green color that belongs outdoors. It looks completely wrong against stone/brick floors.

**Fix:** This is the same fix as issue #12. Once the barrel's `fillRect` background is removed and replaced with a transparent canvas, the barrel will naturally sit on whatever tile is underneath it (stone, brick, wood) in every zone without needing any zone-specific logic.

**Additional check:** Search `sprites.js` for any object generator that references a grass-green color (`#4a7a30`, `#527834`, `#5a8040`, `#4e7c28` or similar hex values) inside an object draw function (not a tile draw function). These are all bugs — object generators must never hardcode a background tile color.

### 14. FLOWERS ARE TOO LARGE AND HAVE A VISIBLE SQUARE BACKGROUND
**What's wrong:** 
- The flower sprite is very large relative to the tile — the bloom fills nearly half the tile, making it look like a potted plant rather than a wildflower
- A visible lighter-green square background surrounds the flower on grass tiles, creating an ugly rectangular patch (same root cause as issue #12)
- All flowers appear to be the same pink color — no variety

**Fix in `sprites.js` → `generateFlowerSprite()` (or however flowers are drawn):**

1. **Remove the square background fill** — transparent canvas only (same fix as #12)
2. **Scale down the flower** — the bloom should be a maximum of 8–10px diameter on a 32px tile. Currently looks ~16–20px. A wildflower should feel like a small color accent, not a feature.
3. **Vary flower colors by position** so they feel naturally scattered:
```javascript
const seed = col * 7 + row * 13;
const flowerColors = ['#f080a0', '#f8f8c8', '#f8d030', '#c878e8', '#f8a0c0'];
const petalColor = flowerColors[seed % 5];
const centerColor = '#f8f040';
```
4. **Thin the stem** to 1px wide (`#2a5018` dark green), ~10–12px tall
5. **Add one small side leaf** — a 3×2px ellipse angled off the stem at 45°
6. **Result:** a tiny, delicate wildflower that reads as a charming detail rather than a dominant foreground object

---

## PIXELLAB SPRITE REQUESTS
> Use PixelLab to generate these sprites and import them via the sprite cache in sprites.js.
> All sprites: top-down RPG perspective, Stardew Valley style, **transparent background — no background fill**.

1. **Weight rack / barbell** — 32×32, overhead view, metallic bar with circular weights at each end, dark rubberized floor mat underneath, warm gym lighting
2. **Gym mirror (wall-mounted)** — 32×32, silver beveled frame, reflective surface with slight room reflection, ALTTP-style
3. **Juice bar counter section** — 32×32, overhead view, warm wood counter, 2 small cups/bottles, menu board hint, Italian deli feel
4. **Market stall (tomato)** — 32×32, overhead, red-striped awning, pile of red tomatoes on wooden counter, Stardew Valley palette
5. **Market stall (cheese/deli)** — 32×32, overhead, yellow-striped awning, cheese wheel + deli items on counter
6. **Wooden barrel (large)** — 32×32, overhead view, dark oak barrel with metal hoop rings, subtle wood grain, highlight on top, **transparent background**
7. **Stone dock tile** — 32×32, overhead, grey cobblestone with mortar lines, slight mossy variation, wet edge near water
8. **Sewing machine (vintage)** — 32×32, overhead, black body with gold/brass accents, white bobbin thread, needle detail
9. **Fabric roll (on shelf)** — 32×32, overhead, 2–3 rolled fabric bolts in pink/cream/sage, leaning against wall
10. **Mannequin (dress form)** — 32×32, overhead-ish, cream fabric body on dark wooden stand, small half-dress on it
11. **Large double door** — 64×64 (2×2 tiles), top-down RPG view, warm oak wood panels, arched stone surround, brass knobs, stone step at base, Stardew Valley / ALTTP style, transparent background
12. **Wildflower set (4 variants)** — 32×32 each, top-down, tiny delicate bloom (~8px), thin 1px stem, transparent background, one each: pink / white / yellow / purple

**PixelLab prompt template:**
> "32x32 pixel art sprite, top-down RPG perspective, Stardew Valley / Pokemon art style, [OBJECT NAME], transparent background, warm color palette, crisp pixel outlines, no anti-aliasing"

---

## IMPLEMENTATION ORDER
Run these in order — each is independently testable:

1. **Remove square backgrounds from all round objects** (issues 12 + 13) — fixes barrels/flowers/baskets/planters everywhere in one pass; highest visual impact
2. **Flower resize + color variation** (issue 14) — small change, big improvement to every outdoor zone
3. **Large door consolidation** (issue 11) — audit world.js for stacked door tiles, replace with large_door objects + new sprite
4. **Grass variation** (issue 9, `drawTileGRASS`) — biggest outdoor tile impact
5. **Wall darkening pass** (issue 1, all `drawTileWALL*`) — reduces visual noise everywhere
6. **Drop shadows on all objects** (issue 3) — single pass through sprites.js
7. **Water animation** (issue 6) — update water tile render + pass time parameter
8. **Gym tile overhaul** (issue 7 — MAT, EQUIPMENT, MIRROR, JUICEBAR)
9. **Market stall color** (issue 8, `drawTileSTALL`)
10. **Crate/barrel 3D faces** (issue 4 — top/front/shadow edge pattern)
11. **Character foot shadows** (issue 5 — player + NPC generators)
12. **Bridge plank wood grain** (issue 10)
13. **PixelLab sprites** — generate and swap in for items 1–12 above

---

## ACCEPTANCE CRITERIA
After changes, the game should pass this visual check:

- [ ] No circular/round object has a visible square background tile around it anywhere in any zone
- [ ] Barrel placed in Library/indoor zone sits on stone floor, not a green grass square
- [ ] Flowers are small, delicate, color-varied, and have no background box
- [ ] Zone exits use a single wide double-door sprite, not 2 individual door tiles side by side
- [ ] Can identify each zone type within 1 second by color palette alone
- [ ] Characters are immediately visible against any background tile
- [ ] Objects (crates, equipment, stalls) look 3D — not flat colored squares
- [ ] Outdoor grass has visual texture — not a solid green carpet
- [ ] Canal water has movement/shimmer
- [ ] Gym looks like a gym, not a warehouse
- [ ] Market stalls have color identity (different awning colors per stall)
- [ ] FPS stays above 55 after all changes

---

## RULES — DO NOT VIOLATE
1. Read `sprites.js` fully before changing anything. State what each function currently does before modifying it.
2. No regressions — collision, interaction, and transition logic must be completely untouched.
3. `sprites.js` is the only file that should change for visual fixes (plus minor render call updates in `world.js`/`engine.js` for the water time parameter and large door objects).
4. Test each step in the browser before moving to the next.
5. All canvas drawing stays procedural — do NOT introduce image file loading unless using PixelLab imports already in the sprite cache system.
6. When removing background fills from sprite generators, verify the offscreen canvas begins with `ctx.clearRect(0,0,w,h)` (transparent), not a pre-filled rect. Fix this if needed.
