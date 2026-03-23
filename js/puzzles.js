// ============================================================
// js/puzzles.js — All puzzle mechanics incl. BMX mini-game
// ============================================================

// ============================================================
// BMX Side-Scroller Mini-Game (Canal Zone)
// ============================================================

/** BMX mini-game constants. */
const BMX_CONFIG = {
    GRAVITY: 1200,         // pixels/sec² — snappy, arcade-style
    JUMP_FORCE: 480,       // initial upward velocity (positive = up in our height system)
    DOUBLE_JUMP_FORCE: 380,// second jump — slightly weaker
    MAX_JUMPS: 2,          // ground jump + one mid-air jump
    SCROLL_SPEED: 220,     // pixels/sec auto-scroll
    PLAYER_W: 28,
    PLAYER_H: 28,
    WHEEL_RADIUS: 7,
    GROUND_FRAC: 0.72,     // ground surface at 72% of canvas height
    LEVEL_LENGTH: 6000,    // total course length in pixels
    RESULT_DISPLAY_TIME: 3,
    PLANK_W: 26,
    PLANK_H: 12,
    PLANK_COLLECT_RADIUS: 28,
    MAX_HEALTH: 3,         // hearts — lose one per gap fall or obstacle hit
    WATER_FRAC: 0.55,      // water fills bottom 55% of the gap area (below ground)
};

/** BMX mini-game state. */
const bmx = {
    active: false,
    // Player — height is distance above ground (positive = airborne)
    height: 0,
    velY: 0,           // positive = upward
    onGround: true,
    jumpsLeft: 0,      // remaining jumps (resets to MAX_JUMPS on landing)
    screenX: 100,      // fixed screen X for player
    // World
    scrollX: 0,
    groundY: 0,        // computed pixel Y of ground surface
    // Level data
    groundGaps: [],    // { start, end }
    obstacles: [],     // { x, w, h, type, hit }
    planks: [],        // { x, heightAboveGround, collected }
    // Progress
    planksCollected: 0,
    maxPlanks: 4,
    timer: 0,
    // State machine
    phase: 'intro',    // 'intro' | 'playing' | 'result'
    introTimer: 0,
    resultTimer: 0,
    // Health
    health: 3,
    // Visual
    wheelAngle: 0,
    bgCloudOffset: 0,
    hit: false,
    hitTimer: 0,
    hitType: '',       // 'gap' or 'obstacle' — controls fall animation vs bounce
};

/** Creates the BMX level layout. Returns raw data arrays. */
function createBMXLevel() {
    return {
        groundGaps: [
            { start: 1400, end: 1560 },
            { start: 3000, end: 3200 },
            { start: 4800, end: 4960 },
        ],
        obstacles: [
            { x: 800,  w: 30, h: 34, type: 'barrel' },
            { x: 2200, w: 30, h: 34, type: 'barrel' },
            { x: 2600, w: 38, h: 28, type: 'box' },
            { x: 3700, w: 30, h: 42, type: 'barrel' },
            { x: 4300, w: 30, h: 34, type: 'barrel' },
            { x: 5400, w: 38, h: 34, type: 'box' },
        ],
        planks: [
            { x: 1100, heightAboveGround: 70 },
            { x: 1480, heightAboveGround: 95 },
            { x: 3100, heightAboveGround: 80 },
            { x: 5200, heightAboveGround: 65 },
        ],
    };
}

/** Starts the BMX mini-game. Called when interacting with bike in Canal zone. */
function startBMXMiniGame() {
    if (bmx.active) return;
    if (getFlag('bmx_completed')) return;

    bmx.active = true;
    game.mode = 'bmx';

    // Compute ground pixel Y
    bmx.groundY = Math.floor(CONFIG.CANVAS_H * BMX_CONFIG.GROUND_FRAC);

    // Player state
    bmx.height = 0;
    bmx.velY = 0;
    bmx.onGround = true;
    bmx.jumpsLeft = BMX_CONFIG.MAX_JUMPS;
    bmx.screenX = 100;

    // Scroll
    bmx.scrollX = 0;

    // Build level
    var level = createBMXLevel();
    bmx.groundGaps = level.groundGaps;
    bmx.obstacles = [];
    for (var i = 0; i < level.obstacles.length; i++) {
        var o = level.obstacles[i];
        bmx.obstacles.push({ x: o.x, w: o.w, h: o.h, type: o.type, hit: false });
    }
    bmx.planks = [];
    for (var i = 0; i < level.planks.length; i++) {
        var p = level.planks[i];
        bmx.planks.push({ x: p.x, heightAboveGround: p.heightAboveGround, collected: false });
    }

    // Progress
    bmx.planksCollected = 0;
    bmx.maxPlanks = level.planks.length;
    bmx.timer = BMX_CONFIG.LEVEL_LENGTH / BMX_CONFIG.SCROLL_SPEED + 2;

    // Phase
    bmx.phase = 'intro';
    bmx.introTimer = 2.5;
    bmx.resultTimer = 0;

    // Health
    bmx.health = BMX_CONFIG.MAX_HEALTH;

    // Visual
    bmx.wheelAngle = 0;
    bmx.bgCloudOffset = 0;
    bmx.hit = false;
    bmx.hitTimer = 0;
    bmx.hitType = '';
}

/** Returns true if worldX is over a ground gap. */
function bmxOverGap(worldX, halfW) {
    for (var i = 0; i < bmx.groundGaps.length; i++) {
        var gap = bmx.groundGaps[i];
        if (worldX + halfW > gap.start && worldX - halfW < gap.end) {
            return true;
        }
    }
    return false;
}

/** Updates the BMX mini-game each frame. */
function updateBMX(dt) {
    if (!bmx.active) return;

    // Intro countdown
    if (bmx.phase === 'intro') {
        bmx.introTimer -= dt;
        if (bmx.introTimer <= 0) {
            bmx.phase = 'playing';
        }
        return;
    }

    // Result screen — wait for timer or interact to end
    if (bmx.phase === 'result') {
        bmx.resultTimer -= dt;
        if (bmx.resultTimer <= 0 || actionJustPressed('interact')) {
            endBMXMiniGame();
        }
        return;
    }

    // === Playing phase ===
    bmx.timer -= dt;

    // Hit recovery (player fell in gap or hit obstacle)
    if (bmx.hit) {
        bmx.hitTimer -= dt;

        if (bmx.hitType === 'gap' && bmx.height < 0) {
            // Bike is falling into the water — keep gravity going
            bmx.velY -= BMX_CONFIG.GRAVITY * dt;
            bmx.height += bmx.velY * dt;
            // Snap to ground once bike reaches the water surface
            var depthToWater = (CONFIG.CANVAS_H - bmx.groundY) * BMX_CONFIG.WATER_FRAC;
            if (bmx.height < -depthToWater) {
                bmx.height = 0;
                bmx.velY = 0;
            }
        }

        if (bmx.hitTimer <= 0) {
            bmx.hit = false;
            bmx.height = 0;
            bmx.velY = 0;
            bmx.onGround = true;
            bmx.jumpsLeft = BMX_CONFIG.MAX_JUMPS;
        }

        // Keep scrolling during recovery
        bmx.scrollX += BMX_CONFIG.SCROLL_SPEED * dt;
        bmx.wheelAngle += dt * 8;
        bmx.bgCloudOffset += BMX_CONFIG.SCROLL_SPEED * 0.3 * dt;

        // Check level end or death
        if (bmx.health <= 0 || bmx.scrollX >= BMX_CONFIG.LEVEL_LENGTH || bmx.timer <= 0) {
            bmx.phase = 'result';
            bmx.resultTimer = BMX_CONFIG.RESULT_DISPLAY_TIME;
        }
        return;
    }

    // Auto-scroll
    bmx.scrollX += BMX_CONFIG.SCROLL_SPEED * dt;
    bmx.bgCloudOffset += BMX_CONFIG.SCROLL_SPEED * 0.3 * dt;

    // Check level complete
    if (bmx.scrollX >= BMX_CONFIG.LEVEL_LENGTH || bmx.timer <= 0) {
        bmx.phase = 'result';
        bmx.resultTimer = BMX_CONFIG.RESULT_DISPLAY_TIME;
        return;
    }

    // Jump input (Space, Z, or Up) — supports double jump
    if (bmx.jumpsLeft > 0 && (actionJustPressed('interact') || actionJustPressed('move_up'))) {
        var isFirstJump = bmx.onGround;
        bmx.velY = isFirstJump ? BMX_CONFIG.JUMP_FORCE : BMX_CONFIG.DOUBLE_JUMP_FORCE;
        bmx.onGround = false;
        bmx.jumpsLeft--;
    }

    // Physics
    if (!bmx.onGround) {
        bmx.velY -= BMX_CONFIG.GRAVITY * dt;
        bmx.height += bmx.velY * dt;

        // Landing check
        if (bmx.height <= 0) {
            var worldX = bmx.scrollX + bmx.screenX + BMX_CONFIG.PLAYER_W / 2;
            if (bmxOverGap(worldX, BMX_CONFIG.PLAYER_W * 0.3)) {
                // Fell in gap — keep falling into water, then snap to ground
                bmx.hit = true;
                bmx.hitType = 'gap';
                bmx.hitTimer = 1.5;
                bmx.height = -1; // just below ground, gravity continues in hit recovery
                bmx.health--;
                // velY carries over so the bike keeps its downward momentum
            } else {
                bmx.height = 0;
                bmx.velY = 0;
                bmx.onGround = true;
                bmx.jumpsLeft = BMX_CONFIG.MAX_JUMPS;
            }
        }
    } else {
        // Check if ground disappears under player (scrolled into gap)
        var worldX = bmx.scrollX + bmx.screenX + BMX_CONFIG.PLAYER_W / 2;
        if (bmxOverGap(worldX, BMX_CONFIG.PLAYER_W * 0.3)) {
            bmx.onGround = false;
            bmx.jumpsLeft = Math.min(bmx.jumpsLeft, 1); // allow one air jump if they fall off edge
            bmx.velY = 0; // start falling
        }
    }

    // Obstacle collision
    var playerWorldX = bmx.scrollX + bmx.screenX;
    var playerBottom = bmx.groundY - bmx.height;
    var playerTop = playerBottom - BMX_CONFIG.PLAYER_H;
    for (var i = 0; i < bmx.obstacles.length; i++) {
        var obs = bmx.obstacles[i];
        if (obs.hit) continue;
        var obsTop = bmx.groundY - obs.h;
        // AABB overlap
        if (playerWorldX + BMX_CONFIG.PLAYER_W > obs.x &&
            playerWorldX < obs.x + obs.w &&
            playerTop < bmx.groundY &&
            playerBottom > obsTop) {
            obs.hit = true;
            bmx.hit = true;
            bmx.hitType = 'obstacle';
            bmx.hitTimer = 0.5;
            bmx.velY = BMX_CONFIG.JUMP_FORCE * 0.3;
            bmx.onGround = false;
            bmx.health--;
        }
    }

    // Plank collection
    var playerCX = bmx.screenX + BMX_CONFIG.PLAYER_W / 2;
    var playerCY = bmx.groundY - bmx.height - BMX_CONFIG.PLAYER_H / 2;
    for (var i = 0; i < bmx.planks.length; i++) {
        var plank = bmx.planks[i];
        if (plank.collected) continue;
        var plankScreenX = plank.x - bmx.scrollX + BMX_CONFIG.PLANK_W / 2;
        var plankScreenY = bmx.groundY - plank.heightAboveGround;
        var dx = playerCX - plankScreenX;
        var dy = playerCY - plankScreenY;
        if (dx * dx + dy * dy < BMX_CONFIG.PLANK_COLLECT_RADIUS * BMX_CONFIG.PLANK_COLLECT_RADIUS) {
            plank.collected = true;
            bmx.planksCollected++;
            playItemPickup();
        }
    }

    // Wheel spin animation
    bmx.wheelAngle += dt * 10;
}

