# BACKLOG.md — The Sauce Sisters

> Atomic stages designed to prevent context compaction, regressions, and hallucinations.
> Each stage is completable in a single focused session.
> Each stage has acceptance criteria that MUST pass before moving to the next.
> Last updated: 2026-03-22

---

## How to use this backlog

1. **One stage per session.** Never combine stages. If a stage finishes early, stop and hand off.
2. **Read before write.** Every session starts by reading the full current code.
3. **Validate before presenting.** Before asking the user to test, Claude must: re-read all changed code for logic errors, trace player-facing flows end-to-end, and check for gameplay bugs (unreachable items, broken pickups, missing collision, softlocks, orphaned quest flags). Fix issues before the user sees the build.
4. **Preemptive gameplay audit.** After each stage, simulate a playthrough of ALL working features — not just the new one. Can the player still complete all prior zones? Do new entities block old paths? Do inventory/quest flags still flow? Document what was checked.
5. **Test before done.** Every stage has acceptance criteria — verify each one in the browser.
6. **File split trigger.** When `index.html` exceeds ~1500 lines, execute Stage F-1 (file split) before continuing.
7. **Mark completion.** Change `[ ]` to `[x]` and add the date when a stage is done.

---

## Phase 0: Design

### Stage 0-1: Game design document `[x] 2026-03-22`
- Full game design completed
- CLAUDE.md created as single source of truth
- **Deliverable:** CLAUDE.md

---

## Phase 1: Engine Foundation

### Stage 1-1: Canvas bootstrap `[x] 2026-03-22`
- Create `index.html` with HTML5 canvas
- CONFIG object with all constants (TILE_SIZE, CANVAS_W, CANVAS_H, FPS, etc.)
- Game loop: `requestAnimationFrame` → `update(dt)` → `render(ctx)`
- Delta-time calculation
- Canvas auto-sizing (768×576 — 20% larger than base 640×480)
- **Acceptance criteria:**
  - [ ] Page loads with a colored canvas
  - [ ] Game loop runs at stable 60fps (verify with FPS counter overlay)
  - [ ] CONFIG object exists at top of file with all constants
  - [ ] `update()` and `render()` are separate, clean functions

### Stage 1-2: Input system `[x] 2026-03-22`
- Keyboard input handler (arrow keys + WASD + Z/Space + action keys)
- Input state object tracking pressed/just-pressed/released
- Key mapping configurable via CONFIG
- **Acceptance criteria:**
  - [ ] Pressing keys updates visible debug text on canvas
  - [ ] Both arrow keys and WASD register correctly
  - [ ] `justPressed` fires once per keydown, not continuously
  - [ ] No duplicate event listeners on window

### Stage 1-3: Controls remapping `[x] 2026-03-22`
- Key bindings object mapping actions to keys (move_up, move_down, interact, sniff, papa_call, etc.)
- Default bindings: WASD/arrows = move, Z/Space = interact, B = sniff, P = papa call
- Remapping UI overlay: list all actions, select one, press new key to rebind
- Duplicate key detection (reject binding same key to two actions)
- Bindings saved to localStorage, loaded on startup
- All input checks go through the bindings object (never hardcoded key checks)
- **Acceptance criteria:**
  - [ ] All game input uses the bindings object, not hardcoded key codes
  - [ ] A settings overlay shows all current bindings
  - [ ] Clicking an action and pressing a key rebinds it
  - [ ] Duplicate keys are rejected with feedback
  - [ ] Bindings persist after page reload (localStorage)
  - [ ] "Reset to defaults" button works

### Stage 1-4: Tile renderer `[x] 2026-03-22`
- Tile type definitions (floor, wall, water, etc.) with colors
- Tilemap data structure (2D array)
- Tile rendering function that draws visible tiles only
- Small test map (20x15 tiles) with mixed tile types
- **Acceptance criteria:**
  - [ ] Test map renders with distinct tile colors
  - [ ] Only visible tiles are drawn (check with console log)
  - [ ] Tile types are defined in a TILES object, not magic numbers

### Stage 1-5: Player movement + collision `[x] 2026-03-22`
- Player entity with position, size, speed
- Grid-aligned movement (smooth interpolation between tiles)
- Collision detection against wall tiles
- Player rendered as a distinct colored rectangle
- **Acceptance criteria:**
  - [ ] Player moves in 4 directions with arrow keys or WASD
  - [ ] Player cannot walk through wall tiles
  - [ ] Movement feels smooth (interpolated, not teleporting)
  - [ ] Player stays within map bounds

