// ============================================================
// js/engine.js — Canvas loop, input, camera, collision, core game loop
// ============================================================

// ============================================================
// CONFIG — All game constants. No magic numbers anywhere else.
// ============================================================
const CONFIG = {
    // Display (set dynamically on boot and resize)
    CANVAS_W: 768,
    CANVAS_H: 576,
    TILE_SIZE: 32,
    FPS_DISPLAY: true,
    SHOW_HITBOXES: false, // set to true via console for debug hitbox rendering

    // Timing
    TARGET_FPS: 60,
    MAX_DT: 0.05, // cap delta-time to prevent spiral of death

    // Player
    PLAYER_SPEED: 150, // pixels per second

    // Camera
    CAMERA_LERP: 0.1, // smoothing factor (0 = no follow, 1 = instant snap)

    // NPC
    NPC_INTERACT_RADIUS: 48, // pixels — how close player must be to interact

    // Brodo (dog companion)
    BRODO_COLOR: '#c4956a',
    BRODO_FOLLOW_DIST: 40,   // pixels — distance Brodo tries to keep from player
    BRODO_SPEED: 160,         // pixels per second — slightly faster than player to catch up
    BRODO_LERP: 0.08,         // smoothing for following
    BRODO_SNIFF_RADIUS: 96,   // pixels — how far the sniff reveals hidden items
    BRODO_SNIFF_COOLDOWN: 2,  // seconds between sniffs
    BRODO_SNIFF_DURATION: 0.6,// seconds for sniff animation
    BRODO_IDLE_MIN_TIME: 5,   // seconds of following before idle is possible
    BRODO_IDLE_MAX_TIME: 10,  // upper random bound for idle trigger
    BRODO_IDLE_ANIM_INTERVAL: 3, // seconds between idle animation changes
    BRODO_RETURN_LERP: 0.12,  // faster lerp when returning to player
    BRODO_RETURN_SNAP_DIST: 20,// pixels — snap to following when this close
    BRODO_IDLE_MAX_DIST: 300, // pixels — auto-return if player gets too far
    BRODO_BARK_BUBBLE_DURATION: 1.5, // seconds for speech bubble display
    SPARKLE_DURATION: 4,      // seconds sparkle persists after sniff
    DIALOGUE_CHARS_PER_SEC: 30, // text reveal speed
    DIALOGUE_BOX_HEIGHT: 120,
    DIALOGUE_BOX_MARGIN: 16,

    // Pushables
    CRATE_COLOR: '#b5651d',
    CRATE_BORDER: '#8b4513',
    PUSH_SLIDE_LERP: 0.2, // smoothing factor for crate slide (lower = heavier feel)

    // Inventory
    INV_MAX_SLOTS: 10,
    INV_SLOT_SIZE: 36,
    INV_SLOT_GAP: 4,
    INV_MARGIN_TOP: 8,
    INV_BG: 'rgba(0, 0, 0, 0.6)',
    INV_BORDER: '#ffd54f',
    INV_EMPTY: 'rgba(255, 255, 255, 0.1)',

    // Items
    ITEM_PICKUP_RADIUS: 24, // pixels — how close player must be to auto-pickup
    ITEM_FLASH_DURATION: 1.5, // seconds for recipe-found flash effect

    // Colors
    BG_COLOR: '#2d6a4f',
    PLAYER_COLOR: '#e94560',
    NPC_COLOR: '#4fc3f7',
    DIALOGUE_BG: 'rgba(0, 0, 0, 0.85)',
    DIALOGUE_TEXT: '#ffffff',
    DIALOGUE_NAME: '#ffd54f',

    // Heart puzzle (Market zone) — 6 target positions forming a heart shape
    HEART_TARGETS: [
        { col: 3, row: 9 },  { col: 5, row: 9 },   // top bumps
        { col: 3, row: 10 }, { col: 4, row: 10 }, { col: 5, row: 10 }, // middle row
        { col: 4, row: 11 },                         // bottom point
    ],
    // Piazza build puzzle: arrange benches + planters to form a path to the east exit (Zone 6)
    PIAZZA_TARGETS: [
        { col: 25, row: 10 },  // path tile 1 (top)
        { col: 25, row: 11 },  // path tile 2
        { col: 25, row: 12 },  // path tile 3
        { col: 25, row: 13 },  // path tile 4 (bottom)
    ],
};

