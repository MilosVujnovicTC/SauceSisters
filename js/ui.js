// ============================================================
// js/ui.js — HUD, dialogue boxes, inventory display, menus
// ============================================================

// ============================================================
// Remap overlay
// ============================================================
const remapUI = {
    open: false,
    actions: Object.keys(DEFAULT_BINDINGS),
    selectedIndex: 0,
    waitingForKey: false,  // true when expecting next keypress to rebind
    conflict: null,        // { action, key } if duplicate detected
    conflictTimer: 0,      // frames remaining to show conflict message
};

/** Opens the remap overlay. */
function openRemapUI() {
    remapUI.open = true;
    remapUI.selectedIndex = 0;
    remapUI.waitingForKey = false;
    remapUI.conflict = null;
    remapUI.conflictTimer = 0;
}

/** Closes the remap overlay and saves bindings. */
function closeRemapUI() {
    remapUI.open = false;
    remapUI.waitingForKey = false;
    saveBindings();
}

/** Updates remap overlay logic. Called from update() when overlay is open. */
function updateRemapUI() {
    if (remapUI.conflictTimer > 0) remapUI.conflictTimer--;

    if (remapUI.waitingForKey) {
        // Find the first justPressed key to use as the new binding
        for (const key in input.justPressed) {
            if (!input.justPressed[key]) continue;
            // Escape cancels rebinding
            if (key === 'Escape') {
                remapUI.waitingForKey = false;
                return;
            }
            const action = remapUI.actions[remapUI.selectedIndex];
            const conflict = findKeyConflict(key, action);
            if (conflict) {
                remapUI.conflict = { action: BINDING_LABELS[conflict], key: keyCodeToLabel(key) };
                remapUI.conflictTimer = 120; // show for ~2 seconds
                remapUI.waitingForKey = false;
                return;
            }
            // Apply new binding (replace all keys for this action with the new one)
            bindings[action] = [key];
            remapUI.waitingForKey = false;
            return;
        }
        return; // still waiting
    }

    // Navigate with raw keys (not actions, since bindings might be mid-edit)
    if (isJustPressed('ArrowUp') || isJustPressed('KeyW')) {
        remapUI.selectedIndex = (remapUI.selectedIndex - 1 + remapUI.actions.length) % remapUI.actions.length;
    }
    if (isJustPressed('ArrowDown') || isJustPressed('KeyS')) {
        remapUI.selectedIndex = (remapUI.selectedIndex + 1) % remapUI.actions.length;
    }
    // Enter or Space to start rebinding
    if (isJustPressed('Enter') || isJustPressed('Space')) {
        remapUI.waitingForKey = true;
        remapUI.conflict = null;
        remapUI.conflictTimer = 0;
    }
    // R to reset to defaults
    if (isJustPressed('KeyR')) {
        resetBindings();
    }
    // Escape to close
    if (isJustPressed('Escape')) {
        closeRemapUI();
    }
}

/** Renders the remap overlay on top of the game. */
function renderRemapUI(ctx) {
    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    const centerX = CONFIG.CANVAS_W / 2;
    const startY = 80;
    const lineH = 36;

    // Title
    ctx.fillStyle = '#e94560';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONTROLS', centerX, startY);

    // Instructions
    ctx.fillStyle = '#888888';
    ctx.font = '12px monospace';
    ctx.fillText('Up/Down = navigate | Enter = rebind | R = reset defaults | Esc = close', centerX, startY + 28);

    // Action list
    ctx.font = '14px monospace';
    for (let i = 0; i < remapUI.actions.length; i++) {
        const action = remapUI.actions[i];
        const y = startY + 64 + i * lineH;
        const isSelected = i === remapUI.selectedIndex;
        const isWaiting = isSelected && remapUI.waitingForKey;

        // Highlight selected row
        if (isSelected) {
            ctx.fillStyle = 'rgba(233, 69, 96, 0.2)';
            ctx.fillRect(centerX - 250, y - 14, 500, lineH - 4);
        }

        // Action label
        ctx.fillStyle = isSelected ? '#ffffff' : '#aaaaaa';
        ctx.textAlign = 'left';
        ctx.fillText(BINDING_LABELS[action], centerX - 230, y);

        // Key binding display
        ctx.textAlign = 'right';
        if (isWaiting) {
            ctx.fillStyle = '#00ff88';
            ctx.fillText('< Press a key... >', centerX + 230, y);
        } else {
            ctx.fillStyle = isSelected ? '#00ff88' : '#888888';
            const keyLabels = bindings[action].map(keyCodeToLabel).join(' / ');
            ctx.fillText(keyLabels, centerX + 230, y);
        }
    }

    // Conflict warning
    if (remapUI.conflictTimer > 0 && remapUI.conflict) {
        ctx.fillStyle = '#ff4444';
        ctx.font = '13px monospace';
        ctx.textAlign = 'center';
        const msg = '"' + remapUI.conflict.key + '" is already bound to "' + remapUI.conflict.action + '"';
        ctx.fillText(msg, centerX, startY + 64 + remapUI.actions.length * lineH + 20);
    }

    // Reset confirmation hint
    ctx.fillStyle = '#555555';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press R to reset all controls to defaults', centerX, CONFIG.CANVAS_H - 30);
}

// ============================================================
// NPC Dialogue system
// ============================================================

const dialogue = {
    active: false,
    npcId: null,
    npcObj: null,    // full NPC object reference (for portrait rendering)
    lines: [],       // array of strings (resolved per interaction)
    lineIndex: 0,    // which line we're on
    charIndex: 0,    // how many characters revealed in current line
    charTimer: 0,    // accumulator for character reveal timing
    npcName: '',
    onComplete: null, // optional callback when dialogue ends
};

/** Opens the dialogue box for a given NPC. Supports static lines or dynamic getLines(). */
function startDialogue(npc) {
    dialogue.active = true;
    duckMusic();
    dialogue.npcId = npc.id;
    dialogue.npcObj = npc;
    dialogue.npcName = npc.name;
    // Resolve lines: use getLines(questFlags) if available, otherwise static lines
    if (npc.getLines) {
        const result = npc.getLines(questFlags);
        dialogue.lines = result.lines;
        dialogue.onComplete = result.onComplete || null;
    } else {
        dialogue.lines = npc.lines;
        dialogue.onComplete = null;
    }
    dialogue.lineIndex = 0;
    dialogue.charIndex = 0;
    dialogue.charTimer = 0;
}

/** Advances dialogue: if text is still revealing, show all. Otherwise go to next line or close. */
function advanceDialogue() {
    const currentLine = dialogue.lines[dialogue.lineIndex];
    if (dialogue.charIndex < currentLine.length) {
        // Reveal all text instantly
        dialogue.charIndex = currentLine.length;
    } else {
        // Move to next line or close
        dialogue.lineIndex++;
        if (dialogue.lineIndex >= dialogue.lines.length) {
            closeDialogue();
        } else {
            dialogue.charIndex = 0;
            dialogue.charTimer = 0;
        }
    }
}

/** Closes the dialogue box and runs onComplete callback if set. */
function closeDialogue() {
    var callback = dialogue.onComplete;
    dialogue.active = false;
    unduckMusic();
    dialogue.npcId = null;
    dialogue.npcObj = null;
    dialogue.onComplete = null;
    // Run callback AFTER dialogue state is fully reset (callback may start new dialogue)
    if (callback) {
        callback();
    }
}

/** Updates the character-by-character text reveal with NPC voice blips. */
function updateDialogue(dt) {
    if (!dialogue.active) return;
    const currentLine = dialogue.lines[dialogue.lineIndex];
    if (dialogue.charIndex < currentLine.length) {
        const prevIndex = dialogue.charIndex;
        dialogue.charTimer += dt;
        const charsToReveal = Math.floor(dialogue.charTimer * CONFIG.DIALOGUE_CHARS_PER_SEC);
        if (charsToReveal > 0) {
            dialogue.charIndex = Math.min(dialogue.charIndex + charsToReveal, currentLine.length);
            dialogue.charTimer = 0;
            // Play blip for the newly revealed character (skip spaces/punctuation)
            var newChar = currentLine.charAt(dialogue.charIndex - 1);
            if (newChar && newChar !== ' ' && newChar !== '.' && newChar !== ',' && newChar !== '!' && newChar !== '?') {
                playDialogueBlip(dialogue.npcId, newChar.charCodeAt(0));
            }
        }
    }
}

