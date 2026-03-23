// ============================================================
// js/sprites.js — Enhanced pixel art sprite generator
// All game visuals drawn procedurally on offscreen canvases.
// Called once at startup; render functions use ctx.drawImage().
// ============================================================

/** Sprite storage — organized by category. Each value is an offscreen canvas. */
const SPRITES = {
    tiles: {},     // tiles.grass[0..3], tiles.water[0..3], tiles.wall, etc.
    player: {},    // player.down[0..3], player.up[0..3], etc.
    brodo: {},     // brodo.follow, brodo.sit, brodo.bark, brodo.nap, brodo.sniff
    npcs: {},      // npcs[npcId] = canvas
    enemy: {},     // enemy.patrol, enemy.chase, enemy.stunned, enemy.slowed, enemy.retreat
    broom: {},     // broom.patrol, broom.chase, broom.stunned
    objects: {},   // objects.crate, objects.bmx, objects.nokia, objects.cartridge
    items: {},     // items.recipe, items.spatula, items.tomato, etc.
    powerups: {},  // powerups.broccoli, powerups.chocolate_milk, etc.
};

// ============================================================
// Helpers
// ============================================================

/** Creates a small offscreen canvas, runs drawFn on its context, returns the canvas. */
function createSprite(w, h, drawFn) {
    var c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    var cx = c.getContext('2d');
    cx.imageSmoothingEnabled = false;
    drawFn(cx, w, h);
    return c;
}

/** Creates a sprite with a 1px dark outline (ALTTP-style). */
function createOutlinedSprite(w, h, drawFn) {
    // Draw the base sprite
    var base = createSprite(w, h, drawFn);

    // Create dark silhouette
    var dark = createSprite(w, h, function(cx) {
        cx.drawImage(base, 0, 0);
        cx.globalCompositeOperation = 'source-in';
        cx.fillStyle = '#1a1a2e';
        cx.fillRect(0, 0, w, h);
    });

    // Composite: dark at 4 offsets, then base on top
    var result = createSprite(w + 2, h + 2, function(cx) {
        cx.drawImage(dark, 0, 1); // left
        cx.drawImage(dark, 2, 1); // right
        cx.drawImage(dark, 1, 0); // up
        cx.drawImage(dark, 1, 2); // down
        cx.drawImage(base, 1, 1); // center (on top)
    });
    return result;
}

/** Seeded pseudo-random for deterministic tile variation. */
function tileRand(col, row, seed) {
    var n = (col * 73 + row * 137 + seed * 53) % 997;
    return (Math.sin(n) * 43758.5453) % 1;
}

// ============================================================
// Tile sprites
// ============================================================

