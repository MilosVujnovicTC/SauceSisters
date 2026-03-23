// ============================================================
// js/entities.js — Player, NPCs, enemies, dogs
// ============================================================

// ============================================================
// Player
// ============================================================
const player = {
    x: 0,
    y: 0,
    w: CONFIG.TILE_SIZE - 4,  // slightly smaller than a tile for forgiving collision
    h: CONFIG.TILE_SIZE - 4,
    facing: 'down',           // 'up', 'down', 'left', 'right'
    // Animation
    animTimer: 0,             // walk animation timer
    animFrame: 0,             // current walk frame (0-3)
    moving: false,            // true when player is moving this frame
    // Health + lives
    hp: 3,
    maxHp: 3,
    lives: 3,                 // on-the-spot resurrections remaining
    invulnTimer: 0,           // seconds of invulnerability after hit
    dead: false,
    deathTimer: 0,            // countdown during death animation
    damageFlash: 0,           // red flash timer on hit
};

/** Updates player position based on input and collision. */
function updatePlayer(dt, map) {
    const speed = CONFIG.PLAYER_SPEED * getBuffSpeedMult() * dt;
    let dx = 0;
    let dy = 0;

    // Check pull BEFORE updating facing — pull locks facing toward the crate
    var pulling = actionHeld('pull');
    var pullTarget = pulling ? getFacingPushable() : null;
    var prePullFacing = player.facing;

    if (actionHeld('move_left'))  { dx -= speed; if (!pullTarget) player.facing = 'left'; }
    if (actionHeld('move_right')) { dx += speed; if (!pullTarget) player.facing = 'right'; }
    if (actionHeld('move_up'))    { dy -= speed; if (!pullTarget) player.facing = 'up'; }
    if (actionHeld('move_down'))  { dy += speed; if (!pullTarget) player.facing = 'down'; }

    // Walk animation
    player.moving = (dx !== 0 || dy !== 0);
    if (player.moving) {
        player.animTimer += dt * 8; // 8 fps walk cycle
        player.animFrame = Math.floor(player.animTimer) % 4;
    } else {
        player.animFrame = 0;
        player.animTimer = 0;
    }

    // Footstep SFX while moving
    if (dx !== 0 || dy !== 0) {
        playFootstep(dt);
    } else {
        resetFootstepTimer();
    }

    // Resolve X and Y independently for smooth wall sliding
    if (dx !== 0) {
        const newX = player.x + dx;
        const clampedX = Math.max(0, Math.min(newX, map[0].length * CONFIG.TILE_SIZE - player.w));
        if (!collidesWithMap(map, clampedX, player.y, player.w, player.h)) {
            // Check pushable collision
            const dirCol = dx > 0 ? 1 : -1;
            if (!checkPushableCollision(clampedX, player.y, player.w, player.h, dirCol, 0)) {
                player.x = clampedX;
                // Pull: if moving away from the crate, drag it along
                if (pullTarget && ((prePullFacing === 'right' && dx < 0) ||
                    (prePullFacing === 'left' && dx > 0))) {
                    tryPull(pullTarget);
                }
            }
        }
    }
    if (dy !== 0) {
        const newY = player.y + dy;
        const clampedY = Math.max(0, Math.min(newY, map.length * CONFIG.TILE_SIZE - player.h));
        if (!collidesWithMap(map, player.x, clampedY, player.w, player.h)) {
            // Check pushable collision
            const dirRow = dy > 0 ? 1 : -1;
            if (!checkPushableCollision(player.x, clampedY, player.w, player.h, 0, dirRow)) {
                player.y = clampedY;
                // Pull: if moving away from the crate, drag it along
                if (pullTarget && ((prePullFacing === 'down' && dy < 0) ||
                    (prePullFacing === 'up' && dy > 0))) {
                    tryPull(pullTarget);
                }
            }
        }
    }
}

/** Renders the player using enhanced pixel art sprites. */
function renderPlayer(ctx, cameraX, cameraY) {
    // Death animation — shrink and fade
    if (player.dead) {
        var deathProgress = 1 - (player.deathTimer / 1.0);
        var scale = Math.max(0.01, 1 - deathProgress);
        var alpha = Math.max(0, 1 - deathProgress);
        ctx.globalAlpha = alpha;
        var sprite = getPlayerSprite(player.facing, 0);
        var dcx = player.x + player.w / 2 - cameraX;
        var dcy = player.y + player.h / 2 - cameraY;
        var sw = sprite.width * scale;
        var sh = sprite.height * scale;
        ctx.drawImage(sprite, dcx - sw / 2, dcy - sh / 2, sw, sh);
        ctx.globalAlpha = 1;
        return;
    }

    // Invulnerability blink
    if (player.invulnTimer > 0 && Math.floor(game.time * 10) % 2 === 0) {
        return; // skip rendering every other frame = blink effect
    }

    var sprite = getPlayerSprite(player.facing, player.animFrame);
    // Sprite is slightly larger than hitbox (outlined sprite has +2 padding)
    // Center sprite on the player hitbox
    var screenX = player.x - cameraX - 2;
    var screenY = player.y - cameraY - 4;
    ctx.drawImage(sprite, screenX, screenY);
}

// ============================================================
// Player damage, death, lives
// ============================================================

/** Deals damage to the player. Checks shield first. */
function damagePlayer(amount) {
    if (player.dead) return;
    if (player.invulnTimer > 0) return;

    // Shield absorb check (inline for reliability)
    if (activeBuff && activeBuff.type === 'deli_meat' && activeBuff.timer > 0) {
        activeBuff.shieldHits--;
        if (activeBuff.shieldHits <= 0) {
            clearBuff();
        }
        player.invulnTimer = 0.5; // brief invuln after shield absorb too
        return;
    }

    player.hp -= amount;
    player.invulnTimer = 1.5;
    player.damageFlash = 0.3;
    playEnemyHit();

    // Knockback away from nearest threat
    // (handled by caller if needed)

    if (player.hp <= 0) {
        player.hp = 0;
        killPlayer();
    }
}

/** Triggers player death sequence. */
function killPlayer() {
    player.dead = true;
    player.deathTimer = 1.0;
}

/** Updates player death timer. Called from engine.js update. */
function updatePlayerDeath(dt) {
    if (!player.dead) return false;
    player.deathTimer -= dt;
    if (player.deathTimer <= 0) {
        if (player.lives > 0) {
            resurrectPlayer();
        } else {
            restartZone();
        }
    }
    return true; // signal that player is dead (skip normal update)
}

/** Resurrects the player on the spot. */
function resurrectPlayer() {
    player.lives--;
    player.hp = player.maxHp;
    player.dead = false;
    player.invulnTimer = 2.0; // extra invuln after resurrect
    player.damageFlash = 0;
}

/** Restarts from the very beginning (all lives spent). */
function restartZone() {
    player.lives = 3;
    player.hp = player.maxHp;
    player.dead = false;
    player.invulnTimer = 2.0;
    player.damageFlash = 0;
    // Back to La Cucina — start from scratch
    loadZone('la_cucina');
}

/** Updates invulnerability and damage flash timers. */
function updatePlayerTimers(dt) {
    if (player.invulnTimer > 0) player.invulnTimer -= dt;
    if (player.damageFlash > 0) player.damageFlash -= dt;
}