// ============================================================
// Canvas setup
// ============================================================
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

/** Resizes canvas to fill the browser window. Updates CONFIG values. */
function resizeCanvas() {
    CONFIG.CANVAS_W = window.innerWidth;
    CONFIG.CANVAS_H = window.innerHeight;
    canvas.width = CONFIG.CANVAS_W;
    canvas.height = CONFIG.CANVAS_H;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// ============================================================
// FPS tracking
// ============================================================
const fpsTracker = {
    frames: 0,
    lastTime: 0,
    fps: 0,
};

/** Updates FPS counter every second. Called each frame with current timestamp. */
function updateFPS(timestamp) {
    fpsTracker.frames++;
    if (timestamp - fpsTracker.lastTime >= 1000) {
        fpsTracker.fps = fpsTracker.frames;
        fpsTracker.frames = 0;
        fpsTracker.lastTime = timestamp;
    }
}

// ============================================================
// Input system
// ============================================================
const input = {
    held: {},        // true while key is physically down
    justPressed: {}, // true for exactly one frame after keydown
    justReleased: {},// true for exactly one frame after keyup
    _downQueue: [],  // keys pressed since last update
    _upQueue: [],    // keys released since last update
};

/** Processes queued key events. Called once per frame before update(). */
function inputUpdate() {
    // Clear previous frame's one-shot states
    for (const key in input.justPressed) input.justPressed[key] = false;
    for (const key in input.justReleased) input.justReleased[key] = false;

    // Process queued presses
    for (let i = 0; i < input._downQueue.length; i++) {
        const key = input._downQueue[i];
        input.justPressed[key] = true;
        input.held[key] = true;
    }
    input._downQueue.length = 0;

    // Process queued releases
    for (let i = 0; i < input._upQueue.length; i++) {
        const key = input._upQueue[i];
        input.justReleased[key] = true;
        input.held[key] = false;
    }
    input._upQueue.length = 0;
}

/** Returns true if the key is currently held down. */
function isHeld(key) {
    return !!input.held[key];
}

/** Returns true only on the first frame the key was pressed. */
function isJustPressed(key) {
    return !!input.justPressed[key];
}

/** Returns true only on the first frame the key was released. */
function isJustReleased(key) {
    return !!input.justReleased[key];
}

// Keyboard event listeners — queue events, don't process inline
window.addEventListener('keydown', function(e) {
    if (e.repeat) return; // ignore held-key repeats
    input._downQueue.push(e.code);
    e.preventDefault();
});

window.addEventListener('keyup', function(e) {
    input._upQueue.push(e.code);
    e.preventDefault();
});

// ============================================================
// Key bindings — all gameplay input goes through actions, never raw keys
// ============================================================
const DEFAULT_BINDINGS = {
    move_up:    ['KeyW', 'ArrowUp'],
    move_down:  ['KeyS', 'ArrowDown'],
    move_left:  ['KeyA', 'ArrowLeft'],
    move_right: ['KeyD', 'ArrowRight'],
    interact:   ['KeyZ', 'Space'],
    pull:       ['ShiftLeft', 'ShiftRight'],
    sniff:      ['KeyB'],
    papa_call:  ['KeyP'],
    pause:      ['Escape'],
};

const BINDING_LABELS = {
    move_up: 'Move Up',
    move_down: 'Move Down',
    move_left: 'Move Left',
    move_right: 'Move Right',
    interact: 'Interact / Attack',
    pull: 'Pull Object',
    sniff: 'Brodo Sniff',
    papa_call: 'Call Papa',
    pause: 'Pause',
};

const BINDINGS_STORAGE_KEY = 'sauce_sisters_bindings';

/** Deep-copies the default bindings object. Returns a fresh copy. */
function cloneBindings(src) {
    const copy = {};
    for (const action in src) {
        copy[action] = src[action].slice();
    }
    return copy;
}

// Active bindings — loaded from localStorage or defaults
let bindings = cloneBindings(DEFAULT_BINDINGS);

/** Saves current bindings to localStorage. */
function saveBindings() {
    localStorage.setItem(BINDINGS_STORAGE_KEY, JSON.stringify(bindings));
}

/** Loads bindings from localStorage. Falls back to defaults if missing or corrupt. */
function loadBindings() {
    try {
        const saved = localStorage.getItem(BINDINGS_STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            // Validate: must have all actions with array values
            for (const action in DEFAULT_BINDINGS) {
                if (!Array.isArray(parsed[action]) || parsed[action].length === 0) {
                    return cloneBindings(DEFAULT_BINDINGS);
                }
            }
            bindings = parsed;
            return;
        }
    } catch (e) {
        // corrupt data — fall through to defaults
    }
    bindings = cloneBindings(DEFAULT_BINDINGS);
}

/** Resets bindings to defaults and saves. */
function resetBindings() {
    bindings = cloneBindings(DEFAULT_BINDINGS);
    saveBindings();
}

/** Returns true if any key bound to this action is currently held. */
function actionHeld(action) {
    const keys = bindings[action];
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) {
        if (isHeld(keys[i])) return true;
    }
    return false;
}