/** Renders the dialogue box at the bottom of the screen with NPC portrait. */
function renderDialogue(ctx) {
    if (!dialogue.active) return;
    const m = CONFIG.DIALOGUE_BOX_MARGIN;
    const h = CONFIG.DIALOGUE_BOX_HEIGHT;
    const x = m;
    const y = CONFIG.CANVAS_H - h - m;
    const w = CONFIG.CANVAS_W - m * 2;

    // Box background
    ctx.fillStyle = CONFIG.DIALOGUE_BG;
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // --- Portrait ---
    var portraitSize = 64;
    var portraitPad = 8;
    var portraitX = x + portraitPad;
    var portraitY = y + (h - portraitSize) / 2;
    var textOffsetX = portraitSize + portraitPad * 2 + 4; // text shifts right

    // Try to get portrait — prefer image-based, then procedural LucasArts-style, then NPC sprite
    var portrait = null;
    var portraitImgDrawn = false;

    // Try image-based portrait from portrait sheet (not yet mapped by index — future)
    // For now, fall through to procedural portraits

    if (dialogue.npcObj && dialogue.npcObj.id) {
        portrait = getPortrait(dialogue.npcObj.id);
    }
    if (!portrait && dialogue.npcObj && dialogue.npcObj.color) {
        portrait = getNPCSprite(dialogue.npcObj);
    }
    if (!portrait && dialogue.npcObj && dialogue.npcObj.id) {
        var objKey = dialogue.npcObj.id;
        if (objKey.startsWith('bookshelf')) objKey = 'bookshelf';
        portrait = SPRITES.objects[objKey] || null;
    }

    if (portrait || portraitImgDrawn) {
        // Portrait frame background
        ctx.fillStyle = 'rgba(40,30,50,0.8)';
        ctx.fillRect(portraitX - 3, portraitY - 3, portraitSize + 6, portraitSize + 6);
        // Portrait border (gold)
        ctx.strokeStyle = '#ffd54f';
        ctx.lineWidth = 2;
        ctx.strokeRect(portraitX - 3, portraitY - 3, portraitSize + 6, portraitSize + 6);
        // Inner border
        ctx.strokeStyle = '#b8962e';
        ctx.lineWidth = 1;
        ctx.strokeRect(portraitX - 1, portraitY - 1, portraitSize + 2, portraitSize + 2);
        // Draw portrait (nearest-neighbor for pixel art)
        ctx.imageSmoothingEnabled = false;
        if (!portraitImgDrawn && portrait) {
            ctx.drawImage(portrait, portraitX, portraitY, portraitSize, portraitSize);
        }
        // Warm vignette overlay — darkens edges for depth
        var vcx = portraitX + portraitSize / 2;
        var vcy = portraitY + portraitSize / 2;
        var vr = portraitSize * 0.55;
        var vGrad = ctx.createRadialGradient(vcx, vcy, vr * 0.5, vcx, vcy, vr);
        vGrad.addColorStop(0, 'rgba(0,0,0,0)');
        vGrad.addColorStop(1, 'rgba(30,15,5,0.35)');
        ctx.fillStyle = vGrad;
        ctx.fillRect(portraitX, portraitY, portraitSize, portraitSize);
    } else {
        // No portrait — draw a generic speech icon
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(portraitX - 2, portraitY - 2, portraitSize + 4, portraitSize + 4);
        ctx.strokeStyle = '#555555';
        ctx.lineWidth = 1;
        ctx.strokeRect(portraitX - 2, portraitY - 2, portraitSize + 4, portraitSize + 4);
        // Speech bubble icon
        ctx.fillStyle = '#555555';
        ctx.font = 'bold 28px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('...', portraitX + portraitSize / 2, portraitY + portraitSize / 2 + 10);
    }

    // NPC name (shifted right for portrait)
    ctx.fillStyle = CONFIG.DIALOGUE_NAME;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(dialogue.npcName, x + textOffsetX, y + 22);

    // Dialogue text (revealed characters only, shifted right)
    const currentLine = dialogue.lines[dialogue.lineIndex];
    const visibleText = currentLine.substring(0, dialogue.charIndex);
    ctx.fillStyle = CONFIG.DIALOGUE_TEXT;
    ctx.font = '13px monospace';

    // Simple word wrap (with adjusted max width for portrait)
    const maxWidth = w - textOffsetX - 12;
    const words = visibleText.split(' ');
    let line = '';
    let lineY = y + 46;
    const lineHeight = 18;
    for (let i = 0; i < words.length; i++) {
        const testLine = line + (line ? ' ' : '') + words[i];
        if (ctx.measureText(testLine).width > maxWidth && line) {
            ctx.fillText(line, x + textOffsetX, lineY);
            line = words[i];
            lineY += lineHeight;
        } else {
            line = testLine;
        }
    }
    if (line) ctx.fillText(line, x + textOffsetX, lineY);

    // Advance prompt
    if (dialogue.charIndex >= currentLine.length) {
        const prompt = dialogue.lineIndex < dialogue.lines.length - 1 ? '[Z] Next' : '[Z] Close';
        ctx.fillStyle = '#888888';
        ctx.font = '11px monospace';
        ctx.textAlign = 'right';
        ctx.fillText(prompt, x + w - 12, y + h - 10);
    }
}

// ============================================================
// Papa Marco hint system — headset guide
// ============================================================

/** Papa Marco hint state. */
const papaHints = {
    maxPerZone: 3,
    used: {},          // { zoneId: number } — hints used per zone
    introduced: {},    // { zoneId: true } — zones where auto-intro has played
    autoCallPending: null, // zoneId to auto-call on next frame (set by loadZone)
    autoCallDelay: 0,      // brief delay before auto-call starts
};