/** Renders the BMX mini-game to the canvas. */
function renderBMX(ctx) {
    var w = CONFIG.CANVAS_W;
    var h = CONFIG.CANVAS_H;
    var gY = bmx.groundY;
    var t = game.time;

    // --- Sky gradient ---
    var skyGrad = ctx.createLinearGradient(0, 0, 0, gY);
    skyGrad.addColorStop(0, '#5ab0e8');
    skyGrad.addColorStop(0.5, '#87CEEB');
    skyGrad.addColorStop(1, '#b8e4f8');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, gY);

    // --- Sun ---
    var sunX = w * 0.8, sunY = gY * 0.2;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    var sunGrad = ctx.createRadialGradient(sunX, sunY, 8, sunX, sunY, 60);
    sunGrad.addColorStop(0, 'rgba(255,240,180,0.6)');
    sunGrad.addColorStop(0.4, 'rgba(255,220,120,0.15)');
    sunGrad.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(sunX - 60, sunY - 60, 120, 120);
    ctx.restore();
    // Sun disc
    ctx.fillStyle = '#fff8d0';
    ctx.beginPath(); ctx.arc(sunX, sunY, 12, 0, Math.PI * 2); ctx.fill();

    // --- Clouds (parallax, detailed) ---
    for (var c = 0; c < 6; c++) {
        var cloudX = ((c * 220) - (bmx.bgCloudOffset % (w + 300)) + w + 300) % (w + 300) - 100;
        var cloudY = 30 + (c % 3) * 35;
        // Shadow
        ctx.fillStyle = 'rgba(180,200,220,0.25)';
        ctx.beginPath();
        ctx.arc(cloudX + 2, cloudY + 4, 22, 0, Math.PI * 2);
        ctx.arc(cloudX + 20, cloudY - 3, 17, 0, Math.PI * 2);
        ctx.arc(cloudX + 38, cloudY + 4, 20, 0, Math.PI * 2);
        ctx.fill();
        // Body
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(cloudX, cloudY, 22, 0, Math.PI * 2);
        ctx.arc(cloudX + 18, cloudY - 7, 17, 0, Math.PI * 2);
        ctx.arc(cloudX + 36, cloudY, 20, 0, Math.PI * 2);
        ctx.fill();
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(cloudX + 5, cloudY - 8, 10, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Far hills (parallax, slower) ---
    ctx.fillStyle = '#3e8a52';
    ctx.beginPath();
    ctx.moveTo(0, gY);
    for (var x = 0; x <= w; x += 30) {
        var farHillY = gY - 40 - Math.sin((x + bmx.bgCloudOffset * 0.25) * 0.005) * 25
                       - Math.sin((x + bmx.bgCloudOffset * 0.25) * 0.012) * 10;
        ctx.lineTo(x, farHillY);
    }
    ctx.lineTo(w, gY);
    ctx.fill();

    // --- Near hills (parallax) ---
    ctx.fillStyle = '#5a9e4d';
    ctx.beginPath();
    ctx.moveTo(0, gY);
    for (var x2 = 0; x2 <= w; x2 += 40) {
        var hillY = gY - 20 - Math.sin((x2 + bmx.bgCloudOffset * 0.5) * 0.007) * 18;
        ctx.lineTo(x2, hillY);
    }
    ctx.lineTo(w, gY);
    ctx.fill();

    // --- Trees on hills ---
    for (var tr = 0; tr < 8; tr++) {
        var treeX = ((tr * 150 + 40) - (bmx.bgCloudOffset * 0.4) % (w + 200) + w + 200) % (w + 200) - 50;
        var baseHillY = gY - 15 - Math.sin((treeX + bmx.bgCloudOffset * 0.5) * 0.007) * 18;
        // Trunk
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(treeX - 2, baseHillY - 18, 4, 18);
        // Canopy
        ctx.fillStyle = '#2d7a3a';
        ctx.beginPath(); ctx.arc(treeX, baseHillY - 22, 10, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#3a8a4a';
        ctx.beginPath(); ctx.arc(treeX - 3, baseHillY - 18, 7, 0, Math.PI * 2); ctx.fill();
    }

    // --- Ground ---
    ctx.fillStyle = '#4a8c3f';
    ctx.fillRect(0, gY, w, h - gY);
    // Grass tufts along edge
    ctx.fillStyle = '#3e7a35';
    for (var gi = 0; gi < w; gi += 16) {
        var gSeed = (gi * 7 + 3) % 11;
        if (gSeed < 5) {
            ctx.fillRect(gi + gSeed, gY - 2, 2, 4);
            ctx.fillRect(gi + gSeed + 3, gY - 1, 1, 3);
        }
    }

    // Path surface with texture
    ctx.fillStyle = '#b8a080';
    ctx.fillRect(0, gY, w, 6);
    ctx.fillStyle = '#a89070';
    for (var pi = 0; pi < w; pi += 18) {
        ctx.fillRect(pi + ((pi * 3) % 7), gY + 1, 2, 2);
    }

    // --- Ground gaps (water underneath) ---
    for (var i = 0; i < bmx.groundGaps.length; i++) {
        var gap = bmx.groundGaps[i];
        var gapX = gap.start - bmx.scrollX;
        var gapW = gap.end - gap.start;
        if (gapX > w + 10 || gapX + gapW < -10) continue;

        var gapDepth = h - gY;
        var waterHeight = Math.floor(gapDepth * BMX_CONFIG.WATER_FRAC);
        var waterTop = h - waterHeight;

        // Dirt walls with layered texture
        ctx.fillStyle = '#6b4226';
        ctx.fillRect(gapX, gY, gapW, gapDepth - waterHeight);
        ctx.fillStyle = '#5a3a1a';
        for (var ey = gY + 6; ey < waterTop; ey += 8) {
            ctx.fillRect(gapX + 3, ey, gapW - 6, 2);
        }
        // Rock dots in dirt
        ctx.fillStyle = '#7a5a3a';
        for (var rd = 0; rd < 3; rd++) {
            ctx.fillRect(gapX + 8 + rd * (gapW / 4), gY + 12 + rd * 10, 4, 3);
        }

        // Water with gradient
        var waterGrad = ctx.createLinearGradient(0, waterTop, 0, h);
        waterGrad.addColorStop(0, '#4a9edf');
        waterGrad.addColorStop(0.4, '#2a6ab5');
        waterGrad.addColorStop(1, '#1a4a85');
        ctx.fillStyle = waterGrad;
        ctx.fillRect(gapX, waterTop, gapW, waterHeight);

        // Animated water ripples
        ctx.fillStyle = '#5ab0e8';
        for (var wx = Math.max(0, gapX); wx < Math.min(w, gapX + gapW); wx += 10) {
            var wy = waterTop + Math.sin(t * 3 + wx * 0.08) * 2;
            ctx.fillRect(wx, wy, 6, 2);
        }

        // Gap edges
        ctx.fillStyle = '#4a2a12';
        ctx.fillRect(gapX - 3, gY - 2, 5, gapDepth + 2);
        ctx.fillRect(gapX + gapW - 2, gY - 2, 5, gapDepth + 2);
    }

    // --- Obstacles (enhanced) ---
    for (var i = 0; i < bmx.obstacles.length; i++) {
        var obs = bmx.obstacles[i];
        if (obs.hit) continue;
        var ox = obs.x - bmx.scrollX;
        if (ox > w + 50 || ox < -50) continue;
        var oy = gY - obs.h;

        if (obs.type === 'barrel') {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.15)';
            ctx.beginPath(); ctx.ellipse(ox + obs.w / 2, gY, obs.w / 2 + 2, 4, 0, 0, Math.PI * 2); ctx.fill();
            // Barrel body
            ctx.fillStyle = '#8b5e3c';
            ctx.fillRect(ox, oy, obs.w, obs.h);
            // Metal bands
            ctx.fillStyle = '#5a3a1a';
            ctx.fillRect(ox - 1, oy + 4, obs.w + 2, 3);
            ctx.fillRect(ox - 1, oy + obs.h - 7, obs.w + 2, 3);
            // Wood grain
            ctx.fillStyle = '#7a4e2c';
            ctx.fillRect(ox + 4, oy + 10, 2, obs.h - 20);
            ctx.fillRect(ox + obs.w - 8, oy + 12, 2, obs.h - 22);
            // Highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(ox + 2, oy + 2, 6, obs.h - 4);
        } else {
            // Box with shadow
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(ox + 3, oy + 3, obs.w, obs.h);
            ctx.fillStyle = '#7a6a5a';
            ctx.fillRect(ox, oy, obs.w, obs.h);
            ctx.strokeStyle = '#5a4a3a';
            ctx.lineWidth = 2;
            ctx.strokeRect(ox, oy, obs.w, obs.h);
            // Cross detail
            ctx.beginPath();
            ctx.moveTo(ox, oy); ctx.lineTo(ox + obs.w, oy + obs.h);
            ctx.moveTo(ox + obs.w, oy); ctx.lineTo(ox, oy + obs.h);
            ctx.stroke();
        }
    }

    // --- Planks (collectible, floating) ---
    for (var i = 0; i < bmx.planks.length; i++) {
        var plank = bmx.planks[i];
        if (plank.collected) continue;
        var plkX = plank.x - bmx.scrollX;
        if (plkX > w + 50 || plkX < -50) continue;
        var plkY = gY - plank.heightAboveGround;
        var bob = Math.sin(t * 3 + i * 1.5) * 4;

        // Bloom glow
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 235, 59, 0.18)';
        ctx.beginPath();
        ctx.arc(plkX + BMX_CONFIG.PLANK_W / 2, plkY + bob, BMX_CONFIG.PLANK_W * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Plank body
        ctx.fillStyle = '#c4a46c';
        ctx.fillRect(plkX, plkY + bob - BMX_CONFIG.PLANK_H / 2, BMX_CONFIG.PLANK_W, BMX_CONFIG.PLANK_H);
        ctx.strokeStyle = '#8b6914';
        ctx.lineWidth = 2;
        ctx.strokeRect(plkX, plkY + bob - BMX_CONFIG.PLANK_H / 2, BMX_CONFIG.PLANK_W, BMX_CONFIG.PLANK_H);
        // Wood grain
        ctx.strokeStyle = '#a08050';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(plkX + 3, plkY + bob - 1);
        ctx.lineTo(plkX + BMX_CONFIG.PLANK_W - 3, plkY + bob - 1);
        ctx.moveTo(plkX + 5, plkY + bob + 3);
        ctx.lineTo(plkX + BMX_CONFIG.PLANK_W - 5, plkY + bob + 3);
        ctx.stroke();

        // Sparkles
        for (var s = 0; s < 3; s++) {
            var sa = t * 2.5 + s * Math.PI * 0.66;
            var sr = 18 + Math.sin(t * 4 + s) * 3;
            var spkX = plkX + BMX_CONFIG.PLANK_W / 2 + Math.cos(sa) * sr;
            var spkY = plkY + bob + Math.sin(sa) * sr;
            ctx.fillStyle = 'rgba(255,255,255,' + (0.4 + Math.sin(t * 5 + s) * 0.4) + ')';
            ctx.fillRect(spkX - 1, spkY - 1, 3, 3);
        }
    }

    // --- Player (Giulia on bike) ---
    var playerBottom = gY - bmx.height;
    var playerTop = playerBottom - BMX_CONFIG.PLAYER_H;
    var bikeX = bmx.screenX;

    if (bmx.hit && Math.floor(t * 12) % 2 === 0) {
        // blink
    } else {
        var wheelY = playerBottom - BMX_CONFIG.WHEEL_RADIUS;
        var rearWX = bikeX + BMX_CONFIG.WHEEL_RADIUS + 2;
        var frontWX = bikeX + BMX_CONFIG.PLAYER_W - BMX_CONFIG.WHEEL_RADIUS - 2;

        // Wheel shadows
        ctx.fillStyle = 'rgba(0,0,0,0.1)';
        ctx.beginPath(); ctx.ellipse(rearWX, gY, BMX_CONFIG.WHEEL_RADIUS + 1, 3, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(frontWX, gY, BMX_CONFIG.WHEEL_RADIUS + 1, 3, 0, 0, Math.PI * 2); ctx.fill();

        // Wheels with tire tread
        ctx.strokeStyle = '#222';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(rearWX, wheelY, BMX_CONFIG.WHEEL_RADIUS, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(frontWX, wheelY, BMX_CONFIG.WHEEL_RADIUS, 0, Math.PI * 2); ctx.stroke();
        // Hub
        ctx.fillStyle = '#555';
        ctx.beginPath(); ctx.arc(rearWX, wheelY, 2, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(frontWX, wheelY, 2, 0, Math.PI * 2); ctx.fill();
        // Spokes
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        for (var s = 0; s < 4; s++) {
            var a = bmx.wheelAngle + s * Math.PI / 2;
            var cosA = Math.cos(a) * (BMX_CONFIG.WHEEL_RADIUS - 2);
            var sinA = Math.sin(a) * (BMX_CONFIG.WHEEL_RADIUS - 2);
            ctx.beginPath(); ctx.moveTo(rearWX, wheelY); ctx.lineTo(rearWX + cosA, wheelY + sinA); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(frontWX, wheelY); ctx.lineTo(frontWX + cosA, wheelY + sinA); ctx.stroke();
        }

        // Frame (red/pink like Giulia's color)
        var frameCX = bikeX + BMX_CONFIG.PLAYER_W / 2;
        var frameTopY = playerTop + BMX_CONFIG.PLAYER_H * 0.35;
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(rearWX, wheelY);
        ctx.lineTo(frameCX, frameTopY);
        ctx.lineTo(frontWX, wheelY);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(frontWX - 3, wheelY - 8);
        ctx.lineTo(frontWX + 5, wheelY - 14);
        ctx.stroke();
        // Seat
        ctx.fillStyle = '#333';
        ctx.fillRect(frameCX - 5, frameTopY - 3, 10, 4);

        // Rider: Giulia pixel art (side view)
        var riderX = frameCX - 6;
        var riderY = frameTopY - 24;
        // Hair
        ctx.fillStyle = '#4a2c0a';
        ctx.fillRect(riderX + 1, riderY, 10, 4);
        ctx.fillRect(riderX, riderY + 3, 4, 6); // trailing hair
        // Face
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(riderX + 3, riderY + 3, 8, 6);
        // Eye
        ctx.fillStyle = '#222';
        ctx.fillRect(riderX + 8, riderY + 5, 2, 2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(riderX + 9, riderY + 5, 1, 1);
        // Body (red top)
        ctx.fillStyle = '#e94560';
        ctx.fillRect(riderX + 2, riderY + 9, 8, 7);
        // Arms (reaching for handlebar)
        ctx.fillStyle = '#e94560';
        ctx.fillRect(riderX + 8, riderY + 10, 6, 3);
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(riderX + 13, riderY + 10, 2, 3);
        // Legs (on pedals)
        ctx.fillStyle = '#ffcc99';
        ctx.fillRect(riderX + 3, riderY + 16, 3, 6);
        ctx.fillRect(riderX + 7, riderY + 16, 3, 6);
        // Shoes
        ctx.fillStyle = '#5a3a2a';
        ctx.fillRect(riderX + 2, riderY + 21, 4, 2);
        ctx.fillRect(riderX + 7, riderY + 21, 4, 2);

        // Dust trail
        if (bmx.onGround && bmx.phase === 'playing') {
            ctx.fillStyle = 'rgba(180,160,128,0.25)';
            for (var d = 0; d < 4; d++) {
                var dustX = bikeX - 6 - d * 8 + Math.sin(t * 8 + d * 2) * 3;
                var dustY = gY - 3 + Math.sin(t * 6 + d) * 4;
                var dustR = 2 + d * 1.5;
                ctx.beginPath(); ctx.arc(dustX, dustY, dustR, 0, Math.PI * 2); ctx.fill();
            }
        }
    }

    // --- HUD ---
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    ctx.fillRect(10, 10, 190, 72);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 1;
    ctx.strokeRect(10, 10, 190, 72);

    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Planks: ' + bmx.planksCollected + ' / ' + bmx.maxPlanks, 20, 30);

    var timeLeft = Math.max(0, Math.ceil(bmx.timer));
    ctx.fillStyle = timeLeft <= 5 ? '#ff4444' : '#ffffff';
    ctx.fillText('Time: ' + timeLeft + 's', 20, 48);

    var heartX = 20;
    var heartY = 58;
    for (var hi = 0; hi < BMX_CONFIG.MAX_HEALTH; hi++) {
        var filled = hi < bmx.health;
        ctx.fillStyle = filled ? '#e94560' : '#444444';
        var hx = heartX + hi * 20;
        ctx.beginPath();
        ctx.moveTo(hx + 7, heartY + 3);
        ctx.bezierCurveTo(hx + 7, heartY, hx, heartY, hx, heartY + 4);
        ctx.bezierCurveTo(hx, heartY + 8, hx + 7, heartY + 12, hx + 7, heartY + 14);
        ctx.bezierCurveTo(hx + 7, heartY + 12, hx + 14, heartY + 8, hx + 14, heartY + 4);
        ctx.bezierCurveTo(hx + 14, heartY, hx + 7, heartY, hx + 7, heartY + 3);
        ctx.fill();
    }

    // Progress bar
    var progBarW = w - 40;
    var progBarH = 6;
    var progBarY = h - 18;
    var progress = Math.min(bmx.scrollX / BMX_CONFIG.LEVEL_LENGTH, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(20, progBarY, progBarW, progBarH);
    ctx.fillStyle = '#4fc3f7';
    ctx.fillRect(20, progBarY, progBarW * progress, progBarH);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(20 + progBarW * progress, progBarY + progBarH / 2, 4, 0, Math.PI * 2);
    ctx.fill();

    // --- Intro overlay ---
    if (bmx.phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BMX RIDE!', w / 2, h / 2 - 40);

        ctx.font = '16px monospace';
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('Collect planks to fix the bridge!', w / 2, h / 2 - 10);
        ctx.fillText('Jump: Space / Up / Z  (press twice for double jump!)', w / 2, h / 2 + 15);

        var countdown = Math.ceil(bmx.introTimer);
        ctx.font = 'bold 48px monospace';
        ctx.fillStyle = '#ff5722';
        ctx.fillText(countdown > 0 ? '' + countdown : 'GO!', w / 2, h / 2 + 70);
    }

    // --- Result overlay ---
    if (bmx.phase === 'result') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, w, h);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(bmx.health <= 0 ? 'WIPEOUT!' : 'RIDE COMPLETE!', w / 2, h / 2 - 50);

        ctx.font = 'bold 20px monospace';
        ctx.fillStyle = bmx.planksCollected >= 2 ? '#00ff88' : '#ff4444';
        ctx.fillText('Planks collected: ' + bmx.planksCollected + ' / ' + bmx.maxPlanks, w / 2, h / 2 - 10);

        if (bmx.planksCollected >= 2) {
            ctx.fillStyle = '#ffd54f';
            ctx.font = '16px monospace';
            ctx.fillText('Enough to fix the bridge!', w / 2, h / 2 + 20);
        } else {
            ctx.fillStyle = '#ff8888';
            ctx.font = '16px monospace';
            ctx.fillText('Need at least 2 planks. Try again!', w / 2, h / 2 + 20);
        }

        ctx.fillStyle = '#888888';
        ctx.font = '14px monospace';
        ctx.fillText('[Z] Continue', w / 2, h / 2 + 60);
    }
}

// ============================================================
// Nokia T9 Puzzle (Library Zone)
// ============================================================

/** T9 multi-tap letter mapping: number key → array of letters. */
const T9_MAP = {
    2: ['A', 'B', 'C'],
    3: ['D', 'E', 'F'],
    4: ['G', 'H', 'I'],
    5: ['J', 'K', 'L'],
    6: ['M', 'N', 'O'],
    7: ['P', 'Q', 'R', 'S'],
    8: ['T', 'U', 'V'],
    9: ['W', 'X', 'Y', 'Z'],
};

/** Target word the player must spell. */
const T9_TARGET = 'GIULIA';

/** Nokia T9 puzzle state. */
const nokia = {
    active: false,
    enteredLetters: '',   // confirmed letters so far
    currentKey: 0,        // which number key is currently cycling (0 = none)
    cycleIndex: 0,        // position within the T9_MAP array for currentKey
    cycleTimer: 0,        // seconds since last press of currentKey — auto-confirms after threshold
    result: '',           // '' | 'success' | 'fail'
    resultTimer: 0,       // countdown for result display
    shakeTimer: 0,        // screen shake on wrong answer
    solved: false,        // true after puzzle completed
};

/** Cycle confirmation threshold in seconds — how long after pressing before letter is locked in. */
const T9_CONFIRM_DELAY = 0.8;

/** Starts the Nokia T9 puzzle overlay. */
function startNokiaPuzzle() {
    if (nokia.active) return;
    if (getFlag('nokia_solved')) return;

    nokia.active = true;
    nokia.enteredLetters = '';
    nokia.currentKey = 0;
    nokia.cycleIndex = 0;
    nokia.cycleTimer = 0;
    nokia.result = '';
    nokia.resultTimer = 0;
    nokia.shakeTimer = 0;
    nokia.solved = false;
}

/** Updates the Nokia T9 puzzle each frame. */
function updateNokia(dt) {
    if (!nokia.active) return;

    // Result display phase
    if (nokia.result !== '') {
        nokia.resultTimer -= dt;
        if (nokia.resultTimer <= 0) {
            if (nokia.result === 'success') {
                completeNokiaPuzzle();
            }
            nokia.result = '';
            if (!nokia.solved) {
                // Failed — reset for retry
                nokia.enteredLetters = '';
                nokia.currentKey = 0;
                nokia.cycleIndex = 0;
                nokia.cycleTimer = 0;
            }
        }
        if (nokia.shakeTimer > 0) nokia.shakeTimer -= dt;
        return;
    }

    // Auto-confirm current cycling letter after delay
    if (nokia.currentKey > 0) {
        nokia.cycleTimer += dt;
        if (nokia.cycleTimer >= T9_CONFIRM_DELAY) {
            confirmCurrentLetter();
        }
    }

    // Number key input (Digit2-Digit9)
    for (var num = 2; num <= 9; num++) {
        if (isJustPressed('Digit' + num)) {
            if (nokia.currentKey === num) {
                // Same key — cycle to next letter
                var letters = T9_MAP[num];
                nokia.cycleIndex = (nokia.cycleIndex + 1) % letters.length;
            } else {
                // Different key — confirm previous letter (if any), start new cycle
                if (nokia.currentKey > 0) {
                    confirmCurrentLetter();
                }
                nokia.currentKey = num;
                nokia.cycleIndex = 0;
            }
            nokia.cycleTimer = 0;
            break;
        }
    }

    // Backspace to delete last confirmed letter (or cancel current cycle)
    if (isJustPressed('Backspace')) {
        if (nokia.currentKey > 0) {
            // Cancel current cycling
            nokia.currentKey = 0;
            nokia.cycleIndex = 0;
            nokia.cycleTimer = 0;
        } else if (nokia.enteredLetters.length > 0) {
            nokia.enteredLetters = nokia.enteredLetters.slice(0, -1);
        }
    }

    // Enter to submit (confirms current letter first if cycling)
    if (isJustPressed('Enter') && nokia.result === '') {
        if (nokia.currentKey > 0) {
            confirmCurrentLetter();
        }
        // Only manually check if auto-check didn't already trigger
        if (nokia.result === '' && nokia.enteredLetters.length > 0) {
            checkNokiaAnswer();
        }
    }

    // Escape to close puzzle
    if (isJustPressed('Escape')) {
        nokia.active = false;
    }
}

/** Confirms the currently cycling letter and appends it to enteredLetters. */
function confirmCurrentLetter() {
    if (nokia.currentKey === 0) return;
    var letters = T9_MAP[nokia.currentKey];
    nokia.enteredLetters += letters[nokia.cycleIndex];
    nokia.currentKey = 0;
    nokia.cycleIndex = 0;
    nokia.cycleTimer = 0;

    // Auto-check when we reach the target length
    if (nokia.enteredLetters.length >= T9_TARGET.length) {
        checkNokiaAnswer();
    }
}

/** Checks if the entered word matches the target. */
function checkNokiaAnswer() {
    if (nokia.enteredLetters === T9_TARGET) {
        nokia.result = 'success';
        nokia.resultTimer = 2.0;
        nokia.solved = true;
        playItemPickup();
    } else {
        nokia.result = 'fail';
        nokia.resultTimer = 1.5;
        nokia.shakeTimer = 0.3;
    }
}

/** Completes the Nokia puzzle — sets flags and spawns recipe #2. */
function completeNokiaPuzzle() {
    setFlag('nokia_solved', true);
    nokia.active = false;

    // Spawn recipe #2 near the Nokia if not already collected
    if (!hasItem('recipe_2')) {
        spawnWorldItem('nokia_recipe', 6, 12, 'recipe_2');
    }

    // Flash effect
    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
    game.itemFlashName = 'Secret Revealed!';
}

// ============================================================
// NES Cartridge Puzzle (Library Zone)
// ============================================================

/** Cartridge puzzle state. Two phases: 'blow' then 'memory'. */
const cartridge = {
    active: false,
    phase: 'blow',       // 'blow' | 'memory' | 'result'
    // Blow phase
    blowProgress: 0,     // 0–1, fill bar by mashing Z/Space
    blowDecay: 0.15,     // progress drains per second if not pressing
    blowPerPress: 0.08,  // progress gained per button mash
    blowTarget: 1.0,     // fill to 100% to complete
    // Memory phase
    memorySequence: [],   // 4-symbol sequence to memorize
    memoryShowing: true,  // true while sequence is being displayed
    memoryShowTimer: 0,   // countdown for showing each symbol
    memoryShowIndex: 0,   // which symbol is currently highlighted
    playerInput: [],      // player's input so far
    memoryWrong: false,   // true briefly on wrong input
    wrongTimer: 0,
    // Result
    result: '',           // '' | 'success' | 'fail'
    resultTimer: 0,
    solved: false,
};

/** The 4 symbols used in the memory puzzle (mapped to arrow keys). */
const CARTRIDGE_SYMBOLS = ['up', 'down', 'left', 'right'];

/** Starts the cartridge puzzle overlay. */
function startCartridgePuzzle() {
    if (cartridge.active) return;
    if (getFlag('cartridge_solved')) return;

    cartridge.active = true;
    cartridge.phase = 'blow';
    cartridge.blowProgress = 0;
    cartridge.result = '';
    cartridge.resultTimer = 0;
    cartridge.solved = false;
}

/** Updates the cartridge puzzle each frame. */
function updateCartridge(dt) {
    if (!cartridge.active) return;

    // Result display
    if (cartridge.result !== '') {
        cartridge.resultTimer -= dt;
        if (cartridge.resultTimer <= 0) {
            if (cartridge.result === 'success') {
                completeCartridgePuzzle();
            } else {
                // Reset for retry
                cartridge.phase = 'blow';
                cartridge.blowProgress = 0;
            }
            cartridge.result = '';
        }
        return;
    }

    // Escape to close
    if (isJustPressed('Escape')) {
        cartridge.active = false;
        return;
    }

    if (cartridge.phase === 'blow') {
        updateCartridgeBlow(dt);
    } else if (cartridge.phase === 'memory') {
        updateCartridgeMemory(dt);
    }
}

/** Blow phase: mash Z/Space to fill progress bar. */
function updateCartridgeBlow(dt) {
    // Decay
    cartridge.blowProgress = Math.max(0, cartridge.blowProgress - cartridge.blowDecay * dt);

    // Button mash
    if (actionJustPressed('interact')) {
        cartridge.blowProgress = Math.min(cartridge.blowTarget, cartridge.blowProgress + cartridge.blowPerPress);
    }

    // Complete blow phase
    if (cartridge.blowProgress >= cartridge.blowTarget) {
        cartridge.phase = 'memory';
        // Generate random 4-symbol sequence
        cartridge.memorySequence = [];
        for (var i = 0; i < 4; i++) {
            cartridge.memorySequence.push(CARTRIDGE_SYMBOLS[Math.floor(Math.random() * 4)]);
        }
        cartridge.memoryShowing = true;
        cartridge.memoryShowTimer = 0;
        cartridge.memoryShowIndex = 0;
        cartridge.playerInput = [];
        cartridge.memoryWrong = false;
        cartridge.wrongTimer = 0;
    }
}

/** Memory phase: watch sequence, then repeat it. */
function updateCartridgeMemory(dt) {
    if (cartridge.wrongTimer > 0) {
        cartridge.wrongTimer -= dt;
        if (cartridge.wrongTimer <= 0) cartridge.memoryWrong = false;
        return;
    }

    if (cartridge.memoryShowing) {
        // Show sequence one symbol at a time
        cartridge.memoryShowTimer += dt;
        if (cartridge.memoryShowTimer >= 0.8) {
            cartridge.memoryShowTimer = 0;
            cartridge.memoryShowIndex++;
            if (cartridge.memoryShowIndex > cartridge.memorySequence.length) {
                cartridge.memoryShowing = false;
                cartridge.playerInput = [];
            }
        }
        return;
    }

    // Player input phase — arrow keys
    var dirs = ['move_up', 'move_down', 'move_left', 'move_right'];
    var dirNames = ['up', 'down', 'left', 'right'];
    for (var i = 0; i < 4; i++) {
        if (actionJustPressed(dirs[i])) {
            var expected = cartridge.memorySequence[cartridge.playerInput.length];
            if (dirNames[i] === expected) {
                cartridge.playerInput.push(dirNames[i]);
                // Check if complete
                if (cartridge.playerInput.length >= cartridge.memorySequence.length) {
                    cartridge.result = 'success';
                    cartridge.resultTimer = 1.5;
                    cartridge.solved = true;
                    playItemPickup();
                }
            } else {
                // Wrong — flash and reset sequence
                cartridge.memoryWrong = true;
                cartridge.wrongTimer = 0.8;
                cartridge.playerInput = [];
                // Re-show the sequence
                cartridge.memoryShowing = true;
                cartridge.memoryShowTimer = 0;
                cartridge.memoryShowIndex = 0;
            }
            break;
        }
    }
}

/** Completes the cartridge puzzle — sets flag, opens hidden room. */
function completeCartridgePuzzle() {
    setFlag('cartridge_solved', true);
    cartridge.active = false;
    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
    game.itemFlashName = 'Cartridge Activated!';
}

// ============================================================
// Library Cat Mini-Boss
// ============================================================

/** Cat mini-boss state. Patrols the library, chases player on sight. */
const libraryBroom = {
    active: false,       // true when in library zone and cat not defeated
    x: 0,
    y: 0,
    w: 20,
    h: 16,
    // AI state: 'patrol' | 'chase' | 'stunned' | 'defeated'
    state: 'patrol',
    // Patrol
    patrolPoints: [],    // array of {x, y} waypoints in pixels
    patrolIndex: 0,
    patrolDir: 1,        // 1 = forward, -1 = backward through points
    speed: 70,           // pixels/sec patrol speed
    chaseSpeed: 120,     // pixels/sec chase speed
    // Detection
    sightRange: 160,     // pixels — detection radius
    sightAngle: 0,       // not used (simple radius check)
    loseRange: 220,      // pixels — stop chasing beyond this
    // Stun
    stunTimer: 0,
    stunDuration: 4,     // seconds stunned after Brodo bark
    // Visual
    animTimer: 0,
    facing: 'left',
    // Stun count — defeated after 3 stuns
    stunCount: 0,
    maxStuns: 3,
};

/** Initializes the cat for the Library zone. */
function initLibraryBroom() {
    if (getFlag('broom_defeated')) {
        libraryBroom.active = false;
        return;
    }
    libraryBroom.active = true;
    libraryBroom.state = 'patrol';
    libraryBroom.stunCount = 0;
    libraryBroom.stunTimer = 0;
    libraryBroom.animTimer = 0;
    libraryBroom.patrolIndex = 0;
    libraryBroom.patrolDir = 1;

    // Patrol route: back and forth along row 11 (the aisle between shelf rows)
    var ts = CONFIG.TILE_SIZE;
    libraryBroom.patrolPoints = [
        { x: 2 * ts, y: 11 * ts },
        { x: 10 * ts, y: 11 * ts },
        { x: 10 * ts, y: 9 * ts },
        { x: 17 * ts, y: 9 * ts },
        { x: 17 * ts, y: 11 * ts },
        { x: 22 * ts, y: 11 * ts },
    ];
    libraryBroom.x = libraryBroom.patrolPoints[0].x;
    libraryBroom.y = libraryBroom.patrolPoints[0].y;
}

/** Updates the cat mini-boss. */
function updateLibraryBroom(dt) {
    if (!libraryBroom.active) return;

    libraryBroom.animTimer += dt;

    if (libraryBroom.state === 'patrol') {
        updateBroomPatrol(dt);
        // Check if player is in sight
        if (canBroomSeePlayer()) {
            libraryBroom.state = 'chase';
        }
    } else if (libraryBroom.state === 'chase') {
        updateBroomChase(dt);
        // Lose player if too far
        var dx = player.x - libraryBroom.x;
        var dy = player.y - libraryBroom.y;
        if (dx * dx + dy * dy > libraryBroom.loseRange * libraryBroom.loseRange) {
            libraryBroom.state = 'patrol';
        }
        // Contact damage to player
        if (rectsOverlap(libraryBroom.x, libraryBroom.y, libraryBroom.w, libraryBroom.h,
            player.x, player.y, player.w, player.h)) {
            damagePlayer(1);
        }
    } else if (libraryBroom.state === 'stunned') {
        libraryBroom.stunTimer -= dt;
        if (libraryBroom.stunTimer <= 0) {
            if (libraryBroom.stunCount >= libraryBroom.maxStuns) {
                libraryBroom.state = 'defeated';
                libraryBroom.active = false;
                setFlag('broom_defeated', true);
                game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
                game.itemFlashName = 'Cat Scared Away!';
            } else {
                libraryBroom.state = 'patrol';
            }
        }
    }
}

/** Moves cat along patrol waypoints. */
function updateBroomPatrol(dt) {
    var target = libraryBroom.patrolPoints[libraryBroom.patrolIndex];
    var dx = target.x - libraryBroom.x;
    var dy = target.y - libraryBroom.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
        // Reached waypoint — advance to next
        libraryBroom.patrolIndex += libraryBroom.patrolDir;
        if (libraryBroom.patrolIndex >= libraryBroom.patrolPoints.length) {
            libraryBroom.patrolDir = -1;
            libraryBroom.patrolIndex = libraryBroom.patrolPoints.length - 2;
        } else if (libraryBroom.patrolIndex < 0) {
            libraryBroom.patrolDir = 1;
            libraryBroom.patrolIndex = 1;
        }
        return;
    }

    // Move toward target
    var speed = libraryBroom.speed * dt;
    var nx = dx / dist;
    var ny = dy / dist;
    var newX = libraryBroom.x + nx * speed;
    var newY = libraryBroom.y + ny * speed;

    // Collision check against map
    if (!collidesWithMap(game.currentMap, newX, libraryBroom.y, libraryBroom.w, libraryBroom.h)) {
        libraryBroom.x = newX;
    }
    if (!collidesWithMap(game.currentMap, libraryBroom.x, newY, libraryBroom.w, libraryBroom.h)) {
        libraryBroom.y = newY;
    }

    // Update facing
    if (Math.abs(dx) > Math.abs(dy)) {
        libraryBroom.facing = dx > 0 ? 'right' : 'left';
    } else {
        libraryBroom.facing = dy > 0 ? 'down' : 'up';
    }
}

/** Checks if the cat can see the player (radius + wall check). */
function canBroomSeePlayer() {
    var cx = libraryBroom.x + libraryBroom.w / 2;
    var cy = libraryBroom.y + libraryBroom.h / 2;
    var px = player.x + player.w / 2;
    var py = player.y + player.h / 2;
    var dx = px - cx;
    var dy = py - cy;
    var distSq = dx * dx + dy * dy;

    if (distSq > libraryBroom.sightRange * libraryBroom.sightRange) return false;

    // Raycast: check for walls between cat and player
    var dist = Math.sqrt(distSq);
    var steps = Math.ceil(dist / CONFIG.TILE_SIZE);
    var ts = CONFIG.TILE_SIZE;
    for (var i = 1; i < steps; i++) {
        var t = i / steps;
        var checkX = cx + dx * t;
        var checkY = cy + dy * t;
        var col = Math.floor(checkX / ts);
        var row = Math.floor(checkY / ts);
        if (getTile(game.currentMap, col, row).solid) return false;
    }
    return true;
}

/** Chases the player directly, with wall collision. */
function updateBroomChase(dt) {
    var dx = player.x - libraryBroom.x;
    var dy = player.y - libraryBroom.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 1) return;

    var speed = libraryBroom.chaseSpeed * dt;
    var nx = dx / dist;
    var ny = dy / dist;

    // Move X and Y independently for wall sliding
    var newX = libraryBroom.x + nx * speed;
    if (!collidesWithMap(game.currentMap, newX, libraryBroom.y, libraryBroom.w, libraryBroom.h)) {
        libraryBroom.x = newX;
    }
    var newY = libraryBroom.y + ny * speed;
    if (!collidesWithMap(game.currentMap, libraryBroom.x, newY, libraryBroom.w, libraryBroom.h)) {
        libraryBroom.y = newY;
    }

    // Update facing
    if (Math.abs(dx) > Math.abs(dy)) {
        libraryBroom.facing = dx > 0 ? 'right' : 'left';
    } else {
        libraryBroom.facing = dy > 0 ? 'down' : 'up';
    }
}

/** Stuns the cat (called when Brodo barks nearby). */
function stunLibraryBroom() {
    if (!libraryBroom.active) return;
    if (libraryBroom.state === 'stunned' || libraryBroom.state === 'defeated') return;

    // Check if Brodo is close enough to the cat
    var dx = brodo.x - libraryBroom.x;
    var dy = brodo.y - libraryBroom.y;
    var dist = dx * dx + dy * dy;
    var stunRange = CONFIG.BRODO_SNIFF_RADIUS * 1.2; // slightly larger than sniff range
    if (dist > stunRange * stunRange) return;

    libraryBroom.state = 'stunned';
    libraryBroom.stunTimer = libraryBroom.stunDuration;
    libraryBroom.stunCount++;
}

/** Renders the cat mini-boss. */
/** Renders the library cat mini-boss using pre-generated sprites. */
function renderLibraryBroom(ctx, cameraX, cameraY) {
    if (!libraryBroom.active) return;

    var sx = libraryBroom.x - cameraX;
    var sy = libraryBroom.y - cameraY;
    var w = libraryBroom.w;
    var h = libraryBroom.h;
    var t = libraryBroom.animTimer;

    // Stunned blink
    if (libraryBroom.state === 'stunned' && Math.floor(t * 8) % 2 === 0) {
        ctx.globalAlpha = 0.4;
    }

    // Select cat sprite based on state
    var spriteState = 'patrol';
    if (libraryBroom.state === 'chase') spriteState = 'chase';
    else if (libraryBroom.state === 'stunned') spriteState = 'stunned';

    var sprite = SPRITES.broom[spriteState];
    if (sprite) {
        // Flip horizontally if facing left (sprites are drawn facing right)
        if (libraryBroom.facing === 'left') {
            ctx.save();
            ctx.scale(-1, 1);
            ctx.drawImage(sprite, -(sx + w + 1), sy - 1);
            ctx.restore();
        } else {
            ctx.drawImage(sprite, sx - 1, sy - 1);
        }
    }

    ctx.globalAlpha = 1;

    // Stunned stars
    if (libraryBroom.state === 'stunned') {
        ctx.fillStyle = '#ffeb3b';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        var starY = sy - 8 + Math.sin(t * 3) * 3;
        ctx.fillText('*  *  *', sx + w / 2, starY);

        // Stun counter
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.fillText(libraryBroom.stunCount + '/' + libraryBroom.maxStuns, sx + w / 2, sy - 16);
    }

    // Name label
    ctx.fillStyle = libraryBroom.state === 'chase' ? '#ff4444' : '#cccccc';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(libraryBroom.state === 'chase' ? 'SWOOSH!' : 'Enchanted Broom', sx + w / 2, sy - 4);
}

/** Ends the BMX mini-game, adds planks to inventory, returns to overworld. */
function endBMXMiniGame() {
    if (bmx.planksCollected < 2) {
        // Not enough planks — let them retry
        bmx.active = false;
        game.mode = 'overworld';
        return;
    }

    // Add collected planks to inventory
    for (var i = 0; i < bmx.planksCollected; i++) {
        addToInventory('plank_' + (i + 1));
    }

    // Set quest flags
    setFlag('bmx_completed', true);
    setFlag('bmx_planks', bmx.planksCollected);

    // Flash effect
    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
    game.itemFlashName = bmx.planksCollected + ' Bridge Plank' + (bmx.planksCollected > 1 ? 's' : '');

    // Return to overworld
    bmx.active = false;
    game.mode = 'overworld';
}

// ============================================================
// Papa's Drum Solo Interlude — Rhythm game after Zone 4
// ============================================================

/** Drum solo constants. */
const DRUM_CONFIG = {
    LANE_COUNT: 4,           // left, down, up, right
    LANE_WIDTH: 80,          // pixels per lane
    NOTE_HEIGHT: 24,         // note block height
    NOTE_SPEED: 320,         // pixels/sec — how fast notes fall
    HIT_LINE_Y_FRAC: 0.82,  // hit zone at 82% of canvas height
    PERFECT_WINDOW: 0.06,    // seconds — ±60ms
    GREAT_WINDOW: 0.12,      // seconds — ±120ms
    OK_WINDOW: 0.20,         // seconds — ±200ms
    SONG_DURATION: 30,       // approximate seconds (65 beats at 130 BPM)
    INTRO_TIME: 3,           // seconds countdown
    RESULT_TIME: 4,          // seconds to show result
    // Lane colors
    LANE_COLORS: ['#e53935', '#43a047', '#1e88e5', '#fdd835'],
    LANE_LABELS: ['←', '↓', '↑', '→'],
    LANE_KEYS: ['move_left', 'move_down', 'move_up', 'move_right'],
    // Special beat (Space)
    SPECIAL_COLOR: '#ff6f00',
};

/** Drum solo state. */
const drum = {
    active: false,
    phase: 'intro',       // 'intro' | 'playing' | 'result'
    introTimer: 0,
    resultTimer: 0,
    songTime: 0,           // seconds elapsed in song
    hitLineY: 0,           // pixel Y of the hit zone

    // Notes
    notes: [],             // { lane, time, y, hit, missed, rating }
    // lane: 0-3 (left/down/up/right), 4 = special (Space)

    // Scoring
    perfect: 0,
    great: 0,
    ok: 0,
    miss: 0,
    combo: 0,
    maxCombo: 0,
    totalNotes: 0,

    // Visual feedback
    laneFlash: [0, 0, 0, 0, 0],  // flash timer per lane (0-4, 4=special)
    rating: '',            // last hit rating text
    ratingTimer: 0,        // display timer for rating
    ratingX: 0,            // x position for rating display

    // Result
    grade: '',
    reward: '',

    // Backing track synths (created on start, disposed on end)
    music: null,           // { synths[], patterns[], gain }
};

/** Generates the note chart for Papa's drum solo. Returns array of {lane, time}. */
function createDrumChart() {
    var notes = [];
    var bpm = 130;
    var beat = 60 / bpm; // ~0.46s per beat

    // Intro buildup (beats 1-8): simple quarter notes, one lane at a time
    // Left
    notes.push({ lane: 0, time: beat * 1 });
    notes.push({ lane: 0, time: beat * 2 });
    // Right
    notes.push({ lane: 3, time: beat * 3 });
    notes.push({ lane: 3, time: beat * 4 });
    // Down-up pattern
    notes.push({ lane: 1, time: beat * 5 });
    notes.push({ lane: 2, time: beat * 6 });
    notes.push({ lane: 1, time: beat * 7 });
    notes.push({ lane: 2, time: beat * 8 });

    // Section A (beats 9-24): alternating patterns
    for (var i = 0; i < 4; i++) {
        var base = beat * (9 + i * 4);
        notes.push({ lane: 0, time: base });
        notes.push({ lane: 3, time: base + beat });
        notes.push({ lane: 1, time: base + beat * 2 });
        notes.push({ lane: 2, time: base + beat * 2.5 });
        notes.push({ lane: 4, time: base + beat * 3 }); // special!
    }

    // Section B (beats 25-40): faster, eighth notes
    for (var i = 0; i < 8; i++) {
        var base = beat * (25 + i * 2);
        var lane1 = i % 4;
        var lane2 = (i + 2) % 4;
        notes.push({ lane: lane1, time: base });
        notes.push({ lane: lane2, time: base + beat * 0.5 });
        notes.push({ lane: lane1, time: base + beat });
        if (i % 3 === 2) {
            notes.push({ lane: 4, time: base + beat * 1.5 }); // special every 3rd group
        }
    }

    // Section C (beats 41-56): full intensity, doubles
    for (var i = 0; i < 8; i++) {
        var base = beat * (41 + i * 2);
        notes.push({ lane: i % 4, time: base });
        notes.push({ lane: (i + 1) % 4, time: base + beat * 0.5 });
        notes.push({ lane: (i + 2) % 4, time: base + beat });
        notes.push({ lane: (i + 3) % 4, time: base + beat * 1.5 });
    }

    // Finale (beats 57-64): big hits with specials
    for (var i = 0; i < 4; i++) {
        var base = beat * (57 + i * 2);
        notes.push({ lane: 0, time: base });
        notes.push({ lane: 3, time: base });
        notes.push({ lane: 4, time: base + beat }); // special
        notes.push({ lane: 1, time: base + beat * 1.5 });
        notes.push({ lane: 2, time: base + beat * 1.5 });
    }

    // Final big hit
    notes.push({ lane: 4, time: beat * 65 });

    // Sort by time
    notes.sort(function(a, b) { return a.time - b.time; });

    return notes;
}

/** Creates the drum solo backing track — funky Italian rock at 130 BPM. */
function createDrumMusic() {
    if (!audio.unlocked) return null;

    try {
        var gain = new Tone.Volume(-6).toDestination();

        // Bass guitar — funky, driving
        var bass = new Tone.FMSynth({
            harmonicity: 1,
            modulationIndex: 1.5,
            oscillator: { type: 'sawtooth' },
            envelope: { attack: 0.01, decay: 0.2, sustain: 0.3, release: 0.15 },
            modulation: { type: 'sine' },
            modulationEnvelope: { attack: 0.01, decay: 0.15, sustain: 0, release: 0.1 },
        }).connect(gain);
        bass.volume.value = -6;

        // Rhythm guitar — chunky chords
        var guitar = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'square' },
            envelope: { attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.15 },
        }).connect(gain);
        guitar.volume.value = -14;

        // Keyboard / organ — warm sustained chords
        var organ = new Tone.PolySynth(Tone.Synth, {
            oscillator: { type: 'sine' },
            envelope: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.5 },
        }).connect(gain);
        organ.volume.value = -18;

        // Hi-hat — steady pulse
        var hihatFilter = new Tone.Filter(8000, 'highpass').connect(gain);
        var hihat = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.02 },
        }).connect(hihatFilter);
        hihat.volume.value = -16;

        // Kick drum
        var kick = new Tone.MembraneSynth({
            pitchDecay: 0.03,
            octaves: 6,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.3, sustain: 0, release: 0.1 },
        }).connect(gain);
        kick.volume.value = -8;

        // Snare
        var snareFilter = new Tone.Filter(3000, 'highpass').connect(gain);
        var snare = new Tone.NoiseSynth({
            noise: { type: 'white' },
            envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.05 },
        }).connect(snareFilter);
        snare.volume.value = -10;

        // Bass line — funky G minor groove
        var bassSeq = new Tone.Sequence(function(time, note) {
            if (note) safeTrigger(bass, note, '16n', time);
        }, [
            'G2', null, 'G2', null,   null, 'G2', null, 'Bb2',
            null, 'C3', null, null,   'Bb2', null, 'G2', null,
            'G2', null, null, 'G2',   null, 'Bb2', 'C3', null,
            'D3', null, 'C3', null,   'Bb2', null, null, null,
        ], '8n');
        bassSeq.loop = true;

        // Guitar chords — offbeat stabs
        var guitarSeq = new Tone.Sequence(function(time, chord) {
            if (chord) safeTrigger(guitar, chord, '16n', time);
        }, [
            null, ['G3','Bb3','D4'], null, null,
            null, ['G3','Bb3','D4'], null, null,
            null, ['Eb3','G3','Bb3'], null, null,
            null, ['F3','A3','C4'], null, ['F3','A3','C4'],
        ], '8n');
        guitarSeq.loop = true;

        // Organ pads — slow chord changes
        var organSeq = new Tone.Sequence(function(time, chord) {
            if (chord) safeTrigger(organ, chord, '2n', time);
        }, [
            ['G3','Bb3','D4'], null, null, null,
            null, null, null, null,
            ['Eb3','G3','Bb3'], null, null, null,
            null, null, null, null,
            ['F3','A3','C4'], null, null, null,
            null, null, null, null,
            ['D3','F3','A3'], null, null, null,
            null, null, null, null,
        ], '4n');
        organSeq.loop = true;

        // Drum pattern — kick/snare/hihat
        var drumSeq = new Tone.Sequence(function(time, hit) {
            if (hit === 'k') safeTrigger(kick, 'C1', '8n', time);
            else if (hit === 's') { try { snare.triggerAttackRelease('16n', time); } catch(e) {} }
            else if (hit === 'h') { try { hihat.triggerAttackRelease('32n', time); } catch(e) {} }
            else if (hit === 'kh') { safeTrigger(kick, 'C1', '8n', time); try { hihat.triggerAttackRelease('32n', time); } catch(e) {} }
            else if (hit === 'sh') { try { snare.triggerAttackRelease('16n', time); hihat.triggerAttackRelease('32n', time); } catch(e) {} }
        }, [
            'kh', 'h', 'h', 'h',  'sh', 'h', 'h', 'h',
            'kh', 'h', 'kh', 'h', 'sh', 'h', 'h', 'kh',
        ], '8n');
        drumSeq.loop = true;

        return {
            gain: gain,
            synths: [bass, guitar, organ, hihat, kick, snare],
            effects: [hihatFilter, snareFilter],
            patterns: [bassSeq, guitarSeq, organSeq, drumSeq],
        };
    } catch(e) {
        return null;
    }
}

