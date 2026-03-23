// ============================================================
// js/audio.js — Howler.js sample SFX + Tone.js procedural music
// Upgraded for Stage A-1: warm, organic, Italian-flavored audio
// SFX: Kenney.nl CC0 samples via Howler.js
// Music: Upgraded Tone.js with reverb, FM synths, percussion
// Ambient: Per-zone background textures via Tone.js noise
// ============================================================

/** Audio system state. */
const audio = {
    unlocked: false,
    masterVolume: 0.7,
    musicVolume: 0.5,
    sfxVolume: 0.7,
    testSynth: null,
    musicDucked: false,
    duckDb: -12,
};

// ============================================================
// Howler.js sample-based SFX system
// ============================================================

/** SFX sample manifest — maps game sounds to .ogg files with variants. */
const SFX_MANIFEST = {
    footstep_stone: { files: ['footstep_stone_1.ogg', 'footstep_stone_2.ogg', 'footstep_stone_3.ogg'], volume: 0.25 },
    footstep_wood:  { files: ['footstep_wood_1.ogg', 'footstep_wood_2.ogg', 'footstep_wood_3.ogg'], volume: 0.25 },
    footstep_grass: { files: ['footstep_grass_1.ogg', 'footstep_grass_2.ogg', 'footstep_grass_3.ogg'], volume: 0.25 },
    crate_push:     { files: ['crate_push_1.ogg', 'crate_push_2.ogg', 'crate_push_3.ogg'], volume: 0.5 },
    pickup:         { files: ['pickup_1.ogg', 'pickup_2.ogg', 'pickup_3.ogg'], volume: 0.6 },
    splat:          { files: ['splat_1.ogg', 'splat_2.ogg'], volume: 0.5 },
    splat_heavy:    { files: ['splat_heavy.ogg'], volume: 0.5 },
    hit:            { files: ['hit_1.ogg', 'hit_2.ogg'], volume: 0.5 },
    hit_heavy:      { files: ['hit_heavy.ogg'], volume: 0.5 },
    door_open:      { files: ['door_open_1.ogg', 'door_open_2.ogg'], volume: 0.5 },
    door_close:     { files: ['door_close.ogg'], volume: 0.4 },
    book_open:      { files: ['book_open.ogg'], volume: 0.4 },
    book_flip:      { files: ['book_flip_1.ogg', 'book_flip_2.ogg'], volume: 0.35 },
    book_close:     { files: ['book_close.ogg'], volume: 0.4 },
    metal_pot:      { files: ['metal_pot_1.ogg', 'metal_pot_2.ogg', 'metal_pot_3.ogg'], volume: 0.3 },
    weapon_swing:   { files: ['weapon_swing_1.ogg', 'weapon_swing_2.ogg'], volume: 0.5 },
    weapon_draw:    { files: ['weapon_draw.ogg'], volume: 0.4 },
    chop:           { files: ['chop.ogg'], volume: 0.5 },
    cloth:          { files: ['cloth_1.ogg', 'cloth_2.ogg'], volume: 0.4 },
    creak:          { files: ['creak_1.ogg', 'creak_2.ogg'], volume: 0.3 },
    coins:          { files: ['coins.ogg'], volume: 0.4 },
    drop:           { files: ['drop.ogg'], volume: 0.4 },
    plank_place:    { files: ['plank_place.ogg'], volume: 0.5 },
    metal_light:    { files: ['metal_light.ogg'], volume: 0.3 },
    impact_light:   { files: ['impact_light.ogg'], volume: 0.4 },
    powerup:        { files: ['powerup.ogg'], volume: 0.6 },
    powerdown:      { files: ['powerdown.ogg'], volume: 0.5 },
    pluck:          { files: ['pluck_1.ogg', 'pluck_2.ogg'], volume: 0.4 },
    select:         { files: ['select.ogg'], volume: 0.4 },
    click:          { files: ['click.ogg'], volume: 0.3 },
    error:          { files: ['error.ogg'], volume: 0.4 },
    bong:           { files: ['bong.ogg'], volume: 0.5 },
};

/** Audio file base path. */
const SFX_BASE_PATH = 'assets/audio/sfx/';

/** Loaded Howl instances — { soundName: [Howl, Howl, ...] }. */
const sfxSamples = {};

/** Whether Howler samples have been loaded. */
var sfxSamplesLoaded = false;

/** Loads all SFX samples via Howler.js. Called once after audio unlock. */
function loadSFXSamples() {
    if (sfxSamplesLoaded || typeof Howl === 'undefined') return;
    sfxSamplesLoaded = true;

    for (var name in SFX_MANIFEST) {
        var manifest = SFX_MANIFEST[name];
        sfxSamples[name] = [];
        for (var i = 0; i < manifest.files.length; i++) {
            sfxSamples[name].push(new Howl({
                src: [SFX_BASE_PATH + manifest.files[i]],
                volume: manifest.volume * audio.sfxVolume,
                preload: true,
            }));
        }
    }
}

/** Plays a random variant of a named sample with optional pitch randomization. */
function playSample(name, pitchVariation) {
    var variants = sfxSamples[name];
    if (!variants || variants.length === 0) return false;
    var howl = variants[Math.floor(Math.random() * variants.length)];
    if (!howl) return false;
    var rate = 1.0;
    if (pitchVariation) {
        rate = 1.0 + (Math.random() * 2 - 1) * pitchVariation;
    }
    howl.rate(rate);
    howl.volume(SFX_MANIFEST[name].volume * audio.sfxVolume);
    howl.play();
    return true;
}