/** Per-zone hint pools. Each zone has an intro line + 3 progressively specific hints + a no-hints line. */
const PAPA_HINTS = {
    la_cucina: {
        intro: "Giulia! Papa here. I'm on your headset. This is our kitchen — grab that spatula and head out the door. The recipe won't find itself! [GRUNT]",
        hints: [
            "Look around the kitchen, ragazza. There might be useful things to grab before you leave. A cook is nothing without her tools!",
            "See that spatula on the counter? Pick it up — you'll need it out there. Trust Papa on this one.",
            "Head for the door at the bottom of the kitchen. The Market is waiting! And Signora Betta might know something... [CLANG]",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...okay fine, just explore the kitchen and head out the door!",
    },
    market: {
        intro: "Ah, the Market! Signora Betta runs this place. Talk to her — she's like a GPS but with opinions. [CLANG]",
        hints: [
            "Betta mentioned something about a heart shape, didn't she? Look at the ground carefully... those golden markers might mean something.",
            "Push those crates onto the golden targets. It's like a puzzle — but with more splinters. Make a heart shape!",
            "All crates on the targets and still nothing? The recipe fragment should appear right in the center of the heart. Bellissima! [GRUNT]",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...you're on your own in the Market, kiddo!",
    },
    canal: {
        intro: "The Canal! Watch the water — you'll need to figure out how to cross. There's a bike around here somewhere... [CLANG]",
        hints: [
            "See that BMX bike? Interact with it. Papa knows what you're thinking — 'a bike near water?' Trust the process, ragazza.",
            "Ride the bike to collect planks! Then use them to repair the bridge. Place them on those gap tiles. It's like cooking — one ingredient at a time.",
            "Bridge still broken? Stand in front of a gap with planks in your inventory and interact. Each plank fills one section. Four planks, four gaps. [GRUNT]",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...something about bikes and planks. Figure it out!",
    },
    library: {
        intro: "Shhhh! The Library. There's a recipe fragment hidden here somewhere. Brodo might be able to sniff it out... and watch out for that broom! [CLANG]",
        hints: [
            "Try using Brodo's sniff ability — press B. If there's something hidden nearby, he'll find it. He's got a nose like a truffle pig!",
            "There's an old Nokia phone somewhere in here. If you can spell the right word on it... well, let's just say it's a family name. [GRUNT]",
            "The word is G-I-U-L-I-A. Use the T9 keypad — remember how Papa used to text? Press each number until you get the right letter!",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...try sniffing around. Literally. Press B!",
    },
    gym: {
        intro: "My gym! This is where Papa gets SWOLE. Well... slightly less un-swole. Check my corner — I left some paperwork there. [GRUNT]",
        hints: [
            "My training corner is in the back-left area. I've got a desk there — might've left something important on one of those competition forms.",
            "Look at my competition entry form — I might've accidentally used a recipe fragment as scratch paper. Whoops. [CLANG]",
            "The form is on my desk, back-left corner of the gym. Just interact with it! And say hi to Coach Fabio for me — he owes me a protein shake.",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...check my desk! Back-left! You got this, ragazza!",
    },
    piazza: {
        intro: "The Piazza Vecchia! Beautiful square. I proposed to your Mama here... she said 'I'll think about it.' Twice. [GRUNT] The east passage leads to Enzo's place — but it's blocked!",
        hints: [
            "See those benches and planters scattered around? They need to go on the marked spots near the east side. Push 'em into place!",
            "Four pushable objects, four golden target markers on the east wall. Line them up to clear the path to Enzo's Pizzeria.",
            "Push all four objects onto the glowing targets near column 25. Once they're all placed, the east wall opens up! You can also pull with Shift. [CLANG]",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...push things onto the golden spots! East side! Andiamo!",
    },
    pizzeria: {
        intro: "Enzo's place! *sotto voce* That guy once challenged me to an arm-wrestling match. I won. He STILL hasn't gotten over it. [GRUNT] Be careful in there, ragazza.",
        hints: [
            "Enzo's got a piece of Mama's recipe in his sauce machine. But he won't let you near it without a fight!",
            "Talk to the waiters — they might have useful info. And check out the kitchen area, there's a sauce machine room on the right side.",
            "You'll need to defeat Enzo in his kitchen to get access to the sauce machine room. Use everything you've got! [CLANG]",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...you can do this! Show Enzo who's boss!",
    },
    sewing_shop: {
        intro: "Mama's shop! *voice cracks* I haven't been in here since... well. [GRUNT] Your Mama is the best seamstress in town. And the best cook. Don't tell her I said the cook part — she'll make me do dishes.",
        hints: [
            "Talk to Mama Rosa first — she knows where the last recipe fragment is. It's sewn into her apron, apparently. Very on-brand.",
            "There's an old dot-matrix printer in the back room. Mama said it has something important. Those things are LOUD. [CLANG]",
            "The wedding planner might give you trouble. Stay sharp, ragazza! ...and maybe bring some flour. For emergencies. [GRUNT]",
        ],
        noHints: "Going for a set, talk later. [GRUNT] ...you're almost there! The recipe is nearly complete!",
    },
};

/** The Papa Marco NPC-like object used with startDialogue. */
const PAPA_NPC = {
    id: 'papa_marco',
    name: 'Papa Marco',
    color: '#2e7d32',
};

/** Triggers a Papa Marco call — opens dialogue with the next hint for the current zone. */
function callPapa() {
    if (dialogue.active) return; // can't call during another dialogue
    if (!game.currentZone) return;

    var zoneId = game.currentZone.id;
    var pool = PAPA_HINTS[zoneId];
    if (!pool) {
        // No hints defined for this zone — generic response
        PAPA_NPC.lines = ["Hmm, I don't know much about this place yet. Keep exploring, ragazza! [GRUNT]"];
        startDialogue(PAPA_NPC);
        return;
    }

    // How many hints used in this zone?
    var used = papaHints.used[zoneId] || 0;

    if (used >= papaHints.maxPerZone) {
        // No hints remaining
        PAPA_NPC.lines = [pool.noHints];
        startDialogue(PAPA_NPC);
        return;
    }

    // Check if free hints (Milk power-up)
    var freeHint = (typeof isBuffFreeHints === 'function') && isBuffFreeHints();

    // Give the next hint
    PAPA_NPC.lines = [pool.hints[used], "(Hints remaining: " + (papaHints.maxPerZone - used - (freeHint ? 0 : 1)) + ")"];

    if (!freeHint) {
        papaHints.used[zoneId] = used + 1;
    }

    startDialogue(PAPA_NPC);
}

/** Triggers Papa's auto-intro for a zone (first visit only). */
function papaAutoIntro(zoneId) {
    if (papaHints.introduced[zoneId]) return;
    papaHints.introduced[zoneId] = true;

    var pool = PAPA_HINTS[zoneId];
    if (!pool) return;

    PAPA_NPC.lines = [pool.intro];
    startDialogue(PAPA_NPC);
}

/** Called from update() — handles delayed auto-call after zone entry. */
function updatePapaAutoCall(dt) {
    if (!papaHints.autoCallPending) return;
    papaHints.autoCallDelay -= dt;
    if (papaHints.autoCallDelay <= 0) {
        var zoneId = papaHints.autoCallPending;
        papaHints.autoCallPending = null;
        papaAutoIntro(zoneId);
    }
}

// ============================================================
// HUD — Inventory bar
// ============================================================

/** Renders the inventory HUD at the top-center of the screen. */
function renderHUD(ctx) {
    const slotSize = CONFIG.INV_SLOT_SIZE;
    const gap = CONFIG.INV_SLOT_GAP;
    const maxSlots = Math.min(CONFIG.INV_MAX_SLOTS, Math.max(inventory.length, 5)); // show at least 5 slots
    const totalW = maxSlots * (slotSize + gap) - gap;
    const startX = (CONFIG.CANVAS_W - totalW) / 2;
    const startY = CONFIG.INV_MARGIN_TOP;

    // Background bar
    ctx.fillStyle = CONFIG.INV_BG;
    ctx.fillRect(startX - 4, startY - 4, totalW + 8, slotSize + 8);
    ctx.strokeStyle = CONFIG.INV_BORDER;
    ctx.lineWidth = 1;
    ctx.strokeRect(startX - 4, startY - 4, totalW + 8, slotSize + 8);

    for (let i = 0; i < maxSlots; i++) {
        const sx = startX + i * (slotSize + gap);
        const sy = startY;

        // Slot background
        ctx.fillStyle = CONFIG.INV_EMPTY;
        ctx.fillRect(sx, sy, slotSize, slotSize);

        // Item in slot
        if (i < inventory.length) {
            const itemDef = ITEMS[inventory[i]];
            if (itemDef) {
                // Try image-based item sprite first, then procedural
                var itemKey = inventory[i];
                if (itemKey.startsWith('recipe_')) itemKey = 'recipe';
                if (itemKey.startsWith('plank_')) itemKey = 'plank';

                // TODO: SpriteLoader.drawItem integration when item sheet indices are mapped
                var itemSprite = SPRITES.items[itemKey];

                if (itemSprite) {
                    // Draw sprite centered in slot
                    var iw = itemSprite.width;
                    var ih = itemSprite.height;
                    var scale = Math.min((slotSize - 6) / iw, (slotSize - 6) / ih);
                    var dw = iw * scale;
                    var dh = ih * scale;
                    ctx.drawImage(itemSprite, sx + (slotSize - dw) / 2, sy + (slotSize - dh) / 2, dw, dh);
                } else {
                    // Fallback to colored square + icon
                    ctx.fillStyle = itemDef.color;
                    ctx.fillRect(sx + 3, sy + 3, slotSize - 6, slotSize - 6);
                    ctx.fillStyle = '#000000';
                    ctx.font = 'bold 12px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(itemDef.icon, sx + slotSize / 2, sy + slotSize / 2 + 4);
                }
            }
        }
    }
}

// ============================================================
// Player health hearts HUD
// ============================================================

/** Renders player health hearts and lives counter. */
function renderHealthHUD(ctx) {
    var heartX = 10;
    var heartY = CONFIG.CANVAS_H - 36;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(heartX - 4, heartY - 6, player.maxHp * 22 + 50, 28);

    // Hearts
    for (var i = 0; i < player.maxHp; i++) {
        var filled = i < player.hp;
        var hx = heartX + i * 22;
        var hy = heartY;

        ctx.fillStyle = filled ? '#e94560' : '#444444';
        ctx.beginPath();
        ctx.moveTo(hx + 8, hy + 3);
        ctx.bezierCurveTo(hx + 8, hy, hx, hy, hx, hy + 4);
        ctx.bezierCurveTo(hx, hy + 8, hx + 8, hy + 13, hx + 8, hy + 15);
        ctx.bezierCurveTo(hx + 8, hy + 13, hx + 16, hy + 8, hx + 16, hy + 4);
        ctx.bezierCurveTo(hx + 16, hy, hx + 8, hy, hx + 8, hy + 3);
        ctx.fill();
    }

    // Lives counter
    var livesX = heartX + player.maxHp * 22 + 6;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('x' + player.lives, livesX, heartY + 12);
}

/** Renders the Papa hint counter below the health HUD. */
function renderPapaHintHUD(ctx) {
    if (!game.currentZone) return;
    var zoneId = game.currentZone.id;
    if (!PAPA_HINTS[zoneId]) return;

    var used = papaHints.used[zoneId] || 0;
    var remaining = papaHints.maxPerZone - used;
    var x = 10;
    var y = CONFIG.CANVAS_H - 52;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(x - 4, y - 4, 80, 16);

    ctx.fillStyle = remaining > 0 ? '#81c784' : '#666666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('[P] Papa: ' + remaining + '/' + papaHints.maxPerZone, x, y + 8);
}

// ============================================================
// Score HUD — coin counter
// ============================================================

/** Renders the score/coin counter in the HUD. */
function renderScoreHUD(ctx) {
    var x = CONFIG.CANVAS_W - 120;
    var y = CONFIG.INV_MARGIN_TOP + CONFIG.INV_SLOT_SIZE + 16;

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, 96, 20);

    // Coin icon (small yellow circle)
    ctx.fillStyle = '#ffd700';
    ctx.beginPath();
    ctx.arc(x + 12, y + 10, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#b8860b';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('C', x + 12, y + 13);

    // Score value
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('' + game.score, x + 22, y + 14);
}

/** Renders floating score popups in world space. */
function renderScorePopups(ctx, cameraX, cameraY) {
    for (var i = 0; i < game.scorePopups.length; i++) {
        var pop = game.scorePopups[i];
        var sx = pop.x - cameraX;
        var sy = pop.y - cameraY;
        var alpha = Math.min(pop.timer / 0.4, 1);
        ctx.globalAlpha = alpha;
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('+' + pop.amount, sx, sy);
        ctx.globalAlpha = 1;
    }
}

/** Renders the red damage flash overlay. */
function renderDamageFlash(ctx) {
    if (!player.damageFlash || player.damageFlash <= 0) return;
    var alpha = Math.min(player.damageFlash / 0.3, 1) * 0.3;
    ctx.fillStyle = 'rgba(255, 0, 0, ' + alpha + ')';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);
}

// ============================================================
// Item pickup flash effect
// ============================================================

// ============================================================
// Scroll overlay — shows the heart pattern from Mama's note
// ============================================================

/** Updates scroll overlay state. Handles auto-dismiss timer and keypress to close. */
function updateScrollOverlay(dt) {
    if (!game.showScrollOverlay) return;
    // Auto-dismiss (only when timer > 0 — manual opens set timer to 0)
    if (game.scrollOverlayTimer > 0) {
        game.scrollOverlayTimer -= dt;
        if (game.scrollOverlayTimer <= 0) {
            game.showScrollOverlay = false;
            return;
        }
    }
    // Close on interact key or I key
    if (actionJustPressed('interact') || isJustPressed('KeyI')) {
        game.showScrollOverlay = false;
    }
}

/** Renders the scroll overlay showing the heart crate pattern. */
function renderScrollOverlay(ctx) {
    if (!game.showScrollOverlay) return;
    var w = CONFIG.CANVAS_W;
    var h = CONFIG.CANVAS_H;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, 0, w, h);

    // Parchment-style scroll background
    var boxW = 320;
    var boxH = 300;
    var bx = (w - boxW) / 2;
    var by = (h - boxH) / 2;
    ctx.fillStyle = '#f5e6c8';
    ctx.fillRect(bx, by, boxW, boxH);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(bx, by, boxW, boxH);
    // Inner border
    ctx.strokeStyle = '#c4a46c';
    ctx.lineWidth = 1;
    ctx.strokeRect(bx + 6, by + 6, boxW - 12, boxH - 12);

    // Title
    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText("Mama's Note", w / 2, by + 36);

    // Heart pattern grid (3 cols × 3 rows)
    // Pattern: [1,0,1], [1,1,1], [0,1,0] — 1 = filled, 0 = empty
    var pattern = [
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 0],
    ];
    var cellSize = 48;
    var gridW = 3 * cellSize;
    var gridH = 3 * cellSize;
    var gridX = (w - gridW) / 2;
    var gridY = by + 56;

    for (var row = 0; row < 3; row++) {
        for (var col = 0; col < 3; col++) {
            var cx = gridX + col * cellSize;
            var cy = gridY + row * cellSize;

            if (pattern[row][col]) {
                // Filled cell — crate color
                ctx.fillStyle = CONFIG.CRATE_COLOR;
                ctx.fillRect(cx + 3, cy + 3, cellSize - 6, cellSize - 6);
                ctx.strokeStyle = CONFIG.CRATE_BORDER;
                ctx.lineWidth = 2;
                ctx.strokeRect(cx + 3, cy + 3, cellSize - 6, cellSize - 6);
                // Cross pattern like actual crates
                ctx.beginPath();
                ctx.moveTo(cx + 3, cy + 3);
                ctx.lineTo(cx + cellSize - 3, cy + cellSize - 3);
                ctx.moveTo(cx + cellSize - 3, cy + 3);
                ctx.lineTo(cx + 3, cy + cellSize - 3);
                ctx.stroke();
            } else {
                // Empty cell — faint outline
                ctx.fillStyle = 'rgba(139, 105, 20, 0.1)';
                ctx.fillRect(cx + 3, cy + 3, cellSize - 6, cellSize - 6);
            }
        }
    }

    // Subtitle
    ctx.fillStyle = '#5a3a1a';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Push the crates into this shape!', w / 2, gridY + gridH + 22);

    // Hint
    ctx.fillStyle = '#8b6914';
    ctx.font = '12px monospace';
    ctx.fillText('Look for the golden markers on the ground', w / 2, gridY + gridH + 44);

    // Close hint
    ctx.fillStyle = '#999';
    ctx.font = '11px monospace';
    ctx.fillText('[I] or [Z] Close', w / 2, by + boxH - 14);
}

// ============================================================
// Nokia T9 Puzzle overlay
// ============================================================

/** Renders the Nokia 3210 T9 puzzle overlay. */
function renderNokia(ctx) {
    if (!nokia.active) return;
    var w = CONFIG.CANVAS_W;
    var h = CONFIG.CANVAS_H;
    var t = game.time;

    // Dim background with radial vignette
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, w, h);

    // Screen shake on wrong answer
    var shakeX = 0, shakeY = 0;
    if (nokia.shakeTimer > 0) {
        shakeX = (Math.random() - 0.5) * 8;
        shakeY = (Math.random() - 0.5) * 8;
    }

    // Phone body dimensions
    var phoneW = 220;
    var phoneH = 380;
    var px = Math.floor((w - phoneW) / 2) + shakeX;
    var py = Math.floor((h - phoneH) / 2) + shakeY;

    // Phone shadow
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(px + 6, py + 6, phoneW, phoneH);

    // Phone body (dark green with subtle gradient)
    var phoneGrad = ctx.createLinearGradient(px, py, px + phoneW, py + phoneH);
    phoneGrad.addColorStop(0, '#354535');
    phoneGrad.addColorStop(0.5, '#2a3a2a');
    phoneGrad.addColorStop(1, '#1f2f1f');
    ctx.fillStyle = phoneGrad;
    ctx.fillRect(px, py, phoneW, phoneH);

    // Outer bevel
    ctx.strokeStyle = '#5a7a5a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, phoneW - 2, phoneH - 2);
    ctx.strokeStyle = '#1a2a1a';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + phoneW - 1, py + 1, 1, phoneH - 2);
    ctx.strokeRect(px + 1, py + phoneH - 1, phoneW - 2, 1);

    // Inner border
    ctx.strokeStyle = '#3a5a3a';
    ctx.lineWidth = 1;
    ctx.strokeRect(px + 5, py + 5, phoneW - 10, phoneH - 10);

    // Brand label
    ctx.fillStyle = '#7a9a7a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('NOKIA', px + phoneW / 2, py + 20);

    // Screen area with bezel
    var screenX = px + 25;
    var screenY = py + 30;
    var screenW = phoneW - 50;
    var screenH = 100;
    // Screen bezel
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(screenX - 3, screenY - 3, screenW + 6, screenH + 6);
    // Screen
    ctx.fillStyle = '#8bac0f';
    ctx.fillRect(screenX, screenY, screenW, screenH);
    // LCD scanlines effect
    ctx.fillStyle = 'rgba(0,50,0,0.06)';
    for (var sl = 0; sl < screenH; sl += 2) {
        ctx.fillRect(screenX, screenY + sl, screenW, 1);
    }
    // Screen inner shadow
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fillRect(screenX, screenY, screenW, 4);
    ctx.fillRect(screenX, screenY, 3, screenH);

    // Screen content
    var scx = screenX + screenW / 2;

    // Title on screen
    ctx.fillStyle = '#0f380f';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SPELL THE NAME', scx, screenY + 16);

    // Target hint (underscores for each letter)
    var hint = '';
    for (var i = 0; i < T9_TARGET.length; i++) {
        if (i < nokia.enteredLetters.length) {
            hint += nokia.enteredLetters[i] + ' ';
        } else if (i === nokia.enteredLetters.length && nokia.currentKey > 0) {
            var letters = T9_MAP[nokia.currentKey];
            var blink = Math.floor(t * 4) % 2 === 0;
            hint += (blink ? letters[nokia.cycleIndex] : '_') + ' ';
        } else {
            hint += '_ ';
        }
    }
    ctx.font = 'bold 18px monospace';
    ctx.fillText(hint.trim(), scx, screenY + 45);

    // Result text on screen
    if (nokia.result === 'success') {
        ctx.fillStyle = '#0f380f';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('CORRECT!', scx, screenY + 72);
        ctx.font = '10px monospace';
        ctx.fillText('Something fell from the shelf!', scx, screenY + 88);
    } else if (nokia.result === 'fail') {
        ctx.fillStyle = '#0f380f';
        ctx.font = 'bold 14px monospace';
        ctx.fillText('WRONG!', scx, screenY + 72);
        ctx.font = '10px monospace';
        ctx.fillText('Try again...', scx, screenY + 88);
    } else {
        ctx.font = '10px monospace';
        ctx.fillText(nokia.enteredLetters.length + '/' + T9_TARGET.length + ' letters', scx, screenY + 72);
        ctx.font = '9px monospace';
        ctx.fillStyle = '#306230';
        ctx.fillText('Hint: The older sister\'s name', scx, screenY + 88);
    }

    // D-pad area (between screen and numpad)
    var dpadCX = px + phoneW / 2;
    var dpadCY = py + 145;
    // D-pad ring
    ctx.strokeStyle = '#4a6a4a';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(dpadCX, dpadCY, 16, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#3a5a3a';
    ctx.beginPath(); ctx.arc(dpadCX, dpadCY, 14, 0, Math.PI * 2); ctx.fill();
    // Center button
    ctx.fillStyle = '#4a6a4a';
    ctx.beginPath(); ctx.arc(dpadCX, dpadCY, 5, 0, Math.PI * 2); ctx.fill();

    // Number pad (enhanced with 3D button look)
    var padX = px + 20;
    var padY = py + 170;
    var btnW = 54;
    var btnH = 36;
    var btnGap = 5;
    var padLabels = [
        ['1', '2 ABC', '3 DEF'],
        ['4 GHI', '5 JKL', '6 MNO'],
        ['7 PQRS', '8 TUV', '9 WXYZ'],
        ['*', '0', '#'],
    ];

    for (var row = 0; row < 4; row++) {
        for (var col = 0; col < 3; col++) {
            var bx = padX + col * (btnW + btnGap);
            var by = padY + row * (btnH + btnGap);

            // Button shadow
            ctx.fillStyle = '#1a2a1a';
            ctx.fillRect(bx + 1, by + 2, btnW, btnH);
            // Button face
            var btnGradient = ctx.createLinearGradient(bx, by, bx, by + btnH);
            btnGradient.addColorStop(0, '#5a7a5a');
            btnGradient.addColorStop(1, '#3a5a3a');
            ctx.fillStyle = btnGradient;
            ctx.fillRect(bx, by, btnW, btnH);
            // Top highlight
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(bx + 1, by + 1, btnW - 2, 2);

            // Button label
            var label = padLabels[row][col];
            ctx.fillStyle = '#d0e8d0';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(label, bx + btnW / 2, by + btnH / 2 + 4);
        }
    }

    // Instructions below phone
    ctx.fillStyle = '#999999';
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Press 2-9 to type (multi-tap)', px + phoneW / 2, py + phoneH + 22);
    ctx.fillText('Backspace = delete | Enter = submit | Esc = close', px + phoneW / 2, py + phoneH + 40);
}

// ============================================================
// NES Cartridge Puzzle overlay
// ============================================================

/** Renders the NES cartridge puzzle overlay with enhanced visuals. */
function renderCartridge(ctx) {
    if (!cartridge.active) return;
    var w = CONFIG.CANVAS_W;
    var h = CONFIG.CANVAS_H;
    var t = game.time;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.88)';
    ctx.fillRect(0, 0, w, h);

    var cx = w / 2;
    var cy = h / 2;

    // Cartridge body
    var cartW = 170;
    var cartH = 210;
    var cartX = cx - cartW / 2;
    var cartY = cy - cartH / 2 - 20;

    // Shadow behind cartridge
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(cartX + 5, cartY + 5, cartW, cartH);

    // Cartridge body with gradient
    var cartGrad = ctx.createLinearGradient(cartX, cartY, cartX + cartW, cartY);
    cartGrad.addColorStop(0, '#666666');
    cartGrad.addColorStop(0.3, '#5a5a5a');
    cartGrad.addColorStop(0.7, '#555555');
    cartGrad.addColorStop(1, '#4a4a4a');
    ctx.fillStyle = cartGrad;
    ctx.fillRect(cartX, cartY, cartW, cartH);
    // Beveled edges
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(cartX, cartY, cartW, 3);
    ctx.fillRect(cartX, cartY, 2, cartH);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cartX, cartY + cartH - 2, cartW, 2);
    ctx.fillRect(cartX + cartW - 2, cartY, 2, cartH);
    // Outer border
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 2;
    ctx.strokeRect(cartX, cartY, cartW, cartH);

    // Top indent (cartridge grip)
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(cartX + 30, cartY + 2, cartW - 60, 10);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(cartX + 32, cartY + 4, cartW - 64, 6);

    // Label area with richer detail
    ctx.fillStyle = '#8b0000';
    ctx.fillRect(cartX + 15, cartY + 22, cartW - 30, 70);
    // Label gradient overlay
    var labelGrad = ctx.createLinearGradient(0, cartY + 22, 0, cartY + 92);
    labelGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
    labelGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
    ctx.fillStyle = labelGrad;
    ctx.fillRect(cartX + 15, cartY + 22, cartW - 30, 70);
    ctx.strokeStyle = '#660000';
    ctx.lineWidth = 1;
    ctx.strokeRect(cartX + 15, cartY + 22, cartW - 30, 70);

    // Game title on label
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('LA SALSA BROS', cx, cartY + 46);
    ctx.font = '9px monospace';
    ctx.fillStyle = '#ffb300';
    ctx.fillText('The Secret Recipe', cx, cartY + 60);
    // Tiny copyright line
    ctx.fillStyle = '#aa4444';
    ctx.font = '7px monospace';
    ctx.fillText('SAUCE SISTERS ENT. 1992', cx, cartY + 82);

    // Screw holes (top corners of label area)
    ctx.fillStyle = '#444';
    ctx.beginPath(); ctx.arc(cartX + 22, cartY + 100, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cartX + cartW - 22, cartY + 100, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cartX + 22, cartY + 100, 4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cartX + cartW - 22, cartY + 100, 4, 0, Math.PI * 2); ctx.stroke();
    // Screw cross
    ctx.beginPath(); ctx.moveTo(cartX + 20, cartY + 100); ctx.lineTo(cartX + 24, cartY + 100); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cartX + 22, cartY + 98); ctx.lineTo(cartX + 22, cartY + 102); ctx.stroke();

    // Text area between screws and pins
    ctx.fillStyle = '#555';
    ctx.font = '8px monospace';
    ctx.fillText('MADE IN ITALIA', cx, cartY + 120);

    // Warning sticker area
    ctx.fillStyle = '#e0d8c0';
    ctx.fillRect(cartX + 25, cartY + 130, cartW - 50, 30);
    ctx.strokeStyle = '#aaa';
    ctx.lineWidth = 1;
    ctx.strokeRect(cartX + 25, cartY + 130, cartW - 50, 30);
    ctx.fillStyle = '#333';
    ctx.font = '6px monospace';
    ctx.fillText('CAUTION: Do not blow on cartridge', cx, cartY + 143);
    ctx.fillText('(Actually, please do)', cx, cartY + 153);

    // Pin connector at bottom with detail
    ctx.fillStyle = '#b8964c';
    ctx.fillRect(cartX + 20, cartY + cartH - 18, cartW - 40, 15);
    ctx.fillStyle = '#8b6914';
    for (var p = 0; p < 10; p++) {
        ctx.fillRect(cartX + 24 + p * 12, cartY + cartH - 16, 8, 11);
    }
    // Pin connector shine
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(cartX + 20, cartY + cartH - 18, cartW - 40, 4);

    if (cartridge.phase === 'blow') {
        // BLOW PHASE
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 18px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('BLOW ON THE CARTRIDGE!', cx, cartY + cartH + 30);

        ctx.font = '12px monospace';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText('Mash [Z] / [Space] rapidly!', cx, cartY + cartH + 50);

        // Progress bar
        var barW = 200;
        var barH = 20;
        var barX = cx - barW / 2;
        var barY = cartY + cartH + 60;
        ctx.fillStyle = '#333333';
        ctx.fillRect(barX, barY, barW, barH);
        ctx.fillStyle = cartridge.blowProgress > 0.7 ? '#00ff88' : '#4fc3f7';
        ctx.fillRect(barX, barY, barW * cartridge.blowProgress, barH);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(barX, barY, barW, barH);

        // Dust particles flying off cartridge
        if (cartridge.blowProgress > 0.1) {
            ctx.fillStyle = 'rgba(180, 160, 120, 0.5)';
            for (var d = 0; d < 5; d++) {
                var dPhase = (game.time * 3 + d * 1.3) % 2;
                var dustX = cartX + 20 + Math.random() * (cartW - 40);
                var dustY = cartY + 10 - dPhase * 40;
                ctx.fillRect(dustX, dustY, 3, 3);
            }
        }
    } else if (cartridge.phase === 'memory') {
        // MEMORY PHASE
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';

        if (cartridge.memoryShowing) {
            ctx.fillText('MEMORIZE THE SEQUENCE!', cx, cartY + cartH + 30);
        } else {
            ctx.fillText('REPEAT THE SEQUENCE!', cx, cartY + cartH + 30);
        }

        // Draw 4 arrow symbols as controller-style buttons
        var symSize = 44;
        var symGap = 12;
        var totalW = 4 * symSize + 3 * symGap;
        var symStartX = cx - totalW / 2;
        var symY = cartY + cartH + 50;

        var symColors = {
            up: '#e53935',    // red
            down: '#43a047',  // green
            left: '#1e88e5',  // blue
            right: '#fdd835', // yellow
        };

        for (var si = 0; si < 4; si++) {
            var ssx = symStartX + si * (symSize + symGap);
            var scxs = ssx + symSize / 2;
            var scys = symY + symSize / 2;
            var symbol = cartridge.memorySequence[si];
            var isHighlighted = cartridge.memoryShowing && si < cartridge.memoryShowIndex;
            var isPlayerDone = !cartridge.memoryShowing && si < cartridge.playerInput.length;

            // Button shadow
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.arc(scxs + 1, scys + 2, symSize / 2, 0, Math.PI * 2); ctx.fill();

            // Button face
            var btnColor = isHighlighted ? symColors[symbol] :
                           (isPlayerDone ? '#00cc66' : '#3a3a3a');
            ctx.fillStyle = btnColor;
            ctx.beginPath(); ctx.arc(scxs, scys, symSize / 2, 0, Math.PI * 2); ctx.fill();

            // Button bevel
            ctx.strokeStyle = isHighlighted ? '#ffffff' : '#555555';
            ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(scxs, scys, symSize / 2, 0, Math.PI * 2); ctx.stroke();

            // Top highlight
            if (isHighlighted) {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.beginPath(); ctx.arc(scxs - 3, scys - 5, symSize / 3, 0, Math.PI * 2); ctx.fill();
            }

            // Arrow / question mark
            if (isHighlighted || isPlayerDone) {
                ctx.fillStyle = isHighlighted ? '#ffffff' : '#004400';
                ctx.font = 'bold 22px monospace';
                ctx.textAlign = 'center';
                var arrowChar = symbol === 'up' ? '\u25B2' : symbol === 'down' ? '\u25BC' : symbol === 'left' ? '\u25C4' : '\u25BA';
                ctx.fillText(arrowChar, scxs, scys + 7);
            } else if (!cartridge.memoryShowing) {
                ctx.fillStyle = '#666666';
                ctx.font = 'bold 22px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('?', scxs, scys + 7);
            }
        }

        // Wrong input flash
        if (cartridge.memoryWrong) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#ff4444';
            ctx.font = 'bold 20px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('WRONG! Watch again...', cx, symY + symSize + 30);
        } else if (!cartridge.memoryShowing) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('Use arrow keys to repeat', cx, symY + symSize + 30);
        }
    }

    // Result overlay
    if (cartridge.result === 'success') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#00ff88';
        ctx.font = 'bold 24px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('CARTRIDGE ACTIVATED!', cx, cy);
        ctx.font = '14px monospace';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('The old console whirs to life...', cx, cy + 25);
    }

    // Escape hint
    ctx.fillStyle = '#666666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Esc = close', cx, h - 20);
}

