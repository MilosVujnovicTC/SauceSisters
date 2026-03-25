# CLAUDE.md — The Sauce Sisters
> Paste this entire file at the start of every new session.  
> Last updated: session 1 (design phase). Update the CHANGELOG at the bottom after every session.

---

## 1. What this project is

A browser-based top-down RPG game (HTML + vanilla JS, single file) inspired by classic Zelda and Minecraft, with a wholesome Pixar-style tone. Two Italian-inspired tween sisters run a restaurant and must find their Mom's secret tomato sauce recipe hidden in 5 fragments across a small city — in time for a wedding.

**Playable in the browser. No build tools. No frameworks. No backend required.**

---

## 2. Core tech stack

| Layer | Technology | Notes |
|---|---|---|
| Rendering | HTML5 Canvas (2D) | Tile-based, top-down |
| Game logic | Vanilla JS | No frameworks |
| Music | Tone.js (CDN) | Procedural, no audio files |
| SFX manager | Howler.js (CDN) | Spatial audio, sprites |
| Procedural SFX | Web Audio API | Native, no library |
| AI NPCs | Anthropic API (`claude-haiku-4-5-20251001`) | Prompt-cached system prompts |
| Persistence | localStorage | Save/load world state |

**CDN sources allowed:** `cdnjs.cloudflare.com`, `cdn.jsdelivr.net`, `unpkg.com`, `esm.sh`  
**Never introduce npm, webpack, or any build step.**  
**Everything must run from a single `.html` file unless explicitly split.**

---

## 3. Characters

| Name | Age | Role | Dog companion | AI level |
|---|---|---|---|---|
| Giulia | ~13 | Player 1 / lead | Brodo (basset hound — sniffs items) | Playable |
| Coco | ~9 | Player 2 / co-op | Pepe (chihuahua — squeezes through gaps) | Playable |
| Papa Marco | Adult | Headset guide ("Alfred") | — | Fully AI-driven (Haiku) |
| Mama Rosa | Adult | Final NPC gatekeeper | — | Hybrid scripted + AI |
| Enzo | Adult | Rival pizzeria boss | — | Hybrid scripted + AI |
| Signora Betta | Elderly | Zone 1 quest NPC | — | Hybrid scripted + AI |

### Flavor NPCs (non-quest)
Every zone should have 2–4 flavor NPCs in addition to quest-critical ones. They exist purely to make the world feel alive and funny. Types:
- **Joke-tellers** — dad jokes, food puns, absurd observations ("I once saw a tomato cry. It was a Roma-ntic comedy.")
- **Gossip/rumor** — hint at lore or other zones without being quest-critical ("I heard Enzo puts ketchup on his pizza. Disgusting.")
- **Absurd situational** — doing something ridiculous when you talk to them ("*is talking to a potato*" "Oh! Sorry, I was in a meeting.")
- **Recurring gag** — same NPC archetype appears in multiple zones with a running joke
- **Reactive** — dialogue changes based on game state (e.g., after collecting a recipe fragment: "You smell like tomatoes. Good sign.")

Flavor NPCs are **scripted only** — no API calls. Each has 2–4 random lines that cycle. They should never block progress or feel like quest NPCs.

### NPC reactions
NPCs should react when the player does something near them:
- **Push a crate/object toward them** — funny complaint ("Hey! Watch it!", "Do I LOOK like a shelf?!")
- **Throw a weapon near them** — startled reaction ("Was that a TOMATO?!", "My grandmother threw better than that!")
- **Use dog abilities near them** — comment on the dog ("Your dog just sneezed on my tomatoes...", "That chihuahua has more energy than my entire staff.")
- Reactions are brief (1-2 lines), don't interrupt gameplay flow, and use a cooldown so they don't spam.

### NPC memory rules
- **Quest NPCs** must use `getLines(questFlags)` to change dialogue based on game state. Never repeat the same intro after the player has already spoken to them.
- **Flavor NPCs** should cycle through their lines (not repeat the same sequence). Use a `talked_to_[id]` flag or a visit counter to vary responses.
- **All NPCs** should feel alive — no NPC should say the exact same thing on every visit. At minimum, have a first-visit line and a returning-visit line.

**Tone:** Wholesome + funny. Like a Pixar short. Never mean, never dark.
**Sisters' dynamic:** Giulia = methodical/curious. Coco = chaotic/throws things first.  
**Papa's voice:** Dad jokes, cooking metaphors, always cut short by a [GRUNT] or [CLANG].

---

## 4. World map — 7 zones

```
[Start] La Cucina → [Z1] Signora Betta's Market → [Z2] Canal Crossing
     → [Z3] Old Library → [Z4] Papa's Gym (midpoint)
     → [Z5] Piazza Vecchia → [Z6] Enzo's Pizzeria → [Z7] Mama's Sewing Shop [End]
```

| Zone | Key mechanic | Recipe fragment | Boss/challenge |
|---|---|---|---|
| La Cucina | Tutorial, movement | — | None |
| Z1 Market | Crate pushing (NPC quest) | #1 — inside tomato crate | None |
| Z2 Canal | BMX bike + plank bridge BUILD | — | None |
| Z3 Library | Cartridge puzzle, Brodo sniff | #2 — inside cookbook | Cat mini-boss |
| Z4 Papa's Gym | Midpoint hub, refreshments | #3 — on Papa's competition form | None |
| Z5 Piazza | Bench/planter BUILD puzzle | — | None |
| Z6 Enzo's | Boss fight, cooking mini-game | #4 — inside sauce machine | Enzo boss |
| Z7 Mama's Shop | Final zone, sewing machine puzzle | #5 — sewn in Mama's apron | Wedding planner boss |

**Recipe assembly:** All 5 fragments → final cooking mini-game → sauce made → wedding saved → credits.

---

## 5. Weapons

| Item | Effect |
|---|---|
| Bag of flour | 2-tile radius cloud stun |
| Tomato | Thrown projectile — splat slows 3s |
| Banana | Floor trap — enemy slips |
| Spatula | Melee + flips switches/pressure plates |
| Dirty sock | Fear + stun — enemy retreats |
| Plastic toy | Distracts dogs/enemies, lures Pepe |
| Rolling pin | Unlocked at Z7 — heavy melee + dough flattener |
| CD-ROM | One-time spinning disc stun (from millennial puzzle) |

---

## 5b. Power-ups

Timed buffs found in the world or earned from interludes. **One active at a time** — picking up a new one replaces the current buff.