/** Returns true if any key bound to this action was just pressed this frame. */
function actionJustPressed(action) {
    const keys = bindings[action];
    if (!keys) return false;
    for (let i = 0; i < keys.length; i++) {
        if (isJustPressed(keys[i])) return true;
    }
    return false;
}

/** Checks if a key code is already bound to any action. Returns action name or null. */
function findKeyConflict(keyCode, excludeAction) {
    for (const action in bindings) {
        if (action === excludeAction) continue;
        if (bindings[action].indexOf(keyCode) !== -1) return action;
    }
    return null;
}

/** Converts a key code to a readable label (e.g., 'KeyW' → 'W', 'ArrowUp' → 'Up'). */
function keyCodeToLabel(code) {
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Arrow')) return code.slice(5);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code === 'Space') return 'Space';
    if (code === 'Escape') return 'Esc';
    if (code === 'ShiftLeft' || code === 'ShiftRight') return 'Shift';
    if (code === 'ControlLeft' || code === 'ControlRight') return 'Ctrl';
    return code;
}

// Load saved bindings on boot
loadBindings();

// ============================================================
// Camera
// ============================================================

/** Updates camera to follow the player with smooth lerp, clamped to map boundaries. */
function updateCamera(map) {
    const ts = CONFIG.TILE_SIZE;
    const mapW = map[0].length * ts;
    const mapH = map.length * ts;

    // Target: center player on screen
    const targetX = player.x + player.w / 2 - CONFIG.CANVAS_W / 2;
    const targetY = player.y + player.h / 2 - CONFIG.CANVAS_H / 2;

    // Smooth lerp toward target
    game.cameraX += (targetX - game.cameraX) * CONFIG.CAMERA_LERP;
    game.cameraY += (targetY - game.cameraY) * CONFIG.CAMERA_LERP;

    // Clamp to map boundaries (no void visible)
    // If map is smaller than screen, center the map instead
    if (mapW <= CONFIG.CANVAS_W) {
        game.cameraX = (mapW - CONFIG.CANVAS_W) / 2;
    } else {
        game.cameraX = Math.max(0, Math.min(game.cameraX, mapW - CONFIG.CANVAS_W));
    }

    if (mapH <= CONFIG.CANVAS_H) {
        game.cameraY = (mapH - CONFIG.CANVAS_H) / 2;
    } else {
        game.cameraY = Math.max(0, Math.min(game.cameraY, mapH - CONFIG.CANVAS_H));
    }
}

// ============================================================
// Collision
// ============================================================