### Stage 1-6: Camera system `[x] 2026-03-22`
- Camera follows player with offset to center
- Camera clamped to map boundaries (no void visible)
- Smooth camera follow (lerp)
- All rendering offset by camera position
- **Acceptance criteria:**
  - [ ] Camera follows player smoothly
  - [ ] Camera does not scroll past map edges
  - [ ] Create a larger test map (40x30) to verify scrolling works
  - [ ] Tiles render correctly at all camera positions

---

## Phase 2: First Playable (La Cucina + Market)

### Stage 2-1: Zone system + La Cucina tilemap `[x] 2026-03-22`
- Zone data structure (id, tilemap, entities, transitions)
- Zone transition system (walk to edge → load next zone)
- La Cucina tutorial zone tilemap (~20x15 tiles): kitchen floor, counters, door
- Transition tile at door leading to Zone 1
- **Acceptance criteria:**
  - [ ] La Cucina loads as the starting zone
  - [ ] Player can walk around the kitchen
  - [ ] Walking to the door transitions to Zone 1 (can be empty placeholder)
  - [ ] Zone transition does not crash or lose player state

### Stage 2-2: Market tilemap + zone transitions `[x] 2026-03-22`
- Zone 1 (Market) tilemap: outdoor market stalls, paths, walls
- Bidirectional transition between La Cucina and Market
- Spawn points per zone (where player appears after transition)
- **Acceptance criteria:**
  - [ ] Market zone has a visually distinct layout from La Cucina
  - [ ] Player can go La Cucina → Market → La Cucina
  - [ ] Player spawns at correct position after each transition
  - [ ] Both zones' collision maps work correctly

### Stage 2-3: NPC system (scripted) `[x] 2026-03-22`
- NPC entity type with position, dialogue, interaction radius
- Interaction trigger: press Z/Space near NPC
- Dialogue box UI: text box at bottom of screen, name label
- Character-by-character text reveal
- Advance/close dialogue with Z/Space
- **Acceptance criteria:**
  - [ ] Place a test NPC in La Cucina
  - [ ] Walking near NPC and pressing Z opens dialogue box
  - [ ] Text appears character by character
  - [ ] Pressing Z advances to next line or closes dialogue
  - [ ] Player cannot move while dialogue is open

### Stage 2-4: Signora Betta + dialogue trees `[x] 2026-03-22`
- Dialogue tree data structure (nodes with choices/branches)
- Signora Betta NPC placed in Market zone
- Her scripted dialogue: introduces quest, asks to find tomato crate
- Quest flag system (simple key-value store for game state)
- **Acceptance criteria:**
  - [ ] Signora Betta appears in the Market
  - [ ] Her dialogue follows the scripted tree with correct branching
  - [ ] Quest flag `market_quest_started` is set after talking to her
  - [ ] Talking to her again shows different dialogue based on quest state

### Stage 2-5: Pushable objects + crate mechanic `[x] 2026-03-22`
- Pushable object entity type
- Push mechanic: player walks into pushable → it slides one tile in push direction
- Pushable stops against walls or other pushables
- Place crates in Market zone for Signora Betta's quest
- **Acceptance criteria:**
  - [ ] Crates render in the Market
  - [ ] Walking into a crate pushes it one tile
  - [ ] Crates stop at walls and other crates
  - [ ] Cannot push a crate into an NPC

### Stage 2-6: Recipe fragment #1 + inventory `[x] 2026-03-22`
- Inventory system: array of collected items, max slots
- Item pickup: walk over item or interact to collect
- HUD: inventory bar at top of screen showing collected items
- Recipe fragment #1 hidden inside the correct tomato crate
- Recipe found event (visual feedback — flash/sparkle placeholder)
- **Acceptance criteria:**
  - [ ] Pushing the correct crate reveals recipe fragment #1
  - [ ] Walking over it or pressing Z collects it
  - [ ] Fragment appears in HUD inventory
  - [ ] Quest flag `recipe_1_found` is set
  - [ ] Signora Betta's dialogue updates after finding the recipe

---

## Phase 3: Audio Foundation

### Stage 3-1: Audio system bootstrap `[x] 2026-03-22`
- Tone.js loaded from CDN
- Audio unlock on first user gesture (click/keypress)
- Audio manager object: play, stop, setVolume, isUnlocked
- Simple test tone on keypress to verify setup
- **Acceptance criteria:**
  - [ ] Tone.js loads without errors
  - [ ] Audio unlocks on first keypress (no browser autoplay error)
  - [ ] A test tone plays when pressing a key
  - [ ] No audio plays before user gesture