// ============================================================
// Zone-based footstep surface mapping
// ============================================================

/** Maps zone IDs to their primary footstep surface type. */
const ZONE_SURFACE = {
    la_cucina: 'footstep_wood',
    market:    'footstep_stone',
    canal:     'footstep_stone',
    library:   'footstep_wood',
    gym:       'footstep_stone',
};

// ============================================================
// Music system — upgraded procedural zone loops
// ============================================================

const music = {
    currentZone: null,
    zones: {},
    initialized: false,
    fadeTime: 1.2,
    running: {},
    silentDb: -60,
    fadeProgress: 1,
};

/** Shared reverb bus for all music — adds warmth and space. */
var musicReverb = null;
/** Shared chorus for shimmer. */
var musicChorus = null;

/** Creates the shared effects chain for music. */
function createMusicEffects() {
    musicReverb = new Tone.Reverb({ decay: 2.5, wet: 0.2 }).toDestination();
    musicChorus = new Tone.Chorus({ frequency: 0.5, delayTime: 3.5, depth: 0.4, wet: 0.15 }).connect(musicReverb);
}

/** Creates all zone music instruments and patterns. Called once after audio unlock. */
function initZoneMusic() {
    if (music.initialized || !audio.unlocked) return;
    music.initialized = true;

    createMusicEffects();
    createCucinaMusic();
    createMarketMusic();
    createCanalMusic();
    createLibraryMusic();
    createGymMusic();

    Tone.Transport.start();
}

/** La Cucina: warm, cozy kitchen (A minor, 80 BPM). Accordion-like warmth + gentle melody. */
function createCucinaMusic() {
    var gain = new Tone.Volume(0).connect(musicChorus);
    gain.volume.value = music.silentDb;

    // Warm accordion-like pad — detuned oscillator pair for richness
    var pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.6, decay: 0.4, sustain: 0.5, release: 1.2 },
    }).connect(gain);
    pad.volume.value = -12;

    // Second detuned layer for accordion warmth
    var padWarm = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle', detune: 8 },
        envelope: { attack: 0.7, decay: 0.3, sustain: 0.4, release: 1.5 },
    }).connect(gain);
    padWarm.volume.value = -16;

    // Melody — FM synth for plucked string character
    var delay = new Tone.FeedbackDelay('8n', 0.12).connect(gain);
    delay.wet.value = 0.2;
    var melody = new Tone.FMSynth({
        harmonicity: 2,
        modulationIndex: 1.5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.02, decay: 0.35, sustain: 0.15, release: 0.6 },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.3 },
    }).connect(delay);
    melody.volume.value = -14;

    // Soft bass
    var bass = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.05, decay: 0.3, sustain: 0.4, release: 0.5 },
    }).connect(gain);
    bass.volume.value = -10;

    // Light percussion — tambourine shimmer
    var tambFilter = new Tone.Filter(6000, 'highpass').connect(gain);
    var tamb = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.03 },
    }).connect(tambFilter);
    tamb.volume.value = -22;

    // Chord progression: Am - F - C - G - Am - Dm - E - Am
    var chordSeq = new Tone.Sequence(function(time, chord) {
        if (chord) {
            pad.triggerAttackRelease(chord, '2n', time);
            padWarm.triggerAttackRelease(chord, '2n', time);
        }
    }, [
        ['A3', 'C4', 'E4'],
        ['F3', 'A3', 'C4'],
        ['C3', 'E3', 'G3'],
        ['G3', 'B3', 'D4'],
        ['A3', 'C4', 'E4'],
        ['D3', 'F3', 'A3'],
        ['E3', 'G#3', 'B3'],
        ['A3', 'C4', 'E4'],
    ], '2n');
    chordSeq.loop = true;

    // Melody with longer phrasing and rests for breathing room
    var melodySeq = new Tone.Sequence(function(time, note) {
        if (note) melody.triggerAttackRelease(note, '8n', time);
    }, [
        'E4', null, 'D4', 'C4',
        null, 'A3', null, 'C4',
        'E4', null, 'G4', null,
        'F4', 'E4', null, null,
        'D4', null, 'C4', null,
        'A3', null, 'B3', 'C4',
        'E4', 'D4', null, null,
        'C4', null, null, null,
    ], '4n');
    melodySeq.loop = true;

    // Bass line
    var bassSeq = new Tone.Sequence(function(time, note) {
        if (note) bass.triggerAttackRelease(note, '4n', time);
    }, [
        'A2', null, null, null,
        'F2', null, null, null,
        'C2', null, null, null,
        'G2', null, null, null,
        'A2', null, null, null,
        'D2', null, null, null,
        'E2', null, null, null,
        'A2', null, null, null,
    ], '4n');
    bassSeq.loop = true;

    // Tambourine on beats 2 and 4
    var tambSeq = new Tone.Sequence(function(time, hit) {
        if (hit) tamb.triggerAttackRelease('16n', time);
    }, [
        null, 1, null, 1,
    ], '4n');
    tambSeq.loop = true;

    music.zones.la_cucina = {
        gain: gain,
        synths: [pad, padWarm, melody, bass, tamb],
        effects: [delay, tambFilter],
        patterns: [chordSeq, melodySeq, bassSeq, tambSeq],
        tempo: 80,
    };
}