// ============================================================
// Item pickup flash effect
// ============================================================

/** Renders the item pickup flash effect (full-screen golden flash + item name). */
function renderItemFlash(ctx) {
    if (!game.itemFlash || game.itemFlash <= 0) return;

    const alpha = Math.min(game.itemFlash / CONFIG.ITEM_FLASH_DURATION, 1) * 0.4;
    ctx.fillStyle = 'rgba(255, 235, 59, ' + alpha + ')';
    ctx.fillRect(0, 0, CONFIG.CANVAS_W, CONFIG.CANVAS_H);

    // Item name announcement
    if (game.itemFlash > CONFIG.ITEM_FLASH_DURATION * 0.3) {
        const textAlpha = Math.min((game.itemFlash - CONFIG.ITEM_FLASH_DURATION * 0.3) / (CONFIG.ITEM_FLASH_DURATION * 0.5), 1);
        ctx.fillStyle = 'rgba(255, 235, 59, ' + textAlpha + ')';
        ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center';
        ctx.fillText('Found: ' + game.itemFlashName + '!', CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2 - 40);

        ctx.fillStyle = 'rgba(255, 255, 255, ' + (textAlpha * 0.8) + ')';
        ctx.font = '14px monospace';
        ctx.fillText('A piece of Mama\'s secret sauce recipe!', CONFIG.CANVAS_W / 2, CONFIG.CANVAS_H / 2 - 10);
    }
}