/** Starts the drum solo backing track. */
function startDrumMusic() {
    if (drum.music) return;
    // Stop any zone music first
    if (typeof stopAllMusic === 'function') stopAllMusic();

    drum.music = createDrumMusic();
    if (!drum.music) return;

    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = 130;

    for (var i = 0; i < drum.music.patterns.length; i++) {
        drum.music.patterns[i].start(0);
    }
    Tone.Transport.start();
}

/** Stops and disposes the drum solo backing track. */
function stopDrumMusic() {
    if (!drum.music) return;
    for (var i = 0; i < drum.music.patterns.length; i++) {
        try { drum.music.patterns[i].stop(); drum.music.patterns[i].dispose(); } catch(e) {}
    }
    for (var i = 0; i < drum.music.synths.length; i++) {
        try { drum.music.synths[i].dispose(); } catch(e) {}
    }
    for (var i = 0; i < drum.music.effects.length; i++) {
        try { drum.music.effects[i].dispose(); } catch(e) {}
    }
    try { drum.music.gain.dispose(); } catch(e) {}
    drum.music = null;
}

/** Starts the drum solo interlude. */
function startDrumSolo() {
    if (drum.active) return;

    drum.active = true;
    game.mode = 'drum';
    drum.phase = 'intro';
    drum.introTimer = DRUM_CONFIG.INTRO_TIME;
    drum.resultTimer = 0;
    drum.songTime = 0;
    drum.hitLineY = Math.floor(CONFIG.CANVAS_H * DRUM_CONFIG.HIT_LINE_Y_FRAC);

    // Generate note chart
    var chart = createDrumChart();
    drum.notes = [];
    for (var i = 0; i < chart.length; i++) {
        drum.notes.push({
            lane: chart[i].lane,
            time: chart[i].time,
            y: 0,
            hit: false,
            missed: false,
            rating: '',
        });
    }
    drum.totalNotes = chart.length;

    // Reset scoring
    drum.perfect = 0;
    drum.great = 0;
    drum.ok = 0;
    drum.miss = 0;
    drum.combo = 0;
    drum.maxCombo = 0;
    drum.laneFlash = [0, 0, 0, 0, 0];
    drum.rating = '';
    drum.ratingTimer = 0;
    drum.grade = '';
    drum.reward = '';
}

/** Updates the drum solo each frame. */
function updateDrumSolo(dt) {
    if (!drum.active) return;

    // Intro countdown
    if (drum.phase === 'intro') {
        drum.introTimer -= dt;
        if (drum.introTimer <= 0) {
            drum.phase = 'playing';
            drum.songTime = 0;
            startDrumMusic();
        }
        return;
    }

    // Result screen
    if (drum.phase === 'result') {
        drum.resultTimer -= dt;
        if (drum.resultTimer <= 0 || actionJustPressed('interact')) {
            endDrumSolo();
        }
        return;
    }

    // === Playing phase ===
    drum.songTime += dt;

    // Update lane flash timers
    for (var i = 0; i < 5; i++) {
        if (drum.laneFlash[i] > 0) drum.laneFlash[i] -= dt;
    }
    if (drum.ratingTimer > 0) drum.ratingTimer -= dt;

    // Calculate note Y positions (notes fall from top to hit line)
    var hitY = drum.hitLineY;
    for (var i = 0; i < drum.notes.length; i++) {
        var note = drum.notes[i];
        if (note.hit || note.missed) continue;

        // Y position based on time difference: note arrives at hitY when songTime === note.time
        var timeUntilHit = note.time - drum.songTime;
        note.y = hitY - timeUntilHit * DRUM_CONFIG.NOTE_SPEED;

        // Auto-miss: note has fallen past the hit zone
        if (timeUntilHit < -DRUM_CONFIG.OK_WINDOW) {
            note.missed = true;
            drum.miss++;
            drum.combo = 0;
        }
    }

    // Check player inputs — one key check per lane
    for (var lane = 0; lane < 4; lane++) {
        if (actionJustPressed(DRUM_CONFIG.LANE_KEYS[lane])) {
            checkDrumHit(lane);
        }
    }
    // Special beat (Space/interact)
    if (actionJustPressed('interact')) {
        checkDrumHit(4);
    }

    // Song end check
    var lastNoteTime = drum.notes.length > 0 ? drum.notes[drum.notes.length - 1].time : 0;
    if (drum.songTime > lastNoteTime + 1.5) {
        // Mark any remaining notes as missed
        for (var i = 0; i < drum.notes.length; i++) {
            if (!drum.notes[i].hit && !drum.notes[i].missed) {
                drum.notes[i].missed = true;
                drum.miss++;
            }
        }
        // Stop backing track and calculate grade
        stopDrumMusic();
        drum.grade = calculateDrumGrade();
        drum.reward = getDrumReward(drum.grade);
        drum.phase = 'result';
        drum.resultTimer = DRUM_CONFIG.RESULT_TIME;
    }
}

/** Checks if a lane press hits a note. Finds the closest unhit note in that lane within the OK window. */
function checkDrumHit(lane) {
    var bestNote = null;
    var bestDist = Infinity;

    for (var i = 0; i < drum.notes.length; i++) {
        var note = drum.notes[i];
        if (note.hit || note.missed || note.lane !== lane) continue;

        var dist = Math.abs(note.time - drum.songTime);
        if (dist < DRUM_CONFIG.OK_WINDOW && dist < bestDist) {
            bestNote = note;
            bestDist = dist;
        }
    }

    if (bestNote) {
        bestNote.hit = true;
        var rating;
        if (bestDist <= DRUM_CONFIG.PERFECT_WINDOW) {
            rating = 'PERFECT';
            drum.perfect++;
        } else if (bestDist <= DRUM_CONFIG.GREAT_WINDOW) {
            rating = 'GREAT';
            drum.great++;
        } else {
            rating = 'OK';
            drum.ok++;
        }
        bestNote.rating = rating;
        drum.combo++;
        if (drum.combo > drum.maxCombo) drum.maxCombo = drum.combo;
        drum.laneFlash[lane] = 0.15;

        // Visual feedback
        drum.rating = rating;
        drum.ratingTimer = 0.5;
        // Center rating on the lane
        var laneStartX = (CONFIG.CANVAS_W - DRUM_CONFIG.LANE_COUNT * DRUM_CONFIG.LANE_WIDTH) / 2;
        drum.ratingX = lane < 4
            ? laneStartX + lane * DRUM_CONFIG.LANE_WIDTH + DRUM_CONFIG.LANE_WIDTH / 2
            : CONFIG.CANVAS_W / 2;

        // Play hit SFX
        playDrumHit(rating);
    } else {
        // Pressed but no note — no penalty (don't break combo for extra presses)
        drum.laneFlash[lane] = 0.08;
    }
}

/** Calculates the final grade based on hit accuracy. */
function calculateDrumGrade() {
    if (drum.totalNotes === 0) return 'C';
    var score = (drum.perfect * 3 + drum.great * 2 + drum.ok * 1) / (drum.totalNotes * 3);
    if (score >= 0.9 && drum.miss <= 2) return 'S';
    if (score >= 0.75) return 'A';
    if (score >= 0.5) return 'B';
    return 'C';
}

/** Returns the reward for a given grade. { type: 'powerup'|'item', id, name } or null. */
function getDrumReward(grade) {
    if (grade === 'S') return { type: 'powerup', id: 'brownie', name: 'Brodo Boost (Brownie)' };
    if (grade === 'A') return { type: 'powerup', id: 'chocolate_milk', name: 'Sugar Rush (Choco Milk)' };
    if (grade === 'B') return { type: 'item', id: 'tomato', name: 'Tomato' };
    return null;
}

/** Renders the drum solo interlude. */
function renderDrumSolo(ctx) {
    if (!drum.active) return;

    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;

    // Background — dark stage with spotlight gradient
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    // Stage floor
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, H * 0.85, W, H * 0.15);

    // Spotlight radial gradient
    var gradient = ctx.createRadialGradient(W / 2, H * 0.3, 10, W / 2, H * 0.3, W * 0.5);
    gradient.addColorStop(0, 'rgba(255,200,100,0.08)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, W, H);

    // Lane area
    var laneW = DRUM_CONFIG.LANE_WIDTH;
    var totalLaneW = DRUM_CONFIG.LANE_COUNT * laneW;
    var laneStartX = (W - totalLaneW) / 2;
    var hitY = drum.hitLineY;

    // --- INTRO PHASE ---
    if (drum.phase === 'intro') {
        // Title
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 32px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("PAPA'S DRUM SOLO!", W / 2, H * 0.3);

        ctx.fillStyle = '#cccccc';
        ctx.font = '16px monospace';
        ctx.fillText('Hit the notes as they reach the line!', W / 2, H * 0.42);
        ctx.fillText('← ↓ ↑ → = Arrow keys     Space = Special beat', W / 2, H * 0.50);

        // Countdown
        var count = Math.ceil(drum.introTimer);
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 64px monospace';
        ctx.fillText(count > 0 ? '' + count : 'GO!', W / 2, H * 0.7);
        return;
    }

    // --- PLAYING PHASE ---
    if (drum.phase === 'playing') {
        // Lane backgrounds
        for (var lane = 0; lane < 4; lane++) {
            var lx = laneStartX + lane * laneW;
            // Lane bg
            var alpha = drum.laneFlash[lane] > 0 ? 0.15 : 0.06;
            ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
            ctx.fillRect(lx, 0, laneW, H);

            // Lane dividers
            ctx.fillStyle = 'rgba(255,255,255,0.1)';
            ctx.fillRect(lx, 0, 1, H);

            // Flash overlay
            if (drum.laneFlash[lane] > 0) {
                ctx.fillStyle = DRUM_CONFIG.LANE_COLORS[lane];
                ctx.globalAlpha = drum.laneFlash[lane] / 0.15 * 0.3;
                ctx.fillRect(lx, hitY - 30, laneW, 60);
                ctx.globalAlpha = 1;
            }
        }
        // Right border of last lane
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(laneStartX + totalLaneW, 0, 1, H);

        // Hit line
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(laneStartX, hitY, totalLaneW, 3);

        // Lane labels at hit zone
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        for (var lane = 0; lane < 4; lane++) {
            var lx = laneStartX + lane * laneW + laneW / 2;
            ctx.fillStyle = DRUM_CONFIG.LANE_COLORS[lane];
            ctx.globalAlpha = 0.5;
            ctx.fillText(DRUM_CONFIG.LANE_LABELS[lane], lx, hitY + 24);
            ctx.globalAlpha = 1;
        }

        // Notes
        var noteH = DRUM_CONFIG.NOTE_HEIGHT;
        for (var i = 0; i < drum.notes.length; i++) {
            var note = drum.notes[i];
            if (note.hit || note.missed) continue;
            if (note.y < -noteH || note.y > H + noteH) continue;

            if (note.lane < 4) {
                // Regular note
                var nx = laneStartX + note.lane * laneW + 4;
                var nw = laneW - 8;
                ctx.fillStyle = DRUM_CONFIG.LANE_COLORS[note.lane];
                ctx.fillRect(nx, note.y - noteH / 2, nw, noteH);
                // Inner highlight
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(nx + 2, note.y - noteH / 2 + 2, nw - 4, noteH / 2 - 2);
                // Border
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(nx, note.y - noteH / 2, nw, noteH);
            } else {
                // Special note — spans all lanes, orange
                ctx.fillStyle = DRUM_CONFIG.SPECIAL_COLOR;
                ctx.fillRect(laneStartX + 4, note.y - noteH / 2, totalLaneW - 8, noteH);
                ctx.fillStyle = 'rgba(255,255,255,0.3)';
                ctx.fillRect(laneStartX + 6, note.y - noteH / 2 + 2, totalLaneW - 12, noteH / 2 - 2);
                ctx.strokeStyle = 'rgba(255,255,255,0.5)';
                ctx.lineWidth = 1;
                ctx.strokeRect(laneStartX + 4, note.y - noteH / 2, totalLaneW - 8, noteH);
                // "SPACE" label
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('SPACE', W / 2, note.y + 4);
            }
        }

        // Hit note burst effects (fading)
        for (var i = 0; i < drum.notes.length; i++) {
            var note = drum.notes[i];
            if (!note.hit) continue;
            // Brief flash at hit position
            var flashAge = drum.songTime - note.time;
            if (flashAge < 0.3) {
                var alpha = 1 - flashAge / 0.3;
                var color = note.lane < 4 ? DRUM_CONFIG.LANE_COLORS[note.lane] : DRUM_CONFIG.SPECIAL_COLOR;
                ctx.globalAlpha = alpha * 0.6;
                ctx.fillStyle = color;
                if (note.lane < 4) {
                    var fx = laneStartX + note.lane * laneW;
                    ctx.fillRect(fx, hitY - 20, laneW, 40);
                } else {
                    ctx.fillRect(laneStartX, hitY - 20, totalLaneW, 40);
                }
                ctx.globalAlpha = 1;
            }
        }

        // Rating popup
        if (drum.ratingTimer > 0 && drum.rating) {
            var rAlpha = Math.min(1, drum.ratingTimer / 0.3);
            ctx.globalAlpha = rAlpha;
            ctx.font = 'bold 22px monospace';
            ctx.textAlign = 'center';
            if (drum.rating === 'PERFECT') ctx.fillStyle = '#ffd54f';
            else if (drum.rating === 'GREAT') ctx.fillStyle = '#66bb6a';
            else ctx.fillStyle = '#90a4ae';
            ctx.fillText(drum.rating, drum.ratingX, hitY - 40);
            ctx.globalAlpha = 1;
        }

        // HUD — combo, score
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.textAlign = 'left';
        ctx.fillText('Combo: ' + drum.combo, 16, 30);
        if (drum.maxCombo > 5) {
            ctx.fillStyle = '#ffd54f';
            ctx.fillText('Best: ' + drum.maxCombo, 16, 48);
        }

        // Score counts (right side)
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('Perfect: ' + drum.perfect, W - 16, 30);
        ctx.fillStyle = '#66bb6a';
        ctx.fillText('Great: ' + drum.great, W - 16, 48);
        ctx.fillStyle = '#90a4ae';
        ctx.fillText('OK: ' + drum.ok, W - 16, 66);
        ctx.fillStyle = '#ef5350';
        ctx.fillText('Miss: ' + drum.miss, W - 16, 84);

        // Progress bar at top
        var lastNoteTime = drum.notes.length > 0 ? drum.notes[drum.notes.length - 1].time : 1;
        var progress = Math.min(1, drum.songTime / lastNoteTime);
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.fillRect(0, 0, W, 4);
        ctx.fillStyle = '#ffd54f';
        ctx.fillRect(0, 0, W * progress, 4);

        return;
    }

    // --- RESULT PHASE ---
    if (drum.phase === 'result') {
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 36px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("DRUM SOLO COMPLETE!", W / 2, H * 0.18);

        // Grade
        var gradeColors = { S: '#ffd54f', A: '#66bb6a', B: '#42a5f5', C: '#90a4ae' };
        ctx.fillStyle = gradeColors[drum.grade] || '#ffffff';
        ctx.font = 'bold 80px monospace';
        ctx.fillText(drum.grade, W / 2, H * 0.42);

        // Stats
        ctx.font = '16px monospace';
        ctx.fillStyle = '#ffd54f';
        ctx.fillText('Perfect: ' + drum.perfect, W / 2, H * 0.54);
        ctx.fillStyle = '#66bb6a';
        ctx.fillText('Great: ' + drum.great, W / 2, H * 0.60);
        ctx.fillStyle = '#90a4ae';
        ctx.fillText('OK: ' + drum.ok, W / 2, H * 0.66);
        ctx.fillStyle = '#ef5350';
        ctx.fillText('Miss: ' + drum.miss, W / 2, H * 0.72);
        ctx.fillStyle = '#ffffff';
        ctx.fillText('Max Combo: ' + drum.maxCombo, W / 2, H * 0.78);

        // Reward
        if (drum.reward) {
            ctx.fillStyle = '#ffd54f';
            ctx.font = '14px monospace';
            ctx.fillText('Reward: ' + drum.reward.name + '!', W / 2, H * 0.86);
        }

        // Continue prompt
        ctx.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.5 * Math.sin(game.time * 4)) + ')';
        ctx.font = '14px monospace';
        ctx.fillText('Press Z to continue', W / 2, H * 0.94);
    }
}

