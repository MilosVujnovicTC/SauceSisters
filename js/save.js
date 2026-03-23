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
