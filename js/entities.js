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

/** Draws an elliptical ground shadow beneath a character to separate them from the background. */
function drawCharacterShadow(ctx, cx, cy, radiusX, radiusY) {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.ellipse(cx, cy, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}

/** Renders the player using enhanced pixel art sprites. */
function renderPlayer(ctx, cameraX, cameraY) {
    // Death animation — shrink and fade
    if (player.dead) {
        var deathProgress = 1 - (player.deathTimer / 1.0);
        var scale = Math.max(0.01, 1 - deathProgress);
        var alpha = Math.max(0, 1 - deathProgress);
        ctx.globalAlpha = alpha;
        var dcx = player.x + player.w / 2 - cameraX;
        var dcy = player.y + player.h / 2 - cameraY;
        var T = CONFIG.TILE_SIZE;
        var sw = T * scale;
        var sh = T * scale;
        var dirRow = { down: 0, left: 1, right: 2, up: 3 };
        // Try image sprite for death frame, fallback to procedural
        if (SpriteLoader.manifest && SpriteLoader.manifest.characters && SpriteLoader.manifest.characters.giulia && SpriteLoader.hasSheet(SpriteLoader.manifest.characters.giulia.sheet)) {
            var def = SpriteLoader.manifest.characters.giulia;
            var img = SpriteLoader.images[def.sheet];
            ctx.drawImage(img, 0, (dirRow[player.facing] || 0) * def.frameH, def.frameW, def.frameH, dcx - sw / 2, dcy - sh / 2, sw, sh);
        } else {
            var sprite = getPlayerSprite(player.facing, 0);
            ctx.drawImage(sprite, dcx - sprite.width * scale / 2, dcy - sprite.height * scale / 2, sprite.width * scale, sprite.height * scale);
        }
        ctx.globalAlpha = 1;
        return;
    }

    // Invulnerability blink
    if (player.invulnTimer > 0 && Math.floor(game.time * 10) % 2 === 0) {
        return; // skip rendering every other frame = blink effect
    }

    var screenX = player.x - cameraX;
    var screenY = player.y - cameraY;

    // Walk sprite bob: ±1px vertical offset gives weight to movement
    var bobOffY = 0;
    if (player.animFrame === 1 || player.animFrame === 3) {
        bobOffY = -1; // lift on stride frames
    }

    // Ground shadow beneath player
    drawCharacterShadow(ctx, screenX + player.w / 2, screenY + player.h - 2, 12, 5);

    // Try image-based sprite: direction row (down=0,left=1,right=2,up=3), walk frame column
    var dirRow = { down: 0, left: 1, right: 2, up: 3 };
    if (!SpriteLoader.drawCharacter(ctx, 'giulia', player.animFrame, dirRow[player.facing] || 0, screenX, screenY + bobOffY, 48)) {
        // Procedural fallback (outlined sprite has +2 padding)
        var sprite = getPlayerSprite(player.facing, player.animFrame);
        ctx.drawImage(sprite, screenX - 2, screenY - 4 + bobOffY);
    }
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

/** Restarts from the very beginning (all lives spent). During boss: respawn at zone entrance for retry. */
function restartZone() {
    player.lives = 3;
    player.hp = player.maxHp;
    player.dead = false;
    player.invulnTimer = 2.0;
    player.damageFlash = 0;
    if (enzoBoss.active) {
        // Reset boss fight and respawn at pizzeria entrance
        resetEnzoBoss();
        loadZone('pizzeria');
    } else if (weddingBoss.active) {
        // Reset wedding boss and respawn at sewing shop entrance
        resetWeddingBoss();
        loadZone('sewing_shop');
    } else {
        // Back to La Cucina — start from scratch
        loadZone('la_cucina');
    }
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
    var bodyOffY = 0;
    if (isIdle && (anim === 'sit' || anim === 'nap')) {
        bodyOffY = 2 + Math.sin(t * 1.5) * 0.5;
    }
    // Ground shadow beneath Brodo
    drawCharacterShadow(ctx, sx + 16, sy + 28, 10, 4);

    // Try image-based sprite: state column (follow=0,idle=1,sit=2,bark=3,sniff=4)
    var brodoStates = { follow: 0, idle: 1, sit: 2, bark: 3, sniff: 4, nap: 2 };
    if (!SpriteLoader.drawCharacter(ctx, 'brodo', brodoStates[spriteKey] || 0, 0, sx, sy + bodyOffY, 40)) {
        // Procedural fallback (outlined sprite has +2 padding)
        var sprite = SPRITES.brodo[spriteKey];
        if (sprite) {
            ctx.drawImage(sprite, sx - 3, sy - 2 + bodyOffY);
        }
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
        // [B] Call prompt
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[B] Call', sx + w / 2, labelY + 10);
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
/** Renders a single NPC with idle animation and visual effects. */
function renderSingleNPC(ctx, cameraX, cameraY, npc) {
    var ts = CONFIG.TILE_SIZE;
    var npcPxX = npc._x !== undefined ? npc._x : npc.col * ts;
    var npcPxY = npc._y !== undefined ? npc._y : npc.row * ts;
    var screenX = npcPxX - cameraX;
    var screenY = npcPxY - cameraY;

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

        // Ground shadow beneath NPC
        drawCharacterShadow(ctx, screenX + ts / 2, screenY + ts - 2 + bobY + walkBob, 11, 4);

        // Try image-based NPC sprite first, then procedural
        var npcDrawY = screenY + bobY + walkBob;
        if (!SpriteLoader.drawNPC(ctx, npc.id, screenX, npcDrawY, npcFacing === 'left', 44)) {
            // Procedural fallback — flip sprite horizontally when facing left
            if (npcFacing === 'left') {
                ctx.save();
                ctx.scale(-1, 1);
                ctx.drawImage(sprite, -(screenX + ts + 1), screenY - 1 + bobY + walkBob);
                ctx.restore();
            } else {
                ctx.drawImage(sprite, screenX - 1, screenY - 1 + bobY + walkBob);
            }
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

        // NPC name label removed for cleaner visuals
}

function renderNPCs(ctx, cameraX, cameraY) {
    var zone = game.currentZone;
    if (!zone || !zone.npcs) return;
    for (var i = 0; i < zone.npcs.length; i++) {
        renderSingleNPC(ctx, cameraX, cameraY, zone.npcs[i]);
    }
}

/** Renders NPC interaction prompt when player is nearby. */
function renderNPCPrompt(ctx, cameraX, cameraY) {
    if (dialogue.active) return;
    var ts = CONFIG.TILE_SIZE;
    var nearby = findNearbyNPC();
    if (nearby) {
        var nearPxX = nearby._x !== undefined ? nearby._x : nearby.col * ts;
        var nearPxY = nearby._y !== undefined ? nearby._y : nearby.row * ts;
        var sx = nearPxX - cameraX + ts / 2;
        var sy = nearPxY - cameraY - 18;
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[Z] Talk', sx, sy);
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
        // Award coins
        var coinAmount = (e.id && e.id.indexOf('boss_waiter') === 0)
            ? COIN_REWARDS.BOSS_WAITER_KILL : COIN_REWARDS.ENEMY_KILL;
        addScore(coinAmount, e.x + e.w / 2, e.y);
    }

    playEnemyHit();
}

/** Renders all enemies. */
/** Renders a single enemy with state-based visuals and HP bar. */
function renderSingleEnemy(ctx, cameraX, cameraY, e) {
    if (e.state === 'dead') return;
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
        // Try image-based sprite first
        if (!SpriteLoader.drawEnemy(ctx, 'goon', sx, sy)) {
            var sprite = SPRITES.enemy[spriteState];
            if (sprite) {
                // Outlined sprite has +2 padding, enemy is 24x24
                ctx.drawImage(sprite, sx - 1, sy - 1);
            }
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

        // Enemy name label removed for cleaner visuals
}

function renderEnemies(ctx, cameraX, cameraY) {
    for (var i = 0; i < enemies.length; i++) {
        renderSingleEnemy(ctx, cameraX, cameraY, enemies[i]);
    }
}

// ============================================================
// Enzo Boss Fight
// ============================================================

/** Enzo boss state. Active only during the boss fight in the pizzeria. */
var enzoBoss = {
    active: false,
    // Position and size (larger than regular enemies)
    x: 0, y: 0, w: 32, h: 32,
    facing: 'down',
    // Stats
    hp: 18,
    maxHp: 18,
    speed: 70,
    chargeSpeed: 220,
    damage: 1,
    // Phase: 1 (throws dough), 2 (charge + dough), 3 (summons + all attacks)
    phase: 1,
    // AI state: 'idle' | 'throwing' | 'charging' | 'charge_windup' | 'summoning' | 'stunned' | 'defeated' | 'wander'
    state: 'idle',
    stateTimer: 0,
    // Attack cooldowns
    throwCooldown: 0,
    chargeCooldown: 0,
    summonCooldown: 0,
    // Charge attack
    chargeDir: { x: 0, y: 0 },
    chargeTimer: 0,
    chargeWindupTimer: 0,
    // Stun
    stunTimer: 0,
    // Wander
    wanderTarget: { x: 0, y: 0 },
    wanderTimer: 0,
    // Visual
    flashTimer: 0,
    animTimer: 0,
    // Arena bounds (kitchen area: cols 14-21, rows 1-18)
    arenaLeft: 14 * 32,
    arenaRight: 22 * 32,
    arenaTop: 1 * 32,
    arenaBottom: 19 * 32,
    // Intro dialogue done
    introDone: false,
    // Defeat sequence
    defeatTimer: 0,
    // Summoned waiter count (phase 3)
    summonCount: 0,
    maxSummons: 3,
};

/** Boss projectiles (pizza dough). Separate from weapon projectiles. */
var bossProjectiles = [];

/** Initializes the Enzo boss fight. Called when the fight begins. */
function startEnzoBoss() {
    var ts = CONFIG.TILE_SIZE;
    enzoBoss.active = true;
    enzoBoss.hp = 18;
    enzoBoss.maxHp = 18;
    enzoBoss.phase = 1;
    enzoBoss.state = 'idle';
    enzoBoss.stateTimer = 1.5; // brief pause before first attack
    enzoBoss.throwCooldown = 0;
    enzoBoss.chargeCooldown = 0;
    enzoBoss.summonCooldown = 0;
    enzoBoss.stunTimer = 0;
    enzoBoss.flashTimer = 0;
    enzoBoss.animTimer = 0;
    enzoBoss.introDone = false;
    enzoBoss.defeatTimer = 0;
    enzoBoss.summonCount = 0;
    enzoBoss.facing = 'left';
    bossProjectiles = [];
    // Position Enzo in the kitchen center
    enzoBoss.x = 18 * ts;
    enzoBoss.y = 6 * ts;
    // Arena bounds
    enzoBoss.arenaLeft = 14 * ts;
    enzoBoss.arenaRight = 22 * ts - enzoBoss.w;
    enzoBoss.arenaTop = 1 * ts;
    enzoBoss.arenaBottom = 18 * ts - enzoBoss.h;
    // Remove Enzo NPC from the zone so there's no duplicate
    hideNPCDuringBoss('enzo');
    // Clear any existing enemies so we start clean
    enemies = [];
    // Boss intro dialogue
    startDialogue({
        id: 'enzo_boss_intro', name: 'Enzo',
        getLines: function() {
            return {
                lines: [
                    "You want Mama's recipe? COME AND GET IT!",
                    "I'll show you what a REAL chef can do!",
                    "Prepare yourself, ragazza — PIZZA TIME!",
                ],
                onComplete: function() {
                    enzoBoss.introDone = true;
                    startBossTempo();
                },
            };
        },
    });
}

/** Hides an NPC by id during the boss fight (moves offscreen). */
function hideNPCDuringBoss(npcId) {
    var zone = game.currentZone;
    if (!zone || !zone.npcs) return;
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < zone.npcs.length; i++) {
        var npc = zone.npcs[i];
        if (npc.id === npcId) {
            npc._bossHiddenCol = npc.col;
            npc._bossHiddenRow = npc.row;
            npc._bossHiddenPx = npc._x;
            npc._bossHiddenPy = npc._y;
            npc.col = -99;
            npc.row = -99;
            if (npc._x !== undefined) { npc._x = -9999; npc._y = -9999; }
            break;
        }
    }
}

/** Restores a hidden NPC after boss fight. */
function restoreNPCAfterBoss(npcId) {
    var zone = game.currentZone;
    if (!zone || !zone.npcs) return;
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < zone.npcs.length; i++) {
        var npc = zone.npcs[i];
        if (npc.id === npcId && npc._bossHiddenCol !== undefined) {
            npc.col = npc._bossHiddenCol;
            npc.row = npc._bossHiddenRow;
            if (npc._bossHiddenPx !== undefined) {
                npc._x = npc._bossHiddenPx;
                npc._y = npc._bossHiddenPy;
            }
            delete npc._bossHiddenCol;
            delete npc._bossHiddenRow;
            delete npc._bossHiddenPx;
            delete npc._bossHiddenPy;
            break;
        }
    }
}

/** Updates the Enzo boss fight. Called from engine.js update. */
function updateEnzoBoss(dt) {
    if (!enzoBoss.active) return;
    if (enzoBoss.state === 'defeated') {
        updateEnzoBossDefeat(dt);
        return;
    }
    if (!enzoBoss.introDone) return; // wait for intro dialogue

    enzoBoss.animTimer += dt;
    if (enzoBoss.flashTimer > 0) enzoBoss.flashTimer -= dt;
    if (bossPhaseText.timer > 0) bossPhaseText.timer -= dt;

    // Cooldown ticks
    if (enzoBoss.throwCooldown > 0) enzoBoss.throwCooldown -= dt;
    if (enzoBoss.chargeCooldown > 0) enzoBoss.chargeCooldown -= dt;
    if (enzoBoss.summonCooldown > 0) enzoBoss.summonCooldown -= dt;

    // Update boss projectiles
    updateBossProjectiles(dt);

    // Phase transitions based on HP
    var hpPct = enzoBoss.hp / enzoBoss.maxHp;
    if (hpPct <= 0.33 && enzoBoss.phase < 3) {
        enzoBoss.phase = 3;
        showBossPhaseText("ENZO IS FURIOUS!");
    } else if (hpPct <= 0.66 && enzoBoss.phase < 2) {
        enzoBoss.phase = 2;
        showBossPhaseText("Enzo charges up!");
    }

    // Contact damage
    if (enzoBoss.state !== 'stunned') {
        if (rectsOverlap(enzoBoss.x, enzoBoss.y, enzoBoss.w, enzoBoss.h,
            player.x, player.y, player.w, player.h)) {
            damagePlayer(enzoBoss.damage);
        }
    }

    // State machine
    switch (enzoBoss.state) {
        case 'idle':
            updateEnzoBossIdle(dt);
            break;
        case 'wander':
            updateEnzoBossWander(dt);
            break;
        case 'throwing':
            updateEnzoBossThrowing(dt);
            break;
        case 'charge_windup':
            updateEnzoBossChargeWindup(dt);
            break;
        case 'charging':
            updateEnzoBossCharging(dt);
            break;
        case 'summoning':
            updateEnzoBossSummoning(dt);
            break;
        case 'stunned':
            updateEnzoBossStunned(dt);
            break;
    }

    // Face the player (except during charge)
    if (enzoBoss.state !== 'charging' && enzoBoss.state !== 'charge_windup') {
        var dx = player.x - enzoBoss.x;
        var dy = player.y - enzoBoss.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            enzoBoss.facing = dx > 0 ? 'right' : 'left';
        } else {
            enzoBoss.facing = dy > 0 ? 'down' : 'up';
        }
    }
}

/** Boss idle state — decides next attack. */
function updateEnzoBossIdle(dt) {
    enzoBoss.stateTimer -= dt;
    if (enzoBoss.stateTimer > 0) return;

    // Pick next attack based on phase
    var actions = [];
    if (enzoBoss.throwCooldown <= 0) actions.push('throw');
    if (enzoBoss.phase >= 2 && enzoBoss.chargeCooldown <= 0) actions.push('charge');
    if (enzoBoss.phase >= 3 && enzoBoss.summonCooldown <= 0 && enzoBoss.summonCount < enzoBoss.maxSummons) actions.push('summon');

    if (actions.length === 0) {
        // All on cooldown — wander toward player
        enzoBoss.state = 'wander';
        pickBossWanderTarget();
        enzoBoss.wanderTimer = 1.5;
        return;
    }

    var pick = actions[Math.floor(Math.random() * actions.length)];
    switch (pick) {
        case 'throw':
            enzoBoss.state = 'throwing';
            enzoBoss.stateTimer = 0.5; // wind-up time
            break;
        case 'charge':
            enzoBoss.state = 'charge_windup';
            enzoBoss.chargeWindupTimer = 0.8;
            // Lock charge direction toward player
            var dx = player.x - enzoBoss.x;
            var dy = player.y - enzoBoss.y;
            var dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                enzoBoss.chargeDir = { x: dx / dist, y: dy / dist };
            }
            break;
        case 'summon':
            enzoBoss.state = 'summoning';
            enzoBoss.stateTimer = 1.0;
            break;
    }
}

/** Boss wander — move toward a point in the arena. */
function updateEnzoBossWander(dt) {
    enzoBoss.wanderTimer -= dt;
    var dx = enzoBoss.wanderTarget.x - enzoBoss.x;
    var dy = enzoBoss.wanderTarget.y - enzoBoss.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 4 && enzoBoss.wanderTimer > 0) {
        var speed = enzoBoss.speed * dt;
        var mx = (dx / dist) * speed;
        var my = (dy / dist) * speed;
        moveBossWithCollision(mx, my);
    } else {
        enzoBoss.state = 'idle';
        enzoBoss.stateTimer = 0.3;
    }
}

/** Picks a wander target point between boss and player. */
function pickBossWanderTarget() {
    // Move toward player but stop at ~120px
    var dx = player.x - enzoBoss.x;
    var dy = player.y - enzoBoss.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 120) {
        enzoBoss.wanderTarget.x = enzoBoss.x + (dx / dist) * (dist - 100);
        enzoBoss.wanderTarget.y = enzoBoss.y + (dy / dist) * (dist - 100);
    } else {
        // Pick a random point in the arena
        enzoBoss.wanderTarget.x = enzoBoss.arenaLeft + Math.random() * (enzoBoss.arenaRight - enzoBoss.arenaLeft);
        enzoBoss.wanderTarget.y = enzoBoss.arenaTop + Math.random() * (enzoBoss.arenaBottom - enzoBoss.arenaTop);
    }
    // Clamp to arena
    enzoBoss.wanderTarget.x = Math.max(enzoBoss.arenaLeft, Math.min(enzoBoss.wanderTarget.x, enzoBoss.arenaRight));
    enzoBoss.wanderTarget.y = Math.max(enzoBoss.arenaTop, Math.min(enzoBoss.wanderTarget.y, enzoBoss.arenaBottom));
}