/** Checks if a rectangle (px, py, pw, ph) overlaps any solid tile. Returns true if blocked. */
function collidesWithMap(map, px, py, pw, ph) {
    const ts = CONFIG.TILE_SIZE;
    // Check all tiles the rectangle overlaps
    const left   = Math.floor(px / ts);
    const right  = Math.floor((px + pw - 1) / ts);
    const top    = Math.floor(py / ts);
    const bottom = Math.floor((py + ph - 1) / ts);

    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            if (getTile(map, col, row).solid) return true;
        }
    }
    return false;
}

// ============================================================
// Game state
// ============================================================
const game = {
    lastTimestamp: 0,
    running: true,
    cameraX: 0,
    cameraY: 0,
    currentZone: null,
    currentMap: null,
    transitionCooldown: 0,
    itemFlash: 0,        // seconds remaining for item pickup flash
    itemFlashName: '',   // name of item for flash display
    time: 0,             // total elapsed time in seconds (for animations)
    mode: 'overworld',   // 'overworld', 'bmx', 'drum', 'cooking', 'finale', 'pepe_dash', 'juggling' — controls update/render routing
    showScrollOverlay: false,  // true when scroll pattern overlay is visible
    scrollOverlayTimer: 0,     // auto-dismiss countdown (first show only)
    score: 0,                  // coins earned from enemies, interludes, pickups
    scorePopups: [],           // floating "+N" text popups [{x,y,amount,timer}]
};

// ============================================================
// Core loop functions
// ============================================================