| Item | Effect name | Effect | Duration | Where found |
|---|---|---|---|---|
| Broccoli | Iron Legs | Move 50% faster | 12s | Z1 Market (veggie crate), Z3 Library |
| Chocolate Milk | Sugar Rush | Attack speed doubled, cooldowns halved | 10s | Z4 Gym (juice bar), interlude A-tier |
| Water | Cool Head | Enemy detection range reduced 50% (stealth) | 15s | Z2 Canal (dock barrel), Z5 Piazza (fountain) |
| Deli Meat | Protein Shield | Absorb next 3 hits without damage | 20s or 3 hits | Z1 Market (deli counter), Z6 Enzo's kitchen |
| Gouda Cheese | Sticky Aura | Enemies within 2 tiles slowed 50% | 12s | Z1 Market (cheese wheel), Z5 Piazza (vendor) |
| Brownie (Muffin) | Brodo Boost | Brodo sniff radius doubled + auto-reveals hidden items | 15s | Z3 Library (reading nook), interlude S-tier |
| Milk | Mama's Comfort | Papa hint calls don't consume hint counter | 20s | Z4 Gym (juice bar), Z7 Mama's Shop |

**Rules:**
- One active at a time — new pickup replaces current buff (brief "swapped!" indicator)
- Found in specific world locations (crates, barrels, shelves, counters)
- Interlude rewards: A-tier = common power-up, S-tier = rare (Brownie, Milk)
- HUD shows active power-up icon + depleting timer bar
- Player sprite gets a subtle glow while buff is active
- World power-ups respawn when player re-enters the zone; interlude rewards are one-time
- SFX: pickup (bubbly chime), expiry (gentle poof), swap (quick whoosh)

---

## 6. Game mechanics

### Movement & world
- Arrow keys / WASD to move (default — all controls are rebindable)
- `Z` or `Space` to attack/interact
- Tile-based collision (16×16 or 32×32 px tiles)
- Camera scrolls with player

### Controls remapping
- All keyboard controls are rebindable via a settings screen
- Key bindings stored in localStorage and in the CONFIG object
- Default bindings: WASD/arrows = move, Z/Space = interact, B = Brodo sniff, P = Papa call
- Remapping UI: select action → press new key → confirm (reject duplicates)
- Bindings persist across sessions via localStorage

### Build mechanic
- Pushable objects snap to grid
- Specific tiles designated as "fill targets"
- Objects placed on fill targets trigger bridge/path unlock
- Zones: Z2 canal (planks), Z5 piazza (benches + planters)

### Dog abilities
- **Brodo:** `B` key — sniff radius reveals hidden items (shown as sparkle)
- **Pepe:** Auto-activates on 1-tile-wide gaps Giulia can't cross
- Both can be "thrown" as gag weapons (bounce back fine)

### Papa hint system
- Papa calls in at each zone entry
- Player can radio Papa with `P` key — max 3 calls per zone
- If 0 hints remain: "Going for a set, talk later. [GRUNT]"

### NPC dialogue
- Press `Z` near NPC to start
- Scripted tree for story beats
- API call for freeform questions (fallback to scripted if API unavailable)
- Each NPC has unique voice blip scale (Tone.js, plays per text character)

---

## 7. Interludes (bonus stages)

| Name | Type | Trigger | Controls |
|---|---|---|---|
| Papa's drum solo | Rhythm — falling notes | Guaranteed after Z4 | ↑↓←→ + Space |
| Coco's air guitar | Rhythm — chord combos | Optional in Z2 | Arrow combos |
| Signora Betta's accordion | Simon Says memory | Optional in Z1 | ↑↓←→ |
| Tomato juggling | Reflex — multi-lane | After Z1 | ←→ + ↑↓ |
| Mama's sewing rhythm | Rhythm — precision | Z7 unlock | ↓↓ alternating |
| Pepe's obstacle dash | Endless runner | Random ~40% between zones | ↑↓←→ |

**Reward tiers:** S = rare weapon/hint token. A = standard refill. B/C = coins only.  
**Duration:** 30–60 seconds max. Never a blocker — always optional bonus.

---

## 8. Millennial object puzzles

| Object | Zone | Mechanic | Reward |
|---|---|---|---|
| Nokia 3210 | Z3 Library | T9 cipher — spell "GIULIA" | Recipe #2 + Snake bonus |
| Red rotary phone | Z1 Market storeroom | Dial combination 392-4477 | Opens storeroom |
| Red rotary phone #2 | Z5 Piazza payphone | Morse code decode | Hidden tunnel location |
| BMX bike | Z2 Canal | Side-scroll plank collection + tire pump rhythm | Bridge planks |
| Retro cartridge (NES-style) | Z3 Library | Button-mash blow + cartridge memory order | Hidden room + La Salsa Bros game |
| VHS tape | Z3 Library | Rewind tension meter | Story clue video |
| CD-ROM | Z3 Library | Scratch cleaning pattern | Map fragment + weapon |
| Pager/beeper | Z1 Market | Calculator word (07734 = HELLO) | Shortcut key |
| Tamagotchi | Z4 Gym area | Timed feeding sequence across zone | Key item (or harder quest if fails) |
| Dot-matrix printer | Z7 Mama's Shop | Paper-threading micro-maze | Recipe fragment #5 |

---

## 9. Sound design

### Music (Tone.js — all procedural)
- Each zone has a unique loop (Italian-flavored scales)
- Tempo increases 20–30% during boss fights via `Tone.Transport.bpm`
- Ambient layer per zone (filtered noise, clock ticks, water, crowd)

### SFX voices
- **Brodo:** Tone.FMSynth, 80–180Hz, long decay — deep and mournful
- **Pepe:** Tone.Synth triangle, 600–1400Hz, rapid short bursts — yappy
- **NPC blips:** Each NPC has unique note scale, one note per dialogue character

### Key SFX
- Flour poof: white noise burst + high-freq sparkle sweep
- Tomato splat: noise + low-pass filter pitch slide down
- Crate push: low filtered noise, duration scales with distance
- Recipe found: Tone.js major 7th chord arpeggiated up + shimmer

---

## 10. AI NPC system

### Model
`claude-haiku-4-5-20251001` — fast, cheap, cached system prompts.

### Prompt caching strategy
- Each NPC system prompt (~150–200 tokens) is cached after first call
- Game state variables injected at runtime: `{zone}`, `{items_collected}`, `{quest_flags}`, `{hints_remaining}`
- Max response: 2–3 sentences. Always stay in character.

