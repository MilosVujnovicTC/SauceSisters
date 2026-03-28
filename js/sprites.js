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
        xhr.open('GET', 'assets/sprites/manifest.json?v=61', true);
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
        var sections = ['tiles', 'characters', 'npcs', 'bosses', 'enemies', 'items', 'itemSprites', 'ui'];
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
                img.src = basePath + path + '?v=61&t=' + Date.now();
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

    /** Draws a character sprite (Giulia, Brodo). Optional displaySize scales up for visibility. */
    drawCharacter: function(ctx, charId, frameX, frameY, destX, destY, displaySize) {
        if (!this.manifest || !this.manifest.characters) return false;
        var def = this.manifest.characters[charId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        var fw = def.frameW, fh = def.frameH;
        var dw = displaySize || fw;
        var dh = displaySize || fh;
        // Center the scaled sprite on the tile position
        var ox = -(dw - fw) / 2;
        var oy = -(dh - fh) / 2;
        ctx.drawImage(img,
            frameX * fw, frameY * fh, fw, fh,
            destX + ox, destY + oy, dw, dh
        );
        return true;
    },

    /** Draws an NPC sprite with optional display scaling. Returns true if drawn. */
    drawNPC: function(ctx, npcId, destX, destY, flipH, displaySize) {
        if (!this.manifest || !this.manifest.npcs) return false;
        var def = this.manifest.npcs[npcId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        var fw = def.frameW, fh = def.frameH;
        var dw = displaySize || fw;
        var dh = displaySize || fh;
        var ox = -(dw - fw) / 2;
        var oy = -(dh - fh) / 2;
        if (flipH) {
            ctx.save();
            ctx.translate(destX + ox + dw, destY + oy);
            ctx.scale(-1, 1);
            ctx.drawImage(img, 0, 0, fw, fh, 0, 0, dw, dh);
            ctx.restore();
        } else {
            ctx.drawImage(img, 0, 0, fw, fh, destX + ox, destY + oy, dw, dh);
        }
        return true;
    },

    /** Draws a boss sprite with optional display scaling. Returns true if drawn. */
    drawBoss: function(ctx, bossId, destX, destY, displaySize) {
        if (!this.manifest || !this.manifest.bosses) return false;
        var def = this.manifest.bosses[bossId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        var fw = def.frameW, fh = def.frameH;
        var dw = displaySize || fw;
        var dh = displaySize || fh;
        var ox = -(dw - fw) / 2;
        var oy = -(dh - fh) / 2;
        ctx.drawImage(img, 0, 0, fw, fh, destX + ox, destY + oy, dw, dh);
        return true;
    },

    /** Draws an enemy sprite with optional display scaling. Returns true if drawn. */
    drawEnemy: function(ctx, enemyId, destX, destY, displaySize) {
        if (!this.manifest || !this.manifest.enemies) return false;
        var def = this.manifest.enemies[enemyId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        var fw = def.frameW, fh = def.frameH;
        var dw = displaySize || fw;
        var dh = displaySize || fh;
        var ox = -(dw - fw) / 2;
        var oy = -(dh - fh) / 2;
        ctx.drawImage(img, 0, 0, fw, fh, destX + ox, destY + oy, dw, dh);
        return true;
    },

    /** Draws an item from a category sheet. Returns true if drawn. */
    drawItem: function(ctx, category, frameIndex, destX, destY) {
        if (!this.manifest || !this.manifest.items) return false;
        var def = this.manifest.items[category];
        if (!def) return false;
        return this.draw(ctx, def.sheet, frameIndex, 0, destX, destY, def.frameW, def.frameH);
    },

    /** Draws an individual item sprite by item ID (e.g. 'spatula', 'broccoli', 'recipe_1'). Returns true if drawn. */
    drawItemById: function(ctx, itemId, destX, destY, size) {
        if (!this.manifest || !this.manifest.itemSprites) return false;
        var def = this.manifest.itemSprites[itemId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        var s = size || 32;
        ctx.drawImage(img, 0, 0, img.width, img.height, destX, destY, s, s);
        return true;
    },

    /** Draws a UI element. Returns true if drawn. Supports optional destW/destH for scaling. */
    drawUI: function(ctx, uiId, frameX, frameY, destX, destY, destW, destH) {
        if (!this.manifest || !this.manifest.ui) return false;
        var def = this.manifest.ui[uiId];
        if (!def) return false;
        var img = this.images[def.sheet];
        if (!img) return false;
        var fw = def.frameW || img.width;
        var fh = def.frameH || img.height;
        var dw = destW || fw;
        var dh = destH || fh;
        ctx.drawImage(img, frameX * fw, frameY * fh, fw, fh, destX, destY, dw, dh);
        return true;
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

    // --- GRASS (8 variants — varied base colors, grass strokes, occasional flower pixel) ---
    SPRITES.tiles.grass = [];
    var grassBases = ['#4a7a30', '#527834', '#486e2c', '#4e7632', '#4a8030', '#507636', '#487028', '#4c7a34'];
    for (var gv = 0; gv < 8; gv++) {
        (function(variant) {
            var seed = variant * 31 + 7;
            SPRITES.tiles.grass.push(createSprite(T, T, function(cx) {
                // Base color (varies per variant)
                cx.fillStyle = grassBases[variant];
                cx.fillRect(0, 0, T, T);
                // Subtle brightness patches (±5%)
                cx.fillStyle = 'rgba(80,120,50,0.15)';
                for (var i = 0; i < 3; i++) {
                    var px = ((seed + i * 11) % 24) + 2;
                    var py = ((seed + i * 17) % 24) + 2;
                    cx.fillRect(px, py, 5 + (i % 3), 4);
                }
                // Grass blade strokes (2-3px diagonal lines)
                cx.strokeStyle = 'rgba(60,100,30,0.5)';
                cx.lineWidth = 1;
                for (var j = 0; j < 5; j++) {
                    var bx = ((seed * (j + 1) * 13) % (T - 4)) + 2;
                    var by = ((seed * (j + 1) * 7) % (T - 6)) + 3;
                    cx.beginPath();
                    cx.moveTo(bx, by);
                    cx.lineTo(bx + 1 + (j % 2), by - 3);
                    cx.stroke();
                }
                // Darker tuft accents
                cx.fillStyle = '#3a6828';
                for (var k = 0; k < 3; k++) {
                    var tx = ((seed + k * 19) % (T - 4)) + 2;
                    var ty = ((seed + k * 23) % (T - 6)) + 2;
                    cx.fillRect(tx, ty, 1, 2);
                }
                // Lighter highlight specks
                cx.fillStyle = '#5a9e4a';
                var hx = ((seed * 3) % (T - 4)) + 2;
                var hy = ((seed * 5) % (T - 4)) + 2;
                cx.fillRect(hx, hy, 2, 1);
                // Occasional tiny flower pixel (1 in 4 variants)
                if (variant % 4 === 0) {
                    var flColors = ['#f8f040', '#f080a0'];
                    cx.fillStyle = flColors[variant % 2];
                    var fx = ((seed * 7) % (T - 6)) + 3;
                    var fy = ((seed * 11) % (T - 8)) + 4;
                    cx.fillRect(fx, fy, 2, 2);
                }
            }));
        })(gv);
    }

    // --- FLOOR (4 variants — warm wood plank with grain, brightness variation) ---
    SPRITES.tiles.floor = [];
    var floorBases = ['#b89058', '#c09860', '#b48850', '#bc9462'];
    for (var fv = 0; fv < 4; fv++) {
        (function(variant) {
            SPRITES.tiles.floor.push(createSprite(T, T, function(cx) {
                // Warm wood base
                cx.fillStyle = floorBases[variant];
                cx.fillRect(0, 0, T, T);
                // Horizontal plank lines (wood direction)
                cx.strokeStyle = 'rgba(140,100,50,0.3)';
                cx.lineWidth = 1;
                cx.beginPath();
                cx.moveTo(0, T / 2 + 0.5); cx.lineTo(T, T / 2 + 0.5);
                cx.stroke();
                // Subtle wood grain lines
                cx.strokeStyle = 'rgba(120,80,40,0.15)';
                var gseed = variant * 17;
                for (var g = 0; g < 3; g++) {
                    var gy = ((gseed + g * 11) % (T - 4)) + 2;
                    cx.beginPath();
                    cx.moveTo(0, gy + 0.5);
                    cx.lineTo(T, gy + 0.5);
                    cx.stroke();
                }
                // Knot/wear spot on some variants
                if (variant % 3 === 1) {
                    cx.fillStyle = 'rgba(100,70,30,0.12)';
                    cx.beginPath();
                    cx.arc(10 + variant * 5, 12, 3, 0, Math.PI * 2);
                    cx.fill();
                }
            }));
        })(fv);
    }

    // --- WALL (darker brick, subtle mortar, recedes visually) ---
    SPRITES.tiles.wall = createSprite(T, T, function(cx) {
        // Darkened base (~20% darker than before)
        cx.fillStyle = '#483a2e';
        cx.fillRect(0, 0, T, T);
        // Brick rows with subtle mortar (low contrast)
        cx.strokeStyle = 'rgba(60,48,35,0.6)';
        cx.lineWidth = 1;
        for (var row = 0; row < 4; row++) {
            var by = row * 8;
            cx.strokeRect(0.5, by + 0.5, T - 1, 7);
            var offset = (row % 2) * 16;
            cx.beginPath();
            cx.moveTo(offset + 0.5, by);
            cx.lineTo(offset + 0.5, by + 8);
            if (offset + 16 < T) {
                cx.moveTo(offset + 16 + 0.5, by);
                cx.lineTo(offset + 16 + 0.5, by + 8);
            }
            cx.stroke();
        }
        // Subtle brick face color variation (very low contrast)
        cx.fillStyle = '#4e3e32';
        cx.fillRect(2, 2, 14, 5);
        cx.fillStyle = '#443628';
        cx.fillRect(18, 10, 12, 5);
        cx.fillStyle = '#4a3c30';
        cx.fillRect(2, 18, 12, 5);
        // Top highlight (slight)
        cx.fillStyle = '#524234';
        cx.fillRect(0, 0, T, 2);
        // Bottom shadow
        cx.fillStyle = '#2e2218';
        cx.fillRect(0, T - 2, T, 2);
    });

    // --- WATER (4 animation frames — deep base, shimmer streaks, south depth edge) ---
    SPRITES.tiles.water = [];
    for (var wf = 0; wf < 4; wf++) {
        (function(frame) {
            SPRITES.tiles.water.push(createSprite(T, T, function(cx) {
                var phase = frame * Math.PI / 2;
                // Darker deep water base
                var baseB = 140 + Math.sin(phase) * 12;
                var baseG = 100 + Math.sin(phase) * 6;
                cx.fillStyle = 'rgb(42,' + Math.round(baseG) + ',' + Math.round(baseB) + ')';
                cx.fillRect(0, 0, T, T);
                // Lighter shimmer streaks (3 per tile)
                var shimmerOffsets = [0.25, 0.5, 0.75];
                for (var si = 0; si < 3; si++) {
                    var wave = Math.sin(phase + si * 1.2) * 2;
                    cx.fillStyle = 'rgba(100,200,220,0.3)';
                    cx.fillRect(3, T * shimmerOffsets[si] + wave, T - 6, 2);
                }
                // Ripple quad curves (organic flow)
                cx.strokeStyle = 'rgba(80,160,200,0.3)';
                cx.lineWidth = 1;
                for (var r = 0; r < 2; r++) {
                    var ry = 8 + r * 14 + Math.sin(phase + r * 1.5) * 2;
                    cx.beginPath();
                    cx.moveTo(2, ry);
                    cx.quadraticCurveTo(T / 2, ry + 3 * Math.sin(phase + r), T - 2, ry);
                    cx.stroke();
                }
                // Bright sparkle specks
                cx.fillStyle = 'rgba(200,240,255,0.5)';
                cx.fillRect(8 + Math.sin(phase) * 3, 4, 2, 2);
                cx.fillRect(22 - Math.cos(phase) * 2, 20, 2, 1);
                // Dark south edge (depth illusion)
                cx.fillStyle = 'rgba(0,0,0,0.2)';
                cx.fillRect(0, T - 2, T, 2);
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

    // --- STALL (market stall — 3 color variants with awnings + produce) ---
    SPRITES.tiles.stall = [];
    var awningPalettes = [
        { c1: '#e83030', c2: '#f8f0e0' }, // red/white
        { c1: '#2060c0', c2: '#f8f0e0' }, // blue/white
        { c1: '#20a040', c2: '#f8f0e0' }, // green/white
    ];
    for (var sv = 0; sv < 3; sv++) {
        (function(variant) {
            var pal = awningPalettes[variant];
            SPRITES.tiles.stall.push(createSprite(T, T, function(cx) {
                // Wood counter base (bottom half)
                cx.fillStyle = '#8a6040';
                cx.fillRect(0, T * 0.5, T, T * 0.5);
                // Counter top edge
                cx.fillStyle = '#a07848';
                cx.fillRect(0, T * 0.5, T, 2);
                // Counter shadow
                cx.fillStyle = '#6a4828';
                cx.fillRect(0, T - 2, T, 2);
                // Colored awning stripes (top half)
                for (var s = 0; s < T; s += 4) {
                    cx.fillStyle = (s % 8 < 4) ? pal.c1 : pal.c2;
                    cx.fillRect(s, 0, 4, T * 0.48);
                }
                // Posts
                cx.fillStyle = '#6a4020';
                cx.fillRect(0, 0, 3, T);
                cx.fillRect(T - 3, 0, 3, T);
                // Produce dots on counter
                var produce = ['#e83020', '#f8c820', '#40b840'];
                for (var p = 0; p < 3; p++) {
                    cx.fillStyle = produce[(p + variant) % 3];
                    cx.beginPath();
                    cx.arc(7 + p * 8, T * 0.68, 3, 0, Math.PI * 2);
                    cx.fill();
                }
            }));
        })(sv);
    }

    // --- BARREL (transparent background — renders on top of underlying tile) ---
    SPRITES.tiles.barrel = createSprite(T, T, function(cx) {
        // Soft elliptical ground shadow
        cx.fillStyle = 'rgba(0,0,0,0.18)';
        cx.beginPath();
        cx.ellipse(T / 2, T / 2 + 8, 13, 6, 0, 0, Math.PI * 2);
        cx.fill();
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

    // --- FLOWER (transparent background — renders on top of underlying tile) ---
    // 5 flower color variants — small delicate wildflowers
    SPRITES.tiles.flower = [];
    var flowerPalettes = [
        { petals: '#f080a0', center: '#f8f040' }, // pink
        { petals: '#f8f0d0', center: '#f8d830' }, // white/cream
        { petals: '#f8d030', center: '#d08020' }, // yellow
        { petals: '#c878e8', center: '#f8f040' }, // purple
        { petals: '#f8a0c0', center: '#f8e060' }, // salmon
    ];
    for (var fv = 0; fv < flowerPalettes.length; fv++) {
        (function(pal) {
            SPRITES.tiles.flower.push(createSprite(T, T, function(cx) {
                var stemX = T / 2;
                var bloomY = 14;
                // Thin stem (1px)
                cx.strokeStyle = '#2a5018';
                cx.lineWidth = 1;
                cx.beginPath(); cx.moveTo(stemX, T - 6); cx.lineTo(stemX, bloomY + 4); cx.stroke();
                // Small side leaf
                cx.fillStyle = '#3a7828';
                cx.save();
                cx.translate(stemX + 1, 22);
                cx.rotate(0.6);
                cx.beginPath(); cx.ellipse(0, 0, 3, 1.5, 0, 0, Math.PI * 2); cx.fill();
                cx.restore();
                // Small petals (4px radius bloom = ~8px diameter)
                for (var p = 0; p < 5; p++) {
                    var a = (p / 5) * Math.PI * 2 - Math.PI / 2;
                    cx.fillStyle = pal.petals;
                    cx.beginPath();
                    cx.arc(stemX + Math.cos(a) * 3, bloomY + Math.sin(a) * 3, 2.5, 0, Math.PI * 2);
                    cx.fill();
                }
                // Center dot
                cx.fillStyle = pal.center;
                cx.beginPath(); cx.arc(stemX, bloomY, 1.5, 0, Math.PI * 2); cx.fill();
            }));
        })(flowerPalettes[fv]);
    }

    // --- DOCK (grey cobblestone dock with mortar, mossy patches) ---
    SPRITES.tiles.dock = createSprite(T, T, function(cx) {
        // Stone base
        cx.fillStyle = '#8a8070';
        cx.fillRect(0, 0, T, T);
        // Cobblestone mortar grid
        cx.strokeStyle = '#6a6050';
        cx.lineWidth = 1;
        cx.strokeRect(1, 1, 14, 14);
        cx.strokeRect(17, 1, 14, 14);
        cx.strokeRect(8, 17, 14, 14);
        cx.strokeRect(24, 17, 7, 14);
        cx.strokeRect(0, 17, 6, 14);
        // Stone face variation
        cx.fillStyle = '#928474';
        cx.fillRect(2, 2, 12, 12);
        cx.fillStyle = '#7e7466';
        cx.fillRect(18, 2, 12, 12);
        cx.fillStyle = '#8a7c6e';
        cx.fillRect(9, 18, 12, 12);
        // Mossy/damp patches
        cx.fillStyle = 'rgba(60,90,50,0.15)';
        cx.fillRect(3, 20, 4, 3);
        cx.fillRect(22, 4, 3, 4);
        // Wet edge indicator (darker bottom)
        cx.fillStyle = 'rgba(40,60,80,0.2)';
        cx.fillRect(0, T - 3, T, 3);
    });

    // --- PLANK (bridge plank — lighter wood) ---
    // --- PLANK (bridge plank — horizontal stripes with grain, nail dots) ---
    SPRITES.tiles.plank = createSprite(T, T, function(cx) {
        // Individual planks (horizontal, perpendicular to bridge direction)
        var plankColors = ['#8a5c2a', '#9a6830', '#886028'];
        for (var pl = 0; pl < 4; pl++) {
            var py = pl * 8;
            cx.fillStyle = plankColors[pl % 3];
            cx.fillRect(0, py, T, 8);
            // Plank top edge (lighter)
            cx.fillStyle = '#a87840';
            cx.fillRect(0, py, T, 1);
            // Plank bottom edge (darker)
            cx.fillStyle = '#6a4018';
            cx.fillRect(0, py + 7, T, 1);
            // Grain lines
            cx.strokeStyle = 'rgba(90,55,20,0.3)';
            cx.lineWidth = 1;
            cx.beginPath();
            cx.moveTo(2, py + 3 + 0.5); cx.lineTo(T - 2, py + 3 + 0.5);
            cx.stroke();
        }
        // Nail dots at plank ends
        cx.fillStyle = '#4a2808';
        cx.fillRect(3, 3, 2, 2); cx.fillRect(T - 5, 3, 2, 2);
        cx.fillRect(3, 19, 2, 2); cx.fillRect(T - 5, 19, 2, 2);
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

    // --- MAT (gym exercise mat — warm beige with seam lines, faded red center cross) ---
    SPRITES.tiles.mat = [];
    for (var mv = 0; mv < 2; mv++) {
        (function(variant) {
            SPRITES.tiles.mat.push(createSprite(T, T, function(cx) {
                // Warm beige/cream base
                cx.fillStyle = variant === 0 ? '#e8d8b0' : '#e0d0a8';
                cx.fillRect(0, 0, T, T);
                // Parallel seam lines (wrestling mat sections)
                cx.strokeStyle = 'rgba(180,150,100,0.4)';
                cx.lineWidth = 1;
                for (var ml = 1; ml < 8; ml++) {
                    cx.beginPath();
                    cx.moveTo(0, ml * 4 + 0.5); cx.lineTo(T, ml * 4 + 0.5);
                    cx.stroke();
                }
                // Faded red center cross mark
                cx.strokeStyle = 'rgba(180,60,40,0.18)';
                cx.lineWidth = 2;
                cx.beginPath();
                cx.moveTo(T / 2, 6); cx.lineTo(T / 2, T - 6);
                cx.moveTo(6, T / 2); cx.lineTo(T - 6, T / 2);
                cx.stroke();
                // Edge border
                cx.strokeStyle = 'rgba(160,130,80,0.3)';
                cx.lineWidth = 1;
                cx.strokeRect(0.5, 0.5, T - 1, T - 1);
            }));
        })(mv);
    }

    // --- EQUIPMENT (gym — dark rubberized floor with barbell silhouette) ---
    SPRITES.tiles.equipment = createSprite(T, T, function(cx) {
        // Dark rubberized floor
        cx.fillStyle = '#3a3028';
        cx.fillRect(0, 0, T, T);
        // Rubber texture dots
        cx.fillStyle = 'rgba(60,50,40,0.5)';
        for (var ei = 0; ei < 6; ei++) {
            cx.fillRect(4 + ei * 5, 3 + (ei % 3) * 10, 2, 2);
        }
        // Barbell silhouette — bar
        cx.fillStyle = '#888888';
        cx.fillRect(4, T / 2 - 1, T - 8, 3);
        // Weight plates (circles at each end)
        cx.fillStyle = '#666666';
        cx.beginPath(); cx.arc(7, T / 2, 5, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(T - 7, T / 2, 5, 0, Math.PI * 2); cx.fill();
        // Metallic highlight on plates
        cx.fillStyle = '#999999';
        cx.beginPath(); cx.arc(6, T / 2 - 2, 2, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(T - 8, T / 2 - 2, 2, 0, Math.PI * 2); cx.fill();
        // Bar grip texture
        cx.fillStyle = '#7a7a7a';
        for (var g = 0; g < 3; g++) {
            cx.fillRect(12 + g * 4, T / 2 - 1, 1, 3);
        }
    });

    // --- JUICEBAR (warm wood counter with cups + menu board hint) ---
    SPRITES.tiles.juicebar = createSprite(T, T, function(cx) {
        // Warm wood counter
        cx.fillStyle = '#8a5c2a';
        cx.fillRect(0, 0, T, T);
        // Horizontal wood grain
        cx.strokeStyle = 'rgba(100,60,20,0.25)';
        cx.lineWidth = 1;
        for (var jg = 0; jg < 5; jg++) {
            cx.beginPath();
            cx.moveTo(0, 3 + jg * 6 + 0.5); cx.lineTo(T, 3 + jg * 6 + 0.5);
            cx.stroke();
        }
        // Counter edge highlight (top)
        cx.fillStyle = '#a07040';
        cx.fillRect(0, 0, T, 2);
        // Counter edge shadow (bottom)
        cx.fillStyle = '#6a4018';
        cx.fillRect(0, T - 3, T, 3);
        // Small cups/bottles
        cx.fillStyle = '#e8e0d0'; // cream cup
        cx.fillRect(6, 8, 4, 6);
        cx.fillStyle = '#f08030'; // orange juice
        cx.fillRect(6, 8, 4, 3);
        cx.fillStyle = '#4caf50'; // green smoothie
        cx.fillRect(14, 10, 4, 5);
        cx.fillStyle = '#68a840';
        cx.fillRect(14, 10, 4, 2);
        cx.fillStyle = '#e8e0d0';
        cx.fillRect(22, 9, 4, 6);
        cx.fillStyle = '#e84060'; // berry drink
        cx.fillRect(22, 9, 4, 3);
        // Menu board hint (dark rect at top-back)
        cx.fillStyle = '#2a2018';
        cx.fillRect(4, 2, T - 8, 5);
        cx.fillStyle = '#f8f0d0';
        cx.fillRect(6, 3, 3, 1); cx.fillRect(11, 3, 5, 1); cx.fillRect(18, 3, 4, 1);
    });

    // --- MIRROR (silver chrome frame, reflective gradient interior) ---
    SPRITES.tiles.mirror = createSprite(T, T, function(cx) {
        // Silver/chrome frame (2px)
        cx.fillStyle = '#c0c0c0';
        cx.fillRect(0, 0, T, T);
        // Corner details (darker)
        cx.fillStyle = '#a0a0a0';
        cx.fillRect(0, 0, 3, 3); cx.fillRect(T - 3, 0, 3, 3);
        cx.fillRect(0, T - 3, 3, 3); cx.fillRect(T - 3, T - 3, 3, 3);
        // Reflective interior gradient (light top to slightly blue bottom)
        var mirrorGrad = cx.createLinearGradient(0, 2, 0, T - 2);
        mirrorGrad.addColorStop(0, '#d8eef8');
        mirrorGrad.addColorStop(0.5, '#c0dae8');
        mirrorGrad.addColorStop(1, '#a8c8e0');
        cx.fillStyle = mirrorGrad;
        cx.fillRect(2, 2, T - 4, T - 4);
        // Horizontal reflection line (bright stripe through middle)
        cx.fillStyle = 'rgba(255,255,255,0.35)';
        cx.fillRect(3, T / 2 - 1, T - 6, 2);
        // Highlight glint (top-left)
        cx.fillStyle = 'rgba(255,255,255,0.4)';
        cx.fillRect(4, 4, 6, 2);
        cx.fillRect(5, 6, 3, 3);
        // Frame inner bevel
        cx.strokeStyle = '#d0d0d0';
        cx.lineWidth = 1;
        cx.strokeRect(1.5, 1.5, T - 3, T - 3);
    });

    // --- FOUNTAIN (4 animation frames — water basin with spray) ---
    SPRITES.tiles.fountain = [];
    for (var ff = 0; ff < 4; ff++) {
        (function(frame) {
            SPRITES.tiles.fountain.push(createSprite(T, T, function(cx) {
                var phase = frame * Math.PI / 2;
                // Soft elliptical ground shadow
                cx.fillStyle = 'rgba(0,0,0,0.15)';
                cx.beginPath();
                cx.ellipse(T / 2, T / 2 + 2, 15, 8, 0, 0, Math.PI * 2);
                cx.fill();
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

    // ── Multi-tile overlay sprites ──

    // Connected counter variants: left-end, middle, right-end
    SPRITES.tiles.counter_left = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914'; cx.fillRect(0, 0, T, T);
        // Rounded left end
        cx.fillStyle = '#6b4904'; cx.fillRect(0, 0, 3, T);
        // Top surface (stone)
        cx.fillStyle = '#b8a882'; cx.fillRect(3, 0, T - 3, 5);
        cx.fillStyle = '#a89872'; cx.fillRect(3, 5, T - 3, 1);
        // Wood grain
        cx.strokeStyle = '#7a5a0e'; cx.lineWidth = 1;
        for (var i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(3, 10 + i * 8); cx.lineTo(T, 10 + i * 8); cx.stroke(); }
        // Bottom shadow
        cx.fillStyle = '#6b4904'; cx.fillRect(0, T - 2, T, 2);
        // Continuous right edge (no border)
    });
    SPRITES.tiles.counter_mid = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914'; cx.fillRect(0, 0, T, T);
        // Top surface (stone) — continuous
        cx.fillStyle = '#b8a882'; cx.fillRect(0, 0, T, 5);
        cx.fillStyle = '#a89872'; cx.fillRect(0, 5, T, 1);
        // Wood grain
        cx.strokeStyle = '#7a5a0e'; cx.lineWidth = 1;
        for (var i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(0, 10 + i * 8); cx.lineTo(T, 10 + i * 8); cx.stroke(); }
        // Bottom shadow
        cx.fillStyle = '#6b4904'; cx.fillRect(0, T - 2, T, 2);
    });
    SPRITES.tiles.counter_right = createSprite(T, T, function(cx) {
        cx.fillStyle = '#8b6914'; cx.fillRect(0, 0, T, T);
        // Rounded right end
        cx.fillStyle = '#6b4904'; cx.fillRect(T - 3, 0, 3, T);
        // Top surface (stone)
        cx.fillStyle = '#b8a882'; cx.fillRect(0, 0, T - 3, 5);
        cx.fillStyle = '#a89872'; cx.fillRect(0, 5, T - 3, 1);
        // Wood grain
        cx.strokeStyle = '#7a5a0e'; cx.lineWidth = 1;
        for (var i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(0, 10 + i * 8); cx.lineTo(T - 3, 10 + i * 8); cx.stroke(); }
        // Bottom shadow
        cx.fillStyle = '#6b4904'; cx.fillRect(0, T - 2, T, 2);
    });

    // Stove 2x2 composite (64x64 — rendered as overlay on top-left stove tile)
    SPRITES.tiles.stove_2x2 = createSprite(T * 2, T * 2, function(cx) {
        // Base metal surface
        cx.fillStyle = '#555555'; cx.fillRect(0, 0, T * 2, T * 2);
        // Top highlight
        cx.fillStyle = '#666666'; cx.fillRect(0, 0, T * 2, 3);
        // 4 burner circles (2x2 grid)
        cx.strokeStyle = '#333333'; cx.lineWidth = 2;
        var bx = [T / 2, T + T / 2, T / 2, T + T / 2];
        var by = [T / 2 - 4, T / 2 - 4, T - 4, T - 4];
        for (var b = 0; b < 4; b++) {
            cx.beginPath(); cx.arc(bx[b], by[b], 8, 0, Math.PI * 2); cx.stroke();
            // Burner glow
            cx.fillStyle = 'rgba(255,120,30,0.15)';
            cx.beginPath(); cx.arc(bx[b], by[b], 6, 0, Math.PI * 2); cx.fill();
        }
        // Oven door (bottom half)
        cx.fillStyle = '#4a4a4a';
        cx.fillRect(8, T + 4, T * 2 - 16, T - 10);
        cx.strokeStyle = '#333333'; cx.lineWidth = 1;
        cx.strokeRect(8, T + 4, T * 2 - 16, T - 10);
        // Chrome handle
        cx.fillStyle = '#aaaaaa';
        cx.fillRect(T - 8, T + 8, 16, 3);
        // Oven window
        cx.fillStyle = 'rgba(255,140,40,0.3)';
        cx.fillRect(T - 10, T + 14, 20, 12);
        // Bottom edge
        cx.fillStyle = '#444444'; cx.fillRect(0, T * 2 - 2, T * 2, 2);
    });

    // Stall 2x2 overlay (candy-striped awning top + counter bottom)
    SPRITES.tiles.stall_2x2 = createSprite(T * 2, T * 2, function(cx) {
        // Counter base (bottom row)
        cx.fillStyle = '#9b6828'; cx.fillRect(0, T, T * 2, T);
        // Wood grain on counter
        cx.strokeStyle = '#8b5818'; cx.lineWidth = 1;
        for (var i = 0; i < 3; i++) { cx.beginPath(); cx.moveTo(0, T + 8 + i * 8); cx.lineTo(T * 2, T + 8 + i * 8); cx.stroke(); }
        // Goods on counter
        cx.fillStyle = '#e53935'; // tomatoes
        cx.beginPath(); cx.arc(12, T + 10, 4, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(22, T + 8, 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#fdd835'; // lemons
        cx.beginPath(); cx.arc(T + 12, T + 10, 3, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#66bb6a'; // herbs
        cx.fillRect(T + 24, T + 6, 6, 8);
        // Awning (top row) — candy stripes
        for (var s = 0; s < 8; s++) {
            cx.fillStyle = s % 2 === 0 ? '#e8523a' : '#f5f5dc';
            cx.fillRect(s * 8, 0, 8, T - 4);
        }
        // Awning fringe
        cx.fillStyle = '#c4422a';
        for (var f = 0; f < 16; f++) {
            cx.fillRect(f * 4, T - 4, 2, 4);
        }
        // Posts
        cx.fillStyle = '#5a3a1e'; cx.fillRect(0, 0, 3, T * 2); cx.fillRect(T * 2 - 3, 0, 3, T * 2);
    });

    // Bookshelf 1x2 (32x64 — tall bookshelf with visible colored spines)
    SPRITES.tiles.shelf_1x2 = createSprite(T, T * 2, function(cx) {
        cx.fillStyle = '#6b4226'; cx.fillRect(0, 0, T, T * 2);
        // Shelf planks
        cx.fillStyle = '#5a3216';
        cx.fillRect(0, T / 2, T, 2);
        cx.fillRect(0, T, T, 2);
        cx.fillRect(0, T + T / 2, T, 2);
        cx.fillRect(0, T * 2 - 2, T, 2);
        // Books on 4 shelves
        var bookColors = ['#c62828', '#1565c0', '#2e7d32', '#f9a825', '#6a1b9a', '#ff8f00', '#00838f'];
        for (var shelf = 0; shelf < 4; shelf++) {
            var shelfY = shelf * (T / 2) + 3;
            for (var b = 0; b < 5; b++) {
                cx.fillStyle = bookColors[(b + shelf * 2) % 7];
                var bw = 3 + (b % 3);
                cx.fillRect(2 + b * 6, shelfY, bw, T / 2 - 5);
            }
        }
        // Top cap
        cx.fillStyle = '#5a3216'; cx.fillRect(0, 0, T, 2);
    });

    // Tree overlay (64x96 — 2-wide canopy + trunk base, rendered as decoration)
    SPRITES.tiles.tree = createSprite(T * 2, T * 3, function(cx) {
        // Trunk (bottom center, 1 tile)
        cx.fillStyle = '#5a3a1e';
        cx.fillRect(T / 2 + 4, T * 2, T - 8, T);
        // Trunk bark lines
        cx.strokeStyle = '#4a2a0e'; cx.lineWidth = 1;
        cx.beginPath(); cx.moveTo(T / 2 + 8, T * 2); cx.lineTo(T / 2 + 6, T * 3); cx.stroke();
        cx.beginPath(); cx.moveTo(T - 4, T * 2); cx.lineTo(T - 2, T * 3); cx.stroke();
        // Canopy (2x2, centered, overlapping top)
        cx.fillStyle = '#3a7a30';
        cx.beginPath(); cx.arc(T, T + 4, T - 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#4a8c3f';
        cx.beginPath(); cx.arc(T - 4, T, T - 8, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(T + 4, T + 2, T - 6, 0, Math.PI * 2); cx.fill();
        // Leaf highlights
        cx.fillStyle = '#5aa050';
        cx.beginPath(); cx.arc(T - 8, T - 6, 6, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(T + 6, T - 2, 5, 0, Math.PI * 2); cx.fill();
        // Tiny flower accents
        cx.fillStyle = '#ffd54f';
        cx.fillRect(T - 12, T - 2, 2, 2);
        cx.fillRect(T + 8, T + 6, 2, 2);
        cx.fillStyle = '#ff8a80';
        cx.fillRect(T - 2, T - 8, 2, 2);
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
        var x = 1, y = 1, s = T - 3;
        // Top face (lighter — 3D surface)
        cx.fillStyle = '#c8a060';
        cx.fillRect(x, y, s, 6);
        // Front face (main body)
        cx.fillStyle = '#a07840';
        cx.fillRect(x, y + 6, s, s - 8);
        // Bottom shadow edge
        cx.fillStyle = '#604820';
        cx.fillRect(x, y + s - 2, s, 2);
        // Outline
        cx.strokeStyle = '#5a3818';
        cx.lineWidth = 1;
        cx.strokeRect(x + 0.5, y + 0.5, s - 1, s - 1);
        // Wood grain lines on front face
        cx.strokeStyle = '#8a6530';
        cx.lineWidth = 1;
        for (var cg = 0; cg < 3; cg++) {
            cx.beginPath();
            cx.moveTo(x + 3, y + 8 + cg * 5);
            cx.lineTo(x + s - 3, y + 8 + cg * 5);
            cx.stroke();
        }
        // Center cross plank
        cx.strokeStyle = '#6a4820';
        cx.beginPath();
        cx.moveTo(x + s / 2, y); cx.lineTo(x + s / 2, y + s);
        cx.stroke();
        // Corner nails
        cx.fillStyle = '#d4a03c';
        cx.fillRect(x + 2, y + 2, 2, 2);
        cx.fillRect(x + s - 4, y + 2, 2, 2);
        cx.fillRect(x + 2, y + s - 4, 2, 2);
        cx.fillRect(x + s - 4, y + s - 4, 2, 2);
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

    // Hanging pots — copper pots on kitchen rack
    SPRITES.objects.hanging_pots = createSprite(T, T, function(cx) {
        // Rack bar
        cx.fillStyle = '#555';
        cx.fillRect(4, 4, 24, 2);
        // Hooks
        cx.fillStyle = '#777';
        cx.fillRect(8, 6, 1, 3); cx.fillRect(16, 6, 1, 3); cx.fillRect(23, 6, 1, 3);
        // Copper pots
        var potColors = ['#c07030', '#d08040', '#b06028'];
        for (var pi = 0; pi < 3; pi++) {
            var px = 6 + pi * 8;
            cx.fillStyle = potColors[pi];
            cx.beginPath(); cx.arc(px + 3, 14, 5, 0, Math.PI * 2); cx.fill();
            cx.fillStyle = '#a06020';
            cx.fillRect(px, 9, 6, 2); // rim
            // Handle
            cx.strokeStyle = '#805018';
            cx.lineWidth = 1;
            cx.beginPath(); cx.moveTo(px + 6, 12); cx.lineTo(px + 9, 12); cx.stroke();
        }
    });

    // Fruit bowl — colorful fruits in ceramic bowl
    SPRITES.objects.fruit_bowl = createSprite(T, T, function(cx) {
        // Bowl
        cx.fillStyle = '#e8d0a0';
        cx.beginPath(); cx.ellipse(16, 18, 10, 6, 0, 0, Math.PI * 2); cx.fill();
        cx.strokeStyle = '#c0a070'; cx.lineWidth = 1;
        cx.beginPath(); cx.ellipse(16, 18, 10, 6, 0, 0, Math.PI * 2); cx.stroke();
        // Fruits
        cx.fillStyle = '#e53935'; // apple
        cx.beginPath(); cx.arc(12, 14, 4, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#fdd835'; // lemon
        cx.beginPath(); cx.ellipse(19, 15, 4, 3, 0.3, 0, Math.PI * 2); cx.fill();
        cx.fillStyle = '#66bb6a'; // pear
        cx.beginPath(); cx.arc(15, 12, 3, 0, Math.PI * 2); cx.fill();
        // Apple stem
        cx.fillStyle = '#5d4037'; cx.fillRect(11, 10, 1, 2);
        // Highlight
        cx.fillStyle = 'rgba(255,255,255,0.3)';
        cx.beginPath(); cx.arc(11, 13, 1.5, 0, Math.PI * 2); cx.fill();
    });

    // Pasta jar — glass jar with dried pasta
    SPRITES.objects.pasta_jar = createSprite(T, T, function(cx) {
        // Jar body (glass)
        cx.fillStyle = 'rgba(200,220,230,0.6)';
        cx.fillRect(10, 8, 12, 18);
        cx.strokeStyle = 'rgba(160,190,200,0.8)'; cx.lineWidth = 1;
        cx.strokeRect(10, 8, 12, 18);
        // Pasta inside (yellow tubes)
        cx.fillStyle = '#f0d060';
        for (var pj = 0; pj < 5; pj++) {
            cx.fillRect(12 + (pj % 3) * 3, 12 + pj * 2, 2, 8);
        }
        cx.fillStyle = '#e0c050';
        cx.fillRect(12, 20, 8, 4);
        // Lid
        cx.fillStyle = '#8b4513';
        cx.fillRect(9, 6, 14, 3);
        cx.fillStyle = '#a05a1a'; cx.fillRect(10, 5, 12, 2);
        // Glass highlight
        cx.fillStyle = 'rgba(255,255,255,0.25)';
        cx.fillRect(11, 10, 2, 12);
    });

    // Kitchen sink — white basin with chrome faucet
    SPRITES.objects.kitchen_sink = createSprite(T, T, function(cx) {
        // Basin
        cx.fillStyle = '#e8e0d8';
        cx.fillRect(6, 10, 20, 14);
        cx.strokeStyle = '#c0b8b0'; cx.lineWidth = 1;
        cx.strokeRect(6, 10, 20, 14);
        // Inner basin (darker)
        cx.fillStyle = '#d0c8c0';
        cx.fillRect(8, 12, 16, 10);
        // Water hint
        cx.fillStyle = 'rgba(100,180,220,0.3)';
        cx.fillRect(10, 14, 12, 6);
        // Faucet
        cx.fillStyle = '#b0b0b0';
        cx.fillRect(14, 4, 4, 8);
        cx.fillRect(12, 4, 8, 2);
        // Spout
        cx.fillStyle = '#999';
        cx.fillRect(18, 6, 3, 2);
        cx.fillRect(20, 8, 2, 3);
        // Chrome highlight
        cx.fillStyle = 'rgba(255,255,255,0.4)';
        cx.fillRect(15, 5, 1, 4);
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
// Large door overlay sprites (for connected door tiles)
// ============================================================

/** Generates large door overlay sprites. */
function generateLargeDoorSprites() {
    var T = CONFIG.TILE_SIZE;

    // Horizontal double door (2 tiles wide, 1 tile tall)
    SPRITES.objects.large_door_h = createSprite(T * 2, T, function(cx) {
        // Stone arch surround
        cx.fillStyle = '#5a504a';
        cx.fillRect(0, 0, T * 2, T);
        // Door panels (warm oak)
        cx.fillStyle = '#b07828';
        cx.fillRect(4, 3, T - 5, T - 3);     // left panel
        cx.fillRect(T + 1, 3, T - 5, T - 3);  // right panel
        // Panel planks
        cx.strokeStyle = '#8a5c1e';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(T / 2, 3); cx.lineTo(T / 2, T);
        cx.moveTo(T + T / 2, 3); cx.lineTo(T + T / 2, T);
        cx.stroke();
        // Arch top (curved)
        cx.fillStyle = '#4a403a';
        cx.beginPath();
        cx.moveTo(0, 6);
        cx.quadraticCurveTo(T, -2, T * 2, 6);
        cx.lineTo(T * 2, 0); cx.lineTo(0, 0);
        cx.closePath();
        cx.fill();
        // Center divider
        cx.fillStyle = '#3a3028';
        cx.fillRect(T - 1, 3, 2, T - 3);
        // Brass knobs
        cx.fillStyle = '#d4a03c';
        cx.beginPath(); cx.arc(T - 5, T / 2 + 2, 2, 0, Math.PI * 2); cx.fill();
        cx.beginPath(); cx.arc(T + 5, T / 2 + 2, 2, 0, Math.PI * 2); cx.fill();
        // Stone step
        cx.fillStyle = '#8a8070';
        cx.fillRect(2, T - 4, T * 2 - 4, 4);
    });

    // Vertical double door (1 tile wide, 2 tiles tall)
    SPRITES.objects.large_door_v = createSprite(T, T * 2, function(cx) {
        // Stone surround
        cx.fillStyle = '#5a504a';
        cx.fillRect(0, 0, T, T * 2);
        // Door panel (warm oak)
        cx.fillStyle = '#b07828';
        cx.fillRect(3, 4, T - 6, T * 2 - 8);
        // Planks
        cx.strokeStyle = '#8a5c1e';
        cx.lineWidth = 1;
        cx.beginPath();
        cx.moveTo(T / 2, 4); cx.lineTo(T / 2, T * 2 - 4);
        cx.moveTo(3, T); cx.lineTo(T - 3, T);
        cx.stroke();
        // Arch top
        cx.fillStyle = '#4a403a';
        cx.beginPath();
        cx.moveTo(2, 8);
        cx.quadraticCurveTo(T / 2, 0, T - 2, 8);
        cx.lineTo(T - 2, 0); cx.lineTo(2, 0);
        cx.closePath();
        cx.fill();
        // Brass knob
        cx.fillStyle = '#d4a03c';
        cx.beginPath(); cx.arc(T - 7, T, 2, 0, Math.PI * 2); cx.fill();
        // Stone step
        cx.fillStyle = '#8a8070';
        cx.fillRect(2, T * 2 - 4, T - 4, 4);
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
    generateLargeDoorSprites();
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