/** Market: lively Italian market (D major, 115 BPM). Mandolin arpeggios + walking bass + percussion. */
function createMarketMusic() {
    var gain = new Tone.Volume(0).connect(musicChorus);
    gain.volume.value = music.silentDb;

    // Mandolin — FM synth for plucked string character
    var mandolinFilter = new Tone.Filter(4000, 'lowpass').connect(gain);
    var mandolin = new Tone.FMSynth({
        harmonicity: 3,
        modulationIndex: 2,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.003, decay: 0.15, sustain: 0.02, release: 0.15 },
        modulation: { type: 'triangle' },
        modulationEnvelope: { attack: 0.005, decay: 0.1, sustain: 0, release: 0.1 },
    }).connect(mandolinFilter);
    mandolin.volume.value = -10;

    // Warm walking bass
    var bass = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.4, release: 0.3 },
    }).connect(gain);
    bass.volume.value = -8;

    // Accordion pad — detuned pair
    var pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 0.3, decay: 0.2, sustain: 0.35, release: 0.8 },
    }).connect(gain);
    pad.volume.value = -18;

    var padWarm = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle', detune: 6 },
        envelope: { attack: 0.35, decay: 0.2, sustain: 0.3, release: 0.9 },
    }).connect(gain);
    padWarm.volume.value = -20;

    // Percussion — shaker pattern
    var shakerFilter = new Tone.Filter(5000, 'highpass').connect(gain);
    var shaker = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.04, sustain: 0, release: 0.02 },
    }).connect(shakerFilter);
    shaker.volume.value = -20;

    // Kick-like thump
    var kick = new Tone.MembraneSynth({
        pitchDecay: 0.05,
        octaves: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.001, decay: 0.2, sustain: 0, release: 0.1 },
    }).connect(gain);
    kick.volume.value = -18;

    // Mandolin arpeggios — lively, Italian
    var mandolinSeq = new Tone.Sequence(function(time, note) {
        if (note) mandolin.triggerAttackRelease(note, '16n', time);
    }, [
        'D4', 'F#4', 'A4', 'D5', 'A4', 'F#4', null, null,
        'G4', 'B4', 'D5', 'G5', 'D5', 'B4', null, null,
        'E4', 'G4', 'B4', 'E5', 'B4', 'G4', null, null,
        'A3', 'D4', 'F#4', 'A4', 'F#4', 'D4', null, null,
    ], '8n');
    mandolinSeq.loop = true;

    // Walking bass with more movement
    var bassSeq = new Tone.Sequence(function(time, note) {
        if (note) bass.triggerAttackRelease(note, '8n', time);
    }, [
        'D2', null, 'A2', 'D3',
        'G2', null, 'D3', 'G2',
        'E2', null, 'B2', 'E3',
        'A2', null, 'E2', 'A2',
    ], '4n');
    bassSeq.loop = true;

    // Chord pads
    var padSeq = new Tone.Sequence(function(time, chord) {
        if (chord) {
            pad.triggerAttackRelease(chord, '1m', time);
            padWarm.triggerAttackRelease(chord, '1m', time);
        }
    }, [
        ['D3', 'F#3', 'A3'],
        ['G3', 'B3', 'D4'],
        ['E3', 'G3', 'B3'],
        ['A3', 'C#4', 'E4'],
    ], '1m');
    padSeq.loop = true;

    // Shaker — eighth note groove
    var shakerSeq = new Tone.Sequence(function(time, hit) {
        if (hit) shaker.triggerAttackRelease('32n', time);
    }, [
        1, null, 1, 1, null, 1, 1, null,
    ], '8n');
    shakerSeq.loop = true;

    // Kick on 1 and 3
    var kickSeq = new Tone.Sequence(function(time, hit) {
        if (hit) kick.triggerAttackRelease('C1', '8n', time);
    }, [
        1, null, null, null, 1, null, null, null,
    ], '8n');
    kickSeq.loop = true;

    music.zones.market = {
        gain: gain,
        synths: [mandolin, bass, pad, padWarm, shaker, kick],
        effects: [mandolinFilter, shakerFilter],
        patterns: [mandolinSeq, bassSeq, padSeq, shakerSeq, kickSeq],
        tempo: 115,
    };
}