// ============================================================
// Brodo — basset hound companion, follows player, sniffs hidden items
// ============================================================

const brodo = {
    x: 0,
    y: 0,
    w: 22,
    h: 18,
    // Position history for delayed following
    trail: [],           // array of {x, y} — player positions sampled over time
    trailTimer: 0,
    trailInterval: 0.05, // sample player position every 50ms
    trailDelay: 12,      // use position from 12 samples ago (~0.6s delay)
    // Sniff state
    sniffCooldown: 0,
    sniffAnim: 0,        // >0 while sniff animation is playing
    // State machine: 'following' | 'idle' | 'returning'
    state: 'following',
    // Idle trigger
    idleTimer: 0,        // counts up while following
    idleThreshold: 20,   // randomized — when timer >= threshold, go idle
    // Idle behavior
    idleElapsed: 0,      // time spent in current idle session
    idleDuration: 10,    // randomized — auto-return after this many seconds
    idleAnimType: 'sit', // current idle animation
    idleAnimTimer: 0,    // cycles animations
    // Speech bubble
    bubbleText: '',
    bubbleTimer: 0,
    // Track player movement for idle trigger
    lastPlayerX: 0,
    lastPlayerY: 0,
    playerMovedTimer: 0, // time since player last moved
};

/** Randomizes the next idle threshold. Call on init and after returning to following. */
function resetBrodoIdleTimer() {
    brodo.idleTimer = 0;
    brodo.idleThreshold = CONFIG.BRODO_IDLE_MIN_TIME +
        Math.random() * (CONFIG.BRODO_IDLE_MAX_TIME - CONFIG.BRODO_IDLE_MIN_TIME);
}

/** Initializes Brodo's position to match the player (call on zone load). */
function initBrodo() {
    brodo.x = player.x;
    brodo.y = player.y + CONFIG.TILE_SIZE;
    brodo.trail = [];
    for (var i = 0; i < brodo.trailDelay + 5; i++) {
        brodo.trail.push({ x: brodo.x, y: brodo.y });
    }
    brodo.state = 'following';
    brodo.bubbleTimer = 0;
    brodo.bubbleText = '';
    brodo.lastPlayerX = player.x;
    brodo.lastPlayerY = player.y;
    brodo.playerMovedTimer = 0;
    resetBrodoIdleTimer();
}

/** Updates Brodo — state machine: following, idle, returning. */
function updateBrodo(dt) {
    // Always tick timers
    if (brodo.bubbleTimer > 0) brodo.bubbleTimer -= dt;
    if (brodo.sniffCooldown > 0) brodo.sniffCooldown -= dt;
    if (brodo.sniffAnim > 0) brodo.sniffAnim -= dt;

    // Track player movement
    var pdx = player.x - brodo.lastPlayerX;
    var pdy = player.y - brodo.lastPlayerY;
    if (pdx * pdx + pdy * pdy > 4) {
        brodo.playerMovedTimer = 0;
        brodo.lastPlayerX = player.x;
        brodo.lastPlayerY = player.y;
    } else {
        brodo.playerMovedTimer += dt;
    }

    // B key: state-dependent
    if (actionJustPressed('sniff')) {
        if (brodo.state === 'idle') {
            brodo.state = 'returning';
            brodo.bubbleText = '!';
            brodo.bubbleTimer = CONFIG.BRODO_BARK_BUBBLE_DURATION;
            playBrodoBark();
            stunLibraryBroom(); // bark can stun cat even when calling back
        } else if (brodo.state === 'following' && brodo.sniffCooldown <= 0) {
            brodo.sniffAnim = CONFIG.BRODO_SNIFF_DURATION;
            brodo.sniffCooldown = CONFIG.BRODO_SNIFF_COOLDOWN;
            revealHiddenItems();
            stunLibraryBroom(); // sniff bark stuns cat too
        }
    }

    // State-specific update
    if (brodo.state === 'following') {
        updateBrodoFollowing(dt);
    } else if (brodo.state === 'idle') {
        updateBrodoIdle(dt);
    } else if (brodo.state === 'returning') {
        updateBrodoReturning(dt);
    }
}

/** Following state: trail-based delayed following + idle trigger. */
function updateBrodoFollowing(dt) {
    // Sample player position into trail
    brodo.trailTimer += dt;
    if (brodo.trailTimer >= brodo.trailInterval) {
        brodo.trailTimer = 0;
        brodo.trail.push({ x: player.x, y: player.y });
        while (brodo.trail.length > brodo.trailDelay + 10) {
            brodo.trail.shift();
        }
    }

    // Follow the delayed position from the trail
    var targetIdx = Math.max(0, brodo.trail.length - 1 - brodo.trailDelay);
    var target = brodo.trail[targetIdx];
    if (target) {
        brodo.x += (target.x - brodo.x) * CONFIG.BRODO_LERP;
        brodo.y += (target.y - brodo.y) * CONFIG.BRODO_LERP;
    }

    // Idle trigger: only count when player has been moving recently
    if (brodo.playerMovedTimer < 2) {
        brodo.idleTimer += dt;
    }
    if (brodo.idleTimer >= brodo.idleThreshold && brodo.sniffAnim <= 0) {
        // Enter idle state
        brodo.state = 'idle';
        brodo.idleElapsed = 0;
        brodo.idleDuration = 8 + Math.random() * 7; // 8-15 seconds
        brodo.idleAnimType = 'sit';
        brodo.idleAnimTimer = 0;
        brodo.bubbleText = '*sits*';
        brodo.bubbleTimer = CONFIG.BRODO_BARK_BUBBLE_DURATION;
    }
}

/** Idle state: stay in place, cycle animations. Only returns when player calls (B key). */
function updateBrodoIdle(dt) {
    brodo.idleElapsed += dt;

    // Cycle idle animations
    brodo.idleAnimTimer += dt;
    if (brodo.idleAnimTimer >= CONFIG.BRODO_IDLE_ANIM_INTERVAL) {
        brodo.idleAnimTimer = 0;
        var anims = ['sit', 'bark', 'ball', 'sniff_ground', 'nap'];
        var filtered = [];
        for (var i = 0; i < anims.length; i++) {
            if (anims[i] !== brodo.idleAnimType) filtered.push(anims[i]);
        }
        brodo.idleAnimType = filtered[Math.floor(Math.random() * filtered.length)];

        // Set bubble text and SFX based on new animation
        if (brodo.idleAnimType === 'bark') {
            brodo.bubbleText = Math.random() > 0.5 ? 'Woof!' : 'Arf!';
            brodo.bubbleTimer = CONFIG.BRODO_BARK_BUBBLE_DURATION;
            playBrodoBark();
        } else if (brodo.idleAnimType === 'ball') {
            brodo.bubbleText = '*plays*';
            brodo.bubbleTimer = CONFIG.BRODO_BARK_BUBBLE_DURATION;
        } else if (brodo.idleAnimType === 'sniff_ground') {
            brodo.bubbleText = '*sniff*';
            brodo.bubbleTimer = CONFIG.BRODO_BARK_BUBBLE_DURATION;
        } else if (brodo.idleAnimType === 'nap') {
            brodo.bubbleText = 'Zzz...';
            brodo.bubbleTimer = CONFIG.BRODO_BARK_BUBBLE_DURATION;
        }
    }
}

