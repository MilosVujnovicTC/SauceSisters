// ============================================================
// js/sprites.js — Sprite system: image-based loader + procedural fallback
// Loads PNG spritesheets when available; falls back to procedural canvases.
// Called once at startup; render functions use ctx.drawImage().
// ============================================================

// ============================================================
// SpriteLoader — Image-based sprite loading system
// ============================================================

const SpriteLoader = {
    images: {},       // loaded Image objects keyed by sheet path
    manifest: null,   // parsed manifest.json
    loaded: 0,
    total: 0,
    ready: false,     // true when all images attempted (loaded or failed)
    failed: [],       // list of sheet paths that failed to load

    /** Loads manifest.json, then loads all referenced image sheets. */
    load: function(onComplete) {
        var self = this;
        var xhr = new XMLHttpRequest();
        xhr.open('GET', 'assets/sprites/manifest.json?v=29', true);
        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    self.manifest = JSON.parse(xhr.responseText);
                    self._loadAllSheets(onComplete);
                } catch(e) {
                    console.warn('[SpriteLoader] Failed to parse manifest.json:', e);
                    self.ready = true;
                    if (onComplete) onComplete();
                }
            } else {
                console.warn('[SpriteLoader] manifest.json not found (status ' + xhr.status + '), using procedural sprites');
                self.ready = true;
                if (onComplete) onComplete();
            }
        };
        xhr.onerror = function() {
            console.warn('[SpriteLoader] Failed to fetch manifest.json, using procedural sprites');
            self.ready = true;
            if (onComplete) onComplete();
        };
        xhr.send();
    },

    /** Collects all unique sheet paths from manifest and loads them. */
    _loadAllSheets: function(onComplete) {
        var self = this;
        var basePath = this.manifest.basePath || 'assets/sprites/';
        var sheets = {};

        // Collect unique sheet paths from all manifest sections
        var sections = ['tiles', 'characters', 'npcs', 'bosses', 'enemies', 'items', 'ui'];
        for (var s = 0; s < sections.length; s++) {
            var section = this.manifest[sections[s]];
            if (!section) continue;
            for (var key in section) {
                if (section[key].sheet) {
                    sheets[section[key].sheet] = true;
                }
            }
        }

        var sheetPaths = Object.keys(sheets);
        this.total = sheetPaths.length;

        if (this.total === 0) {
            this.ready = true;
            if (onComplete) onComplete();
            return;
        }

        var completed = 0;
        for (var i = 0; i < sheetPaths.length; i++) {
            (function(path) {
                var img = new Image();
                img.onload = function() {
                    self.images[path] = img;
                    self.loaded++;
                    completed++;
                    if (completed === self.total) {
                        self.ready = true;
                        self._logStatus();
                        if (onComplete) onComplete();
                    }
                };
                img.onerror = function() {
                    self.failed.push(path);
                    completed++;
                    if (completed === self.total) {
                        self.ready = true;
                        self._logStatus();
                        if (onComplete) onComplete();
                    }
                };
                img.src = basePath + path;
            })(sheetPaths[i]);
        }
    },

    /** Logs which assets loaded and which are missing. */
    _logStatus: function() {
        if (this.loaded > 0) {
            console.log('[SpriteLoader] Loaded ' + this.loaded + '/' + this.total + ' sprite sheets');
        }
        if (this.failed.length > 0) {
            console.log('[SpriteLoader] Missing assets (using procedural fallback): ' + this.failed.join(', '));
        }
    },

    /** Returns true if a specific sheet path has been loaded. */
    hasSheet: function(sheetPath) {
        return !!this.images[sheetPath];
    },

    /** Draws a frame from a spritesheet. Returns true if drawn, false if sheet not loaded. */
    draw: function(ctx, sheetPath, frameX, frameY, destX, destY, frameW, frameH) {
        var img = this.images[sheetPath];
        if (!img) return false;
        frameW = frameW || 32;
        frameH = frameH || 32;
        ctx.drawImage(img,
            frameX * frameW, frameY * frameH, frameW, frameH,
            destX, destY, frameW, frameH
        );
        return true;
    },

    /** Draws a tile from the universal tileset. Returns true if drawn, false if fallback needed. */
    drawTile: function(ctx, tileLabel, destX, destY, animFrame) {
        if (!this.manifest || !this.manifest.tiles) return false;
        // Map label to uppercase key
        var key = tileLabel.toUpperCase();
        var def = this.manifest.tiles[key];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;

        var fx = def.fx;
        // For animated tiles, offset by frame
        if (def.frames && def.frames > 1 && animFrame !== undefined) {
            fx = def.fx + (animFrame % def.frames);
        }
        var T = CONFIG.TILE_SIZE;
        ctx.drawImage(img,
            fx * T, def.fy * T, T, T,
            destX, destY, T, T
        );
        return true;
    },

    /** Draws a character sprite (Giulia, Brodo). Returns true if drawn. */
    drawCharacter: function(ctx, charId, frameX, frameY, destX, destY) {
        if (!this.manifest || !this.manifest.characters) return false;
        var def = this.manifest.characters[charId];
        if (!def) return false;
        return this.draw(ctx, def.sheet, frameX, frameY, destX, destY, def.frameW, def.frameH);
    },

    /** Draws an NPC sprite. Returns true if drawn. */
    drawNPC: function(ctx, npcId, destX, destY, flipH) {
        if (!this.manifest || !this.manifest.npcs) return false;
        var def = this.manifest.npcs[npcId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        if (flipH) {
            ctx.save();
            ctx.translate(destX + def.frameW, destY);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, def.frameW, def.frameH, 0, 0, def.frameW, def.frameH);
            ctx.restore();
        } else {
            ctx.drawImage(img, 0, 0, def.frameW, def.frameH, destX, destY, def.frameW, def.frameH);
        }
        return true;
    },

    /** Draws a boss sprite. Returns true if drawn. */
    drawBoss: function(ctx, bossId, destX, destY) {
        if (!this.manifest || !this.manifest.bosses) return false;
        var def = this.manifest.bosses[bossId];
        if (!def) return false;
        return this.draw(ctx, def.sheet, 0, 0, destX, destY, def.frameW, def.frameH);
    },

    /** Draws an enemy sprite. Returns true if drawn. */
    drawEnemy: function(ctx, enemyId, destX, destY) {
        if (!this.manifest || !this.manifest.enemies) return false;
        var def = this.manifest.enemies[enemyId];
        if (!def) return false;
        return this.draw(ctx, def.sheet, 0, 0, destX, destY, def.frameW, def.frameH);
    },

    /** Draws an item from a category sheet. Returns true if drawn. */
    drawItem: function(ctx, category, frameIndex, destX, destY) {
        if (!this.manifest || !this.manifest.items) return false;
        var def = this.manifest.items[category];
        if (!def) return false;
        return this.draw(ctx, def.sheet, frameIndex, 0, destX, destY, def.frameW, def.frameH);
    },

    /** Draws a UI element. Returns true if drawn. */
    drawUI: function(ctx, uiId, frameX, frameY, destX, destY) {
        if (!this.manifest || !this.manifest.ui) return false;
        var def = this.manifest.ui[uiId];
        if (!def) return false;
        return this.draw(ctx, def.sheet, frameX, frameY, destX, destY, def.frameW, def.frameH);
    },

    /** Draws a portrait from the portraits sheet. Returns true if drawn. */
    drawPortrait: function(ctx, portraitIndex, destX, destY) {
        if (!this.manifest || !this.manifest.ui || !this.manifest.ui.portraits) return false;
        var def = this.manifest.ui.portraits;
        return this.draw(ctx, def.sheet, portraitIndex, 0, destX, destY, def.frameW, def.frameH);
    }
};

// ============================================================
// Procedural sprite system (fallback when images not loaded)
// ============================================================