/** Plays a drum hit SFX — uses Tone.js percussion sounds. */
function playDrumHit(rating) {
    if (!sfx.initialized) return;
    try {
        var now = Tone.now();
        var vol = rating === 'PERFECT' ? -4 : rating === 'GREAT' ? -6 : -8;
        // Use a membrane synth for drum-like hit
        var synth = new Tone.MembraneSynth({
            pitchDecay: 0.02,
            octaves: 4,
            oscillator: { type: 'sine' },
            envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
        }).connect(sfx.gain);
        synth.volume.value = vol;
        var note = rating === 'PERFECT' ? 'C2' : rating === 'GREAT' ? 'D2' : 'E2';
        synth.triggerAttackRelease(note, '16n', now);
        // Cleanup after sound fades
        setTimeout(function() { try { synth.dispose(); } catch(e) {} }, 500);
    } catch(e) {}
}

/** Ends the drum solo, grants reward, returns to the destination zone. */
function endDrumSolo() {
    // Grant reward
    if (drum.reward) {
        if (drum.reward.type === 'powerup') {
            activatePowerup(drum.reward.id);
        } else if (drum.reward.type === 'item') {
            addToInventory(drum.reward.id);
        }
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = drum.reward.name;
    }

    // Set flag so it doesn't trigger again
    setFlag('drum_solo_completed', true);
    setFlag('drum_solo_grade', drum.grade);

    stopDrumMusic(); // safety cleanup
    drum.active = false;
    game.mode = 'overworld';

    // Load the zone the player was transitioning to when the interlude started
    if (game.drumReturnZone) {
        loadZone(game.drumReturnZone, game.drumReturnSpawnX, game.drumReturnSpawnY);
        game.drumReturnZone = null;
    }
}

// ============================================================
// Cooking Mini-Game — triggered after collecting recipe #4
// 4 steps: Stir, Season, Taste, Heat. Each scored Perfect/Great/OK/Miss.
// ============================================================

/** Cooking mini-game config. */
var COOK_CONFIG = {
    STEP_COUNT: 4,
    // Stir: alternate left/right presses, fill a ring
    STIR_TARGET: 12,       // total presses needed
    STIR_TIME: 6,          // seconds allowed
    // Season: moving meter, press Space in green zone
    SEASON_SPEED: 2.5,     // oscillations per second
    SEASON_GREEN_WIDTH: 0.18, // fraction of bar that is "perfect"
    SEASON_GOOD_WIDTH: 0.30,  // fraction that is "great"
    // Taste: rising indicator, press Space in sweet spot window
    TASTE_SPEED: 0.6,      // rises per second (0→1)
    TASTE_SWEET_LOW: 0.55, // sweet spot range
    TASTE_SWEET_HIGH: 0.72,
    TASTE_GOOD_LOW: 0.45,
    TASTE_GOOD_HIGH: 0.80,
    // Heat: hold down arrow, release in target zone
    HEAT_RISE_SPEED: 0.4,  // per second while held
    HEAT_FALL_SPEED: 0.15, // per second when released
    HEAT_TARGET_LOW: 0.60,
    HEAT_TARGET_HIGH: 0.75,
    HEAT_GOOD_LOW: 0.50,
    HEAT_GOOD_HIGH: 0.85,
    HEAT_TIME: 5,          // seconds allowed
    // Result screen
    RESULT_TIME: 4,
};

/** Cooking mini-game state. */
var cooking = {
    active: false,
    // Phase: 'intro' | 'stir' | 'season' | 'taste' | 'heat' | 'result'
    phase: 'intro',
    introTimer: 0,
    stepIndex: 0,          // 0-3
    stepTimer: 0,          // time in current step
    // Stir state
    stirCount: 0,
    stirLastDir: '',       // 'left' or 'right'
    stirProgress: 0,       // 0→1
    // Season state
    seasonPos: 0,          // 0→1 oscillating
    seasonLocked: false,
    seasonResult: 0,       // where it was locked
    // Taste state
    tastePos: 0,           // 0→1 rising
    tasteLocked: false,
    tasteResult: 0,
    // Heat state
    heatLevel: 0,          // 0→1
    heatHolding: false,
    heatLocked: false,
    heatResult: 0,
    // Scoring
    stepScores: [],        // array of 'perfect'|'great'|'ok'|'miss'
    totalScore: 0,
    grade: '',
    quality: '',
    // Result
    resultTimer: 0,
    // Visual
    animTimer: 0,
    stepFlash: 0,          // flash on step complete
};

/** Step names and instructions for display. */
var COOK_STEPS = [
    { name: 'STIR THE SAUCE', instruction: 'Alternate \u2190 and \u2192 to stir!', icon: '\u21C4' },
    { name: 'ADD SEASONING', instruction: 'Press Space when the needle is in the GREEN zone!', icon: '\u2728' },
    { name: 'TASTE TEST', instruction: 'Press Space at the right moment!', icon: '\uD83D\uDC45' },
    { name: 'ADJUST THE HEAT', instruction: 'Hold \u2193 to heat up. Release in the TARGET zone!', icon: '\uD83D\uDD25' },
];

/** Starts the cooking mini-game. */
function startCooking() {
    if (cooking.active) return;
    cooking.active = true;
    game.mode = 'cooking';
    cooking.phase = 'intro';
    cooking.introTimer = 2.5;
    cooking.stepIndex = 0;
    cooking.stepTimer = 0;
    cooking.stirCount = 0;
    cooking.stirLastDir = '';
    cooking.stirProgress = 0;
    cooking.seasonPos = 0;
    cooking.seasonLocked = false;
    cooking.tastePos = 0;
    cooking.tasteLocked = false;
    cooking.heatLevel = 0;
    cooking.heatHolding = false;
    cooking.heatLocked = false;
    cooking.stepScores = [];
    cooking.totalScore = 0;
    cooking.grade = '';
    cooking.quality = '';
    cooking.resultTimer = 0;
    cooking.animTimer = 0;
    cooking.stepFlash = 0;
}

/** Updates the cooking mini-game. */
function updateCooking(dt) {
    if (!cooking.active) return;
    cooking.animTimer += dt;
    if (cooking.stepFlash > 0) cooking.stepFlash -= dt;

    if (cooking.phase === 'intro') {
        cooking.introTimer -= dt;
        if (cooking.introTimer <= 0) {
            cooking.phase = 'stir';
            cooking.stepTimer = 0;
        }
        return;
    }

    if (cooking.phase === 'result') {
        cooking.resultTimer -= dt;
        if (cooking.resultTimer <= 0 && (actionJustPressed('interact') || isJustPressed('Space'))) {
            endCooking();
        }
        // Auto-end after timer
        if (cooking.resultTimer <= -2) {
            endCooking();
        }
        return;
    }

    cooking.stepTimer += dt;

    switch (cooking.phase) {
        case 'stir': updateCookingStir(dt); break;
        case 'season': updateCookingSeason(dt); break;
        case 'taste': updateCookingTaste(dt); break;
        case 'heat': updateCookingHeat(dt); break;
    }
}

/** Advances to the next cooking step or result screen. */
function advanceCookingStep(score) {
    cooking.stepScores.push(score);
    cooking.stepFlash = 0.5;
    cooking.stepIndex++;
    cooking.stepTimer = 0;

    if (cooking.stepIndex >= COOK_CONFIG.STEP_COUNT) {
        // Calculate final grade
        finalizeCooking();
        return;
    }

    // Next step
    var phases = ['stir', 'season', 'taste', 'heat'];
    cooking.phase = phases[cooking.stepIndex];

    // Reset step-specific state
    cooking.seasonPos = 0;
    cooking.seasonLocked = false;
    cooking.tastePos = 0;
    cooking.tasteLocked = false;
    cooking.heatLevel = 0;
    cooking.heatHolding = false;
    cooking.heatLocked = false;
}

/** Stir step: alternate left/right arrow presses. */
function updateCookingStir(dt) {
    if (cooking.stepTimer >= COOK_CONFIG.STIR_TIME) {
        // Time's up
        var pct = cooking.stirCount / COOK_CONFIG.STIR_TARGET;
        advanceCookingStep(pct >= 0.9 ? 'perfect' : pct >= 0.7 ? 'great' : pct >= 0.5 ? 'ok' : 'miss');
        return;
    }

    if (isJustPressed('ArrowLeft') || actionJustPressed('move_left')) {
        if (cooking.stirLastDir !== 'left') {
            cooking.stirCount++;
            cooking.stirLastDir = 'left';
            cooking.stirProgress = cooking.stirCount / COOK_CONFIG.STIR_TARGET;
            if (cooking.stirCount >= COOK_CONFIG.STIR_TARGET) {
                advanceCookingStep('perfect');
            }
        }
    }
    if (isJustPressed('ArrowRight') || actionJustPressed('move_right')) {
        if (cooking.stirLastDir !== 'right') {
            cooking.stirCount++;
            cooking.stirLastDir = 'right';
            cooking.stirProgress = cooking.stirCount / COOK_CONFIG.STIR_TARGET;
            if (cooking.stirCount >= COOK_CONFIG.STIR_TARGET) {
                advanceCookingStep('perfect');
            }
        }
    }
}

/** Season step: oscillating meter, press Space in green zone. */
function updateCookingSeason(dt) {
    if (cooking.seasonLocked) return;

    cooking.seasonPos = (Math.sin(cooking.stepTimer * COOK_CONFIG.SEASON_SPEED * Math.PI * 2) + 1) / 2;

    if (isJustPressed('Space') || actionJustPressed('interact')) {
        cooking.seasonLocked = true;
        cooking.seasonResult = cooking.seasonPos;
        // Score based on distance from center (0.5)
        var dist = Math.abs(cooking.seasonPos - 0.5);
        var score = dist <= COOK_CONFIG.SEASON_GREEN_WIDTH / 2 ? 'perfect' :
                    dist <= COOK_CONFIG.SEASON_GOOD_WIDTH / 2 ? 'great' :
                    dist <= 0.35 ? 'ok' : 'miss';
        setTimeout(function() { advanceCookingStep(score); }, 600);
    }

    // Auto-miss after 8 seconds
    if (cooking.stepTimer > 8 && !cooking.seasonLocked) {
        cooking.seasonLocked = true;
        cooking.seasonResult = cooking.seasonPos;
        setTimeout(function() { advanceCookingStep('miss'); }, 400);
    }
}

/** Taste step: rising indicator, press Space in sweet spot. */
function updateCookingTaste(dt) {
    if (cooking.tasteLocked) return;

    cooking.tastePos += COOK_CONFIG.TASTE_SPEED * dt;

    if (isJustPressed('Space') || actionJustPressed('interact')) {
        cooking.tasteLocked = true;
        cooking.tasteResult = cooking.tastePos;
        var p = cooking.tastePos;
        var score = (p >= COOK_CONFIG.TASTE_SWEET_LOW && p <= COOK_CONFIG.TASTE_SWEET_HIGH) ? 'perfect' :
                    (p >= COOK_CONFIG.TASTE_GOOD_LOW && p <= COOK_CONFIG.TASTE_GOOD_HIGH) ? 'great' :
                    (p >= 0.3 && p <= 0.9) ? 'ok' : 'miss';
        setTimeout(function() { advanceCookingStep(score); }, 600);
    }

    // Overshot
    if (cooking.tastePos >= 1.0 && !cooking.tasteLocked) {
        cooking.tasteLocked = true;
        cooking.tasteResult = 1.0;
        setTimeout(function() { advanceCookingStep('miss'); }, 400);
    }
}

/** Heat step: hold down to raise heat, release in target zone. */
function updateCookingHeat(dt) {
    if (cooking.heatLocked) return;

    if (cooking.stepTimer >= COOK_CONFIG.HEAT_TIME && !cooking.heatLocked) {
        // Time's up — score where it is
        cooking.heatLocked = true;
        cooking.heatResult = cooking.heatLevel;
        var h = cooking.heatLevel;
        var score = (h >= COOK_CONFIG.HEAT_TARGET_LOW && h <= COOK_CONFIG.HEAT_TARGET_HIGH) ? 'perfect' :
                    (h >= COOK_CONFIG.HEAT_GOOD_LOW && h <= COOK_CONFIG.HEAT_GOOD_HIGH) ? 'great' :
                    (h >= 0.3 && h <= 0.9) ? 'ok' : 'miss';
        setTimeout(function() { advanceCookingStep(score); }, 600);
        return;
    }

    var holding = actionHeld('move_down') || isHeld('ArrowDown');
    if (holding) {
        cooking.heatLevel = Math.min(1, cooking.heatLevel + COOK_CONFIG.HEAT_RISE_SPEED * dt);
        cooking.heatHolding = true;
    } else {
        cooking.heatLevel = Math.max(0, cooking.heatLevel - COOK_CONFIG.HEAT_FALL_SPEED * dt);
        cooking.heatHolding = false;
    }

    // Release in target zone — lock it
    if (!holding && cooking.heatHolding === false && cooking.heatLevel > 0.1 && cooking.stepTimer > 0.5) {
        // Check if they deliberately released (had been holding recently)
    }

    // Press Space to lock in current heat level
    if (isJustPressed('Space') || actionJustPressed('interact')) {
        cooking.heatLocked = true;
        cooking.heatResult = cooking.heatLevel;
        var h2 = cooking.heatLevel;
        var score2 = (h2 >= COOK_CONFIG.HEAT_TARGET_LOW && h2 <= COOK_CONFIG.HEAT_TARGET_HIGH) ? 'perfect' :
                     (h2 >= COOK_CONFIG.HEAT_GOOD_LOW && h2 <= COOK_CONFIG.HEAT_GOOD_HIGH) ? 'great' :
                     (h2 >= 0.3 && h2 <= 0.9) ? 'ok' : 'miss';
        setTimeout(function() { advanceCookingStep(score2); }, 600);
    }
}

/** Calculates final cooking grade and quality text. */
function finalizeCooking() {
    var scoreMap = { perfect: 3, great: 2, ok: 1, miss: 0 };
    var total = 0;
    for (var i = 0; i < cooking.stepScores.length; i++) {
        total += scoreMap[cooking.stepScores[i]] || 0;
    }
    cooking.totalScore = total;
    // Max possible = 12 (4 perfects)
    if (total >= 11) { cooking.grade = 'S'; cooking.quality = "Mama's Masterpiece!"; }
    else if (total >= 8) { cooking.grade = 'A'; cooking.quality = 'Delizioso!'; }
    else if (total >= 5) { cooking.grade = 'B'; cooking.quality = 'Not bad... needs more garlic.'; }
    else { cooking.grade = 'C'; cooking.quality = "Well... it's technically sauce."; }

    cooking.phase = 'result';
    cooking.resultTimer = COOK_CONFIG.RESULT_TIME;
    setFlag('cooking_minigame_grade', cooking.grade);
    setFlag('cooking_minigame_done', true);
}

/** Ends the cooking mini-game and returns to overworld. */
function endCooking() {
    cooking.active = false;
    game.mode = 'overworld';
    // Show a brief dialogue about the result
    startDialogue({
        id: 'cooking_result', name: 'Giulia',
        getLines: function() {
            if (cooking.grade === 'S') {
                return { lines: ["This sauce is PERFECT! Mama would be so proud!", "Now I just need the last fragment from Mama's shop..."] };
            } else if (cooking.grade === 'A') {
                return { lines: ["Mmm, that's really good sauce!", "Not quite Mama's level, but close. Let's keep going!"] };
            } else if (cooking.grade === 'B') {
                return { lines: ["It's... okay. Could use more seasoning.", "But we don't have time to redo it. Onward!"] };
            } else {
                return { lines: ["*cough* That's... that's definitely sauce. Probably.", "Let's just... move on and hope for the best."] };
            }
        },
    });
}

