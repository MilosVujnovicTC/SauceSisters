// ============================================================
// js/weapons.js — Weapon logic, equip, hitboxes, effects
// ============================================================

// ============================================================
// Weapon definitions
// ============================================================

/** Weapon type data: damage, range, cooldown, type. */
const WEAPONS = {
    spatula: {
        id: 'spatula',
        name: 'Spatula',
        type: 'melee',     // 'melee' | 'ranged' | 'trap' | 'area'
        damage: 1,
        range: 40,          // pixels — hitbox extends this far from player center
        hitboxW: 28,        // hitbox width perpendicular to facing
        cooldown: 0.4,      // seconds between attacks
        knockback: 60,      // pixels — how far target is pushed
        color: '#b0b0b0',
    },
    tomato: {
        id: 'tomato',
        name: 'Tomato',
        type: 'ranged',
        damage: 1,
        range: 200,         // pixels — projectile travel distance
        speed: 250,         // pixels/sec
        cooldown: 0.6,
        effect: 'slow',
        effectDuration: 3,
        color: '#e53935',
        consumable: true,
        ammo: 3,            // uses per pickup
    },
    flour: {
        id: 'flour',
        name: 'Bag of Flour',
        type: 'area',
        damage: 0,
        range: 64,          // 2-tile radius
        cooldown: 1.0,
        effect: 'stun',
        effectDuration: 3,
        color: '#f5f5dc',
        consumable: true,
        ammo: 3,
    },
    banana: {
        id: 'banana',
        name: 'Banana',
        type: 'trap',
        damage: 0,
        cooldown: 0.5,
        effect: 'trip',
        effectDuration: 2,
        color: '#ffd600',
        consumable: true,
        ammo: 2,
    },
    dirty_sock: {
        id: 'dirty_sock',
        name: 'Dirty Sock',
        type: 'ranged',
        damage: 0,
        range: 120,
        speed: 180,
        cooldown: 0.8,
        effect: 'fear',
        effectDuration: 3,
        color: '#8d6e63',
        consumable: true,
        ammo: 2,
    },
};

// ============================================================
// Weapon equip state
// ============================================================

/** Current weapon state. */
const weaponState = {
    equipped: null,      // weapon id string or null (no weapon equipped)
    cooldownTimer: 0,    // remaining cooldown seconds
    attacking: false,    // true during attack animation
    attackTimer: 0,      // remaining attack animation time
    attackDuration: 0.15,// seconds for attack swing visual
    // Hitbox for current attack (set during attack)
    hitbox: { x: 0, y: 0, w: 0, h: 0, active: false },
    // Ammo tracking for consumable weapons: { weaponId: remainingUses }
    ammo: {},
};

/** Returns the WEAPONS definition for the currently equipped weapon, or null. */
function getEquippedWeapon() {
    if (!weaponState.equipped) return null;
    return WEAPONS[weaponState.equipped] || null;
}

/** Equips a weapon by item id. Only equips if the item is in inventory and is a weapon. */
function equipWeapon(itemId) {
    if (!WEAPONS[itemId]) return;
    if (!hasItem(itemId)) return;
    weaponState.equipped = itemId;
    // Initialize ammo if not already tracked
    var weapon = WEAPONS[itemId];
    if (weapon.consumable && weaponState.ammo[itemId] === undefined) {
        weaponState.ammo[itemId] = weapon.ammo;
    }
}

/** Unequips the current weapon. */
function unequipWeapon() {
    weaponState.equipped = null;
}

/** Cycles to the next weapon in inventory. Skips non-weapon items. */
function cycleWeapon(direction) {
    var weaponItems = [];
    for (var i = 0; i < inventory.length; i++) {
        if (WEAPONS[inventory[i]]) {
            weaponItems.push(inventory[i]);
        }
    }
    if (weaponItems.length === 0) {
        weaponState.equipped = null;
        return;
    }
    if (!weaponState.equipped) {
        weaponState.equipped = weaponItems[0];
        return;
    }
    var idx = weaponItems.indexOf(weaponState.equipped);
    if (idx === -1) {
        weaponState.equipped = weaponItems[0];
        return;
    }
    idx = (idx + direction + weaponItems.length) % weaponItems.length;
    weaponState.equipped = weaponItems[idx];
}