### NPC AI levels
- **Papa Marco:** Fully AI — called frequently, personality IS the comedy
- **Enzo, Mama Rosa, Signora Betta:** Hybrid — scripted for story beats, AI for freeform
- **Minor NPCs, cat, wedding guests:** Scripted only — no API calls

### Fallback
If API unavailable or quota exceeded: silently fall back to scripted response pool. Never show an error to the player.

---

## 11. File/module structure

When the game grows beyond one file, split as follows:

```
sauce-sisters/
├── index.html          ← entry point, loads everything
├── CLAUDE.md           ← THIS FILE — always keep updated
├── js/
│   ├── engine.js       ← canvas loop, input, camera, collision
│   ├── world.js        ← tile maps, zone definitions, object placement
│   ├── entities.js     ← player, NPCs, enemies, dogs
│   ├── weapons.js      ← weapon logic, hitboxes, effects
│   ├── puzzles.js      ← all puzzle mechanics incl. millennial objects
│   ├── interludes.js   ← all 6 bonus mini-games
│   ├── audio.js        ← Tone.js music + Howler.js SFX manager
│   ├── npc-ai.js       ← Claude API calls, caching, fallback
│   ├── ui.js           ← HUD, dialogue boxes, inventory, menus
│   └── save.js         ← localStorage save/load
└── assets/
    └── tiles.js        ← tile definitions (no image files — drawn in canvas)
```

**Until explicitly split: keep everything in `index.html`.**

---

## 12. Coding rules (NEVER violate these)

1. **No regressions.** Before changing any function, read its full implementation. State what it currently does. Then make the change.
2. **No silent rewrites.** If rebuilding a system, say so explicitly. Don't quietly replace working code.
3. **No assumed state.** Never assume what variables exist. If unsure, ask or grep for them.
4. **Preserve all existing functionality** when adding new features. Adding the Nokia puzzle must not break the crate-push mechanic.
5. **One system at a time.** Build engine → world → player movement → one zone → one puzzle → one interlude. Never skip ahead.
6. **Test each system before moving on.** State what should be testable after each addition.
7. **No magic numbers.** All constants go in a `CONFIG` object at the top of the file.
8. **Comment all public functions** with a one-line description of what they do and what they return.
9. **Keep the game loop clean.** `update()` → `render()`. No logic in `render()`, no drawing in `update()`.
10. **Audio must be user-gesture gated.** Tone.js and Web Audio require a click/keypress before sound can play. Always handle this.
11. **Validate before presenting.** Before asking the user to test, Claude must: (a) re-read all changed code for logic errors, (b) trace player-facing flows end-to-end (can the player reach, interact with, and complete everything?), (c) check for common gameplay bugs: unreachable items, broken pickups, missing collision, softlocks, orphaned quest flags. Flag any issues found and fix them before the user sees the build.
12. **Preemptive gameplay audit.** After each stage, mentally simulate a playthrough of all working features — not just the new one. Check: Can the player still complete all prior zones? Do new entities block old paths? Do inventory/quest flags still flow correctly? Document what was checked.

---

## 13. Build order

**See `BACKLOG.md` for the full staged build plan (47 stages across 10 phases).**

Each stage is atomic, independently testable, and designed to complete within a single session without context compaction. Follow the stages in order. Do not skip ahead. Do not combine stages.

**Current stage:** Phase 10 (Post-launch features). Next: Stage 10-1 (Intro cutscene).

---

## 14. Session workflow

### Rules

1. **Repo is the single source of truth.** This project moves between computers. All memory, state, and progress tracking lives in the repo files (CLAUDE.md, BACKLOG.md, HANDOFF.md). Never rely on conversation memory or external notes.
2. **Flag compaction risk.** When the session is approaching context compaction, immediately warn the user so a new session can be started. Output: `"COMPACTION WARNING: This session is near context limits. Recommend starting a new session. Current stage: [X]. Status: [done/in-progress]."` Do this BEFORE compaction happens, not after.
3. **Confirm-then-commit workflow.** After implementing a stage, the user tests it. Only when the user confirms the feature works:
   - Update BACKLOG.md: mark the stage `[x]` with the date
   - Update CLAUDE.md: update "Current stage" in section 13, add changelog entry in section 16
   - Update HANDOFF.md: write the session handoff state (see below)
   - Commit all changes with a descriptive message
   - Push to remote

### Session start protocol

At the START of every session, Claude must:
1. Read `CLAUDE.md`, `BACKLOG.md`, and `HANDOFF.md`
2. Identify the current stage from BACKLOG.md (first unchecked stage)
3. Read the full current codebase
4. State: "Starting stage [X]. Last completed: [Y]. Goal: [Z]."

### Session end / handoff protocol

At the END of every session (or when compaction is near), Claude must write `HANDOFF.md` in the project root:

```markdown
# HANDOFF.md — Session State
> Auto-generated. Read this at the start of every new session.

## Last completed stage
- Stage [X-Y]: [name] — completed [date]

## Current stage in progress (if any)
- Stage [X-Y]: [name]
- Status: [not started / in progress / awaiting user confirmation]
- What's done so far: [details]
- What remains: [details]

## Current state of the codebase
- Files: [list of project files]
- Total lines in index.html: ~XXX (or per-file if split)
- Working features: [bullet list]
- Known issues: [bullet list]

## CONFIG values
- TILE_SIZE: XX
- CANVAS_W: XX
- [etc.]

## Next step
- [exact next task to pick up]
```

---

## 15. Anti-hallucination checklist

Before writing any code, Claude must confirm:
- [ ] I have read the current full code (or it has been provided)
- [ ] I know which functions already exist
- [ ] I am not rewriting anything that works
- [ ] The feature I'm adding is the current stage in BACKLOG.md
- [ ] I will state what the code does BEFORE and AFTER my change

---

## 16. Changelog

