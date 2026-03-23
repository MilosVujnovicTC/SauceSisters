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
