// ============================================================
// js/save.js — Quest flags, inventory, and localStorage save/load
// ============================================================

// ============================================================
// Quest flags — simple key-value store for game state
// ============================================================
const questFlags = {};

/** Sets a quest flag. */
function setFlag(key, value) {
    questFlags[key] = value !== undefined ? value : true;
}

/** Returns the value of a quest flag, or false if not set. */
function getFlag(key) {
    return questFlags[key] !== undefined ? questFlags[key] : false;
}

// ============================================================
// Item definitions
// ============================================================

/** Item types that can exist in the world and inventory. */
const ITEMS = {
    recipe_1: { id: 'recipe_1', name: 'Recipe Fragment #1', color: '#ffeb3b', icon: 'R1', description: 'A piece of Mama\'s secret sauce recipe.' },
    recipe_2: { id: 'recipe_2', name: 'Recipe Fragment #2', color: '#ffeb3b', icon: 'R2', description: 'A piece of Mama\'s secret sauce recipe.' },
    recipe_3: { id: 'recipe_3', name: 'Recipe Fragment #3', color: '#ffeb3b', icon: 'R3', description: 'A piece of Mama\'s secret sauce recipe.' },
    recipe_4: { id: 'recipe_4', name: 'Recipe Fragment #4', color: '#ffeb3b', icon: 'R4', description: 'A piece of Mama\'s secret sauce recipe.' },
    recipe_5: { id: 'recipe_5', name: 'Recipe Fragment #5', color: '#ffeb3b', icon: 'R5', description: 'A piece of Mama\'s secret sauce recipe.' },
    plank_1: { id: 'plank_1', name: 'Bridge Plank', color: '#c4a46c', icon: 'P1', description: 'A sturdy wooden plank for bridge repair.' },
    plank_2: { id: 'plank_2', name: 'Bridge Plank', color: '#c4a46c', icon: 'P2', description: 'A sturdy wooden plank for bridge repair.' },
    plank_3: { id: 'plank_3', name: 'Bridge Plank', color: '#c4a46c', icon: 'P3', description: 'A sturdy wooden plank for bridge repair.' },
    plank_4: { id: 'plank_4', name: 'Bridge Plank', color: '#c4a46c', icon: 'P4', description: 'A sturdy wooden plank for bridge repair.' },
    spatula: { id: 'spatula', name: 'Spatula', color: '#b0b0b0', icon: 'SP', description: 'A trusty kitchen spatula. Melee weapon + flips switches.' },
    tomato: { id: 'tomato', name: 'Tomato', color: '#e53935', icon: 'TM', description: 'Thrown projectile — splat slows enemies 3s.' },
    flour: { id: 'flour', name: 'Bag of Flour', color: '#f5f5dc', icon: 'FL', description: '2-tile radius cloud stun.' },
    banana: { id: 'banana', name: 'Banana', color: '#ffd600', icon: 'BN', description: 'Floor trap — enemies slip.' },
    dirty_sock: { id: 'dirty_sock', name: 'Dirty Sock', color: '#8d6e63', icon: 'SK', description: 'Fear + stun — enemy retreats.' },
    cdrom_disc: { id: 'cdrom_disc', name: 'CD-ROM Disc', color: '#6688aa', icon: 'CD', description: 'One-time spinning disc stun.' },
};

// ============================================================
// Inventory system
// ============================================================

/** Player inventory — array of item ids. */
const inventory = [];

/** Adds an item to the inventory. Returns true if added, false if full. */
function addToInventory(itemId) {
    if (inventory.length >= CONFIG.INV_MAX_SLOTS) return false;
    if (inventory.indexOf(itemId) !== -1) return false; // no duplicates for unique items
    inventory.push(itemId);
    return true;
}

/** Returns true if the player has a specific item. */
function hasItem(itemId) {
    return inventory.indexOf(itemId) !== -1;
}