/** Canal: ambient, flowing water (E minor, 70 BPM). Dreamy pads + water drop melody + gentle bass. */
function createCanalMusic() {
    var gain = new Tone.Volume(0).connect(musicReverb);
    gain.volume.value = music.silentDb;

    // Lush reverb pad
    var pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 1.5, decay: 0.5, sustain: 0.5, release: 2.5 },
    }).connect(gain);
    pad.volume.value = -10;

    // Warm detuned layer
    var padLayer = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle', detune: 5 },
        envelope: { attack: 1.8, decay: 0.4, sustain: 0.4, release: 3.0 },
    }).connect(gain);
    padLayer.volume.value = -14;

    // Water drops — bell-like FM synth
    var dropDelay = new Tone.FeedbackDelay('4n.', 0.25).connect(gain);
    dropDelay.wet.value = 0.35;
    var drops = new Tone.FMSynth({
        harmonicity: 4,
        modulationIndex: 1,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.6, sustain: 0, release: 0.8 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.5 },
    }).connect(dropDelay);
    drops.volume.value = -12;

    // Gentle sub bass
    var bass = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.1, decay: 0.4, sustain: 0.3, release: 0.8 },
    }).connect(gain);
    bass.volume.value = -12;

    // Chord progression: Em - C - G - D (flowing, peaceful)
    var chordSeq = new Tone.Sequence(function(time, chord) {
        if (chord) {
            pad.triggerAttackRelease(chord, '1m', time);
            padLayer.triggerAttackRelease(chord, '1m', time);
        }
    }, [
        ['E3', 'G3', 'B3'],
        ['C3', 'E3', 'G3'],
        ['G3', 'B3', 'D4'],
        ['D3', 'F#3', 'A3'],
    ], '1m');
    chordSeq.loop = true;

    // Water drop melody — sparse, bell-like
    var dropSeq = new Tone.Sequence(function(time, note) {
        if (note) drops.triggerAttackRelease(note, '8n', time);
    }, [
        'B4', null, null, null, null, 'E5', null, null,
        null, null, 'G4', null, null, null, null, null,
        'D5', null, null, null, null, null, 'B4', null,
        null, null, 'A4', null, null, null, null, null,
    ], '4n');
    dropSeq.loop = true;

    // Sub bass (root notes)
    var bassSeq = new Tone.Sequence(function(time, note) {
        if (note) bass.triggerAttackRelease(note, '2n', time);
    }, [
        'E2', null, null, null,
        'C2', null, null, null,
        'G2', null, null, null,
        'D2', null, null, null,
    ], '2n');
    bassSeq.loop = true;

    music.zones.canal = {
        gain: gain,
        synths: [pad, padLayer, drops, bass],
        effects: [dropDelay],
        patterns: [chordSeq, dropSeq, bassSeq],
        tempo: 70,
    };
}

/** Library: quiet, scholarly, music box (C major, 65 BPM). Celeste-like plinks + warm pads. */
function createLibraryMusic() {
    var gain = new Tone.Volume(0).connect(musicReverb);
    gain.volume.value = music.silentDb;

    // Soft pad
    var pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: { attack: 1.0, decay: 0.4, sustain: 0.45, release: 1.8 },
    }).connect(gain);
    pad.volume.value = -12;

    // Music-box melody — FM bell with reverb
    var boxDelay = new Tone.FeedbackDelay('8n', 0.15).connect(gain);
    boxDelay.wet.value = 0.25;
    var musicBox = new Tone.FMSynth({
        harmonicity: 5.07,
        modulationIndex: 0.8,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.005, decay: 0.8, sustain: 0, release: 1.0 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.5, sustain: 0, release: 0.5 },
    }).connect(boxDelay);
    musicBox.volume.value = -8;

    // Counter-melody — gentle triangle
    var counter = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.03, decay: 0.4, sustain: 0.1, release: 0.6 },
    }).connect(gain);
    counter.volume.value = -16;

    // Slow chord progression: C - Am - F - G
    var chordSeq = new Tone.Sequence(function(time, chord) {
        if (chord) pad.triggerAttackRelease(chord, '1m', time);
    }, [
        ['C3', 'E3', 'G3'],
        ['A3', 'C4', 'E4'],
        ['F3', 'A3', 'C4'],
        ['G3', 'B3', 'D4'],
    ], '1m');
    chordSeq.loop = true;

    // Music-box melody — delicate, child-like
    var melodySeq = new Tone.Sequence(function(time, note) {
        if (note) musicBox.triggerAttackRelease(note, '8n', time);
    }, [
        'E5', null, null, 'G5',
        null, null, 'C5', null,
        'D5', null, null, null,
        'E5', null, null, null,
        'G5', null, 'A5', null,
        'G5', null, 'E5', null,
        'D5', null, 'C5', null,
        null, null, null, null,
    ], '4n');
    melodySeq.loop = true;

    // Counter-melody — occasional low notes for depth
    var counterSeq = new Tone.Sequence(function(time, note) {
        if (note) counter.triggerAttackRelease(note, '4n', time);
    }, [
        null, null, null, null,
        null, null, 'E4', null,
        null, null, null, null,
        null, 'D4', null, null,
        null, null, null, null,
        null, null, null, 'C4',
        null, null, null, null,
        null, null, null, null,
    ], '4n');
    counterSeq.loop = true;

    music.zones.library = {
        gain: gain,
        synths: [pad, musicBox, counter],
        effects: [boxDelay],
        patterns: [chordSeq, melodySeq, counterSeq],
        tempo: 65,
    };
}