/** Renders the cooking mini-game. */
function renderCooking(ctx) {
    if (!cooking.active) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;
    var t = cooking.animTimer;

    // Background — warm kitchen gradient
    ctx.fillStyle = '#2a1a0e';
    ctx.fillRect(0, 0, W, H);
    // Warm gradient overlay
    var grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, H);
    grad.addColorStop(0, 'rgba(180, 100, 40, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Pot drawing (center of screen)
    var potX = W / 2;
    var potY = H / 2 + 40;
    drawCookingPot(ctx, potX, potY, t);

    // Title
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('COOKING TIME!', W / 2, 40);

    // Step progress dots
    for (var i = 0; i < COOK_CONFIG.STEP_COUNT; i++) {
        var dx = W / 2 - 60 + i * 40;
        var dy = 60;
        if (i < cooking.stepScores.length) {
            var sc = cooking.stepScores[i];
            ctx.fillStyle = sc === 'perfect' ? '#4caf50' : sc === 'great' ? '#8bc34a' : sc === 'ok' ? '#ffc107' : '#f44336';
            ctx.beginPath(); ctx.arc(dx, dy, 10, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '8px monospace';
            ctx.fillText(sc === 'perfect' ? 'P' : sc === 'great' ? 'G' : sc === 'ok' ? 'O' : 'M', dx, dy + 3);
        } else if (i === cooking.stepIndex) {
            ctx.strokeStyle = '#ffd54f';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(dx, dy, 10, 0, Math.PI * 2); ctx.stroke();
            // Pulse
            ctx.strokeStyle = 'rgba(255, 213, 79, ' + (0.3 + Math.sin(t * 4) * 0.2) + ')';
            ctx.beginPath(); ctx.arc(dx, dy, 14, 0, Math.PI * 2); ctx.stroke();
        } else {
            ctx.fillStyle = '#555';
            ctx.beginPath(); ctx.arc(dx, dy, 8, 0, Math.PI * 2); ctx.fill();
        }
    }

    // Phase-specific rendering
    if (cooking.phase === 'intro') {
        renderCookingIntro(ctx, W, H, t);
    } else if (cooking.phase === 'stir') {
        renderCookingStir(ctx, W, H, t);
    } else if (cooking.phase === 'season') {
        renderCookingSeason(ctx, W, H, t);
    } else if (cooking.phase === 'taste') {
        renderCookingTaste(ctx, W, H, t);
    } else if (cooking.phase === 'heat') {
        renderCookingHeat(ctx, W, H, t);
    } else if (cooking.phase === 'result') {
        renderCookingResult(ctx, W, H, t);
    }

    // Step flash overlay
    if (cooking.stepFlash > 0) {
        ctx.fillStyle = 'rgba(255, 255, 200, ' + (cooking.stepFlash * 0.3) + ')';
        ctx.fillRect(0, 0, W, H);
    }
}

/** Draws the cooking pot. */
function drawCookingPot(ctx, x, y, t) {
    // Pot body
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(x, y + 10, 50, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#444';
    ctx.fillRect(x - 50, y - 30, 100, 40);
    ctx.fillStyle = '#555';
    ctx.beginPath();
    ctx.ellipse(x, y - 30, 50, 15, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sauce (red, bubbling)
    ctx.fillStyle = '#cc3300';
    ctx.beginPath();
    ctx.ellipse(x, y - 28, 45, 12, 0, 0, Math.PI * 2);
    ctx.fill();

    // Bubbles
    for (var i = 0; i < 5; i++) {
        var bx = x - 30 + i * 15 + Math.sin(t * 2 + i) * 5;
        var by = y - 32 - Math.abs(Math.sin(t * 3 + i * 1.5)) * 8;
        var br = 3 + Math.sin(t * 4 + i) * 1;
        ctx.fillStyle = 'rgba(220, 60, 20, 0.6)';
        ctx.beginPath();
        ctx.arc(bx, by, br, 0, Math.PI * 2);
        ctx.fill();
    }

    // Steam
    ctx.globalAlpha = 0.3;
    for (var s = 0; s < 3; s++) {
        var sx = x - 20 + s * 20 + Math.sin(t * 1.5 + s) * 8;
        var sy = y - 50 - t * 10 % 40;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(sx, sy, 6 + Math.sin(t + s) * 2, 0, Math.PI * 2);
        ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Handles
    ctx.fillStyle = '#777';
    ctx.fillRect(x - 58, y - 15, 10, 6);
    ctx.fillRect(x + 48, y - 15, 10, 6);
}

/** Renders intro countdown. */
function renderCookingIntro(ctx, W, H, t) {
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("Time to cook Mama's sauce!", W / 2, H / 2 - 80);
    ctx.font = '12px monospace';
    ctx.fillText('Follow the instructions for each step.', W / 2, H / 2 - 60);

    var countdown = Math.ceil(cooking.introTimer);
    if (countdown > 0) {
        ctx.fillStyle = '#ffd54f';
        ctx.font = 'bold 36px monospace';
        ctx.fillText('' + countdown, W / 2, H / 2 - 20);
    }
}

/** Renders stir step. */
function renderCookingStir(ctx, W, H, t) {
    var step = COOK_STEPS[0];
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(step.name, W / 2, 90);
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px monospace';
    ctx.fillText(step.instruction, W / 2, 110);

    // Progress ring
    var cx = W / 2;
    var cy = H / 2 - 40;
    var radius = 50;
    // Background ring
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
    // Progress ring
    var progress = Math.min(1, cooking.stirProgress);
    ctx.strokeStyle = progress >= 0.9 ? '#4caf50' : progress >= 0.5 ? '#ffc107' : '#ff5722';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    // Spoon animation
    var spoonAngle = t * 3;
    var spoonX = cx + Math.cos(spoonAngle) * 25;
    var spoonY = cy + Math.sin(spoonAngle) * 25;
    ctx.fillStyle = '#c4a46c';
    ctx.beginPath();
    ctx.arc(spoonX, spoonY, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#a0845a';
    ctx.fillRect(spoonX - 2, spoonY, 4, 20);

    // Counter
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px monospace';
    ctx.fillText(cooking.stirCount + '/' + COOK_CONFIG.STIR_TARGET, cx, cy + 5);

    // Timer
    var timeLeft = Math.max(0, COOK_CONFIG.STIR_TIME - cooking.stepTimer);
    ctx.font = '10px monospace';
    ctx.fillStyle = timeLeft < 2 ? '#ff4444' : '#aaaaaa';
    ctx.fillText(timeLeft.toFixed(1) + 's', cx, cy + radius + 20);

    // Arrow indicators
    var arrowAlpha = 0.5 + Math.sin(t * 6) * 0.3;
    ctx.fillStyle = 'rgba(255, 213, 79, ' + arrowAlpha + ')';
    ctx.font = 'bold 24px monospace';
    ctx.fillText(cooking.stirLastDir === 'left' ? '\u2192' : '\u2190', cx, H - 60);
}

/** Renders season step. */
function renderCookingSeason(ctx, W, H, t) {
    var step = COOK_STEPS[1];
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(step.name, W / 2, 90);
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px monospace';
    ctx.fillText(step.instruction, W / 2, 110);

    // Meter bar
    var barX = W / 2 - 150;
    var barY = H / 2 - 60;
    var barW = 300;
    var barH = 30;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barW, barH);

    // Green zone (center)
    var greenW = barW * COOK_CONFIG.SEASON_GREEN_WIDTH;
    var goodW = barW * COOK_CONFIG.SEASON_GOOD_WIDTH;
    ctx.fillStyle = '#8bc34a';
    ctx.fillRect(barX + (barW - goodW) / 2, barY, goodW, barH);
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(barX + (barW - greenW) / 2, barY, greenW, barH);

    // Needle
    var needleX = barX + cooking.seasonPos * barW;
    ctx.fillStyle = cooking.seasonLocked ? '#ffffff' : '#ffd54f';
    ctx.fillRect(needleX - 2, barY - 5, 4, barH + 10);
    // Triangle on top
    ctx.beginPath();
    ctx.moveTo(needleX - 6, barY - 5);
    ctx.lineTo(needleX + 6, barY - 5);
    ctx.lineTo(needleX, barY - 12);
    ctx.closePath();
    ctx.fill();

    // Labels
    ctx.fillStyle = '#aaa';
    ctx.font = '9px monospace';
    ctx.fillText('[Space] to lock', W / 2, barY + barH + 20);
}

/** Renders taste step. */
function renderCookingTaste(ctx, W, H, t) {
    var step = COOK_STEPS[2];
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(step.name, W / 2, 90);
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px monospace';
    ctx.fillText(step.instruction, W / 2, 110);

    // Vertical meter
    var meterX = W / 2 - 20;
    var meterY = H / 2 + 60;
    var meterW = 40;
    var meterH = -140; // goes upward

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(meterX, meterY + meterH, meterW, -meterH);

    // Sweet spot zone
    var ssTop = meterY + meterH * COOK_CONFIG.TASTE_SWEET_HIGH;
    var ssBot = meterY + meterH * COOK_CONFIG.TASTE_SWEET_LOW;
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(meterX, ssTop, meterW, ssBot - ssTop);

    // Good zone
    var gdTop = meterY + meterH * COOK_CONFIG.TASTE_GOOD_HIGH;
    var gdBot = meterY + meterH * COOK_CONFIG.TASTE_GOOD_LOW;
    ctx.fillStyle = 'rgba(139, 195, 74, 0.3)';
    ctx.fillRect(meterX, gdTop, meterW, gdBot - gdTop);

    // Rising indicator
    var indicatorY = meterY + meterH * cooking.tastePos;
    ctx.fillStyle = cooking.tasteLocked ? '#ffffff' : '#ff5722';
    ctx.fillRect(meterX - 5, indicatorY - 3, meterW + 10, 6);

    // Labels
    ctx.fillStyle = '#4caf50';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('SWEET SPOT', meterX + meterW + 10, (ssTop + ssBot) / 2 + 3);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.fillText('[Space] to taste!', W / 2, meterY + 25);
}

/** Renders heat step. */
function renderCookingHeat(ctx, W, H, t) {
    var step = COOK_STEPS[3];
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(step.name, W / 2, 90);
    ctx.fillStyle = '#cccccc';
    ctx.font = '11px monospace';
    ctx.fillText(step.instruction, W / 2, 110);

    // Thermometer
    var thermoX = W / 2 - 15;
    var thermoY = H / 2 + 60;
    var thermoW = 30;
    var thermoH = -140;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(thermoX, thermoY + thermoH, thermoW, -thermoH);

    // Target zone
    var tgtTop = thermoY + thermoH * COOK_CONFIG.HEAT_TARGET_HIGH;
    var tgtBot = thermoY + thermoH * COOK_CONFIG.HEAT_TARGET_LOW;
    ctx.fillStyle = '#4caf50';
    ctx.fillRect(thermoX, tgtTop, thermoW, tgtBot - tgtTop);

    // Good zone
    var gdTop2 = thermoY + thermoH * COOK_CONFIG.HEAT_GOOD_HIGH;
    var gdBot2 = thermoY + thermoH * COOK_CONFIG.HEAT_GOOD_LOW;
    ctx.fillStyle = 'rgba(139, 195, 74, 0.3)';
    ctx.fillRect(thermoX, gdTop2, thermoW, gdBot2 - gdTop2);

    // Heat fill
    var fillH = (-thermoH) * cooking.heatLevel;
    var heatColor = cooking.heatLevel > 0.85 ? '#f44336' : cooking.heatLevel > 0.5 ? '#ff9800' : '#ffeb3b';
    ctx.fillStyle = heatColor;
    ctx.fillRect(thermoX, thermoY - fillH, thermoW, fillH);

    // Locked indicator
    if (cooking.heatLocked) {
        var lockY = thermoY + thermoH * cooking.heatResult;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(thermoX - 8, lockY - 2, thermoW + 16, 4);
    }

    // Flame when holding
    if (cooking.heatHolding && !cooking.heatLocked) {
        ctx.fillStyle = 'rgba(255, 100, 0, ' + (0.5 + Math.sin(t * 10) * 0.3) + ')';
        for (var fi = 0; fi < 3; fi++) {
            var fx = thermoX + thermoW / 2 + Math.sin(t * 8 + fi * 2) * 8;
            var fy = thermoY + 10 + Math.sin(t * 6 + fi) * 4;
            ctx.beginPath();
            ctx.arc(fx, fy, 5 + Math.sin(t * 12 + fi) * 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Labels
    ctx.fillStyle = '#4caf50';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('TARGET', thermoX + thermoW + 10, (tgtTop + tgtBot) / 2 + 3);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#aaa';
    ctx.fillText('Hold \u2193 then [Space] to lock', W / 2, thermoY + 25);

    // Timer
    var timeLeft = Math.max(0, COOK_CONFIG.HEAT_TIME - cooking.stepTimer);
    ctx.font = '10px monospace';
    ctx.fillStyle = timeLeft < 2 ? '#ff4444' : '#aaaaaa';
    ctx.fillText(timeLeft.toFixed(1) + 's', W / 2, thermoY + 40);
}

/** Renders result screen. */
function renderCookingResult(ctx, W, H, t) {
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SAUCE COMPLETE!', W / 2, H / 2 - 80);

    // Grade
    var gradeColor = cooking.grade === 'S' ? '#ffd700' : cooking.grade === 'A' ? '#4caf50' : cooking.grade === 'B' ? '#ffc107' : '#ff5722';
    ctx.fillStyle = gradeColor;
    ctx.font = 'bold 48px monospace';
    ctx.fillText(cooking.grade, W / 2, H / 2 - 20);

    // Quality text
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    ctx.fillText(cooking.quality, W / 2, H / 2 + 20);

    // Step scores
    var labels = ['Stir', 'Season', 'Taste', 'Heat'];
    for (var i = 0; i < cooking.stepScores.length; i++) {
        var sc = cooking.stepScores[i];
        var scColor = sc === 'perfect' ? '#4caf50' : sc === 'great' ? '#8bc34a' : sc === 'ok' ? '#ffc107' : '#f44336';
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(labels[i] + ':', W / 2 - 10, H / 2 + 50 + i * 18);
        ctx.fillStyle = scColor;
        ctx.textAlign = 'left';
        ctx.fillText(sc.toUpperCase(), W / 2 + 10, H / 2 + 50 + i * 18);
    }

    // Continue prompt
    if (cooking.resultTimer <= 0) {
        var blink = Math.sin(t * 4) > 0;
        if (blink) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Press Space to continue', W / 2, H - 40);
        }
    }
}

// ============================================================
// Dot-Matrix Printer Puzzle — paper-threading micro-maze
// Navigate paper through 3 sections of a maze. Walls reset to section start.
// ============================================================

/** Maze definition: 1 = wall, 0 = path. 24 cols × 16 rows, divided into 3 sections. */
var PRINTER_MAZE = [
    // Section 1: rows 0-4 (entry at left, exit at right)
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [0,0,0,1,0,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
    // Section 2: rows 5-9 (entry top-right from section 1, exit bottom-right)
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,0,1,0,0,0,0,0,1,0,0,0,1,0,0,0,0,0,0,1],
    [1,0,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1,0,1,1,1,1,1,1],
    [1,0,0,0,1,0,0,0,1,0,0,0,0,0,1,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
    // Section 3: rows 10-15 (entry top-right from section 2, exit bottom-right)
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1],
    [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,0,0,1,0,0,0,0,0,1],
    [1,0,1,1,0,1,0,1,1,0,1,1,1,1,0,1,0,1,0,1,1,1,1,1],
    [1,0,0,1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,0,1,0,0,0,1],
    [1,1,0,1,1,1,1,0,1,1,1,1,0,1,0,1,1,1,0,1,0,1,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0],
];

/** Section checkpoints: {startRow, startCol, endRow, endCol} */
var PRINTER_SECTIONS = [
    { startRow: 1, startCol: 0, endRow: 4, endCol: 22 },
    { startRow: 5, startCol: 22, endRow: 9, endCol: 22 },
    { startRow: 10, startCol: 22, endRow: 15, endCol: 23 },
];

/** Printer puzzle state. */
var printer = {
    active: false,
    // Paper cursor position (maze grid coords)
    row: 0,
    col: 0,
    // Current section (0-2)
    section: 0,
    // Trail of visited cells
    trail: [],
    // Result
    solved: false,
    resultTimer: 0,
    // Visual
    animTimer: 0,
    shakeTimer: 0,
    moveDelay: 0,      // brief cooldown between moves for feel
};

/** Starts the printer puzzle overlay. */
function startPrinterPuzzle() {
    if (printer.active) return;
    if (getFlag('printer_puzzle_solved')) return;

    printer.active = true;
    printer.section = 0;
    printer.solved = false;
    printer.resultTimer = 0;
    printer.animTimer = 0;
    printer.shakeTimer = 0;
    printer.moveDelay = 0;
    printer.trail = [];
    resetPrinterSection();
}

/** Resets the paper cursor to the start of the current section. */
function resetPrinterSection() {
    var sec = PRINTER_SECTIONS[printer.section];
    printer.row = sec.startRow;
    printer.col = sec.startCol;
    printer.trail = [{ row: printer.row, col: printer.col }];
}

/** Updates the printer puzzle each frame. */
function updatePrinter(dt) {
    if (!printer.active) return;
    printer.animTimer += dt;
    if (printer.shakeTimer > 0) printer.shakeTimer -= dt;
    if (printer.moveDelay > 0) { printer.moveDelay -= dt; return; }

    // Result display
    if (printer.solved) {
        printer.resultTimer -= dt;
        if (printer.resultTimer <= 0 && (actionJustPressed('interact') || isJustPressed('Space'))) {
            endPrinterPuzzle();
        }
        if (printer.resultTimer <= -3) {
            endPrinterPuzzle();
        }
        return;
    }

    // Escape to close
    if (isJustPressed('Escape')) {
        printer.active = false;
        return;
    }

    // Arrow key movement
    var dr = 0, dc = 0;
    if (actionJustPressed('move_up') || isJustPressed('ArrowUp')) dr = -1;
    else if (actionJustPressed('move_down') || isJustPressed('ArrowDown')) dr = 1;
    else if (actionJustPressed('move_left') || isJustPressed('ArrowLeft')) dc = -1;
    else if (actionJustPressed('move_right') || isJustPressed('ArrowRight')) dc = 1;

    if (dr === 0 && dc === 0) return;

    var newRow = printer.row + dr;
    var newCol = printer.col + dc;

    // Bounds check
    if (newRow < 0 || newRow >= PRINTER_MAZE.length || newCol < 0 || newCol >= PRINTER_MAZE[0].length) return;

    // Wall check
    if (PRINTER_MAZE[newRow][newCol] === 1) {
        // Hit wall — reset to section start
        printer.shakeTimer = 0.3;
        printer.moveDelay = 0.3;
        resetPrinterSection();
        return;
    }

    // Move
    printer.row = newRow;
    printer.col = newCol;
    printer.trail.push({ row: newRow, col: newCol });
    printer.moveDelay = 0.08; // brief delay for feel

    // Check if reached section end
    var sec = PRINTER_SECTIONS[printer.section];
    if (printer.row === sec.endRow && printer.col === sec.endCol) {
        printer.section++;
        if (printer.section >= PRINTER_SECTIONS.length) {
            // Maze complete!
            printer.solved = true;
            printer.resultTimer = 3.0;
            setFlag('printer_puzzle_solved', true);
        } else {
            // Advance to next section
            resetPrinterSection();
        }
    }
}

/** Ends the printer puzzle, spawns recipe #5. */
function endPrinterPuzzle() {
    printer.active = false;
    // Spawn recipe #5
    if (!hasItem('recipe_5')) {
        spawnWorldItem('recipe_5_printer', 19, 7, 'recipe_5');
    }
    // Dialogue
    startDialogue({
        id: 'printer_complete', name: 'Giulia',
        getLines: function() {
            return { lines: [
                "The printer churned out... a recipe fragment!",
                "That's the LAST piece! Fragment #5!",
                "Mama must have hidden it in the printer's memory. Clever!",
            ]};
        },
    });
}

/** Renders the printer puzzle overlay. */
function renderPrinter(ctx) {
    if (!printer.active) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;
    var t = printer.animTimer;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.92)';
    ctx.fillRect(0, 0, W, H);

    // Printer body frame
    var frameW = 560;
    var frameH = 420;
    var frameX = (W - frameW) / 2;
    var frameY = (H - frameH) / 2 - 10;

    // Shake on wall hit
    var shakeX = 0, shakeY = 0;
    if (printer.shakeTimer > 0) {
        shakeX = Math.sin(t * 40) * 3;
        shakeY = Math.cos(t * 35) * 2;
    }

    // Printer body
    ctx.fillStyle = '#d0c8b8';
    ctx.fillRect(frameX + shakeX - 10, frameY + shakeY - 10, frameW + 20, frameH + 40);
    ctx.fillStyle = '#c0b8a8';
    ctx.fillRect(frameX + shakeX, frameY + shakeY, frameW, frameH);
    // Printer details
    ctx.fillStyle = '#aaa098';
    ctx.fillRect(frameX + shakeX + 10, frameY + shakeY - 8, frameW - 20, 6);
    ctx.fillStyle = '#888';
    ctx.fillRect(frameX + shakeX + frameW - 40, frameY + shakeY + frameH + 5, 30, 8);

    // Title
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('DOT-MATRIX PRINTER', W / 2 + shakeX, frameY + shakeY + 20);
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '10px monospace';
    ctx.fillText('Guide the paper through the rollers! Walls reset to checkpoint.', W / 2 + shakeX, frameY + shakeY + 36);

    // Section indicator
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.fillText('Section ' + (printer.section + 1) + ' / ' + PRINTER_SECTIONS.length, W / 2 + shakeX, frameY + shakeY + 50);

    // Draw maze
    var mazeRows = PRINTER_MAZE.length;
    var mazeCols = PRINTER_MAZE[0].length;
    var cellSize = Math.min((frameW - 40) / mazeCols, (frameH - 80) / mazeRows);
    var mazeW = mazeCols * cellSize;
    var mazeH = mazeRows * cellSize;
    var mazeX = frameX + (frameW - mazeW) / 2 + shakeX;
    var mazeY = frameY + 60 + shakeY;

    // Draw cells
    for (var r = 0; r < mazeRows; r++) {
        for (var c = 0; c < mazeCols; c++) {
            var cx = mazeX + c * cellSize;
            var cy = mazeY + r * cellSize;
            if (PRINTER_MAZE[r][c] === 1) {
                // Wall — dark roller
                ctx.fillStyle = '#4a4040';
                ctx.fillRect(cx, cy, cellSize, cellSize);
                // Roller texture
                ctx.fillStyle = '#3a3030';
                ctx.fillRect(cx, cy + cellSize / 2 - 1, cellSize, 2);
            } else {
                // Path — paper-colored
                ctx.fillStyle = '#f5f0e8';
                ctx.fillRect(cx, cy, cellSize, cellSize);
                // Subtle paper texture
                if ((r + c) % 3 === 0) {
                    ctx.fillStyle = 'rgba(0,0,0,0.02)';
                    ctx.fillRect(cx, cy, cellSize, cellSize);
                }
            }
        }
    }

    // Draw trail (paper path — dotted ink line)
    if (printer.trail.length > 1) {
        ctx.strokeStyle = 'rgba(50, 50, 200, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(mazeX + printer.trail[0].col * cellSize + cellSize / 2,
                   mazeY + printer.trail[0].row * cellSize + cellSize / 2);
        for (var ti = 1; ti < printer.trail.length; ti++) {
            ctx.lineTo(mazeX + printer.trail[ti].col * cellSize + cellSize / 2,
                       mazeY + printer.trail[ti].row * cellSize + cellSize / 2);
        }
        ctx.stroke();
    }

    // Draw section start/end markers
    for (var si = 0; si < PRINTER_SECTIONS.length; si++) {
        var sec = PRINTER_SECTIONS[si];
        // Start — green
        var startCx = mazeX + sec.startCol * cellSize + cellSize / 2;
        var startCy = mazeY + sec.startRow * cellSize + cellSize / 2;
        ctx.fillStyle = si <= printer.section ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.2)';
        ctx.beginPath(); ctx.arc(startCx, startCy, cellSize / 3, 0, Math.PI * 2); ctx.fill();
        // End — gold
        var endCx = mazeX + sec.endCol * cellSize + cellSize / 2;
        var endCy = mazeY + sec.endRow * cellSize + cellSize / 2;
        var endPulse = 0.3 + Math.sin(t * 3 + si) * 0.15;
        ctx.fillStyle = 'rgba(255, 213, 79, ' + endPulse + ')';
        ctx.beginPath(); ctx.arc(endCx, endCy, cellSize / 3, 0, Math.PI * 2); ctx.fill();
    }

    // Draw paper cursor (current position)
    if (!printer.solved) {
        var pcx = mazeX + printer.col * cellSize + cellSize / 2;
        var pcy = mazeY + printer.row * cellSize + cellSize / 2;
        // Paper tip — white with red tip
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(pcx, pcy, cellSize / 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e53935';
        ctx.beginPath(); ctx.arc(pcx, pcy, cellSize / 4, 0, Math.PI * 2); ctx.fill();
        // Glow
        ctx.strokeStyle = 'rgba(255, 100, 100, ' + (0.4 + Math.sin(t * 5) * 0.2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pcx, pcy, cellSize / 2, 0, Math.PI * 2); ctx.stroke();
    }

    // Result overlay
    if (printer.solved) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('PAPER THREADED!', W / 2, H / 2 - 30);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText('The printer whirs to life and prints...', W / 2, H / 2 + 10);
        ctx.fillStyle = '#ffeb3b';
        ctx.font = 'bold 16px monospace';
        ctx.fillText('Recipe Fragment #5!', W / 2, H / 2 + 40);

        if (printer.resultTimer <= 0) {
            var blink = Math.sin(t * 4) > 0;
            if (blink) {
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '11px monospace';
                ctx.fillText('Press Space to continue', W / 2, H / 2 + 80);
            }
        }
    }

    // Controls hint
    if (!printer.solved) {
        ctx.fillStyle = '#888888';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Arrow keys to move  |  Esc to exit', W / 2, frameY + frameH + 20 + shakeY);
    }
}

// ============================================================
// Finale sequence — Final cooking + Wedding montage + Credits
// ============================================================

/** Finale state: final_cook → wedding → credits → done */
var finale = {
    active: false,
    phase: 'final_cook',  // 'final_cook', 'wedding', 'credits', 'done'
    timer: 0,
    scrollY: 0,
    animTimer: 0,
    // Final cook sub-phase
    cookStep: 0,
    cookTimer: 0,
    // Wedding montage
    weddingSlide: 0,
    weddingSlideTimer: 0,
};

/** Characters for credits display. */
var CREDITS_LINES = [
    { type: 'title', text: 'THE SAUCE SISTERS' },
    { type: 'spacer' },
    { type: 'header', text: 'Cast' },
    { type: 'entry', text: 'Giulia ............ Player 1' },
    { type: 'entry', text: 'Coco .............. Player 2' },
    { type: 'entry', text: 'Brodo ............. Faithful Basset Hound' },
    { type: 'entry', text: 'Pepe .............. Energetic Chihuahua' },
    { type: 'entry', text: 'Papa Marco ........ World\'s Best Dad' },
    { type: 'entry', text: 'Mama Rosa ......... Keeper of Secrets' },
    { type: 'entry', text: 'Signora Betta ..... Market Maven' },
    { type: 'entry', text: 'Enzo .............. Rival Chef' },
    { type: 'entry', text: 'Bridget ........... Wedding Planner' },
    { type: 'spacer' },
    { type: 'header', text: 'Flavor NPCs' },
    { type: 'entry', text: 'Sous Chef Luigi  \u2022  Nonna Pina' },
    { type: 'entry', text: 'Old Sal  \u2022  Zia Carmela' },
    { type: 'entry', text: 'Signora Lucia  \u2022  Professor Gatto' },
    { type: 'entry', text: 'Coach Fabio  \u2022  Juice Bar Jenny' },
    { type: 'entry', text: 'Big Tony  \u2022  Vendor Gianluca' },
    { type: 'entry', text: 'Nonna Viola  \u2022  Accordion Carlo' },
    { type: 'entry', text: 'Waiter Marco Jr.  \u2022  Waitress Sofia' },
    { type: 'entry', text: 'Signora Threads  \u2022  Little Tom\u00e1s' },
    { type: 'spacer' },
    { type: 'header', text: 'Music & Sound' },
    { type: 'entry', text: 'Procedural Music ........ Tone.js' },
    { type: 'entry', text: 'Sound Effects ........... Howler.js + Kenney.nl' },
    { type: 'spacer' },
    { type: 'header', text: 'Technology' },
    { type: 'entry', text: 'HTML5 Canvas  \u2022  Vanilla JavaScript' },
    { type: 'entry', text: 'No frameworks. No build tools.' },
    { type: 'entry', text: 'Just tomatoes and determination.' },
    { type: 'spacer' },
    { type: 'header', text: 'Special Thanks' },
    { type: 'entry', text: 'To every tomato that gave its life for this sauce.' },
    { type: 'entry', text: 'To Papa\'s gym playlist for keeping morale high.' },
    { type: 'entry', text: 'To Brodo, for always sniffing in the right direction.' },
    { type: 'spacer' },
    { type: 'spacer' },
    { type: 'title', text: 'THE WEDDING WAS SAVED!' },
    { type: 'entry', text: 'Mama\'s secret sauce brought everyone together.' },
    { type: 'spacer' },
    { type: 'header', text: 'THE END' },
    { type: 'spacer' },
    { type: 'spacer' },
    { type: 'entry', text: 'Thanks for playing!' },
    { type: 'spacer' },
    { type: 'spacer' },
    { type: 'spacer' },
];

/** Wedding montage slides — text descriptions of scenes. */
var WEDDING_SLIDES = [
    { title: 'The Kitchen', text: 'Giulia and Coco assembled all five recipe fragments\nand began cooking Mama\'s legendary sauce...', color: '#ffcc66' },
    { title: 'The Sauce', text: 'The kitchen filled with the most incredible aroma.\nTomatoes, herbs, love... and a pinch of adventure.', color: '#ff6644' },
    { title: 'The Wedding', text: 'The guests arrived. The tables were set.\nEverything was perfect.', color: '#88ccff' },
    { title: 'The Feast', text: 'When the sauce was served, there was silence.\nThen applause. Then seconds. Then thirds.', color: '#ffdd44' },
    { title: 'The Family', text: 'Papa Marco cried. Mama Rosa smiled.\nEven Enzo admitted it was good.\n(Under his breath. Very quietly.)', color: '#ff88aa' },
    { title: 'The Promise', text: 'The sisters promised to protect the recipe.\nBut they added one new ingredient:\ntheir own adventure.', color: '#aaddff' },
];

/** Starts the finale sequence. Called after wedding boss is defeated and all recipes found. */
function startFinale() {
    finale.active = true;
    finale.phase = 'wedding';
    finale.timer = 0;
    finale.animTimer = 0;
    finale.scrollY = 0;
    finale.weddingSlide = 0;
    finale.weddingSlideTimer = 0;
    game.mode = 'finale';
    setFlag('finale_started', true);
    // Stop zone music
    if (typeof stopAllMusic === 'function') stopAllMusic();
}

/** Updates the finale sequence. */
function updateFinale(dt) {
    if (!finale.active) return;
    finale.timer += dt;
    finale.animTimer += dt;

    if (finale.phase === 'wedding') {
        finale.weddingSlideTimer += dt;
        if (finale.weddingSlideTimer >= 4.0 || actionJustPressed('interact')) {
            finale.weddingSlide++;
            finale.weddingSlideTimer = 0;
            if (finale.weddingSlide >= WEDDING_SLIDES.length) {
                finale.phase = 'credits';
                finale.scrollY = CONFIG.CANVAS_H;
            }
        }
    } else if (finale.phase === 'credits') {
        finale.scrollY -= 40 * dt; // scroll speed
        // Check if all credits have scrolled past
        var totalHeight = CREDITS_LINES.length * 30 + 100;
        if (finale.scrollY < -totalHeight) {
            finale.phase = 'done';
            finale.timer = 0;
        }
        // Skip with interact
        if (actionJustPressed('interact')) {
            finale.scrollY -= 200;
        }
    } else if (finale.phase === 'done') {
        // Wait for input to return to start
        if (finale.timer > 1.0 && actionJustPressed('interact')) {
            endFinale();
        }
    }
}

/** Renders the finale sequence. */
function renderFinale(ctx) {
    if (!finale.active) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;
    var t = finale.animTimer;

    // Background
    ctx.fillStyle = '#0a0a1a';
    ctx.fillRect(0, 0, W, H);

    if (finale.phase === 'wedding') {
        renderWeddingMontage(ctx, W, H, t);
    } else if (finale.phase === 'credits') {
        renderCredits(ctx, W, H, t);
    } else if (finale.phase === 'done') {
        // "Thanks for playing" screen
        ctx.fillStyle = '#0a0a1a';
        ctx.fillRect(0, 0, W, H);

        // Starfield
        for (var s = 0; s < 30; s++) {
            var sx = ((s * 137 + t * 10) % W);
            var sy = ((s * 89 + t * 5) % H);
            ctx.fillStyle = 'rgba(255,255,255,' + (0.3 + Math.sin(t * 2 + s) * 0.2) + ')';
            ctx.fillRect(sx, sy, 2, 2);
        }

        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('THE SAUCE SISTERS', W / 2, H / 2 - 30);

        ctx.fillStyle = '#ffffff';
        ctx.font = '16px monospace';
        ctx.fillText('Thanks for playing!', W / 2, H / 2 + 20);

        if (finale.timer > 1.0 && Math.sin(t * 3) > 0) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '12px monospace';
            ctx.fillText('Press Space to return', W / 2, H / 2 + 60);
        }
    }
}

/** Renders the wedding montage slideshow. */
function renderWeddingMontage(ctx, W, H, t) {
    var slide = WEDDING_SLIDES[finale.weddingSlide];
    if (!slide) return;

    // Fade in/out
    var slideT = finale.weddingSlideTimer;
    var alpha = 1;
    if (slideT < 0.5) alpha = slideT / 0.5;
    if (slideT > 3.5) alpha = (4.0 - slideT) / 0.5;
    alpha = Math.max(0, Math.min(1, alpha));

    // Background with slide color tint
    var grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.6);
    grad.addColorStop(0, slide.color + '44');
    grad.addColorStop(1, '#0a0a1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.globalAlpha = alpha;

    // Decorative frame
    ctx.strokeStyle = slide.color;
    ctx.lineWidth = 3;
    var fx = W * 0.15, fy = H * 0.2, fw = W * 0.7, fh = H * 0.6;
    ctx.strokeRect(fx, fy, fw, fh);
    ctx.strokeStyle = slide.color + '44';
    ctx.lineWidth = 1;
    ctx.strokeRect(fx - 6, fy - 6, fw + 12, fh + 12);

    // Title
    ctx.fillStyle = slide.color;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(slide.title, W / 2, fy + 40);

    // Divider
    ctx.fillStyle = slide.color + '88';
    ctx.fillRect(W / 2 - 60, fy + 50, 120, 2);

    // Text (multi-line)
    ctx.fillStyle = '#ffffff';
    ctx.font = '14px monospace';
    var lines = slide.text.split('\n');
    for (var i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], W / 2, fy + 80 + i * 24);
    }

    // Slide indicator
    ctx.fillStyle = '#ffffff';
    ctx.font = '10px monospace';
    ctx.fillText((finale.weddingSlide + 1) + ' / ' + WEDDING_SLIDES.length, W / 2, fy + fh - 20);

    ctx.globalAlpha = 1;

    // "Press Z" hint
    if (slideT > 1.0 && Math.sin(t * 3) > 0) {
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Press Z / Space to continue', W / 2, H - 30);
    }
}