function generateTileSprites() {
    var T = CONFIG.TILE_SIZE; // 32

    // --- GRASS (4 variants) ---
    SPRITES.tiles.grass = [];
    for (var v = 0; v < 4; v++) {
        SPRITES.tiles.grass.push(createSprite(T, T, function(cx) {
            // Base green
            cx.fillStyle = '#4a8c3f';
            cx.fillRect(0, 0, T, T);
            // Slightly lighter patches
            cx.fillStyle = '#52944a';
            var seed = v * 31;
            for (var i = 0; i < 3; i++) {
                var gx = ((seed + i * 11) % 24) + 2;
                var gy = ((seed + i * 17) % 24) + 2;
                cx.fillRect(gx, gy, 4 + (i % 2) * 2, 3);
            }
            // Grass tufts (darker blades)
            cx.fillStyle = '#3e7a35';
            for (var j = 0; j < 4; j++) {
                var tx = ((seed + j * 7) % 28) + 2;
                var ty = ((seed + j * 13) % 26) + 2;
                cx.fillRect(tx, ty, 1, 3);
                cx.fillRect(tx + 1, ty + 1, 1, 2);
            }
            // Lighter highlights
            cx.fillStyle = '#5a9e4f';
            for (var k = 0; k < 2; k++) {
                var hx = ((seed + k * 19) % 26) + 2;
                var hy = ((seed + k * 23) % 26) + 2;
                cx.fillRect(hx, hy, 2, 1);
            }
        }));
    }

    // --- FLOOR (2 variants — kitchen/indoor tile) ---
    SPRITES.tiles.floor = [];
    for (var fv = 0; fv < 2; fv++) {
        SPRITES.tiles.floor.push(createSprite(T, T, function(cx) {
            cx.fillStyle = '#c8a96e';
            cx.fillRect(0, 0, T, T);
            // Tile grid lines
            cx.strokeStyle = '#b89860';
            cx.lineWidth = 1;
            cx.strokeRect(0.5, 0.5, T - 1, T - 1);
            // Cross pattern (floor tiles)
            cx.beginPath();
            cx.moveTo(T / 2, 0); cx.lineTo(T / 2, T);
            cx.moveTo(0, T / 2); cx.lineTo(T, T / 2);
            cx.stroke();
            // Subtle wear spots
            if (fv === 1) {
                cx.fillStyle = '#c0a060';
                cx.fillRect(8, 12, 6, 4);
            }
        }));
    }

    // --- WALL (brick pattern with depth) ---
    SPRITES.tiles.wall = createSprite(T, T, function(cx) {
        cx.fillStyle = '#5a4a3a';
        cx.fillRect(0, 0, T, T);
        // Brick rows
        cx.strokeStyle = '#4a3a2a';
        cx.lineWidth = 1;
        for (var row = 0; row < 4; row++) {
            var by = row * 8;
            cx.strokeRect(0, by, T, 8);
            var offset = (row % 2) * 16;
            cx.beginPath();
            cx.moveTo(offset, by);
            cx.lineTo(offset, by + 8);
            if (offset + 16 < T) {
                cx.moveTo(offset + 16, by);
                cx.lineTo(offset + 16, by + 8);
            }
            cx.stroke();
        }
        // Top highlight
        cx.fillStyle = '#6a5a4a';
        cx.fillRect(0, 0, T, 2);
        // Bottom shadow
        cx.fillStyle = '#3a2a1a';
        cx.fillRect(0, T - 2, T, 2);
        // Random brick color variation
        cx.fillStyle = '#5e4e3e';
        cx.fillRect(2, 2, 14, 5);
        cx.fillStyle = '#564a38';
        cx.fillRect(18, 10, 12, 5);
    });

    // --- WATER (4 animation frames) ---
    SPRITES.tiles.water = [];
    for (var wf = 0; wf < 4; wf++) {
        (function(frame) {
            SPRITES.tiles.water.push(createSprite(T, T, function(cx) {
                // Base water
                var phase = frame * Math.PI / 2;
                var baseB = 207 + Math.sin(phase) * 15;
                var baseG = 126 + Math.sin(phase) * 8;
                cx.fillStyle = 'rgb(58,' + Math.round(baseG) + ',' + Math.round(baseB) + ')';
                cx.fillRect(0, 0, T, T);
                // Ripple lines
                cx.strokeStyle = 'rgba(100,180,255,0.35)';
                cx.lineWidth = 1;
                for (var r = 0; r < 3; r++) {
                    var ry = 5 + r * 10 + Math.sin(phase + r * 1.2) * 2;
                    cx.beginPath();
                    cx.moveTo(2, ry);
                    cx.quadraticCurveTo(T / 2, ry + 3 * Math.sin(phase + r), T - 2, ry);
                    cx.stroke();
                }
                // Highlight specks
                cx.fillStyle = 'rgba(200,230,255,0.45)';
                cx.fillRect(8 + Math.sin(phase) * 3, 4, 3, 2);
                cx.fillRect(20 - Math.sin(phase) * 2, 18, 2, 2);
                cx.fillRect(14, 26 + Math.cos(phase) * 2, 2, 1);
            }));
        })(wf);
    }

    // --- COUNTER (wood counter with grain) ---
    SPRITES.tiles.counter = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914';
        cx.fillRect(0, 0, T, T);
        // Wood grain lines
        cx.strokeStyle = '#7a5a0e';
        cx.lineWidth = 1;
        for (var i = 0; i < 4; i++) {
            var ly = 4 + i * 8;
            cx.beginPath();
            cx.moveTo(0, ly);
            cx.lineTo(T, ly + (i % 2 ? 1 : -1));
            cx.stroke();
        }
        // Top bevel
        cx.fillStyle = '#9b7924';
        cx.fillRect(0, 0, T, 3);
        // Bottom shadow
        cx.fillStyle = '#6b4904';
        cx.fillRect(0, T - 2, T, 2);
    });

    // --- DOOR (wooden door with arch) ---
    SPRITES.tiles.door = createSprite(T, T, function(cx) {
        // Frame
        cx.fillStyle = '#4a3a2a';
        cx.fillRect(0, 0, T, T);
        // Door panel
        cx.fillStyle = '#d4a03c';
        cx.fillRect(4, 2, T - 8, T - 2);
        // Planks
        cx.strokeStyle = '#b8862e';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(T / 2, 2); cx.lineTo(T / 2, T);
        cx.stroke();
        // Door knob
        cx.fillStyle = '#ffd54f';
        cx.beginPath();
        cx.arc(T - 10, T / 2 + 2, 3, 0, Math.PI * 2);
        cx.fill();
        // Arch top
        cx.fillStyle = '#5a4a3a';
        cx.fillRect(0, 0, T, 4);
        cx.fillStyle = '#6a5a4a';
        cx.fillRect(2, 0, T - 4, 2);
    });

    // --- PATH (2 variants — gravel/dirt) ---
    SPRITES.tiles.path = [];
    for (var pv = 0; pv < 2; pv++) {
        SPRITES.tiles.path.push(createSprite(T, T, function(cx) {
            cx.fillStyle = '#b8a080';
            cx.fillRect(0, 0, T, T);
            // Gravel dots
            cx.fillStyle = '#a89070';
            var seed = pv * 41;
            for (var i = 0; i < 5; i++) {
                cx.fillRect(((seed + i * 8) % 28) + 2, ((seed + i * 6) % 28) + 2, 2, 2);
            }
            // Lighter edge
            cx.fillStyle = '#c8b898';
            cx.fillRect(0, 0, T, 1);
            cx.fillRect(0, T - 1, T, 1);
            // Dark speck
            cx.fillStyle = '#9a8060';
            cx.fillRect(((seed + 3) % 24) + 4, ((seed + 7) % 20) + 6, 3, 2);
        }));
    }

    // --- STOVE (grey with burner circles) ---
    SPRITES.tiles.stove = createSprite(T, T, function(cx) {
        cx.fillStyle = '#555555';
        cx.fillRect(0, 0, T, T);
        // Burner circles
        cx.strokeStyle = '#333333';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(10, 10, 5, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(22, 10, 5, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(10, 22, 5, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(22, 22, 5, 0, Math.PI * 2); cx.stroke();
        // Highlight
        cx.fillStyle = '#666666';
        cx.fillRect(0, 0, T, 2);
        // Edge
        cx.fillStyle = '#444444';
        cx.fillRect(0, T - 1, T, 1);
    });

    // --- RUG (brown with decorative border) ---
    SPRITES.tiles.rug = createSprite(T, T, function(cx) {
        cx.fillStyle = '#a0522d';
        cx.fillRect(0, 0, T, T);
        // Border pattern
        cx.strokeStyle = '#c4703d';
        cx.lineWidth = 2;
        cx.strokeRect(3, 3, T - 6, T - 6);
        // Inner pattern (diamond)
        cx.fillStyle = '#b8623d';
        cx.beginPath();
        cx.moveTo(T / 2, 8);
        cx.lineTo(T - 8, T / 2);
        cx.lineTo(T / 2, T - 8);
        cx.lineTo(8, T / 2);
        cx.closePath();
        cx.fill();
        // Center dot
        cx.fillStyle = '#c4703d';
        cx.fillRect(T / 2 - 2, T / 2 - 2, 4, 4);
    });

    // --- SHELF (dark brown with books) ---
    SPRITES.tiles.shelf = createSprite(T, T, function(cx) {
        cx.fillStyle = '#6b4226';
        cx.fillRect(0, 0, T, T);
        // Shelf plank lines
        cx.fillStyle = '#5a3216';
        cx.fillRect(0, T / 2, T, 2);
        cx.fillRect(0, T - 2, T, 2);
        // Books on top shelf
        var bookColors = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a'];
        for (var b = 0; b < 5; b++) {
            cx.fillStyle = bookColors[b];
            var bw = 4 + (b % 2) * 2;
            cx.fillRect(2 + b * 6, 3, bw, T / 2 - 5);
        }
        // Books on bottom shelf
        for (var b2 = 0; b2 < 4; b2++) {
            cx.fillStyle = bookColors[(b2 + 2) % 5];
            cx.fillRect(3 + b2 * 7, T / 2 + 3, 5, T / 2 - 7);
        }
    });

    // --- STALL (market stall with awning) ---
    SPRITES.tiles.stall = createSprite(T, T, function(cx) {
        cx.fillStyle = '#c4782e';
        cx.fillRect(0, 0, T, T);
        // Awning stripes (alternating)
        cx.fillStyle = '#d48a3e';
        for (var s = 0; s < 4; s++) {
            cx.fillRect(0, s * 8, T, 4);
        }
        // Posts
        cx.fillStyle = '#8b5e2e';
        cx.fillRect(0, 0, 3, T);
        cx.fillRect(T - 3, 0, 3, T);
        // Counter surface
        cx.fillStyle = '#9b6828';
        cx.fillRect(3, T - 6, T - 6, 6);
    });

    // --- BARREL (on grass background) ---
    SPRITES.tiles.barrel = createSprite(T, T, function(cx) {
        // Grass under
        cx.fillStyle = '#4a8c3f';
        cx.fillRect(0, 0, T, T);
        cx.fillStyle = '#3e7a35';
        cx.fillRect(4, 24, 3, 2);
        cx.fillRect(22, 20, 2, 3);
        // Barrel body (oval)
        cx.fillStyle = '#7a5c3a';
        cx.beginPath();
        cx.ellipse(T / 2, T / 2 + 2, 12, 14, 0, 0, Math.PI * 2);
        cx.fill();
        // Metal bands
        cx.strokeStyle = '#5a3c1a';
        cx.lineWidth = 2;
        cx.beginPath(); cx.ellipse(T / 2, T / 2 - 4, 11, 3, 0, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.ellipse(T / 2, T / 2 + 8, 11, 3, 0, 0, Math.PI * 2); cx.stroke();
        // Highlight
        cx.fillStyle = 'rgba(255,255,255,0.12)';
        cx.fillRect(8, 6, 4, 16);
    });

    // --- FLOWER (on grass background) ---
    SPRITES.tiles.flower = createSprite(T, T, function(cx) {
        // Grass under
        cx.fillStyle = '#4a8c3f';
        cx.fillRect(0, 0, T, T);
        cx.fillStyle = '#3e7a35';
        cx.fillRect(6, 26, 2, 3); cx.fillRect(22, 22, 1, 3);
        // Stem
        cx.strokeStyle = '#2d6a2d';
        cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(T / 2, T - 4); cx.lineTo(T / 2, 12); cx.stroke();
        // Leaf
        cx.fillStyle = '#3e8a35';
        cx.beginPath();
        cx.ellipse(T / 2 + 5, 20, 4, 2, 0.3, 0, Math.PI * 2);
        cx.fill();
        // Petals
        var petalColors = ['#d65d8c', '#e87da0', '#ff9dba', '#d65d8c', '#c84d7c'];
        for (var p = 0; p < 5; p++) {
            var a = (p / 5) * Math.PI * 2 - Math.PI / 2;
            cx.fillStyle = petalColors[p];
            cx.beginPath();
            cx.arc(T / 2 + Math.cos(a) * 5, 10 + Math.sin(a) * 5, 4, 0, Math.PI * 2);
            cx.fill();
        }
        // Center
        cx.fillStyle = '#ffeb3b';
        cx.beginPath(); cx.arc(T / 2, 10, 3, 0, Math.PI * 2); cx.fill();
    });

    // --- DOCK (wooden planks) ---
    SPRITES.tiles.dock = createSprite(T, T, function(cx) {
        cx.fillStyle = '#9e7c4e';
        cx.fillRect(0, 0, T, T);
        // Plank lines
        cx.strokeStyle = '#8a6a3e';
        cx.lineWidth = 1;
        for (var i = 0; i < 4; i++) {
            var py = i * 8 + 0.5;
            cx.beginPath(); cx.moveTo(0, py); cx.lineTo(T, py); cx.stroke();
        }
        // Nail heads
        cx.fillStyle = '#6a5030';
        cx.fillRect(4, 2, 2, 2);
        cx.fillRect(T - 6, 2, 2, 2);
        cx.fillRect(4, 18, 2, 2);
        cx.fillRect(T - 6, 18, 2, 2);
        // Wood grain
        cx.fillStyle = '#8e6c3e';
        cx.fillRect(10, 5, 8, 1);
        cx.fillRect(6, 13, 12, 1);
        cx.fillRect(14, 22, 6, 1);
    });

    // --- PLANK (bridge plank — lighter wood) ---
    SPRITES.tiles.plank = createSprite(T, T, function(cx) {
        cx.fillStyle = '#c4a46c';
        cx.fillRect(0, 0, T, T);
        // Wood grain
        cx.strokeStyle = '#a08050';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(3, T * 0.3); cx.lineTo(T - 3, T * 0.3);
        cx.moveTo(5, T * 0.65); cx.lineTo(T - 5, T * 0.65);
        cx.stroke();
        // Highlight top
        cx.fillStyle = '#d4b47c';
        cx.fillRect(0, 0, T, 2);
        // Border
        cx.strokeStyle = '#8b6914';
        cx.lineWidth = 1;
        cx.strokeRect(0.5, 0.5, T - 1, T - 1);
    });

    // --- BRIDGEGAP (uses water frames) ---
    SPRITES.tiles.bridgegap = [];
    for (var bf = 0; bf < 4; bf++) {
        (function(frame) {
            SPRITES.tiles.bridgegap.push(createSprite(T, T, function(cx) {
                var phase = frame * Math.PI / 2;
                var baseB = 158 + Math.sin(phase) * 12;
                var baseG = 90 + Math.sin(phase) * 6;
                cx.fillStyle = 'rgb(42,' + Math.round(baseG) + ',' + Math.round(baseB) + ')';
                cx.fillRect(0, 0, T, T);
                // Darker ripples
                cx.strokeStyle = 'rgba(60,120,180,0.3)';
                cx.lineWidth = 1;
                for (var r = 0; r < 2; r++) {
                    var ry = 8 + r * 14 + Math.sin(phase + r) * 2;
                    cx.beginPath();
                    cx.moveTo(4, ry);
                    cx.quadraticCurveTo(T / 2, ry + 2 * Math.sin(phase), T - 4, ry);
                    cx.stroke();
                }
            }));
        })(bf);
    }

    // --- MAT (gym exercise mat — blue with grip texture) ---
    SPRITES.tiles.mat = [];
    for (var mv = 0; mv < 2; mv++) {
        SPRITES.tiles.mat.push(createSprite(T, T, function(cx) {
            // Base blue mat
            cx.fillStyle = '#4a90d9';
            cx.fillRect(0, 0, T, T);
            // Subtle grip lines
            cx.strokeStyle = '#3a7ec0';
            cx.lineWidth = 1;
            for (var ml = 0; ml < 4; ml++) {
                var my = 4 + ml * 8;
                cx.beginPath();
                cx.moveTo(2, my); cx.lineTo(T - 2, my);
                cx.stroke();
            }
            // Edge highlight
            cx.fillStyle = '#5aa0e8';
            cx.fillRect(0, 0, T, 1);
            cx.fillRect(0, 0, 1, T);
            // Edge shadow
            cx.fillStyle = '#3a78b8';
            cx.fillRect(0, T - 1, T, 1);
            cx.fillRect(T - 1, 0, 1, T);
            // Wear mark variation
            if (mv === 1) {
                cx.fillStyle = '#4888c8';
                cx.fillRect(10, 14, 8, 6);
            }
        }));
    }

    // --- EQUIPMENT (gym weight rack — metallic gray with details) ---
    SPRITES.tiles.equipment = createSprite(T, T, function(cx) {
        // Base dark gray
        cx.fillStyle = '#888888';
        cx.fillRect(0, 0, T, T);
        // Metal frame bars
        cx.fillStyle = '#666666';
        cx.fillRect(2, 0, 4, T);
        cx.fillRect(T - 6, 0, 4, T);
        // Weight plates (circles)
        cx.fillStyle = '#555555';
        cx.fillRect(8, 4, 16, 6);
        cx.fillRect(8, 14, 16, 6);
        cx.fillRect(8, 24, 16, 6);
        // Plate highlights
        cx.fillStyle = '#999999';
        cx.fillRect(9, 5, 14, 1);
        cx.fillRect(9, 15, 14, 1);
        cx.fillRect(9, 25, 14, 1);
        // Top and bottom frame
        cx.fillStyle = '#777777';
        cx.fillRect(0, 0, T, 2);
        cx.fillStyle = '#555555';
        cx.fillRect(0, T - 2, T, 2);
    });

    // --- JUICEBAR (warm orange counter with bottles) ---
    SPRITES.tiles.juicebar = createSprite(T, T, function(cx) {
        // Base warm orange counter
        cx.fillStyle = '#e8a030';
        cx.fillRect(0, 0, T, T);
        // Wood grain
        cx.strokeStyle = '#c88820';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(4, T * 0.3); cx.lineTo(T - 4, T * 0.35);
        cx.moveTo(3, T * 0.7); cx.lineTo(T - 3, T * 0.65);
        cx.stroke();
        // Counter edge highlight
        cx.fillStyle = '#f0b848';
        cx.fillRect(0, 0, T, 2);
        // Counter edge shadow
        cx.fillStyle = '#b07818';
        cx.fillRect(0, T - 3, T, 3);
        // Small bottles/cups
        cx.fillStyle = '#4CAF50';
        cx.fillRect(6, 8, 4, 8);
        cx.fillStyle = '#FF9800';
        cx.fillRect(14, 10, 4, 6);
        cx.fillStyle = '#E91E63';
        cx.fillRect(22, 8, 4, 8);
    });

    // --- MIRROR (reflective light blue wall panel) ---
    SPRITES.tiles.mirror = createSprite(T, T, function(cx) {
        // Frame
        cx.fillStyle = '#5a4a3a';
        cx.fillRect(0, 0, T, T);
        // Mirror surface
        cx.fillStyle = '#a8d8ea';
        cx.fillRect(2, 2, T - 4, T - 4);
        // Reflection shine
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.fillRect(4, 4, 8, 2);
        cx.fillRect(6, 6, 4, 4);
        // Subtle gradient effect
        cx.fillStyle = 'rgba(150,210,240,0.4)';
        cx.fillRect(2, T / 2, T - 4, T / 2 - 2);
    });
}

// ============================================================
// Player sprites (Giulia) — 4 directions × 4 walk frames
// ============================================================

function generatePlayerSprites() {
    var dirs = ['down', 'up', 'left', 'right'];
    for (var d = 0; d < dirs.length; d++) {
        SPRITES.player[dirs[d]] = [];
        for (var f = 0; f < 4; f++) {
            SPRITES.player[dirs[d]].push(
                createOutlinedSprite(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, function(cx) {
                    drawGiulia(cx, dirs[d], f);
                })
            );
        }
    }
}

/** Draws Giulia at 32×32 for a given direction and walk frame. */
function drawGiulia(cx, dir, frame) {
    var T = CONFIG.TILE_SIZE;
    // Walk bob: frames 1 and 3 are step frames (body shifts up 1px)
    var bob = (frame === 1 || frame === 3) ? -1 : 0;
    // Leg positions: 0=together, 1=right forward, 2=together, 3=left forward
    var legOffset = 0;
    if (frame === 1) legOffset = 1;  // right leg forward
    if (frame === 3) legOffset = -1; // left leg forward

    if (dir === 'down') {
        drawGiuliaFront(cx, T, bob, legOffset);
    } else if (dir === 'up') {
        drawGiuliaBack(cx, T, bob, legOffset);
    } else if (dir === 'left') {
        drawGiuliaSide(cx, T, bob, legOffset, false);
    } else {
        drawGiuliaSide(cx, T, bob, legOffset, true);
    }
}

function drawGiuliaFront(cx, T, bob, legOff) {
    var cx0 = T / 2; // center X = 16
    var by = 3 + bob; // base Y

    // Shadow under feet
    cx.fillStyle = 'rgba(0,0,0,0.15)';
    cx.beginPath(); cx.ellipse(cx0, 28, 8, 3, 0, 0, Math.PI * 2); cx.fill();

    // Hair (dark brown)
    cx.fillStyle = '#4a2c0a';
    cx.fillRect(cx0 - 5, by, 10, 3);     // crown
    cx.fillRect(cx0 - 6, by + 2, 12, 2); // top spread
    cx.fillRect(cx0 - 7, by + 4, 3, 8);  // left bangs
    cx.fillRect(cx0 + 4, by + 4, 3, 8);  // right bangs

    // Face (skin)
    cx.fillStyle = '#ffcc99';
    cx.fillRect(cx0 - 4, by + 4, 8, 7);  // face

    // Eyes
    cx.fillStyle = '#2a2a2a';
    cx.fillRect(cx0 - 3, by + 6, 2, 2);  // left eye
    cx.fillRect(cx0 + 1, by + 6, 2, 2);  // right eye
    // Eye highlights
    cx.fillStyle = '#ffffff';
    cx.fillRect(cx0 - 2, by + 6, 1, 1);
    cx.fillRect(cx0 + 2, by + 6, 1, 1);

    // Blush
    cx.fillStyle = 'rgba(255,150,150,0.3)';
    cx.fillRect(cx0 - 4, by + 8, 2, 1);
    cx.fillRect(cx0 + 2, by + 8, 2, 1);

    // Mouth
    cx.fillStyle = '#d4756b';
    cx.fillRect(cx0 - 1, by + 9, 2, 1);

    // Neck
    cx.fillStyle = '#ffcc99';
    cx.fillRect(cx0 - 1, by + 11, 2, 1);

    // Body (red/pink top)
    cx.fillStyle = '#e94560';
    cx.fillRect(cx0 - 5, by + 12, 10, 5);
    // Collar detail
    cx.fillStyle = '#d93550';
    cx.fillRect(cx0 - 2, by + 12, 4, 1);

    // Skirt (darker)
    cx.fillStyle = '#c83050';
    cx.fillRect(cx0 - 6, by + 17, 12, 2);

    // Legs (skin)
    cx.fillStyle = '#ffcc99';
    var leftLegY = by + 19 + (legOff > 0 ? 1 : 0);
    var rightLegY = by + 19 + (legOff < 0 ? 1 : 0);
    cx.fillRect(cx0 - 4, leftLegY, 3, 4);   // left leg
    cx.fillRect(cx0 + 1, rightLegY, 3, 4);   // right leg

    // Shoes (brown)
    cx.fillStyle = '#5a3a2a';
    cx.fillRect(cx0 - 5, leftLegY + 4, 4, 2);   // left shoe
    cx.fillRect(cx0 + 1, rightLegY + 4, 4, 2);   // right shoe
}

function drawGiuliaBack(cx, T, bob, legOff) {
    var cx0 = T / 2;
    var by = 3 + bob;

    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.15)';
    cx.beginPath(); cx.ellipse(cx0, 28, 8, 3, 0, 0, Math.PI * 2); cx.fill();

    // Hair (back view — more hair visible)
    cx.fillStyle = '#4a2c0a';
    cx.fillRect(cx0 - 5, by, 10, 3);
    cx.fillRect(cx0 - 6, by + 2, 12, 10); // full hair back

    // Body
    cx.fillStyle = '#e94560';
    cx.fillRect(cx0 - 5, by + 12, 10, 5);

    // Skirt
    cx.fillStyle = '#c83050';
    cx.fillRect(cx0 - 6, by + 17, 12, 2);

    // Legs
    cx.fillStyle = '#ffcc99';
    var leftLegY = by + 19 + (legOff > 0 ? 1 : 0);
    var rightLegY = by + 19 + (legOff < 0 ? 1 : 0);
    cx.fillRect(cx0 - 4, leftLegY, 3, 4);
    cx.fillRect(cx0 + 1, rightLegY, 3, 4);

    // Shoes
    cx.fillStyle = '#5a3a2a';
    cx.fillRect(cx0 - 5, leftLegY + 4, 4, 2);
    cx.fillRect(cx0 + 1, rightLegY + 4, 4, 2);
}

function drawGiuliaSide(cx, T, bob, legOff, facingRight) {
    var cx0 = T / 2;
    var by = 3 + bob;
    var dir = facingRight ? 1 : -1;

    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.15)';
    cx.beginPath(); cx.ellipse(cx0, 28, 8, 3, 0, 0, Math.PI * 2); cx.fill();

    // Hair (side view)
    cx.fillStyle = '#4a2c0a';
    cx.fillRect(cx0 - 5, by, 10, 3);
    cx.fillRect(cx0 - 6, by + 2, 12, 2);
    // Hair trail on back side
    if (facingRight) {
        cx.fillRect(cx0 - 7, by + 4, 4, 8);
    } else {
        cx.fillRect(cx0 + 3, by + 4, 4, 8);
    }

    // Face (side — narrower)
    cx.fillStyle = '#ffcc99';
    cx.fillRect(cx0 - 3, by + 4, 6, 7);

    // Eye (one visible)
    cx.fillStyle = '#2a2a2a';
    var eyeX = facingRight ? cx0 + 1 : cx0 - 2;
    cx.fillRect(eyeX, by + 6, 2, 2);
    cx.fillStyle = '#ffffff';
    cx.fillRect(eyeX + (facingRight ? 1 : 0), by + 6, 1, 1);

    // Mouth
    cx.fillStyle = '#d4756b';
    var mouthX = facingRight ? cx0 + 1 : cx0 - 1;
    cx.fillRect(mouthX, by + 9, 1, 1);

    // Neck
    cx.fillStyle = '#ffcc99';
    cx.fillRect(cx0 - 1, by + 11, 2, 1);

    // Body
    cx.fillStyle = '#e94560';
    cx.fillRect(cx0 - 4, by + 12, 8, 5);

    // Arm (visible arm in front)
    cx.fillStyle = '#e94560';
    var armX = facingRight ? cx0 + 3 : cx0 - 5;
    cx.fillRect(armX, by + 12, 2, 5);
    // Hand
    cx.fillStyle = '#ffcc99';
    cx.fillRect(armX, by + 17, 2, 2);

    // Skirt
    cx.fillStyle = '#c83050';
    cx.fillRect(cx0 - 5, by + 17, 10, 2);

    // Legs (side view — one in front, one behind)
    cx.fillStyle = '#ffcc99';
    var frontLegY = by + 19 + (legOff !== 0 ? 0 : 0);
    var backLegY = by + 19;
    if (legOff !== 0) {
        // Stride
        var frontX = facingRight ? cx0 + dir * 1 : cx0 - dir * 1;
        var backX = facingRight ? cx0 - dir * 2 : cx0 + dir * 2;
        cx.fillRect(frontX - 1, frontLegY - 1, 3, 5);
        cx.fillRect(backX - 1, backLegY + 1, 3, 3);
        // Shoes
        cx.fillStyle = '#5a3a2a';
        cx.fillRect(frontX - 2, frontLegY + 4, 4, 2);
        cx.fillRect(backX - 2, backLegY + 4, 4, 2);
    } else {
        cx.fillRect(cx0 - 2, frontLegY, 3, 4);
        cx.fillStyle = '#5a3a2a';
        cx.fillRect(cx0 - 3, frontLegY + 4, 4, 2);
    }
}

// ============================================================
// Brodo sprites (basset hound)
// ============================================================

function generateBrodoSprites() {
    SPRITES.brodo.follow = createOutlinedSprite(26, 22, function(cx) {
        drawBrodoBase(cx, false, false, true);
    });
    SPRITES.brodo.sit = createOutlinedSprite(26, 22, function(cx) {
        drawBrodoBase(cx, true, false, false);
    });
    SPRITES.brodo.bark = createOutlinedSprite(26, 22, function(cx) {
        drawBrodoBase(cx, false, true, true);
    });
    SPRITES.brodo.nap = createOutlinedSprite(26, 22, function(cx) {
        drawBrodoBase(cx, true, false, false);
        // Closed eyes — override
        cx.fillStyle = '#c4956a';
        cx.fillRect(18, 3, 4, 4);
        cx.fillStyle = '#888888';
        cx.fillRect(19, 5, 3, 1);
    });
    SPRITES.brodo.sniff = createOutlinedSprite(26, 22, function(cx) {
        drawBrodoBase(cx, false, false, true);
    });
}

function drawBrodoBase(cx, sitting, barking, showLegs) {
    var bodyY = sitting ? 4 : 2;

    // Body (long basset hound body)
    cx.fillStyle = '#c4956a';
    cx.fillRect(0, bodyY + 2, 18, 10);

    // Belly (lighter)
    cx.fillStyle = '#dbb68a';
    cx.fillRect(2, bodyY + 8, 14, 4);

    // Head
    cx.fillStyle = '#c4956a';
    cx.fillRect(16, bodyY - 2, 8, 12);

    // Ears (long, floppy)
    cx.fillStyle = '#a07050';
    cx.fillRect(14, bodyY, 4, 12);
    cx.fillRect(22, bodyY + 2, 3, 10);

    // Snout
    cx.fillStyle = '#dbb68a';
    cx.fillRect(20, bodyY + 2, 5, 5);

    // Nose
    cx.fillStyle = '#333333';
    cx.fillRect(23, bodyY + 3, 2, 2);

    // Eye
    cx.fillStyle = '#222222';
    cx.fillRect(19, bodyY, 2, 2);
    cx.fillStyle = '#ffffff';
    cx.fillRect(20, bodyY, 1, 1);

    // Mouth (open when barking)
    if (barking) {
        cx.fillStyle = '#ffffff';
        cx.fillRect(21, bodyY + 7, 3, 2);
        cx.fillStyle = '#e88080';
        cx.fillRect(22, bodyY + 7, 1, 1);
    }

    // Legs
    if (showLegs) {
        cx.fillStyle = '#b08060';
        cx.fillRect(1, bodyY + 12, 3, 5);
        cx.fillRect(6, bodyY + 12, 3, 5);
        cx.fillRect(12, bodyY + 12, 3, 5);
        cx.fillRect(17, bodyY + 12, 3, 5);
    }

    // Tail (wagging up)
    cx.strokeStyle = '#c4956a';
    cx.lineWidth = 2;
    cx.beginPath();
    cx.moveTo(1, bodyY + 3);
    cx.quadraticCurveTo(-4, bodyY - 4, -2, bodyY - 8);
    cx.stroke();
}

// ============================================================
// NPC sprites — generated per NPC with custom colors
// ============================================================

function generateNPCSprites() {
    // We'll generate NPCs on demand via getNPCSprite()
    // Pre-generate common ones
    SPRITES.npcs = {};
}

/** Gets or creates an NPC sprite for the given NPC definition. */
function getNPCSprite(npc) {
    var id = npc.id || npc.name || 'default';
    if (SPRITES.npcs[id]) return SPRITES.npcs[id];

    var color = npc.color || CONFIG.NPC_COLOR;
    SPRITES.npcs[id] = createOutlinedSprite(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE, function(cx) {
        drawNPCBody(cx, CONFIG.TILE_SIZE, color, npc);
    });
    return SPRITES.npcs[id];
}

function drawNPCBody(cx, T, color, npc) {
    var cx0 = T / 2;
    var by = 3;

    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.15)';
    cx.beginPath(); cx.ellipse(cx0, 28, 8, 3, 0, 0, Math.PI * 2); cx.fill();

    // Hair/hat (varies by NPC)
    var hairColor = npc.hairColor || '#5a4a3a';
    cx.fillStyle = hairColor;
    cx.fillRect(cx0 - 5, by, 10, 3);
    cx.fillRect(cx0 - 6, by + 2, 12, 3);

    // Face
    cx.fillStyle = '#f5d0a0';
    cx.fillRect(cx0 - 4, by + 5, 8, 6);

    // Eyes
    cx.fillStyle = '#2a2a2a';
    cx.fillRect(cx0 - 3, by + 7, 2, 2);
    cx.fillRect(cx0 + 1, by + 7, 2, 2);

    // Smile
    cx.fillStyle = '#c06050';
    cx.fillRect(cx0 - 1, by + 10, 2, 1);

    // Body (NPC color)
    cx.fillStyle = color;
    cx.fillRect(cx0 - 5, by + 12, 10, 6);

    // Apron or accessory for vendors
    if (npc.hasApron) {
        cx.fillStyle = '#ffffff';
        cx.fillRect(cx0 - 4, by + 13, 8, 5);
    }

    // Legs
    cx.fillStyle = '#4a4a4a';
    cx.fillRect(cx0 - 4, by + 18, 3, 5);
    cx.fillRect(cx0 + 1, by + 18, 3, 5);

    // Shoes
    cx.fillStyle = '#3a2a1a';
    cx.fillRect(cx0 - 5, by + 23, 4, 2);
    cx.fillRect(cx0 + 1, by + 23, 4, 2);
}