/** Papa's Gym: energetic, motivational (G major, 130 BPM). Driving bass + rhythmic synth. */
function createGymMusic() {
    var gain = new Tone.Volume(0).connect(musicReverb);
    gain.volume.value = music.silentDb;

    // Driving bass — punchy FM
    var bass = new Tone.FMSynth({
        harmonicity: 1,
        modulationIndex: 2,
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.3, sustain: 0.1, release: 0.2 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0, release: 0.1 },
    }).connect(gain);
    bass.volume.value = -8;

    // Rhythmic synth — bright, motivational chords
    var chordSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.3 },
    }).connect(gain);
    chordSynth.volume.value = -14;

    // Lead melody — bright and energetic
    var leadDelay = new Tone.FeedbackDelay('8n', 0.12).connect(gain);
    leadDelay.wet.value = 0.2;
    var lead = new Tone.Synth({
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.15, release: 0.3 },
    }).connect(leadDelay);
    lead.volume.value = -10;

    // Bass line — pumping G major pattern
    var bassSeq = new Tone.Sequence(function(time, note) {
        if (note) bass.triggerAttackRelease(note, '8n', time);
    }, [
        'G2', null, 'G2', null,
        'B2', null, 'D3', null,
        'G2', null, 'G2', null,
        'A2', null, 'B2', null,
        'C3', null, 'C3', null,
        'E3', null, 'C3', null,
        'D3', null, 'D3', null,
        'D3', null, null, null,
    ], '8n');
    bassSeq.loop = true;

    // Chord stabs — offbeat energy
    var chordSeq = new Tone.Sequence(function(time, chord) {
        if (chord) chordSynth.triggerAttackRelease(chord, '8n', time);
    }, [
        null, ['G3', 'B3', 'D4'], null, null,
        null, ['G3', 'B3', 'D4'], null, null,
        null, ['C4', 'E4', 'G4'], null, null,
        null, ['D4', 'F#4', 'A4'], null, null,
    ], '8n');
    chordSeq.loop = true;

    // Lead melody — catchy, gym-pump theme
    var melodySeq = new Tone.Sequence(function(time, note) {
        if (note) lead.triggerAttackRelease(note, '8n', time);
    }, [
        'G4', null, 'B4', null,
        'D5', null, 'B4', null,
        'A4', null, 'G4', null,
        null, null, null, null,
        'C5', null, 'D5', null,
        'E5', null, 'D5', null,
        'B4', null, 'G4', null,
        null, null, null, null,
    ], '8n');
    melodySeq.loop = true;

    music.zones.gym = {
        gain: gain,
        synths: [bass, chordSynth, lead],
        effects: [leadDelay],
        patterns: [bassSeq, chordSeq, melodySeq],
        tempo: 130,
    };
}

/** Starts music for a zone with crossfade from the current zone. */
function startZoneMusic(zoneId) {
    if (!music.initialized) {
        initZoneMusic();
        if (!music.initialized) return;
    }

    if (music.currentZone === zoneId) return;

    // Stop old zone music immediately
    var oldId = music.currentZone;
    if (oldId && music.zones[oldId]) {
        var old = music.zones[oldId];
        for (var i = 0; i < old.patterns.length; i++) {
            old.patterns[i].stop();
        }
        music.running[oldId] = false;
        old.gain.volume.cancelScheduledValues(0);
        old.gain.volume.value = music.silentDb;
    }

    music.currentZone = zoneId;
    var zone = music.zones[zoneId];
    if (!zone) return;

    // Reset Transport for clean scheduling
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.bpm.value = zone.tempo;

    for (var id in music.zones) {
        for (var j = 0; j < music.zones[id].patterns.length; j++) {
            music.zones[id].patterns[j].stop();
        }
        music.running[id] = false;
    }
    for (var i = 0; i < zone.patterns.length; i++) {
        zone.patterns[i].start(0);
    }
    music.running[zoneId] = true;
    Tone.Transport.start();

    zone.gain.volume.cancelScheduledValues(0);
    zone.gain.volume.value = music.silentDb;
    music.fadeProgress = 0;

    // Start ambient layer for this zone
    startAmbient(zoneId);
}

/** Updates the manual music fade-in. Called from updateAudio() each frame. */
function updateMusicFade(dt) {
    if (music.fadeProgress >= 1) return;
    if (!music.currentZone || !music.zones[music.currentZone]) return;

    music.fadeProgress += dt / music.fadeTime;
    if (music.fadeProgress > 1) music.fadeProgress = 1;

    var targetDb = Tone.gainToDb(audio.musicVolume);
    if (audio.musicDucked) targetDb += audio.duckDb;
    var currentDb = music.silentDb + (targetDb - music.silentDb) * music.fadeProgress;
    music.zones[music.currentZone].gain.volume.value = currentDb;
}

/** Stops all zone music immediately. */
function stopAllMusic() {
    for (var id in music.zones) {
        var z = music.zones[id];
        z.gain.volume.cancelScheduledValues(Tone.now());
        z.gain.volume.value = music.silentDb;
        for (var i = 0; i < z.patterns.length; i++) {
            z.patterns[i].stop();
        }
        music.running[id] = false;
    }
    music.currentZone = null;
    stopAmbient();
}

// ============================================================
// Ambient sound layers — per-zone background textures
// ============================================================

const ambient = {
    current: null,      // current zone ambient id
    nodes: {},          // { zoneId: { gain, sources[] } }
    initialized: false,
};