### Stage 3-2: Zone music loops `[x] 2026-03-22`
- Procedural music loop for La Cucina (warm, kitchen ambiance)
- Procedural music loop for Market (bustling, Italian scale)
- Music transitions on zone change (fade out → fade in)
- Volume control via CONFIG
- **Acceptance criteria:**
  - [ ] Music plays in La Cucina
  - [ ] Different music plays in Market
  - [ ] Music crossfades on zone transition (no jarring cut)
  - [ ] Music volume is configurable

### Stage 3-3: SFX system `[x] 2026-03-22`
- Web Audio API SFX generator (no Howler needed yet)
- SFX for: footsteps, crate push, item pickup, dialogue blip
- NPC voice blips: unique pitch/timbre per NPC (one note per character)
- SFX volume separate from music volume
- **Acceptance criteria:**
  - [ ] Footstep sound plays while moving
  - [ ] Crate push has a distinct sound
  - [ ] Item pickup has a satisfying chime
  - [ ] Dialogue text reveal plays NPC-specific blip per character
  - [ ] SFX and music volumes are independent

---

## Phase 3.5: File split (conditional)

### Stage F-1: Split into modules `[x] 2026-03-22`
> **Trigger:** Execute this stage when `index.html` exceeds ~1500 lines.
- Split into the file structure defined in CLAUDE.md section 11
- `index.html` becomes a thin loader
- Each JS file gets a clear module boundary
- Verify ALL existing features still work after split
- **Acceptance criteria:**
  - [ ] All JS files load in correct order via `<script>` tags
  - [ ] Every feature from previous stages still works identically
  - [ ] No global variable conflicts
  - [ ] Each file has a header comment describing its responsibility

---

## Phase 4: Zones 2-3

### Stage 4-1: Zone 2 tilemap (Canal) `[x] 2026-03-22`
- Canal zone tilemap: water tiles, docks, broken bridge gap
- Zone transitions: Market → Canal, Canal → Market
- Water tile collision (impassable)
- Visual: canal water animation (simple color cycling)
- **Acceptance criteria:**
  - [ ] Canal zone loads from Market transition
  - [ ] Water tiles are impassable
  - [ ] Broken bridge gap is visible and impassable
  - [ ] Can return to Market

### Stage 4-2: BMX side-scroller mini-game `[x] 2026-03-22`
- Triggered by interacting with BMX bike object in Canal zone
- Switches to side-scroll mode: player rides bike, collects planks
- Simple platformer physics (jump, forward momentum)
- Timer + plank counter
- Returns to top-down mode when complete, with planks in inventory
- **Acceptance criteria:**
  - [ ] Interacting with bike starts the mini-game
  - [ ] Side-scroll controls work (jump + move)
  - [ ] Planks are collectible during the ride
  - [ ] Mini-game ends and returns to Canal zone
  - [ ] Collected planks appear in inventory

### Stage 4-3: Bridge build mechanic `[x] 2026-03-22`
- "Fill target" tile type for bridge gaps
- Player can place plank items on fill targets
- All gaps filled → bridge becomes walkable
- Visual: planks render on bridge tiles
- **Acceptance criteria:**
  - [ ] Can place planks on bridge gap tiles
  - [ ] Planks snap to grid visually
  - [ ] Bridge becomes walkable only when all gaps are filled
  - [ ] Cannot place planks on non-target tiles
  - [ ] Bridge state persists when leaving and re-entering zone

### Stage 4-4: Zone 3 tilemap (Library) `[x] 2026-03-22`
- Library zone tilemap: bookshelves, reading tables, narrow aisles
- Zone transition from Canal
- Interactable objects: bookshelves (examine), cookbook location
- **Acceptance criteria:**
  - [ ] Library zone loads from Canal transition
  - [ ] Bookshelves act as walls
  - [ ] At least one interactable bookshelf shows flavor text
  - [ ] Layout feels like a cozy old library

### Stage 4-5: Brodo sniff mechanic `[x] 2026-03-22`
- Dog companion entity follows player (Brodo)
- `B` key activates sniff: radius check around Brodo
- Hidden items within sniff radius get a sparkle indicator
- Sparkle persists for a few seconds then fades
- Library has hidden items to sniff out
- **Acceptance criteria:**
  - [ ] Brodo follows Giulia with a slight delay
  - [ ] Pressing B triggers a visible sniff animation/effect
  - [ ] Hidden items within range get sparkle overlay
  - [ ] Items outside range are not revealed
  - [ ] Sniffing works in any zone, not just Library