| Session | Date | Stage | What was done |
|---|---|---|---|
| 1 | 2026-03-22 | 0-1 | Full game design: story, characters, zones, weapons, mechanics, interludes, millennial puzzles, sound design, AI NPC system. CLAUDE.md created. |
| 1b | 2026-03-22 | — | BACKLOG.md created (47 stages). CLAUDE.md updated with workflow rules. HANDOFF.md protocol established. |
| 1c | 2026-03-22 | — | Added power-up system (7 items), controls remapping, validation/testing rules. BACKLOG.md now 49 stages. |
| 2 | 2026-03-22 | 1-1 | Canvas bootstrap: index.html created with game loop, CONFIG, FPS counter, tile grid. Canvas 768x576 (32px tiles = 24x18 grid). |
| 2 | 2026-03-22 | 1-2 | Input system: keyboard handler with held/justPressed/justReleased states, event queuing, repeat filtering, debug overlay. |
| 2 | 2026-03-22 | 1-3 | Controls remapping: bindings object, actionHeld/actionJustPressed helpers, remap UI overlay (Tab), localStorage persistence, duplicate rejection, reset-to-defaults. |
| 2 | 2026-03-22 | 1-4 | Tile renderer: TILES definitions (7 types), tilemap 2D array, renderTiles with visibility culling, test map 20x15, fullscreen canvas with dynamic resize. |
| 2 | 2026-03-22 | 1-5 | Player movement + collision: player entity, smooth pixel movement via actionHeld(), axis-independent collision resolution, wall sliding, map bounds clamping, facing indicator. |
| 2 | 2026-03-22 | 1-6 | Camera system: smooth lerp follow, map boundary clamping, center-when-smaller-than-screen, expanded test map to 40x30 with multiple buildings/paths/water. |
| 2 | 2026-03-22 | 2-1 | Zone system: ZONES data structure, loadZone(), checkTransitions() with cooldown, La Cucina 24x18 tilemap, Market 32x24 placeholder, bidirectional door transitions. New tile types: STOVE, RUG, SHELF. |
| 2 | 2026-03-22 | 2-2 | Market tilemap: 32x28 outdoor market with stall rows, barrels, flowers, central path, cross paths, Betta's shop building with counter. New tile types: STALL, BARREL, FLOWER. Bidirectional transitions verified. |
| 2 | 2026-03-22 | 2-3 | NPC system: NPC entities per zone, findNearbyNPC(), dialogue box with char-by-char reveal + word wrap, advance/close with interact key, player locked during dialogue, "[Z] Talk" prompt. Flavor NPC design added to CLAUDE.md. |
| 2 | 2026-03-22 | 2-4 | Quest flags system, getLines(questFlags) for dynamic dialogue, onComplete callbacks, Signora Betta with 3-state quest dialogue, all NPCs converted to memory-aware (Luigi, Marco, Nonna Pina). NPC memory rules added to CLAUDE.md. |
| 2 | 2026-03-22 | 2-5 | Pushable crates: pushable entities per zone, smooth lerp slide animation, collision with walls/crates/NPCs, 4 crates in Market. Sub-pixel tile gap fix. NPC reaction design added to CLAUDE.md. |
| 3 | 2026-03-22 | 2-6 | Recipe fragment #1 + inventory: ITEMS definitions, inventory array, world items system, HUD inventory bar, crate contents reveal on push, auto-pickup + interact pickup, golden flash effect, quest flag integration, Betta dialogue reacts. |
| 4 | 2026-03-22 | F-1 | File split: 1656-line index.html → 7 files. index.html (40-line loader), assets/tiles.js, js/engine.js, js/save.js, js/world.js, js/entities.js, js/ui.js. No code changes — reorganization only. |
| 4 | 2026-03-22 | 3-1 | Audio system bootstrap: Tone.js loaded from unpkg CDN (v14.7.77), audio unlock on first user gesture, audio manager (play/stop/setVolume/isUnlocked), test tone on M key, debug overlay shows audio status. New file: js/audio.js. |
| 4 | 2026-03-22 | 3-2 | Zone music loops: La Cucina (A minor, 80 BPM, warm pad + triangle melody with delay) and Market (D major, 115 BPM, filtered sawtooth arpeggios + walking bass + sparse pads). Crossfade via gain ramp + Transport.scheduleOnce. Running-state tracker prevents duplicate scheduling. silentDb=-60 replaces -Infinity for clean ramps. |
| 4 | 2026-03-22 | 3-3 | SFX system: independent SFX gain bus, footsteps (white noise burst every 0.22s while moving), crate push (brown noise), item pickup (ascending E5→G5→C6 chime), NPC dialogue blips (unique oscillator/pitch per NPC via NPC_BLIP_PROFILES). Music ducks -12dB during dialogue for blip clarity. |
| 4 | 2026-03-22 | 4-1 | Canal zone: 30x20 tilemap with water canal, north/south docks, bridge with 2-tile gap (impassable). New tiles: DOCK, PLANK, BRIDGEGAP. Water animation (sine-wave color cycling). Market east exit at row 14. Canal music (Em, 70 BPM, ambient pad + water-drop melody). NPCs: Old Sal, Zia Carmela. Music system refactored: Transport reset on zone change, manual fade via game loop (no Tone.js automation). |
| 5 | 2026-03-22 | 4-2 | BMX side-scroller mini-game: game mode system (overworld/bmx), interactable objects system, BMX bike in Canal zone. Side-scroll with auto-scroll, double jump (ground + air), 4 collectible planks, barrels/gaps as obstacles, health hearts (3 HP), deep water gaps with fall animation, dust trail, parallax clouds/hills, intro countdown, result screen. Plank items (plank_1-4) added. New file: js/puzzles.js. |
| 5 | 2026-03-22 | — | Market heart puzzle redesign: replaced single-crate recipe reveal with shape puzzle. Betta gives scroll showing heart pattern (6-tile shape). 6 crates placed around Market, golden pulsing target markers on ground. Scroll overlay (press I to view). Crate reset on zone re-entry. Recipe spawns at heart center when all targets filled. |
| 5 | 2026-03-22 | 4-3 | Bridge build mechanic: place plank items on BRIDGEGAP tiles to repair bridge. getFacingBridgeGap() detects gap in front of player, placeBridgePlank() consumes plank from inventory, completeBridge() converts gaps to walkable PLANK tiles. Golden pulsing markers on gaps when player has planks. Placed-but-incomplete planks render as overlay. Bridge state persists via restoreBridgeState() in loadZone. removeFromInventory() + getFirstPlank() added to save.js. |
| 5 | 2026-03-22 | 4-4 | Library zone: 24x18 tilemap with bookshelves (SHELF), reading tables (COUNTER), rugs, narrow aisles, reading nooks. Canal→Library transition via south path (row 19 doors). Library music (C major, 65 BPM, music-box melody + sine pad). NPCs: Signora Lucia (librarian), Professor Gatto (comedic reader). 3 interactable bookshelf objects (Cooking, History, Old — using startDialogue for flavor text). Canal bypass fix: west dock replaced with water at rows 9-11, entry moved to north-west doors. NPC blip profiles added for library NPCs. |
| 5 | 2026-03-22 | 4-5 | Brodo sniff mechanic: basset hound companion follows player with trail-based delay (0.6s behind, lerp smoothing). B key triggers sniff — expanding golden ring animation, checks hidden items within 96px radius. Hidden items system: per-zone hiddenItems array, revealed items spawn as collectible world items with sparkle effect (4s duration, fading). Recipe #2 hidden in Library near Old Bookshelf. Brodo rendered as basset hound (long body, floppy ears, stubby legs). Script load order: entities.js moved before world.js. |
| 6 | 2026-03-22 | 4-6 | Nokia T9 puzzle: Nokia 3210 interactable object in Library (col 3, row 5). T9 multi-tap overlay with Nokia phone UI (green screen, number pad). Digit2-9 keys cycle letters (old Nokia style), 0.8s auto-confirm, Backspace to delete, Enter to submit. Target word "GIULIA". Success spawns recipe #2 at (6,12), sets nokia_solved flag. Fail shows screen shake + retry. Nokia hidden after solved. Recipe #2 available via both Nokia puzzle and Brodo sniff (independent paths). |
| 6 | 2026-03-22 | — | Brodo idle behaviors: state machine (following/idle/returning). After 5-10s of following, Brodo stops and does idle animations (sit, bark, ball, sniff_ground, nap) with speech bubbles. B key calls him back. Bark SFX via Tone.FMSynth (100-160Hz). No auto-return — player must call with B. Zone transitions reset to following. |
| 6 | 2026-03-22 | 4-7 | Cartridge puzzle + cat mini-boss: NES cartridge at Library (12,12) — two-phase puzzle (button-mash blow + 4-symbol memory sequence). Library cat patrols rows 9/11 with 6 waypoints, chases player on line-of-sight (160px range, raycast wall check), stunned by Brodo bark (B key within sniff radius). 3 stuns to defeat. Cat uses collidesWithMap for wall collision. cat_defeated and cartridge_solved flags for persistence. |
| 6 | 2026-03-22 | 5-1 | Weapon system: new js/weapons.js file. WEAPONS definitions (spatula, tomato, flour, banana, dirty_sock). Equip/cycle with Q key. Melee attack on Z when no NPC/object nearby. Spatula: 40px range hitbox in facing direction, 0.15s swing animation (rotating arc), 0.4s cooldown. checkMeleeHits() stuns library cat. Weapon HUD top-right. Spatula pickup in La Cucina (8,4). Debug hitboxes toggleable via CONFIG.SHOW_HITBOXES. |
| 6 | 2026-03-22 | 5-2 | Ranged + trap weapons: projectile system (tomato, dirty_sock) — fly in facing direction, wall collision via getTile, enemy hit check, splat animation. Trap system (banana) — placed at player tile, triggers on enemy overlap. Area system (flour) — instant radius check + cloud puff visual. Ammo system: consumables have per-pickup ammo (tomato x3, flour x3, banana x2, sock x2). HUD shows "Weapon xN". Depleted items auto-removed + auto-cycle. Pickups: flour in La Cucina (8,10), tomato basket in Market (13,6), banana stand in Market (20,6). Objects reappear after ammo spent. Zone change clears projectiles/traps/effects. |
| 6 | 2026-03-22 | 5-3 | Enemy system: generic enemy entities in entities.js. Per-zone enemy defs with patrol waypoints, HP, speed, sightRange, drops. AI states: patrol (waypoint bounce), chase (line-of-sight + raycast), stunned, slowed, retreat, dead. hitEnemy() applies damage, knockback, weapon effects (stun/slow/trip/fear). HP bar when damaged. Death drops items via spawnWorldItem. All weapon types connected: melee checkMeleeHits, projectile updateProjectiles, trap updateTraps, area startAreaAttack all check enemies[]. 2 test goons in Market zone (purple, 3HP, drop tomato/banana). Visual: state-based colors, walking legs, stunned stars, slow ice, retreat sweat. |
| 6 | 2026-03-22 | 5-4 | Power-up system: 7 timed buffs (POWERUPS defs), activeBuff state, one-at-a-time with swap indicator. Buff multiplier helpers: getBuffSpeedMult (broccoli 1.5x), getBuffCooldownMult (choco_milk 0.5x), getBuffStealthMult (water 0.5x), getBuffSniffMult (brownie 2x), isBuffFreeHints (milk). Gouda aura slows enemies in 2-tile range. Deli Meat shield absorbs 3 hits. World pickups per zone (respawn on re-entry). HUD: icon + depleting timer bar. Player glow while active. Placed in 4 zones for testing. |
| 6 | 2026-03-22 | — | Player health + lives: 3 HP hearts, 3 lives. damagePlayer() with invulnerability frames (1.5s blink). Death animation (shrink/fade), resurrect on spot (lives--), 4th death restarts from La Cucina. Enemy + cat contact damage during chase. Deli Meat shield inline absorb check. Health hearts HUD bottom-left with lives counter. Red damage flash overlay. safeTrigger() wrapper for all Tone.js calls to prevent scheduling crashes. |
| 7 | 2026-03-22 | V-1 | Visual upgrade: new js/sprites.js (~1100 lines) generates all pixel art procedurally on offscreen canvases. 16 textured tile types (brick walls, grass tufts, water ripples, wood grain, flowers, bookshelves). Giulia 4-dir walk cycle (4 frames each), ALTTP-style 1px dark outlines. Brodo basset hound (5 states). NPC sprites with custom colors/accessories. Enemy sprites (5 states). Object sprites (crate, BMX, Nokia, cartridge, tomato basket, banana stand, spatula, flour bag, bookshelves). 7 item sprites + 7 power-up sprites. World glow effects (door light, vignette). BMX mini-game upgraded (gradient sky, sun, parallax trees, Giulia rider, enhanced obstacles). Nokia overlay (gradient body, LCD scanlines, 3D buttons, D-pad). Cartridge overlay (beveled body, screw holes, warning sticker, colored controller buttons). All render functions migrated from fillRect to drawImage. Inventory + weapon HUD use item sprites. |
| 7 | 2026-03-22 | — | Pre-A1 feature bundle: (1) Pull mechanic — Shift key + walk away from crate pulls it. getFacingPushable(), tryPull() in world.js, facing locks while pulling. "[Shift] Pull" prompt. (2) Enchanted Broom replaces cat miniboss — all libraryCat→libraryBroom renamed across 6 files, broom sprites (upright/flying/fallen), "SWOOSH!" label, broom_defeated flag. (3) NPC idle behaviors — updateNPCs(dt) with continuous animations: Luigi (steam), Betta (arrange items), Nonna Pina (knitting needles+yarn), Old Sal (fishing line+bobber+ripples), Zia Carmela (bread crumbs), Lucia+Gatto (open book). (4) NPC walking — walkPath waypoints with pixel-coordinate movement, ping-pong patrol, collision checking via collidesWithMap, sprite flip for left-facing, walking leg bob, NPCs stop and face player during dialogue. (5) NPC portraits — 7 LucasArts/Sierra-style 64x64 face portraits (Luigi chef hat+mustache, Betta headscarf+wrinkles, Nonna Pina glasses+bun, Old Sal squinting+crooked grin, Zia Carmela flower+laugh lines, Lucia pince-nez+chain, Prof Gatto wild hair+thick glasses, Marco winking). Gold double-border portrait frame in dialogue box. |
| 8 | 2026-03-23 | A-1 | Audio upgrade: Howler.js added for sample-based SFX (Kenney.nl CC0). 54 .ogg files in assets/audio/sfx/ (footsteps on 3 surfaces, crate push, pickups, weapon swings, splats, hits, doors, books, metal pots, power-ups). Zone-typed footstep surfaces. Tone.js music upgraded: shared Reverb+Chorus bus, FM mandolin arpeggios (Market), detuned accordion pads (Cucina), FM bell water drops (Canal), FM music-box melody (Library), MembraneSynth kick + noise shaker percussion. Ambient layers per zone: kitchen sizzle, market crowd murmur, canal water flow, library air. NPC blips upgraded: half use FMSynth for character. Named weapon SFX functions replace placeholders. Music ducking now also ducks ambient. Tone.js fallback if Howler/files unavailable. |
| 8 | 2026-03-23 | 6-1 | Papa Marco hint system: Papa portrait (sporty dad, headset, green tank top, stubble, warm grin). FMSynth blip (F3, harmonicity 2.5). 4 zone hint pools with intro + 3 progressive hints + no-hints fallback. P key triggers callPapa() — next hint for current zone, counter per zone (3 max). Milk power-up makes hints free. Auto-intro on first zone entry (0.5s delay via updatePapaAutoCall). HUD: [P] Papa X/3 counter below health hearts. Dad jokes + cooking metaphors ([GRUNT], [CLANG]). |
| 9 | 2026-03-23 | 7-1 | Papa's Gym zone (28x22): 4 new tile types (MAT, EQUIPMENT, JUICEBAR, MIRROR) with sprites. Weight rack area, central mat area with mirrors, Papa's corner (back-left desk), lounge (back-right), juice bar. 3 NPCs: Coach Fabio, Juice Bar Jenny, Big Tony — all with portraits, blip profiles, idle behaviors, walk paths, multi-visit dialogue. Recipe #3 on Papa's competition form (interact). Tamagotchi placeholder (Stage 8-4). Punching bag interactable. Library south-wall door → Gym transition. Gym music (G major, 130 BPM — driving bass + chord stabs + lead melody). Gym ambient (low hum). Papa hints (5 entries). Cache-busting ?v=7 on all script tags. Tile shorthands use _MT/_EQ/_JB/_MR (var) to avoid CDN global conflicts. |
| 9 | 2026-03-23 | 7-2 | Papa's Drum Solo interlude: 4-lane rhythm game (←↓↑→ + Space for specials). ~90 notes across 4 sections (intro → alternating → eighths → full intensity → finale) at 130 BPM (~30s). Timing windows: Perfect ±60ms, Great ±120ms, OK ±200ms. Combo tracking. Grade S/A/B/C with rewards (S=Brownie powerup, A=Choco Milk powerup, B=Tomato item, C=nothing). Full backing track: FM bass (G minor groove), square guitar stabs, sine organ pads, kick+snare+hihat drum loop — all Tone.js procedural. Music starts on play, stops on result. Triggered on gym exit with recipe_3_found. Return zone stored and loaded after interlude. MembraneSynth hit SFX per note. Dark stage background with spotlight, color-coded lanes, rating popups, progress bar, result screen. |
| 10 | 2026-03-23 | 7-3 | Piazza Vecchia zone (30x22): 3 new tile types (FOUNTAIN animated 4-frame, COBBLE 2-variant, FILLTARGET). Open cobblestone square with 6x5 fountain centerpiece, cross-shaped path network, flower planters at corners. Build puzzle: 4 pushable objects (2 benches + 2 planters with distinct sprites) on fill targets at east wall (col 25, rows 10-13). Completion opens east wall passage (tiles convert to walkable cobble+doors). Pushable reset on re-enter if unsolved. Puzzle state persists via flags. 3 NPCs: Vendor Gianluca (straw hat, cannoli vendor), Nonna Viola (purple shawl, round glasses, pigeon feeder), Accordion Carlo (beret, singing flavor NPC) — all with portraits, blip profiles, idle behaviors, walk paths, multi-visit dialogue. Piazza music (F major, 95 BPM — FM mandolin melody + triangle accordion pad + walking bass). Ambient: crowd murmur + fountain trickle. Papa hints (3 entries). Gym↔Piazza bidirectional transitions (gym south → piazza north-right). renderPushables now uses p.type for sprite selection (bench/planter/crate). Power-ups: Water + Gouda Cheese. Cache-busting ?v=10. |
| 10 | 2026-03-23 | 7-4 | Enzo's Pizzeria zone (28x20): 4 new tile types (OVEN red brick with fire glow, DINING wood table with cloth, SAUCEMACH steel with pipes, CHECKERED subtle cream/tan floor). Three-area layout: dining area (left, checkered floor + 12 dining tables), kitchen (center, floor + ovens + stoves + counters), sauce machine room (right, locked behind wall at col 22 rows 9-10 — opens via restoreSauceRoomDoor after enzo_boss_defeated flag). Door passage at col 13 rows 9-11 connects dining↔kitchen. West entrance from Piazza east passage. 3 NPCs: Enzo (angry chef, tall hat, pointed mustache — pre-boss dialogue, multi-state quest dialogue), Waiter Marco Jr. (nervous bowtie, flavor NPC), Waitress Sofia (exasperated ponytail, flavor NPC) — all with portraits, blip profiles, idle behaviors, walk paths. Pizzeria music (A minor, 120 BPM — punchy FM bass + staccato sawtooth chords + cocky square lead). Ambient: kitchen sizzle + low rumble. Papa hints (3 entries). Piazza↔Pizzeria transitions. Power-up: Deli Meat. Cache-busting ?v=11. |
| 11 | 2026-03-23 | 7-5 | Enzo boss fight: 3-phase boss (18 HP) in the kitchen arena. Phase 1: pizza dough projectiles. Phase 2 (67% HP): adds charge attack with 0.8s telegraphed windup + dashed direction indicator, wall crash = 1.5s stun. Phase 3 (33% HP): adds waiter summons (up to 3, chase AI, drop tomato ammo) + triple-spread dough throws. Stunned boss takes 2x damage. Procedural boss sprite (32x32, chef hat, red jacket, animated legs). Boss HP bar at screen top with phase indicator. Phase transition text overlay. Charge has motion blur trail, windup has pulsing red glow. Defeat sequence: 2s fade with circling stars → enzo_boss_defeated flag → restoreSauceRoomDoor() opens wall → recipe #4 spawns at (25,8) in sauce room → victory dialogue. Zone transitions blocked during fight. Player death during boss: lives system works normally, all-lives-lost respawns at pizzeria entrance with boss reset. All weapon types hit boss (melee, ranged, trap, area). Critical fix: closeDialogue() reordered to reset state before onComplete callback (prevents chained dialogues from being killed). Cache-busting ?v=12. |
| 11 | 2026-03-23 | 7-6 | Cooking mini-game: 4-step timed sequence triggered 800ms after picking up recipe #4 in sauce room. Step 1 (Stir): alternate ←→ presses to fill progress ring (12 presses in 6s). Step 2 (Season): oscillating needle on meter, press Space in green zone. Step 3 (Taste): rising indicator, press Space in sweet spot window. Step 4 (Heat): hold ↓ to raise thermometer, press Space to lock in target zone (5s). Each step scores perfect/great/ok/miss. Final grade S/A/B/C. Dark kitchen background with animated pot (bubbling sauce, steam). Step progress dots. Result screen with per-step breakdown + Giulia dialogue about quality. cooking_minigame_done flag prevents re-trigger. game.mode='cooking' in engine.js. Cache-busting ?v=13. |
| 12 | 2026-03-23 | 7-7 | Mama's Sewing Shop zone (24x18): 4 new tile types (FABRIC pink rolls, SEWMACH green sewing machine, MANNEQUIN dress form, CARPET rose walkable floor) with procedural sprites. Two-room layout: main sewing room (left, cols 0-12) with sewing machines, 4 mannequins, central rug, shelves + back fabric storage (right, cols 14-22) with fabric rolls, counters, printer. Passage at col 13 rows 9-10. 3 NPCs: Mama Rosa (warm quest NPC, 3-state dialogue — intro/returning/post-recipe-5, flour-dusted portrait), Signora Threads (eccentric seamstress, cat-eye glasses, measuring tape portrait), Little Tomás (eager young assistant, big eyes, freckles portrait) — all with blip profiles, idle behaviors, walk paths. Dot-matrix printer object at (17,6) — placeholder for Stage 7-8. Sewing shop music (Bb major, 75 BPM — sine music-box melody + triangle pad + gentle bass via musicReverb). Ambient: low brown noise hum. Papa hints (3 entries). Pizzeria→Sewing Shop transition via sauce room east wall (col 27 rows 8-9, restored by restoreSewingShopDoor). Bidirectional. Fix: restoreSauceRoomDoor/restoreSewingShopDoor now write to both ZONES.pizzeria.map AND game.currentMap for immediate in-zone updates. Power-up: Milk. Cache-busting ?v=15. |
| 12 | 2026-03-23 | 7-8 | Dot-matrix printer puzzle: paper-threading micro-maze overlay (24x16 grid, 3 sections with checkpoints). Arrow key navigation, wall hits reset to section start with shake feedback. Maze rendered as dark rollers (walls) and paper-colored paths. Paper cursor (white/red dot with glow), ink trail on visited cells, green start markers, gold pulsing end markers. Printer body frame with details. Intro dialogue → puzzle → success screen → endPrinterPuzzle() spawns recipe #5 at (19,7) in sewing shop back room + Giulia dialogue. printer_puzzle_solved flag. Printer object at (17,6) updated: intro dialogue with onComplete triggers startPrinterPuzzle(), post-solve shows "work is done" message. Escape to exit. Cache-busting ?v=16. |
| 13 | 2026-03-23 | 7-9 | Wedding Planner boss + finale: Bridget boss fight (14 HP, 3-phase) in sewing shop main room. Phase 1: clipboard projectiles aimed at player. Phase 2 (60% HP): stress cloud AoE hazards (purple zones, linger 4s, damage on interval). Phase 3 (30% HP): dash attack with wall-crash stun (2x damage when stunned). Procedural boss sprite (purple blazer, auburn bun, clipboard, heels, animated legs). Portrait with stressed eyes + forehead vein. Boss HP bar with phase indicator. All 4 weapon types hit boss (melee/ranged/trap/area via checkWeddingBossHit). Death during fight: resetWeddingBoss() + respawn at sewing shop entrance. Zone transitions blocked during fight. Wedding planner trigger object at (6,3) in sewing shop — post-defeat dialogue cycles. Defeat → checkAllRecipesAndStartFinale() checks all 5 recipe flags → startFinale(). Finale sequence: game.mode='finale', 6-slide wedding montage (fade transitions, decorative frames), scrolling credits (star-field bg, cast list, tech credits, jokes), end screen → press Space → endFinale() returns to La Cucina. NPC blip profile for wedding_planner. Cache-busting ?v=17. |
| 14 | 2026-03-23 | 8-1 | Pepe's obstacle dash interlude: 3-lane endless runner mini-game. Up/Down to switch lanes, dodge barrels/crates/rocks/puddles. 30s duration, 3 lives (hearts HUD), score counter, timer bar. Obstacles spawn with increasing speed + frequency; double-spawns after 10s (30% chance). Procedural Pepe chihuahua sprite (tan body, big ears, wagging tail, animated running legs). Parallax background (sky gradient, scrolling ground stripes, floating bushes). Grading: S (>=90% survival, Brodo Boost), A (>=70%, Sugar Rush), B (>=40%, Tomato), C (no reward). Random trigger ~40% chance on zone transitions via PEPE_CONFIG.TRIGGER_CHANCE. Cooldown flag prevents back-to-back triggers. Return zone stored in game.pepeReturnZone. Escape to skip (grade C). game.mode='pepe_dash'. Cache-busting ?v=18. |
| 15 | 2026-03-23 | 8-2 | Tomato juggling interlude: 4-lane reflex catching game. Left/Right to move basket between lanes, catch falling tomatoes. 35s duration, 5 max misses, combo tracking. Golden tomatoes (12% chance after 8s) for bonus. Double-spawns after 15s (25% chance). Procedural wicker basket with rim detail. Tomato sprites with stems, highlights, rotation. Dark kitchen background with lane columns. Splat effects on missed tomatoes. Grading: S (>=90% catch + 8 combo, Brodo Boost), A (>=75%, Sugar Rush), B (>=50%, Tomato), C (no reward). Guaranteed trigger when leaving Market with recipe_1_found. juggling_completed flag prevents re-trigger. game.mode='juggling'. Cache-busting ?v=19. |
| 16 | 2026-03-23 | 8-3 | Three remaining interludes: (1) Coco's Air Guitar (Canal, optional): arrow combo rhythm game, 7 chord patterns (2-4 key sequences), 30s duration, timed completion scoring, stage/spotlight background with Coco silhouette + guitar, game.mode='air_guitar'. (2) Signora Betta's Accordion (Market, optional): Simon Says memory game, 8 rounds of growing arrow sequences, 3 mistakes max, 4 colored directional buttons with flash feedback, game.mode='accordion'. (3) Mama's Sewing Rhythm (Sewing Shop, optional): precision beat-matching at 120 BPM, 25s duration, visual needle + fabric with stitch counter, pulsing beat ring indicator, game.mode='sewing_rhythm'. All three: interactable objects in zones, intro dialogue → mini-game → S/A/B/C grading with powerup/item rewards, Escape to skip, completion flags prevent re-trigger. Cache-busting ?v=20. |
| 17 | 2026-03-24 | 8-4 | Six remaining millennial puzzles: (1) Red Rotary Phone #1 (Market 3,24): dial 392-4477 with animated dial rotation, opens storeroom shortcut. (2) Pager/Beeper (Market 28,24): type 07734 → upside-down "hELLO" on green LCD, rewards shortcut key. (3) VHS Tape (Library 20,5): hold Space to rewind, release to lower tension, random danger zones increase tension rate, tape snaps at 100% (rewinds back), reveals Mama's cooking video. (4) CD-ROM (Library 17,13): 12-sector disc, arrow keys rotate selector, Space scrubs sector clean, rewards CD-ROM Disc weapon (ranged 2dmg stun, 1 use). (5) Piazza Payphone (Piazza 2,4): watch Morse code dots/dashes pattern, decode and dial number (392), R to replay. (6) Tamagotchi (Gym 23,13): memorize 8-food sequence during intro, feed with keys 1-5, 15s timer, 3 mistakes max, rewards Dirty Sock weapon. All overlay-style puzzles with solved flags, intro dialogues, post-solve dialogue on revisit. CD-ROM Disc added to ITEMS + WEAPONS. Cache-busting ?v=21. |