/** Returning state: fast lerp directly toward player, snap to following when close. */
function updateBrodoReturning(dt) {
    brodo.x += (player.x - brodo.x) * CONFIG.BRODO_RETURN_LERP;
    brodo.y += (player.y - brodo.y) * CONFIG.BRODO_RETURN_LERP;

    var dx = player.x - brodo.x;
    var dy = player.y - brodo.y;
    if (dx * dx + dy * dy < CONFIG.BRODO_RETURN_SNAP_DIST * CONFIG.BRODO_RETURN_SNAP_DIST) {
        brodo.state = 'following';
        // Refill trail so following resumes smoothly
        brodo.trail = [];
        for (var i = 0; i < brodo.trailDelay + 5; i++) {
            brodo.trail.push({ x: brodo.x, y: brodo.y });
        }
        resetBrodoIdleTimer();
    }
}

/** Renders Brodo the basset hound with state-dependent sprites and effects. */
function renderBrodo(ctx, cameraX, cameraY) {
    var sx = brodo.x - cameraX;
    var sy = brodo.y - cameraY;
    var w = brodo.w;
    var h = brodo.h;
    var t = game.time;
    var isIdle = brodo.state === 'idle';
    var anim = brodo.idleAnimType;

    // Sniff animation — expanding ring (following state only)
    if (brodo.sniffAnim > 0) {
        var progress = 1 - (brodo.sniffAnim / CONFIG.BRODO_SNIFF_DURATION);
        var radius = CONFIG.BRODO_SNIFF_RADIUS * progress;
        var alpha = 0.3 * (1 - progress);
        ctx.strokeStyle = 'rgba(255, 215, 0, ' + alpha + ')';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(sx + w / 2, sy + h / 2, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255, 235, 59, ' + (alpha * 0.3) + ')';
        ctx.beginPath();
        ctx.arc(sx + w / 2, sy + h / 2, radius * 0.6, 0, Math.PI * 2);
        ctx.fill();
    }

    // Returning state: motion lines
    if (brodo.state === 'returning') {
        var mdx = player.x - brodo.x;
        var mdy = player.y - brodo.y;
        var dist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (dist > 5) {
            var nx = -mdx / dist;
            var ny = -mdy / dist;
            ctx.strokeStyle = 'rgba(200, 180, 140, 0.4)';
            ctx.lineWidth = 1;
            for (var ml = 0; ml < 3; ml++) {
                var off = 4 + ml * 5;
                var perpX = ny * (ml - 1) * 3;
                var perpY = -nx * (ml - 1) * 3;
                ctx.beginPath();
                ctx.moveTo(sx + w / 2 + nx * off + perpX, sy + h / 2 + ny * off + perpY);
                ctx.lineTo(sx + w / 2 + nx * (off + 6) + perpX, sy + h / 2 + ny * (off + 6) + perpY);
                ctx.stroke();
            }
        }
    }

    // Draw Brodo sprite based on state
    var spriteKey = 'follow';
    if (isIdle) {
        if (anim === 'sit' || anim === 'sniff_ground') spriteKey = 'sit';
        else if (anim === 'bark') spriteKey = 'bark';
        else if (anim === 'nap') spriteKey = 'nap';
        else if (anim === 'ball') spriteKey = 'follow';
    }
    var sprite = SPRITES.brodo[spriteKey];
    if (sprite) {
        var bodyOffY = 0;
        if (isIdle && (anim === 'sit' || anim === 'nap')) {
            bodyOffY = 2 + Math.sin(t * 1.5) * 0.5;
        }
        // Outlined sprite has +2 padding (1px each side)
        ctx.drawImage(sprite, sx - 3, sy - 2 + bodyOffY);
    }

    // Idle: ball animation
    if (isIdle && anim === 'ball') {
        var ballX = sx + 14 + Math.sin(t * 3) * 8;
        var ballY = sy + h + 2 + Math.abs(Math.sin(t * 5)) * -4;
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(ballX, ballY, 3, 0, Math.PI * 2);
        ctx.fill();
        // White highlight
        ctx.fillStyle = '#ffcdd2';
        ctx.beginPath();
        ctx.arc(ballX - 1, ballY - 1, 1, 0, Math.PI * 2);
        ctx.fill();
    }

    // Idle: sniff_ground dust particles
    if (isIdle && anim === 'sniff_ground') {
        ctx.fillStyle = 'rgba(139, 105, 20, 0.3)';
        for (var dp = 0; dp < 3; dp++) {
            var dsx = sx + w + 2 + Math.sin(t * 4 + dp * 2) * 3;
            var dsy = sy + h - 1 + Math.cos(t * 3 + dp) * 2;
            ctx.fillRect(dsx, dsy, 2, 2);
        }
    }

    // Idle: nap Zzz floating text
    if (isIdle && anim === 'nap') {
        var zAlpha = 0.4 + Math.sin(t * 2) * 0.3;
        ctx.fillStyle = 'rgba(255, 255, 255, ' + zAlpha + ')';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        var zy = sy - 8 - Math.sin(t * 1.5) * 4;
        ctx.fillText('Z', sx + w + 4, zy);
        ctx.font = '8px monospace';
        ctx.fillText('z', sx + w + 10, zy - 6 - Math.sin(t * 1.2) * 3);
    }

    // Speech bubble
    if (brodo.bubbleTimer > 0 && brodo.bubbleText) {
        var bAlpha = Math.min(brodo.bubbleTimer / 0.3, 1);
        var bx = sx + w / 2;
        var by = sy - 18;
        ctx.font = '8px monospace';
        var tw = ctx.measureText(brodo.bubbleText).width + 10;
        ctx.globalAlpha = bAlpha;
        // Bubble background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx - tw / 2, by - 10, tw, 14);
        // Bubble pointer
        ctx.beginPath();
        ctx.moveTo(bx - 3, by + 4);
        ctx.lineTo(bx, by + 8);
        ctx.lineTo(bx + 3, by + 4);
        ctx.fill();
        // Bubble text
        ctx.fillStyle = '#333333';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(brodo.bubbleText, bx, by);
        ctx.globalAlpha = 1;
    }

    // Name label
    var labelY = (brodo.bubbleTimer > 0) ? sy - 30 : sy - 4;
    if (isIdle) {
        ctx.fillStyle = '#ffd54f';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Brodo', sx + w / 2, labelY);
        // [B] Call prompt
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '8px monospace';
        ctx.fillText('[B] Call', sx + w / 2, labelY + 10);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Brodo', sx + w / 2, labelY);
    }
}

// ============================================================
// Hidden items — revealed by Brodo's sniff
// ============================================================

/** Hidden items in the current zone. Array of {id, col, row, itemId, revealed, sparkleTimer}. */
var hiddenItems = [];

/** Registers hidden items for the current zone. Called from loadZone. */
function loadHiddenItems(zoneId) {
    hiddenItems = [];
    var zone = ZONES[zoneId];
    if (!zone || !zone.hiddenItems) return;
    for (var i = 0; i < zone.hiddenItems.length; i++) {
        var h = zone.hiddenItems[i];
        if (hasItem(h.itemId)) continue; // already collected
        hiddenItems.push({
            id: h.id, col: h.col, row: h.row, itemId: h.itemId,
            revealed: false, sparkleTimer: 0,
        });
    }
}