/** Boss throwing state — throws pizza dough at player. */
function updateEnzoBossThrowing(dt) {
    enzoBoss.stateTimer -= dt;
    if (enzoBoss.stateTimer <= 0) {
        fireBossProjectile();
        // In phase 3, throw a spread of 3
        if (enzoBoss.phase >= 3) {
            fireBossProjectile(-0.3);
            fireBossProjectile(0.3);
        }
        enzoBoss.throwCooldown = enzoBoss.phase >= 2 ? 1.8 : 2.5;
        enzoBoss.state = 'idle';
        enzoBoss.stateTimer = 0.5;
    }
}

/** Fires a single boss projectile toward the player. angleOffset rotates the direction. */
function fireBossProjectile(angleOffset) {
    var bcx = enzoBoss.x + enzoBoss.w / 2;
    var bcy = enzoBoss.y + enzoBoss.h / 2;
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var dx = pcx - bcx;
    var dy = pcy - bcy;
    var angle = Math.atan2(dy, dx) + (angleOffset || 0);
    var speed = 180;
    bossProjectiles.push({
        x: bcx - 6, y: bcy - 6, w: 12, h: 12,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        traveled: 0,
        maxDist: 300,
        splat: false,
        splatTimer: 0,
    });
    playTomatoSplat(); // reuse SFX
}