/** Renders scrolling credits. */
function renderCredits(ctx, W, H, t) {
    // Starfield background
    for (var s = 0; s < 50; s++) {
        var sx = ((s * 137 + t * 8) % W);
        var sy = ((s * 89 + s * 23) % H);
        ctx.fillStyle = 'rgba(255,255,255,' + (0.2 + Math.sin(t + s) * 0.15) + ')';
        ctx.fillRect(sx, sy, 2, 2);
    }

    var y = finale.scrollY;
    for (var i = 0; i < CREDITS_LINES.length; i++) {
        var line = CREDITS_LINES[i];
        var lineY = y + i * 30;

        // Skip if off screen
        if (lineY < -40 || lineY > H + 40) continue;

        // Fade near edges
        var edgeAlpha = 1;
        if (lineY < 40) edgeAlpha = lineY / 40;
        if (lineY > H - 40) edgeAlpha = (H - lineY) / 40;
        edgeAlpha = Math.max(0, Math.min(1, edgeAlpha));

        ctx.globalAlpha = edgeAlpha;
        ctx.textAlign = 'center';

        if (line.type === 'title') {
            ctx.fillStyle = '#ffd700';
            ctx.font = 'bold 24px monospace';
            ctx.fillText(line.text, W / 2, lineY);
        } else if (line.type === 'header') {
            ctx.fillStyle = '#ff8866';
            ctx.font = 'bold 16px monospace';
            ctx.fillText(line.text, W / 2, lineY);
        } else if (line.type === 'entry') {
            ctx.fillStyle = '#cccccc';
            ctx.font = '13px monospace';
            ctx.fillText(line.text, W / 2, lineY);
        }
        // spacer = just skip
    }
    ctx.globalAlpha = 1;

    // Skip hint
    ctx.fillStyle = '#555555';
    ctx.font = '9px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press Z / Space to skip', W / 2, H - 12);
}

/** Ends the finale — resets back to La Cucina (game complete state). */
function endFinale() {
    finale.active = false;
    game.mode = 'overworld';
    setFlag('game_complete', true);
    loadZone('la_cucina');
}

// ============================================================
// Pepe's Obstacle Dash — Endless runner interlude
// ============================================================

/** Pepe dash config. */
var PEPE_CONFIG = {
    DURATION: 30,           // max seconds
    LANE_COUNT: 3,          // top, middle, bottom
    LANE_HEIGHT: 60,        // pixels per lane
    PEPE_X: 80,             // fixed X position
    OBSTACLE_SPEED_BASE: 200,
    OBSTACLE_SPEED_RAMP: 4, // speed increase per second
    SPAWN_INTERVAL_BASE: 1.0,
    SPAWN_INTERVAL_MIN: 0.35,
    INTRO_TIME: 2.0,
    RESULT_TIME: 3.0,
    TRIGGER_CHANCE: 0.4,    // 40% chance between zones
};

/** Pepe dash state. */
var pepeDash = {
    active: false,
    phase: 'intro',         // 'intro', 'running', 'result'
    introTimer: 0,
    resultTimer: 0,
    timer: 0,               // elapsed game time
    lane: 1,                // 0=top, 1=mid, 2=bottom (start middle)
    targetLane: 1,
    pepeY: 0,               // actual Y (lerps toward lane)
    obstacles: [],
    spawnTimer: 0,
    score: 0,
    hits: 0,
    maxHits: 3,
    grade: '',
    reward: null,
    animTimer: 0,
    invulnTimer: 0,
    // Decorations
    groundScroll: 0,
    bushes: [],
};

/** Returns the Y position for a given lane. */
function pepeLaneY(lane) {
    var baseY = (CONFIG.CANVAS_H - PEPE_CONFIG.LANE_COUNT * PEPE_CONFIG.LANE_HEIGHT) / 2;
    return baseY + lane * PEPE_CONFIG.LANE_HEIGHT + PEPE_CONFIG.LANE_HEIGHT / 2 - 12;
}

/** Starts the Pepe obstacle dash interlude. */
function startPepeDash() {
    if (pepeDash.active) return;
    pepeDash.active = true;
    game.mode = 'pepe_dash';
    pepeDash.phase = 'intro';
    pepeDash.introTimer = PEPE_CONFIG.INTRO_TIME;
    pepeDash.resultTimer = 0;
    pepeDash.timer = 0;
    pepeDash.lane = 1;
    pepeDash.targetLane = 1;
    pepeDash.pepeY = pepeLaneY(1);
    pepeDash.obstacles = [];
    pepeDash.spawnTimer = 0.5;
    pepeDash.score = 0;
    pepeDash.hits = 0;
    pepeDash.grade = '';
    pepeDash.reward = null;
    pepeDash.animTimer = 0;
    pepeDash.invulnTimer = 0;
    pepeDash.groundScroll = 0;
    // Generate random bushes for scenery
    pepeDash.bushes = [];
    for (var i = 0; i < 12; i++) {
        pepeDash.bushes.push({
            x: Math.random() * CONFIG.CANVAS_W * 1.5,
            y: Math.random() * CONFIG.CANVAS_H,
            size: 8 + Math.random() * 12,
            shade: Math.random() * 0.3,
        });
    }
    if (typeof stopAllMusic === 'function') stopAllMusic();
}

/** Updates the Pepe dash each frame. */
function updatePepeDash(dt) {
    if (!pepeDash.active) return;
    pepeDash.animTimer += dt;

    // Intro countdown
    if (pepeDash.phase === 'intro') {
        pepeDash.introTimer -= dt;
        if (pepeDash.introTimer <= 0) {
            pepeDash.phase = 'running';
            pepeDash.timer = 0;
        }
        // Allow skip
        if (actionJustPressed('interact') && pepeDash.introTimer < 1.0) {
            pepeDash.phase = 'running';
            pepeDash.timer = 0;
        }
        return;
    }

    // Result screen
    if (pepeDash.phase === 'result') {
        pepeDash.resultTimer -= dt;
        if (pepeDash.resultTimer <= 0 && actionJustPressed('interact')) {
            endPepeDash();
        }
        if (pepeDash.resultTimer < -3) endPepeDash(); // auto-end
        return;
    }

    // Skip / quit with Escape
    if (isJustPressed('Escape')) {
        pepeDash.grade = 'C';
        pepeDash.reward = null;
        pepeDash.phase = 'result';
        pepeDash.resultTimer = PEPE_CONFIG.RESULT_TIME;
        return;
    }

    pepeDash.timer += dt;
    pepeDash.groundScroll += (PEPE_CONFIG.OBSTACLE_SPEED_BASE + pepeDash.timer * PEPE_CONFIG.OBSTACLE_SPEED_RAMP) * dt;
    if (pepeDash.invulnTimer > 0) pepeDash.invulnTimer -= dt;

    // Lane switching input
    if (isJustPressed('ArrowUp') || isJustPressed('KeyW')) {
        if (pepeDash.targetLane > 0) pepeDash.targetLane--;
    }
    if (isJustPressed('ArrowDown') || isJustPressed('KeyS')) {
        if (pepeDash.targetLane < PEPE_CONFIG.LANE_COUNT - 1) pepeDash.targetLane++;
    }

    // Lerp Pepe toward target lane
    var targetY = pepeLaneY(pepeDash.targetLane);
    pepeDash.pepeY += (targetY - pepeDash.pepeY) * 0.15;
    pepeDash.lane = pepeDash.targetLane;

    // Spawn obstacles
    var speed = PEPE_CONFIG.OBSTACLE_SPEED_BASE + pepeDash.timer * PEPE_CONFIG.OBSTACLE_SPEED_RAMP;
    var interval = Math.max(PEPE_CONFIG.SPAWN_INTERVAL_MIN,
        PEPE_CONFIG.SPAWN_INTERVAL_BASE - pepeDash.timer * 0.02);
    pepeDash.spawnTimer -= dt;
    if (pepeDash.spawnTimer <= 0) {
        spawnPepeObstacle();
        pepeDash.spawnTimer = interval + Math.random() * 0.3;
    }

    // Update obstacles
    for (var i = pepeDash.obstacles.length - 1; i >= 0; i--) {
        var obs = pepeDash.obstacles[i];
        obs.x -= speed * dt;
        // Remove if off screen
        if (obs.x < -40) {
            if (!obs.hit) pepeDash.score += 10; // survived this obstacle
            pepeDash.obstacles.splice(i, 1);
            continue;
        }
        // Collision with Pepe
        if (!obs.hit && pepeDash.invulnTimer <= 0) {
            var pepeX = PEPE_CONFIG.PEPE_X;
            var pepeW = 24, pepeH = 20;
            if (rectsOverlap(pepeX, pepeDash.pepeY, pepeW, pepeH,
                obs.x, obs.y - obs.h / 2, obs.w, obs.h)) {
                obs.hit = true;
                pepeDash.hits++;
                pepeDash.invulnTimer = 0.8;
                playEnemyHit();
            }
        }
    }

    // Score ticks up with time
    pepeDash.score += dt * 5;

    // End conditions: time up or too many hits
    if (pepeDash.timer >= PEPE_CONFIG.DURATION || pepeDash.hits >= pepeDash.maxHits) {
        finalizePepeDash();
    }
}

/** Spawns a random obstacle. */
function spawnPepeObstacle() {
    var lane = Math.floor(Math.random() * PEPE_CONFIG.LANE_COUNT);
    var types = ['barrel', 'crate', 'rock', 'puddle'];
    var type = types[Math.floor(Math.random() * types.length)];
    var w = type === 'puddle' ? 36 : 24;
    var h = type === 'puddle' ? 12 : 24;
    pepeDash.obstacles.push({
        x: CONFIG.CANVAS_W + 20,
        y: pepeLaneY(lane) + 10,
        w: w, h: h,
        lane: lane,
        type: type,
        hit: false,
    });
    // Occasionally spawn double (two lanes at once)
    if (pepeDash.timer > 10 && Math.random() < 0.3) {
        var lane2 = (lane + 1 + Math.floor(Math.random() * (PEPE_CONFIG.LANE_COUNT - 1))) % PEPE_CONFIG.LANE_COUNT;
        pepeDash.obstacles.push({
            x: CONFIG.CANVAS_W + 20,
            y: pepeLaneY(lane2) + 10,
            w: w, h: h,
            lane: lane2,
            type: types[Math.floor(Math.random() * types.length)],
            hit: false,
        });
    }
}

/** Calculates final grade and reward. */
function finalizePepeDash() {
    var survivalPct = pepeDash.timer / PEPE_CONFIG.DURATION;
    var hitPenalty = pepeDash.hits * 0.15;
    var finalScore = Math.max(0, survivalPct - hitPenalty);

    if (finalScore >= 0.9) {
        pepeDash.grade = 'S';
        pepeDash.reward = { type: 'powerup', id: 'brownie', name: 'Brodo Boost' };
    } else if (finalScore >= 0.7) {
        pepeDash.grade = 'A';
        pepeDash.reward = { type: 'powerup', id: 'chocolate_milk', name: 'Sugar Rush' };
    } else if (finalScore >= 0.4) {
        pepeDash.grade = 'B';
        pepeDash.reward = { type: 'item', id: 'tomato', name: 'Tomato' };
    } else {
        pepeDash.grade = 'C';
        pepeDash.reward = null;
    }

    pepeDash.phase = 'result';
    pepeDash.resultTimer = PEPE_CONFIG.RESULT_TIME;
}

/** Ends the Pepe dash — grant reward and return to zone transition. */
function endPepeDash() {
    if (pepeDash.reward) {
        if (pepeDash.reward.type === 'powerup') {
            activatePowerup(pepeDash.reward.id);
        } else if (pepeDash.reward.type === 'item') {
            addToInventory(pepeDash.reward.id);
        }
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = pepeDash.reward.name;
    }

    pepeDash.active = false;
    game.mode = 'overworld';

    // Return to the destination zone
    if (game.pepeReturnZone) {
        loadZone(game.pepeReturnZone, game.pepeReturnSpawnX, game.pepeReturnSpawnY);
        game.pepeReturnZone = null;
    }
}

