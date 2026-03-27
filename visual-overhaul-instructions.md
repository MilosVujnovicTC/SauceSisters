# The Sauce Sisters — Visual Overhaul Instructions
## Target Aesthetic: Stardew Valley / Pokémon / Zelda: A Link to the Past

> **Scope:** All zones, all sprites, all tile rendering. Do NOT change any collision maps, zone transition coordinates, NPC positions, item spawn positions, puzzle trigger locations, or quest flag logic. Visual changes only — `sprites.js`, `tiles.js`, and the render portions of `world.js` and `engine.js`.

---

## SECTION 1 — Core Principles (Apply Everywhere)

### 1.1 Tile Variety and Micro-Detail

- Every floor tile type needs **at least 3–4 visual variants** assigned deterministically using `(x * 7 + y * 13) % N` as a seed, so variants are stable across sessions.
- Variants = same hue, slightly different shading, small embedded detail (a crack, a leaf, a scuff mark).
- Wall tiles need: a base color + a 1px dark shadow on the bottom and right edges (inner bevel) + occasional variation (moss patch, brick offset).
- **No tile should ever be a pure flat color fill.**

### 1.2 Large Multi-Tile Objects

This is the biggest fix. Replace all 1×1 objects with proper 2×2 or larger sprite compositions:

| Object | Current | Target |
|---|---|---|
| Trees | 1×1 dot | 2×3 (2×2 canopy + 1×1 trunk) |
| Market stalls | 1×1 or 2×1 | 3×2 (awning + counter + goods) |
| Kitchen counters | Single 1-tile units | Connected 3–5 tile surfaces with rounded ends |
| Bookshelves | 1×1 sticker | 1×2 minimum, visible colored book spines |
| Stove | 1×1 | 2×2 (burners + oven door + chrome handle) |

**Tree construction rule:** Base tile = 1×1 brown trunk at ground level. Above it = 2×2 round canopy with dark green outer ring, bright green center highlights, tiny yellow flower details. Trees should visually overlap adjacent pathway tiles slightly.

**Counter connection rule:** Adjacent counter tiles must render as a continuous connected surface, not isolated boxes. Use left-end, middle, and right-end tile variants to join them.

### 1.3 Depth and Layering

- Every solid object (trees, buildings, furniture, NPCs) must cast a **drop shadow**: `ctx.fillStyle = 'rgba(0,0,0,0.2)'` drawn as a slightly larger shape 2px down and 2px right of the main sprite, rendered before the main sprite.
- **Z-sorting:** Objects and NPCs sort by `renderOrder = entity.y + entity.height`. Objects lower on screen render on top of objects higher on screen.
- **Wall thickness illusion:** Walls at the top of a room render 2 tiles tall, with the inner edge in a noticeably darker tone to suggest the wall has physical depth.
- **Ambient light gradient:** Apply a subtle overlay on the floor: `rgba(255,255,200,0.04)` that fades from 0 opacity at the top of the room to full opacity at the bottom, simulating light coming from above.

### 1.4 Color Palette — Per Zone

| Zone | Floor | Walls / BG | Key Accent |
|---|---|---|---|
| La Cucina | Terracotta `#C8845A` | Cream `#F0E8D0` | Dark wood `#5C3A1E` |
| Market | Grass `#5DB85C` | — | Cobblestone `#B8A882` |
| Canal (top-down) | Earthy dock `#8B6914` | — | Deep teal water `#2A9D8F` |
| Library | Amber floor `#C4924A` | Navy `#2D2B55` | Burgundy rug `#8B2635` |
| Gym | Wood floor `#D4A85A` | — | Cool grey mats `#7A8FA6` |
| Piazza | Limestone `#D4C5A0` | — | Fountain blue `#4BB8E8` |
| Pizzeria | Checkered cream+terracotta | Red brick `#A63D2F` | Oven glow orange |
| Sewing Shop | Pink carpet `#E8A0B0` | Lavender `#9B8FC0` | Colorful fabric rolls |

### 1.5 Animated Tiles

| Tile | Animation |
|---|---|
| Water | 3-frame shimmer, update every 20 game frames |
| Fountain | Expanding ripple ring, fades out |
| Fire / Oven | Flicker between 2 orange shades + small glow radius |
| Grass | 1–2px vertical shift on random sprites every 60–90 frames |

---

## SECTION 2 — Zone-Specific Instructions

### 2.1 La Cucina (Kitchen Interior)

**Current problems:** Uniform tan brick wall-to-wall. Counters are isolated 1-tile rectangles. No kitchen character.