/** Boss charge windup — flash red, telegraph direction. */
function updateEnzoBossChargeWindup(dt) {
    enzoBoss.chargeWindupTimer -= dt;
    enzoBoss.flashTimer = 0.1; // constant flash during windup
    if (enzoBoss.chargeWindupTimer <= 0) {
        enzoBoss.state = 'charging';
        enzoBoss.chargeTimer = 0.6; // charge duration
    }
}

/** Boss charging — dash across the arena. */
function updateEnzoBossCharging(dt) {
    enzoBoss.chargeTimer -= dt;
    var speed = enzoBoss.chargeSpeed * dt;
    var mx = enzoBoss.chargeDir.x * speed;
    var my = enzoBoss.chargeDir.y * speed;

    var prevX = enzoBoss.x;
    var prevY = enzoBoss.y;
    moveBossWithCollision(mx, my);

    // If boss hit a wall (didn't move), stun briefly
    var moved = Math.abs(enzoBoss.x - prevX) + Math.abs(enzoBoss.y - prevY);
    if (moved < speed * 0.3 || enzoBoss.chargeTimer <= 0) {
        if (moved < speed * 0.3) {
            // Wall hit — stunned!
            enzoBoss.state = 'stunned';
            enzoBoss.stunTimer = 1.5;
        } else {
            enzoBoss.state = 'idle';
            enzoBoss.stateTimer = 0.8;
        }
        enzoBoss.chargeCooldown = 4.0;
    }

    // Contact damage during charge (higher)
    if (rectsOverlap(enzoBoss.x, enzoBoss.y, enzoBoss.w, enzoBoss.h,
        player.x, player.y, player.w, player.h)) {
        damagePlayer(2); // charge does 2 damage
    }
}

/** Boss summoning — spawns waiter enemies. */
function updateEnzoBossSummoning(dt) {
    enzoBoss.stateTimer -= dt;
    if (enzoBoss.stateTimer <= 0) {
        spawnBossWaiter();
        enzoBoss.summonCount++;
        enzoBoss.summonCooldown = 8.0;
        enzoBoss.state = 'idle';
        enzoBoss.stateTimer = 0.6;
    }
}

/** Spawns a waiter enemy near the boss. */
function spawnBossWaiter() {
    var ts = CONFIG.TILE_SIZE;
    // Spawn at a random kitchen position
    var spawnCol = 15 + Math.floor(Math.random() * 5);
    var spawnRow = 3 + Math.floor(Math.random() * 12);
    // Make sure it's not on a solid tile
    if (getTile(game.currentMap, spawnCol, spawnRow).solid) {
        spawnCol = 17;
        spawnRow = 5;
    }
    enemies.push({
        id: 'boss_waiter_' + enzoBoss.summonCount,
        name: 'Waiter',
        x: spawnCol * ts, y: spawnRow * ts,
        w: 24, h: 24,
        color: '#f5f5f5',
        hp: 2,
        maxHp: 2,
        speed: 55,
        chaseSpeed: 90,
        sightRange: 200,
        loseRange: 300,
        damage: 1,
        state: 'chase', // immediately chase player
        waypoints: [{ x: spawnCol * ts, y: spawnRow * ts }],
        waypointIndex: 0,
        waypointDir: 1,
        facing: 'down',
        effectTimer: 0,
        effectType: '',
        knockX: 0, knockY: 0, knockTimer: 0,
        flashTimer: 0,
        animTimer: 0,
        drop: 'tomato', // drop ammo
    });
}

/** Boss stunned — vulnerable, takes extra damage. */
function updateEnzoBossStunned(dt) {
    enzoBoss.stunTimer -= dt;
    if (enzoBoss.stunTimer <= 0) {
        enzoBoss.state = 'idle';
        enzoBoss.stateTimer = 0.5;
    }
}

/** Moves the boss with wall collision, clamped to arena. */
function moveBossWithCollision(mx, my) {
    var newX = enzoBoss.x + mx;
    if (!collidesWithMap(game.currentMap, newX, enzoBoss.y, enzoBoss.w, enzoBoss.h)) {
        enzoBoss.x = newX;
    }
    var newY = enzoBoss.y + my;
    if (!collidesWithMap(game.currentMap, enzoBoss.x, newY, enzoBoss.w, enzoBoss.h)) {
        enzoBoss.y = newY;
    }
    // Clamp to arena
    enzoBoss.x = Math.max(enzoBoss.arenaLeft, Math.min(enzoBoss.x, enzoBoss.arenaRight));
    enzoBoss.y = Math.max(enzoBoss.arenaTop, Math.min(enzoBoss.y, enzoBoss.arenaBottom));
}

/** Damages the boss. Called from weapon hits. */
function hitBoss(weapon) {
    if (!enzoBoss.active || enzoBoss.state === 'defeated') return;
    var dmg = weapon.damage || 1;
    // Stunned boss takes double damage
    if (enzoBoss.state === 'stunned') dmg *= 2;
    enzoBoss.hp -= dmg;
    enzoBoss.flashTimer = 0.2;
    playEnemyHit();

    // Knockback (slight)
    var dx = enzoBoss.x - player.x;
    var dy = enzoBoss.y - player.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
        var kb = 20;
        moveBossWithCollision((dx / dist) * kb, (dy / dist) * kb);
    }

    // Check defeat
    if (enzoBoss.hp <= 0) {
        enzoBoss.hp = 0;
        enzoBoss.state = 'defeated';
        enzoBoss.defeatTimer = 2.0;
        bossProjectiles = [];
        // Kill all summoned enemies
        for (var i = 0; i < enemies.length; i++) {
            enemies[i].state = 'dead';
        }
    }
}