/** Procedural sprite storage (fallback) — organized by category. Each value is an offscreen canvas. */
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

    // --- FOUNTAIN (4 animation frames — water basin with spray) ---
    SPRITES.tiles.fountain = [];
    for (var ff = 0; ff < 4; ff++) {
        (function(frame) {
            SPRITES.tiles.fountain.push(createSprite(T, T, function(cx) {
                var phase = frame * Math.PI / 2;
                // Stone base
                cx.fillStyle = '#8a8070';
                cx.fillRect(0, 0, T, T);
                // Circular basin border
                cx.fillStyle = '#706658';
                cx.beginPath();
                cx.arc(T / 2, T / 2, 14, 0, Math.PI * 2);
                cx.fill();
                // Basin water
                var waterB = 180 + Math.sin(phase) * 15;
                cx.fillStyle = 'rgb(80,140,' + Math.round(waterB) + ')';
                cx.beginPath();
                cx.arc(T / 2, T / 2, 11, 0, Math.PI * 2);
                cx.fill();
                // Center spout
                cx.fillStyle = '#9a9080';
                cx.fillRect(T / 2 - 2, T / 2 - 2, 4, 4);
                // Spray droplets
                cx.fillStyle = 'rgba(180,220,255,0.6)';
                var dy = Math.sin(phase) * 2;
                cx.fillRect(T / 2 - 1, T / 2 - 6 + dy, 2, 2);
                cx.fillRect(T / 2 - 4, T / 2 - 3 + dy * 0.5, 2, 1);
                cx.fillRect(T / 2 + 2, T / 2 - 4 - dy * 0.5, 1, 2);
                // Ripple rings
                cx.strokeStyle = 'rgba(200,230,255,0.35)';
                cx.lineWidth = 1;
                var rr = 5 + Math.sin(phase) * 2;
                cx.beginPath();
                cx.arc(T / 2, T / 2, rr, 0, Math.PI * 2);
                cx.stroke();
            }));
        })(ff);
    }

    // --- COBBLE (2 variants — stone cobblestone path) ---
    SPRITES.tiles.cobble = [];
    for (var cv = 0; cv < 2; cv++) {
        SPRITES.tiles.cobble.push(createSprite(T, T, function(cx) {
            cx.fillStyle = '#9e9484';
            cx.fillRect(0, 0, T, T);
            // Cobblestone grid
            cx.strokeStyle = '#88786a';
            cx.lineWidth = 1;
            // Row 1 stones
            cx.strokeRect(1, 1, 14, 14);
            cx.strokeRect(17, 1, 14, 14);
            // Row 2 stones (offset)
            cx.strokeRect(8, 17, 14, 14);
            cx.strokeRect(24, 17, 7, 14);
            cx.strokeRect(1, 17, 6, 14);
            // Stone color variation
            cx.fillStyle = cv === 0 ? '#a49a8a' : '#96897a';
            cx.fillRect(2, 2, 12, 12);
            cx.fillStyle = cv === 0 ? '#96897a' : '#a49a8a';
            cx.fillRect(18, 2, 12, 12);
            cx.fillRect(9, 18, 12, 12);
            // Highlight
            cx.fillStyle = 'rgba(255,255,255,0.08)';
            cx.fillRect(2, 2, 12, 2);
            cx.fillRect(18, 2, 12, 2);
            cx.fillRect(9, 18, 12, 2);
        }));
    }

    // --- FILLTARGET (cobble with glowing target indicator) ---
    SPRITES.tiles.filltarget = createSprite(T, T, function(cx) {
        // Same cobble base
        cx.fillStyle = '#9e9484';
        cx.fillRect(0, 0, T, T);
        cx.strokeStyle = '#88786a';
        cx.lineWidth = 1;
        cx.strokeRect(1, 1, 14, 14);
        cx.strokeRect(17, 1, 14, 14);
        cx.strokeRect(8, 17, 14, 14);
        cx.strokeRect(24, 17, 7, 14);
        cx.strokeRect(1, 17, 6, 14);
        cx.fillStyle = '#a49a8a';
        cx.fillRect(2, 2, 12, 12);
        cx.fillStyle = '#96897a';
        cx.fillRect(18, 2, 12, 12);
        cx.fillRect(9, 18, 12, 12);
        // Golden target overlay
        cx.fillStyle = 'rgba(255,215,0,0.2)';
        cx.fillRect(0, 0, T, T);
        // Dashed border hint
        cx.strokeStyle = 'rgba(255,180,0,0.4)';
        cx.lineWidth = 2;
        cx.setLineDash([4, 4]);
        cx.strokeRect(2, 2, T - 4, T - 4);
        cx.setLineDash([]);
    });

    // --- OVEN (pizza oven — red brick with fire glow) ---
    SPRITES.tiles.oven = createSprite(T, T, function(cx) {
        // Red brick body
        cx.fillStyle = '#b03020';
        cx.fillRect(0, 0, T, T);
        // Brick pattern
        cx.strokeStyle = '#8a2018';
        cx.lineWidth = 1;
        for (var r = 0; r < 4; r++) {
            var by = r * 8;
            cx.strokeRect(0, by, T, 8);
            var off = (r % 2) * 16;
            cx.beginPath();
            cx.moveTo(off, by); cx.lineTo(off, by + 8);
            if (off + 16 < T) { cx.moveTo(off + 16, by); cx.lineTo(off + 16, by + 8); }
            cx.stroke();
        }
        // Oven opening (dark arch)
        cx.fillStyle = '#1a0a00';
        cx.beginPath();
        cx.arc(T / 2, T - 4, 8, Math.PI, 0);
        cx.fillRect(T / 2 - 8, T / 2 + 4, 16, T / 2 - 4);
        cx.fill();
        // Fire glow inside
        cx.fillStyle = '#ff6600';
        cx.fillRect(T / 2 - 4, T - 10, 3, 3);
        cx.fillStyle = '#ffaa00';
        cx.fillRect(T / 2 + 1, T - 8, 2, 2);
        // Top bevel
        cx.fillStyle = '#c04030';
        cx.fillRect(0, 0, T, 2);
    });

    // --- DINING (wooden dining table with checkered cloth) ---
    SPRITES.tiles.dining = createSprite(T, T, function(cx) {
        // Table surface
        cx.fillStyle = '#b08050';
        cx.fillRect(0, 0, T, T);
        // Wood grain
        cx.strokeStyle = '#9a7040';
        cx.lineWidth = 1;
        for (var i = 0; i < 4; i++) {
            cx.beginPath();
            cx.moveTo(0, 4 + i * 8);
            cx.lineTo(T, 5 + i * 8);
            cx.stroke();
        }
        // Checkered cloth center
        cx.fillStyle = '#dd4444';
        cx.fillRect(6, 6, T - 12, T - 12);
        for (var ty = 0; ty < 4; ty++) {
            for (var tx = 0; tx < 4; tx++) {
                if ((tx + ty) % 2 === 0) {
                    cx.fillStyle = '#ffffff';
                    cx.fillRect(6 + tx * 5, 6 + ty * 5, 5, 5);
                }
            }
        }
        // Edge shadow
        cx.fillStyle = '#8a6030';
        cx.fillRect(0, T - 2, T, 2);
        cx.fillRect(T - 2, 0, 2, T);
    });

    // --- SAUCEMACH (sauce machine — stainless steel with pipes) ---
    SPRITES.tiles.saucemach = createSprite(T, T, function(cx) {
        // Steel body
        cx.fillStyle = '#999999';
        cx.fillRect(0, 0, T, T);
        // Panel lines
        cx.strokeStyle = '#777777';
        cx.lineWidth = 1;
        cx.strokeRect(2, 2, T - 4, T - 4);
        cx.beginPath();
        cx.moveTo(T / 2, 2); cx.lineTo(T / 2, T - 2);
        cx.stroke();
        // Pipes on left side
        cx.fillStyle = '#aaaaaa';
        cx.fillRect(4, 6, 4, 20);
        cx.fillRect(10, 4, 4, 24);
        // Valve wheels
        cx.strokeStyle = '#cc3300';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(6, 8, 3, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(12, 6, 3, 0, Math.PI * 2); cx.stroke();
        // Sauce drip (orange-red)
        cx.fillStyle = '#cc4400';
        cx.fillRect(T / 2 + 4, T - 10, 6, 8);
        cx.fillStyle = '#ff6633';
        cx.fillRect(T / 2 + 5, T - 8, 4, 4);
        // Highlight
        cx.fillStyle = 'rgba(255,255,255,0.15)';
        cx.fillRect(2, 2, T / 2 - 4, 3);
    });

    // --- CHECKERED (subtle cream/tan checkered floor — pizzeria dining) ---
    SPRITES.tiles.checkered = [];
    for (var ck = 0; ck < 2; ck++) {
        SPRITES.tiles.checkered.push(createSprite(T, T, function(cx) {
            // Base warm cream
            cx.fillStyle = '#e8dcc8';
            cx.fillRect(0, 0, T, T);
            // Subtle checkerboard (2x2 large squares, warm tan accent)
            var size = T / 2;
            for (var cy = 0; cy < 2; cy++) {
                for (var cx2 = 0; cx2 < 2; cx2++) {
                    if ((cx2 + cy + ck) % 2 === 0) {
                        cx.fillStyle = '#d8c8b0';
                        cx.fillRect(cx2 * size, cy * size, size, size);
                    }
                }
            }
            // Thin grid lines
            cx.strokeStyle = 'rgba(0,0,0,0.06)';
            cx.lineWidth = 1;
            cx.strokeRect(0, 0, T, T);
            cx.beginPath();
            cx.moveTo(T / 2, 0); cx.lineTo(T / 2, T);
            cx.moveTo(0, T / 2); cx.lineTo(T, T / 2);
            cx.stroke();
        }));
    }

    // --- FABRIC (fabric rolls — sewing shop, solid) ---
    SPRITES.tiles.fabric = createSprite(T, T, function(cx) {
        // Rolled fabric stack
        cx.fillStyle = '#c25a8e';
        cx.fillRect(0, 0, T, T);
        // Rolls (horizontal cylinders stacked)
        var rollColors = ['#d46a9e', '#a84a7e', '#e07aae', '#9a3a6e'];
        for (var r = 0; r < 4; r++) {
            var ry = 2 + r * 7;
            cx.fillStyle = rollColors[r];
            cx.fillRect(2, ry, T - 4, 6);
            // Highlight on top
            cx.fillStyle = 'rgba(255,255,255,0.15)';
            cx.fillRect(2, ry, T - 4, 2);
            // End circle
            cx.fillStyle = rollColors[r];
            cx.beginPath(); cx.arc(4, ry + 3, 3, 0, Math.PI * 2); cx.fill();
            cx.beginPath(); cx.arc(T - 4, ry + 3, 3, 0, Math.PI * 2); cx.fill();
        }
        // Border
        cx.strokeStyle = 'rgba(0,0,0,0.15)';
        cx.lineWidth = 1;
        cx.strokeRect(0, 0, T, T);
    });

    // --- SEWMACH (sewing machine — solid) ---
    SPRITES.tiles.sewmach = createSprite(T, T, function(cx) {
        // Base/table
        cx.fillStyle = '#5a6a4a';
        cx.fillRect(0, 0, T, T);
        cx.fillStyle = '#6a7a5a';
        cx.fillRect(2, 2, T - 4, T - 4);
        // Machine body
        cx.fillStyle = '#444';
        cx.fillRect(6, 4, 20, 14);
        cx.fillStyle = '#555';
        cx.fillRect(8, 6, 16, 10);
        // Needle arm
        cx.fillStyle = '#888';
        cx.fillRect(14, 2, 4, 8);
        // Needle
        cx.fillStyle = '#ccc';
        cx.fillRect(15, 14, 2, 6);
        // Wheel
        cx.fillStyle = '#777';
        cx.beginPath(); cx.arc(24, 10, 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#999';
        cx.beginPath(); cx.arc(24, 10, 2, 0, Math.PI * 2); cx.fill();
        // Thread spool
        cx.fillStyle = '#e44';
        cx.fillRect(8, 2, 4, 4);
        // Pedal area
        cx.fillStyle = '#3a4a2a';
        cx.fillRect(4, T - 8, T - 8, 6);
        cx.strokeStyle = 'rgba(0,0,0,0.2)';
        cx.lineWidth = 1;
        cx.strokeRect(0, 0, T, T);
    });

    // --- MANNEQUIN (dress form — solid) ---
    SPRITES.tiles.mannequin = createSprite(T, T, function(cx) {
        // Floor
        cx.fillStyle = '#8b4560';
        cx.fillRect(0, 0, T, T);
        // Stand base
        cx.fillStyle = '#5a4030';
        cx.fillRect(12, T - 4, 8, 4);
        // Pole
        cx.fillStyle = '#6a5040';
        cx.fillRect(15, 10, 2, T - 14);
        // Dress form body
        cx.fillStyle = '#d4a88c';
        cx.beginPath();
        cx.moveTo(10, 10);
        cx.lineTo(8, 20);
        cx.lineTo(12, 24);
        cx.lineTo(20, 24);
        cx.lineTo(24, 20);
        cx.lineTo(22, 10);
        cx.closePath();
        cx.fill();
        // Shoulder line
        cx.fillStyle = '#c49a7c';
        cx.fillRect(9, 8, 14, 3);
        // Neck
        cx.fillStyle = '#d4a88c';
        cx.fillRect(14, 4, 4, 5);
        // Pin marks
        cx.fillStyle = '#cc3333';
        cx.fillRect(13, 15, 2, 2);
        cx.fillRect(18, 18, 2, 2);
        cx.strokeStyle = 'rgba(0,0,0,0.15)';
        cx.lineWidth = 1;
        cx.strokeRect(0, 0, T, T);
    });

    // --- CARPET (warm sewing shop floor — walkable) ---
    SPRITES.tiles.carpet = [];
    for (var cp = 0; cp < 2; cp++) {
        SPRITES.tiles.carpet.push(createSprite(T, T, function(cx) {
            // Deep rose/mauve carpet
            cx.fillStyle = cp === 0 ? '#8b4560' : '#834058';
            cx.fillRect(0, 0, T, T);
            // Subtle pattern (diamond weave)
            cx.strokeStyle = 'rgba(200,150,170,0.12)';
            cx.lineWidth = 1;
            for (var d = 0; d < 4; d++) {
                var dx = 4 + d * 8;
                cx.beginPath();
                cx.moveTo(dx, 0); cx.lineTo(dx + T / 2, T);
                cx.stroke();
                cx.beginPath();
                cx.moveTo(dx + T / 2, 0); cx.lineTo(dx, T);
                cx.stroke();
            }
            // Warm highlights
            cx.fillStyle = 'rgba(255,200,220,0.05)';
            cx.fillRect(0, 0, T / 2, T / 2);
            cx.fillRect(T / 2, T / 2, T / 2, T / 2);
        }));
    }
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

    // Bench — wooden park bench with slats and armrests
    SPRITES.objects.bench = createSprite(T, T, function(cx) {
        // Shadow
        cx.fillStyle = 'rgba(0,0,0,0.15)';
        cx.fillRect(3, 5, T - 2, T - 4);
        // Legs (dark wood)
        cx.fillStyle = '#5a3a1a';
        cx.fillRect(4, T - 8, 3, 8);
        cx.fillRect(T - 8, T - 8, 3, 8);
        // Seat (warm wood planks)
        cx.fillStyle = '#c4883a';
        cx.fillRect(2, T - 14, T - 5, 4);
        cx.fillStyle = '#b07830';
        cx.fillRect(2, T - 10, T - 5, 3);
        // Plank lines on seat
        cx.strokeStyle = '#9a6820';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(2, T - 12); cx.lineTo(T - 3, T - 12);
        cx.stroke();
        // Backrest
        cx.fillStyle = '#c4883a';
        cx.fillRect(2, T - 22, T - 5, 3);
        cx.fillStyle = '#b07830';
        cx.fillRect(2, T - 19, T - 5, 3);
        // Backrest plank line
        cx.strokeStyle = '#9a6820';
        cx.beginPath();
        cx.moveTo(2, T - 20); cx.lineTo(T - 3, T - 20);
        cx.stroke();
        // Armrests
        cx.fillStyle = '#5a3a1a';
        cx.fillRect(2, T - 16, 4, 2);
        cx.fillRect(T - 7, T - 16, 4, 2);
        // Wood grain highlights
        cx.fillStyle = '#d4984a';
        cx.fillRect(8, T - 13, 6, 1);
        cx.fillRect(14, T - 21, 5, 1);
    });

    // Planter — stone planter box with green plant
    SPRITES.objects.planter = createSprite(T, T, function(cx) {
        // Shadow
        cx.fillStyle = 'rgba(0,0,0,0.15)';
        cx.fillRect(4, 6, T - 4, T - 4);
        // Stone box
        cx.fillStyle = '#8a8070';
        cx.fillRect(3, T / 2 - 2, T - 7, T / 2);
        // Stone highlights
        cx.fillStyle = '#9a9084';
        cx.fillRect(3, T / 2 - 2, T - 7, 3);
        // Stone shadow
        cx.fillStyle = '#706658';
        cx.fillRect(3, T - 4, T - 7, 2);
        // Stone border
        cx.strokeStyle = '#605848';
        cx.lineWidth = 1;
        cx.strokeRect(3, T / 2 - 2, T - 7, T / 2);
        // Dirt inside
        cx.fillStyle = '#6a4e2a';
        cx.fillRect(5, T / 2, T - 11, 4);
        // Green bush/plant
        cx.fillStyle = '#3a8a30';
        cx.beginPath();
        cx.arc(T / 2 - 1, T / 2 - 4, 9, 0, Math.PI * 2);
        cx.fill();
        cx.fillStyle = '#4a9e40';
        cx.beginPath();
        cx.arc(T / 2 - 5, T / 2 - 6, 6, 0, Math.PI * 2);
        cx.fill();
        cx.beginPath();
        cx.arc(T / 2 + 4, T / 2 - 5, 5, 0, Math.PI * 2);
        cx.fill();
        // Leaf highlights
        cx.fillStyle = '#5ab050';
        cx.fillRect(T / 2 - 3, T / 2 - 10, 3, 2);
        cx.fillRect(T / 2 + 2, T / 2 - 8, 2, 2);
        // Small flowers
        cx.fillStyle = '#ff6b8a';
        cx.fillRect(T / 2 - 6, T / 2 - 7, 2, 2);
        cx.fillStyle = '#ffb347';
        cx.fillRect(T / 2 + 3, T / 2 - 9, 2, 2);
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

    // ============================================================
    // Decorative object sprites (non-interactable, visual enrichment)
    // ============================================================

    // Potted plant — terracotta pot with green leaves
    SPRITES.objects.pot_plant = createSprite(T, T, function(cx) {
        cx.fillStyle = '#b5651d'; cx.fillRect(10, 18, 12, 10); // pot
        cx.fillStyle = '#a0521d'; cx.fillRect(8, 17, 16, 3); // rim
        cx.fillStyle = '#8b4513'; cx.fillRect(12, 26, 8, 2); // base
        cx.fillStyle = '#4caf50'; // leaves
        cx.beginPath(); cx.arc(16, 14, 7, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#66bb6a';
        cx.beginPath(); cx.arc(13, 11, 5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(19, 12, 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#388e3c'; cx.fillRect(15, 14, 2, 5); // stem
    });

    // Chair — simple wooden chair (top-down view)
    SPRITES.objects.chair = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914'; cx.fillRect(8, 6, 16, 18); // seat
        cx.strokeStyle = '#6b4904'; cx.lineWidth = 1; cx.strokeRect(8, 6, 16, 18);
        cx.fillStyle = '#a07a1e'; cx.fillRect(10, 8, 12, 14); // cushion
        cx.fillStyle = '#6b4904'; // legs
        cx.fillRect(8, 24, 3, 4); cx.fillRect(21, 24, 3, 4);
        cx.fillRect(8, 4, 3, 4); cx.fillRect(21, 4, 3, 4);
        cx.fillStyle = '#5a3a04'; cx.fillRect(8, 2, 16, 4); // backrest
    });

    // Small table — round cafe table
    SPRITES.objects.table_small = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914';
        cx.beginPath(); cx.ellipse(16, 14, 10, 8, 0, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#6b4904'; cx.lineWidth = 1;
        cx.beginPath(); cx.ellipse(16, 14, 10, 8, 0, 0, Math.PI * 2); cx.stroke();
        cx.fillStyle = '#a07a1e'; // lighter top
        cx.beginPath(); cx.ellipse(16, 13, 8, 6, 0, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#6b4904'; cx.fillRect(14, 18, 4, 10); // leg
    });

    // Floor lamp — standing lamp with shade
    SPRITES.objects.lamp = createSprite(T, T, function(cx) {
        cx.fillStyle = '#555'; cx.fillRect(14, 12, 4, 18); // pole
        cx.fillStyle = '#444'; cx.fillRect(10, 28, 12, 2); // base
        cx.fillStyle = '#ffd54f'; // shade
        cx.beginPath(); cx.moveTo(8, 12); cx.lineTo(24, 12); cx.lineTo(20, 4); cx.lineTo(12, 4); cx.closePath(); cx.fill();
        cx.fillStyle = 'rgba(255,235,100,0.3)'; // glow
        cx.beginPath(); cx.arc(16, 8, 10, 0, Math.PI * 2); cx.fill();
    });

    // Dumbbells — pair of weights
    SPRITES.objects.weights = createSprite(T, T, function(cx) {
        cx.fillStyle = '#555'; cx.fillRect(6, 14, 20, 4); // bar
        cx.fillStyle = '#333'; // plates
        cx.fillRect(3, 10, 5, 12); cx.fillRect(24, 10, 5, 12);
        cx.fillStyle = '#444';
        cx.fillRect(4, 11, 3, 10); cx.fillRect(25, 11, 3, 10);
        cx.fillStyle = '#666'; cx.fillRect(8, 13, 3, 6); cx.fillRect(21, 13, 3, 6); // inner plates
    });

    // Treadmill — running machine (top-down)
    SPRITES.objects.treadmill = createSprite(T, T, function(cx) {
        cx.fillStyle = '#333'; cx.fillRect(6, 4, 20, 24); // frame
        cx.strokeStyle = '#555'; cx.lineWidth = 1; cx.strokeRect(6, 4, 20, 24);
        cx.fillStyle = '#222'; cx.fillRect(8, 8, 16, 16); // belt
        cx.strokeStyle = '#444'; // belt lines
        for (var i = 0; i < 4; i++) { cx.beginPath(); cx.moveTo(8, 10 + i * 4); cx.lineTo(24, 10 + i * 4); cx.stroke(); }
        cx.fillStyle = '#e53935'; cx.fillRect(10, 4, 12, 3); // console
        cx.fillStyle = '#4caf50'; cx.fillRect(14, 5, 4, 1); // display
    });

    // Dress form — mannequin on stand
    SPRITES.objects.dress_form = createSprite(T, T, function(cx) {
        cx.fillStyle = '#888'; cx.fillRect(14, 24, 4, 6); // stand pole
        cx.fillStyle = '#666'; cx.fillRect(10, 28, 12, 2); // base
        cx.fillStyle = '#d4a88c'; // torso
        cx.beginPath(); cx.moveTo(10, 10); cx.lineTo(22, 10); cx.lineTo(20, 24); cx.lineTo(12, 24); cx.closePath(); cx.fill();
        cx.strokeStyle = '#b08060'; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(10, 10); cx.lineTo(22, 10); cx.lineTo(20, 24); cx.lineTo(12, 24); cx.closePath(); cx.stroke();
        cx.fillStyle = '#c09070'; cx.fillRect(13, 12, 6, 2); // neckline
        cx.beginPath(); cx.arc(16, 7, 4, 0, Math.PI * 2); cx.fill(); // head shape
    });

    // Fabric bolt — rolled fabric
    SPRITES.objects.fabric_bolt = createSprite(T, T, function(cx) {
        cx.fillStyle = '#c25a8e'; // pink fabric
        cx.fillRect(6, 10, 20, 14);
        cx.strokeStyle = '#a0487a'; cx.lineWidth = 1; cx.strokeRect(6, 10, 20, 14);
        cx.fillStyle = '#d47aa0'; cx.fillRect(8, 12, 16, 10); // lighter center
        cx.beginPath(); cx.ellipse(6, 17, 3, 7, 0, 0, Math.PI * 2); cx.fill(); // roll end
        cx.strokeStyle = '#a0487a'; cx.beginPath(); cx.ellipse(6, 17, 3, 7, 0, 0, Math.PI * 2); cx.stroke();
        cx.fillStyle = '#e8a0c0'; // pattern stripe
        cx.fillRect(10, 14, 12, 2); cx.fillRect(10, 18, 12, 2);
    });

    // Pizza peel — wooden paddle
    SPRITES.objects.pizza_peel = createSprite(T, T, function(cx) {
        cx.fillStyle = '#c4a46c'; // paddle
        cx.beginPath(); cx.ellipse(16, 12, 10, 8, 0, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#8b6914'; cx.lineWidth = 1;
        cx.beginPath(); cx.ellipse(16, 12, 10, 8, 0, 0, Math.PI * 2); cx.stroke();
        cx.fillStyle = '#a08050'; cx.fillRect(14, 18, 4, 12); // handle
        cx.strokeStyle = '#8b6914'; cx.strokeRect(14, 18, 4, 12);
        cx.fillStyle = '#d4b47c'; // lighter center
        cx.beginPath(); cx.ellipse(16, 11, 7, 5, 0, 0, Math.PI * 2); cx.fill();
    });

    // Prep table — kitchen prep surface with items
    SPRITES.objects.prep_table = createSprite(T, T, function(cx) {
        cx.fillStyle = '#888'; cx.fillRect(4, 10, 24, 16); // steel surface
        cx.strokeStyle = '#666'; cx.lineWidth = 1; cx.strokeRect(4, 10, 24, 16);
        cx.fillStyle = '#aaa'; cx.fillRect(6, 12, 20, 12); // top surface
        cx.fillStyle = '#4caf50'; cx.fillRect(8, 14, 6, 4); // chopped herbs
        cx.fillStyle = '#e53935'; cx.beginPath(); cx.arc(20, 18, 3, 0, Math.PI * 2); cx.fill(); // tomato
        cx.fillStyle = '#ccc'; cx.fillRect(16, 14, 2, 8); // knife
    });

    // Street lamp — outdoor lamp post
    SPRITES.objects.street_lamp = createSprite(T, T, function(cx) {
        cx.fillStyle = '#444'; cx.fillRect(14, 8, 4, 22); // pole
        cx.fillStyle = '#333'; cx.fillRect(10, 28, 12, 2); // base
        cx.fillStyle = '#ffd54f'; // lamp head
        cx.fillRect(10, 4, 12, 6);
        cx.strokeStyle = '#555'; cx.lineWidth = 1; cx.strokeRect(10, 4, 12, 6);
        cx.fillStyle = 'rgba(255,235,100,0.2)'; // glow
        cx.beginPath(); cx.arc(16, 7, 12, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#666'; cx.fillRect(12, 2, 8, 3); // cap
    });

    // Decorative bench — non-pushable sitting bench
    SPRITES.objects.bench_deco = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914'; cx.fillRect(4, 12, 24, 8); // seat plank
        cx.strokeStyle = '#6b4904'; cx.lineWidth = 1; cx.strokeRect(4, 12, 24, 8);
        cx.fillStyle = '#a07a1e'; cx.fillRect(6, 14, 20, 4); // lighter top
        cx.fillStyle = '#6b4904'; // legs
        cx.fillRect(6, 20, 3, 6); cx.fillRect(23, 20, 3, 6);
        cx.fillStyle = '#5a3a04'; cx.fillRect(4, 8, 24, 4); // backrest
    });

    // Statue — small decorative bust/figure
    SPRITES.objects.statue = createSprite(T, T, function(cx) {
        cx.fillStyle = '#9e9e9e'; cx.fillRect(10, 20, 12, 8); // pedestal
        cx.strokeStyle = '#757575'; cx.lineWidth = 1; cx.strokeRect(10, 20, 12, 8);
        cx.fillStyle = '#bdbdbd'; // figure
        cx.fillRect(12, 12, 8, 10); // body
        cx.beginPath(); cx.arc(16, 9, 5, 0, Math.PI * 2); cx.fill(); // head
        cx.fillStyle = '#a0a0a0'; cx.fillRect(8, 14, 4, 6); cx.fillRect(20, 14, 4, 6); // arms
    });

    // Rope coil — dock rope
    SPRITES.objects.rope_coil = createSprite(T, T, function(cx) {
        cx.fillStyle = '#a08050';
        cx.beginPath(); cx.arc(16, 16, 8, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#8b6914'; cx.lineWidth = 1;
        cx.beginPath(); cx.arc(16, 16, 8, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(16, 16, 5, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(16, 16, 2, 0, Math.PI * 2); cx.stroke();
        cx.fillStyle = '#6b4904'; cx.beginPath(); cx.arc(16, 16, 2, 0, Math.PI * 2); cx.fill(); // center
        cx.fillStyle = '#c4a46c'; // rope end trailing
        cx.fillRect(22, 14, 8, 2);
    });

    // --- Millennial Puzzle Object Sprites ---

    // --- Dot-Matrix Printer ---
    SPRITES.objects.printer = createSprite(T, T, function(cx) {
        // Printer body (boxy beige)
        cx.fillStyle = '#d4c8a0';
        cx.fillRect(2, 10, 28, 16);
        cx.strokeStyle = '#a09060';
        cx.lineWidth = 1;
        cx.strokeRect(2, 10, 28, 16);
        // Paper feed slot (top)
        cx.fillStyle = '#b0a070';
        cx.fillRect(4, 8, 24, 4);
        // Paper coming out
        cx.fillStyle = '#f5f0e0';
        cx.fillRect(8, 2, 16, 10);
        cx.strokeStyle = '#ccc';
        cx.strokeRect(8, 2, 16, 10);
        // Printed lines on paper
        cx.fillStyle = '#555';
        cx.fillRect(10, 4, 12, 1);
        cx.fillRect(10, 6, 10, 1);
        cx.fillRect(10, 8, 8, 1);
        // Control panel (buttons/lights)
        cx.fillStyle = '#4caf50';
        cx.fillRect(22, 14, 3, 2);
        cx.fillStyle = '#f44336';
        cx.fillRect(26, 14, 3, 2);
        // Feed rollers
        cx.fillStyle = '#555';
        cx.fillRect(4, 12, 2, 2);
        cx.fillRect(26, 12, 2, 2);
    });

    // --- CD-ROM Disc ---
    SPRITES.objects.cdrom = createSprite(T, T, function(cx) {
        // Disc body (silver circle)
        cx.fillStyle = '#c0c8d0';
        cx.beginPath(); cx.arc(T / 2, T / 2, 12, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#8090a0';
        cx.lineWidth = 1;
        cx.beginPath(); cx.arc(T / 2, T / 2, 12, 0, Math.PI * 2); cx.stroke();
        // Inner ring
        cx.strokeStyle = '#a0b0c0';
        cx.beginPath(); cx.arc(T / 2, T / 2, 8, 0, Math.PI * 2); cx.stroke();
        // Center hole
        cx.fillStyle = '#1a1a2e';
        cx.beginPath(); cx.arc(T / 2, T / 2, 3, 0, Math.PI * 2); cx.fill();
        // Rainbow shimmer (data side reflection)
        cx.fillStyle = 'rgba(100,200,255,0.15)';
        cx.beginPath(); cx.arc(T / 2 - 2, T / 2 - 2, 10, 0, Math.PI * 0.5); cx.lineTo(T / 2, T / 2); cx.fill();
        cx.fillStyle = 'rgba(255,100,200,0.12)';
        cx.beginPath(); cx.arc(T / 2 + 2, T / 2 + 2, 10, Math.PI, Math.PI * 1.5); cx.lineTo(T / 2, T / 2); cx.fill();
        // Scratches
        cx.strokeStyle = 'rgba(0,0,0,0.15)';
        cx.lineWidth = 0.5;
        cx.beginPath(); cx.moveTo(8, 14); cx.lineTo(22, 20); cx.stroke();
        cx.beginPath(); cx.moveTo(12, 22); cx.lineTo(24, 12); cx.stroke();
    });

    // --- VHS Tape ---
    SPRITES.objects.vhs = createSprite(T, T, function(cx) {
        // Cassette body (black rectangle)
        cx.fillStyle = '#1a1a2a';
        cx.fillRect(3, 8, 26, 18);
        cx.strokeStyle = '#333';
        cx.lineWidth = 1;
        cx.strokeRect(3, 8, 26, 18);
        // Label (white sticker on front)
        cx.fillStyle = '#f5f0e0';
        cx.fillRect(6, 10, 20, 8);
        cx.strokeStyle = '#ccc';
        cx.strokeRect(6, 10, 20, 8);
        // Label text
        cx.fillStyle = '#333';
        cx.fillRect(8, 12, 14, 1);
        cx.fillRect(8, 14, 10, 1);
        // Tape reels (visible through window)
        cx.fillStyle = '#333';
        cx.fillRect(8, 20, 6, 4);
        cx.fillRect(18, 20, 6, 4);
        cx.fillStyle = '#555';
        cx.beginPath(); cx.arc(11, 22, 2, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(21, 22, 2, 0, Math.PI * 2); cx.fill();
        // VHS logo hint
        cx.fillStyle = '#42a5f5';
        cx.fillRect(22, 11, 3, 1);
    });

    // --- Red Rotary Phone ---
    SPRITES.objects.rotary_phone = createSprite(T, T, function(cx) {
        // Phone body (red rounded)
        cx.fillStyle = '#c62828';
        cx.fillRect(4, 10, 24, 18);
        cx.strokeStyle = '#8e0000';
        cx.lineWidth = 1;
        cx.strokeRect(4, 10, 24, 18);
        // Top curves
        cx.fillStyle = '#c62828';
        cx.beginPath(); cx.arc(16, 10, 12, Math.PI, 0); cx.fill();
        // Rotary dial (circle)
        cx.fillStyle = '#f5f0e0';
        cx.beginPath(); cx.arc(16, 18, 7, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#8e0000';
        cx.beginPath(); cx.arc(16, 18, 7, 0, Math.PI * 2); cx.stroke();
        // Dial holes
        cx.fillStyle = '#1a1a2e';
        cx.beginPath(); cx.arc(16, 13, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(12, 15, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(20, 15, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(11, 19, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(21, 19, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(13, 23, 1.5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(19, 23, 1.5, 0, Math.PI * 2); cx.fill();
        // Handset cradle
        cx.fillStyle = '#8e0000';
        cx.fillRect(6, 6, 20, 4);
        // Handset
        cx.fillStyle = '#b71c1c';
        cx.fillRect(5, 4, 8, 5);
        cx.fillRect(19, 4, 8, 5);
        cx.fillRect(8, 3, 16, 3);
    });

    // --- Accordion ---
    SPRITES.objects.accordion = createSprite(T, T, function(cx) {
        // Left keyboard side (treble)
        cx.fillStyle = '#1a1a2e';
        cx.fillRect(3, 6, 8, 22);
        cx.strokeStyle = '#333';
        cx.strokeRect(3, 6, 8, 22);
        // White keys
        cx.fillStyle = '#f5f0e0';
        for (var k = 0; k < 5; k++) {
            cx.fillRect(5, 8 + k * 4, 4, 3);
        }
        // Bellows (red zigzag middle)
        cx.fillStyle = '#c62828';
        cx.fillRect(11, 8, 10, 18);
        cx.strokeStyle = '#8e0000';
        cx.lineWidth = 1;
        // Bellows folds
        for (var f = 0; f < 4; f++) {
            var fy = 10 + f * 4.5;
            cx.beginPath(); cx.moveTo(11, fy); cx.lineTo(21, fy); cx.stroke();
        }
        // Right bass side
        cx.fillStyle = '#1a1a2e';
        cx.fillRect(21, 6, 8, 22);
        cx.strokeStyle = '#333';
        cx.strokeRect(21, 6, 8, 22);
        // Bass buttons
        cx.fillStyle = '#c0c0c0';
        for (var b = 0; b < 3; b++) {
            for (var bc = 0; bc < 2; bc++) {
                cx.beginPath(); cx.arc(24 + bc * 4, 11 + b * 6, 1.5, 0, Math.PI * 2); cx.fill();
            }
        }
        // Strap
        cx.fillStyle = '#5d4037';
        cx.fillRect(7, 4, 3, 2);
        cx.fillRect(22, 4, 3, 2);
    });

    // --- Sewing Machine ---
    SPRITES.objects.sewing_machine = createSprite(T, T, function(cx) {
        // Base plate
        cx.fillStyle = '#556b2f';
        cx.fillRect(4, 20, 24, 8);
        cx.strokeStyle = '#3e5020';
        cx.lineWidth = 1;
        cx.strokeRect(4, 20, 24, 8);
        // Body (arch shape)
        cx.fillStyle = '#6b8e23';
        cx.fillRect(4, 12, 10, 10);
        cx.fillRect(14, 8, 10, 4);
        cx.fillRect(20, 8, 4, 14);
        // Needle arm
        cx.fillStyle = '#888';
        cx.fillRect(15, 8, 2, 6);
        // Needle
        cx.fillStyle = '#ccc';
        cx.fillRect(15.5, 14, 1, 6);
        // Spool (top)
        cx.fillStyle = '#c62828';
        cx.fillRect(6, 8, 6, 4);
        cx.strokeStyle = '#8e0000';
        cx.strokeRect(6, 8, 6, 4);
        // Thread line
        cx.strokeStyle = '#c62828';
        cx.lineWidth = 0.5;
        cx.beginPath(); cx.moveTo(9, 12); cx.lineTo(16, 14); cx.stroke();
        // Hand wheel (right side)
        cx.fillStyle = '#888';
        cx.beginPath(); cx.arc(22, 16, 3, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#666';
        cx.beginPath(); cx.arc(22, 16, 1.5, 0, Math.PI * 2); cx.fill();
        // Fabric under needle
        cx.fillStyle = '#e8b0c0';
        cx.fillRect(12, 20, 10, 2);
    });

    // --- Guitar Spot (Air Guitar) ---
    SPRITES.objects.guitar = createSprite(T, T, function(cx) {
        // Guitar body (acoustic shape)
        cx.fillStyle = '#a0522d';
        cx.beginPath(); cx.ellipse(16, 20, 8, 6, 0, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.ellipse(16, 14, 6, 5, 0, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#6b3410';
        cx.lineWidth = 1;
        cx.beginPath(); cx.ellipse(16, 20, 8, 6, 0, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.ellipse(16, 14, 6, 5, 0, 0, Math.PI * 2); cx.stroke();
        // Sound hole
        cx.fillStyle = '#3e2010';
        cx.beginPath(); cx.arc(16, 19, 3, 0, Math.PI * 2); cx.fill();
        // Neck
        cx.fillStyle = '#8b4513';
        cx.fillRect(14, 2, 4, 14);
        cx.strokeStyle = '#5a2d0c';
        cx.strokeRect(14, 2, 4, 14);
        // Frets
        cx.fillStyle = '#ccc';
        cx.fillRect(14, 5, 4, 1);
        cx.fillRect(14, 8, 4, 1);
        cx.fillRect(14, 11, 4, 1);
        // Strings
        cx.strokeStyle = '#ddd';
        cx.lineWidth = 0.5;
        for (var s = 0; s < 3; s++) {
            cx.beginPath(); cx.moveTo(15 + s, 2); cx.lineTo(15 + s, 24); cx.stroke();
        }
        // Headstock
        cx.fillStyle = '#5a2d0c';
        cx.fillRect(13, 0, 6, 4);
        // Tuning pegs
        cx.fillStyle = '#ccc';
        cx.fillRect(13, 1, 2, 1);
        cx.fillRect(17, 1, 2, 1);
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
    if (label === 'water' || label === 'bridgegap' || label === 'fountain') {
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

    // Vendor Gianluca — straw hat, big mustache, golden vest, cheerful grin
    PORTRAITS['piazza_vendor'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5cc99', '#d4a03c');
        // Straw hat
        cx.fillStyle = '#d4b36a';
        cx.fillRect(8, 2, 48, 6);
        cx.fillStyle = '#c4a35a';
        cx.fillRect(14, 6, 36, 10);
        cx.fillStyle = '#b4934a';
        cx.fillRect(16, 12, 32, 3);
        // Hat band
        cx.fillStyle = '#8b0000';
        cx.fillRect(14, 14, 36, 3);
        // Thick mustache
        cx.fillStyle = '#3a2010';
        cx.beginPath();
        cx.moveTo(18, 40); cx.quadraticCurveTo(25, 35, 32, 40);
        cx.quadraticCurveTo(39, 35, 46, 40);
        cx.lineWidth = 3; cx.strokeStyle = '#3a2010'; cx.stroke();
        // Big cheerful grin
        cx.fillStyle = '#d4756b';
        cx.beginPath(); cx.arc(32, 46, 7, 0, Math.PI); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(27, 46, 10, 3);
    });

    // Nonna Viola — purple shawl, white hair, round glasses, gentle face
    PORTRAITS['piazza_nonna'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a0', '#9c27b0');
        // White fluffy hair
        cx.fillStyle = '#e8e0e8';
        cx.fillRect(12, 4, 40, 14);
        cx.beginPath(); cx.arc(32, 4, 14, Math.PI, 0); cx.fill();
        cx.fillStyle = '#d8d0d8';
        cx.fillRect(14, 6, 10, 8);
        // Round glasses
        cx.strokeStyle = '#8b6914';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(24, 32, 7, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.arc(40, 32, 7, 0, Math.PI * 2); cx.stroke();
        cx.beginPath(); cx.moveTo(31, 32); cx.lineTo(33, 32); cx.stroke();
        // Kind eyes behind glasses
        cx.fillStyle = '#5a3a20';
        cx.fillRect(22, 31, 4, 3);
        cx.fillRect(38, 31, 4, 3);
        // Purple shawl
        cx.fillStyle = '#9c27b0';
        cx.fillRect(6, 50, 52, 14);
        cx.fillStyle = '#7b1fa2';
        cx.fillRect(10, 52, 44, 4);
        // Gentle smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(32, 46, 5, 0.2, Math.PI - 0.2); cx.stroke();
    });

    // Accordion Carlo — beret, scruffy chin, red scarf, animated expression
    PORTRAITS['piazza_musician'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#e8b888', '#ff7043');
        // Black beret
        cx.fillStyle = '#2a2a2a';
        cx.fillRect(12, 2, 40, 8);
        cx.beginPath(); cx.arc(32, 4, 16, Math.PI, 0); cx.fill();
        cx.fillStyle = '#3a3a3a';
        cx.fillRect(16, 4, 12, 5);
        // Beret nub
        cx.fillStyle = '#2a2a2a';
        cx.beginPath(); cx.arc(32, 2, 3, 0, Math.PI * 2); cx.fill();
        // Scruffy stubble
        cx.fillStyle = 'rgba(60,40,20,0.3)';
        for (var sx = 20; sx < 44; sx += 3) {
            for (var sy = 42; sy < 50; sy += 3) {
                cx.fillRect(sx, sy, 1, 1);
            }
        }
        // Open mouth (singing)
        cx.fillStyle = '#c05040';
        cx.beginPath(); cx.arc(32, 46, 5, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#401010';
        cx.beginPath(); cx.arc(32, 46, 3, 0, Math.PI * 2); cx.fill();
        // Red scarf
        cx.fillStyle = '#ff7043';
        cx.fillRect(12, 52, 40, 8);
        cx.fillStyle = '#e65100';
        cx.fillRect(22, 54, 20, 4);
        cx.fillRect(26, 58, 12, 6);
    });

    // Enzo — angry chef, tall hat, pointed mustache, scowling, red face
    PORTRAITS['enzo'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#e8a878', '#d32f2f');
        // Tall chef hat (taller than Luigi's)
        cx.fillStyle = '#ffffff';
        cx.fillRect(14, 0, 36, 16);
        cx.fillRect(10, 14, 44, 6);
        cx.fillStyle = '#eeeeee';
        cx.fillRect(18, 2, 10, 10);
        cx.fillStyle = '#dddddd';
        cx.fillRect(30, 4, 8, 8);
        // Angry eyebrows (V-shaped)
        cx.fillStyle = '#2a1005';
        cx.fillRect(18, 28, 10, 3);
        cx.fillRect(36, 28, 10, 3);
        // Slant them inward
        cx.fillRect(26, 27, 4, 2);
        cx.fillRect(34, 27, 4, 2);
        // Pointed mustache
        cx.fillStyle = '#1a0800';
        cx.beginPath();
        cx.moveTo(20, 42); cx.lineTo(28, 38); cx.lineTo(32, 42);
        cx.lineTo(36, 38); cx.lineTo(44, 42);
        cx.lineWidth = 2.5; cx.strokeStyle = '#1a0800'; cx.stroke();
        // Scowling mouth
        cx.strokeStyle = '#a04030';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(32, 48, 6, Math.PI + 0.3, -0.3); cx.stroke();
        // Red cheeks (angry flush)
        cx.fillStyle = 'rgba(220,50,50,0.25)';
        cx.beginPath(); cx.arc(18, 38, 5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(46, 38, 5, 0, Math.PI * 2); cx.fill();
    });

    // Waiter Marco Jr. — young, nervous, bowtie, slicked hair
    PORTRAITS['pizzeria_waiter1'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#ffcc99', '#f5f5f5');
        // Slicked-back dark hair
        cx.fillStyle = '#2a1a0a';
        cx.fillRect(14, 6, 36, 12);
        cx.fillStyle = '#3a2a1a';
        cx.fillRect(16, 4, 32, 8);
        // Hair shine
        cx.fillStyle = 'rgba(255,255,255,0.15)';
        cx.fillRect(20, 6, 14, 3);
        // Nervous eyes (slightly wide)
        cx.fillStyle = '#ffffff';
        cx.fillRect(20, 30, 8, 6);
        cx.fillRect(36, 30, 8, 6);
        cx.fillStyle = '#3a2010';
        cx.fillRect(23, 31, 4, 4);
        cx.fillRect(39, 31, 4, 4);
        cx.fillStyle = '#000';
        cx.fillRect(24, 32, 2, 2);
        cx.fillRect(40, 32, 2, 2);
        // Bowtie
        cx.fillStyle = '#d32f2f';
        cx.beginPath();
        cx.moveTo(32, 54); cx.lineTo(24, 50); cx.lineTo(24, 58); cx.closePath(); cx.fill();
        cx.beginPath();
        cx.moveTo(32, 54); cx.lineTo(40, 50); cx.lineTo(40, 58); cx.closePath(); cx.fill();
        cx.fillStyle = '#b71c1c';
        cx.fillRect(30, 52, 4, 4);
        // Small worried mouth
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(32, 46, 4, 0.2, Math.PI - 0.2); cx.stroke();
    });

    // Waitress Sofia — ponytail, exasperated smile, apron
    PORTRAITS['pizzeria_waiter2'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5cc99', '#fff9c4');
        // Brown hair with ponytail
        cx.fillStyle = '#5a3020';
        cx.fillRect(12, 4, 40, 14);
        cx.fillRect(10, 10, 44, 6);
        // Ponytail to the side
        cx.fillStyle = '#5a3020';
        cx.fillRect(46, 12, 8, 20);
        cx.fillRect(48, 28, 6, 8);
        // Hair tie
        cx.fillStyle = '#ff7043';
        cx.fillRect(46, 12, 8, 3);
        // Eyes with slight exasperation
        cx.fillStyle = '#ffffff';
        cx.fillRect(20, 30, 8, 5);
        cx.fillRect(36, 30, 8, 5);
        cx.fillStyle = '#3a6040';
        cx.fillRect(23, 31, 4, 3);
        cx.fillRect(39, 31, 4, 3);
        cx.fillStyle = '#000';
        cx.fillRect(24, 31, 2, 2);
        cx.fillRect(40, 31, 2, 2);
        // One raised eyebrow
        cx.fillStyle = '#4a2a10';
        cx.fillRect(20, 28, 8, 2);
        cx.fillRect(37, 27, 8, 2); // raised higher
        // Wry smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(34, 44, 5, 0.1, Math.PI - 0.5); cx.stroke();
        // Apron strap visible
        cx.fillStyle = '#fff9c4';
        cx.fillRect(24, 52, 4, 12);
        cx.fillRect(36, 52, 4, 12);
    });

    // Mama Rosa — warm, kind, apron, flour-dusted, gentle eyes
    PORTRAITS['mama_rosa'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#e8b898', '#e8a0c0');
        // Hair — dark brown, tied back
        cx.fillStyle = '#3a2010';
        cx.fillRect(14, 4, 36, 14);
        cx.fillRect(12, 10, 40, 6);
        // Hair bun
        cx.beginPath(); cx.arc(32, 6, 10, 0, Math.PI * 2);
        cx.fillStyle = '#3a2010'; cx.fill();
        cx.fillStyle = '#4a3020';
        cx.beginPath(); cx.arc(32, 5, 7, 0, Math.PI * 2); cx.fill();
        // Warm kind eyes
        cx.fillStyle = '#ffffff';
        cx.fillRect(20, 30, 8, 5);
        cx.fillRect(36, 30, 8, 5);
        cx.fillStyle = '#5a3020';
        cx.fillRect(23, 31, 4, 3);
        cx.fillRect(39, 31, 4, 3);
        cx.fillStyle = '#000';
        cx.fillRect(24, 31, 2, 2);
        cx.fillRect(40, 31, 2, 2);
        // Gentle smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 2;
        cx.beginPath(); cx.arc(32, 44, 6, 0.2, Math.PI - 0.2); cx.stroke();
        // Flour dust on cheek
        cx.fillStyle = 'rgba(255,255,255,0.2)';
        cx.beginPath(); cx.arc(44, 38, 4, 0, Math.PI * 2); cx.fill();
        // Apron strap
        cx.fillStyle = '#ffffff';
        cx.fillRect(22, 52, 6, 12);
        cx.fillRect(36, 52, 6, 12);
    });

    // Signora Threads — eccentric, measuring tape around neck, colorful
    PORTRAITS['shop_cat_lady'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f0c8a0', '#b088cc');
        // Wild gray-purple hair
        cx.fillStyle = '#8a6aaa';
        cx.fillRect(10, 2, 44, 16);
        cx.fillStyle = '#7a5a9a';
        cx.fillRect(14, 0, 36, 10);
        // Hair wisps
        cx.fillStyle = '#9a7aba';
        cx.fillRect(8, 10, 4, 8);
        cx.fillRect(52, 10, 4, 8);
        // Glasses (cat-eye shape)
        cx.strokeStyle = '#cc3366';
        cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(16, 30); cx.lineTo(18, 28); cx.lineTo(28, 28); cx.lineTo(30, 32); cx.lineTo(28, 35); cx.lineTo(18, 35); cx.closePath(); cx.stroke();
        cx.beginPath(); cx.moveTo(48, 30); cx.lineTo(46, 28); cx.lineTo(36, 28); cx.lineTo(34, 32); cx.lineTo(36, 35); cx.lineTo(46, 35); cx.closePath(); cx.stroke();
        // Eyes
        cx.fillStyle = '#2a5040';
        cx.fillRect(22, 30, 4, 3);
        cx.fillRect(38, 30, 4, 3);
        // Measuring tape around neck
        cx.fillStyle = '#ffeb3b';
        cx.fillRect(14, 50, 36, 4);
        // Tick marks on tape
        cx.fillStyle = '#000';
        for (var mt = 0; mt < 9; mt++) cx.fillRect(16 + mt * 4, 51, 1, 2);
        // Excited smile
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 1.5;
        cx.beginPath(); cx.arc(32, 44, 5, 0.1, Math.PI - 0.1); cx.stroke();
    });

    // Wedding Planner Bridget — stressed, tight bun, sharp blazer, clipboard
    PORTRAITS['wedding_planner'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f0c8a0', '#7b2d8e');
        // Hair — tight auburn pulled-back bun
        cx.fillStyle = '#8b2500';
        cx.fillRect(14, 4, 36, 10);
        cx.fillStyle = '#a03000';
        cx.beginPath(); cx.arc(32, 4, 8, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#8b2500';
        cx.beginPath(); cx.arc(32, 2, 6, 0, Math.PI * 2); cx.fill();
        // Wide stressed eyes
        cx.fillStyle = '#ffffff';
        cx.fillRect(19, 28, 10, 7);
        cx.fillRect(35, 28, 10, 7);
        cx.fillStyle = '#2a4080';
        cx.fillRect(23, 30, 4, 4);
        cx.fillRect(39, 30, 4, 4);
        cx.fillStyle = '#000';
        cx.fillRect(24, 31, 2, 2);
        cx.fillRect(40, 31, 2, 2);
        // Angry stressed eyebrows
        cx.fillStyle = '#4a2010';
        cx.fillRect(19, 25, 10, 2);
        cx.fillRect(35, 25, 10, 2);
        // Grimace / stressed mouth
        cx.strokeStyle = '#c06050';
        cx.lineWidth = 2;
        cx.beginPath();
        cx.moveTo(26, 46);
        cx.lineTo(29, 44);
        cx.lineTo(35, 44);
        cx.lineTo(38, 46);
        cx.stroke();
        // Clipboard in corner
        cx.fillStyle = '#d4a373';
        cx.fillRect(48, 48, 12, 14);
        cx.fillStyle = '#ffffff';
        cx.fillRect(49, 50, 10, 10);
        cx.fillStyle = '#333';
        cx.fillRect(50, 52, 7, 1);
        cx.fillRect(50, 55, 7, 1);
        cx.fillRect(50, 58, 5, 1);
        // Vein on forehead (stress!)
        cx.strokeStyle = 'rgba(200,80,80,0.4)';
        cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(28, 18); cx.lineTo(30, 22); cx.lineTo(27, 24); cx.stroke();
    });

    // Little Tomás — young boy, big eyes, messy hair, eager grin
    PORTRAITS['shop_assistant'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#e8c8a0', '#88cc88');
        // Messy brown hair
        cx.fillStyle = '#5a3a10';
        cx.fillRect(14, 4, 36, 10);
        cx.fillStyle = '#6a4a20';
        cx.fillRect(12, 6, 40, 6);
        // Sticking-up hair bits
        cx.fillRect(18, 1, 4, 6);
        cx.fillRect(28, 0, 3, 5);
        cx.fillRect(38, 2, 4, 5);
        // Big round eyes
        cx.fillStyle = '#ffffff';
        cx.fillRect(19, 28, 10, 8);
        cx.fillRect(35, 28, 10, 8);
        cx.fillStyle = '#3a2010';
        cx.fillRect(23, 30, 5, 5);
        cx.fillRect(39, 30, 5, 5);
        cx.fillStyle = '#000';
        cx.fillRect(24, 31, 3, 3);
        cx.fillRect(40, 31, 3, 3);
        // Highlight in eyes
        cx.fillStyle = '#ffffff';
        cx.fillRect(25, 31, 1, 1);
        cx.fillRect(41, 31, 1, 1);
        // Big eager grin
        cx.fillStyle = '#c05040';
        cx.beginPath(); cx.arc(32, 46, 6, 0.1, Math.PI - 0.1); cx.fill();
        cx.fillStyle = '#ffffff';
        cx.fillRect(28, 46, 8, 2);
        // Freckles
        cx.fillStyle = 'rgba(140,80,40,0.3)';
        cx.fillRect(20, 40, 2, 2);
        cx.fillRect(25, 42, 2, 2);
        cx.fillRect(38, 40, 2, 2);
        cx.fillRect(43, 42, 2, 2);
    });
}

    // --- Intermediary zone NPC portraits ---

    // Nonna Fiora — elderly, lavender shawl, kind eyes, watering can
    PORTRAITS['street_nonna'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a9', '#b39ddb');
        cx.fillStyle = '#cccccc'; cx.fillRect(18, 10, 28, 8); // grey hair
        cx.fillStyle = '#b0b0b0'; cx.fillRect(16, 14, 6, 10); cx.fillRect(42, 14, 6, 10);
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3); // eyes
        cx.strokeStyle = '#b39ddb'; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(10, 16); cx.lineTo(10, 50); cx.stroke(); // shawl
    });

    // Signor Whiskers — orange cat face
    PORTRAITS['street_cat'] = createSprite(64, 64, function(cx) {
        cx.fillStyle = '#1a1a2e'; cx.fillRect(0, 0, 64, 64);
        cx.fillStyle = '#ff8a65'; cx.beginPath(); cx.arc(32, 34, 18, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#ffab91'; cx.fillRect(24, 28, 16, 10); // snout
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 4, 4); cx.fillRect(36, 30, 4, 4); // eyes
        cx.fillStyle = '#e57373'; cx.fillRect(30, 38, 4, 2); // nose
        // Ears
        cx.fillStyle = '#ff8a65'; cx.beginPath(); cx.moveTo(18, 20); cx.lineTo(22, 10); cx.lineTo(26, 20); cx.fill();
        cx.beginPath(); cx.moveTo(38, 20); cx.lineTo(42, 10); cx.lineTo(46, 20); cx.fill();
    });

    // Fisherman Luca — blue cap, stubble, weathered face
    PORTRAITS['riverside_fisher'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a574', '#5c6bc0');
        cx.fillStyle = '#5c6bc0'; cx.fillRect(16, 8, 32, 10); cx.fillRect(12, 16, 40, 4); // cap + brim
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3); // eyes
        cx.fillStyle = '#8d6e63'; for(var i=0;i<6;i++) cx.fillRect(22+i*3, 42+((i*7)%3), 1, 2); // stubble
    });

    // Gardener Rosa — green bandana, rosy cheeks, warm smile
    PORTRAITS['garden_rosa'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a9', '#66bb6a');
        cx.fillStyle = '#66bb6a'; cx.fillRect(16, 8, 32, 8); // bandana
        cx.fillStyle = '#4caf50'; cx.fillRect(16, 14, 4, 4); cx.fillRect(44, 14, 4, 4); // bandana ties
        cx.fillStyle = '#5d4037'; cx.fillRect(18, 16, 28, 6); // brown hair under
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3);
        cx.fillStyle = 'rgba(255,100,100,0.3)'; cx.beginPath(); cx.arc(20, 40, 5, 0, Math.PI*2); cx.fill(); cx.beginPath(); cx.arc(44, 40, 5, 0, Math.PI*2); cx.fill();
    });

    // Little Emilio — big eyes, messy hair, freckles
    PORTRAITS['garden_kid'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a9', '#ffcc80');
        cx.fillStyle = '#8d6e63'; cx.fillRect(16, 6, 32, 12); // messy brown hair
        cx.fillRect(14, 10, 4, 8); cx.fillRect(46, 10, 4, 8); // tufts
        cx.fillStyle = '#333'; cx.fillRect(22, 28, 5, 5); cx.fillRect(37, 28, 5, 5); // big eyes
        cx.fillStyle = '#fff'; cx.fillRect(24, 29, 2, 2); cx.fillRect(39, 29, 2, 2); // eye highlights
        cx.fillStyle = '#c8a080'; for(var i=0;i<4;i++) cx.fillRect(26+i*3, 36, 2, 2); // freckles
    });

    // Mail Carrier Paolo — blue cap, friendly, mailbag strap
    PORTRAITS['mail_paolo'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a574', '#42a5f5');
        cx.fillStyle = '#42a5f5'; cx.fillRect(16, 8, 32, 10); cx.fillRect(14, 16, 36, 4); // mail cap
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3);
        cx.fillStyle = '#795548'; cx.fillRect(16, 48, 4, 14); // mailbag strap
    });

    // Signora Marta — pink dress, curly hair, warm smile
    PORTRAITS['dog_walker'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#f5d0a9', '#ef9a9a');
        cx.fillStyle = '#8d6e63'; cx.fillRect(14, 8, 36, 14); // curly brown hair
        for(var i=0;i<5;i++) { cx.beginPath(); cx.arc(16+i*8, 8, 4, 0, Math.PI*2); cx.fill(); } // curls
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3);
    });

    // Hermit Giacomo — wild beard, bushy eyebrows, leaf in hair
    PORTRAITS['hermit_giacomo'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a574', '#8d6e63');
        cx.fillStyle = '#a1887f'; cx.fillRect(14, 6, 36, 14); // wild grey-brown hair
        cx.fillRect(12, 16, 6, 12); cx.fillRect(46, 16, 6, 12); // bushy sides
        cx.fillStyle = '#8d6e63'; cx.fillRect(18, 40, 28, 14); // big beard
        cx.fillStyle = '#333'; cx.fillRect(24, 28, 4, 3); cx.fillRect(36, 28, 4, 3); // small eyes
        cx.fillStyle = '#795548'; cx.fillRect(20, 24, 10, 3); cx.fillRect(34, 24, 10, 3); // bushy brows
        cx.fillStyle = '#66bb6a'; cx.fillRect(42, 8, 6, 8); // leaf in hair
    });

    // Artist Marco — purple beret, paint smudge, creative expression
    PORTRAITS['street_artist'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#d4a574', '#ab47bc');
        cx.fillStyle = '#ab47bc'; cx.beginPath(); cx.arc(32, 10, 16, Math.PI, 0); cx.fill(); // beret
        cx.fillStyle = '#4a148c'; cx.fillRect(30, 4, 4, 4); // beret nub
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3);
        cx.fillStyle = '#e91e63'; cx.fillRect(44, 36, 4, 3); // paint smudge on cheek
        cx.fillStyle = '#2196f3'; cx.fillRect(16, 42, 3, 3); // paint smudge on collar
    });

    // Gatto Nero — black cat face, yellow eyes
    PORTRAITS['alley_cat'] = createSprite(64, 64, function(cx) {
        cx.fillStyle = '#1a1a2e'; cx.fillRect(0, 0, 64, 64);
        cx.fillStyle = '#37474f'; cx.beginPath(); cx.arc(32, 34, 18, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#455a64'; cx.fillRect(24, 28, 16, 10);
        cx.fillStyle = '#fdd835'; cx.fillRect(22, 30, 5, 4); cx.fillRect(37, 30, 5, 4); // yellow eyes
        cx.fillStyle = '#111'; cx.fillRect(24, 31, 2, 2); cx.fillRect(39, 31, 2, 2); // pupils
        cx.fillStyle = '#e57373'; cx.fillRect(30, 38, 4, 2); // nose
        cx.fillStyle = '#37474f'; cx.beginPath(); cx.moveTo(16, 22); cx.lineTo(20, 8); cx.lineTo(26, 20); cx.fill(); // ears
        cx.beginPath(); cx.moveTo(38, 22); cx.lineTo(44, 8); cx.lineTo(48, 20); cx.fill();
    });

    // Old Signore Dante — white hair, thoughtful eyes, chess piece nearby
    PORTRAITS['chess_old_man'] = createSprite(64, 64, function(cx) {
        drawPortraitBase(cx, '#e8c9a0', '#a1887f');
        cx.fillStyle = '#ffffff'; cx.fillRect(16, 8, 32, 10); // white hair
        cx.fillRect(14, 14, 6, 8); cx.fillRect(44, 14, 6, 8); // white sides
        cx.fillStyle = '#333'; cx.fillRect(24, 30, 3, 3); cx.fillRect(37, 30, 3, 3);
        cx.fillStyle = '#9e9e9e'; cx.fillRect(20, 24, 8, 2); cx.fillRect(36, 24, 8, 2); // wise brows
        cx.fillStyle = '#fff'; cx.fillRect(50, 44, 6, 12); cx.fillRect(48, 44, 10, 3); // chess king piece
    });

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