/** Updates all game logic. dt = delta time in seconds. No drawing here. */
function update(dt) {
    inputUpdate();

    // Title screen intercepts everything
    if (titleScreen.active) {
        updateTitleScreen(dt);
        return;
    }

    game.time += dt;

    // Save indicator countdown
    if (saveIndicator.timer > 0) saveIndicator.timer -= dt;

    // Pause menu intercepts when open
    if (pauseMenu.open) {
        updatePauseMenu(dt);
        return;
    }

    // Escape opens pause menu (overworld only, not during overlays/dialogues)
    if ((actionJustPressed('pause') || isJustPressed('Escape')) && game.mode === 'overworld'
        && !dialogue.active && !remapUI.open && !nokia.active && !cartridge.active
        && !printer.active && !rotary1.active && !pager.active && !vhs.active
        && !cdrom.active && !morse.active && !tama.active && !game.showScrollOverlay) {
        openPauseMenu();
        return;
    }

    // Audio system always updates (initialization, music fade, debug keys)
    updateAudio(dt);

    // Mini-game modes — delegate to their own update and skip overworld
    if (game.mode === 'bmx') {
        updateBMX(dt);
        return;
    }
    if (game.mode === 'drum') {
        updateDrumSolo(dt);
        return;
    }
    if (game.mode === 'cooking') {
        updateCooking(dt);
        return;
    }
    if (game.mode === 'finale') {
        updateFinale(dt);
        return;
    }
    if (game.mode === 'pepe_dash') {
        updatePepeDash(dt);
        return;
    }
    if (game.mode === 'juggling') {
        updateJuggling(dt);
        return;
    }
    if (game.mode === 'air_guitar') {
        updateAirGuitar(dt);
        return;
    }
    if (game.mode === 'accordion') {
        updateAccordion(dt);
        return;
    }
    if (game.mode === 'sewing_rhythm') {
        updateSewingRhythm(dt);
        return;
    }

    // Nokia T9 puzzle intercepts all input when active
    if (nokia.active) {
        updateNokia(dt);
        return;
    }

    // Cartridge puzzle intercepts all input when active
    if (cartridge.active) {
        updateCartridge(dt);
        return;
    }

    // Printer puzzle intercepts all input when active
    if (printer.active) {
        updatePrinter(dt);
        return;
    }

    // Rotary phone #1 puzzle
    if (rotary1.active) {
        updateRotary1(dt);
        return;
    }

    // Pager puzzle
    if (pager.active) {
        updatePager(dt);
        return;
    }

    // VHS rewind puzzle
    if (vhs.active) {
        updateVHS(dt);
        return;
    }

    // CD-ROM cleaning puzzle
    if (cdrom.active) {
        updateCDROM(dt);
        return;
    }

    // Morse code puzzle
    if (morse.active) {
        updateMorse(dt);
        return;
    }

    // Tamagotchi puzzle
    if (tama.active) {
        updateTamagotchi(dt);
        return;
    }

    // Remap overlay intercepts all input when open
    if (remapUI.open) {
        updateRemapUI();
        return;
    }

    // Tab toggles remap overlay (using raw key, not action binding)
    if (isJustPressed('Tab')) {
        openRemapUI();
        return;
    }

    // Dialogue intercepts input when active
    if (dialogue.active) {
        updateDialogue(dt);
        if (actionJustPressed('interact')) {
            advanceDialogue();
        }
        // Camera still follows (no movement, but smooth settle)
        updateCamera(game.currentMap);
        return;
    }

    // Scroll overlay intercepts input when visible
    if (game.showScrollOverlay) {
        updateScrollOverlay(dt);
        updateCamera(game.currentMap);
        return;
    }

    // Open scroll overlay with I key (when in Market with scroll)
    if (isJustPressed('KeyI') && getFlag('has_market_scroll') && !getFlag('recipe_1_found')
        && game.currentZone && game.currentZone.id === 'market') {
        game.showScrollOverlay = true;
        game.scrollOverlayTimer = 0; // manual open — no auto-dismiss
    }

    // Papa Marco call (P key)
    if (actionJustPressed('papa_call')) {
        callPapa();
        return;
    }

    // Papa auto-intro delay
    updatePapaAutoCall(dt);

    // Check for NPC or object interaction, or weapon attack
    if (actionJustPressed('interact')) {
        const npc = findNearbyNPC();
        if (npc) {
            startDialogue(npc);
            return;
        }
        // Check for interactable objects (BMX bike, etc.)
        const obj = findNearbyObject();
        if (obj && obj.onInteract) {
            obj.onInteract();
            return;
        }
        // Check for bridge plank placement (Canal zone)
        const gap = getFacingBridgeGap();
        if (gap && getFirstPlank()) {
            placeBridgePlank(gap.col, gap.row);
            return;
        }
        // No interaction target — try weapon attack
        tryAttack();
    }

    // Player death check
    updatePlayerTimers(dt);
    if (updatePlayerDeath(dt)) {
        updateCamera(game.currentMap);
        return; // skip all gameplay while dead
    }

    // Player movement + collision
    updatePlayer(dt, game.currentMap);

    // Brodo follows player + sniff mechanic
    updateBrodo(dt);
    updateHiddenItems(dt);

    // NPC idle animations
    updateNPCs(dt);

    // Library broom mini-boss
    updateLibraryBroom(dt);

    // Enzo boss fight
    updateEnzoBoss(dt);

    // Wedding Planner boss fight
    updateWeddingBoss(dt);

    // Generic enemies
    updateEnemies(dt);

    // Smooth slide animation for pushables
    updatePushables();

    // World items: bobbing animation + auto-pickup check
    updateWorldItems(dt);
    checkItemPickup();

    // Power-up buff system
    updatePowerups(dt);

    // Weapon system update (cooldown, attack timer, equip cycling)
    updateWeapons(dt);

    // Item flash timer
    if (game.itemFlash > 0) game.itemFlash -= dt;

    // Score popups
    for (var si = game.scorePopups.length - 1; si >= 0; si--) {
        game.scorePopups[si].timer -= dt;
        game.scorePopups[si].y -= 30 * dt; // float upward
        if (game.scorePopups[si].timer <= 0) game.scorePopups.splice(si, 1);
    }

    // Check zone transitions
    checkTransitions();

    // Camera follows player
    updateCamera(game.currentMap);
}