/** Updates boss defeat sequence. */
function updateEnzoBossDefeat(dt) {
    var wasPositive = enzoBoss.defeatTimer > 0;
    enzoBoss.defeatTimer -= dt;
    enzoBoss.animTimer += dt;
    if (wasPositive && enzoBoss.defeatTimer <= 0) {
        // Defeat complete — set flag, open door, spawn recipe, show dialogue
        setFlag('enzo_boss_defeated', true);
        addScore(COIN_REWARDS.ENZO_DEFEAT, enzoBoss.x + enzoBoss.w / 2, enzoBoss.y);
        restoreSauceRoomDoor();
        restoreSewingShopDoor();
        // Spawn recipe #4 in sauce machine room (col 25, row 8 — open floor)
        spawnWorldItem('recipe_4_sauce', 25, 8, 'recipe_4');
        // Restore Enzo NPC for post-boss dialogue
        restoreNPCAfterBoss('enzo');
        enzoBoss.active = false;
        endBossTempo();
        // Victory dialogue
        startDialogue({
            id: 'enzo_boss_victory', name: 'Enzo',
            getLines: function() {
                return {
                    lines: [
                        "*panting* I... I can't believe it...",
                        "You beat me! ME! The great ENZO!",
                        "Fine. The sauce machine room is open. Go get your recipe.",
                        "But don't think this means your Mama's sauce is better than my pizza!",
                        "...it probably is though. Don't tell anyone I said that.",
                    ],
                };
            },
        });
    }
}

/** Updates boss projectiles (pizza dough). */
function updateBossProjectiles(dt) {
    for (var i = bossProjectiles.length - 1; i >= 0; i--) {
        var p = bossProjectiles[i];

        if (p.splat) {
            p.splatTimer -= dt;
            if (p.splatTimer <= 0) {
                bossProjectiles.splice(i, 1);
            }
            continue;
        }

        // Move
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.traveled += Math.sqrt(p.vx * p.vx + p.vy * p.vy) * dt;

        // Wall collision
        var col = Math.floor((p.x + p.w / 2) / CONFIG.TILE_SIZE);
        var row = Math.floor((p.y + p.h / 2) / CONFIG.TILE_SIZE);
        if (getTile(game.currentMap, col, row).solid) {
            p.splat = true;
            p.splatTimer = 0.3;
            continue;
        }

        // Max distance
        if (p.traveled >= p.maxDist) {
            p.splat = true;
            p.splatTimer = 0.3;
            continue;
        }

        // Hit player
        if (rectsOverlap(p.x, p.y, p.w, p.h, player.x, player.y, player.w, player.h)) {
            damagePlayer(1);
            p.splat = true;
            p.splatTimer = 0.3;
        }
    }
}

/** Boss phase transition text overlay. */
var bossPhaseText = { text: '', timer: 0 };

/** Shows a boss phase transition text. */
function showBossPhaseText(text) {
    bossPhaseText.text = text;
    bossPhaseText.timer = 2.0;
}

/** Renders the Enzo boss. */
function renderEnzoBoss(ctx, cameraX, cameraY) {
    if (!enzoBoss.active) return;
    var sx = enzoBoss.x - cameraX;
    var sy = enzoBoss.y - cameraY;
    var t = enzoBoss.animTimer;

    // Defeated — shrink and fade
    if (enzoBoss.state === 'defeated') {
        var defProgress = 1 - (enzoBoss.defeatTimer / 2.0);
        ctx.globalAlpha = Math.max(0, 1 - defProgress);
        var scale = Math.max(0.1, 1 - defProgress * 0.5);
        var ccx = sx + enzoBoss.w / 2;
        var ccy = sy + enzoBoss.h / 2;
        ctx.save();
        ctx.translate(ccx, ccy);
        ctx.scale(scale, scale);
        ctx.translate(-ccx, -ccy);
        drawEnzoBossSprite(ctx, sx, sy, t);
        // Stars circling
        ctx.fillStyle = '#ffeb3b';
        ctx.font = '10px monospace';
        for (var s = 0; s < 4; s++) {
            var angle = t * 3 + s * Math.PI / 2;
            var srx = ccx + Math.cos(angle) * 22;
            var sry = ccy - 14 + Math.sin(angle) * 8;
            ctx.fillText('*', srx, sry);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
        return;
    }

    // Flash on hit
    if (enzoBoss.flashTimer > 0 && Math.floor(t * 16) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }

    // Charge windup — pulsing red glow
    if (enzoBoss.state === 'charge_windup') {
        var pulse = 0.3 + Math.sin(t * 12) * 0.2;
        ctx.fillStyle = 'rgba(255, 0, 0, ' + pulse + ')';
        ctx.beginPath();
        ctx.arc(sx + enzoBoss.w / 2, sy + enzoBoss.h / 2, 24, 0, Math.PI * 2);
        ctx.fill();
        // Draw charge direction indicator
        var dirLen = 40;
        ctx.strokeStyle = 'rgba(255, 100, 0, 0.6)';
        ctx.lineWidth = 3;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(sx + enzoBoss.w / 2, sy + enzoBoss.h / 2);
        ctx.lineTo(sx + enzoBoss.w / 2 + enzoBoss.chargeDir.x * dirLen,
                   sy + enzoBoss.h / 2 + enzoBoss.chargeDir.y * dirLen);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // Charging — motion blur trail
    if (enzoBoss.state === 'charging') {
        ctx.globalAlpha = 0.3;
        drawEnzoBossSprite(ctx, sx - enzoBoss.chargeDir.x * 12, sy - enzoBoss.chargeDir.y * 12, t);
        ctx.globalAlpha = 0.15;
        drawEnzoBossSprite(ctx, sx - enzoBoss.chargeDir.x * 24, sy - enzoBoss.chargeDir.y * 24, t);
        ctx.globalAlpha = 1;
    }

    // Stunned — shake and stars
    var drawX = sx;
    var drawY = sy;
    if (enzoBoss.state === 'stunned') {
        drawX += Math.sin(t * 20) * 2;
        ctx.fillStyle = '#ffeb3b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('* * *', sx + enzoBoss.w / 2, sy - 8 + Math.sin(t * 3) * 2);
    }

    // Draw boss sprite — try image first, then procedural
    if (!SpriteLoader.drawBoss(ctx, 'enzo_boss', drawX, drawY)) {
        drawEnzoBossSprite(ctx, drawX, drawY, t);
    }

    ctx.globalAlpha = 1;

    // Throwing wind-up indicator
    if (enzoBoss.state === 'throwing' && enzoBoss.stateTimer > 0) {
        ctx.fillStyle = 'rgba(255, 200, 100, 0.5)';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx + enzoBoss.w / 2, sy - 10 + Math.sin(t * 8) * 2);
    }

    // Summoning indicator
    if (enzoBoss.state === 'summoning') {
        ctx.fillStyle = 'rgba(200, 100, 255, ' + (0.3 + Math.sin(t * 6) * 0.2) + ')';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CALLING BACKUP!', sx + enzoBoss.w / 2, sy - 14);
    }

    // Boss name label removed for cleaner visuals
}

/** Draws the Enzo boss sprite body. */
function drawEnzoBossSprite(ctx, sx, sy, t) {
    var w = enzoBoss.w;
    var h = enzoBoss.h;
    var cx = sx + w / 2;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(cx, sy + h, 14, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Chef hat (tall, white)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 8, sy - 6, 16, 10);
    ctx.fillRect(cx - 10, sy + 2, 20, 4);
    ctx.fillStyle = '#eeeeee';
    ctx.fillRect(cx - 6, sy - 4, 5, 6);

    // Face (reddish — angry)
    ctx.fillStyle = enzoBoss.state === 'stunned' ? '#ccbb99' : '#e8a878';
    ctx.fillRect(cx - 7, sy + 6, 14, 10);

    // Angry eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 5, sy + 8, 4, 4);
    ctx.fillRect(cx + 1, sy + 8, 4, 4);
    ctx.fillStyle = enzoBoss.state === 'charging' ? '#ff0000' : '#1a0800';
    ctx.fillRect(cx - 4, sy + 9, 2, 2);
    ctx.fillRect(cx + 2, sy + 9, 2, 2);
    // Angry brows
    ctx.fillStyle = '#1a0800';
    ctx.fillRect(cx - 5, sy + 7, 4, 1);
    ctx.fillRect(cx + 1, sy + 7, 4, 1);
    // Inward slant
    ctx.fillRect(cx - 2, sy + 6, 2, 1);
    ctx.fillRect(cx + 1, sy + 6, 2, 1);

    // Mustache
    ctx.fillStyle = '#1a0800';
    ctx.fillRect(cx - 6, sy + 13, 5, 2);
    ctx.fillRect(cx + 1, sy + 13, 5, 2);

    // Body (red chef jacket — larger than NPC)
    ctx.fillStyle = '#d32f2f';
    ctx.fillRect(cx - 10, sy + 16, 20, 10);
    // White apron
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 6, sy + 17, 12, 8);

    // Legs
    var legBob = enzoBoss.state === 'wander' || enzoBoss.state === 'charging' ?
        Math.sin(t * 10) * 2 : 0;
    ctx.fillStyle = '#333333';
    ctx.fillRect(cx - 6, sy + 26, 4, 5 + legBob);
    ctx.fillRect(cx + 2, sy + 26, 4, 5 - legBob);

    // Shoes
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(cx - 7, sy + 30 + legBob, 5, 2);
    ctx.fillRect(cx + 2, sy + 30 - legBob, 5, 2);
}