// ============================================================
// Enemy sprites — state-based
// ============================================================

function generateEnemySprites() {
    var states = ['patrol', 'chase', 'stunned', 'slowed', 'retreat'];
    var stateColors = {
        patrol: '#884444',
        chase: '#ff4444',
        stunned: '#aaaaaa',
        slowed: '#6688cc',
        retreat: '#dddd44'
    };

    for (var s = 0; s < states.length; s++) {
        var state = states[s];
        SPRITES.enemy[state] = createOutlinedSprite(24, 24, function(cx) {
            var col = stateColors[state];
            drawEnemyBody(cx, 24, col, state);
        });
    }
}

function drawEnemyBody(cx, size, color, state) {
    var s = size;
    var cx0 = s / 2;

    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.15)';
    cx.beginPath(); cx.ellipse(cx0, s - 2, 8, 3, 0, 0, Math.PI * 2); cx.fill();

    // Body (stocky)
    cx.fillStyle = color;
    cx.fillRect(3, 6, s - 6, s - 8);

    // Head (slightly wider)
    cx.fillRect(2, 1, s - 4, 7);

    // Eyes
    cx.fillStyle = '#ffffff';
    cx.fillRect(cx0 - 5, 3, 4, 4);
    cx.fillRect(cx0 + 1, 3, 4, 4);

    // Pupils (shift based on state)
    cx.fillStyle = '#000000';
    var pupOff = state === 'retreat' ? -1 : (state === 'chase' ? 1 : 0);
    cx.fillRect(cx0 - 4 + pupOff, 4, 2, 2);
    cx.fillRect(cx0 + 2 + pupOff, 4, 2, 2);

    // Angry brows for chase
    if (state === 'chase') {
        cx.fillStyle = '#000000';
        cx.fillRect(cx0 - 5, 2, 4, 1);
        cx.fillRect(cx0 + 1, 2, 4, 1);
    }

    // Legs
    if (state !== 'stunned') {
        cx.fillStyle = color;
        cx.fillRect(5, s - 3, 4, 4);
        cx.fillRect(s - 9, s - 3, 4, 4);
    }
}

