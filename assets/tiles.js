// ============================================================
// assets/tiles.js — Tile type definitions (no image files — drawn in canvas)
// ============================================================

/** Tile type definitions. Each has a color and collision flag. */
const TILES = {
    FLOOR:    { id: 0, color: '#c8a96e', solid: false, label: 'floor' },
    WALL:     { id: 1, color: '#5a4a3a', solid: true,  label: 'wall' },
    WATER:    { id: 2, color: '#3a7ecf', solid: true,  label: 'water' },
    GRASS:    { id: 3, color: '#4a8c3f', solid: false, label: 'grass' },
    COUNTER:  { id: 4, color: '#8b6914', solid: true,  label: 'counter' },
    DOOR:     { id: 5, color: '#d4a03c', solid: false, label: 'door' },
    PATH:     { id: 6, color: '#b8a080', solid: false, label: 'path' },
    STOVE:    { id: 7, color: '#555555', solid: true,  label: 'stove' },
    RUG:      { id: 8, color: '#a0522d', solid: false, label: 'rug' },
    SHELF:    { id: 9, color: '#6b4226', solid: true,  label: 'shelf' },
    STALL:    { id: 10, color: '#c4782e', solid: true, label: 'stall' },
    BARREL:   { id: 11, color: '#7a5c3a', solid: true, label: 'barrel' },
    FLOWER:   { id: 12, color: '#d65d8c', solid: true, label: 'flower' },
    DOCK:     { id: 13, color: '#9e7c4e', solid: false, label: 'dock' },
    PLANK:    { id: 14, color: '#c4a46c', solid: false, label: 'plank' },
    BRIDGEGAP:{ id: 15, color: '#2a5a9e', solid: true,  label: 'bridgegap' },
    MAT:      { id: 16, color: '#4a90d9', solid: false, label: 'mat' },
    EQUIPMENT:{ id: 17, color: '#888888', solid: true,  label: 'equipment' },
    JUICEBAR: { id: 18, color: '#e8a030', solid: true,  label: 'juicebar' },
    MIRROR:   { id: 19, color: '#a8d8ea', solid: true,  label: 'mirror' },
    FOUNTAIN: { id: 20, color: '#6eb5d6', solid: true,  label: 'fountain' },
    COBBLE:   { id: 21, color: '#9e9484', solid: false, label: 'cobble' },
    FILLTARGET:{ id: 22, color: '#b8a080', solid: false, label: 'filltarget' },
    OVEN:     { id: 23, color: '#cc4422', solid: true,  label: 'oven' },
    DINING:   { id: 24, color: '#b08050', solid: true,  label: 'dining' },
    SAUCEMACH:{ id: 25, color: '#cc6633', solid: true,  label: 'saucemach' },
    CHECKERED:{ id: 26, color: '#e8dcc8', solid: false, label: 'checkered' },
};

// Reverse lookup: id → tile definition
const TILE_BY_ID = {};
for (const name in TILES) {
    TILE_BY_ID[TILES[name].id] = TILES[name];
}

// Shorthand for map building
const F = TILES.FLOOR.id;
const W = TILES.WALL.id;
const A = TILES.WATER.id;
const G = TILES.GRASS.id;
const C = TILES.COUNTER.id;
const D = TILES.DOOR.id;
const P = TILES.PATH.id;
const S = TILES.STOVE.id;
const R = TILES.RUG.id;
const H = TILES.SHELF.id;
const T = TILES.STALL.id;
const B = TILES.BARREL.id;
const L = TILES.FLOWER.id;
const K = TILES.DOCK.id;
const J = TILES.PLANK.id;
const X = TILES.BRIDGEGAP.id;
// Gym tile shorthands — use TILES.X.id inline or these vars
var _MT = TILES.MAT.id;
var _EQ = TILES.EQUIPMENT.id;
var _JB = TILES.JUICEBAR.id;
var _MR = TILES.MIRROR.id;
// Piazza tile shorthands
var _FN = TILES.FOUNTAIN.id;
var _CB = TILES.COBBLE.id;
var _FT = TILES.FILLTARGET.id;
// Pizzeria tile shorthands
var _OV = TILES.OVEN.id;
var _DI = TILES.DINING.id;
var _SM = TILES.SAUCEMACH.id;
var _CK = TILES.CHECKERED.id;