/** Renders boss projectiles (pizza dough). */
function renderBossProjectiles(ctx, cameraX, cameraY) {
    for (var i = 0; i < bossProjectiles.length; i++) {
        var p = bossProjectiles[i];
        var sx = p.x - cameraX;
        var sy = p.y - cameraY;

        if (p.splat) {
            var progress = 1 - (p.splatTimer / 0.3);
            var alpha = 0.6 * (1 - progress);
            ctx.fillStyle = 'rgba(230, 200, 140, ' + alpha + ')';
            ctx.beginPath();
            ctx.arc(sx + p.w / 2, sy + p.h / 2, 8 + progress * 10, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Pizza dough ball — spinning
            var spin = game.time * 8;
            ctx.save();
            ctx.translate(sx + p.w / 2, sy + p.h / 2);
            ctx.rotate(spin);
            // Dough circle
            ctx.fillStyle = '#e8d5a8';
            ctx.beginPath();
            ctx.arc(0, 0, 7, 0, Math.PI * 2);
            ctx.fill();
            // Sauce spot
            ctx.fillStyle = '#cc3300';
            ctx.beginPath();
            ctx.arc(-2, -1, 3, 0, Math.PI * 2);
            ctx.fill();
            // Cheese drip
            ctx.fillStyle = '#ffcc00';
            ctx.fillRect(1, -2, 3, 2);
            ctx.restore();
        }
    }
}

/** Renders the boss HP bar at the top of the screen. */
function renderBossHPBar(ctx) {
    if (!enzoBoss.active) return;

    var barW = 300;
    var barH = 16;
    var barX = (CONFIG.CANVAS_W - barW) / 2;
    var barY = 40;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 4, barY - 20, barW + 8, barH + 28);
    ctx.strokeStyle = '#d32f2f';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 4, barY - 20, barW + 8, barH + 28);

    // Boss name
    ctx.fillStyle = '#ff4444';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('ENZO — Phase ' + enzoBoss.phase + '/3', CONFIG.CANVAS_W / 2, barY - 6);

    // HP bar background
    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barW, barH);

    // HP bar fill
    var hpPct = enzoBoss.hp / enzoBoss.maxHp;
    var barColor = hpPct > 0.66 ? '#44cc44' : (hpPct > 0.33 ? '#cccc44' : '#cc4444');
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    // HP text
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(enzoBoss.hp + ' / ' + enzoBoss.maxHp, CONFIG.CANVAS_W / 2, barY + 12);

    // Phase text overlay
    if (bossPhaseText.timer > 0) {
        var alpha = Math.min(bossPhaseText.timer / 0.5, 1);
        ctx.fillStyle = 'rgba(255, 100, 50, ' + alpha + ')';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bossPhaseText.text, CONFIG.CANVAS_W / 2, barY + 44);
    }
}

/** Checks if a weapon hit overlaps the Enzo boss. Called from weapon systems. */
function checkBossHit(hbx, hby, hbw, hbh, weapon) {
    if (!enzoBoss.active || enzoBoss.state === 'defeated') return false;
    if (rectsOverlap(hbx, hby, hbw, hbh, enzoBoss.x, enzoBoss.y, enzoBoss.w, enzoBoss.h)) {
        hitBoss(weapon);
        return true;
    }
    return false;
}

/** Resets the boss fight for retry (player died). */
function resetEnzoBoss() {
    enzoBoss.active = false;
    bossProjectiles = [];
    enemies = [];
    restoreNPCAfterBoss('enzo');
    endBossTempo();
}

// ============================================================
// Wedding Planner Boss Fight (Sewing Shop — Stage 7-9)
// ============================================================

/** Wedding Planner boss state. Active during the boss fight in Mama's Sewing Shop. */
var weddingBoss = {
    active: false,
    x: 0, y: 0, w: 32, h: 32,
    facing: 'down',
    hp: 14,
    maxHp: 14,
    speed: 65,
    damage: 1,
    phase: 1,
    // AI state: 'idle' | 'throwing' | 'stress_cloud' | 'dash' | 'stunned' | 'defeated' | 'wander'
    state: 'idle',
    stateTimer: 0,
    throwCooldown: 0,
    cloudCooldown: 0,
    dashCooldown: 0,
    dashDir: { x: 0, y: 0 },
    dashTimer: 0,
    dashWindupTimer: 0,
    stunTimer: 0,
    wanderTarget: { x: 0, y: 0 },
    wanderTimer: 0,
    flashTimer: 0,
    animTimer: 0,
    // Arena: main sewing room (cols 1-12, rows 1-16)
    arenaLeft: 1 * 32,
    arenaRight: 12 * 32,
    arenaTop: 1 * 32,
    arenaBottom: 16 * 32,
    introDone: false,
    defeatTimer: 0,
    summonCount: 0,
    maxSummons: 2,
};

/** Boss projectiles for wedding planner (clipboards). */
var wpProjectiles = [];

/** Stress cloud hazards spawned by wedding planner. */
var stressClouds = [];

/** Phase text overlay for wedding planner boss. */
var wpPhaseText = { text: '', timer: 0 };

/** Initializes the Wedding Planner boss fight. */
function startWeddingBoss() {
    var ts = CONFIG.TILE_SIZE;
    weddingBoss.active = true;
    weddingBoss.hp = 14;
    weddingBoss.maxHp = 14;
    weddingBoss.phase = 1;
    weddingBoss.state = 'idle';
    weddingBoss.stateTimer = 1.5;
    weddingBoss.throwCooldown = 1.0;
    weddingBoss.cloudCooldown = 3.0;
    weddingBoss.dashCooldown = 5.0;
    weddingBoss.stunTimer = 0;
    weddingBoss.flashTimer = 0;
    weddingBoss.animTimer = 0;
    weddingBoss.defeatTimer = 0;
    weddingBoss.introDone = false;
    weddingBoss.summonCount = 0;
    weddingBoss.x = 6 * ts;
    weddingBoss.y = 4 * ts;
    weddingBoss.facing = 'down';
    wpProjectiles = [];
    stressClouds = [];
    enemies = [];

    hideNPCDuringBoss('mama_rosa');

    startDialogue({
        id: 'wedding_planner_intro', name: 'Wedding Planner Bridget',
        getLines: function() {
            return {
                lines: [
                    "STOP RIGHT THERE!",
                    "I am Bridget, the WEDDING PLANNER! This wedding is MY production!",
                    "You think you can just waltz in and save the day with some SAUCE?!",
                    "The schedule is RUINED! The flowers are WRONG! And now I have to deal with CHILDREN?!",
                    "I'll show you what STRESS looks like!",
                ],
                onComplete: function() { weddingBoss.introDone = true; startBossTempo(); },
            };
        },
    });
}

/** Updates the Wedding Planner boss each frame. */
function updateWeddingBoss(dt) {
    if (!weddingBoss.active) return;

    // Defeat sequence
    if (weddingBoss.state === 'defeated') {
        updateWeddingBossDefeat(dt);
        return;
    }

    // Wait for intro dialogue
    if (!weddingBoss.introDone) return;

    weddingBoss.animTimer += dt;
    if (weddingBoss.flashTimer > 0) weddingBoss.flashTimer -= dt;
    if (wpPhaseText.timer > 0) wpPhaseText.timer -= dt;

    // Update projectiles + stress clouds
    updateWPProjectiles(dt);
    updateStressClouds(dt);

    // Cooldowns
    if (weddingBoss.throwCooldown > 0) weddingBoss.throwCooldown -= dt;
    if (weddingBoss.cloudCooldown > 0) weddingBoss.cloudCooldown -= dt;
    if (weddingBoss.dashCooldown > 0) weddingBoss.dashCooldown -= dt;

    // Phase transitions
    var hpPct = weddingBoss.hp / weddingBoss.maxHp;
    if (weddingBoss.phase === 1 && hpPct <= 0.6) {
        weddingBoss.phase = 2;
        wpPhaseText.text = 'BRIDGET IS PANICKING!';
        wpPhaseText.timer = 2.0;
    }
    if (weddingBoss.phase === 2 && hpPct <= 0.3) {
        weddingBoss.phase = 3;
        wpPhaseText.text = 'BRIDGET HAS LOST IT!';
        wpPhaseText.timer = 2.0;
    }

    // Contact damage
    if (weddingBoss.state !== 'stunned') {
        if (rectsOverlap(player.x, player.y, player.w, player.h,
            weddingBoss.x, weddingBoss.y, weddingBoss.w, weddingBoss.h)) {
            damagePlayer(1);
        }
    }

    // State machine
    switch (weddingBoss.state) {
        case 'idle': updateWBIdle(dt); break;
        case 'wander': updateWBWander(dt); break;
        case 'throwing': updateWBThrowing(dt); break;
        case 'stress_cloud': updateWBStressCloud(dt); break;
        case 'dash': updateWBDash(dt); break;
        case 'stunned': updateWBStunned(dt); break;
    }

    // Face player (except during dash)
    if (weddingBoss.state !== 'dash') {
        var dx = player.x - weddingBoss.x;
        var dy = player.y - weddingBoss.y;
        if (Math.abs(dx) > Math.abs(dy)) {
            weddingBoss.facing = dx > 0 ? 'right' : 'left';
        } else {
            weddingBoss.facing = dy > 0 ? 'down' : 'up';
        }
    }
}