/** Creates ambient sound generators for all zones. */
function initAmbient() {
    if (ambient.initialized || !audio.unlocked) return;
    ambient.initialized = true;

    // La Cucina — kitchen sizzle + occasional pot clinks
    (function() {
        var gain = new Tone.Volume(-30).toDestination();
        var sizzleFilter = new Tone.Filter(3000, 'bandpass', -12).connect(gain);
        sizzleFilter.Q.value = 2;
        var sizzle = new Tone.Noise('white').connect(sizzleFilter);
        sizzle.volume.value = -8;
        // Modulate filter for natural variation
        var lfo = new Tone.LFO(0.3, 2000, 4000).connect(sizzleFilter.frequency);
        ambient.nodes.la_cucina = { gain: gain, sources: [sizzle], lfos: [lfo] };
    })();

    // Market — crowd murmur
    (function() {
        var gain = new Tone.Volume(-35).toDestination();
        var murmurFilter = new Tone.Filter(800, 'lowpass').connect(gain);
        murmurFilter.Q.value = 1;
        var murmur = new Tone.Noise('pink').connect(murmurFilter);
        murmur.volume.value = -6;
        var lfo = new Tone.LFO(0.15, 500, 1000).connect(murmurFilter.frequency);
        ambient.nodes.market = { gain: gain, sources: [murmur], lfos: [lfo] };
    })();

    // Canal — water flow
    (function() {
        var gain = new Tone.Volume(-28).toDestination();
        var waterFilter = new Tone.Filter(600, 'lowpass').connect(gain);
        waterFilter.Q.value = 0.8;
        var water = new Tone.Noise('brown').connect(waterFilter);
        water.volume.value = -6;
        var lfo = new Tone.LFO(0.08, 400, 800).connect(waterFilter.frequency);
        ambient.nodes.canal = { gain: gain, sources: [water], lfos: [lfo] };
    })();

    // Library — very quiet, soft air/silence
    (function() {
        var gain = new Tone.Volume(-42).toDestination();
        var airFilter = new Tone.Filter(2000, 'lowpass').connect(gain);
        var air = new Tone.Noise('brown').connect(airFilter);
        air.volume.value = -6;
        var lfo = new Tone.LFO(0.05, 1500, 2500).connect(airFilter.frequency);
        ambient.nodes.library = { gain: gain, sources: [air], lfos: [lfo] };
    })();

    // Gym — weight clanks and low hum of activity
    (function() {
        var gain = new Tone.Volume(-32).toDestination();
        var humFilter = new Tone.Filter(400, 'lowpass').connect(gain);
        humFilter.Q.value = 1.5;
        var hum = new Tone.Noise('pink').connect(humFilter);
        hum.volume.value = -8;
        var lfo = new Tone.LFO(0.2, 250, 500).connect(humFilter.frequency);
        ambient.nodes.gym = { gain: gain, sources: [hum], lfos: [lfo] };
    })();
}

/** Starts ambient sounds for a zone. Stops previous ambient. */
function startAmbient(zoneId) {
    if (!ambient.initialized) return;
    stopAmbient();
    var node = ambient.nodes[zoneId];
    if (!node) return;
    ambient.current = zoneId;
    for (var i = 0; i < node.sources.length; i++) {
        node.sources[i].start();
    }
    if (node.lfos) {
        for (var j = 0; j < node.lfos.length; j++) {
            node.lfos[j].start();
        }
    }
}

/** Stops all ambient sounds. */
function stopAmbient() {
    if (!ambient.current || !ambient.nodes[ambient.current]) return;
    var node = ambient.nodes[ambient.current];
    for (var i = 0; i < node.sources.length; i++) {
        try { node.sources[i].stop(); } catch(e) {}
    }
    if (node.lfos) {
        for (var j = 0; j < node.lfos.length; j++) {
            try { node.lfos[j].stop(); } catch(e) {}
        }
    }
    ambient.current = null;
}

// ============================================================
// SFX system — Howler.js samples with Tone.js fallback
// ============================================================

const sfx = {
    initialized: false,
    gain: null,
    barkSynth: null,
    blipSynths: {},
    footstepTimer: 0,
    footstepInterval: 0.22,
    // Tone.js fallback synths (used if Howler unavailable)
    fallbackFootstep: null,
    fallbackCrate: null,
    fallbackPickup: null,
};

/** NPC voice blip profiles — FM synths with character. */
const NPC_BLIP_PROFILES = {
    chef_tutorial:   { type: 'fmsine',   baseNote: 'C4',  pitchRange: 4, harmonicity: 1.5 },
    market_vendor:   { type: 'fmsine',   baseNote: 'E4',  pitchRange: 5, harmonicity: 2 },
    signora_betta:   { type: 'sine',     baseNote: 'A3',  pitchRange: 3, harmonicity: 1 },
    market_cat_lady: { type: 'triangle', baseNote: 'G4',  pitchRange: 6, harmonicity: 1 },
    canal_fisherman: { type: 'fmsine',   baseNote: 'D3',  pitchRange: 3, harmonicity: 3 },
    canal_duck_lady: { type: 'triangle', baseNote: 'F4',  pitchRange: 5, harmonicity: 1 },
    librarian:       { type: 'sine',     baseNote: 'B4',  pitchRange: 4, harmonicity: 1 },
    library_reader:  { type: 'fmsine',   baseNote: 'G3',  pitchRange: 3, harmonicity: 2 },
    papa_marco:      { type: 'fmsine',   baseNote: 'F3',  pitchRange: 4, harmonicity: 2.5 },
    gym_trainer:     { type: 'fmsine',   baseNote: 'A3',  pitchRange: 5, harmonicity: 2 },
    gym_smoothie:    { type: 'triangle', baseNote: 'E4',  pitchRange: 4, harmonicity: 1 },
    gym_lifter:      { type: 'fmsine',   baseNote: 'C3',  pitchRange: 3, harmonicity: 3 },
};