### Stage 4-6: Nokia T9 puzzle `[x] 2026-03-22`
- Nokia 3210 object in Library — interact to start puzzle
- T9 keyboard UI overlay: number pad, small screen
- Player must spell "GIULIA" using T9 input
- Success: reveals recipe fragment #2 location
- Fail: can retry immediately
- **Acceptance criteria:**
  - [ ] Interacting with Nokia opens T9 overlay
  - [ ] T9 input maps numbers to letter groups correctly
  - [ ] Spelling "GIULIA" triggers success
  - [ ] Wrong words show error feedback
  - [ ] Recipe #2 becomes collectible after success
  - [ ] Puzzle state saved (don't repeat if solved)

### Stage 4-7: Cartridge puzzle + cat mini-boss `[x] 2026-03-22`
- NES cartridge object: button-mash blow mechanic (clean the cartridge)
- Memory order puzzle: insert cartridge in correct sequence
- Cat mini-boss: patrols library, chases player if spotted
- Cat has simple AI: patrol route + chase state + return
- Defeat cat with a weapon (tomato or flour)
- **Acceptance criteria:**
  - [ ] Cartridge blow mechanic works (mash button, progress bar fills)
  - [ ] Memory sequence puzzle is solvable
  - [ ] Cat patrols and chases when player enters line of sight
  - [ ] Cat can be stunned/defeated with available weapon
  - [ ] Cat does not chase through walls

---

## Phase 5: Weapons + Combat

### Stage 5-1: Weapon system foundation `[x] 2026-03-22`
- Weapon data structure: name, type (melee/ranged/trap), damage, range, cooldown
- Weapon equip/switch (number keys or scroll)
- Attack action on Z/Space when weapon equipped
- Spatula: melee swing with hitbox in facing direction
- **Acceptance criteria:**
  - [ ] Can equip spatula from inventory
  - [ ] Z/Space triggers melee attack animation
  - [ ] Hitbox appears in the direction player faces
  - [ ] Attack has cooldown (can't spam)
  - [ ] Hitting a pushable object with spatula does not break it

### Stage 5-2: Ranged + trap weapons `[x] 2026-03-22`
- Tomato: thrown projectile, travels in facing direction, splat on hit
- Banana: placed on current tile as floor trap
- Bag of flour: area effect around player position
- Projectile physics: travel, collision with walls, despawn
- Trap persistence: stays on tile until triggered
- **Acceptance criteria:**
  - [ ] Tomato flies forward and splats on wall/enemy
  - [ ] Banana sits on tile and is visually distinct
  - [ ] Flour creates a visible cloud in 2-tile radius
  - [ ] Weapons consume from inventory
  - [ ] Projectiles stop at walls

### Stage 5-3: Enemy system `[x] 2026-03-22`
- Enemy entity type: health, speed, patrol route, state (idle/patrol/chase/stunned)
- Enemy AI states: patrol (follow waypoints), chase (follow player), stunned (frozen), retreat
- Damage system: weapons deal damage, enemies flash when hit
- Enemy knockback on hit
- Weapon effects: tomato slows, flour stuns, banana trips, sock causes retreat
- **Acceptance criteria:**
  - [ ] Test enemy patrols a route in Market zone
  - [ ] Enemy chases player when in detection range
  - [ ] Hitting enemy with tomato slows it for 3 seconds
  - [ ] Hitting enemy with flour stuns it
  - [ ] Enemy drops item on defeat

### Stage 5-4: Power-up system `[x] 2026-03-22`
- Power-up data structure: name, effect type, duration, buff values
- Power-up entity type (world pickup): position, type, respawn-on-reenter flag
- Pickup logic: walk over or interact to collect, activates timed buff
- Buff manager: track active buff, apply effect, timer countdown, expiry cleanup
- One-at-a-time swap: new pickup replaces active buff with "swapped!" indicator
- HUD: active power-up icon + depleting timer bar
- Player sprite glow while buff is active
- All 7 power-up types: Broccoli (speed), Chocolate Milk (attack speed), Water (stealth), Deli Meat (shield), Gouda Cheese (enemy slow aura), Brownie (sniff boost), Milk (free hints)
- Place power-ups in at least 2 zones for testing
- **Acceptance criteria:**
  - [ ] Power-up items render in the world at designated spots
  - [ ] Walking over a power-up activates the timed buff
  - [ ] Buff effect is applied correctly (e.g., Broccoli makes player visibly faster)
  - [ ] Timer bar shows in HUD and depletes in real time
  - [ ] Picking up a second power-up replaces the first (old effect removed)
  - [ ] Buff expires cleanly — no lingering speed/stealth/shield effects
  - [ ] Power-ups respawn when re-entering the zone
  - [ ] All 7 power-up types have distinct visual colors/shapes
  - [ ] Deli Meat shield correctly counts hits and expires on 3rd hit OR timeout

---

## Phase 5.5: Visual + Audio Upgrade

> These stages slot between combat and AI/later zones, so all new zones benefit from upgraded art and audio.

### Stage V-1: Visual upgrade evaluation + implementation `[x] 2026-03-22`
- Evaluate current canvas-drawn visuals vs. sprite-based rendering
- Decide approach: pixel art spritesheets (loaded as images) vs. improved canvas drawing
- If sprites: set up image loader, spritesheet format, tile rendering swap
- If canvas: improve tile detail (borders, shading, variation), entity sprites (player, NPCs, Brodo, enemies)
- Upgrade at minimum: player character, Brodo, NPCs, cat, key objects (Nokia, cartridge, bike)
- Zone tiles: add texture/variation to floors, walls, grass, water
- **Acceptance criteria:**
  - [ ] Visual approach decided and documented
  - [ ] Player character has a distinct, charming look (not a colored rectangle)
  - [ ] Brodo looks like a recognizable basset hound
  - [ ] NPCs are visually distinguishable from each other
  - [ ] Tiles have depth/texture (not flat colored squares)
  - [ ] All existing zones updated to new visual style
  - [ ] No gameplay regressions — collision, interaction, movement unchanged

### Stage A-1: Audio upgrade evaluation + implementation `[x] 2026-03-23`
- Evaluate current Tone.js procedural audio vs. sample-based audio
- Target quality: indie game level — organic instruments, warm textures (not chiptune, not AAA)
- Music: decide between composed audio files (.mp3/.ogg) or upgraded procedural (layered samples + synths)
- If sample-based: set up Howler.js audio loader, define format, replace zone music loops
- SFX: replace procedural synth SFX with recorded/designed samples (footsteps, crate push, pickup, bark, etc.)
- NPC voice blips: upgrade from pure sine/triangle to more characterful sounds
- Ambient layers: per-zone background audio (kitchen clatter, market crowd, water, page turning)
- **Acceptance criteria:**
  - [ ] Audio approach decided and documented
  - [ ] Zone music feels warm and Italian-flavored (not 8-bit chiptune)
  - [ ] SFX feel tactile and satisfying (not synthetic beeps)
  - [ ] NPC dialogue blips have personality
  - [ ] Ambient sounds match zone themes
  - [ ] Volume balancing across all zones
  - [ ] Audio still unlocks on first user gesture (no autoplay errors)
  - [ ] Graceful fallback if audio files fail to load

---

## Phase 6: AI NPCs

### Stage 6-1: Papa Marco hint system `[x] 2026-03-23`
- Papa Marco as a non-visible NPC (headset voice only)
- `P` key triggers Papa call — dialogue box with Papa portrait
- Hint counter per zone (3 max, tracked in game state)
- Scripted hint pool per zone (3 hints each, progressively more specific)
- "No hints" dialogue when counter is 0
- Auto-call on zone entry (first-time introductory line)
- **Acceptance criteria:**
  - [ ] Pressing P opens Papa dialogue with his portrait/name
  - [ ] Each call gives the next hint for the current zone
  - [ ] Counter decrements and shows remaining hints
  - [ ] At 0 hints: shows the "going for a set" message
  - [ ] Zone entry triggers auto-call (first time only)
  - [ ] Hint counter resets per zone, not globally

### Stage 6-2: AI NPC integration `[deferred → v2]`
- Anthropic API client (fetch-based, no SDK)
- API key input UI (settings modal or prompt on first use)
- System prompt templates per NPC with game state injection
- Papa Marco: fully AI-driven responses for freeform questions
- Hybrid NPC scaffold: scripted for story beats, AI for "ask anything"
- Graceful fallback: if API fails, use scripted response pool silently
- **Acceptance criteria:**
  - [ ] API key can be entered and is stored in localStorage
  - [ ] Papa responds with AI-generated text that matches his personality
  - [ ] Game state variables appear correctly in API context
  - [ ] If API key is missing/invalid: scripted fallback works
  - [ ] If network fails: scripted fallback works (no error shown to player)
  - [ ] NPC responses are max 2-3 sentences

---

## Phase 7: Mid-to-Late Zones

### Stage 7-1: Zone 4 tilemap (Papa's Gym) `[x] 2026-03-23`
- Gym zone tilemap: weight racks, mats, juice bar, Papa's corner
- Zone transition from Library
- Recipe fragment #3 on Papa's competition form (interact to find)
- Tamagotchi object placed in gym
- **Acceptance criteria:**
  - [ ] Gym zone loads with correct tilemap
  - [ ] Zone transitions work both directions
  - [ ] Recipe #3 is findable via interaction
  - [ ] Gym has a distinct visual feel (mats, equipment as colored tiles)

### Stage 7-2: Drum solo interlude `[x] 2026-03-23`
- Guaranteed trigger after completing Zone 4
- Rhythm game: notes fall from top, hit arrows + Space when they reach the line
- 4 lanes (up/down/left/right) + Space for special beats
- Scoring: perfect/great/ok/miss per note
- Reward tiers based on final score (S/A/B/C)
- 30-45 second duration
- **Acceptance criteria:**
  - [ ] Interlude triggers automatically after Z4
  - [ ] Notes fall smoothly in 4 lanes
  - [ ] Timing window detects perfect/great/ok/miss
  - [ ] Score tallies and shows final grade
  - [ ] Reward item granted based on grade
  - [ ] Returns to overworld after completion
  - [ ] Can be skipped (but lose reward)

### Stage 7-3: Zone 5 tilemap (Piazza) + build puzzle `[x] 2026-03-23`
- Piazza zone tilemap: open square, fountain, benches, planters
- Build puzzle: arrange benches and planters on fill targets to create a path
- Pushable benches and planters with distinct visuals
- Path unlocks access to Zone 6 entrance
- **Acceptance criteria:**
  - [ ] Piazza zone loads with open layout
  - [ ] Benches and planters are pushable
  - [ ] Fill targets are visually indicated
  - [ ] Completing the arrangement opens the path to Zone 6
  - [ ] Partial arrangements do not unlock the path

### Stage 7-4: Zone 6 tilemap (Enzo's Pizzeria) `[x] 2026-03-23`
- Pizzeria zone tilemap: kitchen, dining area, sauce machine room
- Enzo NPC with scripted + AI hybrid dialogue
- Pre-boss dialogue sequence with Enzo
- Zone locked until Piazza build puzzle is complete
- **Acceptance criteria:**
  - [ ] Pizzeria zone loads from Piazza
  - [ ] Enzo appears and has introductory dialogue
  - [ ] Zone is inaccessible until Piazza puzzle is solved
  - [ ] Sauce machine room is visible but locked until boss is defeated

### Stage 7-5: Enzo boss fight `[x] 2026-03-23`
- Boss fight arena: confined kitchen area
- Enzo attack patterns: throws pizza dough (projectile), charges, summons waiter enemies
- 3-phase fight (each phase faster/more complex)
- Player uses weapons to damage Enzo
- Health bar UI for Enzo
- Defeat → sauce machine room unlocks → recipe #4
- **Acceptance criteria:**
  - [ ] Boss fight triggers from dialogue
  - [ ] Enzo has distinct attack patterns per phase
  - [ ] Player can damage Enzo with weapons
  - [ ] Health bar shows Enzo's remaining HP
  - [ ] Defeating Enzo unlocks the sauce machine room
  - [ ] Recipe #4 is collectible after victory
  - [ ] Losing allows retry (respawn at zone entrance)

### Stage 7-6: Cooking mini-game `[x] 2026-03-23`
- Triggered after collecting recipe #4 from sauce machine
- Timed cooking sequence: stir, season, taste, adjust heat
- Uses arrow keys + timing-based inputs
- Score determines sauce quality (flavor text)
- Not a blocker — pass/fail just changes dialogue
- **Acceptance criteria:**
  - [ ] Mini-game triggers at sauce machine
  - [ ] Cooking steps have clear visual instructions
  - [ ] Timing-based input feels responsive
  - [ ] Score/quality shown at end
  - [ ] Returns to overworld regardless of performance

### Stage 7-7: Zone 7 tilemap (Mama's Sewing Shop) `[x] 2026-03-23`
- Sewing shop zone tilemap: fabric rolls, sewing machines, mannequins
- Zone transition from Enzo's (post-boss)
- Mama Rosa NPC with scripted + AI hybrid dialogue
- Dot-matrix printer object placed for puzzle
- **Acceptance criteria:**
  - [ ] Sewing shop zone loads
  - [ ] Mama Rosa has introductory dialogue
  - [ ] Zone has distinct fabric/sewing visual theme
  - [ ] Zone is only accessible after Enzo boss is defeated

### Stage 7-8: Dot-matrix printer puzzle + recipe #5 `[x] 2026-03-23`
- Interact with dot-matrix printer to start puzzle
- Paper-threading micro-maze: guide paper through rollers
- Arrow key navigation through tight maze path
- Success prints recipe fragment #5
- **Acceptance criteria:**
  - [ ] Printer interaction opens maze overlay
  - [ ] Arrow keys navigate the paper through the maze
  - [ ] Hitting maze walls resets to start of section
  - [ ] Completing maze awards recipe #5
  - [ ] Puzzle state saved

### Stage 7-9: Wedding planner boss + finale `[x] 2026-03-23`
- Wedding planner boss in Mama's shop (blocking the apron)
- Boss pattern: throws clipboards, summons stress clouds
- Defeating boss → Mama's apron interaction → recipe #5 confirmed
- All 5 fragments → final cooking cutscene → wedding montage → credits
- Credits: scrolling text with character art (drawn on canvas)
- **Acceptance criteria:**
  - [ ] Boss fight triggers and is defeatable
  - [ ] Having all 5 recipe fragments triggers final cooking sequence
  - [ ] Final cooking mini-game plays
  - [ ] Wedding cutscene shows
  - [ ] Credits scroll with character names
  - [ ] Game returns to title screen after credits

---

## Phase 8: Bonus Content

### Stage 8-1: Pepe's obstacle dash interlude `[x] 2026-03-23`
- Endless runner: Pepe runs forward, dodge obstacles
- Random trigger (~40% chance between zone transitions)
- 30 seconds max duration
- Score-based rewards (S/A/B/C)
- **Acceptance criteria:**
  - [ ] Triggers randomly between zones
  - [ ] Pepe runs, player dodges with arrow keys
  - [ ] Obstacles spawn with increasing difficulty
  - [ ] Timer counts down, score tallies
  - [ ] Skippable

### Stage 8-2: Tomato juggling interlude `[x] 2026-03-23`
- Multi-lane reflex game: tomatoes fall, catch in correct lane
- Triggers after completing Zone 1
- Left/right to move, up/down for lane switch
- **Acceptance criteria:**
  - [ ] Triggers after Z1 completion
  - [ ] Tomatoes fall in lanes, player catches
  - [ ] Miss penalty, scoring works
  - [ ] Reward granted based on grade

### Stage 8-3: Remaining interludes `[x] 2026-03-23`
- Coco's air guitar (rhythm, optional Z2)
- Signora Betta's accordion (Simon Says, optional Z1)
- Mama's sewing rhythm (precision rhythm, Z7 unlock)
- Each ~30-45 seconds, skippable, scored
- **Acceptance criteria:**
  - [ ] All 3 interludes trigger at correct moments
  - [ ] Each has distinct gameplay and controls
  - [ ] Scoring and rewards work for each
  - [ ] All are skippable

### Stage 8-4: Remaining millennial puzzles `[x] 2026-03-24`
- Red rotary phone #1 (Z1): dial combination
- Red rotary phone #2 (Z5): Morse code
- VHS tape (Z3): rewind tension meter
- CD-ROM (Z3): scratch cleaning pattern → map + weapon
- Pager/beeper (Z1): calculator word
- Tamagotchi (Z4): timed feeding sequence
- **Acceptance criteria:**
  - [ ] Each puzzle is interactable in its designated zone
  - [ ] Each has a distinct mechanic matching CLAUDE.md spec
  - [ ] Each grants the specified reward
  - [ ] Solved state is saved
  - [ ] None of these break existing zone functionality

### Stage 8-5: Pepe gap mechanic + dog throws `[deferred]`
- Pepe auto-activates at 1-tile-wide gaps
- Pepe squeezes through, triggers switch/collects item on other side
- Both dogs can be "thrown" as gag weapons (bounce back unharmed)
- **Acceptance criteria:**
  - [ ] Pepe animates through narrow gaps automatically
  - [ ] Item/switch on other side is triggered
  - [ ] Dog throw is usable as a weapon (brief stun, dog bounces back)
  - [ ] Dogs cannot be lost or permanently separated from player

---

## Phase 9: Polish

### Stage 9-1: Save/load system `[x] 2026-03-24`
- Save to localStorage: player position, zone, inventory, quest flags, puzzle states, recipe fragments
- Auto-save on zone transition
- Manual save from pause menu
- Load game from title screen
- Save slot display (zone name, playtime, recipe count)
- **Acceptance criteria:**
  - [ ] Game auto-saves on zone transition
  - [ ] Loading restores exact game state
  - [ ] Pause menu has save option
  - [ ] Title screen shows saved game with details
  - [ ] Corrupt/missing save handled gracefully (start new game)

### Stage 9-2: Title screen + pause menu `[x] 2026-03-25`
- Title screen: game logo (canvas-drawn text), "New Game" / "Continue" / "Settings"
- Settings: music volume, SFX volume, API key input
- Pause menu (Escape): resume, save, settings, quit to title
- **Acceptance criteria:**
  - [ ] Title screen shows on page load
  - [ ] New Game starts from La Cucina
  - [ ] Continue loads saved game
  - [ ] Escape opens pause menu mid-game
  - [ ] Settings changes persist in localStorage

### Stage 9-3: Sound tuning pass `[x] 2026-03-25`
- Unique music loop per zone (all 7 zones)
- Boss fight tempo increase (20-30% BPM bump)
- Ambient layer per zone (water, crowd, clocks, etc.)
- All SFX from CLAUDE.md section 9 implemented
- Volume balancing across all zones
- **Acceptance criteria:**
  - [ ] Each zone has distinct music
  - [ ] Boss fights feel more intense due to tempo
  - [ ] Ambient sounds match zone themes
  - [ ] No SFX is missing from the spec
  - [ ] No audio is painfully loud or inaudible

### Stage 9-4: Score, rewards, and balancing `[ ]`
- Score system: coins from enemies, bonus from interludes
- Interlude reward tiers: S/A/B/C grant different items
- Weapon drop balancing: enough ammo without being trivial
- Health/damage balancing across all enemies and bosses
- **Acceptance criteria:**
  - [ ] Score displays in HUD
  - [ ] Interlude rewards match tier (S = rare, C = coins only)
  - [ ] Player has enough weapons to progress without grinding
  - [ ] Boss fights are challenging but fair (beatable in 2-3 attempts)

### Stage 9-5: Full playtest + bug fix pass `[ ]`
- Play through entire game start to finish
- Fix any softlocks, broken transitions, or missing states
- Verify all 5 recipe fragments are collectible
- Verify final cooking scene + credits play
- Performance check: stable 60fps throughout
- **Acceptance criteria:**
  - [ ] Full playthrough completes without crashes
  - [ ] No softlocks or dead ends
  - [ ] All recipe fragments collectible in intended order
  - [ ] Credits play and return to title screen
  - [ ] FPS stays above 55 in all zones

---

## Stage dependency graph

```
1-1 → 1-2 → 1-3 → 1-4 → 1-5 → 1-6
                                  ↓
            2-1 → 2-2 → 2-3 → 2-4 → 2-5 → 2-6
                                              ↓
                              3-1 → 3-2 → 3-3
                                            ↓
                              [F-1 if >1500 lines]
                                            ↓
                    4-1 → 4-2 → 4-3 → 4-4 → 4-5 → 4-6 → 4-7
                                                            ↓
                                          5-1 → 5-2 → 5-3 → 5-4
                                                                ↓
                                              V-1 → A-1
                                                        ↓
                                              6-1 → 6-2
                                                      ↓
                              7-1 → 7-2 → 7-3 → 7-4 → 7-5 → 7-6 → 7-7 → 7-8 → 7-9
                                                                                    ↓
                                                  8-1 → 8-2 → 8-3 → 8-4 → 8-5
                                                                                ↓
                                                  9-1 → 9-2 → 9-3 → 9-4 → 9-5
```

---

## Summary

| Phase | Stages | Focus |
|---|---|---|
| 0 | 1 | Design |
| 1 | 6 | Engine foundation (incl. controls remapping) |
| 2 | 6 | First playable (tutorial + market) |
| 3 | 3 | Audio |
| F | 1 | File split (conditional) |
| 4 | 7 | Zones 2-3 + puzzles |
| 5 | 4 | Weapons + combat + power-ups |
| 5.5 | 2 | Visual + audio upgrade |
| 6 | 2 | AI NPCs |
| 7 | 9 | Zones 4-7 + bosses + finale |
| 8 | 5 | Bonus content (interludes + puzzles) |
| 9 | 5 | Polish + ship |
| **Total** | **51** | |

---

*End of BACKLOG.md. Update stage checkboxes as work is completed.*