/** Renders all visuals to the canvas. No logic here. */
function render(ctx) {
    // Title screen (drawn over everything)
    if (titleScreen.active) {
        renderTitleScreen(ctx);
        return;
    }

    // Mini-game modes — delegate to their own render
    if (game.mode === 'bmx') {
        renderBMX(ctx);
        return;
    }
    if (game.mode === 'drum') {
        renderDrumSolo(ctx);
        return;
    }
    if (game.mode === 'cooking') {
        renderCooking(ctx);
        return;
    }
    if (game.mode === 'finale') {
        renderFinale(ctx);
        return;
    }
    if (game.mode === 'pepe_dash') {
        renderPepeDash(ctx);
        return;
    }
    if (game.mode === 'juggling') {
        renderJuggling(ctx);
        return;
    }
    if (game.mode === 'air_guitar') {
        renderAirGuitar(ctx);
        return;
    }
    if (game.mode === 'accordion') {
        renderAccordion(ctx);
        return;
    }
    if (game.mode === 'sewing_rhythm') {
        renderSewingRhythm(ctx);
        return;
    }

    // Clear canvas
    ctx.fillStyle = CONFIG.BG_COLOR;
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    // Render tilemap
    renderTiles(ctx, game.currentMap, game.cameraX, game.cameraY);

    // Placed bridge planks overlay (before bridge is fully complete)
    renderPlacedBridgePlanks(ctx, game.cameraX, game.cameraY);

    // Bridge gap markers (pulsing golden outlines when player has planks)
    renderBridgeGapMarkers(ctx, game.cameraX, game.cameraY);

    // Heart puzzle target markers (below items and crates so they look like ground markings)
    renderTargetMarkers(ctx, game.cameraX, game.cameraY);

    // Piazza build puzzle target markers
    renderPiazzaTargetMarkers(ctx, game.cameraX, game.cameraY);

    // Render world items (below pushables so crate slides over reveal spot)
    renderWorldItems(ctx, game.cameraX, game.cameraY);

    // Render pushables
    renderPushables(ctx, game.cameraX, game.cameraY);

    // Render NPCs
    renderNPCs(ctx, game.cameraX, game.cameraY);

    // Render interactable objects (BMX bike, etc.)
    renderObjects(ctx, game.cameraX, game.cameraY);

    // Render library cat mini-boss
    renderLibraryBroom(ctx, game.cameraX, game.cameraY);

    // Render generic enemies
    renderEnemies(ctx, game.cameraX, game.cameraY);

    // Render Enzo boss
    renderEnzoBoss(ctx, game.cameraX, game.cameraY);
    renderBossProjectiles(ctx, game.cameraX, game.cameraY);

    // Render Wedding Planner boss
    renderWeddingBoss(ctx, game.cameraX, game.cameraY);
    renderWPProjectiles(ctx, game.cameraX, game.cameraY);
    renderStressClouds(ctx, game.cameraX, game.cameraY);

    // Render Brodo (dog companion)
    renderBrodo(ctx, game.cameraX, game.cameraY);

    // Render hidden item sparkles
    renderHiddenItemSparkles(ctx, game.cameraX, game.cameraY);

    // Render world power-ups (below player, on ground)
    renderPowerups(ctx, game.cameraX, game.cameraY);

    // Render traps (below player, on ground)
    renderTraps(ctx, game.cameraX, game.cameraY);

    // Render player glow (buff active)
    renderPlayerGlow(ctx, game.cameraX, game.cameraY);

    // Render player
    renderPlayer(ctx, game.cameraX, game.cameraY);

    // Post-processing: ambient glow/bloom pass on world
    renderWorldGlow(ctx, game.cameraX, game.cameraY);

    // Render projectiles (on top of player)
    renderProjectiles(ctx, game.cameraX, game.cameraY);

    // Render area effects (on top of everything in world)
    renderAreaEffects(ctx, game.cameraX, game.cameraY);

    // Render weapon attack swing (on top of player)
    renderWeaponAttack(ctx, game.cameraX, game.cameraY);
    renderWeaponDebug(ctx, game.cameraX, game.cameraY);

    // Bridge plank placement prompt
    renderBridgePrompt(ctx, game.cameraX, game.cameraY);

    // Pull prompt when facing a crate
    renderPullPrompt(ctx, game.cameraX, game.cameraY);

    // Dialogue box (on top of game world, below overlays)
    renderDialogue(ctx);

    // HUD: inventory bar + weapon slot + buff + health + score
    renderHUD(ctx);
    renderWeaponHUD(ctx);
    renderBuffHUD(ctx);
    renderHealthHUD(ctx);
    renderPapaHintHUD(ctx);
    renderScoreHUD(ctx);

    // Score popups (floating "+N" in world)
    renderScorePopups(ctx, game.cameraX, game.cameraY);

    // Boss HP bar (on top of other HUD)
    renderBossHPBar(ctx);
    renderWeddingBossHPBar(ctx);

    // Damage flash overlay
    renderDamageFlash(ctx);

    // Item pickup flash effect
    renderItemFlash(ctx);

    // Scroll overlay (on top of game, below remap)
    if (game.showScrollOverlay) {
        renderScrollOverlay(ctx);
    }

    // Nokia T9 puzzle overlay
    if (nokia.active) {
        renderNokia(ctx);
    }

    // Cartridge puzzle overlay
    if (cartridge.active) {
        renderCartridge(ctx);
    }

    // Printer puzzle overlay
    if (printer.active) {
        renderPrinter(ctx);
    }

    // Rotary phone #1 overlay
    if (rotary1.active) {
        renderRotary1(ctx);
    }

    // Pager overlay
    if (pager.active) {
        renderPager(ctx);
    }

    // VHS rewind overlay
    if (vhs.active) {
        renderVHS(ctx);
    }

    // CD-ROM cleaning overlay
    if (cdrom.active) {
        renderCDROM(ctx);
    }

    // Morse code overlay
    if (morse.active) {
        renderMorse(ctx);
    }

    // Tamagotchi overlay
    if (tama.active) {
        renderTamagotchi(ctx);
    }

    // Remap overlay (drawn on top of everything)
    if (remapUI.open) {
        renderRemapUI(ctx);
        return; // don't draw debug overlay under remap screen
    }

    // Debug overlay
    if (CONFIG.FPS_DISPLAY) {
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('FPS: ' + fpsTracker.fps, 8, 16);

        // Zone name
        if (game.currentZone) {
            ctx.fillText('Zone: ' + game.currentZone.name, 8, 32);
        }

        // Show currently held keys
        const heldKeys = Object.keys(input.held).filter(function(k) { return input.held[k]; });
        ctx.fillText('Held: ' + (heldKeys.length > 0 ? heldKeys.join(', ') : '(none)'), 8, 48);

        // Show just-pressed keys (flash for one frame)
        const jpKeys = Object.keys(input.justPressed).filter(function(k) { return input.justPressed[k]; });
        if (jpKeys.length > 0) {
            ctx.fillStyle = '#00ff88';
            ctx.fillText('Pressed: ' + jpKeys.join(', '), 8, 64);
        }

        // Audio status
        ctx.fillStyle = isAudioUnlocked() ? '#00ff88' : '#ff4444';
        ctx.fillText('Audio: ' + (isAudioUnlocked() ? 'unlocked (M = test tone)' : 'locked (press any key)'), 8, 80);

        // Controls hint
        ctx.fillStyle = '#555555';
        ctx.fillText('Tab = Controls | M = Test tone | Esc = Pause', 8, CONFIG.CANVAS_H - 8);
    }

    // Save indicator (small "Saved" text in corner)
    renderSaveIndicator(ctx);

    // Pause menu (on top of everything except title)
    renderPauseMenu(ctx);
}

/** Main game loop. Called by requestAnimationFrame. */
function gameLoop(timestamp) {
    if (!game.running) return;

    // Calculate delta time in seconds
    const dt = Math.min((timestamp - game.lastTimestamp) / 1000, CONFIG.MAX_DT);
    game.lastTimestamp = timestamp;

    updateFPS(timestamp);
    update(dt);
    render(ctx);

    requestAnimationFrame(gameLoop);
}

/** Starts the game loop with a proper first-frame timestamp. */
function startGame() {
    requestAnimationFrame(function(timestamp) {
        game.lastTimestamp = timestamp;
        fpsTracker.lastTime = timestamp;
        gameLoop(timestamp);
    });
}