// ============================================================
// Library broom sprites (enchanted broom miniboss)
// ============================================================

function generateBroomSprites() {
    SPRITES.broom = {};
    SPRITES.broom.patrol = createOutlinedSprite(28, 28, function(cx) {
        drawBroom(cx, false, false);
    });
    SPRITES.broom.chase = createOutlinedSprite(28, 28, function(cx) {
        drawBroom(cx, true, false);
    });
    SPRITES.broom.stunned = createOutlinedSprite(28, 28, function(cx) {
        drawBroom(cx, false, true);
    });
}

function drawBroom(cx, chasing, stunned) {
    // Shadow
    cx.fillStyle = 'rgba(0,0,0,0.12)';
    cx.beginPath(); cx.ellipse(14, 25, 8, 3, 0, 0, Math.PI * 2); cx.fill();

    if (stunned) {
        // Fallen flat on ground
        // Handle (horizontal)
        cx.fillStyle = '#8d6e63';
        cx.fillRect(2, 14, 20, 4);
        // Bristles (spread out on ground)
        cx.fillStyle = '#d4a03c';
        cx.fillRect(20, 10, 8, 12);
        cx.fillStyle = '#c49030';
        cx.fillRect(22, 11, 5, 10);
        // Dazed sparkles drawn by render function
    } else if (chasing) {
        // Tilted forward, flying at player
        // Handle (angled)
        cx.fillStyle = '#8d6e63';
        cx.save();
        cx.translate(14, 14);
        cx.rotate(-0.4);
        cx.fillRect(-12, -2, 18, 3);
        cx.restore();
        // Bristles (compact, forward)
        cx.fillStyle = '#d4a03c';
        cx.fillRect(18, 6, 8, 14);
        cx.fillStyle = '#e8b840';
        cx.fillRect(20, 7, 5, 12);
        // Angry eyes on handle
        cx.fillStyle = '#ff4444';
        cx.fillRect(8, 10, 3, 3);
        cx.fillRect(13, 10, 3, 3);
        cx.fillStyle = '#ffffff';
        cx.fillRect(9, 11, 1, 1);
        cx.fillRect(14, 11, 1, 1);
        // Dust trail
        cx.fillStyle = 'rgba(180,160,120,0.3)';
        cx.beginPath(); cx.arc(2, 18, 3, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(5, 22, 2, 0, Math.PI * 2); cx.fill();
    } else {
        // Upright, sweeping patrol
        // Handle (vertical)
        cx.fillStyle = '#8d6e63';
        cx.fillRect(12, 0, 4, 18);
        // Handle top knob
        cx.fillStyle = '#6d4c41';
        cx.fillRect(11, 0, 6, 3);
        // Bristles (bottom, fanned out)
        cx.fillStyle = '#d4a03c';
        cx.fillRect(6, 17, 16, 8);
        cx.fillStyle = '#c49030';
        cx.fillRect(8, 18, 12, 6);
        cx.fillStyle = '#e8b840';
        cx.fillRect(10, 19, 8, 4);
        // Bristle tips (jagged)
        cx.fillStyle = '#b88020';
        cx.fillRect(7, 24, 2, 2);
        cx.fillRect(11, 25, 2, 1);
        cx.fillRect(15, 24, 2, 2);
        cx.fillRect(19, 25, 2, 1);
        // Eyes (on handle, cartoonish)
        cx.fillStyle = '#ffeb3b';
        cx.fillRect(10, 7, 3, 3);
        cx.fillRect(15, 7, 3, 3);
        cx.fillStyle = '#000000';
        cx.fillRect(11, 8, 1, 1);
        cx.fillRect(16, 8, 1, 1);
    }
}

// ============================================================
// Object sprites (crate, BMX, Nokia, cartridge)
// ============================================================

function generateObjectSprites() {
    var T = CONFIG.TILE_SIZE;

    // Crate
    SPRITES.objects.crate = createSprite(T, T, function(cx) {
        // Shadow
        cx.fillStyle = 'rgba(0,0,0,0.18)';
        cx.fillRect(3, 3, T - 2, T - 2);
        // Body
        cx.fillStyle = '#b5651d';
        cx.fillRect(1, 1, T - 3, T - 3);
        // Planks
        cx.strokeStyle = '#8b4513';
        cx.lineWidth = 1;
        cx.strokeRect(1, 1, T - 3, T - 3);
        cx.beginPath();
        cx.moveTo(T / 2, 1); cx.lineTo(T / 2, T - 2);
        cx.moveTo(1, T / 2); cx.lineTo(T - 2, T / 2);
        cx.stroke();
        // Corner nails
        cx.fillStyle = '#d4a03c';
        cx.fillRect(3, 3, 2, 2);
        cx.fillRect(T - 6, 3, 2, 2);
        cx.fillRect(3, T - 6, 2, 2);
        cx.fillRect(T - 6, T - 6, 2, 2);
        // Wood grain
        cx.fillStyle = '#a55510';
        cx.fillRect(6, 8, 8, 1);
        cx.fillRect(T / 2 + 4, 20, 6, 1);
    });

    // BMX bike
    SPRITES.objects.bmx = createSprite(T, T, function(cx) {
        // Wheels
        cx.strokeStyle = '#333';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(8, T - 7, 6, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(T - 8, T - 7, 6, 0, Math.PI * 2); cx.stroke();
        // Spokes
        cx.lineWidth = 1;
        for (var s = 0; s < 4; s++) {
            var a = s * Math.PI / 2;
            cx.beginPath();
            cx.moveTo(8 + Math.cos(a) * 2, T - 7 + Math.sin(a) * 2);
            cx.lineTo(8 + Math.cos(a) * 5, T - 7 + Math.sin(a) * 5);
            cx.stroke();
        }
        // Frame
        cx.strokeStyle = '#e94560';
        cx.lineWidth = 2;
        cx.beginPath();
        cx.moveTo(8, T - 7);
        cx.lineTo(T / 2, 8);
        cx.lineTo(T - 8, T - 7);
        cx.stroke();
        // Handlebar
        cx.beginPath();
        cx.moveTo(T - 10, T - 12);
        cx.lineTo(T - 4, T - 18);
        cx.stroke();
        // Seat
        cx.fillStyle = '#333';
        cx.fillRect(T / 2 - 3, 6, 6, 3);
    });

    // Nokia 3210
    SPRITES.objects.nokia = createSprite(T, T, function(cx) {
        var nx = T / 2 - 8;
        var ny = 2;
        // Phone body
        cx.fillStyle = '#2a3a2a';
        cx.fillRect(nx, ny, 16, 28);
        cx.strokeStyle = '#4a6a4a';
        cx.lineWidth = 1;
        cx.strokeRect(nx, ny, 16, 28);
        // Screen
        cx.fillStyle = '#8bac0f';
        cx.fillRect(nx + 2, ny + 3, 12, 8);
        // Screen text
        cx.fillStyle = '#5a7a0a';
        cx.fillRect(nx + 4, ny + 5, 8, 1);
        cx.fillRect(nx + 4, ny + 8, 6, 1);
        // Buttons
        cx.fillStyle = '#4a6a4a';
        for (var br = 0; br < 3; br++) {
            for (var bc = 0; bc < 2; bc++) {
                cx.fillRect(nx + 2 + bc * 7, ny + 14 + br * 5, 5, 3);
            }
        }
    });

    // Tomato Basket
    SPRITES.objects.market_tomato = createSprite(T, T, function(cx) {
        // Basket
        cx.fillStyle = '#8b6914';
        cx.fillRect(6, 14, 20, 12);
        cx.strokeStyle = '#6b4904';
        cx.lineWidth = 1;
        cx.strokeRect(6, 14, 20, 12);
        // Woven lines
        cx.strokeStyle = '#7a5a0e';
        cx.beginPath();
        cx.moveTo(8, 19); cx.lineTo(24, 19);
        cx.moveTo(8, 23); cx.lineTo(24, 23);
        cx.stroke();
        // Tomatoes peeking out
        cx.fillStyle = '#e53935';
        cx.beginPath(); cx.arc(11, 13, 5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(19, 12, 5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(15, 10, 4, 0, Math.PI * 2); cx.fill();
        // Highlights
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.beginPath(); cx.arc(9, 11, 2, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(17, 10, 2, 0, Math.PI * 2); cx.fill();
        // Stems
        cx.fillStyle = '#4caf50';
        cx.fillRect(10, 8, 2, 2);
        cx.fillRect(18, 7, 2, 2);
        cx.fillRect(14, 6, 2, 2);
    });

    // Banana Stand
    SPRITES.objects.market_banana = createSprite(T, T, function(cx) {
        // Stand post
        cx.fillStyle = '#8b6914';
        cx.fillRect(14, 18, 4, 12);
        // Stand top (hook)
        cx.fillStyle = '#6b4904';
        cx.fillRect(8, 16, 16, 3);
        // Bananas hanging
        cx.fillStyle = '#ffd600';
        // Bunch 1
        cx.beginPath();
        cx.moveTo(10, 16); cx.quadraticCurveTo(7, 10, 9, 6);
        cx.lineWidth = 4; cx.strokeStyle = '#ffd600'; cx.stroke();
        // Bunch 2
        cx.beginPath();
        cx.moveTo(16, 16); cx.quadraticCurveTo(13, 8, 15, 4);
        cx.stroke();
        // Bunch 3
        cx.beginPath();
        cx.moveTo(22, 16); cx.quadraticCurveTo(25, 10, 23, 6);
        cx.stroke();
        // Tips
        cx.fillStyle = '#8d6e63';
        cx.beginPath(); cx.arc(9, 5, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(15, 3, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(23, 5, 1.5, 0, Math.PI * 2); cx.fill();
    });

    // Spatula (on counter)
    SPRITES.objects.kitchen_spatula = createSprite(T, T, function(cx) {
        // Counter surface hint
        cx.fillStyle = '#8b6914';
        cx.fillRect(2, 22, 28, 8);
        cx.fillStyle = '#7a5a0e';
        cx.fillRect(2, 22, 28, 2);
        // Spatula handle
        cx.fillStyle = '#8d6e63';
        cx.fillRect(10, 10, 4, 14);
        // Handle wrap
        cx.fillStyle = '#6d4c41';
        cx.fillRect(10, 18, 4, 3);
        // Spatula head
        cx.fillStyle = '#bdbdbd';
        cx.fillRect(7, 3, 10, 8);
        cx.fillStyle = '#9e9e9e';
        cx.fillRect(8, 4, 8, 6);
        // Highlight
        cx.fillStyle = 'rgba(255,255,255,0.2)';
        cx.fillRect(9, 4, 2, 5);
    });

    // Flour bag
    SPRITES.objects.kitchen_flour = createSprite(T, T, function(cx) {
        // Bag body
        cx.fillStyle = '#f5f5dc';
        cx.fillRect(6, 6, 20, 22);
        cx.strokeStyle = '#d4c4a0';
        cx.lineWidth = 1;
        cx.strokeRect(6, 6, 20, 22);
        // Top fold / tie
        cx.fillStyle = '#e8d8b8';
        cx.fillRect(6, 6, 20, 5);
        cx.fillStyle = '#c4a46c';
        cx.fillRect(12, 4, 8, 4);
        // Label text
        cx.fillStyle = '#8d6e63';
        cx.font = 'bold 7px monospace';
        cx.textAlign = 'center';
        cx.fillText('FLOUR', 16, 20);
        // Flour dusting
        cx.fillStyle = 'rgba(255,255,255,0.4)';
        cx.fillRect(8, 24, 16, 3);
    });

    // Bookshelf (interactable — books with a highlight glow)
    SPRITES.objects.bookshelf = createSprite(T, T, function(cx) {
        // Shelf back
        cx.fillStyle = '#5a3216';
        cx.fillRect(0, 0, T, T);
        // Shelf planks
        cx.fillStyle = '#6b4226';
        cx.fillRect(0, T / 2 - 1, T, 3);
        cx.fillRect(0, T - 2, T, 2);
        // Books top shelf
        var bookColors = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#e65100'];
        for (var b = 0; b < 5; b++) {
            cx.fillStyle = bookColors[b];
            var bw = 4 + (b % 2);
            cx.fillRect(2 + b * 6, 2, bw, T / 2 - 4);
        }
        // Books bottom shelf
        for (var b2 = 0; b2 < 4; b2++) {
            cx.fillStyle = bookColors[(b2 + 3) % 6];
            cx.fillRect(4 + b2 * 7, T / 2 + 3, 5, T / 2 - 6);
        }
        // Slight glow to indicate interactable
        cx.fillStyle = 'rgba(255,215,0,0.08)';
        cx.fillRect(0, 0, T, T);
    });

    // NES Cartridge
    SPRITES.objects.cartridge = createSprite(T, T, function(cx) {
        var x = T / 2 - 8;
        var y = 4;
        // Body
        cx.fillStyle = '#666666';
        cx.fillRect(x, y, 16, 24);
        cx.strokeStyle = '#444444';
        cx.lineWidth = 1;
        cx.strokeRect(x, y, 16, 24);
        // Red label
        cx.fillStyle = '#8b0000';
        cx.fillRect(x + 2, y + 3, 12, 8);
        // Label text
        cx.fillStyle = '#ffffff';
        cx.font = 'bold 5px monospace';
        cx.textAlign = 'center';
        cx.fillText('SALSA', x + 8, y + 9);
        // Pin connector
        cx.fillStyle = '#c4a46c';
        cx.fillRect(x + 3, y + 20, 10, 3);
    });

    // Papa's Competition Form (paper on desk)
    SPRITES.objects.papa_form = createSprite(T, T, function(cx) {
        // Paper
        cx.fillStyle = '#fff9c4';
        cx.fillRect(6, 4, 20, 24);
        // Paper edge shadow
        cx.fillStyle = '#e0d8a0';
        cx.fillRect(25, 5, 1, 23);
        cx.fillRect(7, 27, 19, 1);
        // Writing lines
        cx.fillStyle = '#999';
        for (var ln = 0; ln < 5; ln++) {
            cx.fillRect(9, 8 + ln * 4, 14, 1);
        }
        // Red "IMPORTANT" stamp
        cx.fillStyle = '#cc0000';
        cx.fillRect(9, 6, 12, 3);
        cx.fillStyle = '#ffffff';
        cx.font = '3px monospace';
        cx.textAlign = 'center';
        cx.fillText('!!', 15, 8);
        // Interactable glow
        cx.fillStyle = 'rgba(255,215,0,0.1)';
        cx.fillRect(0, 0, T, T);
    });

    // Tamagotchi (small egg-shaped device)
    SPRITES.objects.tamagotchi = createSprite(T, T, function(cx) {
        // Egg body
        cx.fillStyle = '#e040fb';
        cx.beginPath(); cx.ellipse(T / 2, T / 2 + 2, 10, 12, 0, 0, Math.PI * 2); cx.fill();
        // Lighter highlight
        cx.fillStyle = '#ea80fc';
        cx.beginPath(); cx.ellipse(T / 2 - 2, T / 2 - 2, 5, 6, 0, 0, Math.PI * 2); cx.fill();
        // Screen
        cx.fillStyle = '#b0e0a8';
        cx.fillRect(T / 2 - 5, T / 2 - 4, 10, 8);
        // Tiny pixel pet on screen
        cx.fillStyle = '#333';
        cx.fillRect(T / 2 - 2, T / 2 - 1, 4, 3);
        cx.fillRect(T / 2 - 1, T / 2 + 2, 2, 1);
        // Buttons below screen
        cx.fillStyle = '#333';
        cx.beginPath(); cx.arc(T / 2 - 3, T / 2 + 8, 2, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(T / 2 + 3, T / 2 + 8, 2, 0, Math.PI * 2); cx.fill();
        // Interactable glow
        cx.fillStyle = 'rgba(255,215,0,0.08)';
        cx.fillRect(0, 0, T, T);
    });

    // Punching bag
    SPRITES.objects.punching_bag = createSprite(T, T, function(cx) {
        // Chain from top
        cx.fillStyle = '#888';
        cx.fillRect(T / 2 - 1, 0, 2, 6);
        // Bag body
        cx.fillStyle = '#8d6e63';
        cx.beginPath(); cx.ellipse(T / 2, T / 2 + 2, 9, 12, 0, 0, Math.PI * 2); cx.fill();
        // Stitching
        cx.strokeStyle = '#6d4e43';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(T / 2, 6); cx.lineTo(T / 2, T - 4);
        cx.stroke();
        // Highlight
        cx.fillStyle = '#a08070';
        cx.fillRect(T / 2 - 6, T / 2 - 6, 3, 10);
    });
}

// ============================================================
// Item sprites (world items — small icons)
// ============================================================

function generateItemSprites() {
    var T = CONFIG.TILE_SIZE;
    var S = 20; // item sprite size

    // Recipe scroll
    SPRITES.items.recipe = createSprite(S, S, function(cx) {
        // Scroll body
        cx.fillStyle = '#f5e6c8';
        cx.fillRect(4, 2, 12, 16);
        // Scroll rolls
        cx.fillStyle = '#dcc8a0';
        cx.beginPath(); cx.ellipse(10, 2, 7, 2, 0, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.ellipse(10, 18, 7, 2, 0, 0, Math.PI * 2); cx.fill();
        // Writing lines
        cx.fillStyle = '#8b6914';
        cx.fillRect(6, 5, 8, 1);
        cx.fillRect(6, 8, 6, 1);
        cx.fillRect(6, 11, 8, 1);
        cx.fillRect(6, 14, 4, 1);
    });

    // Spatula
    SPRITES.items.spatula = createSprite(S, S, function(cx) {
        // Handle
        cx.fillStyle = '#8d6e63';
        cx.fillRect(8, 8, 3, 10);
        // Head
        cx.fillStyle = '#bdbdbd';
        cx.fillRect(5, 2, 9, 7);
        cx.fillStyle = '#9e9e9e';
        cx.fillRect(6, 3, 7, 5);
    });

    // Tomato
    SPRITES.items.tomato = createSprite(S, S, function(cx) {
        cx.fillStyle = '#e53935';
        cx.beginPath(); cx.arc(10, 11, 7, 0, Math.PI * 2); cx.fill();
        // Highlight
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.beginPath(); cx.arc(7, 8, 3, 0, Math.PI * 2); cx.fill();
        // Stem
        cx.fillStyle = '#4caf50';
        cx.fillRect(8, 3, 4, 3);
        cx.fillRect(7, 3, 2, 2);
    });

    // Flour bag
    SPRITES.items.flour = createSprite(S, S, function(cx) {
        cx.fillStyle = '#f5f5dc';
        cx.fillRect(3, 4, 14, 14);
        cx.strokeStyle = '#d4c4a0';
        cx.lineWidth = 1;
        cx.strokeRect(3, 4, 14, 14);
        // Label
        cx.fillStyle = '#8d6e63';
        cx.font = 'bold 6px monospace';
        cx.textAlign = 'center';
        cx.fillText('FLOUR', 10, 13);
        // Top fold
        cx.fillStyle = '#e8d8b8';
        cx.fillRect(3, 4, 14, 3);
    });

    // Banana
    SPRITES.items.banana = createSprite(S, S, function(cx) {
        cx.strokeStyle = '#ffd600';
        cx.lineWidth = 4;
        cx.beginPath();
        cx.arc(10, 12, 7, Math.PI * 0.1, Math.PI * 0.9);
        cx.stroke();
        // Tip
        cx.fillStyle = '#8d6e63';
        cx.beginPath(); cx.arc(16, 9, 2, 0, Math.PI * 2); cx.fill();
    });

    // Dirty sock
    SPRITES.items.dirty_sock = createSprite(S, S, function(cx) {
        cx.fillStyle = '#8d8d8d';
        cx.fillRect(6, 2, 8, 10);
        // Foot part
        cx.fillRect(4, 10, 12, 6);
        // Toe
        cx.beginPath(); cx.arc(10, 16, 6, 0, Math.PI); cx.fill();
        // Stink lines
        cx.strokeStyle = '#66bb6a';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(12, 1); cx.quadraticCurveTo(14, -1, 13, -3);
        cx.moveTo(8, 0); cx.quadraticCurveTo(6, -2, 7, -4);
        cx.stroke();
    });

    // Plank (for inventory display)
    SPRITES.items.plank = createSprite(S, S, function(cx) {
        cx.fillStyle = '#c4a46c';
        cx.fillRect(2, 6, 16, 8);
        cx.strokeStyle = '#8b6914';
        cx.lineWidth = 1;
        cx.strokeRect(2, 6, 16, 8);
        // Wood grain
        cx.fillStyle = '#a08050';
        cx.fillRect(4, 9, 12, 1);
    });
}

// ============================================================
// Power-up sprites (small world pickups)
// ============================================================

function generatePowerupSprites() {
    // Broccoli
    SPRITES.powerups.broccoli = createSprite(20, 20, function(cx) {
        cx.fillStyle = '#2e7d32';
        cx.beginPath(); cx.arc(7, 6, 4, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(13, 6, 4, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(10, 3, 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#66bb6a';
        cx.fillRect(8, 10, 4, 7);
    });

    // Chocolate milk
    SPRITES.powerups.chocolate_milk = createSprite(20, 20, function(cx) {
        cx.fillStyle = '#5d4037';
        cx.fillRect(5, 3, 10, 14);
        cx.fillStyle = '#795548';
        cx.fillRect(6, 4, 8, 12);
        // Label
        cx.fillStyle = '#ffffff';
        cx.fillRect(7, 7, 6, 4);
        // Cap
        cx.fillStyle = '#3e2723';
        cx.fillRect(6, 2, 8, 3);
    });

    // Water bottle
    SPRITES.powerups.water = createSprite(20, 20, function(cx) {
        cx.fillStyle = '#42a5f5';
        cx.fillRect(6, 5, 8, 12);
        cx.fillStyle = '#64b5f6';
        cx.fillRect(7, 6, 6, 10);
        // Cap
        cx.fillStyle = '#1565c0';
        cx.fillRect(7, 3, 6, 3);
        // Highlight
        cx.fillStyle = 'rgba(255,255,255,0.4)';
        cx.fillRect(8, 7, 2, 6);
    });

    // Deli meat
    SPRITES.powerups.deli_meat = createSprite(20, 20, function(cx) {
        cx.fillStyle = '#ef5350';
        cx.beginPath(); cx.ellipse(10, 10, 7, 5, 0, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#c62828';
        cx.beginPath(); cx.ellipse(10, 10, 5, 3, 0, 0, Math.PI * 2); cx.fill();
        // Fat marbling
        cx.fillStyle = '#ffcdd2';
        cx.fillRect(7, 8, 2, 1);
        cx.fillRect(11, 10, 3, 1);
    });

    // Gouda cheese
    SPRITES.powerups.gouda = createSprite(20, 20, function(cx) {
        cx.fillStyle = '#ffc107';
        cx.beginPath();
        cx.moveTo(3, 14);
        cx.lineTo(10, 3);
        cx.lineTo(17, 14);
        cx.closePath();
        cx.fill();
        // Holes
        cx.fillStyle = '#ff8f00';
        cx.beginPath(); cx.arc(8, 10, 2, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(13, 11, 1.5, 0, Math.PI * 2); cx.fill();
        // Rind
        cx.fillStyle = '#e65100';
        cx.fillRect(3, 13, 14, 2);
    });

    // Brownie/muffin
    SPRITES.powerups.brownie = createSprite(20, 20, function(cx) {
        // Wrapper
        cx.fillStyle = '#8d6e63';
        cx.fillRect(4, 10, 12, 7);
        // Muffin top
        cx.fillStyle = '#5d4037';
        cx.beginPath(); cx.arc(10, 10, 7, Math.PI, 0); cx.fill();
        // Chocolate chips
        cx.fillStyle = '#3e2723';
        cx.fillRect(7, 7, 2, 2);
        cx.fillRect(11, 8, 2, 2);
    });

    // Milk carton
    SPRITES.powerups.milk = createSprite(20, 20, function(cx) {
        cx.fillStyle = '#f5f5f5';
        cx.fillRect(5, 4, 10, 13);
        cx.strokeStyle = '#bdbdbd';
        cx.lineWidth = 1;
        cx.strokeRect(5, 4, 10, 13);
        // Label
        cx.fillStyle = '#42a5f5';
        cx.fillRect(6, 8, 8, 4);
        // Roof
        cx.fillStyle = '#e0e0e0';
        cx.beginPath();
        cx.moveTo(5, 5);
        cx.lineTo(10, 1);
        cx.lineTo(15, 5);
        cx.closePath();
        cx.fill();
    });
}

// ============================================================
// Main generation function — called once at startup
// ============================================================

/** Generates all sprite assets. Must be called before the first render. */
function generateAllSprites() {
    generateTileSprites();
    generatePlayerSprites();
    generateBrodoSprites();
    generateNPCSprites();
    generateEnemySprites();
    generateBroomSprites();
    generateObjectSprites();
    generateItemSprites();
    generatePowerupSprites();
    generatePortraits();
}

// ============================================================
// Sprite lookup helpers (used by render functions)
// ============================================================

/** Returns the appropriate tile sprite for a tile ID at a given grid position. */
function getTileSprite(tileId, col, row) {
    var label = (TILE_BY_ID[tileId] || TILES.FLOOR).label;
    var sprites = SPRITES.tiles[label];
    if (!sprites) return SPRITES.tiles.floor[0]; // fallback

    // Animated tiles use frame index
    if (label === 'water' || label === 'bridgegap') {
        var frame = Math.floor(game.time * 3) % 4;
        return sprites[frame];
    }
    // Variant tiles use position-based selection
    if (Array.isArray(sprites)) {
        var variant = ((col * 7 + row * 13) % sprites.length + sprites.length) % sprites.length;
        return sprites[variant];
    }
    return sprites;
}

// ============================================================
// NPC Portraits — LucasArts/Sierra-style expressive faces (64×64)
// ============================================================

/** Portrait storage. portraits[npcId] = offscreen canvas 64x64. */
const PORTRAITS = {};

/** Generates all NPC portraits. Called from generateAllSprites(). */
function generatePortraits() {
    // Luigi — round-faced, chef hat, big friendly grin, rosy cheeks
    PORTRAITS['chef_tutorial'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#ffcc99', '#4fc3f7');
        // Chef hat
        cx.fillStyle = '#ffffff';
        cx.fillRect(16, 2, 32, 10);
        cx.fillRect(12, 10, 40, 6);
        cx.fillStyle = '#eeeeee';
        cx.fillRect(18, 4, 8, 6);
        // Big grin
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(32, 44, 8, 0, Math.PI); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(26, 44, 12, 3);
        // Mustache
        cx.fillStyle = '#3a2010';
        cx.beginPath();
        cx.moveTo(22, 40); cx.quadraticCurveTo(27, 36, 32, 40);
        cx.quadraticCurveTo(37, 36, 42, 40);
        cx.lineWidth = 2; cx.strokeStyle = '#3a2010'; cx.stroke();
    });

    // Signora Betta — purple headscarf, warm eyes, knowing smile, wrinkles
    PORTRAITS['signora_betta'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a0', '#ce93d8');
        // Headscarf
        cx.fillStyle = '#ce93d8';
        cx.fillRect(10, 4, 44, 14);
        cx.fillRect(8, 14, 48, 4);
        cx.fillStyle = '#b070c0';
        cx.fillRect(14, 6, 36, 4);
        // Scarf drape
        cx.fillStyle = '#ce93d8';
        cx.fillRect(8, 18, 6, 12);
        cx.fillRect(50, 18, 6, 12);
        // Warm smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(32, 44, 6, 0.1, Math.PI - 0.1); cx.stroke();
        // Crow's feet wrinkles
        cx.strokeStyle = 'rgba(100,70,40,0.3)';
        cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(16, 32); cx.lineTo(12, 30); cx.stroke();
        cx.beginPath(); cx.moveTo(48, 32); cx.lineTo(52, 30); cx.stroke();
    });

    // Nonna Pina — round glasses, white bun, gentle smile, rosy cheeks
    PORTRAITS['nonna_pina'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a0', '#90a4ae');
        // White hair bun
        cx.fillStyle = '#e0e0e0';
        cx.fillRect(14, 4, 36, 12);
        cx.beginPath(); cx.arc(32, 4, 12, Math.PI, 0); cx.fill();
        cx.fillStyle = '#cccccc';
        cx.fillRect(16, 6, 8, 6);
        // Round glasses
        cx.strokeStyle = '#8d6e63';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(24, 32, 7, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(40, 32, 7, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.moveTo(31, 32); cx.lineTo(33, 32); cx.stroke();
        // Gentle smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(32, 44, 5, 0.2, Math.PI - 0.2); cx.stroke();
        // Extra rosy cheeks
        cx.fillStyle = 'rgba(255,120,120,0.25)';
        cx.beginPath(); cx.arc(18, 40, 5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(46, 40, 5, 0, Math.PI * 2); cx.fill();
    });

    // Old Sal — weathered, stubble, floppy hat, one eye squinting, crooked grin
    PORTRAITS['canal_sal'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#dbb68a', '#8d6e63');
        // Floppy fisherman hat
        cx.fillStyle = '#6d4c41';
        cx.fillRect(6, 6, 52, 6);
        cx.fillStyle = '#5d3c31';
        cx.fillRect(14, 2, 36, 8);
        // Stubble
        cx.fillStyle = 'rgba(80,60,40,0.2)';
        for (var s = 0; s < 10; s++) {
            cx.fillRect(20 + (s * 3) % 24, 42 + (s * 7) % 8, 1, 2);
        }
        // Squinting left eye
        cx.fillStyle = '#333333';
        cx.fillRect(20, 30, 8, 2); // squint line
        // Normal right eye
        cx.fillStyle = '#ffffff'; cx.fillRect(36, 28, 8, 6);
        cx.fillStyle = '#333333'; cx.fillRect(38, 29, 4, 4);
        cx.fillStyle = '#ffffff'; cx.fillRect(39, 30, 1, 1);
        // Crooked grin
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(24, 46); cx.quadraticCurveTo(32, 50, 40, 44); cx.stroke();
    });

    // Zia Carmela — big round face, flower in hair, wide smile, laugh lines
    PORTRAITS['canal_carmela'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a0', '#ff8a65');
        // Curly dark hair
        cx.fillStyle = '#3a2010';
        cx.fillRect(10, 4, 44, 14);
        cx.beginPath(); cx.arc(14, 12, 6, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(50, 12, 6, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(32, 4, 10, Math.PI, 0); cx.fill();
        // Flower in hair
        cx.fillStyle = '#ff5252';
        cx.beginPath(); cx.arc(48, 10, 5, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#ffeb3b';
        cx.beginPath(); cx.arc(48, 10, 2, 0, Math.PI * 2); cx.fill();
        // Wide smile
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(32, 45, 9, 0, Math.PI); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(25, 45, 14, 3);
        // Laugh lines
        cx.strokeStyle = 'rgba(180,120,80,0.3)';
        cx.lineWidth = 1;
        cx.beginPath(); cx.arc(16, 36, 6, -0.5, 0.5); cx.stroke();
        cx.beginPath(); cx.arc(48, 36, 6, Math.PI - 0.5, Math.PI + 0.5); cx.stroke();
    });

    // Signora Lucia — neat bun, pince-nez glasses, pursed lips, stern but kind
    PORTRAITS['library_lucia'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a0', '#78909c');
        // Neat grey hair bun
        cx.fillStyle = '#78909c';
        cx.fillRect(14, 4, 36, 12);
        cx.beginPath(); cx.arc(32, 2, 8, Math.PI, 0); cx.fill();
        // Pince-nez glasses (no arms, just lenses)
        cx.strokeStyle = '#c4a46c';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(26, 32, 5, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(38, 32, 5, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.moveTo(31, 32); cx.lineTo(33, 32); cx.stroke();
        // Chain
        cx.strokeStyle = '#c4a46c';
        cx.lineWidth = 0.5;
        cx.beginPath(); cx.moveTo(21, 34); cx.quadraticCurveTo(16, 42, 14, 52); cx.stroke();
        // Pursed but kind smile
        cx.fillStyle = '#c06050';
        cx.fillRect(28, 44, 8, 2);
    });

    // Professor Gatto — wild white hair, thick glasses, bushy eyebrows, gap teeth grin
    PORTRAITS['library_reader'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a0', '#5c6bc0');
        // Wild white hair
        cx.fillStyle = '#e0e0e0';
        cx.fillRect(8, 2, 48, 16);
        cx.beginPath(); cx.arc(10, 10, 8, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(54, 10, 8, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(32, 0, 12, Math.PI, 0); cx.fill();
        // Thick glasses
        cx.strokeStyle = '#333333';
        cx.lineWidth = 3;
        cx.beginPath(); cx.arc(24, 30, 8, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(42, 30, 8, 0, Math.PI * 2); cx.stroke();
        cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(32, 30); cx.lineTo(34, 30); cx.stroke();
        // Thick magnified eyes behind glasses
        cx.fillStyle = '#ffffff'; cx.fillRect(19, 27, 10, 7); cx.fillRect(37, 27, 10, 7);
        cx.fillStyle = '#1565c0'; cx.fillRect(22, 28, 5, 5); cx.fillRect(40, 28, 5, 5);
        cx.fillStyle = '#000000'; cx.fillRect(24, 29, 2, 3); cx.fillRect(42, 29, 2, 3);
        // Bushy eyebrows
        cx.fillStyle = '#cccccc';
        cx.fillRect(16, 22, 14, 3);
        cx.fillRect(36, 22, 14, 3);
        // Gap-tooth grin
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(33, 46, 7, 0, Math.PI); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(27, 46, 4, 3);
        cx.fillRect(34, 46, 4, 3);
    });

    // Marco the Vendor — tanned, market apron, big eyebrows, friendly wink
    PORTRAITS['market_vendor'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#dbb08a', '#ff8a65');
        // Dark wavy hair
        cx.fillStyle = '#3a2010';
        cx.fillRect(12, 4, 40, 12);
        cx.beginPath(); cx.arc(32, 4, 14, Math.PI, 0); cx.fill();
        // Big expressive eyebrows
        cx.fillStyle = '#3a2010';
        cx.fillRect(18, 24, 10, 3);
        cx.fillRect(36, 24, 10, 3);
        // Winking left eye
        cx.fillStyle = '#333333';
        cx.fillRect(20, 30, 8, 2);
        // Open right eye
        cx.fillStyle = '#ffffff'; cx.fillRect(36, 28, 8, 6);
        cx.fillStyle = '#4a3020'; cx.fillRect(38, 29, 4, 4);
        cx.fillStyle = '#000000'; cx.fillRect(39, 30, 2, 2);
        cx.fillStyle = '#ffffff'; cx.fillRect(40, 30, 1, 1);
        // Big grin
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(32, 46, 8, 0.1, Math.PI - 0.1); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(26, 46, 12, 3);
    });

    // Papa Marco — headset guide, sporty dad, warm grin
    PORTRAITS['papa_marco'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a574', '#2e7d32');
        // Short buzzed hair
        cx.fillStyle = '#2a1a0a';
        cx.fillRect(14, 4, 36, 10);
        cx.beginPath(); cx.arc(32, 6, 16, Math.PI, 0); cx.fill();
        // Thick eyebrows
        cx.fillStyle = '#2a1a0a';
        cx.fillRect(19, 24, 10, 3);
        cx.fillRect(35, 24, 10, 3);
        // Warm squinting eyes (friendly)
        cx.fillStyle = '#ffffff'; cx.fillRect(20, 28, 9, 6);
        cx.fillRect(35, 28, 9, 6);
        cx.fillStyle = '#3a2510'; cx.fillRect(23, 29, 5, 4);
        cx.fillRect(38, 29, 5, 4);
        cx.fillStyle = '#000000'; cx.fillRect(24, 30, 3, 2);
        cx.fillRect(39, 30, 3, 2);
        cx.fillStyle = '#ffffff'; cx.fillRect(25, 30, 1, 1);
        cx.fillRect(40, 30, 1, 1);
        // Stubble
        cx.fillStyle = 'rgba(40,25,10,0.15)';
        cx.fillRect(16, 42, 32, 10);
        // Big warm grin
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(32, 46, 9, 0.1, Math.PI - 0.1); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(25, 46, 14, 3);
        // Headset — earpiece on left + mic boom
        cx.fillStyle = '#333333';
        cx.fillRect(6, 26, 6, 14); // left earpiece
        cx.fillStyle = '#444444';
        cx.fillRect(8, 27, 3, 12);
        // Headband across top
        cx.fillStyle = '#333333';
        cx.fillRect(8, 14, 48, 3);
        // Mic boom curving down from earpiece
        cx.fillStyle = '#555555';
        cx.fillRect(8, 38, 3, 8);
        cx.fillRect(10, 44, 8, 2);
        cx.fillStyle = '#222222';
        cx.beginPath(); cx.arc(18, 45, 3, 0, Math.PI * 2); cx.fill();
        // Green gym tank top collar
        cx.fillStyle = '#388e3c';
        cx.fillRect(20, 54, 24, 4);
    });

    // Giulia — player portrait (for self-dialogue or future use)
    PORTRAITS['giulia'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#ffcc99', '#e94560');
        // Brown hair
        cx.fillStyle = '#4a2c0a';
        cx.fillRect(10, 2, 44, 16);
        cx.fillRect(8, 14, 8, 20);
        cx.fillRect(48, 14, 8, 20);
        // Bangs
        cx.fillRect(14, 14, 36, 4);
        cx.fillStyle = '#5a3c1a';
        cx.fillRect(18, 14, 10, 3);
        // Determined expression
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(32, 44, 5, 0.3, Math.PI - 0.3); cx.stroke();
        // Slight smirk
        cx.fillStyle = '#c06050';
        cx.fillRect(35, 44, 3, 1);
    });

    // Coach Fabio — orange tank top, strong jaw, spiky hair, whistle
    PORTRAITS['gym_trainer'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a574', '#e65100');
        // Spiky hair
        cx.fillStyle = '#1a1a1a';
        cx.fillRect(14, 2, 36, 12);
        cx.fillRect(16, 0, 6, 6);
        cx.fillRect(26, 0, 6, 4);
        cx.fillRect(36, 0, 6, 6);
        cx.fillRect(44, 2, 4, 8);
        // Thick eyebrows
        cx.fillRect(18, 24, 12, 3);
        cx.fillRect(34, 24, 12, 3);
        // Intense eyes
        cx.fillStyle = '#ffffff'; cx.fillRect(20, 28, 9, 6);
        cx.fillRect(35, 28, 9, 6);
        cx.fillStyle = '#1a4a1a'; cx.fillRect(23, 29, 5, 4);
        cx.fillRect(38, 29, 5, 4);
        cx.fillStyle = '#000000'; cx.fillRect(24, 30, 3, 2);
        cx.fillRect(39, 30, 3, 2);
        // Wide grin
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(32, 46, 9, 0.1, Math.PI - 0.1); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(25, 46, 14, 3);
        // Whistle on neck
        cx.fillStyle = '#c0c0c0';
        cx.beginPath(); cx.arc(44, 52, 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#888888';
        cx.fillRect(42, 48, 2, 6);
    });

    // Juice Bar Jenny — green apron, freckles, ponytail
    PORTRAITS['gym_smoothie'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#ffe0bd', '#7cb342');
        // Ponytail hair
        cx.fillStyle = '#c06820';
        cx.fillRect(12, 2, 40, 14);
        cx.fillRect(48, 8, 10, 20);
        cx.fillRect(52, 14, 6, 12);
        // Bangs
        cx.fillRect(16, 14, 32, 4);
        // Freckles
        cx.fillStyle = '#c4906a';
        cx.fillRect(20, 38, 2, 2);
        cx.fillRect(26, 36, 2, 2);
        cx.fillRect(38, 38, 2, 2);
        cx.fillRect(42, 36, 2, 2);
        // Friendly eyes
        cx.fillStyle = '#ffffff'; cx.fillRect(20, 28, 8, 6);
        cx.fillRect(36, 28, 8, 6);
        cx.fillStyle = '#2e7d32'; cx.fillRect(23, 29, 4, 4);
        cx.fillRect(39, 29, 4, 4);
        cx.fillStyle = '#000000'; cx.fillRect(24, 30, 2, 2);
        cx.fillRect(40, 30, 2, 2);
        cx.fillStyle = '#ffffff'; cx.fillRect(25, 30, 1, 1);
        cx.fillRect(41, 30, 1, 1);
        // Warm smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(32, 44, 6, 0.2, Math.PI - 0.2); cx.stroke();
    });

    // Big Tony — red tank top, bald, huge, small eyes
    PORTRAITS['gym_lifter'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a070', '#d32f2f');
        // Bald — just a shine
        cx.fillStyle = '#e0b888';
        cx.fillRect(18, 4, 28, 8);
        cx.fillStyle = 'rgba(255,255,255,0.2)';
        cx.fillRect(22, 5, 10, 4);
        // Small squinty eyes in big face
        cx.fillStyle = '#ffffff'; cx.fillRect(22, 30, 6, 4);
        cx.fillRect(36, 30, 6, 4);
        cx.fillStyle = '#3a2010'; cx.fillRect(24, 31, 3, 2);
        cx.fillRect(38, 31, 3, 2);
        cx.fillStyle = '#000000'; cx.fillRect(25, 31, 1, 1);
        cx.fillRect(39, 31, 1, 1);
        // Thick neck (wide shoulders extend beyond normal)
        cx.fillStyle = '#d4a070';
        cx.fillRect(8, 50, 48, 14);
        cx.fillStyle = '#d32f2f';
        cx.fillRect(12, 54, 40, 10);
        // Small smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(32, 44, 5, 0.3, Math.PI - 0.3); cx.stroke();
    });
}

/** Draws the common portrait base — face circle, eyes, ears. */
function drawPortraitBase(cx, skinColor, clothColor) {
    // Background
    cx.fillStyle = '#1a1a2e';
    cx.fillRect(0, 0, 64, 64);

    // Clothing/collar at bottom
    cx.fillStyle = clothColor;
    cx.fillRect(12, 52, 40, 12);
    cx.beginPath(); cx.arc(32, 52, 20, Math.PI, 0); cx.fill();

    // Neck
    cx.fillStyle = skinColor;
    cx.fillRect(26, 48, 12, 8);

    // Face (large oval)
    cx.fillStyle = skinColor;
    cx.beginPath(); cx.ellipse(32, 32, 18, 22, 0, 0, Math.PI * 2); cx.fill();

    // Ears
    cx.beginPath(); cx.ellipse(12, 32, 4, 6, 0, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.ellipse(52, 32, 4, 6, 0, 0, Math.PI * 2); cx.fill();

    // Default eyes (can be overridden)
    cx.fillStyle = '#ffffff';
    cx.fillRect(20, 28, 9, 7);
    cx.fillRect(35, 28, 9, 7);
    cx.fillStyle = '#4a3020';
    cx.fillRect(23, 29, 4, 5);
    cx.fillRect(38, 29, 4, 5);
    cx.fillStyle = '#000000';
    cx.fillRect(24, 30, 2, 3);
    cx.fillRect(39, 30, 2, 3);
    // Eye highlights
    cx.fillStyle = '#ffffff';
    cx.fillRect(25, 30, 1, 1);
    cx.fillRect(40, 30, 1, 1);

    // Eyebrows
    cx.fillStyle = '#4a3020';
    cx.fillRect(20, 25, 9, 2);
    cx.fillRect(35, 25, 9, 2);

    // Nose
    cx.fillStyle = 'rgba(0,0,0,0.08)';
    cx.fillRect(30, 36, 4, 5);
    cx.fillStyle = skinColor;
    cx.fillRect(29, 36, 6, 4);

    // Rosy cheeks
    cx.fillStyle = 'rgba(255,150,150,0.2)';
    cx.beginPath(); cx.arc(20, 40, 4, 0, Math.PI * 2); cx.fill();
    cx.beginPath(); cx.arc(44, 40, 4, 0, Math.PI * 2); cx.fill();
}

/** Gets the portrait for an NPC, or null if none exists. */
function getPortrait(npcId) {
    return PORTRAITS[npcId] || null;
}

/** Returns the player sprite for current facing and animation frame. */
function getPlayerSprite(facing, animFrame) {
    var frames = SPRITES.player[facing];
    if (!frames) return SPRITES.player.down[0];
    return frames[animFrame % frames.length];
}

// ============================================================
// World glow/bloom post-processing (Canvas 2D compositing)
// ============================================================

/** Renders ambient glow effects over the world — light sources, door glow, item bloom. */
function renderWorldGlow(ctx, cameraX, cameraY) {
    var ts = CONFIG.TILE_SIZE;
    var map = game.currentMap;
    if (!map) return;

    ctx.save();
    ctx.globalCompositeOperation = 'screen';

    // Find door tiles and add warm light glow around them
    var startCol = Math.max(0, Math.floor(cameraX / ts));
    var startRow = Math.max(0, Math.floor(cameraY / ts));
    var endCol = Math.min(map[0].length - 1, Math.floor((cameraX + CONFIG.CANVAS_W) / ts));
    var endRow = Math.min(map.length - 1, Math.floor((cameraY + CONFIG.CANVAS_H) / ts));

    for (var row = startRow; row <= endRow; row++) {
        for (var col = startCol; col <= endCol; col++) {
            var tileId = map[row][col];
            if (tileId === TILES.DOOR.id) {
                var dx = col * ts + ts / 2 - cameraX;
                var dy = row * ts + ts / 2 - cameraY;
                var grad = ctx.createRadialGradient(dx, dy, 4, dx, dy, ts * 2);
                grad.addColorStop(0, 'rgba(255,200,100,0.12)');
                grad.addColorStop(1, 'rgba(255,200,100,0)');
                ctx.fillStyle = grad;
                ctx.fillRect(dx - ts * 2, dy - ts * 2, ts * 4, ts * 4);
            }
        }
    }

    // Subtle vignette
    ctx.globalCompositeOperation = 'multiply';
    var vg = ctx.createRadialGradient(
        CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2, CONFIG.CANVAS_W * 0.35,
        CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2, CONFIG.CANVAS_W * 0.7
    );
    vg.addColorStop(0, 'rgba(255,255,255,1)');
    vg.addColorStop(1, 'rgba(200,200,210,1)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    ctx.restore();
}