/** Removes an item from inventory by id. Returns true if removed. */
function removeFromInventory(itemId) {
    var idx = inventory.indexOf(itemId);
    if (idx === -1) return false;
    inventory.splice(idx, 1);
    return true;
}

/** Returns the first plank item id the player has, or null. */
function getFirstPlank() {
    for (var i = 1; i <= 4; i++) {
        if (hasItem('plank_' + i)) return 'plank_' + i;
    }
    return null;
}

// ============================================================
// Save / Load system — localStorage persistence
// ============================================================

var SAVE_KEY = 'sauce_sisters_save';

/** Counts collected recipe fragments based on quest flags. */
function countRecipes() {
    var n = 0;
    for (var i = 1; i <= 5; i++) {
        if (getFlag('recipe_' + i + '_found')) n++;
    }
    return n;
}

/** Builds a save data object from current game state. */
function buildSaveData() {
    var ts = CONFIG.TILE_SIZE;
    return {
        version: 1,
        timestamp: Date.now(),
        // Player
        zone: game.currentZone ? game.currentZone.id : 'la_cucina',
        playerCol: Math.floor((player.x + player.w / 2) / ts),
        playerRow: Math.floor((player.y + player.h / 2) / ts),
        facing: player.facing,
        hp: player.hp,
        lives: player.lives,
        // Inventory + weapons
        inventory: inventory.slice(),
        equipped: weaponState.equipped,
        ammo: JSON.parse(JSON.stringify(weaponState.ammo)),
        // Quest state
        flags: JSON.parse(JSON.stringify(questFlags)),
        // Playtime
        playtime: game.time,
        // Summary (for display on load screen)
        recipesFound: countRecipes(),
        zoneName: game.currentZone ? game.currentZone.name : 'La Cucina',
    };
}

/** Saves the current game state to localStorage. Returns true on success. */
function saveGame() {
    try {
        var data = buildSaveData();
        localStorage.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        return false;
    }
}

/** Returns the saved game data object, or null if no save exists / corrupt. */
function getSaveData() {
    try {
        var raw = localStorage.getItem(SAVE_KEY);
        if (!raw) return null;
        var data = JSON.parse(raw);
        if (!data || !data.zone || !data.flags) return null;
        return data;
    } catch (e) {
        return null;
    }
}

/** Returns true if a saved game exists. */
function hasSavedGame() {
    return getSaveData() !== null;
}

/** Loads game state from localStorage. Returns true on success. */
function loadSavedGame() {
    var data = getSaveData();
    if (!data) return false;

    // Restore quest flags
    for (var key in questFlags) delete questFlags[key];
    for (var key in data.flags) {
        questFlags[key] = data.flags[key];
    }

    // Restore inventory
    inventory.length = 0;
    if (data.inventory) {
        for (var i = 0; i < data.inventory.length; i++) {
            inventory.push(data.inventory[i]);
        }
    }

    // Restore weapon state
    weaponState.equipped = data.equipped || null;
    weaponState.ammo = data.ammo || {};
    weaponState.cooldownTimer = 0;
    weaponState.attacking = false;

    // Restore player HP / lives
    player.hp = data.hp !== undefined ? data.hp : 3;
    player.lives = data.lives !== undefined ? data.lives : 3;
    player.dead = false;
    player.invulnTimer = 0;
    player.damageFlash = 0;

    // Restore playtime
    game.time = data.playtime || 0;

    // Load the saved zone at saved position
    loadZone(data.zone, data.playerCol, data.playerRow);
    if (data.facing) player.facing = data.facing;

    return true;
}

/** Deletes the saved game from localStorage. */
function deleteSave() {
    localStorage.removeItem(SAVE_KEY);
}

/** Formats playtime seconds as "Xh Ym" or "Ym Zs". */
function formatPlaytime(seconds) {
    var s = Math.floor(seconds);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if (h > 0) return h + 'h ' + m + 'm';
    if (m > 0) return m + 'm ' + sec + 's';
    return sec + 's';
}