// ============================================================
// Title screen
// ============================================================

var titleScreen = {
    active: true,           // shown on page load
    selectedIndex: 0,       // 0 = New Game, 1 = Continue
    options: ['New Game'],  // populated on init
    animTimer: 0,
};

/** Initializes title screen options based on save state. */
function initTitleScreen() {
    titleScreen.active = true;
    titleScreen.selectedIndex = 0;
    titleScreen.options = hasSavedGame() ? ['Continue', 'New Game', 'Settings'] : ['New Game', 'Settings'];
    titleScreen.animTimer = 0;
}

/** Updates title screen input. */
function updateTitleScreen(dt) {
    if (!titleScreen.active) return;
    titleScreen.animTimer += dt;

    // Settings overlay intercepts input when open
    if (settingsUI.open) {
        updateSettings(dt);
        return;
    }

    if (actionJustPressed('move_up') || isJustPressed('ArrowUp')) {
        titleScreen.selectedIndex = (titleScreen.selectedIndex - 1 + titleScreen.options.length) % titleScreen.options.length;
    }
    if (actionJustPressed('move_down') || isJustPressed('ArrowDown')) {
        titleScreen.selectedIndex = (titleScreen.selectedIndex + 1) % titleScreen.options.length;
    }

    if (actionJustPressed('interact') || isJustPressed('Enter')) {
        var choice = titleScreen.options[titleScreen.selectedIndex];
        if (choice === 'Continue') {
            titleScreen.active = false;
            loadSavedGame();
        } else if (choice === 'New Game') {
            titleScreen.active = false;
            // Reset all state for fresh start
            for (var key in questFlags) delete questFlags[key];
            inventory.length = 0;
            weaponState.equipped = null;
            weaponState.ammo = {};
            player.hp = 3;
            player.lives = 3;
            player.dead = false;
            game.time = 0;
            game.score = 0;
            game.scorePopups = [];
            deleteSave();
            loadZone('la_cucina');
        } else if (choice === 'Settings') {
            openSettings('title');
        }
    }
}