// ============================================================
// Attack system
// ============================================================

/** Triggers an attack with the currently equipped weapon. */
function tryAttack() {
    if (!weaponState.equipped) return false;
    if (weaponState.cooldownTimer > 0) return false;
    if (weaponState.attacking) return false;

    var weapon = getEquippedWeapon();
    if (!weapon) return false;

    // Consume ammo for consumable weapons
    if (weapon.consumable) {
        if (weaponState.ammo[weapon.id] === undefined) {
            weaponState.ammo[weapon.id] = weapon.ammo;
        }
        weaponState.ammo[weapon.id]--;
        if (weaponState.ammo[weapon.id] <= 0) {
            // Out of ammo — remove from inventory and cycle to next weapon
            removeFromInventory(weapon.id);
            delete weaponState.ammo[weapon.id];
            cycleWeapon(1);
            if (weaponState.equipped === weapon.id) weaponState.equipped = null;
        }
    }

    if (weapon.type === 'melee') {
        startMeleeAttack(weapon);
        return true;
    }
    if (weapon.type === 'ranged') {
        startRangedAttack(weapon);
        return true;
    }
    if (weapon.type === 'trap') {
        placeTrap(weapon);
        return true;
    }
    if (weapon.type === 'area') {
        startAreaAttack(weapon);
        return true;
    }
    return false;
}

/** Starts a melee attack swing. */
function startMeleeAttack(weapon) {
    weaponState.attacking = true;
    weaponState.attackTimer = weaponState.attackDuration;
    weaponState.cooldownTimer = weapon.cooldown * getBuffCooldownMult();

    // Calculate hitbox based on player facing direction
    var ts = CONFIG.TILE_SIZE;
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var hbW = weapon.hitboxW;
    var hbH = weapon.range;

    var hb = weaponState.hitbox;
    hb.active = true;

    switch (player.facing) {
        case 'up':
            hb.x = pcx - hbW / 2;
            hb.y = pcy - hbH;
            hb.w = hbW;
            hb.h = hbH;
            break;
        case 'down':
            hb.x = pcx - hbW / 2;
            hb.y = pcy;
            hb.w = hbW;
            hb.h = hbH;
            break;
        case 'left':
            hb.x = pcx - hbH;
            hb.y = pcy - hbW / 2;
            hb.w = hbH;
            hb.h = hbW;
            break;
        case 'right':
            hb.x = pcx;
            hb.y = pcy - hbW / 2;
            hb.w = hbH;
            hb.h = hbW;
            break;
    }

    // Check hitbox against enemies (library cat for now)
    checkMeleeHits(weapon);

    // Play attack SFX
    playWeaponSwing();
}

/** Checks if the melee hitbox overlaps any enemies. */
function checkMeleeHits(weapon) {
    var hb = weaponState.hitbox;

    // Check library cat
    if (libraryBroom.active && libraryBroom.state !== 'stunned' && libraryBroom.state !== 'defeated') {
        if (rectsOverlap(hb.x, hb.y, hb.w, hb.h,
            libraryBroom.x, libraryBroom.y, libraryBroom.w, libraryBroom.h)) {
            libraryBroom.state = 'stunned';
            libraryBroom.stunTimer = libraryBroom.stunDuration;
            libraryBroom.stunCount++;
        }
    }

    // Check generic enemies
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (e.state === 'dead') continue;
        if (rectsOverlap(hb.x, hb.y, hb.w, hb.h, e.x, e.y, e.w, e.h)) {
            hitEnemy(e, weapon);
        }
    }

    // Check Enzo boss
    checkBossHit(hb.x, hb.y, hb.w, hb.h, weapon);
}

/** Returns true if two rectangles overlap. */
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

// ============================================================
// Projectile system (tomato, dirty sock)
// ============================================================

/** Active projectiles in the world. */
var projectiles = [];