/** Renders the Pepe obstacle dash. */
function renderPepeDash(ctx) {
    if (!pepeDash.active) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;
    var t = pepeDash.animTimer;

    // Sky gradient
    var skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, '#87ceeb');
    skyGrad.addColorStop(0.6, '#b0e0e6');
    skyGrad.addColorStop(1, '#90ee90');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    // Scrolling ground
    var gScroll = pepeDash.groundScroll % 64;
    ctx.fillStyle = '#6b8e23';
    ctx.fillRect(0, H * 0.75, W, H * 0.25);
    // Ground stripes
    ctx.fillStyle = '#5a7a1a';
    for (var gs = -1; gs < W / 64 + 2; gs++) {
        ctx.fillRect(gs * 64 - gScroll, H * 0.75, 32, H * 0.25);
    }

    // Bushes (parallax background)
    for (var bi = 0; bi < pepeDash.bushes.length; bi++) {
        var bush = pepeDash.bushes[bi];
        var bx = ((bush.x - pepeDash.groundScroll * 0.3) % (W * 1.5));
        if (bx < -30) bx += W * 1.5;
        ctx.fillStyle = 'rgba(34, 120, 40, ' + (0.4 + bush.shade) + ')';
        ctx.beginPath();
        ctx.arc(bx, bush.y * 0.3 + H * 0.15, bush.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // Lane areas
    var baseY = (H - PEPE_CONFIG.LANE_COUNT * PEPE_CONFIG.LANE_HEIGHT) / 2;
    for (var ln = 0; ln < PEPE_CONFIG.LANE_COUNT; ln++) {
        var ly = baseY + ln * PEPE_CONFIG.LANE_HEIGHT;
        ctx.fillStyle = ln % 2 === 0 ? 'rgba(139, 119, 101, 0.3)' : 'rgba(160, 140, 120, 0.25)';
        ctx.fillRect(0, ly, W, PEPE_CONFIG.LANE_HEIGHT);
        // Lane divider
        if (ln > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.2)';
            ctx.lineWidth = 1;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.moveTo(0, ly);
            ctx.lineTo(W, ly);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // Obstacles
    for (var oi = 0; oi < pepeDash.obstacles.length; oi++) {
        var obs = pepeDash.obstacles[oi];
        var ox = obs.x;
        var oy = obs.y;
        if (obs.hit) {
            ctx.globalAlpha = 0.3;
        }
        switch (obs.type) {
            case 'barrel':
                ctx.fillStyle = '#8b5e3c';
                ctx.fillRect(ox, oy - 12, 20, 24);
                ctx.fillStyle = '#6b3e1c';
                ctx.fillRect(ox + 2, oy - 8, 16, 2);
                ctx.fillRect(ox + 2, oy + 6, 16, 2);
                break;
            case 'crate':
                ctx.fillStyle = '#b5651d';
                ctx.fillRect(ox, oy - 12, 22, 22);
                ctx.strokeStyle = '#8b4513';
                ctx.lineWidth = 2;
                ctx.strokeRect(ox + 1, oy - 11, 20, 20);
                ctx.beginPath();
                ctx.moveTo(ox + 1, oy - 11);
                ctx.lineTo(ox + 21, oy + 9);
                ctx.stroke();
                break;
            case 'rock':
                ctx.fillStyle = '#888888';
                ctx.beginPath();
                ctx.ellipse(ox + 10, oy, 12, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#666666';
                ctx.beginPath();
                ctx.ellipse(ox + 12, oy - 2, 6, 5, 0.3, 0, Math.PI * 2);
                ctx.fill();
                break;
            case 'puddle':
                ctx.fillStyle = 'rgba(60, 120, 200, 0.5)';
                ctx.beginPath();
                ctx.ellipse(ox + 18, oy, 18, 6, 0, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'rgba(100, 160, 240, 0.3)';
                ctx.beginPath();
                ctx.ellipse(ox + 20, oy - 2, 10, 3, 0, 0, Math.PI * 2);
                ctx.fill();
                break;
        }
        ctx.globalAlpha = 1;
    }

    // Pepe (chihuahua)
    var pepeX = PEPE_CONFIG.PEPE_X;
    var pepeY = pepeDash.pepeY;
    // Invulnerability blink
    if (pepeDash.invulnTimer > 0 && Math.floor(t * 10) % 2 === 0) {
        // skip drawing = blink
    } else {
        drawPepeRunner(ctx, pepeX, pepeY, t);
    }

    // HUD
    // Timer bar
    var timerPct = Math.min(pepeDash.timer / PEPE_CONFIG.DURATION, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 16, W - 40, 12);
    ctx.fillStyle = timerPct > 0.8 ? '#ff4444' : '#44cc44';
    ctx.fillRect(20, 16, (W - 40) * timerPct, 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 16, W - 40, 12);

    // Score + hits
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Score: ' + Math.floor(pepeDash.score), 20, 48);
    ctx.textAlign = 'right';
    // Hearts for hits remaining
    var livesLeft = pepeDash.maxHits - pepeDash.hits;
    var heartStr = '';
    for (var hi = 0; hi < pepeDash.maxHits; hi++) {
        heartStr += hi < livesLeft ? '\u2764 ' : '\u2661 ';
    }
    ctx.fillText(heartStr, W - 20, 48);

    // Time remaining
    var timeLeft = Math.max(0, PEPE_CONFIG.DURATION - pepeDash.timer);
    ctx.textAlign = 'center';
    ctx.fillText(Math.ceil(timeLeft) + 's', W / 2, 48);

    // Intro overlay
    if (pepeDash.phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText("PEPE'S OBSTACLE DASH!", W / 2, H / 2 - 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText('Dodge the obstacles! Use Up/Down to switch lanes.', W / 2, H / 2);
        ctx.fillText('Survive 30 seconds for the best score!', W / 2, H / 2 + 24);
        var countdown = Math.ceil(pepeDash.introTimer);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 36px monospace';
        ctx.fillText(countdown > 0 ? '' + countdown : 'GO!', W / 2, H / 2 + 80);
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText('Esc to skip', W / 2, H - 20);
    }

    // Result overlay
    if (pepeDash.phase === 'result') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('DASH COMPLETE!', W / 2, H / 2 - 60);

        // Grade
        var gradeColors = { S: '#ffd700', A: '#44cc44', B: '#4488ff', C: '#aaaaaa' };
        ctx.fillStyle = gradeColors[pepeDash.grade] || '#ffffff';
        ctx.font = 'bold 48px monospace';
        ctx.fillText(pepeDash.grade, W / 2, H / 2);

        // Stats
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText('Score: ' + Math.floor(pepeDash.score), W / 2, H / 2 + 30);
        ctx.fillText('Time: ' + pepeDash.timer.toFixed(1) + 's  |  Hits: ' + pepeDash.hits, W / 2, H / 2 + 50);

        // Reward
        if (pepeDash.reward) {
            ctx.fillStyle = '#ffcc44';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('Reward: ' + pepeDash.reward.name, W / 2, H / 2 + 80);
        } else {
            ctx.fillStyle = '#888888';
            ctx.font = '12px monospace';
            ctx.fillText('No reward this time.', W / 2, H / 2 + 80);
        }

        if (pepeDash.resultTimer <= 0 && Math.sin(t * 3) > 0) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '12px monospace';
            ctx.fillText('Press Space to continue', W / 2, H / 2 + 120);
        }
    }
}

/** Draws Pepe the chihuahua running. */
function drawPepeRunner(ctx, x, y, t) {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(x + 12, y + 20, 10, 3, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body — small tan chihuahua
    ctx.fillStyle = '#d4a060';
    ctx.fillRect(x + 2, y + 6, 18, 10);

    // Head
    ctx.fillStyle = '#d4a060';
    ctx.beginPath();
    ctx.arc(x + 22, y + 6, 8, 0, Math.PI * 2);
    ctx.fill();

    // Big ears (triangle-ish)
    ctx.fillStyle = '#c08840';
    ctx.beginPath();
    ctx.moveTo(x + 18, y + 2);
    ctx.lineTo(x + 16, y - 6);
    ctx.lineTo(x + 22, y);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + 24, y + 1);
    ctx.lineTo(x + 26, y - 5);
    ctx.lineTo(x + 28, y + 2);
    ctx.fill();

    // Eyes — big, eager
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(x + 24, y + 5, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 24, y + 4, 1, 1);

    // Nose
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.arc(x + 28, y + 7, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Legs — animated running cycle
    var legPhase = Math.sin(t * 16) * 4;
    ctx.fillStyle = '#c08840';
    // Front legs
    ctx.fillRect(x + 16, y + 14, 3, 6 + legPhase);
    ctx.fillRect(x + 12, y + 14, 3, 6 - legPhase);
    // Back legs
    ctx.fillRect(x + 4, y + 14, 3, 6 - legPhase);
    ctx.fillRect(x + 8, y + 14, 3, 6 + legPhase);

    // Tail — wagging
    var tailWag = Math.sin(t * 12) * 8;
    ctx.strokeStyle = '#c08840';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 2, y + 8);
    ctx.quadraticCurveTo(x - 4, y + tailWag, x - 6, y + 2 + tailWag * 0.5);
    ctx.stroke();
}

// ============================================================
// Tomato Juggling — Multi-lane reflex catching game
// ============================================================

/** Tomato juggling config. */
var JUGGLE_CONFIG = {
    DURATION: 35,           // seconds
    LANE_COUNT: 4,          // number of lanes
    LANE_WIDTH: 80,         // pixels per lane
    BASKET_W: 60,
    BASKET_H: 20,
    FALL_SPEED_BASE: 150,
    FALL_SPEED_RAMP: 5,     // speed increase per second
    SPAWN_INTERVAL_BASE: 0.9,
    SPAWN_INTERVAL_MIN: 0.3,
    INTRO_TIME: 2.0,
    RESULT_TIME: 3.0,
};

/** Tomato juggling state. */
var juggle = {
    active: false,
    phase: 'intro',         // 'intro', 'playing', 'result'
    introTimer: 0,
    resultTimer: 0,
    timer: 0,
    lane: 1,                // current basket lane (0-3)
    tomatoes: [],           // falling objects
    spawnTimer: 0,
    caught: 0,
    missed: 0,
    maxMissed: 5,
    combo: 0,
    maxCombo: 0,
    grade: '',
    reward: null,
    animTimer: 0,
    catchFlash: 0,
    missFlash: 0,
    // Splat effects
    splats: [],
};

/** Returns the X center of a lane. */
function juggleLaneX(lane) {
    var totalW = JUGGLE_CONFIG.LANE_COUNT * JUGGLE_CONFIG.LANE_WIDTH;
    var startX = (CONFIG.CANVAS_W - totalW) / 2;
    return startX + lane * JUGGLE_CONFIG.LANE_WIDTH + JUGGLE_CONFIG.LANE_WIDTH / 2;
}

/** Starts the tomato juggling interlude. */
function startJuggling() {
    if (juggle.active) return;
    juggle.active = true;
    game.mode = 'juggling';
    juggle.phase = 'intro';
    juggle.introTimer = JUGGLE_CONFIG.INTRO_TIME;
    juggle.resultTimer = 0;
    juggle.timer = 0;
    juggle.lane = 1;
    juggle.tomatoes = [];
    juggle.spawnTimer = 0.5;
    juggle.caught = 0;
    juggle.missed = 0;
    juggle.combo = 0;
    juggle.maxCombo = 0;
    juggle.grade = '';
    juggle.reward = null;
    juggle.animTimer = 0;
    juggle.catchFlash = 0;
    juggle.missFlash = 0;
    juggle.splats = [];
    if (typeof stopAllMusic === 'function') stopAllMusic();
}

/** Updates the tomato juggling each frame. */
function updateJuggling(dt) {
    if (!juggle.active) return;
    juggle.animTimer += dt;
    if (juggle.catchFlash > 0) juggle.catchFlash -= dt;
    if (juggle.missFlash > 0) juggle.missFlash -= dt;

    // Update splats
    for (var si = juggle.splats.length - 1; si >= 0; si--) {
        juggle.splats[si].timer -= dt;
        if (juggle.splats[si].timer <= 0) juggle.splats.splice(si, 1);
    }

    // Intro
    if (juggle.phase === 'intro') {
        juggle.introTimer -= dt;
        if (juggle.introTimer <= 0) {
            juggle.phase = 'playing';
            juggle.timer = 0;
        }
        if (actionJustPressed('interact') && juggle.introTimer < 1.0) {
            juggle.phase = 'playing';
            juggle.timer = 0;
        }
        return;
    }

    // Result
    if (juggle.phase === 'result') {
        juggle.resultTimer -= dt;
        if (juggle.resultTimer <= 0 && actionJustPressed('interact')) {
            endJuggling();
        }
        if (juggle.resultTimer < -3) endJuggling();
        return;
    }

    // Skip with Escape
    if (isJustPressed('Escape')) {
        juggle.grade = 'C';
        juggle.reward = null;
        juggle.phase = 'result';
        juggle.resultTimer = JUGGLE_CONFIG.RESULT_TIME;
        return;
    }

    juggle.timer += dt;

    // Lane switching
    if (isJustPressed('ArrowLeft') || isJustPressed('KeyA')) {
        if (juggle.lane > 0) juggle.lane--;
    }
    if (isJustPressed('ArrowRight') || isJustPressed('KeyD')) {
        if (juggle.lane < JUGGLE_CONFIG.LANE_COUNT - 1) juggle.lane++;
    }

    // Spawn tomatoes
    var speed = JUGGLE_CONFIG.FALL_SPEED_BASE + juggle.timer * JUGGLE_CONFIG.FALL_SPEED_RAMP;
    var interval = Math.max(JUGGLE_CONFIG.SPAWN_INTERVAL_MIN,
        JUGGLE_CONFIG.SPAWN_INTERVAL_BASE - juggle.timer * 0.018);
    juggle.spawnTimer -= dt;
    if (juggle.spawnTimer <= 0) {
        spawnJuggleTomato();
        juggle.spawnTimer = interval + Math.random() * 0.2;
    }

    // Update falling tomatoes
    var basketY = CONFIG.CANVAS_H - 80;
    for (var i = juggle.tomatoes.length - 1; i >= 0; i--) {
        var tom = juggle.tomatoes[i];
        tom.y += speed * dt;
        tom.rot += tom.rotSpeed * dt;

        // Caught check — tomato reaches basket level in correct lane
        if (tom.y >= basketY - 10 && tom.y <= basketY + 20 && !tom.caught && !tom.missed) {
            if (tom.lane === juggle.lane) {
                tom.caught = true;
                juggle.caught++;
                juggle.combo++;
                if (juggle.combo > juggle.maxCombo) juggle.maxCombo = juggle.combo;
                juggle.catchFlash = 0.3;
                playItemPickup();
            }
        }

        // Missed — fell past basket
        if (tom.y > basketY + 30 && !tom.caught && !tom.missed) {
            tom.missed = true;
            juggle.missed++;
            juggle.combo = 0;
            juggle.missFlash = 0.3;
            // Splat on ground
            juggle.splats.push({
                x: juggleLaneX(tom.lane),
                y: CONFIG.CANVAS_H - 30,
                timer: 1.0,
            });
        }

        // Remove if off screen
        if (tom.y > CONFIG.CANVAS_H + 40) {
            juggle.tomatoes.splice(i, 1);
        }
    }

    // End conditions
    if (juggle.timer >= JUGGLE_CONFIG.DURATION || juggle.missed >= juggle.maxMissed) {
        finalizeJuggling();
    }
}

/** Spawns a falling tomato in a random lane. */
function spawnJuggleTomato() {
    var lane = Math.floor(Math.random() * JUGGLE_CONFIG.LANE_COUNT);
    // Occasionally spawn a golden tomato (bonus points)
    var golden = juggle.timer > 8 && Math.random() < 0.12;
    juggle.tomatoes.push({
        lane: lane,
        x: juggleLaneX(lane),
        y: -20,
        rot: 0,
        rotSpeed: (Math.random() - 0.5) * 6,
        caught: false,
        missed: false,
        golden: golden,
    });
    // Double spawn after 15s
    if (juggle.timer > 15 && Math.random() < 0.25) {
        var lane2 = (lane + 1 + Math.floor(Math.random() * (JUGGLE_CONFIG.LANE_COUNT - 1))) % JUGGLE_CONFIG.LANE_COUNT;
        juggle.tomatoes.push({
            lane: lane2,
            x: juggleLaneX(lane2),
            y: -20 - Math.random() * 30,
            rot: 0,
            rotSpeed: (Math.random() - 0.5) * 6,
            caught: false,
            missed: false,
            golden: false,
        });
    }
}

/** Calculates final grade and reward. */
function finalizeJuggling() {
    var total = juggle.caught + juggle.missed;
    var catchRate = total > 0 ? juggle.caught / total : 0;

    if (catchRate >= 0.9 && juggle.maxCombo >= 8) {
        juggle.grade = 'S';
        juggle.reward = { type: 'powerup', id: 'brownie', name: 'Brodo Boost' };
    } else if (catchRate >= 0.75) {
        juggle.grade = 'A';
        juggle.reward = { type: 'powerup', id: 'chocolate_milk', name: 'Sugar Rush' };
    } else if (catchRate >= 0.5) {
        juggle.grade = 'B';
        juggle.reward = { type: 'item', id: 'tomato', name: 'Tomato' };
    } else {
        juggle.grade = 'C';
        juggle.reward = null;
    }

    juggle.phase = 'result';
    juggle.resultTimer = JUGGLE_CONFIG.RESULT_TIME;
}

/** Ends the juggling — grant reward and return. */
function endJuggling() {
    if (juggle.reward) {
        if (juggle.reward.type === 'powerup') {
            activatePowerup(juggle.reward.id);
        } else if (juggle.reward.type === 'item') {
            addToInventory(juggle.reward.id);
        }
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = juggle.reward.name;
    }

    setFlag('juggling_completed', true);
    setFlag('juggling_grade', juggle.grade);

    juggle.active = false;
    game.mode = 'overworld';

    if (game.juggleReturnZone) {
        loadZone(game.juggleReturnZone, game.juggleReturnSpawnX, game.juggleReturnSpawnY);
        game.juggleReturnZone = null;
    }
}

/** Renders the tomato juggling game. */
function renderJuggling(ctx) {
    if (!juggle.active) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;
    var t = juggle.animTimer;

    // Dark kitchen background
    var bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#1a1a2e');
    bgGrad.addColorStop(1, '#2d2d44');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Lane columns
    var totalW = JUGGLE_CONFIG.LANE_COUNT * JUGGLE_CONFIG.LANE_WIDTH;
    var startX = (W - totalW) / 2;
    for (var ln = 0; ln < JUGGLE_CONFIG.LANE_COUNT; ln++) {
        var lx = startX + ln * JUGGLE_CONFIG.LANE_WIDTH;
        ctx.fillStyle = ln % 2 === 0 ? 'rgba(80, 60, 40, 0.3)' : 'rgba(60, 45, 30, 0.3)';
        ctx.fillRect(lx, 0, JUGGLE_CONFIG.LANE_WIDTH, H);
        // Lane divider
        if (ln > 0) {
            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(lx, 0);
            ctx.lineTo(lx, H);
            ctx.stroke();
        }
    }

    // Ground / counter
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(startX - 10, H - 50, totalW + 20, 50);
    ctx.fillStyle = '#7a5a40';
    ctx.fillRect(startX - 10, H - 50, totalW + 20, 4);

    // Splats on counter
    for (var si = 0; si < juggle.splats.length; si++) {
        var sp = juggle.splats[si];
        var sAlpha = Math.min(sp.timer / 0.3, 1) * 0.6;
        ctx.fillStyle = 'rgba(200, 50, 30, ' + sAlpha + ')';
        ctx.beginPath();
        ctx.ellipse(sp.x, sp.y, 12, 5, 0, 0, Math.PI * 2);
        ctx.fill();
    }

    // Basket
    var basketX = juggleLaneX(juggle.lane);
    var basketY = H - 80;
    var bw = JUGGLE_CONFIG.BASKET_W;
    var bh = JUGGLE_CONFIG.BASKET_H;
    // Basket glow on catch
    if (juggle.catchFlash > 0) {
        ctx.fillStyle = 'rgba(255, 215, 0, ' + (juggle.catchFlash / 0.3 * 0.3) + ')';
        ctx.beginPath();
        ctx.arc(basketX, basketY + bh / 2, 40, 0, Math.PI * 2);
        ctx.fill();
    }
    // Basket body (wicker-style)
    ctx.fillStyle = '#c69c6d';
    ctx.beginPath();
    ctx.moveTo(basketX - bw / 2, basketY);
    ctx.lineTo(basketX - bw / 2 + 6, basketY + bh);
    ctx.lineTo(basketX + bw / 2 - 6, basketY + bh);
    ctx.lineTo(basketX + bw / 2, basketY);
    ctx.closePath();
    ctx.fill();
    // Basket rim
    ctx.strokeStyle = '#a07850';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(basketX - bw / 2 - 2, basketY);
    ctx.lineTo(basketX + bw / 2 + 2, basketY);
    ctx.stroke();
    // Wicker pattern
    ctx.strokeStyle = '#b08a5a';
    ctx.lineWidth = 1;
    for (var wl = 0; wl < 3; wl++) {
        var wy = basketY + 5 + wl * 5;
        ctx.beginPath();
        ctx.moveTo(basketX - bw / 2 + 4, wy);
        ctx.lineTo(basketX + bw / 2 - 4, wy);
        ctx.stroke();
    }

    // Falling tomatoes
    for (var ti = 0; ti < juggle.tomatoes.length; ti++) {
        var tom = juggle.tomatoes[ti];
        if (tom.caught) continue; // caught = disappeared
        var tx = tom.x;
        var ty = tom.y;
        if (tom.missed) {
            ctx.globalAlpha = 0.3;
        }
        ctx.save();
        ctx.translate(tx, ty);
        ctx.rotate(tom.rot);
        if (tom.golden) {
            // Golden tomato
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(0, 0, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffee88';
            ctx.beginPath();
            ctx.arc(-3, -3, 4, 0, Math.PI * 2);
            ctx.fill();
            // Star sparkle
            ctx.fillStyle = '#ffffff';
            var starA = t * 4;
            ctx.fillRect(Math.cos(starA) * 8 - 1, Math.sin(starA) * 8 - 1, 2, 2);
        } else {
            // Regular tomato
            ctx.fillStyle = '#cc3333';
            ctx.beginPath();
            ctx.arc(0, 0, 10, 0, Math.PI * 2);
            ctx.fill();
            // Highlight
            ctx.fillStyle = '#ee5555';
            ctx.beginPath();
            ctx.arc(-3, -3, 4, 0, Math.PI * 2);
            ctx.fill();
            // Stem
            ctx.fillStyle = '#33aa33';
            ctx.fillRect(-2, -12, 4, 4);
            ctx.fillStyle = '#228822';
            ctx.fillRect(-4, -10, 3, 2);
            ctx.fillRect(1, -10, 3, 2);
        }
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    // HUD — timer bar
    var timerPct = Math.min(juggle.timer / JUGGLE_CONFIG.DURATION, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(20, 16, W - 40, 12);
    ctx.fillStyle = timerPct > 0.8 ? '#ff4444' : '#44cc44';
    ctx.fillRect(20, 16, (W - 40) * timerPct, 12);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, 16, W - 40, 12);

    // Score + misses
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('Caught: ' + juggle.caught, 20, 48);
    ctx.textAlign = 'center';
    ctx.fillText('Combo: ' + juggle.combo, W / 2, 48);
    ctx.textAlign = 'right';
    // Miss counter as X marks
    var missStr = '';
    for (var mi = 0; mi < juggle.maxMissed; mi++) {
        missStr += mi < juggle.missed ? '\u2717 ' : '\u2610 ';
    }
    ctx.fillStyle = juggle.missed >= juggle.maxMissed - 1 ? '#ff4444' : '#ffffff';
    ctx.fillText(missStr, W - 20, 48);

    // Time remaining
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    var timeLeft = Math.max(0, JUGGLE_CONFIG.DURATION - juggle.timer);
    ctx.fillText(Math.ceil(timeLeft) + 's', W / 2, 28);

    // Miss flash (red border)
    if (juggle.missFlash > 0) {
        ctx.strokeStyle = 'rgba(255, 50, 50, ' + (juggle.missFlash / 0.3 * 0.5) + ')';
        ctx.lineWidth = 4;
        ctx.strokeRect(2, 2, W - 4, H - 4);
    }

    // Intro overlay
    if (juggle.phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('TOMATO JUGGLING!', W / 2, H / 2 - 40);
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText('Catch the falling tomatoes with Left/Right!', W / 2, H / 2);
        ctx.fillText('Golden tomatoes = bonus points!', W / 2, H / 2 + 24);
        var countdown = Math.ceil(juggle.introTimer);
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 36px monospace';
        ctx.fillText(countdown > 0 ? '' + countdown : 'GO!', W / 2, H / 2 + 80);
        ctx.fillStyle = '#888888';
        ctx.font = '10px monospace';
        ctx.fillText('Esc to skip', W / 2, H - 20);
    }

    // Result overlay
    if (juggle.phase === 'result') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff4444';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('JUGGLING COMPLETE!', W / 2, H / 2 - 70);

        var gradeColors = { S: '#ffd700', A: '#44cc44', B: '#4488ff', C: '#aaaaaa' };
        ctx.fillStyle = gradeColors[juggle.grade] || '#ffffff';
        ctx.font = 'bold 48px monospace';
        ctx.fillText(juggle.grade, W / 2, H / 2 - 10);

        ctx.fillStyle = '#ffffff';
        ctx.font = '14px monospace';
        ctx.fillText('Caught: ' + juggle.caught + '  |  Missed: ' + juggle.missed + '  |  Best Combo: ' + juggle.maxCombo, W / 2, H / 2 + 25);

        if (juggle.reward) {
            ctx.fillStyle = '#ffcc44';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('Reward: ' + juggle.reward.name, W / 2, H / 2 + 60);
        } else {
            ctx.fillStyle = '#888888';
            ctx.font = '12px monospace';
            ctx.fillText('No reward this time.', W / 2, H / 2 + 60);
        }

        if (juggle.resultTimer <= 0 && Math.sin(t * 3) > 0) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '12px monospace';
            ctx.fillText('Press Space to continue', W / 2, H / 2 + 100);
        }
    }
}

// ============================================================
// Coco's Air Guitar — Rhythm chord combo game (optional, Canal Z2)
// ============================================================

var GUITAR_CONFIG = { DURATION: 30, INTRO_TIME: 2.0, RESULT_TIME: 3.0 };

/** Air guitar chord patterns — sequences of arrow combos to match. */
var GUITAR_CHORDS = [
    { name: 'Power Chord', keys: ['ArrowLeft', 'ArrowDown'], time: 1.2 },
    { name: 'Riff', keys: ['ArrowRight', 'ArrowUp'], time: 1.2 },
    { name: 'Strum', keys: ['ArrowDown', 'ArrowRight', 'ArrowDown'], time: 1.8 },
    { name: 'Solo Lick', keys: ['ArrowUp', 'ArrowLeft', 'ArrowUp', 'ArrowRight'], time: 2.4 },
    { name: 'Windmill', keys: ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'], time: 2.0 },
    { name: 'Slam', keys: ['ArrowDown', 'ArrowDown', 'ArrowUp'], time: 1.6 },
    { name: 'Shred', keys: ['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'], time: 2.4 },
];

var guitar = {
    active: false, phase: 'intro', introTimer: 0, resultTimer: 0,
    timer: 0, animTimer: 0,
    currentChord: null, chordIndex: 0, inputIndex: 0, chordTimer: 0,
    perfect: 0, great: 0, ok: 0, miss: 0,
    totalChords: 0, grade: '', reward: null,
    feedback: '', feedbackTimer: 0, comboFlash: 0,
};

/** Starts Coco's air guitar interlude. */
function startAirGuitar() {
    if (guitar.active) return;
    guitar.active = true;
    game.mode = 'air_guitar';
    guitar.phase = 'intro';
    guitar.introTimer = GUITAR_CONFIG.INTRO_TIME;
    guitar.timer = 0; guitar.animTimer = 0;
    guitar.perfect = 0; guitar.great = 0; guitar.ok = 0; guitar.miss = 0;
    guitar.totalChords = 0; guitar.grade = ''; guitar.reward = null;
    guitar.feedback = ''; guitar.feedbackTimer = 0; guitar.comboFlash = 0;
    guitar.currentChord = null; guitar.inputIndex = 0;
    if (typeof stopAllMusic === 'function') stopAllMusic();
}

/** Picks the next chord to play. */
function nextGuitarChord() {
    var idx = Math.floor(Math.random() * GUITAR_CHORDS.length);
    guitar.currentChord = GUITAR_CHORDS[idx];
    guitar.chordTimer = guitar.currentChord.time;
    guitar.inputIndex = 0;
    guitar.totalChords++;
}

function updateAirGuitar(dt) {
    if (!guitar.active) return;
    guitar.animTimer += dt;
    if (guitar.feedbackTimer > 0) guitar.feedbackTimer -= dt;
    if (guitar.comboFlash > 0) guitar.comboFlash -= dt;

    if (guitar.phase === 'intro') {
        guitar.introTimer -= dt;
        if (guitar.introTimer <= 0) { guitar.phase = 'playing'; guitar.timer = 0; nextGuitarChord(); }
        if (actionJustPressed('interact') && guitar.introTimer < 1.0) { guitar.phase = 'playing'; guitar.timer = 0; nextGuitarChord(); }
        return;
    }
    if (guitar.phase === 'result') {
        guitar.resultTimer -= dt;
        if (guitar.resultTimer <= 0 && actionJustPressed('interact')) endAirGuitar();
        if (guitar.resultTimer < -3) endAirGuitar();
        return;
    }
    if (isJustPressed('Escape')) {
        guitar.grade = 'C'; guitar.reward = null;
        guitar.phase = 'result'; guitar.resultTimer = GUITAR_CONFIG.RESULT_TIME;
        return;
    }

    guitar.timer += dt;
    if (guitar.timer >= GUITAR_CONFIG.DURATION) { finalizeAirGuitar(); return; }

    // Chord timer countdown
    if (guitar.currentChord) {
        guitar.chordTimer -= dt;
        // Check input
        var keys = guitar.currentChord.keys;
        if (isJustPressed(keys[guitar.inputIndex])) {
            guitar.inputIndex++;
            guitar.comboFlash = 0.15;
            if (guitar.inputIndex >= keys.length) {
                // Completed chord!
                var remaining = guitar.chordTimer / guitar.currentChord.time;
                if (remaining > 0.5) { guitar.perfect++; guitar.feedback = 'PERFECT!'; }
                else if (remaining > 0.2) { guitar.great++; guitar.feedback = 'GREAT!'; }
                else { guitar.ok++; guitar.feedback = 'OK'; }
                guitar.feedbackTimer = 0.6;
                playItemPickup();
                nextGuitarChord();
            }
        } else {
            // Wrong key pressed?
            for (var ki = 0; ki < 4; ki++) {
                var arrowKeys = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
                if (isJustPressed(arrowKeys[ki]) && arrowKeys[ki] !== keys[guitar.inputIndex]) {
                    guitar.inputIndex = 0; // reset combo
                    break;
                }
            }
        }
        if (guitar.chordTimer <= 0) {
            guitar.miss++; guitar.feedback = 'MISS'; guitar.feedbackTimer = 0.6;
            nextGuitarChord();
        }
    }
}

function finalizeAirGuitar() {
    var total = guitar.perfect + guitar.great + guitar.ok + guitar.miss;
    var score = (guitar.perfect * 3 + guitar.great * 2 + guitar.ok) / Math.max(total * 3, 1);
    if (score >= 0.85) { guitar.grade = 'S'; guitar.reward = { type: 'powerup', id: 'chocolate_milk', name: 'Sugar Rush' }; }
    else if (score >= 0.65) { guitar.grade = 'A'; guitar.reward = { type: 'powerup', id: 'broccoli', name: 'Iron Legs' }; }
    else if (score >= 0.4) { guitar.grade = 'B'; guitar.reward = { type: 'item', id: 'tomato', name: 'Tomato' }; }
    else { guitar.grade = 'C'; guitar.reward = null; }
    guitar.phase = 'result'; guitar.resultTimer = GUITAR_CONFIG.RESULT_TIME;
    setFlag('air_guitar_completed', true);
}

function endAirGuitar() {
    if (guitar.reward) {
        if (guitar.reward.type === 'powerup') activatePowerup(guitar.reward.id);
        else if (guitar.reward.type === 'item') addToInventory(guitar.reward.id);
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = guitar.reward.name;
    }
    guitar.active = false; game.mode = 'overworld';
}

function renderAirGuitar(ctx) {
    if (!guitar.active) return;
    var W = CONFIG.CANVAS_W, H = CONFIG.CANVAS_H, t = guitar.animTimer;

    // Stage background
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1a0a2e'); grad.addColorStop(1, '#2d1a44');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    // Spotlight
    var spotGrad = ctx.createRadialGradient(W / 2, H * 0.6, 20, W / 2, H * 0.6, 200);
    spotGrad.addColorStop(0, 'rgba(255,200,100,0.15)'); spotGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = spotGrad; ctx.fillRect(0, 0, W, H);

    // Stage floor
    ctx.fillStyle = '#3a2a1a'; ctx.fillRect(0, H * 0.75, W, H * 0.25);

    if (guitar.phase === 'playing' && guitar.currentChord) {
        // Chord display
        var chord = guitar.currentChord;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 22px monospace'; ctx.textAlign = 'center';
        ctx.fillText(chord.name, W / 2, H * 0.25);

        // Arrow sequence display
        var arrowLabels = { ArrowUp: '\u2191', ArrowDown: '\u2193', ArrowLeft: '\u2190', ArrowRight: '\u2192' };
        var seqStr = '';
        for (var ki = 0; ki < chord.keys.length; ki++) {
            var label = arrowLabels[chord.keys[ki]] || '?';
            if (ki < guitar.inputIndex) {
                seqStr += '\u2713 '; // completed
            } else if (ki === guitar.inputIndex) {
                seqStr += '[' + label + '] ';
            } else {
                seqStr += label + ' ';
            }
        }
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 28px monospace';
        ctx.fillText(seqStr, W / 2, H * 0.4);

        // Timer bar for chord
        var chordPct = guitar.chordTimer / chord.time;
        var barW = 200;
        ctx.fillStyle = '#333'; ctx.fillRect(W / 2 - barW / 2, H * 0.5, barW, 10);
        ctx.fillStyle = chordPct > 0.3 ? '#44cc44' : '#ff4444';
        ctx.fillRect(W / 2 - barW / 2, H * 0.5, barW * chordPct, 10);

        // Combo flash
        if (guitar.comboFlash > 0) {
            ctx.fillStyle = 'rgba(255,215,0,' + (guitar.comboFlash / 0.15 * 0.3) + ')';
            ctx.fillRect(0, 0, W, H);
        }
    }

    // Coco character (simple silhouette with guitar pose)
    ctx.fillStyle = '#e94560';
    ctx.beginPath(); ctx.arc(W / 2, H * 0.65, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillRect(W / 2 - 6, H * 0.65 + 10, 12, 20);
    // Guitar shape
    ctx.fillStyle = '#8b4513';
    ctx.save(); ctx.translate(W / 2 + 10, H * 0.65 + 5);
    ctx.rotate(Math.sin(t * 3) * 0.1 - 0.3);
    ctx.fillRect(-3, -15, 6, 30);
    ctx.beginPath(); ctx.ellipse(0, 18, 10, 7, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Feedback text
    if (guitar.feedbackTimer > 0) {
        var fbColors = { 'PERFECT!': '#ffd700', 'GREAT!': '#44cc44', 'OK': '#4488ff', 'MISS': '#ff4444' };
        ctx.fillStyle = fbColors[guitar.feedback] || '#ffffff';
        ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText(guitar.feedback, W / 2, H * 0.55 - guitar.feedbackTimer * 30);
    }

    // HUD
    ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText('P:' + guitar.perfect + ' G:' + guitar.great + ' OK:' + guitar.ok + ' M:' + guitar.miss, 20, 20);
    ctx.textAlign = 'right';
    ctx.fillText(Math.ceil(Math.max(0, GUITAR_CONFIG.DURATION - guitar.timer)) + 's', W - 20, 20);

    // Intro/Result overlays
    if (guitar.phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff6600'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
        ctx.fillText("COCO'S AIR GUITAR!", W / 2, H / 2 - 40);
        ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace';
        ctx.fillText('Match the arrow combos before time runs out!', W / 2, H / 2);
        var cd = Math.ceil(guitar.introTimer);
        ctx.fillStyle = '#ff6600'; ctx.font = 'bold 36px monospace';
        ctx.fillText(cd > 0 ? '' + cd : 'ROCK!', W / 2, H / 2 + 60);
        ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.fillText('Esc to skip', W / 2, H - 20);
    }
    if (guitar.phase === 'result') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ff6600'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText('ENCORE!', W / 2, H / 2 - 60);
        var gc = { S: '#ffd700', A: '#44cc44', B: '#4488ff', C: '#aaaaaa' };
        ctx.fillStyle = gc[guitar.grade] || '#fff'; ctx.font = 'bold 48px monospace';
        ctx.fillText(guitar.grade, W / 2, H / 2);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText('P:' + guitar.perfect + ' G:' + guitar.great + ' OK:' + guitar.ok + ' Miss:' + guitar.miss, W / 2, H / 2 + 30);
        if (guitar.reward) { ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 14px monospace'; ctx.fillText('Reward: ' + guitar.reward.name, W / 2, H / 2 + 60); }
        else { ctx.fillStyle = '#888'; ctx.font = '12px monospace'; ctx.fillText('No reward.', W / 2, H / 2 + 60); }
        if (guitar.resultTimer <= 0 && Math.sin(t * 3) > 0) { ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.fillText('Press Space to continue', W / 2, H / 2 + 100); }
    }
}

// ============================================================
// Signora Betta's Accordion — Simon Says memory game (optional, Market Z1)
// ============================================================

var ACCORDION_CONFIG = { ROUNDS: 8, SHOW_SPEED: 0.6, INTRO_TIME: 2.0, RESULT_TIME: 3.0 };

var accordion = {
    active: false, phase: 'intro', introTimer: 0, resultTimer: 0,
    animTimer: 0,
    sequence: [],           // the full sequence of directions
    showIndex: 0,           // current index being shown
    inputIndex: 0,          // player's current input position
    round: 0,               // current round (sequence length)
    showTimer: 0,           // timer for showing each element
    showingSequence: false,  // true while displaying sequence
    playerTurn: false,       // true when player should input
    correct: 0, wrong: 0,
    grade: '', reward: null,
    feedback: '', feedbackTimer: 0,
    buttonFlash: [0, 0, 0, 0], // flash timers for ↑↓←→
};

var ACCORDION_DIRS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
var ACCORDION_LABELS = ['\u2191', '\u2193', '\u2190', '\u2192'];
var ACCORDION_COLORS = ['#4488ff', '#44cc44', '#ff6644', '#ffcc44'];

function startAccordion() {
    if (accordion.active) return;
    accordion.active = true;
    game.mode = 'accordion';
    accordion.phase = 'intro';
    accordion.introTimer = ACCORDION_CONFIG.INTRO_TIME;
    accordion.animTimer = 0;
    accordion.sequence = [];
    accordion.round = 0; accordion.correct = 0; accordion.wrong = 0;
    accordion.grade = ''; accordion.reward = null;
    accordion.feedback = ''; accordion.feedbackTimer = 0;
    accordion.buttonFlash = [0, 0, 0, 0];
    if (typeof stopAllMusic === 'function') stopAllMusic();
}

/** Advances to the next round — adds one element and starts showing. */
function nextAccordionRound() {
    accordion.round++;
    accordion.sequence.push(Math.floor(Math.random() * 4)); // 0-3 = ↑↓←→
    accordion.showIndex = 0;
    accordion.inputIndex = 0;
    accordion.showingSequence = true;
    accordion.playerTurn = false;
    accordion.showTimer = ACCORDION_CONFIG.SHOW_SPEED;
}

function updateAccordion(dt) {
    if (!accordion.active) return;
    accordion.animTimer += dt;
    if (accordion.feedbackTimer > 0) accordion.feedbackTimer -= dt;
    for (var bi = 0; bi < 4; bi++) { if (accordion.buttonFlash[bi] > 0) accordion.buttonFlash[bi] -= dt; }

    if (accordion.phase === 'intro') {
        accordion.introTimer -= dt;
        if (accordion.introTimer <= 0) { accordion.phase = 'playing'; nextAccordionRound(); }
        if (actionJustPressed('interact') && accordion.introTimer < 1.0) { accordion.phase = 'playing'; nextAccordionRound(); }
        return;
    }
    if (accordion.phase === 'result') {
        accordion.resultTimer -= dt;
        if (accordion.resultTimer <= 0 && actionJustPressed('interact')) endAccordion();
        if (accordion.resultTimer < -3) endAccordion();
        return;
    }
    if (isJustPressed('Escape')) {
        accordion.grade = 'C'; accordion.reward = null;
        accordion.phase = 'result'; accordion.resultTimer = ACCORDION_CONFIG.RESULT_TIME;
        return;
    }

    // Showing sequence
    if (accordion.showingSequence) {
        accordion.showTimer -= dt;
        if (accordion.showTimer <= 0) {
            if (accordion.showIndex < accordion.sequence.length) {
                accordion.buttonFlash[accordion.sequence[accordion.showIndex]] = 0.4;
                accordion.showIndex++;
                accordion.showTimer = ACCORDION_CONFIG.SHOW_SPEED;
            } else {
                accordion.showingSequence = false;
                accordion.playerTurn = true;
                accordion.inputIndex = 0;
            }
        }
        return;
    }

    // Player turn
    if (accordion.playerTurn) {
        for (var di = 0; di < 4; di++) {
            if (isJustPressed(ACCORDION_DIRS[di])) {
                accordion.buttonFlash[di] = 0.3;
                if (di === accordion.sequence[accordion.inputIndex]) {
                    accordion.inputIndex++;
                    if (accordion.inputIndex >= accordion.sequence.length) {
                        // Round complete!
                        accordion.correct++;
                        accordion.feedback = 'Correct!'; accordion.feedbackTimer = 0.5;
                        accordion.playerTurn = false;
                        playItemPickup();
                        if (accordion.round >= ACCORDION_CONFIG.ROUNDS) {
                            finalizeAccordion();
                        } else {
                            // Brief pause then next round
                            setTimeout(function() { if (accordion.active && accordion.phase === 'playing') nextAccordionRound(); }, 600);
                        }
                    }
                } else {
                    // Wrong!
                    accordion.wrong++;
                    accordion.feedback = 'Wrong!'; accordion.feedbackTimer = 0.5;
                    accordion.playerTurn = false;
                    playEnemyHit();
                    if (accordion.wrong >= 3) {
                        finalizeAccordion();
                    } else {
                        setTimeout(function() { if (accordion.active && accordion.phase === 'playing') nextAccordionRound(); }, 600);
                    }
                }
                break;
            }
        }
    }
}

function finalizeAccordion() {
    var pct = accordion.correct / ACCORDION_CONFIG.ROUNDS;
    if (pct >= 0.9) { accordion.grade = 'S'; accordion.reward = { type: 'powerup', id: 'brownie', name: 'Brodo Boost' }; }
    else if (pct >= 0.7) { accordion.grade = 'A'; accordion.reward = { type: 'powerup', id: 'water', name: 'Cool Head' }; }
    else if (pct >= 0.4) { accordion.grade = 'B'; accordion.reward = { type: 'item', id: 'flour', name: 'Bag of Flour' }; }
    else { accordion.grade = 'C'; accordion.reward = null; }
    accordion.phase = 'result'; accordion.resultTimer = ACCORDION_CONFIG.RESULT_TIME;
    setFlag('accordion_completed', true);
}

function endAccordion() {
    if (accordion.reward) {
        if (accordion.reward.type === 'powerup') activatePowerup(accordion.reward.id);
        else if (accordion.reward.type === 'item') addToInventory(accordion.reward.id);
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = accordion.reward.name;
    }
    accordion.active = false; game.mode = 'overworld';
}

function renderAccordion(ctx) {
    if (!accordion.active) return;
    var W = CONFIG.CANVAS_W, H = CONFIG.CANVAS_H, t = accordion.animTimer;

    // Background — warm market atmosphere
    ctx.fillStyle = '#2a1a0a'; ctx.fillRect(0, 0, W, H);
    var grad = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.5);
    grad.addColorStop(0, 'rgba(180,120,60,0.15)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    if (accordion.phase === 'playing') {
        // Four directional buttons
        var btnSize = 60, gap = 20;
        var cx = W / 2, cy = H / 2;
        var positions = [
            { x: cx, y: cy - btnSize - gap / 2 },   // up
            { x: cx, y: cy + gap / 2 },               // down
            { x: cx - btnSize - gap / 2, y: cy - btnSize / 2 + gap / 4 }, // left
            { x: cx + gap / 2, y: cy - btnSize / 2 + gap / 4 },           // right
        ];
        for (var bi = 0; bi < 4; bi++) {
            var bp = positions[bi];
            var flash = accordion.buttonFlash[bi];
            var alpha = flash > 0 ? 0.9 : 0.3;
            ctx.fillStyle = ACCORDION_COLORS[bi];
            ctx.globalAlpha = alpha;
            ctx.fillRect(bp.x - btnSize / 2, bp.y, btnSize, btnSize);
            ctx.globalAlpha = 1;
            // Arrow label
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
            ctx.fillText(ACCORDION_LABELS[bi], bp.x, bp.y + btnSize / 2 + 8);
        }

        // Round indicator
        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Round ' + accordion.round + ' / ' + ACCORDION_CONFIG.ROUNDS, W / 2, 30);

        // Status
        ctx.fillStyle = '#ffcc44'; ctx.font = '14px monospace';
        if (accordion.showingSequence) {
            ctx.fillText('Watch the sequence...', W / 2, H - 60);
        } else if (accordion.playerTurn) {
            ctx.fillText('Your turn! Repeat the sequence.', W / 2, H - 60);
            // Show progress dots
            var dotStr = '';
            for (var di = 0; di < accordion.sequence.length; di++) {
                dotStr += di < accordion.inputIndex ? '\u25cf ' : '\u25cb ';
            }
            ctx.fillText(dotStr, W / 2, H - 40);
        }

        // Wrong count
        ctx.fillStyle = '#ff4444'; ctx.textAlign = 'right'; ctx.font = '12px monospace';
        ctx.fillText('Mistakes: ' + accordion.wrong + '/3', W - 20, 30);
    }

    // Feedback
    if (accordion.feedbackTimer > 0) {
        ctx.fillStyle = accordion.feedback === 'Correct!' ? '#44cc44' : '#ff4444';
        ctx.font = 'bold 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText(accordion.feedback, W / 2, H * 0.2);
    }

    // Intro
    if (accordion.phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
        ctx.fillText("BETTA'S ACCORDION!", W / 2, H / 2 - 40);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText('Watch the sequence, then repeat it!', W / 2, H / 2);
        ctx.fillText('Use the arrow keys. 3 mistakes = game over!', W / 2, H / 2 + 24);
        var cd = Math.ceil(accordion.introTimer);
        ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 36px monospace';
        ctx.fillText(cd > 0 ? '' + cd : 'GO!', W / 2, H / 2 + 80);
        ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.fillText('Esc to skip', W / 2, H - 20);
    }
    // Result
    if (accordion.phase === 'result') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText('BRAVA!', W / 2, H / 2 - 60);
        var gc = { S: '#ffd700', A: '#44cc44', B: '#4488ff', C: '#aaaaaa' };
        ctx.fillStyle = gc[accordion.grade] || '#fff'; ctx.font = 'bold 48px monospace';
        ctx.fillText(accordion.grade, W / 2, H / 2);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText('Rounds: ' + accordion.correct + '/' + ACCORDION_CONFIG.ROUNDS + '  Mistakes: ' + accordion.wrong, W / 2, H / 2 + 30);
        if (accordion.reward) { ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 14px monospace'; ctx.fillText('Reward: ' + accordion.reward.name, W / 2, H / 2 + 60); }
        else { ctx.fillStyle = '#888'; ctx.font = '12px monospace'; ctx.fillText('No reward.', W / 2, H / 2 + 60); }
        if (accordion.resultTimer <= 0 && Math.sin(t * 3) > 0) { ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.fillText('Press Space to continue', W / 2, H / 2 + 100); }
    }
}

// ============================================================
// Mama's Sewing Rhythm — Precision alternating rhythm (Sewing Shop Z7)
// ============================================================

var SEWING_CONFIG = { DURATION: 25, BPM: 120, INTRO_TIME: 2.0, RESULT_TIME: 3.0 };

var sewing = {
    active: false, phase: 'intro', introTimer: 0, resultTimer: 0,
    timer: 0, animTimer: 0,
    beatInterval: 0,        // seconds per beat
    nextBeat: 0,            // time of next expected beat
    expectedKey: 0,         // 0 = down, 1 = down (alternating left/right pedal feel)
    perfect: 0, great: 0, ok: 0, miss: 0,
    totalBeats: 0,
    grade: '', reward: null,
    feedback: '', feedbackTimer: 0,
    needleY: 0,             // visual needle position (0-1)
    stitchCount: 0,         // visual stitch counter
    lastHitSide: 0,         // 0=left, 1=right for alternating display
};

function startSewingRhythm() {
    if (sewing.active) return;
    sewing.active = true;
    game.mode = 'sewing_rhythm';
    sewing.phase = 'intro';
    sewing.introTimer = SEWING_CONFIG.INTRO_TIME;
    sewing.timer = 0; sewing.animTimer = 0;
    sewing.beatInterval = 60 / SEWING_CONFIG.BPM;
    sewing.nextBeat = sewing.beatInterval;
    sewing.expectedKey = 0;
    sewing.perfect = 0; sewing.great = 0; sewing.ok = 0; sewing.miss = 0;
    sewing.totalBeats = 0; sewing.grade = ''; sewing.reward = null;
    sewing.feedback = ''; sewing.feedbackTimer = 0;
    sewing.needleY = 0; sewing.stitchCount = 0; sewing.lastHitSide = 0;
    if (typeof stopAllMusic === 'function') stopAllMusic();
}

function updateSewingRhythm(dt) {
    if (!sewing.active) return;
    sewing.animTimer += dt;
    if (sewing.feedbackTimer > 0) sewing.feedbackTimer -= dt;

    if (sewing.phase === 'intro') {
        sewing.introTimer -= dt;
        if (sewing.introTimer <= 0) { sewing.phase = 'playing'; sewing.timer = 0; sewing.nextBeat = sewing.beatInterval; }
        if (actionJustPressed('interact') && sewing.introTimer < 1.0) { sewing.phase = 'playing'; sewing.timer = 0; sewing.nextBeat = sewing.beatInterval; }
        return;
    }
    if (sewing.phase === 'result') {
        sewing.resultTimer -= dt;
        if (sewing.resultTimer <= 0 && actionJustPressed('interact')) endSewingRhythm();
        if (sewing.resultTimer < -3) endSewingRhythm();
        return;
    }
    if (isJustPressed('Escape')) {
        sewing.grade = 'C'; sewing.reward = null;
        sewing.phase = 'result'; sewing.resultTimer = SEWING_CONFIG.RESULT_TIME;
        return;
    }

    sewing.timer += dt;
    if (sewing.timer >= SEWING_CONFIG.DURATION) { finalizeSewingRhythm(); return; }

    // Needle animation — bounces with beat
    sewing.needleY = 0.5 + Math.sin(sewing.timer * Math.PI * 2 / sewing.beatInterval) * 0.4;

    // Check for player input (ArrowDown or Space)
    var pressed = isJustPressed('ArrowDown') || isJustPressed('ArrowLeft') || isJustPressed('ArrowRight') || actionJustPressed('interact');
    if (pressed) {
        var diff = Math.abs(sewing.timer - sewing.nextBeat);
        if (diff < 0.05) {
            sewing.perfect++; sewing.feedback = 'PERFECT!';
        } else if (diff < 0.12) {
            sewing.great++; sewing.feedback = 'GREAT!';
        } else if (diff < 0.2) {
            sewing.ok++; sewing.feedback = 'OK';
        } else {
            sewing.miss++; sewing.feedback = 'MISS';
        }
        sewing.feedbackTimer = 0.4;
        sewing.totalBeats++;
        sewing.stitchCount++;
        sewing.lastHitSide = 1 - sewing.lastHitSide;
        if (sewing.feedback !== 'MISS') playItemPickup();
        // Advance to next beat
        if (sewing.timer >= sewing.nextBeat - 0.2) {
            sewing.nextBeat += sewing.beatInterval;
        }
    }

    // Auto-miss if beat passes without input
    if (sewing.timer > sewing.nextBeat + 0.2) {
        sewing.miss++; sewing.feedback = 'MISS'; sewing.feedbackTimer = 0.4;
        sewing.totalBeats++;
        sewing.nextBeat += sewing.beatInterval;
    }
}

function finalizeSewingRhythm() {
    var total = sewing.perfect + sewing.great + sewing.ok + sewing.miss;
    var score = total > 0 ? (sewing.perfect * 3 + sewing.great * 2 + sewing.ok) / (total * 3) : 0;
    if (score >= 0.85) { sewing.grade = 'S'; sewing.reward = { type: 'powerup', id: 'milk', name: "Mama's Comfort" }; }
    else if (score >= 0.65) { sewing.grade = 'A'; sewing.reward = { type: 'powerup', id: 'gouda', name: 'Sticky Aura' }; }
    else if (score >= 0.4) { sewing.grade = 'B'; sewing.reward = { type: 'item', id: 'banana', name: 'Banana' }; }
    else { sewing.grade = 'C'; sewing.reward = null; }
    sewing.phase = 'result'; sewing.resultTimer = SEWING_CONFIG.RESULT_TIME;
    setFlag('sewing_rhythm_completed', true);
}

function endSewingRhythm() {
    if (sewing.reward) {
        if (sewing.reward.type === 'powerup') activatePowerup(sewing.reward.id);
        else if (sewing.reward.type === 'item') addToInventory(sewing.reward.id);
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = sewing.reward.name;
    }
    sewing.active = false; game.mode = 'overworld';
}

function renderSewingRhythm(ctx) {
    if (!sewing.active) return;
    var W = CONFIG.CANVAS_W, H = CONFIG.CANVAS_H, t = sewing.animTimer;

    // Cozy sewing room background
    ctx.fillStyle = '#2a1a2e'; ctx.fillRect(0, 0, W, H);
    var grad = ctx.createRadialGradient(W / 2, H * 0.4, 30, W / 2, H * 0.4, 250);
    grad.addColorStop(0, 'rgba(200,150,100,0.12)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

    if (sewing.phase === 'playing') {
        // Sewing machine body
        ctx.fillStyle = '#556b2f'; // green machine
        ctx.fillRect(W / 2 - 60, H * 0.35, 120, 80);
        ctx.fillStyle = '#6b8e23';
        ctx.fillRect(W / 2 - 55, H * 0.35 + 5, 110, 30);
        // Needle
        var needleX = W / 2;
        var needleTop = H * 0.35 + 10;
        var needleBot = H * 0.35 + 65;
        var needlePos = needleTop + sewing.needleY * (needleBot - needleTop);
        ctx.strokeStyle = '#cccccc'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(needleX, needleTop); ctx.lineTo(needleX, needlePos); ctx.stroke();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(needleX, needlePos, 3, 0, Math.PI * 2); ctx.fill();

        // Fabric strip moving through
        ctx.fillStyle = '#e8a0c0';
        ctx.fillRect(W / 2 - 100, H * 0.35 + 55, 200, 15);
        // Stitches on fabric
        for (var si = 0; si < Math.min(sewing.stitchCount, 30); si++) {
            var sx = W / 2 - 90 + si * 6;
            var sy = H * 0.35 + 60;
            ctx.fillStyle = '#333';
            ctx.fillRect(sx, sy + (si % 2 === 0 ? 0 : 4), 2, 4);
        }

        // Beat indicator — pulsing circle
        var beatProgress = (sewing.nextBeat - sewing.timer) / sewing.beatInterval;
        beatProgress = Math.max(0, Math.min(1, beatProgress));
        var ringRadius = 30 + (1 - beatProgress) * 20;
        var ringAlpha = beatProgress * 0.6;
        ctx.strokeStyle = 'rgba(255, 200, 100, ' + ringAlpha + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.6, ringRadius, 0, Math.PI * 2); ctx.stroke();
        // Target ring
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(W / 2, H * 0.6, 30, 0, Math.PI * 2); ctx.stroke();

        // Instructions
        ctx.fillStyle = '#ffffff'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
        ctx.fillText('Press any arrow or Space on the beat!', W / 2, H * 0.8);

        // Timer bar
        var pct = sewing.timer / SEWING_CONFIG.DURATION;
        ctx.fillStyle = '#333'; ctx.fillRect(20, 16, W - 40, 10);
        ctx.fillStyle = pct > 0.8 ? '#ff4444' : '#e8a0c0';
        ctx.fillRect(20, 16, (W - 40) * pct, 10);

        // Score
        ctx.fillStyle = '#fff'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
        ctx.fillText('P:' + sewing.perfect + ' G:' + sewing.great + ' OK:' + sewing.ok + ' M:' + sewing.miss, 20, 44);
        ctx.textAlign = 'right';
        ctx.fillText('Stitches: ' + sewing.stitchCount, W - 20, 44);
    }

    // Feedback
    if (sewing.feedbackTimer > 0) {
        var fbC = { 'PERFECT!': '#ffd700', 'GREAT!': '#44cc44', 'OK': '#4488ff', 'MISS': '#ff4444' };
        ctx.fillStyle = fbC[sewing.feedback] || '#fff';
        ctx.font = 'bold 18px monospace'; ctx.textAlign = 'center';
        ctx.fillText(sewing.feedback, W / 2, H * 0.5);
    }

    // Intro
    if (sewing.phase === 'intro') {
        ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8a0c0'; ctx.font = 'bold 24px monospace'; ctx.textAlign = 'center';
        ctx.fillText("MAMA'S SEWING RHYTHM!", W / 2, H / 2 - 40);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText('Press on the beat as the needle falls!', W / 2, H / 2);
        ctx.fillText('Keep the rhythm steady for the best score!', W / 2, H / 2 + 24);
        var cd = Math.ceil(sewing.introTimer);
        ctx.fillStyle = '#e8a0c0'; ctx.font = 'bold 36px monospace';
        ctx.fillText(cd > 0 ? '' + cd : 'SEW!', W / 2, H / 2 + 80);
        ctx.fillStyle = '#888'; ctx.font = '10px monospace'; ctx.fillText('Esc to skip', W / 2, H - 20);
    }
    // Result
    if (sewing.phase === 'result') {
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#e8a0c0'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText('BEAUTIFUL STITCHING!', W / 2, H / 2 - 60);
        var gc = { S: '#ffd700', A: '#44cc44', B: '#4488ff', C: '#aaaaaa' };
        ctx.fillStyle = gc[sewing.grade] || '#fff'; ctx.font = 'bold 48px monospace';
        ctx.fillText(sewing.grade, W / 2, H / 2);
        ctx.fillStyle = '#fff'; ctx.font = '14px monospace';
        ctx.fillText('P:' + sewing.perfect + ' G:' + sewing.great + ' OK:' + sewing.ok + ' Miss:' + sewing.miss, W / 2, H / 2 + 30);
        if (sewing.reward) { ctx.fillStyle = '#ffcc44'; ctx.font = 'bold 14px monospace'; ctx.fillText('Reward: ' + sewing.reward.name, W / 2, H / 2 + 60); }
        else { ctx.fillStyle = '#888'; ctx.font = '12px monospace'; ctx.fillText('No reward.', W / 2, H / 2 + 60); }
        if (sewing.resultTimer <= 0 && Math.sin(t * 3) > 0) { ctx.fillStyle = '#aaa'; ctx.font = '12px monospace'; ctx.fillText('Press Space to continue', W / 2, H / 2 + 100); }
    }
}