/** Reveals hidden items within Brodo's sniff radius. */
function revealHiddenItems() {
    var bcx = brodo.x + brodo.w / 2;
    var bcy = brodo.y + brodo.h / 2;
    var radius = CONFIG.BRODO_SNIFF_RADIUS * getBuffSniffMult();
    var ts = CONFIG.TILE_SIZE;

    for (var i = 0; i < hiddenItems.length; i++) {
        var item = hiddenItems[i];
        if (item.revealed) continue;
        var icx = item.col * ts + ts / 2;
        var icy = item.row * ts + ts / 2;
        var dx = bcx - icx;
        var dy = bcy - icy;
        if (dx * dx + dy * dy <= radius * radius) {
            item.revealed = true;
            item.sparkleTimer = CONFIG.SPARKLE_DURATION;
            // Spawn as a collectible world item
            spawnWorldItem(item.id, item.col, item.row, item.itemId);
        }
    }
}

/** Updates sparkle timers for revealed hidden items. */
function updateHiddenItems(dt) {
    for (var i = 0; i < hiddenItems.length; i++) {
        if (hiddenItems[i].revealed && hiddenItems[i].sparkleTimer > 0) {
            hiddenItems[i].sparkleTimer -= dt;
        }
    }
}

/** Renders sparkle effects on revealed hidden items. */
function renderHiddenItemSparkles(ctx, cameraX, cameraY) {
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < hiddenItems.length; i++) {
        var item = hiddenItems[i];
        if (!item.revealed || item.sparkleTimer <= 0) continue;
        var cx = item.col * ts + ts / 2 - cameraX;
        var cy = item.row * ts + ts / 2 - cameraY;
        var alpha = Math.min(item.sparkleTimer / 1.0, 1.0); // fade over last second

        // Sparkle ring
        for (var s = 0; s < 6; s++) {
            var angle = game.time * 2 + s * Math.PI / 3;
            var r = 12 + Math.sin(game.time * 3 + s) * 4;
            var sx = cx + Math.cos(angle) * r;
            var sy = cy + Math.sin(angle) * r;
            ctx.fillStyle = 'rgba(255, 255, 200, ' + (alpha * (0.5 + Math.sin(game.time * 5 + s) * 0.3)) + ')';
            ctx.fillRect(sx - 1.5, sy - 1.5, 3, 3);
        }

        // Central glow
        ctx.fillStyle = 'rgba(255, 235, 59, ' + (alpha * 0.2) + ')';
        ctx.beginPath();
        ctx.arc(cx, cy, 10, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================
// NPC rendering + interaction detection
// ============================================================

/** Finds the nearest NPC within interaction radius of the player. Uses pixel position if available. */
function findNearbyNPC() {
    const zone = game.currentZone;
    if (!zone || !zone.npcs) return null;
    const ts = CONFIG.TILE_SIZE;
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    const radius = CONFIG.NPC_INTERACT_RADIUS;

    for (let i = 0; i < zone.npcs.length; i++) {
        const npc = zone.npcs[i];
        // Use pixel position if NPC has been initialized for walking
        const ncx = (npc._x !== undefined ? npc._x : npc.col * ts) + ts / 2;
        const ncy = (npc._y !== undefined ? npc._y : npc.row * ts) + ts / 2;
        const dx = pcx - ncx;
        const dy = pcy - ncy;
        if (dx * dx + dy * dy <= radius * radius) {
            return npc;
        }
    }
    return null;
}

/** Updates NPC idle animations and waypoint walking. */
function updateNPCs(dt) {
    var zone = game.currentZone;
    if (!zone || !zone.npcs) return;
    var ts = CONFIG.TILE_SIZE;

    for (var i = 0; i < zone.npcs.length; i++) {
        var npc = zone.npcs[i];
        if (!npc.idle) continue;

        // Initialize runtime state on first update
        if (npc._x === undefined) {
            npc._x = npc.col * ts;
            npc._y = npc.row * ts;
            npc._idleTimer = 0;
            npc._idleFrame = 0;
            npc._walkIndex = 0;
            npc._walkDir = 1;
            npc._walkPause = 0;
            npc._walking = false;
            npc._facing = 'down';
        }

        // Pause all activity during dialogue with this NPC
        if (dialogue.active && dialogue.npcId === npc.id) {
            npc._walking = false;
            npc._idleFrame = 0;
            // Face toward player
            var pdx = player.x - npc._x;
            var pdy = player.y - npc._y;
            if (Math.abs(pdx) > Math.abs(pdy)) {
                npc._facing = pdx > 0 ? 'right' : 'left';
            } else {
                npc._facing = pdy > 0 ? 'down' : 'up';
            }
            continue;
        }

        // Idle animation timer (always runs)
        npc._idleTimer += dt;
        if (npc._idleTimer >= npc.idle.interval) {
            npc._idleTimer = 0;
            npc._idleFrame = (npc._idleFrame + 1) % 3;
        }

        // Waypoint walking
        if (npc.idle.walkPath && npc.idle.walkPath.length > 1) {
            if (npc._walkPause > 0) {
                // Pausing at waypoint — do idle activity
                npc._walkPause -= dt;
                npc._walking = false;
            } else {
                // Walk toward current waypoint
                var wp = npc.idle.walkPath[npc._walkIndex];
                var targetX = wp.col * ts;
                var targetY = wp.row * ts;
                var dx = targetX - npc._x;
                var dy = targetY - npc._y;
                var dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < 2) {
                    // Arrived at waypoint — pause, then advance
                    npc._x = targetX;
                    npc._y = targetY;
                    npc._walking = false;
                    npc._walkPause = npc.idle.interval;

                    // Advance waypoint (ping-pong)
                    npc._walkIndex += npc._walkDir;
                    if (npc._walkIndex >= npc.idle.walkPath.length) {
                        npc._walkDir = -1;
                        npc._walkIndex = npc.idle.walkPath.length - 2;
                    } else if (npc._walkIndex < 0) {
                        npc._walkDir = 1;
                        npc._walkIndex = 1;
                    }
                } else {
                    // Move toward waypoint with collision checking
                    var speed = (npc.idle.walkSpeed || 30) * dt;
                    var nx = dx / dist;
                    var ny = dy / dist;
                    var newX = npc._x + nx * speed;
                    var newY = npc._y + ny * speed;
                    var npcW = ts - 4;
                    var npcH = ts - 4;
                    // Check X movement
                    if (!collidesWithMap(game.currentMap, newX + 2, npc._y + 2, npcW, npcH)) {
                        npc._x = newX;
                    }
                    // Check Y movement
                    if (!collidesWithMap(game.currentMap, npc._x + 2, newY + 2, npcW, npcH)) {
                        npc._y = newY;
                    }
                    npc._walking = true;

                    // Update facing
                    if (Math.abs(dx) > Math.abs(dy)) {
                        npc._facing = dx > 0 ? 'right' : 'left';
                    } else {
                        npc._facing = dy > 0 ? 'down' : 'up';
                    }
                }
            }

            // Update tile col/row to match pixel position (for interaction detection)
            npc.col = Math.round(npc._x / ts);
            npc.row = Math.round(npc._y / ts);
        }
    }
}

/** Renders all NPCs in the current zone using pixel art sprites. */
function renderNPCs(ctx, cameraX, cameraY) {
    const zone = game.currentZone;
    if (!zone || !zone.npcs) return;
    const ts = CONFIG.TILE_SIZE;

    for (let i = 0; i < zone.npcs.length; i++) {
        const npc = zone.npcs[i];
        // Use pixel position if available, otherwise grid position
        var npcPxX = npc._x !== undefined ? npc._x : npc.col * ts;
        var npcPxY = npc._y !== undefined ? npc._y : npc.row * ts;
        const screenX = npcPxX - cameraX;
        const screenY = npcPxY - cameraY;

        // NPC sprite (generated on first access)
        var sprite = getNPCSprite(npc);
        var idleFrame = (npc._idleFrame || 0);
        var bobY = 0;
        var npcFacing = npc._facing || 'down';

        // Idle animation — continuous body sway using game.time
        if (npc.idle && !(dialogue.active && dialogue.npcId === npc.id)) {
            var idleType = npc.idle.type;
            var t = game.time;
            if (idleType === 'cook' || idleType === 'arrange') {
                bobY = Math.sin(t * 2.5) * 2;
            } else if (idleType === 'fish') {
                bobY = Math.sin(t * 1.5) * 2;
            } else if (idleType === 'knit') {
                bobY = Math.sin(t * 3) * 1.5;
            } else if (idleType === 'read') {
                bobY = Math.sin(t * 1.2) * 1;
            } else if (idleType === 'feed') {
                bobY = Math.sin(t * 2) * 2.5;
            }
        }
        // Walking leg bob
        var walkBob = 0;
        if (npc._walking) {
            walkBob = Math.sin(game.time * 10) * 1.5;
        }

        // Flip sprite horizontally when facing left
        if (npcFacing === 'left') {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -(screenX + ts + 1), screenY - 1 + bobY + walkBob);
            ctx.restore();
        } else {
            ctx.drawImage(sprite, screenX - 1, screenY - 1 + bobY + walkBob);
        }

        // Idle visual effects — always visible when NPC has idle type
        if (npc.idle && !(dialogue.active && dialogue.npcId === npc.id)) {
            var ecx = screenX + ts / 2;
            var ecy = screenY + ts / 2;
            var t = game.time;
            var idleType = npc.idle.type;

            if (idleType === 'cook') {
                // Continuous steam puffs rising
                for (var sp = 0; sp < 3; sp++) {
                    var steamY = screenY - 4 - ((t * 20 + sp * 12) % 24);
                    var steamX = ecx - 6 + Math.sin(t * 2 + sp * 2) * 5;
                    var steamAlpha = 0.4 - ((t * 20 + sp * 12) % 24) / 60;
                    if (steamAlpha > 0) {
                        ctx.fillStyle = 'rgba(220,220,220,' + steamAlpha + ')';
                        ctx.beginPath(); ctx.arc(steamX, steamY, 3 + sp, 0, Math.PI * 2); ctx.fill();
                    }
                }
            } else if (idleType === 'fish') {
                // Fishing line + bobber always visible
                var bobberBob = Math.sin(t * 2) * 3;
                ctx.strokeStyle = '#888888';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(ecx + 10, screenY + 8);
                ctx.quadraticCurveTo(ecx + 20, screenY + ts + 2 + bobberBob, ecx + 16, screenY + ts + 12 + bobberBob);
                ctx.stroke();
                // Bobber
                ctx.fillStyle = '#e53935';
                ctx.beginPath(); ctx.arc(ecx + 16, screenY + ts + 12 + bobberBob, 3, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(ecx + 16, screenY + ts + 10 + bobberBob, 2, 0, Math.PI * 2); ctx.fill();
                // Water ripple around bobber
                ctx.strokeStyle = 'rgba(100,180,255,0.3)';
                var rippleR = 4 + Math.sin(t * 3) * 2;
                ctx.beginPath(); ctx.arc(ecx + 16, screenY + ts + 13 + bobberBob, rippleR, 0, Math.PI * 2); ctx.stroke();
            } else if (idleType === 'feed') {
                // Bread crumbs continuously floating down
                ctx.fillStyle = '#dcc8a0';
                for (var cr = 0; cr < 5; cr++) {
                    var crx = ecx + 4 + Math.sin(t * 3 + cr * 1.5) * 8;
                    var cry = ecy + 4 + ((t * 25 + cr * 8) % 20);
                    ctx.fillRect(crx, cry, 2, 2);
                }
                // Small bread piece in hand (arm raised)
                ctx.fillStyle = '#c4a46c';
                var armBob = Math.sin(t * 2) > 0 ? -3 : 0;
                ctx.fillRect(ecx + 6, ecy - 8 + armBob, 4, 3);
            } else if (idleType === 'knit') {
                // Knitting needles always visible, clicking back and forth
                ctx.strokeStyle = '#cccccc';
                ctx.lineWidth = 1.5;
                var needlePhase = Math.sin(t * 3) * 3;
                ctx.beginPath();
                ctx.moveTo(ecx - 2, ecy + 4);
                ctx.lineTo(ecx - 8 + needlePhase, ecy - 6);
                ctx.moveTo(ecx + 2, ecy + 4);
                ctx.lineTo(ecx + 8 - needlePhase, ecy - 6);
                ctx.stroke();
                // Yarn ball on ground
                ctx.fillStyle = '#e53935';
                ctx.beginPath(); ctx.arc(ecx - 12, ecy + 14, 5, 0, Math.PI * 2); ctx.fill();
                // Yarn string to needles
                ctx.strokeStyle = '#e53935';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(ecx - 10, ecy + 10);
                ctx.quadraticCurveTo(ecx - 6, ecy + 4, ecx - 2, ecy + 4);
                ctx.stroke();
            } else if (idleType === 'read') {
                // Open book always visible in front of NPC
                ctx.fillStyle = '#f5e6c8';
                ctx.fillRect(ecx - 9, ecy + 4, 7, 10);
                ctx.fillRect(ecx + 2, ecy + 4, 7, 10);
                ctx.strokeStyle = '#8b6914';
                ctx.lineWidth = 1;
                ctx.strokeRect(ecx - 9, ecy + 4, 7, 10);
                ctx.strokeRect(ecx + 2, ecy + 4, 7, 10);
                // Spine
                ctx.fillStyle = '#6b4226';
                ctx.fillRect(ecx - 1, ecy + 4, 2, 10);
                // Page turn indicator (subtle)
                if (Math.sin(t * 0.8) > 0.7) {
                    ctx.fillStyle = 'rgba(245,230,200,0.6)';
                    ctx.fillRect(ecx + 3, ecy + 5, 5, 8);
                }
            } else if (idleType === 'arrange') {
                // Item being moved back and forth
                var itemX = ecx + 4 + Math.sin(t * 2) * 8;
                var itemY = ecy - 6 + Math.abs(Math.sin(t * 2)) * 3;
                var itemColors = ['#e53935', '#ffd600', '#4caf50', '#42a5f5'];
                ctx.fillStyle = itemColors[Math.floor(t * 0.5) % 4];
                ctx.fillRect(itemX, itemY, 5, 5);
                ctx.strokeStyle = 'rgba(0,0,0,0.2)';
                ctx.lineWidth = 1;
                ctx.strokeRect(itemX, itemY, 5, 5);
            }
        }

        // NPC name label above
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(npc.name, screenX + ts / 2, screenY - 6);
    }

    // Interaction prompt when near an NPC
    if (!dialogue.active) {
        const nearby = findNearbyNPC();
        if (nearby) {
            var nearPxX = nearby._x !== undefined ? nearby._x : nearby.col * ts;
            var nearPxY = nearby._y !== undefined ? nearby._y : nearby.row * ts;
            const sx = nearPxX - cameraX + ts / 2;
            const sy = nearPxY - cameraY - 18;
            ctx.fillStyle = '#ffd54f';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('[Z] Talk', sx, sy);
        }
    }
}

// ============================================================
// Generic enemy system
// ============================================================

/** Active enemies in the current zone. */
var enemies = [];

/** Loads enemies for a zone from its definition. Called from loadZone. */
function loadEnemies(zoneId) {
    enemies = [];
    var zone = ZONES[zoneId];
    if (!zone || !zone.enemies) return;
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < zone.enemies.length; i++) {
        var def = zone.enemies[i];
        // Build waypoints in pixels from tile positions
        var waypoints = [];
        if (def.patrol) {
            for (var p = 0; p < def.patrol.length; p++) {
                waypoints.push({ x: def.patrol[p].col * ts, y: def.patrol[p].row * ts });
            }
        }
        enemies.push({
            id: def.id,
            name: def.name || 'Enemy',
            x: def.col * ts, y: def.row * ts,
            w: 24, h: 24,
            color: def.color || '#cc4444',
            // Stats
            hp: def.hp || 3,
            maxHp: def.hp || 3,
            speed: def.speed || 60,
            chaseSpeed: def.chaseSpeed || 100,
            sightRange: def.sightRange || 140,
            loseRange: def.loseRange || 200,
            damage: def.damage || 1,
            // AI state: 'patrol' | 'chase' | 'stunned' | 'slowed' | 'retreat' | 'dead'
            state: 'patrol',
            // Patrol
            waypoints: waypoints,
            waypointIndex: 0,
            waypointDir: 1,
            facing: 'down',
            // Effects
            effectTimer: 0,       // remaining time for current effect (stun/slow/retreat)
            effectType: '',       // 'stun' | 'slow' | 'trip' | 'fear'
            // Knockback
            knockX: 0, knockY: 0, // knockback velocity
            knockTimer: 0,
            // Visual
            flashTimer: 0,        // damage flash
            animTimer: 0,
            // Drop
            drop: def.drop || null, // item id dropped on death
        });
    }
}