/** Creates SFX synths (for sounds that stay procedural). Called once after audio unlock. */
function initSFX() {
    if (sfx.initialized || !audio.unlocked) return;
    sfx.initialized = true;

    // SFX volume bus
    sfx.gain = new Tone.Volume(Tone.gainToDb(audio.sfxVolume)).toDestination();

    // Brodo bark — keep procedural (FM synth sounds great for this)
    sfx.barkSynth = new Tone.FMSynth({
        harmonicity: 2.5,
        modulationIndex: 4,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.008, decay: 0.25, sustain: 0.08, release: 0.35 },
        modulation: { type: 'sine' },
        modulationEnvelope: { attack: 0.008, decay: 0.15, sustain: 0, release: 0.25 },
    }).connect(sfx.gain);
    sfx.barkSynth.volume.value = -10;

    // NPC blip synths — upgraded with FM for gruffer characters
    for (var npcId in NPC_BLIP_PROFILES) {
        var profile = NPC_BLIP_PROFILES[npcId];
        if (profile.type === 'fmsine') {
            sfx.blipSynths[npcId] = new Tone.FMSynth({
                harmonicity: profile.harmonicity,
                modulationIndex: 1,
                oscillator: { type: 'sine' },
                envelope: { attack: 0.003, decay: 0.1, sustain: 0, release: 0.04 },
                modulation: { type: 'sine' },
                modulationEnvelope: { attack: 0.003, decay: 0.06, sustain: 0, release: 0.03 },
            }).connect(sfx.gain);
        } else {
            sfx.blipSynths[npcId] = new Tone.Synth({
                oscillator: { type: profile.type },
                envelope: { attack: 0.003, decay: 0.1, sustain: 0, release: 0.04 },
            }).connect(sfx.gain);
        }
        sfx.blipSynths[npcId].volume.value = -6;
    }

    // Tone.js fallback synths (used when Howler samples aren't loaded)
    sfx.fallbackFootstep = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.002, decay: 0.04, sustain: 0, release: 0.01 },
    }).connect(sfx.gain);
    sfx.fallbackFootstep.volume.value = -20;

    sfx.fallbackCrate = new Tone.NoiseSynth({
        noise: { type: 'brown' },
        envelope: { attack: 0.01, decay: 0.15, sustain: 0.05, release: 0.1 },
    }).connect(sfx.gain);
    sfx.fallbackCrate.volume.value = -12;

    sfx.fallbackPickup = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: { attack: 0.01, decay: 0.4, sustain: 0, release: 0.3 },
    }).connect(sfx.gain);
    sfx.fallbackPickup.volume.value = -8;

    // Load Howler.js samples
    loadSFXSamples();
}

/** Safe wrapper for Tone.js trigger calls — prevents scheduling crashes. */
function safeTrigger(synth, noteOrDur, dur, time) {
    try {
        if (time !== undefined) {
            synth.triggerAttackRelease(noteOrDur, dur, time);
        } else if (dur !== undefined) {
            synth.triggerAttackRelease(noteOrDur, dur);
        } else {
            synth.triggerAttackRelease(noteOrDur);
        }
    } catch (e) {
        // Tone.js scheduling conflict — silently ignore
    }
}

/** Plays a footstep sound. Uses Howler sample with surface type, falls back to Tone.js. */
function playFootstep(dt) {
    if (!sfx.initialized) return;
    sfx.footstepTimer -= dt;
    if (sfx.footstepTimer <= 0) {
        // Determine surface type from current zone
        var surface = ZONE_SURFACE[music.currentZone] || 'footstep_stone';
        if (!playSample(surface, 0.08)) {
            // Fallback to Tone.js synth
            safeTrigger(sfx.fallbackFootstep, '16n');
        }
        sfx.footstepTimer = sfx.footstepInterval;
    }
}

/** Resets the footstep timer (call when player stops moving). */
function resetFootstepTimer() {
    sfx.footstepTimer = 0;
}

/** Plays a crate push sound. Uses Howler sample, falls back to Tone.js. */
function playCratePush() {
    if (!sfx.initialized) return;
    if (!playSample('crate_push', 0.05)) {
        safeTrigger(sfx.fallbackCrate, '8n');
    }
}

/** Plays an item pickup chime. Uses Howler sample, falls back to Tone.js. */
function playItemPickup() {
    if (!sfx.initialized) return;
    if (!playSample('pickup', 0.03)) {
        // Fallback ascending chime
        var now = Tone.now();
        safeTrigger(sfx.fallbackPickup, 'E5', '16n', now);
        safeTrigger(sfx.fallbackPickup, 'G5', '16n', now + 0.08);
        safeTrigger(sfx.fallbackPickup, 'C6', '8n', now + 0.16);
    }
}

/** Plays Brodo's bark SFX. Procedural FM synth — sounds organic. */
function playBrodoBark() {
    if (!sfx.initialized) return;
    var freq = 100 + Math.random() * 60;
    safeTrigger(sfx.barkSynth, freq, '8n');
}

/** Plays an NPC dialogue blip for one character. FM synths for more personality. */
function playDialogueBlip(npcId, charCode) {
    if (!sfx.initialized) return;
    var synth = sfx.blipSynths[npcId];
    if (!synth) {
        synth = sfx.blipSynths.chef_tutorial;
        if (!synth) return;
    }
    var profile = NPC_BLIP_PROFILES[npcId] || NPC_BLIP_PROFILES.chef_tutorial;
    var semitoneOffset = (charCode % profile.pitchRange) - Math.floor(profile.pitchRange / 2);
    var baseFreq = Tone.Frequency(profile.baseNote).toFrequency();
    var freq = baseFreq * Math.pow(2, semitoneOffset / 12);
    safeTrigger(synth, freq, '32n');
}

// ============================================================
// Additional SFX helpers — for weapon/combat/powerup sounds
// ============================================================

/** Plays weapon swing sound (spatula melee). */
function playWeaponSwing() {
    if (!sfx.initialized) return;
    playSample('weapon_swing', 0.1);
}

/** Plays tomato splat sound. */
function playTomatoSplat() {
    if (!sfx.initialized) return;
    playSample('splat', 0.08);
}

/** Plays enemy hit sound. */
function playEnemyHit() {
    if (!sfx.initialized) return;
    playSample('hit', 0.1);
}