/** Renders the title screen with warm Italian palette. */
function renderTitleScreen(ctx) {
    if (!titleScreen.active) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;
    var t = titleScreen.animTimer;

    // Background — warm terracotta gradient
    var grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#4a1a0a');   // deep terracotta top
    grad.addColorStop(0.4, '#6b2d14'); // warm mid
    grad.addColorStop(1, '#2a0e05');   // dark bottom
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Floating tomatoes & herbs (replace starfield)
    for (var i = 0; i < 18; i++) {
        var fx = ((i * 137 + Math.sin(t * 0.15 + i * 1.3) * 40) % W + W) % W;
        var fy = ((i * 89 + t * 8 + i * 47) % (H + 40)) - 20;
        var fa = 0.06 + Math.sin(t * 0.8 + i) * 0.03;
        var rot = t * 0.3 + i * 0.7;
        ctx.save();
        ctx.translate(fx, fy);
        ctx.rotate(rot);
        ctx.globalAlpha = fa;
        if (i % 3 === 0) {
            // Tomato
            ctx.fillStyle = '#c62828';
            ctx.beginPath();
            ctx.arc(0, 0, 6 + (i % 4), 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#2e7d32';
            ctx.fillRect(-2, -8 - (i % 3), 4, 4);
        } else if (i % 3 === 1) {
            // Basil leaf
            ctx.fillStyle = '#388e3c';
            ctx.beginPath();
            ctx.ellipse(0, 0, 7, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#1b5e20';
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(-5, 0);
            ctx.lineTo(5, 0);
            ctx.stroke();
        } else {
            // Garlic clove
            ctx.fillStyle = '#e8d5b7';
            ctx.beginPath();
            ctx.ellipse(0, 0, 4, 6, 0, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    }
    ctx.globalAlpha = 1;

    // Warm glow behind title text
    var titleY = H * 0.25 + Math.sin(t * 1.5) * 4;
    var glowGrad = ctx.createRadialGradient(W / 2, titleY, 10, W / 2, titleY, 180);
    glowGrad.addColorStop(0, 'rgba(255, 183, 77, 0.12)');
    glowGrad.addColorStop(1, 'rgba(255, 183, 77, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(0, titleY - 180, W, 360);

    // Title — warm gold with cream shadow
    ctx.fillStyle = '#ffeeba';
    ctx.font = 'bold 36px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('The Sauce Sisters', W / 2 + 1, titleY + 1);
    ctx.fillStyle = '#ffd54f';
    ctx.fillText('The Sauce Sisters', W / 2, titleY);

    // Subtitle — warm orange
    ctx.fillStyle = '#ff8a65';
    ctx.font = '14px monospace';
    ctx.fillText("Mama's Secret Recipe", W / 2, titleY + 30);

    // Decorative tomato trio
    for (var ti = -1; ti <= 1; ti++) {
        var tx = W / 2 + ti * 28;
        var ty = titleY + 58 + Math.sin(t * 2 + ti) * 2;
        var ts = 8 + (1 - Math.abs(ti)) * 4; // center one bigger
        ctx.fillStyle = '#d32f2f';
        ctx.beginPath();
        ctx.arc(tx, ty, ts, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#e53935';
        ctx.beginPath();
        ctx.arc(tx - ts * 0.2, ty - ts * 0.2, ts * 0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#4caf50';
        ctx.fillRect(tx - 2, ty - ts - 3, 4, 5);
    }

    // Menu options
    var menuY = H * 0.55;
    for (var i = 0; i < titleScreen.options.length; i++) {
        var selected = (i === titleScreen.selectedIndex);
        var optY = menuY + i * 36;

        if (selected) {
            // Selection highlight — warm gold
            ctx.fillStyle = 'rgba(255, 213, 79, 0.12)';
            ctx.fillRect(W / 2 - 120, optY - 16, 240, 28);
            ctx.fillStyle = '#ffd54f';
            ctx.font = 'bold 18px monospace';
            var arrowBob = Math.sin(t * 4) * 3;
            ctx.fillText('\u25B6', W / 2 - 100 + arrowBob, optY + 2);
        } else {
            ctx.fillStyle = '#c4a882';
            ctx.font = '16px monospace';
        }
        ctx.textAlign = 'center';
        ctx.fillText(titleScreen.options[i], W / 2, optY + 2);
    }

    // Save info
    if (titleScreen.options[0] === 'Continue') {
        var save = getSaveData();
        if (save) {
            ctx.fillStyle = '#8b6f4e';
            ctx.font = '11px monospace';
            ctx.textAlign = 'center';
            var info = save.zoneName + '  |  ' + save.recipesFound + '/5 recipes  |  ' + formatPlaytime(save.playtime);
            ctx.fillText(info, W / 2, menuY - 20);
        }
    }

    // Controls hint
    ctx.fillStyle = '#6b4f3a';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('\u2191\u2193 Select  |  Z/Space/Enter = Confirm', W / 2, H - 30);

    // Settings overlay on top of title screen
    renderSettings(ctx);
}

// ============================================================
// Pause menu
// ============================================================

var pauseMenu = {
    open: false,
    selectedIndex: 0,
    options: ['Resume', 'Save Game', 'Settings', 'Quit to Title'],
    saveMsg: '',         // 'Game saved!' or ''
    saveMsgTimer: 0,
};

/** Opens the pause menu. */
function openPauseMenu() {
    pauseMenu.open = true;
    pauseMenu.selectedIndex = 0;
    pauseMenu.saveMsg = '';
    pauseMenu.saveMsgTimer = 0;
}

/** Closes the pause menu. */
function closePauseMenu() {
    pauseMenu.open = false;
}

/** Updates pause menu input. */
function updatePauseMenu(dt) {
    if (!pauseMenu.open) return;
    if (pauseMenu.saveMsgTimer > 0) pauseMenu.saveMsgTimer -= dt;

    // Settings overlay intercepts input when open
    if (settingsUI.open) {
        updateSettings(dt);
        return;
    }

    if (actionJustPressed('pause') || isJustPressed('Escape')) {
        closePauseMenu();
        return;
    }

    if (actionJustPressed('move_up') || isJustPressed('ArrowUp')) {
        pauseMenu.selectedIndex = (pauseMenu.selectedIndex - 1 + pauseMenu.options.length) % pauseMenu.options.length;
    }
    if (actionJustPressed('move_down') || isJustPressed('ArrowDown')) {
        pauseMenu.selectedIndex = (pauseMenu.selectedIndex + 1) % pauseMenu.options.length;
    }

    if (actionJustPressed('interact') || isJustPressed('Enter')) {
        var choice = pauseMenu.options[pauseMenu.selectedIndex];
        if (choice === 'Resume') {
            closePauseMenu();
        } else if (choice === 'Save Game') {
            if (saveGame()) {
                pauseMenu.saveMsg = 'Game saved!';
            } else {
                pauseMenu.saveMsg = 'Save failed!';
            }
            pauseMenu.saveMsgTimer = 2.0;
        } else if (choice === 'Settings') {
            openSettings('pause');
        } else if (choice === 'Quit to Title') {
            closePauseMenu();
            // Save before quitting
            saveGame();
            initTitleScreen();
        }
    }
}

/** Renders the pause menu overlay. */
function renderPauseMenu(ctx) {
    if (!pauseMenu.open) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, W, H);

    // Panel
    var panelW = 280;
    var panelH = 200;
    var px = (W - panelW) / 2;
    var py = (H - panelH) / 2;
    ctx.fillStyle = 'rgba(30, 30, 50, 0.95)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    // Title
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED', W / 2, py + 30);

    // Options
    var optStartY = py + 60;
    for (var i = 0; i < pauseMenu.options.length; i++) {
        var selected = (i === pauseMenu.selectedIndex);
        var optY = optStartY + i * 32;

        if (selected) {
            ctx.fillStyle = 'rgba(255, 213, 79, 0.15)';
            ctx.fillRect(px + 20, optY - 12, panelW - 40, 24);
            ctx.fillStyle = '#ffd54f';
            ctx.font = 'bold 14px monospace';
            ctx.fillText('\u25B6 ' + pauseMenu.options[i], W / 2, optY + 2);
        } else {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '14px monospace';
            ctx.fillText(pauseMenu.options[i], W / 2, optY + 2);
        }
    }

    // Save confirmation message
    if (pauseMenu.saveMsgTimer > 0 && pauseMenu.saveMsg) {
        var msgAlpha = Math.min(pauseMenu.saveMsgTimer / 0.5, 1);
        ctx.fillStyle = 'rgba(76, 175, 80, ' + msgAlpha + ')';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(pauseMenu.saveMsg, W / 2, py + panelH - 20);
    }

    // Playtime + zone
    ctx.fillStyle = '#666666';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    var zName = game.currentZone ? game.currentZone.name : '';
    ctx.fillText(zName + '  |  ' + formatPlaytime(game.time) + '  |  ' + countRecipes() + '/5 recipes', W / 2, py + panelH - 6);

    // Settings overlay on top of pause menu
    renderSettings(ctx);
}

// ============================================================
// Save indicator (brief flash on auto-save)
// ============================================================

var saveIndicator = { timer: 0 };

/** Shows a brief save indicator. Called after auto-save. */
function showSaveIndicator() {
    saveIndicator.timer = 1.5;
}

/** Renders the save indicator in the corner. */
function renderSaveIndicator(ctx) {
    if (saveIndicator.timer <= 0) return;
    var alpha = Math.min(saveIndicator.timer / 0.5, 1);
    ctx.fillStyle = 'rgba(100, 200, 100, ' + alpha + ')';
    ctx.font = '10px monospace';
    ctx.textAlign = 'right';
    ctx.fillText('Saved', CONFIG.CANVAS_W - 12, CONFIG.CANVAS_H - 12);
}

// ============================================================
// Settings screen (volume + API key)
// ============================================================

var SETTINGS_STORAGE_KEY = 'sauce_sisters_settings';

var settingsUI = {
    open: false,
    returnTo: 'title',   // 'title' or 'pause'
    selectedIndex: 0,
    items: [
        { id: 'music',  label: 'Music Volume',  type: 'slider' },
        { id: 'sfx',    label: 'SFX Volume',    type: 'slider' },
        { id: 'apikey', label: 'API Key',        type: 'text' },
        { id: 'back',   label: 'Back',           type: 'action' },
    ],
    apiKeyInput: '',         // current text being typed
    apiKeyEditing: false,    // true when typing into API key field
};

/** Opens the settings screen. source = 'title' or 'pause'. */
function openSettings(source) {
    settingsUI.open = true;
    settingsUI.returnTo = source;
    settingsUI.selectedIndex = 0;
    settingsUI.apiKeyEditing = false;
    // Load stored API key
    settingsUI.apiKeyInput = getStoredApiKey();
}

/** Closes the settings screen. */
function closeSettings() {
    settingsUI.open = false;
    settingsUI.apiKeyEditing = false;
    saveSettings();
}

/** Updates settings screen input. */
function updateSettings(dt) {
    if (!settingsUI.open) return;

    // API key text editing mode
    if (settingsUI.apiKeyEditing) {
        // Escape exits editing
        if (isJustPressed('Escape') || isJustPressed('Enter')) {
            settingsUI.apiKeyEditing = false;
            setStoredApiKey(settingsUI.apiKeyInput);
            saveSettings();
            return;
        }
        // Backspace
        if (isJustPressed('Backspace') && settingsUI.apiKeyInput.length > 0) {
            settingsUI.apiKeyInput = settingsUI.apiKeyInput.slice(0, -1);
            return;
        }
        // Capture typed characters (printable keys)
        for (var code in input.justPressed) {
            if (!input.justPressed[code]) continue;
            if (code === 'Escape' || code === 'Enter' || code === 'Backspace') continue;
            if (code.startsWith('Key')) {
                settingsUI.apiKeyInput += code.slice(3).toLowerCase();
            } else if (code.startsWith('Digit')) {
                settingsUI.apiKeyInput += code.slice(5);
            } else if (code === 'Minus') {
                settingsUI.apiKeyInput += '-';
            } else if (code === 'Period') {
                settingsUI.apiKeyInput += '.';
            }
        }
        return;
    }

    // Escape or Backspace closes settings
    if (isJustPressed('Escape') || isJustPressed('Backspace')) {
        closeSettings();
        return;
    }

    // Navigation
    if (actionJustPressed('move_up') || isJustPressed('ArrowUp')) {
        settingsUI.selectedIndex = (settingsUI.selectedIndex - 1 + settingsUI.items.length) % settingsUI.items.length;
    }
    if (actionJustPressed('move_down') || isJustPressed('ArrowDown')) {
        settingsUI.selectedIndex = (settingsUI.selectedIndex + 1) % settingsUI.items.length;
    }

    var item = settingsUI.items[settingsUI.selectedIndex];

    // Slider adjustments with left/right
    if (item.type === 'slider') {
        var step = 0.1;
        if (actionJustPressed('move_left') || isJustPressed('ArrowLeft')) {
            if (item.id === 'music') setMusicVolume(audio.musicVolume - step);
            if (item.id === 'sfx') setSfxVolume(audio.sfxVolume - step);
            saveSettings();
        }
        if (actionJustPressed('move_right') || isJustPressed('ArrowRight')) {
            if (item.id === 'music') setMusicVolume(audio.musicVolume + step);
            if (item.id === 'sfx') setSfxVolume(audio.sfxVolume + step);
            saveSettings();
        }
    }

    // Confirm action
    if (actionJustPressed('interact') || isJustPressed('Enter')) {
        if (item.id === 'back') {
            closeSettings();
        } else if (item.id === 'apikey') {
            settingsUI.apiKeyEditing = true;
        }
    }
}

/** Renders the settings screen overlay. */
function renderSettings(ctx) {
    if (!settingsUI.open) return;
    var W = CONFIG.CANVAS_W;
    var H = CONFIG.CANVAS_H;

    // Dim background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, W, H);

    // Panel
    var panelW = 360;
    var panelH = 260;
    var px = (W - panelW) / 2;
    var py = (H - panelH) / 2;
    ctx.fillStyle = 'rgba(30, 30, 50, 0.95)';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#ffd54f';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, panelW, panelH);

    // Title
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('SETTINGS', W / 2, py + 28);

    // Items
    var itemStartY = py + 56;
    for (var i = 0; i < settingsUI.items.length; i++) {
        var item = settingsUI.items[i];
        var selected = (i === settingsUI.selectedIndex);
        var iy = itemStartY + i * 44;

        // Highlight
        if (selected) {
            ctx.fillStyle = 'rgba(255, 213, 79, 0.1)';
            ctx.fillRect(px + 16, iy - 14, panelW - 32, 36);
        }

        // Label
        ctx.fillStyle = selected ? '#ffd54f' : '#aaaaaa';
        ctx.font = (selected ? 'bold ' : '') + '13px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(item.label, px + 24, iy + 4);

        // Value
        if (item.type === 'slider') {
            var val = item.id === 'music' ? audio.musicVolume : audio.sfxVolume;
            var barX = px + 180;
            var barW = 140;
            var barH = 10;
            var barY = iy - 2;

            // Bar background
            ctx.fillStyle = '#333333';
            ctx.fillRect(barX, barY, barW, barH);
            // Fill
            ctx.fillStyle = selected ? '#ffd54f' : '#888888';
            ctx.fillRect(barX, barY, barW * val, barH);
            // Border
            ctx.strokeStyle = selected ? '#ffd54f' : '#555555';
            ctx.lineWidth = 1;
            ctx.strokeRect(barX, barY, barW, barH);
            // Percentage
            ctx.fillStyle = selected ? '#ffffff' : '#aaaaaa';
            ctx.font = '10px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(val * 100) + '%', px + panelW - 20, iy + 4);

            if (selected) {
                ctx.fillStyle = '#888888';
                ctx.font = '9px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('\u2190 \u2192 adjust', barX + barW / 2, iy + 16);
            }
        } else if (item.type === 'text') {
            var key = settingsUI.apiKeyInput;
            var display = key ? key.slice(0, 8) + '...' + key.slice(-4) : '(not set)';
            if (settingsUI.apiKeyEditing) {
                display = key + '_';
            }
            ctx.fillStyle = settingsUI.apiKeyEditing ? '#ffffff' : (key ? '#88cc88' : '#666666');
            ctx.font = '11px monospace';
            ctx.textAlign = 'right';
            ctx.fillText(display, px + panelW - 20, iy + 4);

            if (selected && !settingsUI.apiKeyEditing) {
                ctx.fillStyle = '#888888';
                ctx.font = '9px monospace';
                ctx.textAlign = 'right';
                ctx.fillText('Z/Enter to edit', px + panelW - 20, iy + 16);
            }
        } else if (item.type === 'action') {
            if (selected) {
                ctx.fillStyle = '#ffd54f';
                ctx.font = 'bold 13px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('\u25B6 ' + item.label, W / 2, iy + 4);
            }
        }
    }

    // Footer hint
    ctx.fillStyle = '#555555';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Esc = Back', W / 2, py + panelH - 10);
}

/** Saves volume + API key to localStorage. */
function saveSettings() {
    try {
        var data = {
            musicVolume: audio.musicVolume,
            sfxVolume: audio.sfxVolume,
            apiKey: settingsUI.apiKeyInput || '',
        };
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {}
}

/** Loads settings from localStorage. Called on boot. */
function loadSettings() {
    try {
        var raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
        if (!raw) return;
        var data = JSON.parse(raw);
        if (data.musicVolume !== undefined) setMusicVolume(data.musicVolume);
        if (data.sfxVolume !== undefined) setSfxVolume(data.sfxVolume);
        if (data.apiKey) settingsUI.apiKeyInput = data.apiKey;
    } catch (e) {}
}

/** Returns the stored API key, or empty string. */
function getStoredApiKey() {
    return settingsUI.apiKeyInput || '';
}

/** Sets the stored API key. */
function setStoredApiKey(key) {
    settingsUI.apiKeyInput = key || '';
}