| 18 | 2026-03-24 | 8-5 | Stage deferred — Pepe companion (chihuahua, gap squeeze, dog throws) implemented then disabled per user request. May return behind sister/player selection screen. Pepe Dash interlude (Stage 8-1) untouched. |
| 18 | 2026-03-24 | 9-1 | Save/load system: saveGame()/loadSavedGame() in save.js — serializes zone, position, inventory, quest flags, weapon state, HP/lives, playtime to localStorage. Auto-save on every zone transition with "Saved" indicator. Title screen on page load: starfield background, animated title, Continue (with save info) / New Game options. Pause menu (Esc): Resume / Save Game / Quit to Title with save confirmation. formatPlaytime() helper. Cache-busting ?v=24. |
| 19 | 2026-03-25 | 9-2 | Settings screen: accessible from title screen + pause menu. Music/SFX volume sliders (left/right arrows, 10% steps, visual bars). API key text input (masked display, Enter to confirm). All settings persist in localStorage (sauce_sisters_settings). loadSettings() on boot restores saved volumes. Cache-busting ?v=25. |
| 19 | 2026-03-25 | 9-3 | Sound tuning pass: boss fight tempo increase — startBossTempo()/endBossTempo() in audio.js (25% BPM ramp via Tone.Transport.bpm.rampTo). Hooked into Enzo boss (startEnzoBoss onComplete, defeat, resetEnzoBoss) and Wedding Planner boss (startWeddingBoss onComplete, defeat, resetWeddingBoss). All 8 zones already had unique music + ambient from A-1. Volume balancing verified consistent (-8 to -22 dB range). Cache-busting ?v=26. |
| 20 | 2026-03-25 | 9-4 | Score/coin system + balancing: COIN_REWARDS constants + addScore() + getInterludeCoins() in save.js. game.score + game.scorePopups in engine.js. Coins from: enemy kills (10), boss waiters (5), broom defeat (15), Enzo/Wedding boss defeat (50 each), recipe fragments (20), all 6 interludes (S=40/A=25/B=15/C=5). Score HUD (gold coin icon + counter, top-right) + floating "+N" world popups in ui.js. Coin amounts shown on all interlude result screens. Score persists in save/load, resets on New Game. Weapon ammo balancing: added Tomato Crate pickup in Piazza (10,18) and Flour Bag pickup in Gym (9,18) — both reuse existing sprites, hidden when item in inventory. Health/damage values reviewed and confirmed balanced (Enzo 18HP, Wedding 14HP, player 3HP+3 lives). Pepe obstacle dash disabled (random trigger commented out). Cache-busting ?v=27. |
| 20 | 2026-03-25 | 9-5 | Full playtest + bug fix pass: comprehensive code audit of all game systems. Zone transitions: all 16 bidirectional pairs verified (spawn coords, map bounds, gating flags). Recipe fragments: all 5 collection paths verified (Market heart puzzle, Library Nokia/Brodo dual-path, Gym Papa's form, Pizzeria Enzo defeat, Sewing Shop printer). Boss fights: trigger, death/respawn, defeat sequence, transition blocking — all clean. Interludes: all 6 have completion flags, return zones, Escape skip, game.mode reset. Millennial puzzles: all 10 have solved flags, proper overlay cleanup, no softlocks. Finale: all-recipes check, wedding montage, credits scroll, return to overworld — verified. Bug fix: recipe #2 dual-path cleanup (auto-mark duplicate recipe world items as collected in pickupItem). Cache-busting ?v=28. |

---

*End of CLAUDE.md. Keep this file updated. It is the single source of truth for the project.*