/** Updates all enemies. */
function updateEnemies(dt) {
    for (var i = enemies.length - 1; i >= 0; i--) {
        var e = enemies[i];
        if (e.state === 'dead') continue;
        e.animTimer += dt;

        // Damage flash
        if (e.flashTimer > 0) e.flashTimer -= dt;

        // Knockback
        if (e.knockTimer > 0) {
            e.knockTimer -= dt;
            var kx = e.x + e.knockX * dt;
            var ky = e.y + e.knockY * dt;
            if (!collidesWithMap(game.currentMap, kx, e.y, e.w, e.h)) e.x = kx;
            if (!collidesWithMap(game.currentMap, e.x, ky, e.w, e.h)) e.y = ky;
            continue; // skip AI during knockback
        }

        // Effect timer
        if (e.effectTimer > 0) {
            e.effectTimer -= dt;
            if (e.effectTimer <= 0) {
                // Effect expired — return to patrol
                e.effectType = '';
                e.state = 'patrol';
            }
        }

        if (e.state === 'stunned') {
            continue; // frozen in place
        }

        if (e.state === 'retreat') {
            updateEnemyRetreat(e, dt);
            continue;
        }

        // Speed modifier for slow effect
        var speedMult = (e.state === 'slowed') ? 0.4 : 1.0;

        if (e.state === 'patrol' || e.state === 'slowed') {
            updateEnemyPatrol(e, dt, speedMult);
            // Check if player is in sight
            if (canEnemySeePlayer(e)) {
                e.state = (e.effectType === 'slow') ? 'slowed' : 'chase';
            }
        } else if (e.state === 'chase') {
            updateEnemyChase(e, dt, speedMult);
            // Lose player
            var dx = player.x - e.x;
            var dy = player.y - e.y;
            if (dx * dx + dy * dy > e.loseRange * e.loseRange) {
                e.state = (e.effectType === 'slow') ? 'slowed' : 'patrol';
            }
            // Contact damage to player
            if (rectsOverlap(e.x, e.y, e.w, e.h, player.x, player.y, player.w, player.h)) {
                damagePlayer(e.damage);
            }
        }
    }
}