/** Fires a projectile from the player in facing direction. */
function startRangedAttack(weapon) {
    weaponState.cooldownTimer = weapon.cooldown * getBuffCooldownMult();
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var vx = 0, vy = 0;
    switch (player.facing) {
        case 'up':    vy = -weapon.speed; break;
        case 'down':  vy = weapon.speed; break;
        case 'left':  vx = -weapon.speed; break;
        case 'right': vx = weapon.speed; break;
    }
    projectiles.push({
        x: pcx - 4, y: pcy - 4, w: 8, h: 8,
        vx: vx, vy: vy,
        weaponId: weapon.id,
        color: weapon.color,
        damage: weapon.damage,
        effect: weapon.effect || null,
        effectDuration: weapon.effectDuration || 0,
        maxDist: weapon.range,
        traveled: 0,
        splat: false,     // true when hit something — plays splat animation
        splatTimer: 0,
    });
    playTomatoSplat();
}

/** Updates all active projectiles. */
function updateProjectiles(dt) {
    for (var i = projectiles.length - 1; i >= 0; i--) {
        var p = projectiles[i];

        // Splat animation
        if (p.splat) {
            p.splatTimer -= dt;
            if (p.splatTimer <= 0) {
                projectiles.splice(i, 1);
            }
            continue;
        }

        // Move
        var dx = p.vx * dt;
        var dy = p.vy * dt;
        p.x += dx;
        p.y += dy;
        p.traveled += Math.sqrt(dx * dx + dy * dy);

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

        // Enemy hit check — library cat
        if (libraryBroom.active && libraryBroom.state !== 'stunned' && libraryBroom.state !== 'defeated') {
            if (rectsOverlap(p.x, p.y, p.w, p.h, libraryBroom.x, libraryBroom.y, libraryBroom.w, libraryBroom.h)) {
                libraryBroom.state = 'stunned';
                libraryBroom.stunTimer = libraryBroom.stunDuration;
                libraryBroom.stunCount++;
                p.splat = true;
                p.splatTimer = 0.3;
                continue;
            }
        }

        // Enemy hit check — generic enemies
        var hitSomething = false;
        for (var j = 0; j < enemies.length; j++) {
            var e = enemies[j];
            if (e.state === 'dead') continue;
            if (rectsOverlap(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
                hitEnemy(e, WEAPONS[p.weaponId] || { damage: 1, effect: p.effect, effectDuration: p.effectDuration || 0 });
                p.splat = true;
                p.splatTimer = 0.3;
                hitSomething = true;
                break;
            }
        }
        if (hitSomething) continue;

        // Boss hit check
        if (checkBossHit(p.x, p.y, p.w, p.h, WEAPONS[p.weaponId] || { damage: 1 })) {
            p.splat = true;
            p.splatTimer = 0.3;
            continue;
        }
    }
}

/** Renders all active projectiles. */
function renderProjectiles(ctx, cameraX, cameraY) {
    for (var i = 0; i < projectiles.length; i++) {
        var p = projectiles[i];
        var sx = p.x - cameraX;
        var sy = p.y - cameraY;

        if (p.splat) {
            // Splat animation — expanding colored circle
            var progress = 1 - (p.splatTimer / 0.3);
            var radius = 6 + progress * 10;
            var alpha = 0.6 * (1 - progress);
            ctx.fillStyle = p.color;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(sx + p.w / 2, sy + p.h / 2, radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1;
        } else {
            // Flying projectile
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(sx + p.w / 2, sy + p.h / 2, 5, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.4)';
            ctx.beginPath();
            ctx.arc(sx + p.w / 2 - 1, sy + p.h / 2 - 1, 2, 0, Math.PI * 2);
            ctx.fill();
            // Trail
            var trailAlpha = 0.2;
            ctx.fillStyle = 'rgba(' + hexToRgb(p.color) + ',' + trailAlpha + ')';
            ctx.beginPath();
            ctx.arc(sx + p.w / 2 - p.vx * 0.02, sy + p.h / 2 - p.vy * 0.02, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

/** Converts a hex color to "r,g,b" string for rgba(). */
function hexToRgb(hex) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return r + ',' + g + ',' + b;
}

// ============================================================
// Trap system (banana)
// ============================================================

/** Active traps on the ground. */
var traps = [];

/** Places a trap at the player's current tile. */
function placeTrap(weapon) {
    weaponState.cooldownTimer = weapon.cooldown * getBuffCooldownMult();
    var ts = CONFIG.TILE_SIZE;
    var col = Math.floor((player.x + player.w / 2) / ts);
    var row = Math.floor((player.y + player.h / 2) / ts);
    traps.push({
        x: col * ts, y: row * ts, col: col, row: row,
        weaponId: weapon.id,
        color: weapon.color,
        effect: weapon.effect || null,
        effectDuration: weapon.effectDuration || 0,
        triggered: false,
        triggerTimer: 0,
    });
    playBananaPlace();
}

/** Updates all active traps — checks for enemy overlap. */
function updateTraps(dt) {
    for (var i = traps.length - 1; i >= 0; i--) {
        var trap = traps[i];
        if (trap.triggered) {
            trap.triggerTimer -= dt;
            if (trap.triggerTimer <= 0) {
                traps.splice(i, 1);
            }
            continue;
        }

        // Check if cat steps on trap
        var ts = CONFIG.TILE_SIZE;
        if (libraryBroom.active && libraryBroom.state !== 'stunned' && libraryBroom.state !== 'defeated') {
            if (rectsOverlap(trap.x, trap.y, ts, ts, libraryBroom.x, libraryBroom.y, libraryBroom.w, libraryBroom.h)) {
                trap.triggered = true;
                trap.triggerTimer = 0.5;
                libraryBroom.state = 'stunned';
                libraryBroom.stunTimer = libraryBroom.stunDuration;
                libraryBroom.stunCount++;
                continue;
            }
        }

        // Check generic enemies
        for (var j = 0; j < enemies.length; j++) {
            var e = enemies[j];
            if (e.state === 'dead' || e.state === 'stunned') continue;
            if (rectsOverlap(trap.x, trap.y, ts, ts, e.x, e.y, e.w, e.h)) {
                trap.triggered = true;
                trap.triggerTimer = 0.5;
                hitEnemy(e, WEAPONS[trap.weaponId] || { damage: 0, effect: trap.effect, effectDuration: trap.effectDuration || 0 });
                break;
            }
        }

        // Check Enzo boss
        if (!trap.triggered && checkBossHit(trap.x, trap.y, ts, ts,
            WEAPONS[trap.weaponId] || { damage: 0, effect: trap.effect, effectDuration: trap.effectDuration || 0 })) {
            trap.triggered = true;
            trap.triggerTimer = 0.5;
        }
    }
}

/** Renders all active traps. */
function renderTraps(ctx, cameraX, cameraY) {
    var ts = CONFIG.TILE_SIZE;
    for (var i = 0; i < traps.length; i++) {
        var trap = traps[i];
        var sx = trap.x - cameraX;
        var sy = trap.y - cameraY;

        if (trap.triggered) {
            // Trigger animation — poof
            var progress = 1 - (trap.triggerTimer / 0.5);
            var alpha = 0.5 * (1 - progress);
            ctx.fillStyle = 'rgba(255, 255, 100, ' + alpha + ')';
            ctx.beginPath();
            ctx.arc(sx + ts / 2, sy + ts / 2, 12 + progress * 8, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Banana peel on ground
            ctx.fillStyle = trap.color;
            // Curved banana shape
            ctx.beginPath();
            ctx.arc(sx + ts / 2, sy + ts / 2 + 2, 8, Math.PI * 0.1, Math.PI * 0.9);
            ctx.lineWidth = 4;
            ctx.strokeStyle = trap.color;
            ctx.stroke();
            // Dark tip
            ctx.fillStyle = '#8d6e63';
            ctx.beginPath();
            ctx.arc(sx + ts / 2 + 7, sy + ts / 2, 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}

// ============================================================
// Area effect system (flour)
// ============================================================

/** Active area effects. */
var areaEffects = [];

/** Starts an area effect centered on the player. */
function startAreaAttack(weapon) {
    weaponState.cooldownTimer = weapon.cooldown * getBuffCooldownMult();
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var radius = weapon.range;

    areaEffects.push({
        x: pcx, y: pcy,
        radius: radius,
        color: weapon.color,
        timer: 1.0,       // visual cloud lasts 1 second
        maxTimer: 1.0,
    });

    // Hit enemies in radius — cat
    if (libraryBroom.active && libraryBroom.state !== 'stunned' && libraryBroom.state !== 'defeated') {
        var dx = (libraryBroom.x + libraryBroom.w / 2) - pcx;
        var dy = (libraryBroom.y + libraryBroom.h / 2) - pcy;
        if (dx * dx + dy * dy <= radius * radius) {
            libraryBroom.state = 'stunned';
            libraryBroom.stunTimer = weapon.effectDuration || libraryBroom.stunDuration;
            libraryBroom.stunCount++;
        }
    }

    // Hit generic enemies in radius
    for (var i = 0; i < enemies.length; i++) {
        var e = enemies[i];
        if (e.state === 'dead') continue;
        var edx = (e.x + e.w / 2) - pcx;
        var edy = (e.y + e.h / 2) - pcy;
        if (edx * edx + edy * edy <= radius * radius) {
            hitEnemy(e, weapon);
        }
    }

    // Hit Enzo boss in radius
    if (enzoBoss.active && enzoBoss.state !== 'defeated') {
        var bdx = (enzoBoss.x + enzoBoss.w / 2) - pcx;
        var bdy = (enzoBoss.y + enzoBoss.h / 2) - pcy;
        if (bdx * bdx + bdy * bdy <= radius * radius) {
            hitBoss(weapon);
        }
    }

    playFlourPoof();
}

/** Updates area effects (timer countdown). */
function updateAreaEffects(dt) {
    for (var i = areaEffects.length - 1; i >= 0; i--) {
        areaEffects[i].timer -= dt;
        if (areaEffects[i].timer <= 0) {
            areaEffects.splice(i, 1);
        }
    }
}

/** Renders area effect clouds. */
function renderAreaEffects(ctx, cameraX, cameraY) {
    for (var i = 0; i < areaEffects.length; i++) {
        var ae = areaEffects[i];
        var sx = ae.x - cameraX;
        var sy = ae.y - cameraY;
        var progress = 1 - (ae.timer / ae.maxTimer);
        var alpha = 0.4 * (1 - progress);
        var r = ae.radius * (0.6 + progress * 0.4);

        // Cloud puff circles
        ctx.fillStyle = 'rgba(245, 245, 220, ' + alpha + ')';
        for (var c = 0; c < 6; c++) {
            var angle = c * Math.PI / 3 + progress * 0.5;
            var dist = r * 0.5 + Math.sin(game.time * 3 + c) * 8;
            var cx = sx + Math.cos(angle) * dist;
            var cy = sy + Math.sin(angle) * dist;
            ctx.beginPath();
            ctx.arc(cx, cy, r * 0.35, 0, Math.PI * 2);
            ctx.fill();
        }
        // Center cloud
        ctx.fillStyle = 'rgba(255, 255, 255, ' + (alpha * 0.5) + ')';
        ctx.beginPath();
        ctx.arc(sx, sy, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// ============================================================
// Weapon update (called from engine.js update)
// ============================================================

/** Updates weapon state: cooldown, attack timer. */
function updateWeapons(dt) {
    if (weaponState.cooldownTimer > 0) {
        weaponState.cooldownTimer -= dt;
    }
    if (weaponState.attacking) {
        weaponState.attackTimer -= dt;
        if (weaponState.attackTimer <= 0) {
            weaponState.attacking = false;
            weaponState.hitbox.active = false;
        }
    }

    // Projectiles, traps, area effects
    updateProjectiles(dt);
    updateTraps(dt);
    updateAreaEffects(dt);

    // Weapon equip via Q key (cycle forward)
    if (isJustPressed('KeyQ')) {
        cycleWeapon(1);
    }
}

// ============================================================
// Weapon rendering (called from engine.js render)
// ============================================================

/** Renders the weapon attack swing visual. */
function renderWeaponAttack(ctx, cameraX, cameraY) {
    if (!weaponState.attacking) return;
    var weapon = getEquippedWeapon();
    if (!weapon) return;

    if (weapon.type === 'melee') {
        renderMeleeSwing(ctx, cameraX, cameraY, weapon);
    }
}

/** Renders the spatula melee swing arc. */
function renderMeleeSwing(ctx, cameraX, cameraY, weapon) {
    var progress = 1 - (weaponState.attackTimer / weaponState.attackDuration);
    var pcx = player.x + player.w / 2 - cameraX;
    var pcy = player.y + player.h / 2 - cameraY;

    // Swing arc — a sweeping line that rotates
    var swingAngle;
    var baseAngle;
    switch (player.facing) {
        case 'up':    baseAngle = -Math.PI / 2; break;
        case 'down':  baseAngle = Math.PI / 2; break;
        case 'left':  baseAngle = Math.PI; break;
        case 'right': baseAngle = 0; break;
    }
    // Sweep from -45° to +45° relative to facing
    swingAngle = baseAngle + (progress - 0.5) * Math.PI * 0.8;

    var len = weapon.range;
    var endX = pcx + Math.cos(swingAngle) * len;
    var endY = pcy + Math.sin(swingAngle) * len;

    // Spatula handle
    ctx.strokeStyle = '#8d6e63';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pcx, pcy);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Spatula head (wider end)
    var headAngle = swingAngle + Math.PI / 2;
    var headW = 8;
    ctx.strokeStyle = weapon.color;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(endX - Math.cos(headAngle) * headW, endY - Math.sin(headAngle) * headW);
    ctx.lineTo(endX + Math.cos(headAngle) * headW, endY + Math.sin(headAngle) * headW);
    ctx.stroke();

    // Swing trail (fading arc)
    var alpha = 0.3 * (1 - progress);
    ctx.strokeStyle = 'rgba(200, 200, 200, ' + alpha + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pcx, pcy, len * 0.7, baseAngle - 0.6, baseAngle + 0.6);
    ctx.stroke();
}

/** Renders the weapon hitbox (debug — disabled by default, enable via console: CONFIG.SHOW_HITBOXES = true). */
function renderWeaponDebug(ctx, cameraX, cameraY) {
    if (!CONFIG.SHOW_HITBOXES) return;
    if (!weaponState.hitbox.active) return;
    var hb = weaponState.hitbox;
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(hb.x - cameraX, hb.y - cameraY, hb.w, hb.h);
}

/** Renders the equipped weapon indicator in the HUD. */
function renderWeaponHUD(ctx) {
    var weapon = getEquippedWeapon();
    var ts = CONFIG.TILE_SIZE;

    // Draw weapon slot at top-left, below debug info
    var slotX = CONFIG.CANVAS_W - 120;
    var slotY = CONFIG.INV_MARGIN_TOP;
    var slotSize = CONFIG.INV_SLOT_SIZE;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(slotX, slotY, slotSize + 60, slotSize + 8);
    ctx.strokeStyle = weapon ? '#ff8a65' : '#555555';
    ctx.lineWidth = 1;
    ctx.strokeRect(slotX, slotY, slotSize + 60, slotSize + 8);

    // Label
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '8px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('[Q] Weapon', slotX + 2, slotY + 10);

    if (weapon) {
        // Weapon icon (use sprite if available)
        var itemDef = ITEMS[weapon.id];
        if (itemDef) {
            var wpnSprite = SPRITES.items[weapon.id];
            if (wpnSprite) {
                var ws = slotSize - 8;
                var wScale = Math.min(ws / wpnSprite.width, ws / wpnSprite.height);
                var ww = wpnSprite.width * wScale;
                var wh = wpnSprite.height * wScale;
                ctx.drawImage(wpnSprite, slotX + 4 + (ws - ww) / 2, slotY + 14 + (ws - wh) / 2, ww, wh);
            } else {
                ctx.fillStyle = itemDef.color;
                ctx.fillRect(slotX + 4, slotY + 14, slotSize - 8, slotSize - 8);
                ctx.fillStyle = '#000';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(itemDef.icon, slotX + slotSize / 2, slotY + slotSize - 2);
            }
        }
        // Weapon name + ammo
        ctx.fillStyle = '#ff8a65';
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        var nameText = weapon.name;
        if (weapon.consumable && weaponState.ammo[weapon.id] !== undefined) {
            nameText += ' x' + weaponState.ammo[weapon.id];
        }
        ctx.fillText(nameText, slotX + slotSize, slotY + 28);

        // Cooldown bar
        if (weaponState.cooldownTimer > 0) {
            var cdPct = weaponState.cooldownTimer / weapon.cooldown;
            ctx.fillStyle = 'rgba(255, 100, 50, 0.4)';
            ctx.fillRect(slotX + 4, slotY + slotSize, (slotSize - 8) * cdPct, 3);
        }
    } else {
        ctx.fillStyle = '#555555';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('None', slotX + (slotSize + 60) / 2, slotY + 28);
    }
}