/** Idle state — pick next attack. */
function updateWBIdle(dt) {
    weddingBoss.stateTimer -= dt;
    if (weddingBoss.stateTimer > 0) return;

    var actions = [];
    if (weddingBoss.throwCooldown <= 0) actions.push('throw');
    if (weddingBoss.cloudCooldown <= 0 && weddingBoss.phase >= 2) actions.push('cloud');
    if (weddingBoss.dashCooldown <= 0 && weddingBoss.phase >= 3) actions.push('dash');

    if (actions.length === 0) {
        weddingBoss.state = 'wander';
        weddingBoss.wanderTimer = 1.5;
        pickWBWanderTarget();
        return;
    }

    var pick = actions[Math.floor(Math.random() * actions.length)];
    switch (pick) {
        case 'throw':
            weddingBoss.state = 'throwing';
            weddingBoss.stateTimer = 0.4;
            break;
        case 'cloud':
            weddingBoss.state = 'stress_cloud';
            weddingBoss.stateTimer = 0.6;
            break;
        case 'dash':
            weddingBoss.state = 'dash';
            weddingBoss.dashWindupTimer = 0.6;
            weddingBoss.dashTimer = 0;
            // Lock direction toward player
            var ddx = (player.x + player.w / 2) - (weddingBoss.x + weddingBoss.w / 2);
            var ddy = (player.y + player.h / 2) - (weddingBoss.y + weddingBoss.h / 2);
            var ddist = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
            weddingBoss.dashDir = { x: ddx / ddist, y: ddy / ddist };
            break;
    }
}

/** Wander toward a point near the player. */
function updateWBWander(dt) {
    weddingBoss.wanderTimer -= dt;
    var dx = weddingBoss.wanderTarget.x - weddingBoss.x;
    var dy = weddingBoss.wanderTarget.y - weddingBoss.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 4 || weddingBoss.wanderTimer <= 0) {
        weddingBoss.state = 'idle';
        weddingBoss.stateTimer = 0.4;
        return;
    }
    var nx = dx / dist;
    var ny = dy / dist;
    moveWBWithCollision(nx * weddingBoss.speed * dt, ny * weddingBoss.speed * dt);
}

/** Pick a wander target near the player. */
function pickWBWanderTarget() {
    var tx = player.x + (Math.random() - 0.5) * 128;
    var ty = player.y + (Math.random() - 0.5) * 128;
    tx = Math.max(weddingBoss.arenaLeft + 16, Math.min(tx, weddingBoss.arenaRight - 16));
    ty = Math.max(weddingBoss.arenaTop + 16, Math.min(ty, weddingBoss.arenaBottom - 16));
    weddingBoss.wanderTarget = { x: tx, y: ty };
}

/** Throwing state — fire clipboards at player. */
function updateWBThrowing(dt) {
    weddingBoss.stateTimer -= dt;
    if (weddingBoss.stateTimer <= 0) {
        fireWPProjectile(0);
        if (weddingBoss.phase >= 2) {
            fireWPProjectile(0.3);
            fireWPProjectile(-0.3);
        }
        weddingBoss.throwCooldown = weddingBoss.phase >= 3 ? 1.5 : 2.2;
        weddingBoss.state = 'idle';
        weddingBoss.stateTimer = 0.6;
    }
}

/** Stress cloud state — spawn hazard cloud at player position. */
function updateWBStressCloud(dt) {
    weddingBoss.stateTimer -= dt;
    if (weddingBoss.stateTimer <= 0) {
        // Spawn stress cloud at player's current position
        stressClouds.push({
            x: player.x + player.w / 2,
            y: player.y + player.h / 2,
            radius: 48,
            lifetime: 4.0,
            timer: 4.0,
            damageInterval: 0.8,
            damageCooldown: 0,
        });
        if (weddingBoss.phase >= 3) {
            // Spawn extra cloud offset
            stressClouds.push({
                x: player.x + player.w / 2 + (Math.random() - 0.5) * 80,
                y: player.y + player.h / 2 + (Math.random() - 0.5) * 80,
                radius: 40,
                lifetime: 3.0,
                timer: 3.0,
                damageInterval: 0.8,
                damageCooldown: 0,
            });
        }
        weddingBoss.cloudCooldown = weddingBoss.phase >= 3 ? 4.0 : 6.0;
        weddingBoss.state = 'idle';
        weddingBoss.stateTimer = 0.8;
    }
}

/** Dash attack (phase 3) — windup then rush. */
function updateWBDash(dt) {
    if (weddingBoss.dashWindupTimer > 0) {
        weddingBoss.dashWindupTimer -= dt;
        return;
    }
    weddingBoss.dashTimer += dt;
    if (weddingBoss.dashTimer >= 0.5) {
        weddingBoss.state = 'idle';
        weddingBoss.stateTimer = 0.8;
        weddingBoss.dashCooldown = 5.0;
        return;
    }
    // Move fast in locked direction
    var spd = 200 * dt;
    var mx = weddingBoss.dashDir.x * spd;
    var my = weddingBoss.dashDir.y * spd;
    var hitWall = moveWBWithCollision(mx, my);
    // Wall crash = stun
    if (hitWall) {
        weddingBoss.state = 'stunned';
        weddingBoss.stunTimer = 1.5;
        weddingBoss.dashCooldown = 5.0;
    }
    // Contact damage during dash
    if (rectsOverlap(player.x, player.y, player.w, player.h,
        weddingBoss.x, weddingBoss.y, weddingBoss.w, weddingBoss.h)) {
        damagePlayer(2);
    }
}

/** Stunned state — vulnerable, takes double damage. */
function updateWBStunned(dt) {
    weddingBoss.stunTimer -= dt;
    if (weddingBoss.stunTimer <= 0) {
        weddingBoss.state = 'idle';
        weddingBoss.stateTimer = 0.5;
    }
}

/** Moves the wedding boss with collision checking. Returns true if blocked by a wall. */
function moveWBWithCollision(mx, my) {
    var blocked = false;
    if (mx !== 0) {
        var nx = weddingBoss.x + mx;
        if (!collidesWithMap(game.currentMap, nx, weddingBoss.y, weddingBoss.w, weddingBoss.h)) {
            weddingBoss.x = nx;
        } else {
            blocked = true;
        }
    }
    if (my !== 0) {
        var ny = weddingBoss.y + my;
        if (!collidesWithMap(game.currentMap, weddingBoss.x, ny, weddingBoss.w, weddingBoss.h)) {
            weddingBoss.y = ny;
        } else {
            blocked = true;
        }
    }
    // Clamp to arena
    var preClampX = weddingBoss.x, preClampY = weddingBoss.y;
    weddingBoss.x = Math.max(weddingBoss.arenaLeft, Math.min(weddingBoss.x, weddingBoss.arenaRight - weddingBoss.w));
    weddingBoss.y = Math.max(weddingBoss.arenaTop, Math.min(weddingBoss.y, weddingBoss.arenaBottom - weddingBoss.h));
    if (weddingBoss.x !== preClampX || weddingBoss.y !== preClampY) blocked = true;
    return blocked;
}

/** Fire a clipboard projectile at the player. */
function fireWPProjectile(angleOffset) {
    var bx = weddingBoss.x + weddingBoss.w / 2;
    var by = weddingBoss.y + weddingBoss.h / 2;
    var px = player.x + player.w / 2;
    var py = player.y + player.h / 2;
    var angle = Math.atan2(py - by, px - bx) + (angleOffset || 0);
    var spd = 160;
    wpProjectiles.push({
        x: bx - 6, y: by - 6, w: 12, h: 12,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        traveled: 0, maxDist: 280,
        splat: false, splatTimer: 0,
    });
    playTomatoSplat();
}