/** Moves enemy along patrol waypoints. */
function updateEnemyPatrol(e, dt, speedMult) {
    if (e.waypoints.length === 0) return;
    var target = e.waypoints[e.waypointIndex];
    var dx = target.x - e.x;
    var dy = target.y - e.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 3) {
        e.waypointIndex += e.waypointDir;
        if (e.waypointIndex >= e.waypoints.length) { e.waypointDir = -1; e.waypointIndex = e.waypoints.length - 2; }
        else if (e.waypointIndex < 0) { e.waypointDir = 1; e.waypointIndex = 1; }
        return;
    }
    var speed = e.speed * speedMult * dt;
    var nx = dx / dist;
    var ny = dy / dist;
    moveEnemy(e, nx * speed, ny * speed);
    updateEnemyFacing(e, dx, dy);
}

/** Chases the player directly. */
function updateEnemyChase(e, dt, speedMult) {
    var dx = player.x - e.x;
    var dy = player.y - e.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    var speed = e.chaseSpeed * speedMult * dt;
    var nx = dx / dist;
    var ny = dy / dist;
    moveEnemy(e, nx * speed, ny * speed);
    updateEnemyFacing(e, dx, dy);
}

/** Retreats away from the player. */
function updateEnemyRetreat(e, dt) {
    var dx = e.x - player.x;
    var dy = e.y - player.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;
    var speed = e.chaseSpeed * 0.8 * dt;
    var nx = dx / dist;
    var ny = dy / dist;
    moveEnemy(e, nx * speed, ny * speed);
    updateEnemyFacing(e, -dx, -dy);
}

/** Moves enemy with wall collision. */
function moveEnemy(e, mx, my) {
    var newX = e.x + mx;
    if (!collidesWithMap(game.currentMap, newX, e.y, e.w, e.h)) e.x = newX;
    var newY = e.y + my;
    if (!collidesWithMap(game.currentMap, e.x, newY, e.w, e.h)) e.y = newY;
}

/** Updates enemy facing based on movement direction. */
function updateEnemyFacing(e, dx, dy) {
    if (Math.abs(dx) > Math.abs(dy)) {
        e.facing = dx > 0 ? 'right' : 'left';
    } else {
        e.facing = dy > 0 ? 'down' : 'up';
    }
}