/** Plays flour poof sound. */
function playFlourPoof() {
    if (!sfx.initialized) return;
    playSample('cloth', 0.05);
}

/** Plays banana place sound. */
function playBananaPlace() {
    if (!sfx.initialized) return;
    playSample('drop', 0.05);
}

/** Plays power-up pickup sound. */
function playPowerupPickup() {
    if (!sfx.initialized) return;
    playSample('powerup', 0);
}

/** Plays power-up expire sound. */
function playPowerupExpire() {
    if (!sfx.initialized) return;
    playSample('powerdown', 0);
}

/** Plays door transition sound. */
function playDoorOpen() {
    if (!sfx.initialized) return;
    playSample('door_open', 0.05);
}

/** Plays plank placement sound. */
function playPlankPlace() {
    if (!sfx.initialized) return;
    playSample('plank_place', 0.05);
}

// ============================================================
// Music ducking — lower music volume during dialogue
// ============================================================

/** Ducks music volume for dialogue. Call when dialogue opens. */
function duckMusic() {
    if (!music.currentZone || !music.zones[music.currentZone] || audio.musicDucked) return;
    audio.musicDucked = true;
    var zone = music.zones[music.currentZone];
    zone.gain.volume.value = Tone.gainToDb(audio.musicVolume) + audio.duckDb;
    // Also duck ambient
    if (ambient.current && ambient.nodes[ambient.current]) {
        ambient.nodes[ambient.current].gain.volume.value -= 10;
    }
}

/** Restores music volume after dialogue. Call when dialogue closes. */
function unduckMusic() {
    if (!music.currentZone || !music.zones[music.currentZone] || !audio.musicDucked) return;
    audio.musicDucked = false;
    var zone = music.zones[music.currentZone];
    zone.gain.volume.value = Tone.gainToDb(audio.musicVolume);
    // Restore ambient
    if (ambient.current && ambient.nodes[ambient.current]) {
        ambient.nodes[ambient.current].gain.volume.value += 10;
    }
}

// ============================================================
// Audio unlock + core functions
// ============================================================

/** Attempts to unlock the Web Audio context. Must be called from a user gesture. */
function unlockAudio() {
    if (audio.unlocked) return;
    if (typeof Tone === 'undefined') return;

    Tone.start().then(function() {
        audio.unlocked = true;

        // Set master volume
        Tone.Destination.volume.value = Tone.gainToDb(audio.masterVolume);

        // Create a test synth (kept for debug use with M key)
        audio.testSynth = new Tone.Synth({
            oscillator: { type: 'triangle' },
            envelope: { attack: 0.01, decay: 0.3, sustain: 0, release: 0.1 },
        }).toDestination();

        // Play a confirmation chime
        audio.testSynth.triggerAttackRelease('C5', '8n');
    });
}

/** Returns true if the audio context has been unlocked by a user gesture. */
function isAudioUnlocked() {
    return audio.unlocked;
}

/** Sets the master volume (0.0 to 1.0). */
function setMasterVolume(vol) {
    audio.masterVolume = Math.max(0, Math.min(1, vol));
    if (audio.unlocked && typeof Tone !== 'undefined') {
        Tone.Destination.volume.value = Tone.gainToDb(audio.masterVolume);
    }
}

/** Sets the music volume (0.0 to 1.0). Updates the active zone gain immediately. */
function setMusicVolume(vol) {
    audio.musicVolume = Math.max(0, Math.min(1, vol));
    if (music.currentZone && music.zones[music.currentZone]) {
        music.zones[music.currentZone].gain.volume.value = Tone.gainToDb(audio.musicVolume);
    }
}

/** Sets the SFX volume (0.0 to 1.0). Updates both Howler and Tone.js volumes. */
function setSfxVolume(vol) {
    audio.sfxVolume = Math.max(0, Math.min(1, vol));
    if (sfx.gain) {
        sfx.gain.volume.value = Tone.gainToDb(audio.sfxVolume);
    }
    // Howler volumes are applied per-play in playSample()
}

/** Plays a test tone at the given note. Debug use. */
function playTestTone(note) {
    if (!audio.unlocked || !audio.testSynth) return;
    audio.testSynth.triggerAttackRelease(note || 'C5', '16n');
}

/** Called from update() each frame. Initializes audio when ready, handles debug keys. */
function updateAudio(dt) {
    // Initialize all audio systems once unlocked
    if (audio.unlocked && !music.initialized) {
        initZoneMusic();
        initSFX();
        initAmbient();
        if (game.currentZone) {
            startZoneMusic(game.currentZone.id);
        }
    }

    // Manual music fade-in
    if (dt) updateMusicFade(dt);

    // Debug: M key plays a test tone
    if (audio.unlocked && isJustPressed('KeyM')) {
        var notes = ['C4', 'E4', 'G4', 'C5', 'E5'];
        var pick = notes[Math.floor(Math.random() * notes.length)];
        playTestTone(pick);
    }
}

// ============================================================
// Auto-unlock on first user gesture (keypress, click, or touch)
// ============================================================
(function setupAudioUnlock() {
    function onFirstGesture() {
        unlockAudio();
        window.removeEventListener('keydown', onFirstGesture);
        window.removeEventListener('click', onFirstGesture);
        window.removeEventListener('touchstart', onFirstGesture);
    }
    window.addEventListener('keydown', onFirstGesture);
    window.addEventListener('click', onFirstGesture);
    window.addEventListener('touchstart', onFirstGesture);
})();