/** Update clipboard projectiles. */
function updateWPProjectiles(dt) {
    for (var i = wpProjectiles.length - 1; i >= 0; i--) {
        var p = wpProjectiles[i];
        if (p.splat) {
            p.splatTimer -= dt;
            if (p.splatTimer <= 0) wpProjectiles.splice(i, 1);
            continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        var spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        p.traveled += spd * dt;
        // Wall collision
        var tc = Math.floor((p.x + p.w / 2) / CONFIG.TILE_SIZE);
        var tr = Math.floor((p.y + p.h / 2) / CONFIG.TILE_SIZE);
        var tile = getTile(game.currentMap, tc, tr);
        if (tile.solid) { p.splat = true; p.splatTimer = 0.3; continue; }
        if (p.traveled >= p.maxDist) { p.splat = true; p.splatTimer = 0.3; continue; }
        // Player hit
        if (rectsOverlap(p.x, p.y, p.w, p.h, player.x, player.y, player.w, player.h)) {
            damagePlayer(1);
            p.splat = true; p.splatTimer = 0.3;
        }
    }
}

/** Update stress clouds — damage player standing in them. */
function updateStressClouds(dt) {
    for (var i = stressClouds.length - 1; i >= 0; i--) {
        var c = stressClouds[i];
        c.timer -= dt;
        if (c.timer <= 0) { stressClouds.splice(i, 1); continue; }
        c.damageCooldown -= dt;
        // Check player overlap
        var dx = (player.x + player.w / 2) - c.x;
        var dy = (player.y + player.h / 2) - c.y;
        if (dx * dx + dy * dy <= c.radius * c.radius && c.damageCooldown <= 0) {
            damagePlayer(1);
            c.damageCooldown = c.damageInterval;
        }
    }
}

/** Deals damage to the wedding planner boss. */
function hitWeddingBoss(weapon) {
    if (!weddingBoss.active || weddingBoss.state === 'defeated') return;
    var dmg = weapon.damage || 1;
    if (weddingBoss.state === 'stunned') dmg *= 2;
    weddingBoss.hp -= dmg;
    weddingBoss.flashTimer = 0.2;
    playEnemyHit();
    // Knockback
    var dx = weddingBoss.x - player.x;
    var dy = weddingBoss.y - player.y;
    var dist = Math.sqrt(dx * dx + dy * dy) || 1;
    moveWBWithCollision((dx / dist) * 20, (dy / dist) * 20);
    if (weddingBoss.hp <= 0) {
        weddingBoss.hp = 0;
        weddingBoss.state = 'defeated';
        weddingBoss.defeatTimer = 2.0;
        wpProjectiles = [];
        stressClouds = [];
        for (var i = 0; i < enemies.length; i++) enemies[i].state = 'dead';
    }
}

/** Checks if a weapon hitbox overlaps the wedding planner boss. */
function checkWeddingBossHit(hbx, hby, hbw, hbh, weapon) {
    if (!weddingBoss.active || weddingBoss.state === 'defeated') return false;
    if (rectsOverlap(hbx, hby, hbw, hbh, weddingBoss.x, weddingBoss.y, weddingBoss.w, weddingBoss.h)) {
        hitWeddingBoss(weapon);
        return true;
    }
    return false;
}

/** Defeat sequence — fade, then spawn finale. */
function updateWeddingBossDefeat(dt) {
    weddingBoss.defeatTimer -= dt;
    if (weddingBoss.defeatTimer <= 0 && weddingBoss.active) {
        setFlag('wedding_boss_defeated', true);
        addScore(COIN_REWARDS.WEDDING_DEFEAT, weddingBoss.x + weddingBoss.w / 2, weddingBoss.y);
        weddingBoss.active = false;
        endBossTempo();
        restoreNPCAfterBoss('mama_rosa');

        startDialogue({
            id: 'wedding_planner_defeated', name: 'Bridget',
            getLines: function() {
                return {
                    lines: [
                        "*collapses onto a mannequin*",
                        "I... I just wanted everything to be PERFECT...",
                        "Maybe... maybe I was the stress all along.",
                        "Go. Make your sauce. Save the wedding. I need a NAP.",
                    ],
                    onComplete: function() {
                        // Check if all 5 recipe fragments collected → trigger finale
                        checkAllRecipesAndStartFinale();
                    },
                };
            },
        });
    }
}

/** Resets wedding boss for retry. */
function resetWeddingBoss() {
    weddingBoss.active = false;
    wpProjectiles = [];
    stressClouds = [];
    enemies = [];
    restoreNPCAfterBoss('mama_rosa');
    endBossTempo();
}

/** Checks if all 5 recipe fragments are found. If so, starts the finale. */
function checkAllRecipesAndStartFinale() {
    if (getFlag('recipe_1_found') && getFlag('recipe_2_found') &&
        getFlag('recipe_3_found') && getFlag('recipe_4_found') &&
        getFlag('recipe_5_found')) {
        // All recipes collected — start the finale!
        setTimeout(function() { startFinale(); }, 1000);
    } else {
        // Not all found — hint to player
        setTimeout(function() {
            startDialogue({
                id: 'mama_post_boss', name: 'Mama Rosa',
                getLines: function() {
                    return { lines: [
                        "Well done! But we still need all five recipe fragments.",
                        "Keep searching, ragazza. The wedding is counting on you!",
                    ]};
                },
            });
        }, 500);
    }
}

/** Renders the Wedding Planner boss. */
function renderWeddingBoss(ctx, cameraX, cameraY) {
    if (!weddingBoss.active) return;

    var sx = weddingBoss.x - cameraX;
    var sy = weddingBoss.y - cameraY;
    var t = weddingBoss.animTimer;

    // Defeated — shrink + fade + circling stars
    if (weddingBoss.state === 'defeated') {
        var progress = 1 - (weddingBoss.defeatTimer / 2.0);
        var scale = Math.max(0.01, 1 - progress);
        var alpha = Math.max(0, 1 - progress);
        ctx.globalAlpha = alpha;
        var cx = sx + weddingBoss.w / 2;
        var cy = sy + weddingBoss.h / 2;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.scale(scale, scale);
        drawWeddingBossSprite(ctx, -16, -16, t);
        ctx.restore();
        // Circling stars
        for (var s = 0; s < 4; s++) {
            var a = t * 3 + s * Math.PI / 2;
            var str = 20 * scale;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(cx + Math.cos(a) * str, cy - 12 + Math.sin(a) * str * 0.5, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
        return;
    }

    // Flash on hit
    if (weddingBoss.flashTimer > 0 && Math.floor(t * 20) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }

    // Dash windup glow
    if (weddingBoss.state === 'dash' && weddingBoss.dashWindupTimer > 0) {
        var pulse = 0.3 + Math.sin(t * 15) * 0.2;
        ctx.fillStyle = 'rgba(200, 50, 200, ' + pulse + ')';
        ctx.beginPath();
        ctx.arc(sx + 16, sy + 16, 24, 0, Math.PI * 2);
        ctx.fill();
    }

    // Stunned — shake
    if (weddingBoss.state === 'stunned') {
        sx += Math.sin(t * 30) * 2;
    }

    // Draw boss sprite — try image first, then procedural
    if (!SpriteLoader.drawBoss(ctx, 'bridget', sx, sy)) {
        drawWeddingBossSprite(ctx, sx, sy, t);
    }
    ctx.globalAlpha = 1;

    // Stunned stars
    if (weddingBoss.state === 'stunned') {
        for (var s = 0; s < 3; s++) {
            var a = t * 4 + s * Math.PI * 2 / 3;
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(sx + 16 + Math.cos(a) * 14, sy - 6 + Math.sin(a) * 5, 2.5, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Throwing indicator
    if (weddingBoss.state === 'throwing' && weddingBoss.stateTimer > 0.2) {
        ctx.fillStyle = '#ffcc00';
        ctx.font = 'bold 14px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('!', sx + 16, sy - 8);
    }

    // Stress cloud cast indicator
    if (weddingBoss.state === 'stress_cloud') {
        var cPulse = 0.5 + Math.sin(t * 8) * 0.3;
        ctx.fillStyle = 'rgba(180, 80, 200, ' + cPulse + ')';
        ctx.font = 'bold 10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('STRESS!', sx + 16, sy - 10);
    }
}

/** Draws the wedding planner boss sprite procedurally. */
function drawWeddingBossSprite(ctx, sx, sy, t) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx + 16, sy + 30, 12, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — sharp purple blazer
    ctx.fillStyle = '#7b2d8e';
    ctx.fillRect(sx + 6, sy + 14, 20, 14);

    // Clipboard in hand
    ctx.fillStyle = '#d4a373';
    ctx.fillRect(sx + 24, sy + 16, 6, 8);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 25, sy + 17, 4, 6);
    ctx.fillStyle = '#333';
    ctx.fillRect(sx + 25, sy + 18, 3, 1);
    ctx.fillRect(sx + 25, sy + 20, 3, 1);

    // Head
    var faceColor = weddingBoss.state === 'stunned' ? '#ccbb99' : '#f0c8a0';
    ctx.fillStyle = faceColor;
    ctx.beginPath();
    ctx.ellipse(sx + 16, sy + 10, 9, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair — tight pulled-back red/auburn bun
    ctx.fillStyle = '#8b2500';
    ctx.fillRect(sx + 7, sy + 1, 18, 8);
    ctx.beginPath();
    ctx.arc(sx + 16, sy + 2, 7, 0, Math.PI * 2);
    ctx.fill();
    // Bun on top
    ctx.fillStyle = '#a03000';
    ctx.beginPath();
    ctx.arc(sx + 16, sy, 5, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — wide, stressed
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(sx + 10, sy + 8, 5, 4);
    ctx.fillRect(sx + 17, sy + 8, 5, 4);
    ctx.fillStyle = weddingBoss.state === 'dash' ? '#ff0000' : '#2a4080';
    ctx.fillRect(sx + 12, sy + 9, 2, 2);
    ctx.fillRect(sx + 19, sy + 9, 2, 2);
    // Angry eyebrows (stressed, upward inward)
    ctx.fillStyle = '#4a2010';
    ctx.fillRect(sx + 10, sy + 6, 5, 2);
    ctx.fillRect(sx + 17, sy + 6, 5, 2);

    // Grimace
    ctx.strokeStyle = '#c06050';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 12, sy + 16);
    ctx.lineTo(sx + 14, sy + 15);
    ctx.lineTo(sx + 18, sy + 15);
    ctx.lineTo(sx + 20, sy + 16);
    ctx.stroke();

    // Legs — walking animation
    var legPhase = Math.sin(t * 8) * 3;
    ctx.fillStyle = '#333333';
    ctx.fillRect(sx + 9, sy + 28, 4, 4 + legPhase);
    ctx.fillRect(sx + 19, sy + 28, 4, 4 - legPhase);

    // Heels
    ctx.fillStyle = '#cc3366';
    ctx.fillRect(sx + 9, sy + 31 + Math.max(0, legPhase), 4, 2);
    ctx.fillRect(sx + 19, sy + 31 + Math.max(0, -legPhase), 4, 2);
}

/** Renders clipboard projectiles. */
function renderWPProjectiles(ctx, cameraX, cameraY) {
    for (var i = 0; i < wpProjectiles.length; i++) {
        var p = wpProjectiles[i];
        var sx = p.x - cameraX;
        var sy = p.y - cameraY;
        if (p.splat) {
            var progress = 1 - (p.splatTimer / 0.3);
            var radius = 6 + progress * 8;
            ctx.fillStyle = 'rgba(200, 180, 150, ' + (0.5 * (1 - progress)) + ')';
            ctx.beginPath();
            ctx.arc(sx + 6, sy + 6, radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Spinning clipboard
            ctx.save();
            ctx.translate(sx + 6, sy + 6);
            ctx.rotate(game.time * 6);
            ctx.fillStyle = '#d4a373';
            ctx.fillRect(-5, -6, 10, 12);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-4, -5, 8, 10);
            ctx.fillStyle = '#333';
            ctx.fillRect(-3, -3, 5, 1);
            ctx.fillRect(-3, 0, 5, 1);
            ctx.restore();
        }
    }
}

/** Renders stress clouds. */
function renderStressClouds(ctx, cameraX, cameraY) {
    for (var i = 0; i < stressClouds.length; i++) {
        var c = stressClouds[i];
        var sx = c.x - cameraX;
        var sy = c.y - cameraY;
        var alphaMult = Math.min(c.timer / 0.5, 1); // fade out in last 0.5s
        var pulse = 0.2 + Math.sin(game.time * 4 + i) * 0.1;
        // Purple-ish stress cloud
        ctx.fillStyle = 'rgba(160, 60, 180, ' + (pulse * alphaMult) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, c.radius, 0, Math.PI * 2);
        ctx.fill();
        // Inner swirls
        for (var s = 0; s < 3; s++) {
            var a = game.time * 2 + s * Math.PI * 2 / 3;
            var sr = c.radius * 0.6;
            ctx.fillStyle = 'rgba(200, 100, 220, ' + (0.3 * alphaMult) + ')';
            ctx.beginPath();
            ctx.arc(sx + Math.cos(a) * sr * 0.4, sy + Math.sin(a) * sr * 0.4, sr * 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        // "STRESS" text label
        if (alphaMult > 0.5) {
            ctx.fillStyle = 'rgba(255, 200, 255, ' + (0.4 * alphaMult) + ')';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('~stress~', sx, sy - c.radius - 4);
        }
    }
}

/** Renders the wedding boss HP bar at the top of the screen. */
function renderWeddingBossHPBar(ctx) {
    if (!weddingBoss.active) return;

    var barW = 300;
    var barH = 16;
    var barX = (CONFIG.CANVAS_W - barW) / 2;
    var barY = 40;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(barX - 4, barY - 20, barW + 8, barH + 28);
    ctx.strokeStyle = '#9c27b0';
    ctx.lineWidth = 2;
    ctx.strokeRect(barX - 4, barY - 20, barW + 8, barH + 28);

    ctx.fillStyle = '#cc44cc';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BRIDGET — Phase ' + weddingBoss.phase + '/3', CONFIG.CANVAS_W / 2, barY - 6);

    ctx.fillStyle = '#333333';
    ctx.fillRect(barX, barY, barW, barH);

    var hpPct = weddingBoss.hp / weddingBoss.maxHp;
    var barColor = hpPct > 0.6 ? '#44cc44' : (hpPct > 0.3 ? '#cccc44' : '#cc4444');
    ctx.fillStyle = barColor;
    ctx.fillRect(barX, barY, barW * hpPct, barH);

    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(weddingBoss.hp + ' / ' + weddingBoss.maxHp, CONFIG.CANVAS_W / 2, barY + 12);

    if (wpPhaseText.timer > 0) {
        var alpha = Math.min(wpPhaseText.timer / 0.5, 1);
        ctx.fillStyle = 'rgba(200, 50, 200, ' + alpha + ')';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(wpPhaseText.text, CONFIG.CANVAS_W / 2, barY + 44);
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
/** Renders a single power-up pickup with glow and bobbing. */
function renderSinglePowerup(ctx, cameraX, cameraY, pu) {
    if (pu.collected) return;
    var def = POWERUPS[pu.type];
    if (!def) return;
    var ts = CONFIG.TILE_SIZE;

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

        // Power-up sprite — try PixelLab first, then procedural
        var puDrawn = SpriteLoader.drawItemById(ctx, pu.type, cx - 12, cy - 12, 24);
        var sprite = !puDrawn ? SPRITES.powerups[pu.type] : null;
        if (puDrawn) {
            // Already drawn
        } else if (sprite) {
            ctx.drawImage(sprite, cx - 10, cy - 10);
        } else {
            // Fallback to colored square
            ctx.fillStyle = def.color;
            ctx.fillRect(cx - 8, cy - 8, 16, 16);
        }

        // Power-up name label removed for cleaner visuals
}

function renderPowerups(ctx, cameraX, cameraY) {
    for (var i = 0; i < worldPowerups.length; i++) {
        renderSinglePowerup(ctx, cameraX, cameraY, worldPowerups[i]);
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

    // Icon — try PixelLab sprite first, then colored square fallback
    if (!SpriteLoader.drawItemById(ctx, activeBuff.type, hx + 2, hy + 3, 20)) {
        ctx.fillStyle = def.color;
        ctx.fillRect(hx + 3, hy + 4, 18, 18);
        ctx.fillStyle = '#000';
        ctx.font = 'bold 7px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(def.icon, hx + 12, hy + 16);
    }

    // Buff name label removed for cleaner visuals

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

/** Renders a soft colored halo behind the player when a buff is active. */
function renderPlayerGlow(ctx, cameraX, cameraY) {
    if (!activeBuff.type || activeBuff.timer <= 0) return;
    var def = POWERUPS[activeBuff.type];
    if (!def) return;

    var sx = player.x + player.w / 2 - cameraX;
    var sy = player.y + player.h / 2 - cameraY;
    var pulse = 0.15 + Math.sin(game.time * 3) * 0.07;
    var radius = 24 + Math.sin(game.time * 2.5) * 3;

    // Radial gradient glow
    var grad = ctx.createRadialGradient(sx, sy, 4, sx, sy, radius);
    grad.addColorStop(0, def.color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.shadowColor = def.color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(sx, sy, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
}