/** Checks if an enemy can see the player (radius + raycast). */
function canEnemySeePlayer(e) {
    var ecx = e.x + e.w / 2;
    var ecy = e.y + e.h / 2;
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var dx = pcx - ecx;
    var dy = pcy - ecy;
    var distSq = dx * dx + dy * dy;
    var effectiveRange = e.sightRange * getBuffStealthMult();
    if (distSq > effectiveRange * effectiveRange) return false;
    // Raycast for walls
    var dist = Math.sqrt(distSq);
    var steps = Math.ceil(dist / CONFIG.TILE_SIZE);
    var ts = CONFIG.TILE_SIZE;
    for (var i = 1; i < steps; i++) {
        var t = i / steps;
        var col = Math.floor((ecx + dx * t) / ts);
        var row = Math.floor((ecy + dy * t) / ts);
        if (getTile(game.currentMap, col, row).solid) return false;
    }
    return true;
}

/** Applies damage and effects to an enemy from a weapon hit. */
function hitEnemy(e, weapon) {
    if (e.state === 'dead') return;

    // Damage
    e.hp -= weapon.damage;
    e.flashTimer = 0.2;

    // Knockback
    var dx = e.x - player.x;
    var dy = e.y - player.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
        var kb = weapon.knockback || 60;
        e.knockX = (dx / dist) * kb * 4;
        e.knockY = (dy / dist) * kb * 4;
        e.knockTimer = 0.15;
    }

    // Weapon effects
    var effect = weapon.effect || null;
    var duration = weapon.effectDuration || 0;
    if (effect === 'stun' || effect === 'trip') {
        e.state = 'stunned';
        e.effectType = effect;
        e.effectTimer = duration;
    } else if (effect === 'slow') {
        e.state = 'slowed';
        e.effectType = 'slow';
        e.effectTimer = duration;
    } else if (effect === 'fear') {
        e.state = 'retreat';
        e.effectType = 'fear';
        e.effectTimer = duration;
    }

    // Check death
    if (e.hp <= 0) {
        e.state = 'dead';
        // Drop item
        if (e.drop) {
            var ts = CONFIG.TILE_SIZE;
            var col = Math.floor((e.x + e.w / 2) / ts);
            var row = Math.floor((e.y + e.h / 2) / ts);
            spawnWorldItem(e.id + '_drop', col, row, e.drop);
        }
    }

    playEnemyHit();
}

/** Renders all enemies. */
function renderEnemies(ctx, cameraX, cameraY) {
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (e.state === 'dead') continue;
        var sx = e.x - cameraX;
        var sy = e.y - cameraY;
        var t = e.animTimer;

        // Flash on hit
        if (e.flashTimer > 0 && Math.floor(t * 16) % 2 === 0) {
            ctx.globalAlpha = 0.4;
        }

        // Draw enemy sprite based on state
        var spriteState = e.state;
        if (spriteState !== 'chase' && spriteState !== 'stunned' &&
            spriteState !== 'slowed' && spriteState !== 'retreat') {
            spriteState = 'patrol';
        }
        var sprite = SPRITES.enemy[spriteState];
        if (sprite) {
            // Outlined sprite has +2 padding, enemy is 24x24
            ctx.drawImage(sprite, sx - 1, sy - 1);
        }

        ctx.globalAlpha = 1;

        // Stunned stars
        if (e.state === 'stunned') {
            ctx.fillStyle = '#ffeb3b';
            ctx.font = '8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('* *', sx + e.w / 2, sy - 2 + Math.sin(t * 3) * 2);
        }

        // Slowed ice crystals
        if (e.state === 'slowed') {
            ctx.fillStyle = 'rgba(100, 180, 255, 0.4)';
            ctx.fillRect(sx, sy + e.h - 4, e.w, 4);
        }

        // Retreat sweat drops
        if (e.state === 'retreat') {
            ctx.fillStyle = '#4fc3f7';
            ctx.fillRect(sx + e.w + 2, sy + 4 + Math.sin(t * 5) * 2, 2, 3);
        }

        // HP bar (only when damaged)
        if (e.hp < e.maxHp) {
            var barW = e.w;
            var barH = 3;
            var barX = sx;
            var barY = sy - 6;
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barW, barH);
            ctx.fillStyle = e.hp > e.maxHp * 0.3 ? '#00cc44' : '#ff4444';
            ctx.fillRect(barX, barY, barW * (e.hp / e.maxHp), barH);
        }

        // Name
        ctx.fillStyle = e.state === 'chase' ? '#ff4444' : '#cccccc';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(e.name, sx + e.w / 2, sy - 10);
    }
}

// ============================================================
// Power-up system
// ============================================================

/** Power-up type definitions. */
const POWERUPS = {
    broccoli:       { id: 'broccoli',       name: 'Iron Legs',      effect: 'speed',      duration: 12, color: '#4caf50', icon: 'BRC' },
    chocolate_milk: { id: 'chocolate_milk',  name: 'Sugar Rush',     effect: 'attack',     duration: 10, color: '#795548', icon: 'CHO' },
    water:          { id: 'water',           name: 'Cool Head',      effect: 'stealth',    duration: 15, color: '#42a5f5', icon: 'WTR' },
    deli_meat:      { id: 'deli_meat',       name: 'Protein Shield', effect: 'shield',     duration: 20, color: '#ef5350', icon: 'DLI', shieldHits: 3 },
    gouda:          { id: 'gouda',           name: 'Sticky Aura',    effect: 'aura_slow',  duration: 12, color: '#ffc107', icon: 'GDA' },
    brownie:        { id: 'brownie',         name: 'Brodo Boost',    effect: 'sniff',      duration: 15, color: '#6d4c41', icon: 'BRW' },
    milk:           { id: 'milk',            name: "Mama's Comfort", effect: 'free_hints', duration: 20, color: '#f5f5f5', icon: 'MLK' },
};

/** Active buff state. Only one buff at a time. */
const activeBuff = {
    type: null,        // POWERUPS key or null
    timer: 0,          // remaining seconds
    maxTimer: 0,       // original duration (for HUD bar)
    shieldHits: 0,     // remaining shield hits (deli_meat only)
    swapText: '',      // "Swapped!" indicator text
    swapTimer: 0,      // display timer for swap text
};

/** World power-up pickups in the current zone. */
var worldPowerups = [];

/** Loads power-up pickups for a zone. Called from loadZone. */
function loadPowerups(zoneId) {
    worldPowerups = [];
    var zone = ZONES[zoneId];
    if (!zone || !zone.powerups) return;
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < zone.powerups.length; i++) {
        var def = zone.powerups[i];
        worldPowerups.push({
            id: def.id,
            type: def.type,  // POWERUPS key
            x: def.col * ts, y: def.row * ts,
            col: def.col, row: def.row,
            collected: false,
            bobTimer: 0,
        });
    }
}

/** Activates a power-up buff. Replaces any existing buff. */
function activatePowerup(type) {
    var def = POWERUPS[type];
    if (!def) return;

    // Swap indicator if replacing existing buff
    if (activeBuff.type && activeBuff.type !== type) {
        activeBuff.swapText = 'Swapped!';
        activeBuff.swapTimer = 1.0;
    }

    activeBuff.type = type;
    activeBuff.timer = def.duration;
    activeBuff.maxTimer = def.duration;
    activeBuff.shieldHits = def.shieldHits || 0;
}