**Fixes:**
- **Floor:** Warm terracotta tiles with visible grout lines. Add a 3×4 tile rug (warm red/orange pattern) centered in the room.
- **Walls:** Plaster-textured warm ivory. Add a visible chair rail — a 1px decorative stripe at row 3 from the top. Top 2 tile rows = darker tone to suggest ceiling.
- **Counters:** Redesign as connected L-shaped or U-shaped surfaces (3–5 tiles wide). Each counter tile has: dark wood base, lighter stone countertop surface, small detail sprites on top (a pot, a cutting board, a jar).
- **Stove:** New 2×2 sprite. Two burner circles visible on top, oven door below with chrome handle, subtle orange glow emanating from burners.
- **Hanging pots:** Decorative sprites rendered in the top 2 tile rows — hanging copper pots near the ceiling.
- **Door:** Replace the current small door with a proper arched double-door frame: 2 tiles wide, 2 tiles tall, with a brick arch rendered above it.

---

### 2.2 Signora Betta's Market (Outdoor Market)

**Current problems:** Trees are 1×1 single-pixel dots. Market stalls are small. Stone path has hard edges with no transition. Betta's shop has no building facade.

**Fixes:**
- **Trees:** Redesign as 2×3 sprites per the multi-tile spec above. Must visually overlap paths slightly at the edges.
- **Market stalls:** Redesign as 3×2 structures:
  - Top row: candy-striped awning canvas with a slightly angled front edge (3D overhang effect) and a fringe of tassels at the bottom.
  - Bottom row: wooden counter with displayed goods (stacked tomato crates, produce baskets, price tags as tiny labeled sprites).
- **Stone path edges:** Add a 1-tile transition border where path meets grass — lighter tone, small border stones visible.
- **Betta's shop facade (bottom section):** Proper building: stone walls, a window with wooden shutters, a door with a small awning above it and potted plants either side.
- **Environmental scatter:** Add: a cat sitting near a wall, a bucket near a stall, a broom leaning against a wall corner.

---

### 2.3 Canal Crossing (Top-Down View)

**Current problems:** Water is two flat colored bands. Bridge is stacked brown rectangles. Dock has no posts or structural detail.

**Fixes:**
- **Water:** Animated 3-frame shimmer tiles. Add subtle horizontal ripple strokes (lighter horizontal lines). At water edges where it meets land, add a 1-tile muddy bank transition (darker brown/green blend).
- **Dock planks:** Draw individual plank grain lines (horizontal lines every 4px, alternating slight color variation). Add dock posts at the dock edges (1×1 dark brown vertical posts with a rope detail between them).
- **Bridge (gap tiles):** When bridge is complete, render wooden planks with rope railings on both sides (2px off-white rope lines at the tile edges). The filled bridge must look structurally placed, not like rectangles stacked.
- **Boat:** Add a small decorative wooden boat tied to the north dock (2×1 sprite, rope line connecting to dock post).
- **Lamp posts:** Replace current lamp sprites with: thin dark pole + circular lantern head + warm glow radius (`rgba(255,220,100,0.15)` soft circle rendered behind the lantern head).
- **Dock structures:** North and south dock areas get a wider wooden pier — visible edge planks, support beams visible at the water line.

---

### 2.4 Canal / Lungomare (Dock Area)

**Current problems:** Everything is perfect horizontal stripes with no vertical interest. Objects scattered randomly on identical cracked stone.

**Fixes:**
- Apply all water + dock plank fixes from section 2.3.
- **Cracked stone surface:** Use 4 tile variants — some darker (wet patches), some lighter (dry raised sections). Do not use a single repeated tile.
- **Bollards:** Add a bollard sprite (short rounded iron post, dark grey) every 4 tiles along the water edge.
- **Barrel clusters:** Replace isolated single barrels with groups of 2–3 barrels tied together with a rope, forming visual clusters.
- **Fishing net backdrop:** Decorative element in the far background — a net hanging between two posts.

---

### 2.5 BMX Mini-Game (Side-Scroller)

**Current problems:** Plank collectibles are plain white circles. Bridge obstacle is boxy. Hills are flat-topped and geometric. Bike and rider are small.

**Fixes:**
- **Planks:** Render as proper wooden plank sprite — brown rectangle with horizontal grain lines, slight tilt for dynamic feel. The pickup bubble can remain but use a warm golden hue, not plain white.
- **Bridge/gap obstacle:** The blocking obstacle should look like a stone bridge: draw an arch cutout opening in the bottom half of the obstacle shape.
- **Road surface:** Add a scrolling dotted center line (white dashes, animated to scroll with the level).
- **Hills (parallax layers):** Add 2–3 additional hill silhouettes at different depths with distinct tones:
  - Closest: `#6BC96B`
  - Middle distance: `#4A9E4A`
  - Far background: `#2E7A2E`
  - Avoid flat-topped silhouettes — hills must have gentle organic curves.
- **Bike + rider:** Increase sprite size by ~30%. Add wheel rotation animation — a simple spoke cross that rotates based on movement speed.
- **Clouds:** Vary sizes. Add 2–3 small wispy clouds at higher altitude, behind the main cloud layer.