/** Clears the active buff. */
function clearBuff() {
    activeBuff.type = null;
    activeBuff.timer = 0;
    activeBuff.maxTimer = 0;
    activeBuff.shieldHits = 0;
}

/** Returns the speed multiplier from active buff. */
function getBuffSpeedMult() {
    if (activeBuff.type === 'broccoli' && activeBuff.timer > 0) return 1.5;
    return 1.0;
}

/** Returns the weapon cooldown multiplier from active buff. */
function getBuffCooldownMult() {
    if (activeBuff.type === 'chocolate_milk' && activeBuff.timer > 0) return 0.5;
    return 1.0;
}

/** Returns the enemy sight range multiplier from active buff. */
function getBuffStealthMult() {
    if (activeBuff.type === 'water' && activeBuff.timer > 0) return 0.5;
    return 1.0;
}

/** Returns the Brodo sniff radius multiplier from active buff. */
function getBuffSniffMult() {
    if (activeBuff.type === 'brownie' && activeBuff.timer > 0) return 2.0;
    return 1.0;
}

/** Returns true if free hints are active. */
function isBuffFreeHints() {
    return activeBuff.type === 'milk' && activeBuff.timer > 0;
}

/** Absorbs a hit with shield buff. Returns true if hit was absorbed. */
function tryShieldAbsorb() {
    if (activeBuff.type !== 'deli_meat' || activeBuff.timer <= 0) return false;
    activeBuff.shieldHits--;
    if (activeBuff.shieldHits <= 0) {
        clearBuff();
    }
    return true;
}

/** Updates the power-up system: buff timer, pickup checks, aura effect. */
function updatePowerups(dt) {
    // Buff timer
    if (activeBuff.timer > 0) {
        activeBuff.timer -= dt;
        if (activeBuff.timer <= 0) {
            clearBuff();
        }
    }
    if (activeBuff.swapTimer > 0) activeBuff.swapTimer -= dt;

    // Pickup check — walk over power-ups
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var pickupRadius = CONFIG.ITEM_PICKUP_RADIUS + 4;
    var ts = CONFIG.TILE_SIZE;

    for (var i = 0; i < worldPowerups.length; i++) {
        var pu = worldPowerups[i];
        if (pu.collected) continue;
        pu.bobTimer += dt;
        var cx = pu.x + ts / 2;
        var cy = pu.y + ts / 2;
        var dx = pcx - cx;
        var dy = pcy - cy;
        if (dx * dx + dy * dy <= pickupRadius * pickupRadius) {
            pu.collected = true;
            activatePowerup(pu.type);
            playItemPickup();
        }
    }

    // Aura slow effect — slow enemies near player
    if (activeBuff.type === 'gouda' && activeBuff.timer > 0) {
        var auraRange = CONFIG.TILE_SIZE * 2;
        for (var i = 0; i < enemies.length; i++) {
            var e = enemies[i];
            if (e.state === 'dead' || e.state === 'stunned') continue;
            var edx = (e.x + e.w / 2) - pcx;
            var edy = (e.y + e.h / 2) - pcy;
            if (edx * edx + edy * edy <= auraRange * auraRange) {
                if (e.state !== 'slowed' && e.state !== 'retreat') {
                    e.state = 'slowed';
                    e.effectType = 'slow';
                    e.effectTimer = 0.5; // re-applied each frame while in range
                }
            }
        }
    }
}

/** Renders world power-up pickups with sprites and glow effect. */
function renderPowerups(ctx, cameraX, cameraY) {
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < worldPowerups.length; i++) {
        var pu = worldPowerups[i];
        if (pu.collected) continue;
        var def = POWERUPS[pu.type];
        if (!def) continue;

        var sx = pu.x - cameraX;
        var sy = pu.y - cameraY;
        var bob = Math.sin(pu.bobTimer * 2.5) * 3;
        var cx = sx + ts / 2;
        var cy = sy + ts / 2 + bob;

        // Glow circle
        var glowAlpha = 0.2 + Math.sin(pu.bobTimer * 2) * 0.08;
        ctx.fillStyle = def.color;
        ctx.globalAlpha = glowAlpha;
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;

        // Power-up sprite
        var sprite = SPRITES.powerups[pu.type];
        if (sprite) {
            ctx.drawImage(sprite, cx - 10, cy - 10);
        } else {
            // Fallback to colored square
            ctx.fillStyle = def.color;
            ctx.fillRect(cx - 8, cy - 8, 16, 16);
        }

        // Name label
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.name, cx, sy - 4 + bob);
    }
}

/** Renders the power-up buff HUD (timer bar + icon). */
function renderBuffHUD(ctx) {
    if (!activeBuff.type || activeBuff.timer <= 0) return;
    var def = POWERUPS[activeBuff.type];
    if (!def) return;

    // Position: below weapon HUD, top-right
    var barW = 96;
    var barH = 8;
    var hx = CONFIG.CANVAS_W - 120;
    var hy = CONFIG.INV_MARGIN_TOP + CONFIG.INV_SLOT_SIZE + 16;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(hx, hy, barW + 24, 28);
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1;
    ctx.strokeRect(hx, hy, barW + 24, 28);

    // Icon
    ctx.fillStyle = def.color;
    ctx.fillRect(hx + 3, hy + 4, 18, 18);
    ctx.fillStyle = '#000';
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.icon, hx + 12, hy + 16);

    // Name
    ctx.fillStyle = def.color;
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(def.name, hx + 24, hy + 11);

    // Timer bar
    var pct = activeBuff.timer / activeBuff.maxTimer;
    ctx.fillStyle = '#333333';
    ctx.fillRect(hx + 24, hy + 16, barW - 4, barH);
    ctx.fillStyle = pct > 0.3 ? def.color : '#ff4444';
    ctx.fillRect(hx + 24, hy + 16, (barW - 4) * pct, barH);

    // Shield hits remaining
    if (activeBuff.type === 'deli_meat') {
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(activeBuff.shieldHits + ' hits', hx + barW + 20, hy + 11);
    }

    // Swap indicator
    if (activeBuff.swapTimer > 0) {
        var sAlpha = Math.min(activeBuff.swapTimer / 0.3, 1);
        ctx.fillStyle = 'rgba(255, 255, 255, ' + sAlpha + ')';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(activeBuff.swapText, hx + (barW + 24) / 2, hy - 4);
    }
}

/** Renders a subtle glow around the player when a buff is active. */
function renderPlayerGlow(ctx, cameraX, cameraY) {
    if (!activeBuff.type || activeBuff.timer <= 0) return;
    var def = POWERUPS[activeBuff.type];
    if (!def) return;

    var sx = player.x + player.w / 2 - cameraX;
    var sy = player.y + player.h / 2 - cameraY;
    var pulse = 0.12 + Math.sin(game.time * 3) * 0.05;

    ctx.fillStyle = def.color;
    ctx.globalAlpha = pulse;
    ctx.beginPath();
    ctx.arc(sx, sy, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
}