---

## SECTION 3 — Sprite System Overhaul (`js/sprites.js`)

### 3.1 Player and NPC Characters

**Color identities (must be distinct and saturated):**

| Character | Top | Bottoms | Hair | Key Detail |
|---|---|---|---|---|
| Giulia | Bright teal | Dark navy jeans | Brown | Red hair tie |
| Luigi | White chef coat | Dark trousers | Black | Red neckerchief |
| Signora Betta | Orange/red shawl | Dark skirt | Grey | Headscarf |
| Old Sal | Blue fisherman jacket | Tan trousers | White | Stubble |
| Nonna Pina | Purple blouse | Dark skirt | White bun | Knitting needles |

**Character outline rule:** Every character sprite must have a **1px dark outline** (`#1A1A2E` or similar) around the entire silhouette. This is the Pokémon/Zelda technique that makes characters readable against any background. No anti-aliasing on character outlines.

**Walk animation:** Leg movement must be visibly exaggerated — Pokémon style. Legs alternate between +3px and -3px vertical offset, not the current subtle 1px shift.

**Character size:** Bump up by 20% if currently drawing at 14×18px. Target 16×22px to be comfortably readable at the 32px tile size.

### 3.2 Environmental Object Standards

Every interactive and decorative object sprite must have:
1. **Dark 1px outline** around the silhouette
2. **Drop shadow** (2px offset, `rgba(0,0,0,0.2)`)
3. **Highlight pixel** — a 1–2px lighter region on the top-left face of any raised surface

**Crates:**
- Visible horizontal wood grain lines across the face
- Metal corner bracket details — small dark L-shapes at each corner
- A slightly lighter top face visible (isometric top effect, like Stardew Valley crates)

**Barrels:**
- 2–3 horizontal dark metal hoop bands
- Circular lid on top with a lighter center highlight
- Wood grain texture on the body

---

## SECTION 4 — Tile Rendering Engine (`assets/tiles.js` + render loop)

### 4.1 New Rendering Passes

Add the following render passes in this order:

1. **Floor pass** — render all walkable floor tiles
2. **Shadow pass** — for every wall tile that borders a floor tile, draw a semi-transparent shadow on the floor tile's top and left edges (`rgba(0,0,0,0.15)`, 4px wide). This creates the Zelda-style wall depth shadow.
3. **Overlay pass** — render decorative detail sprites that sit on top of floor tiles without blocking movement (fallen leaves, small flowers, crack overlays)
4. **Entity pass** — render all entities (NPCs, player, enemies, objects) sorted by `y + height`
5. **Wall cap pass** — render the top-face highlight of walls that are visible above the player view

### 4.2 Tile Transitions

Where two different tile types meet (grass→path, floor→wall), draw a 1-tile blend/transition sprite rather than a hard edge cut. This is what makes Stardew Valley maps feel organic rather than grid-like.

### 4.3 Tile Rendering Order

Render tiles **row by row from top to bottom**. This ensures objects in lower rows visually overlap objects in upper rows where canopies or large sprites cross tile boundaries (e.g., tree canopies overlapping the path tile beneath them).

---

## SECTION 5 — What Must NOT Change

- Collision maps
- Zone transition coordinates and spawn positions
- NPC positions and walk paths
- Item spawn positions
- Puzzle trigger locations and logic
- Quest flag names and values
- All `CONFIG` values
- Function signatures of `generatePlayerSprite()`, `generateNPCSprite()`, `generateTileSprite()`, and all other public sprite/entity functions
- Any game mechanic logic in `entities.js`, `weapons.js`, `puzzles.js`, `save.js`, `audio.js`, or `ui.js`

After every visual change, verify player can still move correctly through all affected zones and that no collision or interaction is broken.

---

## SECTION 6 — Validation Checklist

After completing the overhaul, verify each item:

- [ ] No tile renders as a pure flat color fill
- [ ] All trees are multi-tile (minimum 2×2 canopy)
- [ ] All market stalls have visible awnings and counter goods
- [ ] La Cucina counters connect as a continuous surface
- [ ] Water tiles animate (3-frame shimmer)
- [ ] Every character has a 1px dark outline
- [ ] Drop shadows present on all solid objects
- [ ] Z-sorting works (lower-y entities render behind higher-y entities)
- [ ] Wall depth shadows present on floor tiles adjacent to walls
- [ ] Each zone has its specified dominant color palette
- [ ] BMX collectible planks look like wood, not white circles
- [ ] Canal bridge looks like planks with rope railings when complete
- [ ] Barrel sprites have hoop bands and lid highlights
- [ ] Crate sprites have grain lines and corner brackets
- [ ] No collision regressions in any zone
- [ ] No quest flags, transitions, or puzzle states broken
