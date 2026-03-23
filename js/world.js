// ============================================================
// js/world.js — Tile maps, zone definitions, object placement
// ============================================================

// ============================================================
// Zone definitions
// ============================================================

/** Zone data: id, name, tilemap, spawn point, transitions (tile → target zone + spawn). */
const ZONES = {
    la_cucina: {
        id: 'la_cucina',
        name: 'La Cucina',
        // 24 columns x 18 rows — the sisters' restaurant kitchen (tutorial zone)
        map: [
            [W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W, W],
            [W, H, H, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, H, H, W],
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
            [W, F, F, R, R, R, R, F, F, F, F, F, F, F, F, F, F, R, R, R, R, F, F, W],
            [W, F, F, R, R, R, R, F, F, C, C, C, C, C, C, F, F, R, R, R, R, F, F, W],
            [W, F, F, R, R, R, R, F, F, F, F, F, F, F, F, F, F, R, R, R, R, F, F, W],
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
            [W, C, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, C, W],
            [W, C, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, C, W],
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
            [W, F, F, F, F, F, F, F, F, S, S, S, S, S, S, F, F, F, F, F, F, F, F, W],
            [W, F, F, F, F, F, F, F, F, S, S, S, S, S, S, F, F, F, F, F, F, F, F, W],
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
            [W, H, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, H, W],
            [W, H, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, H, W],
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W],
            [W, F, F, F, F, F, F, F, F, F, F, D, D, F, F, F, F, F, F, F, F, F, F, W],
            [W, W, W, W, W, W, W, W, W, W, W, D, D, W, W, W, W, W, W, W, W, W, W, W],
        ],
        spawnX: 12, // tile col
        spawnY: 8,  // tile row
        // Transitions: when player steps on these tiles, move to target zone
        transitions: [
            { col: 11, row: 17, target: 'market', spawnX: 15, spawnY: 2 },
            { col: 12, row: 17, target: 'market', spawnX: 16, spawnY: 2 },
        ],
        npcs: [
            {
                id: 'chef_tutorial',
                name: 'Sous Chef Luigi',
                col: 6, row: 3,
                color: '#4fc3f7',
                idle: { type: 'cook', interval: 2.5, walkPath: [{col:6,row:3},{col:8,row:3},{col:8,row:6},{col:6,row:6}], walkSpeed: 35 },
                getLines: function(flags) {
                    if (flags.talked_to_luigi) {
                        var returning = [
                            ["Still here? The recipe won't find itself! Try the market.", "And don't forget — Signora Betta knows things."],
                            ["Back already? I hope you're not just here for my risotto.", "...okay fine, it IS very good risotto."],
                            ["The door is right there, Giulia. South. Big opening. Can't miss it.", "I believe in you!"],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "Ah, you must be Giulia! Welcome to La Cucina.",
                            "Your Mama left something important hidden in the city...",
                            "Five pieces of her secret sauce recipe!",
                            "Head out through the door — the market is a good place to start.",
                        ],
                        onComplete: function() { setFlag('talked_to_luigi', true); },
                    };
                },
            },
        ],
        objects: [
            {
                id: 'kitchen_flour',
                name: 'Bag of Flour',
                col: 8, row: 10,
                color: '#f5f5dc',
                onInteract: function() {
                    if (hasItem('flour')) {
                        startDialogue({ id: 'kitchen_flour', name: 'Shelf',
                            getLines: function() { return { lines: ["The flour shelf. Mostly empty now."] }; },
                        });
                        return;
                    }
                    addToInventory('flour');
                    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
                    game.itemFlashName = 'Bag of Flour';
                    playItemPickup();
                },
            },
            {
                id: 'kitchen_spatula',
                name: 'Spatula',
                col: 8, row: 4,
                color: '#b0b0b0',
                onInteract: function() {
                    if (hasItem('spatula')) {
                        startDialogue({
                            id: 'kitchen_spatula', name: 'Counter',
                            getLines: function() { return { lines: ["The counter where you found the spatula. Still smells like Mama's cooking."] }; },
                        });
                        return;
                    }
                    addToInventory('spatula');
                    equipWeapon('spatula');
                    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
                    game.itemFlashName = 'Spatula';
                    playItemPickup();
                    startDialogue({
                        id: 'kitchen_spatula', name: 'Spatula Found!',
                        getLines: function() { return { lines: [
                            "Mama's trusty spatula! It's seen a thousand risottos.",
                            "Press Q to equip/cycle weapons. Attack with Z when nothing is nearby!",
                        ] }; },
                    });
                },
            },
        ],
        powerups: [
            { id: 'cucina_broccoli', type: 'broccoli', col: 15, row: 10 },
            { id: 'cucina_milk', type: 'milk', col: 16, row: 6 },
        ],
    },

    market: {
        id: 'market',
        name: "Signora Betta's Market",
        // 32 columns x 28 rows — outdoor market with stalls, central square, Betta's shop
        map: [
        //   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29 30 31
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, D, D, D, D, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 0  ← door back to La Cucina
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 1
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 2
            [G, G, G, G, L, G, G, G, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, G, G, G, L, G, G, G, G], // 3
            [G, G, G, G, G, G, G, G, G, G, P, P, P, P, P, P, P, P, P, P, P, P, G, G, G, G, G, G, G, G, G, G], // 4
            [G, G, G, G, G, G, T, T, G, G, P, G, G, G, G, P, P, G, G, G, G, P, G, G, T, T, G, G, G, G, G, G], // 5  stalls left + right
            [G, G, G, G, G, G, T, T, G, G, P, G, B, G, G, P, P, G, G, B, G, P, G, G, T, T, G, G, G, G, G, G], // 6
            [G, G, G, G, G, G, G, G, G, G, P, G, G, G, G, P, P, G, G, G, G, P, G, G, G, G, G, G, G, G, G, G], // 7
            [G, G, G, G, G, G, G, G, G, G, P, P, P, P, P, P, P, P, P, P, P, P, G, G, G, G, G, G, G, G, G, G], // 8
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 9
            [G, G, L, G, G, G, G, G, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, G, G, G, G, G, L, G, G], // 10
            [G, G, G, G, G, T, T, T, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, T, T, T, G, G, G, G, G], // 11 more stalls
            [G, G, G, G, G, T, T, T, G, G, B, G, G, G, P, P, P, P, G, G, G, G, B, G, T, T, T, G, G, G, G, G], // 12
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 13
            [G, G, G, G, G, G, G, G, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, D, D], // 14 wide cross path → Canal exit
            [G, G, G, G, G, G, G, G, P, G, G, G, G, G, P, P, P, P, G, G, G, G, G, G, P, G, G, G, G, G, G, G], // 15
            [G, G, G, G, G, G, G, G, P, G, G, W, W, W, W, W, W, W, W, W, W, G, G, G, P, G, G, G, G, G, G, G], // 16 Betta's shop
            [G, G, G, G, G, G, G, G, P, G, G, W, F, F, F, F, F, F, F, F, W, G, G, G, P, G, G, G, G, G, G, G], // 17
            [G, G, G, G, G, G, G, G, P, G, G, W, F, F, F, F, F, F, F, F, W, G, G, G, P, G, G, G, G, G, G, G], // 18
            [G, G, G, G, G, G, G, G, P, G, G, W, F, F, C, C, C, C, F, F, W, G, G, G, P, G, G, G, G, G, G, G], // 19 counter inside
            [G, G, G, G, G, G, G, G, P, G, G, W, F, F, F, F, F, F, F, F, W, G, G, G, P, G, G, G, G, G, G, G], // 20
            [G, G, G, G, G, G, G, G, P, G, G, W, F, F, F, F, F, F, F, F, W, G, G, G, P, G, G, G, G, G, G, G], // 21
            [G, G, G, G, G, G, G, G, P, G, G, W, W, W, W, D, D, W, W, W, W, G, G, G, P, G, G, G, G, G, G, G], // 22 shop door
            [G, G, G, G, G, G, G, G, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, P, G, G, G, G, G, G, G], // 23
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 24
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 25
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 26
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 27
        ],
        spawnX: 15,
        spawnY: 3,
        transitions: [
            { col: 14, row: 0, target: 'la_cucina', spawnX: 11, spawnY: 15 },
            { col: 15, row: 0, target: 'la_cucina', spawnX: 11, spawnY: 15 },
            { col: 16, row: 0, target: 'la_cucina', spawnX: 12, spawnY: 15 },
            { col: 17, row: 0, target: 'la_cucina', spawnX: 12, spawnY: 15 },
            { col: 30, row: 14, target: 'canal', spawnX: 3, spawnY: 7 },
            { col: 31, row: 14, target: 'canal', spawnX: 3, spawnY: 7 },
        ],
        npcs: [
            {
                id: 'market_vendor',
                name: 'Marco the Vendor',
                col: 7, row: 6,
                color: '#ff8a65',
                idle: { type: 'arrange', interval: 2.5, walkPath: [{col:8,row:5},{col:8,row:8}], walkSpeed: 28 },
                getLines: function(flags) {
                    if (flags.talked_to_marco) {
                        var returning = [
                            ["More tomatoes? I've got Roma, San Marzano, cherry...", "Actually, just take a Roma. On the house."],
                            ["You again! I'm starting to think you just like talking to me.", "...not that I'm complaining."],
                            ["Betta's shop is STILL down south. She hasn't moved.", "Trust me, I've tried to get a closer spot. She won't budge."],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "Fresh tomatoes! Finest in the city!",
                            "You look like you're searching for something...",
                            "Maybe try talking to Signora Betta? Her shop is down south.",
                        ],
                        onComplete: function() { setFlag('talked_to_marco', true); },
                    };
                },
            },
            {
                id: 'signora_betta',
                name: 'Signora Betta',
                col: 15, row: 18,
                color: '#ce93d8',
                idle: { type: 'arrange', interval: 2.5, walkPath: [{col:15,row:18},{col:18,row:18}], walkSpeed: 30 },
                getLines: function(flags) {
                    if (flags.recipe_1_found) {
                        return {
                            lines: [
                                "You did it! The heart shape — just like your Mama used to draw!",
                                "Your Mama hid things in the sweetest places...",
                                "There are more pieces out there. Keep looking, dear!",
                            ],
                        };
                    }
                    if (flags.market_quest_started) {
                        var hints = [
                            ["Still working on the puzzle? Push the crates onto the golden markers!", "The scroll shows a heart shape. Press I to see it again!"],
                            ["Six crates, six spots. You can do it, dear!", "The golden marks on the ground show you exactly where they go."],
                            ["Your Mama loved heart shapes. Always drawing them on her recipes!", "Match the pattern and something special will happen!"],
                        ];
                        var pick = Math.floor(Math.random() * hints.length);
                        return { lines: hints[pick] };
                    }
                    // First meeting — gives the scroll and starts the quest
                    return {
                        lines: [
                            "Oh! You must be Giulia! I'd recognize those eyes anywhere.",
                            "Your Mama Rosa... she left a note for you!",
                            "It's a scroll with a heart shape drawn on it.",
                            "She said: 'Push the crates to match the pattern.'",
                            "I've marked the spots on the ground. Look for the golden glow!",
                            "Press I any time to look at the scroll again. Good luck!",
                        ],
                        onComplete: function() {
                            setFlag('market_quest_started', true);
                            setFlag('has_market_scroll', true);
                            game.showScrollOverlay = true;
                            game.scrollOverlayTimer = 4; // auto-dismiss after 4 seconds
                        },
                    };
                },
            },
            {
                id: 'market_cat_lady',
                name: 'Nonna Pina',
                idle: { type: 'knit', interval: 2.5, walkPath: [{col:22,row:7},{col:22,row:9}], walkSpeed: 20 },
                col: 22, row: 7,
                color: '#a5d6a7',
                getLines: function(flags) {
                    var conversations = [
                        ["*is whispering to a pigeon*", "Oh! Don't mind me, I was just... negotiating.", "Pigeons know everything that happens in this city.", "...they just won't talk. Stubborn birds."],
                        ["The pigeon says there's a secret in the library.", "...or maybe it said 'bread'. Hard to tell with pigeons."],
                        ["*feeds a pigeon a breadcrumb*", "This one's name is Giuseppe. He's my best informant.", "Don't tell the other pigeons I said that."],
                        ["Did you know pigeons can recognize human faces?", "Giuseppe recognized you! He says you look trustworthy.", "...or hungry. Again, hard to tell."],
                    ];
                    var visitCount = flags.nonna_pina_visits || 0;
                    var pick = Math.min(visitCount, conversations.length - 1);
                    return {
                        lines: conversations[pick],
                        onComplete: function() { setFlag('nonna_pina_visits', visitCount + 1); },
                    };
                },
            },
        ],
        pushables: [
            { id: 'crate_1', col: 3,  row: 5,  initCol: 3,  initRow: 5,  type: 'crate' },
            { id: 'crate_2', col: 5,  row: 5,  initCol: 5,  initRow: 5,  type: 'crate' },
            { id: 'crate_3', col: 2,  row: 7,  initCol: 2,  initRow: 7,  type: 'crate' },
            { id: 'crate_4', col: 8,  row: 9,  initCol: 8,  initRow: 9,  type: 'crate' },
            { id: 'crate_5', col: 3,  row: 13, initCol: 3,  initRow: 13, type: 'crate' },
            { id: 'crate_6', col: 8,  row: 11, initCol: 8,  initRow: 11, type: 'crate' },
        ],
        objects: [
            {
                id: 'market_tomato',
                name: 'Tomato Basket',
                col: 13, row: 6,
                color: '#e53935',
                onInteract: function() {
                    if (hasItem('tomato')) {
                        startDialogue({ id: 'market_tomato', name: 'Tomato Basket',
                            getLines: function() { return { lines: ["A basket of Roma tomatoes. Perfectly ripe for throwing."] }; },
                        });
                        return;
                    }
                    addToInventory('tomato');
                    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
                    game.itemFlashName = 'Tomato';
                    playItemPickup();
                },
            },
            {
                id: 'market_banana',
                name: 'Banana Stand',
                col: 20, row: 6,
                color: '#ffd600',
                onInteract: function() {
                    if (hasItem('banana')) {
                        startDialogue({ id: 'market_banana', name: 'Banana Stand',
                            getLines: function() { return { lines: ["There's always money in the banana stand. And also bananas."] }; },
                        });
                        return;
                    }
                    addToInventory('banana');
                    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
                    game.itemFlashName = 'Banana';
                    playItemPickup();
                },
            },
        ],
        enemies: [
            {
                id: 'goon_1',
                name: 'Goon',
                col: 10, row: 8,
                color: '#7b1fa2',
                hp: 3,
                speed: 50,
                chaseSpeed: 90,
                sightRange: 120,
                drop: 'tomato',
                patrol: [
                    { col: 10, row: 8 },
                    { col: 21, row: 8 },
                    { col: 21, row: 4 },
                    { col: 10, row: 4 },
                ],
            },
            {
                id: 'goon_2',
                name: 'Goon',
                col: 14, row: 15,
                color: '#7b1fa2',
                hp: 3,
                speed: 45,
                chaseSpeed: 85,
                sightRange: 110,
                drop: 'banana',
                patrol: [
                    { col: 14, row: 15 },
                    { col: 24, row: 15 },
                    { col: 24, row: 23 },
                    { col: 14, row: 23 },
                ],
            },
        ],
        powerups: [
            { id: 'market_deli', type: 'deli_meat', col: 7, row: 13 },
            { id: 'market_gouda', type: 'gouda', col: 23, row: 13 },
            { id: 'market_choco', type: 'chocolate_milk', col: 15, row: 23 },
        ],
    },

    canal: {
        id: 'canal',
        name: 'Canal Crossing',
        // 30 columns x 20 rows — canal with docks, broken bridge
        map: [
        //   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28 29
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 0
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 1
            [G, G, G, L, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, G, L, G, G, G], // 2
            [D, D, G, G, G, G, G, B, G, G, P, P, P, P, P, P, P, P, P, P, G, G, G, B, G, G, G, G, G, G], // 3  ← Market door
            [D, D, G, G, G, G, G, G, G, G, P, G, G, K, K, K, K, G, G, P, G, G, G, G, G, G, G, G, G, G], // 4  ← Market door
            [G, G, G, G, G, G, G, G, G, G, P, G, G, K, K, K, K, G, G, P, G, G, G, G, G, G, G, G, G, G], // 5
            [G, G, G, G, G, G, G, G, G, G, P, G, G, K, K, K, K, G, G, P, G, G, G, G, G, G, G, G, G, G], // 6
            [G, G, G, G, G, G, G, G, G, G, P, P, P, K, K, K, K, P, P, P, G, G, G, G, G, G, G, G, G, G], // 7
            [G, G, G, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, G, G, G, G, G, G], // 8  north dock
            [A, A, A, A, A, A, A, A, A, A, A, A, A, A, J, J, A, A, A, A, A, A, A, A, A, A, A, A, A, A], // 9  canal + bridge (water edge-to-edge)
            [A, A, A, A, A, A, A, A, A, A, A, A, A, A, X, X, A, A, A, A, A, A, A, A, A, A, A, A, A, A], // 10 canal + BRIDGE GAP
            [A, A, A, A, A, A, A, A, A, A, A, A, A, A, J, J, A, A, A, A, A, A, A, A, A, A, A, A, A, A], // 11 canal + bridge
            [G, G, G, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, K, G, G, G, G, G, G], // 12 south dock
            [G, G, G, G, G, G, G, G, G, G, P, P, P, K, K, K, K, P, P, P, G, G, G, G, G, G, G, G, G, G], // 13
            [G, G, G, G, G, G, G, G, G, G, P, G, G, K, K, K, K, G, G, P, G, G, G, G, G, G, G, G, G, G], // 14
            [G, G, G, G, G, G, G, G, G, G, P, G, G, G, G, G, G, G, G, P, G, G, G, G, G, G, G, G, G, G], // 15
            [G, G, G, G, G, G, G, B, G, G, P, P, P, P, P, P, P, P, P, P, G, G, G, B, G, G, G, G, G, G], // 16
            [G, G, G, L, G, G, G, G, G, G, G, G, G, G, P, P, G, G, G, G, G, G, G, G, G, G, L, G, G, G], // 17
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, P, P, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 18
            [G, G, G, G, G, G, G, G, G, G, G, G, G, G, D, D, G, G, G, G, G, G, G, G, G, G, G, G, G, G], // 19 → Library
        ],
        spawnX: 3,
        spawnY: 7,
        transitions: [
            // North-west door → back to Market (east side, row 14)
            { col: 0, row: 3, target: 'market', spawnX: 28, spawnY: 14 },
            { col: 1, row: 3, target: 'market', spawnX: 28, spawnY: 14 },
            { col: 0, row: 4, target: 'market', spawnX: 28, spawnY: 14 },
            { col: 1, row: 4, target: 'market', spawnX: 28, spawnY: 14 },
            // South edge → Library
            { col: 14, row: 19, target: 'library', spawnX: 11, spawnY: 1 },
            { col: 15, row: 19, target: 'library', spawnX: 12, spawnY: 1 },
        ],
        npcs: [
            {
                id: 'canal_fisherman',
                name: 'Old Sal',
                idle: { type: 'fish', interval: 3.5, walkPath: [{col:9,row:6},{col:9,row:8},{col:6,row:8}], walkSpeed: 25 },
                col: 9, row: 8,
                color: '#78909c',
                getLines: function(flags) {
                    if (flags.talked_to_sal) {
                        var returning = [
                            ["Still no fish. But I did catch a boot.", "Vintage. Could be worth something."],
                            ["The bridge has been broken for weeks.", "Nobody fixes anything in this town."],
                            ["I saw a kid on a BMX fly over the canal once.", "Nearly made it too. Nearly."],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "Name's Sal. I fish here every day.",
                            "Don't mind the broken bridge — it's been like that for ages.",
                            "If you need to cross, you'll have to get creative.",
                            "Maybe find some planks? I've seen some float by...",
                        ],
                        onComplete: function() { setFlag('talked_to_sal', true); },
                    };
                },
            },
            {
                id: 'canal_duck_lady',
                name: 'Zia Carmela',
                idle: { type: 'feed', interval: 2.5, walkPath: [{col:18,row:5},{col:18,row:8},{col:21,row:8}], walkSpeed: 28 },
                col: 18, row: 8,
                color: '#ffb74d',
                getLines: function(flags) {
                    var conversations = [
                        ["*is feeding bread to the water*", "The ducks! They love my bread!", "...I haven't seen a duck in three weeks.", "But I keep trying. Hope springs eternal."],
                        ["Still no ducks. But a very polite frog said thank you.", "At least SOMEONE appreciates my bread."],
                        ["Today a seagull took my entire loaf.", "That's not even a duck! That's theft!"],
                    ];
                    var visitCount = flags.zia_carmela_visits || 0;
                    var pick = Math.min(visitCount, conversations.length - 1);
                    return {
                        lines: conversations[pick],
                        onComplete: function() { setFlag('zia_carmela_visits', visitCount + 1); },
                    };
                },
            },
        ],
        objects: [
            {
                id: 'bmx_bike',
                name: 'BMX Bike',
                col: 22, row: 4,
                color: '#ff5722',
                onInteract: function() { startBMXMiniGame(); },
            },
        ],
        powerups: [
            { id: 'canal_water', type: 'water', col: 8, row: 16 },
        ],
    },

    library: {
        id: 'library',
        name: 'Old Library',
        // 24 columns x 18 rows — cozy old library with bookshelves, aisles, reading nooks
        map: [
        //   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23
            [W, W, W, W, W, W, W, W, W, W, W, D, D, W, W, W, W, W, W, W, W, W, W, W], // 0  north wall + entrance
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 1  entry hall
            [W, F, F, H, F, H, F, F, F, F, F, F, F, F, F, F, F, F, H, F, H, F, F, W], // 2  shelf pairs
            [W, F, F, H, F, H, F, F, F, R, R, R, R, R, R, F, F, F, H, F, H, F, F, W], // 3
            [W, F, F, H, F, H, F, F, F, R, F, F, F, F, R, F, F, F, H, F, H, F, F, W], // 4  carpet border
            [W, F, F, F, F, F, F, F, F, R, F, C, C, F, R, F, F, F, F, F, F, F, F, W], // 5  reading table
            [W, F, F, F, F, F, F, F, F, R, F, F, F, F, R, F, F, F, F, F, F, F, F, W], // 6
            [W, F, H, H, H, F, F, F, F, R, F, C, C, F, R, F, F, F, F, H, H, H, F, W], // 7  side shelves + table
            [W, F, F, F, F, F, F, F, F, R, R, R, R, R, R, F, F, F, F, F, F, F, F, W], // 8  carpet end
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 9  aisle
            [W, F, H, H, H, H, F, F, H, H, H, F, F, H, H, H, F, F, H, H, H, H, F, W], // 10 long shelf rows
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 11 aisle
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 12
            [W, F, R, R, F, F, H, H, H, H, F, F, F, F, H, H, H, H, F, F, R, R, F, W], // 13 back shelves + nooks
            [W, F, R, C, F, F, H, F, F, H, F, F, F, F, H, F, F, H, F, F, C, R, F, W], // 14 reading nooks
            [W, F, R, R, F, F, H, F, F, H, F, F, F, F, H, F, F, H, F, F, R, R, F, W], // 15
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 16
            [W, W, W, W, W, W, W, W, W, W, W, D, D, W, W, W, W, W, W, W, W, W, W, W], // 17 south wall + door to Gym
        ],
        spawnX: 11,
        spawnY: 1,
        transitions: [
            // North entrance → back to Canal (south path)
            { col: 11, row: 0, target: 'canal', spawnX: 14, spawnY: 17 },
            { col: 12, row: 0, target: 'canal', spawnX: 15, spawnY: 17 },
            // South exit → Papa's Gym
            { col: 11, row: 17, target: 'gym', spawnX: 12, spawnY: 1 },
            { col: 12, row: 17, target: 'gym', spawnX: 13, spawnY: 1 },
        ],
        npcs: [
            {
                id: 'librarian',
                name: 'Signora Lucia',
                idle: { type: 'read', interval: 3, walkPath: [{col:14,row:5},{col:7,row:5},{col:7,row:9},{col:14,row:9}], walkSpeed: 25 },
                col: 14, row: 5,
                color: '#7986cb',
                getLines: function(flags) {
                    if (flags.talked_to_lucia) {
                        var returning = [
                            ["Shh! This is a library!", "...sorry. Force of habit. What do you need?"],
                            ["The bookshelves in the back are very old.", "Some say they hold secrets. I say they hold dust."],
                            ["A girl and her dog came through here once.", "The dog sneezed on the rare books section. We don't talk about it."],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "Welcome to the Old Library, dear!",
                            "We have books on everything — cooking, history, adventure...",
                            "Feel free to look around. The bookshelves have all sorts of treasures.",
                            "Just... please don't sneeze on the rare books.",
                        ],
                        onComplete: function() { setFlag('talked_to_lucia', true); },
                    };
                },
            },
            {
                id: 'library_reader',
                name: 'Professor Gatto',
                idle: { type: 'read', interval: 4, walkPath: [{col:4,row:12},{col:4,row:9},{col:1,row:9},{col:1,row:12}], walkSpeed: 20 },
                col: 4, row: 12,
                color: '#a1887f',
                getLines: function(flags) {
                    var conversations = [
                        ["*is reading a book upside down*", "Oh! I wasn't sleeping! I was... speed-reading.", "In reverse. It's a technique. Very advanced."],
                        ["This book says tomatoes used to be called 'love apples'.", "Imagine telling someone: 'Pass the love apples, please.'", "Actually, that explains a lot about your Mama's recipes."],
                        ["*adjusts glasses that are clearly broken*", "I've read every book in this library.", "...well, every title. The insides are mostly a blur."],
                    ];
                    var visitCount = flags.professor_gatto_visits || 0;
                    var pick = Math.min(visitCount, conversations.length - 1);
                    return {
                        lines: conversations[pick],
                        onComplete: function() { setFlag('professor_gatto_visits', visitCount + 1); },
                    };
                },
            },
        ],
        objects: [
            {
                id: 'bookshelf_cooking',
                name: 'Cooking Shelf',
                col: 9, row: 10,
                color: '#6b4226',
                onInteract: function() {
                    // Flavor text — later stages will add the cookbook/Nokia puzzle here
                    game.showScrollOverlay = false; // ensure scroll doesn't interfere
                    startDialogue({
                        id: 'bookshelf_cooking',
                        name: 'Cooking Shelf',
                        getLines: function() {
                            return { lines: [
                                "A shelf full of cookbooks! 'Italian Classics', 'Pasta Perfetta'...",
                                "One book has a folded page: 'Mama Rosa's Favorites'.",
                                "Interesting... but the recipe page seems to be torn out.",
                            ]};
                        },
                    });
                },
            },
            {
                id: 'bookshelf_history',
                name: 'History Shelf',
                col: 14, row: 10,
                color: '#6b4226',
                onInteract: function() {
                    startDialogue({
                        id: 'bookshelf_history',
                        name: 'History Shelf',
                        getLines: function() {
                            return { lines: [
                                "Dusty books about the city's history.",
                                "'The Great Tomato Festival of 1923'... 'Canal Construction'...",
                                "There's a sticky note: 'Enzo still owes me a pizza. — Mama R.'",
                            ]};
                        },
                    });
                },
            },
            {
                id: 'nokia_3210',
                name: 'Nokia 3210',
                col: 3, row: 5,
                color: '#3a5a3a',
                onInteract: function() { startNokiaPuzzle(); },
            },
            {
                id: 'nes_cartridge',
                name: 'NES Cartridge',
                col: 12, row: 12,
                color: '#555555',
                onInteract: function() {
                    if (getFlag('cartridge_solved')) {
                        startDialogue({
                            id: 'nes_cartridge',
                            name: 'NES Cartridge',
                            getLines: function() {
                                return { lines: ["The cartridge hums quietly. 'La Salsa Bros' — a classic."] };
                            },
                        });
                        return;
                    }
                    startCartridgePuzzle();
                },
            },
            {
                id: 'bookshelf_mystery',
                name: 'Old Bookshelf',
                col: 7, row: 13,
                color: '#5a3a2a',
                onInteract: function() {
                    startDialogue({
                        id: 'bookshelf_mystery',
                        name: 'Old Bookshelf',
                        getLines: function() {
                            if (getFlag('recipe_2_found')) {
                                return { lines: ["The shelf where you found the recipe fragment. Smells like basil."] };
                            }
                            return { lines: [
                                "These books are VERY old. Some have strange symbols on the spines.",
                                "You notice something wedged behind the books...",
                                "It looks like it could be important, but you can't quite reach it.",
                                "Maybe a dog with a good nose could help?",
                            ]};
                        },
                    });
                },
            },
        ],
        // Hidden items — revealed by Brodo's sniff
        hiddenItems: [
            { id: 'library_secret_1', col: 10, row: 12, itemId: 'recipe_2' },
        ],
        powerups: [
            { id: 'library_brownie', type: 'brownie', col: 21, row: 14 },
        ],
    },

    gym: {
        id: 'gym',
        name: "Papa's Gym",
        // 28 columns x 22 rows — Papa Marco's gym: weight area, mats, juice bar, Papa's corner
        map: [
        //   0  1  2  3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27
            [W, W, W, W, W, W, W, W, W, W, W, W, D, D, W, W, W, W, W, W, W, W, W, W, W, W, W, W], // 0  north wall + entrance from Library
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 1  entry hall
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 2
            [W, F, F,_EQ,_EQ, F, F,_EQ,_EQ, F, F, F, F, F, F, F, F,_EQ,_EQ, F, F,_EQ,_EQ, F, F, F, F, W], // 3  weight racks
            [W, F, F,_EQ,_EQ, F, F,_EQ,_EQ, F, F, F, F, F, F, F, F,_EQ,_EQ, F, F,_EQ,_EQ, F, F, F, F, W], // 4  weight racks
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 5
            [W,_MR, F, F, F, F, F, F, F, F,_MT,_MT,_MT,_MT,_MT,_MT, F, F, F, F, F, F, F, F, F, F,_MR, W], // 6  mirrors + mat area
            [W,_MR, F, F, F, F, F, F, F, F,_MT,_MT,_MT,_MT,_MT,_MT, F, F, F, F, F, F, F, F, F, F,_MR, W], // 7
            [W,_MR, F, F, F, F, F, F, F, F,_MT,_MT,_MT,_MT,_MT,_MT, F, F, F, F, F, F, F, F, F, F,_MR, W], // 8
            [W,_MR, F, F, F, F, F, F, F, F,_MT,_MT,_MT,_MT,_MT,_MT, F, F, F, F, F, F, F, F, F, F,_MR, W], // 9  mirrors + mat area
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 10
            [W, F, F, R, R, R, R, R, F, F, F, F, F, F, F, F, F, F, F, F, F, R, R, R, R, R, F, W], // 11 Papa's corner (left) + lounge (right)
            [W, F, F, R, R, R, R, R, F, F, F, F, F, F, F, F, F, F, F, F, F, R, R, R, R, R, F, W], // 12
            [W, F, F, R, C, C, R, R, F, F, F, F, F, F, F, F, F, F, F, F, F, R, R, C, C, R, F, W], // 13 desk in Papa's corner + bench in lounge
            [W, F, F, R, R, R, R, R, F, F, F, F, F, F, F, F, F, F, F, F, F, R, R, R, R, R, F, W], // 14
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 15
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 16
            [W, F, F,_JB,_JB,_JB,_JB,_JB,_JB, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 17 juice bar
            [W, F, F,_JB,_JB,_JB,_JB,_JB,_JB, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 18 juice bar
            [W, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, F, W], // 19
            [W, F, F, F, F, F, F, F, F, F, F, F, F, D, D, F, F, F, F, F, F, F, F, F, F, F, F, W], // 20 south door to Piazza
            [W, W, W, W, W, W, W, W, W, W, W, W, W, D, D, W, W, W, W, W, W, W, W, W, W, W, W, W], // 21 south wall
        ],
        spawnX: 13,
        spawnY: 1,
        transitions: [
            // North entrance → back to Library (south wall)
            { col: 12, row: 0, target: 'library', spawnX: 11, spawnY: 16 },
            { col: 13, row: 0, target: 'library', spawnX: 12, spawnY: 16 },
            // South exit → Piazza Vecchia (north-right entrance)
            { col: 13, row: 21, target: 'piazza', spawnX: 24, spawnY: 1 },
            { col: 14, row: 21, target: 'piazza', spawnX: 25, spawnY: 1 },
        ],
        npcs: [
            {
                id: 'gym_trainer',
                name: 'Coach Fabio',
                col: 14, row: 8,
                color: '#e65100',
                idle: { type: 'exercise', interval: 2.0, walkPath: [{col:14,row:8},{col:14,row:6},{col:10,row:6},{col:10,row:9}], walkSpeed: 35 },
                getLines: function(flags) {
                    if (flags.talked_to_fabio) {
                        var returning = [
                            ["One more rep! One more—", "Oh, it's you again. Did you find Papa's corner yet? Back-left area."],
                            ["You know what builds character? Squats.", "You know what builds sauce? Mama's recipe. Find those fragments!"],
                            ["I tried your Papa's protein shake once.", "I saw colors that don't exist. 10/10 would NOT recommend."],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "WELCOME to the GYM! I'm Coach Fabio!",
                            "Your Papa trains here — he's in his corner over there.",
                            "Well... his 'corner' is mostly a desk covered in competition forms.",
                            "He might've left something important on one of those forms...",
                        ],
                        onComplete: function() { setFlag('talked_to_fabio', true); },
                    };
                },
            },
            {
                id: 'gym_smoothie',
                name: 'Juice Bar Jenny',
                col: 6, row: 19,
                color: '#7cb342',
                idle: { type: 'arrange', interval: 3.0, walkPath: [{col:6,row:19},{col:4,row:19},{col:4,row:17},{col:8,row:17}], walkSpeed: 25 },
                getLines: function(flags) {
                    var conversations = [
                        ["Welcome to the Juice Bar! Can I get you a Mango Muscle Blast?", "...it's just mango juice. The 'muscle' part is aspirational."],
                        ["Your Papa ordered a 'Triple Espresso Protein Tornado' once.", "The blender hasn't been the same since.", "Neither has Papa, honestly."],
                        ["Want a smoothie? We have Green Machine, Berry Bomb...", "...and the forbidden menu item: Grandma's Mystery Blend.", "Nobody knows what's in it. Nobody WANTS to know."],
                    ];
                    var visitCount = flags.jenny_visits || 0;
                    var pick = Math.min(visitCount, conversations.length - 1);
                    return {
                        lines: conversations[pick],
                        onComplete: function() { setFlag('jenny_visits', visitCount + 1); },
                    };
                },
            },
            {
                id: 'gym_lifter',
                name: 'Big Tony',
                col: 5, row: 4,
                color: '#d32f2f',
                idle: { type: 'exercise', interval: 2.0, walkPath: [{col:5,row:4},{col:8,row:4},{col:8,row:3},{col:5,row:3}], walkSpeed: 20 },
                getLines: function(flags) {
                    var conversations = [
                        ["*grunting intensely*", "Hnnng! 500 kilos! Just kidding, it's 5.", "Don't tell anyone."],
                        ["I heard Enzo's been causing trouble at his pizzeria.", "That guy puts PINEAPPLE on pizza.", "Some crimes cannot be forgiven."],
                        ["*flexing in the mirror*", "Looking good, Tony. Looking REAL good.", "Oh! Sorry, didn't see you there. Yes, I talk to myself. It's motivational."],
                    ];
                    var visitCount = flags.big_tony_visits || 0;
                    var pick = Math.min(visitCount, conversations.length - 1);
                    return {
                        lines: conversations[pick],
                        onComplete: function() { setFlag('big_tony_visits', visitCount + 1); },
                    };
                },
            },
        ],
        objects: [
            {
                id: 'papa_competition_form',
                name: "Papa's Competition Form",
                col: 5, row: 13,
                color: '#fff9c4',
                onInteract: function() {
                    if (getFlag('recipe_3_found')) {
                        startDialogue({
                            id: 'papa_competition_form', name: "Papa's Desk",
                            getLines: function() { return { lines: ["Papa's desk. The competition form is still here, minus the recipe fragment you found."] }; },
                        });
                        return;
                    }
                    addToInventory('recipe_3');
                    setFlag('recipe_3_found', true);
                    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
                    game.itemFlashName = 'Recipe Fragment #3';
                    playItemPickup();
                    startDialogue({
                        id: 'papa_competition_form', name: 'Recipe Fragment Found!',
                        getLines: function() { return { lines: [
                            "You shuffle through Papa's competition forms...",
                            "Wait — there's something stuck to the back of this entry form!",
                            "It's a piece of Mama's recipe! Fragment #3!",
                            "Papa must've used it as scratch paper. Classic Papa.",
                        ] }; },
                    });
                },
            },
            {
                id: 'gym_tamagotchi',
                name: 'Tamagotchi',
                col: 23, row: 13,
                color: '#e040fb',
                onInteract: function() {
                    if (getFlag('tamagotchi_solved')) {
                        startDialogue({
                            id: 'gym_tamagotchi', name: 'Tamagotchi',
                            getLines: function() { return { lines: ["The Tamagotchi beeps happily. Your digital pet is thriving!"] }; },
                        });
                        return;
                    }
                    startDialogue({
                        id: 'gym_tamagotchi', name: 'Tamagotchi',
                        getLines: function() { return { lines: [
                            "An old Tamagotchi! The screen flickers to life...",
                            "A tiny creature stares at you with big pixel eyes.",
                            "It looks hungry. And sad. And slightly pixelated.",
                            "(The feeding puzzle will be available in a future update!)",
                        ] }; },
                    });
                },
            },
            {
                id: 'gym_punching_bag',
                name: 'Punching Bag',
                col: 20, row: 7,
                color: '#8d6e63',
                onInteract: function() {
                    startDialogue({
                        id: 'gym_punching_bag', name: 'Punching Bag',
                        getLines: function() {
                            var lines = [
                                ["You give the punching bag a whack!", "It swings back and almost hits you.", "Maybe stick to spatulas."],
                                ["WHACK! The punching bag barely moves.", "It has seen stronger punches. Much stronger."],
                                ["You punch the bag. It creaks sadly.", "Someone wrote 'ENZO' on it in marker."],
                            ];
                            var pick = Math.floor(Math.random() * lines.length);
                            return { lines: lines[pick] };
                        },
                    });
                },
            },
        ],
        powerups: [
            { id: 'gym_choco', type: 'chocolate_milk', col: 7, row: 18 },
            { id: 'gym_milk', type: 'milk', col: 4, row: 18 },
        ],
    },

    // ================================================================
    // Zone 5 — Piazza Vecchia: open cobblestone square with fountain,
    // benches, planters. Build puzzle unlocks east exit to Zone 6.
    // 30 columns × 22 rows
    // ================================================================
    piazza: {
        id: 'piazza',
        name: 'Piazza Vecchia',
        // 30 columns x 22 rows
        map: [
        //   0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27  28  29
            [W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  D,  D,  D,  W,  W,  W,  W], // 0  north wall + entrance from Gym
            [W, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, D,  D,  D, _CB,_CB,_CB, W], // 1
            [W, _CB, L, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, L, _CB, W], // 2  flower corners
            [W, _CB,_CB,_CB,_CB, P,  P,  P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P,  P,  P, _CB,_CB,_CB,_CB, W], // 3  paths to fountain
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB, W], // 4
            [W, _CB, L, _CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB, L, _CB, W], // 5  flower planters
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB, W], // 6
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB, W], // 7
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_FN,_FN,_FN,_FN,_FN,_FN,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB, W], // 8  fountain area
            [W,  P,  P,  P,  P,  P, _CB,_CB,_CB,_CB,_CB,_FN,_FN,_FN,_FN,_FN,_FN,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P,  W,  W,  W,  W,  W], // 9  cross path + east wall above passage
            [W,  D,  D, _CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_FN,_FN,_FN,_FN,_FN,_FN,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _FT, W,  W,  W,  W], // 10 west entrance + east fill targets
            [W,  D,  D, _CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_FN,_FN,_FN,_FN,_FN,_FN,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _FT, W,  W,  W,  W], // 11
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_FN,_FN,_FN,_FN,_FN,_FN,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _FT, W,  W,  W,  W], // 12
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _FT, W,  W,  W,  W], // 13
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P,  W,  W,  W,  W,  W], // 14 east wall below passage
            [W, _CB, L, _CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB, L, _CB, W], // 15 flower planters
            [W, _CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P, _CB,_CB,_CB,_CB, W], // 16
            [W, _CB,_CB,_CB,_CB, P,  P,  P, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, P,  P,  P, _CB,_CB,_CB,_CB, W], // 17 south paths
            [W, _CB, L, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, L, _CB, W], // 18 flower corners
            [W, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, W], // 19
            [W, _CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB,_CB, W], // 20
            [W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W], // 21 south wall
        ],
        spawnX: 24,
        spawnY: 1,
        transitions: [
            // North-right exit → back to Gym (south entrance)
            { col: 23, row: 0, target: 'gym', spawnX: 13, spawnY: 20 },
            { col: 24, row: 0, target: 'gym', spawnX: 13, spawnY: 20 },
            { col: 25, row: 0, target: 'gym', spawnX: 14, spawnY: 20 },
            // East exit → Zone 6 (Enzo's Pizzeria) — tiles become walkable after build puzzle
            { col: 29, row: 10, target: 'pizzeria', spawnX: 1, spawnY: 10 },
            { col: 29, row: 11, target: 'pizzeria', spawnX: 1, spawnY: 10 },
            { col: 29, row: 12, target: 'pizzeria', spawnX: 1, spawnY: 11 },
            { col: 29, row: 13, target: 'pizzeria', spawnX: 1, spawnY: 11 },
        ],
        npcs: [
            {
                id: 'piazza_vendor',
                name: 'Vendor Gianluca',
                col: 8, row: 6,
                color: '#d4a03c',
                idle: { type: 'arrange', interval: 2.5, walkPath: [{col:8,row:6},{col:8,row:8},{col:10,row:8},{col:10,row:6}], walkSpeed: 30 },
                getLines: function(flags) {
                    if (flags.talked_to_gianluca) {
                        var returning = [
                            ["Back again? My cannoli are the best in town.", "Don't tell Enzo I said that. He thinks HIS are."],
                            ["You look like you're on a mission.", "Just don't knock over my display, per favore!"],
                            ["The fountain used to work better before the pigeons moved in.", "Now it's more of a... bird bath."],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "Benvenuta to the Piazza Vecchia!",
                            "Beautiful square, eh? The fountain's been here for centuries.",
                            "I heard there's a famous pizzeria through the east passage...",
                            "But the path is blocked. Someone left benches everywhere!",
                            "Maybe you could... rearrange them? Just an idea.",
                        ],
                        onComplete: function() { setFlag('talked_to_gianluca', true); },
                    };
                },
            },
            {
                id: 'piazza_nonna',
                name: 'Nonna Viola',
                col: 18, row: 14,
                color: '#9c27b0',
                idle: { type: 'knit', interval: 3.0, walkPath: [{col:18,row:14},{col:20,row:14},{col:20,row:16},{col:18,row:16}], walkSpeed: 25 },
                getLines: function(flags) {
                    if (flags.talked_to_viola) {
                        var returning = [
                            ["*feeding pigeons* They remind me of my grandchildren.", "Always hungry, always loud, always adorable."],
                            ["I've sat in this piazza for 40 years.", "The benches have moved more than I have."],
                            ["*whispering* Enzo's pizzeria is through the east side.", "His pizza is... okay. But his EGO? Enormous!"],
                        ];
                        var pick = Math.floor(Math.random() * returning.length);
                        return { lines: returning[pick] };
                    }
                    return {
                        lines: [
                            "Oh! A visitor! I'm Nonna Viola.",
                            "I sit here every day and watch the world go by.",
                            "The east passage used to be open, you know...",
                            "But then someone put decorations in the way.",
                            "Push the benches and planters onto the marked spots — that should clear the path!",
                        ],
                        onComplete: function() { setFlag('talked_to_viola', true); },
                    };
                },
            },
            {
                id: 'piazza_musician',
                name: 'Accordion Carlo',
                col: 7, row: 15,
                color: '#ff7043',
                idle: { type: 'cook', interval: 2.0 },
                getLines: function(flags) {
                    var lines = [
                        ["*plays an off-key note*", "That was... intentional. Artistic choice."],
                        ["I've been playing here for years!", "The pigeons are my biggest fans. Also my only fans."],
                        ["My accordion is older than this piazza.", "And it sounds like it too, honestly."],
                        ["*dramatic chord*", "That's my interpretation of... a cat sneezing. Thank you."],
                    ];
                    var pick = Math.floor(Math.random() * lines.length);
                    return { lines: lines[pick] };
                },
            },
        ],
        // 4 pushable objects: 2 benches + 2 planters — must be placed on the fill targets
        pushables: [
            { id: 'piazza_bench_1',   col: 8,  row: 10, initCol: 8,  initRow: 10, type: 'bench' },
            { id: 'piazza_bench_2',   col: 20, row: 12, initCol: 20, initRow: 12, type: 'bench' },
            { id: 'piazza_planter_1', col: 3,  row: 7,  initCol: 3,  initRow: 7,  type: 'planter' },
            { id: 'piazza_planter_2', col: 22, row: 15, initCol: 22, initRow: 15, type: 'planter' },
        ],
        powerups: [
            { id: 'piazza_water', type: 'water', col: 14, row: 4 },
            { id: 'piazza_gouda', type: 'gouda_cheese', col: 3, row: 15 },
        ],
    },

    // ================================================================
    // Zone 6 — Enzo's Pizzeria: dining area, kitchen, sauce machine room.
    // Player enters from west (Piazza east passage). Sauce machine room
    // locked behind a door until boss is defeated (Stage 7-5).
    // 28 columns × 20 rows
    // ================================================================
    pizzeria: {
        id: 'pizzeria',
        name: "Enzo's Pizzeria",
        // 28 columns x 20 rows
        map: [
        //   0   1   2   3   4   5   6   7   8   9  10  11  12  13  14  15  16  17  18  19  20  21  22  23  24  25  26  27
            [W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W], // 0  north wall
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  H,  H,  H,  H,  W], // 1  dining | kitchen | sauce room
            [W, _CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK, W,  F,  F,  C,  C,  C,  F,  F,  F,  W, _SM,_SM,_SM,_SM, W], // 2  tables | counters | machines
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W, _SM,_SM,_SM,_SM, W], // 3
            [W, _CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  H,  F,  F,  H,  W], // 4  tables | open area | shelves
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 5
            [W, _CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK, W,  F, _OV,_OV,_OV, F,  S,  S,  F,  W,  F,  F,  F,  F,  W], // 6  tables | ovens + stoves | room
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 7
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, C,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 8  counter above passage
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, D,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 9  passage dining↔kitchen + sauce room wall
            [D,  D, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, D,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 10 west entrance + passage + sauce room wall
            [D,  D, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, D,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 11 passage
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  F,  F,  F,  F,  W], // 12
            [W, _CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  H,  H,  H,  H,  W], // 13 tables | kitchen
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  C,  C,  C,  C,  F,  F,  W,  W,  W,  W,  W,  W], // 14
            [W, _CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK,_CK,_DI,_DI,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  W,  W,  W,  W,  W], // 15 tables
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F, _OV,_OV,_OV, F,  S,  S,  F,  W,  W,  W,  W,  W,  W], // 16 ovens + stoves
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  W,  W,  W,  W,  W], // 17
            [W, _CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK,_CK, W,  F,  F,  F,  F,  F,  F,  F,  F,  W,  W,  W,  W,  W,  W], // 18
            [W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W,  W], // 19 south wall
        ],
        spawnX: 1,
        spawnY: 10,
        transitions: [
            // West exit → back to Piazza (east passage)
            { col: 0, row: 10, target: 'piazza', spawnX: 24, spawnY: 11 },
            { col: 0, row: 11, target: 'piazza', spawnX: 24, spawnY: 12 },
        ],
        npcs: [
            {
                id: 'enzo',
                name: 'Enzo',
                col: 17, row: 9,
                color: '#d32f2f',
                idle: { type: 'cook', interval: 2.0, walkPath: [{col:17,row:9},{col:19,row:9},{col:19,row:12},{col:17,row:12}], walkSpeed: 30 },
                getLines: function(flags) {
                    if (flags.enzo_boss_defeated) {
                        var postBoss = [
                            ["You... you actually beat me?! How?!", "Fine. The sauce machine is in the back room. Take it."],
                            ["I can't believe I lost to a CHILD.", "Your Mama would be proud. Mine is... disappointed. As usual."],
                        ];
                        var pick = Math.floor(Math.random() * postBoss.length);
                        return { lines: postBoss[pick] };
                    }
                    if (flags.talked_to_enzo) {
                        return {
                            lines: [
                                "You came BACK?! You actually want to challenge me?",
                                "Fine! Let's settle this in MY kitchen!",
                                "PIZZA TIME!",
                            ],
                            onComplete: function() { startEnzoBoss(); },
                        };
                    }
                    return {
                        lines: [
                            "Well, well, well... look who wandered into MY pizzeria!",
                            "I'm ENZO! The greatest pizza chef this city has EVER seen!",
                            "I heard you're looking for Mama Rosa's sauce recipe.",
                            "Bad news, ragazza — I have a piece of it. In MY sauce machine.",
                            "You want it? You'll have to get through ME first!",
                            "But first... take a look around. Admire my MASTERPIECE of a kitchen.",
                        ],
                        onComplete: function() { setFlag('talked_to_enzo', true); },
                    };
                },
            },
            {
                id: 'pizzeria_waiter1',
                name: 'Waiter Marco Jr.',
                col: 6, row: 5,
                color: '#f5f5f5',
                idle: { type: 'arrange', interval: 2.5, walkPath: [{col:6,row:5},{col:6,row:9},{col:10,row:9},{col:10,row:5}], walkSpeed: 35 },
                getLines: function(flags) {
                    var lines = [
                        ["*whispering* Don't make eye contact with Enzo.", "He's been in a mood ever since someone said his crust was 'okay.'"],
                        ["Table for one? Two? A whole search party?", "Just kidding. Enzo doesn't let customers eat anymore. Too 'distracting.'"],
                        ["I've been carrying this pizza for 20 minutes.", "Enzo keeps changing his mind about the presentation."],
                        ["*sighs* He made me iron the napkins. IRON them.", "They're PAPER napkins."],
                    ];
                    var pick = Math.floor(Math.random() * lines.length);
                    return { lines: lines[pick] };
                },
            },
            {
                id: 'pizzeria_waiter2',
                name: 'Waitress Sofia',
                col: 3, row: 14,
                color: '#fff9c4',
                idle: { type: 'arrange', interval: 3.0, walkPath: [{col:3,row:14},{col:3,row:10},{col:9,row:10},{col:9,row:14}], walkSpeed: 30 },
                getLines: function(flags) {
                    var lines = [
                        ["Enzo thinks he's a genius.", "He put pineapple on a pizza once and CRIED for three days."],
                        ["The sauce machine in the back? Oh, Enzo guards that with his LIFE.", "He sleeps next to it on Tuesdays."],
                        ["Welcome to Enzo's! Where the pizza is... fine.", "*mouths* Help me."],
                        ["Enzo's motto: 'If it's not perfect, throw it at someone.'", "I have been hit by a LOT of pizza."],
                    ];
                    var pick = Math.floor(Math.random() * lines.length);
                    return { lines: lines[pick] };
                },
            },
        ],
        objects: [
            {
                id: 'sauce_machine_door',
                name: 'Sauce Machine Room',
                col: 22, row: 10,
                color: '#999999',
                onInteract: function() {
                    if (getFlag('enzo_boss_defeated')) {
                        startDialogue({
                            id: 'sauce_machine_door', name: 'Door',
                            getLines: function() {
                                if (getFlag('recipe_4_found')) {
                                    return { lines: ["The sauce machine room. You already got the recipe fragment from here."] };
                                }
                                return { lines: ["The door to the sauce machine room is open. The machine hums inside.", "The recipe fragment should be in there!"] };
                            },
                        });
                    } else {
                        startDialogue({
                            id: 'sauce_machine_door', name: 'Locked Door',
                            getLines: function() { return { lines: ["The door is locked tight. You can hear machinery humming behind it.", "You'll need to deal with Enzo first..."] }; },
                        });
                    }
                },
            },
        ],
        powerups: [
            { id: 'pizzeria_deli', type: 'deli_meat', col: 18, row: 4 },
        ],
    },
};

// ============================================================
// Tile rendering + lookup
// ============================================================

/** Returns the tile definition at map coordinates (col, row). Returns WALL for out-of-bounds. */
function getTile(map, col, row) {
    if (row < 0 || row >= map.length || col < 0 || col >= map[0].length) {
        return TILES.WALL;
    }
    return TILE_BY_ID[map[row][col]] || TILES.WALL;
}

/** Renders visible tiles from the map. cameraX/cameraY are pixel offsets. */
/** Renders tilemap using pre-generated sprite textures. */
function renderTiles(ctx, map, cameraX, cameraY) {
    const ts = CONFIG.TILE_SIZE;
    // Calculate visible tile range
    const startCol = Math.max(0, Math.floor(cameraX / ts));
    const startRow = Math.max(0, Math.floor(cameraY / ts));
    const endCol = Math.min(map[0].length - 1, Math.floor((cameraX + CONFIG.CANVAS_W) / ts));
    const endRow = Math.min(map.length - 1, Math.floor((cameraY + CONFIG.CANVAS_H) / ts));

    // Round camera offset to prevent sub-pixel gaps between tiles
    const camX = Math.round(cameraX);
    const camY = Math.round(cameraY);

    for (let row = startRow; row <= endRow; row++) {
        for (let col = startCol; col <= endCol; col++) {
            const tileId = map[row][col];
            const screenX = col * ts - camX;
            const screenY = row * ts - camY;

            var sprite = getTileSprite(tileId, col, row);
            if (sprite) {
                ctx.drawImage(sprite, screenX, screenY, ts, ts);
            } else {
                // Fallback to flat color
                var tile = TILE_BY_ID[tileId] || TILES.WALL;
                ctx.fillStyle = tile.color;
                ctx.fillRect(screenX, screenY, ts, ts);
            }
        }
    }
}

// ============================================================
// Zone management
// ============================================================

/** Loads a zone by id. Sets the current map, moves player to spawn point, snaps camera. */
function loadZone(zoneId, spawnCol, spawnRow) {
    const zone = ZONES[zoneId];
    if (!zone) return;
    game.currentZone = zone;
    game.currentMap = zone.map;
    game.transitionCooldown = 30; // ~0.5 seconds at 60fps — prevents instant bounce-back
    worldItems = []; // clear world items on zone change (respawn from crate state)
    projectiles = []; // clear projectiles on zone change
    traps = [];       // clear traps on zone change
    areaEffects = []; // clear area effects on zone change
    bossProjectiles = []; // clear boss projectiles on zone change
    if (enzoBoss.active) enzoBoss.active = false; // deactivate boss on zone change

    // Reset pushable positions for unsolved puzzles (prevents softlocks)
    if (zoneId === 'market' && !getFlag('recipe_1_found') && zone.pushables) {
        for (let i = 0; i < zone.pushables.length; i++) {
            const p = zone.pushables[i];
            if (p.initCol !== undefined) {
                p.col = p.initCol;
                p.row = p.initRow;
                p.sliding = false;
            }
        }
    }
    if (zoneId === 'piazza' && !getFlag('piazza_puzzle_complete') && zone.pushables) {
        for (let i = 0; i < zone.pushables.length; i++) {
            const p = zone.pushables[i];
            if (p.initCol !== undefined) {
                p.col = p.initCol;
                p.row = p.initRow;
                p.sliding = false;
            }
        }
    }

    // Re-spawn items from crates that were already revealed but not yet collected
    if (zone.pushables) {
        for (let i = 0; i < zone.pushables.length; i++) {
            const p = zone.pushables[i];
            if (p.contentsRevealed && p.contents && !hasItem(p.contents)) {
                spawnWorldItem(p.id + '_item', p.revealCol, p.revealRow, p.contents);
            }
        }
    }

    // Use provided spawn or zone default
    const col = spawnCol !== undefined ? spawnCol : zone.spawnX;
    const row = spawnRow !== undefined ? spawnRow : zone.spawnY;
    player.x = col * CONFIG.TILE_SIZE + 2; // +2 to center in tile (player is TILE_SIZE-4 wide)
    player.y = row * CONFIG.TILE_SIZE + 2;

    // Restore bridge state if entering Canal with bridge already built
    if (zoneId === 'canal') {
        restoreBridgeState();
    }
    // Restore piazza path if puzzle already completed
    if (zoneId === 'piazza') {
        restorePiazzaState();
    }
    // Restore pizzeria sauce room door if boss defeated
    if (zoneId === 'pizzeria') {
        restoreSauceRoomDoor();
    }

    // Snap camera instantly to player (no lerp on zone load)
    const mapW = zone.map[0].length * CONFIG.TILE_SIZE;
    const mapH = zone.map.length * CONFIG.TILE_SIZE;
    game.cameraX = player.x + player.w / 2 - CONFIG.CANVAS_W / 2;
    game.cameraY = player.y + player.h / 2 - CONFIG.CANVAS_H / 2;
    if (mapW <= CONFIG.CANVAS_W) { game.cameraX = (mapW - CONFIG.CANVAS_W) / 2; }
    else { game.cameraX = Math.max(0, Math.min(game.cameraX, mapW - CONFIG.CANVAS_W)); }
    if (mapH <= CONFIG.CANVAS_H) { game.cameraY = (mapH - CONFIG.CANVAS_H) / 2; }
    else { game.cameraY = Math.max(0, Math.min(game.cameraY, mapH - CONFIG.CANVAS_H)); }

    // Initialize Brodo's position at player spawn
    initBrodo();

    // Initialize library cat mini-boss
    if (zoneId === 'library') {
        initLibraryBroom();
    } else {
        libraryBroom.active = false;
    }

    // Load hidden items for this zone
    loadHiddenItems(zoneId);

    // Load enemies for this zone
    loadEnemies(zoneId);

    // Load power-up pickups for this zone (respawn on every zone entry)
    loadPowerups(zoneId);

    // Start zone music (crossfades from previous zone if any)
    startZoneMusic(zoneId);

    // Schedule Papa Marco auto-intro for first visit (0.5s delay for zone to settle)
    papaHints.autoCallPending = zoneId;
    papaHints.autoCallDelay = 0.5;
}

/** Checks if the player is standing on a transition tile. If so, loads the target zone. */
function checkTransitions() {
    const zone = game.currentZone;
    if (!zone || !zone.transitions) return;
    // Block transitions during boss fight
    if (enzoBoss.active) return;
    // Cooldown: skip check for a few frames after a zone load
    if (game.transitionCooldown > 0) {
        game.transitionCooldown--;
        return;
    }
    const ts = CONFIG.TILE_SIZE;
    // Player center tile
    const playerCol = Math.floor((player.x + player.w / 2) / ts);
    const playerRow = Math.floor((player.y + player.h / 2) / ts);

    for (let i = 0; i < zone.transitions.length; i++) {
        const t = zone.transitions[i];
        if (playerCol === t.col && playerRow === t.row) {
            playDoorOpen();

            // Trigger drum solo interlude when leaving the gym with recipe #3
            if (zone.id === 'gym' && getFlag('recipe_3_found') && !getFlag('drum_solo_completed')) {
                // Store where the player was going so we return there after
                game.drumReturnZone = t.target;
                game.drumReturnSpawnX = t.spawnX;
                game.drumReturnSpawnY = t.spawnY;
                startDrumSolo();
                return;
            }

            loadZone(t.target, t.spawnX, t.spawnY);
            return;
        }
    }
}

// ============================================================
// Pushable objects
// ============================================================

/** Returns the pushable at a given tile (col, row) in the current zone, or null. */
function getPushableAt(col, row) {
    const zone = game.currentZone;
    if (!zone || !zone.pushables) return null;
    for (let i = 0; i < zone.pushables.length; i++) {
        if (zone.pushables[i].col === col && zone.pushables[i].row === row) {
            return zone.pushables[i];
        }
    }
    return null;
}

/** Checks if a tile is occupied by an NPC. */
function isNPCAt(col, row) {
    const zone = game.currentZone;
    if (!zone || !zone.npcs) return false;
    for (let i = 0; i < zone.npcs.length; i++) {
        if (zone.npcs[i].col === col && zone.npcs[i].row === row) return true;
    }
    return false;
}

/** Tries to push a pushable one tile in a direction. Returns true if it moved. */
function tryPush(pushable, dirCol, dirRow) {
    // Don't push if already sliding
    if (pushable.sliding) return false;

    const targetCol = pushable.col + dirCol;
    const targetRow = pushable.row + dirRow;
    const map = game.currentMap;

    // Check: target tile must be walkable
    if (getTile(map, targetCol, targetRow).solid) return false;
    // Check: no other pushable at target
    if (getPushableAt(targetCol, targetRow)) return false;
    // Check: no NPC at target
    if (isNPCAt(targetCol, targetRow)) return false;

    // Spawn hidden item when crate with contents is first pushed
    const ts = CONFIG.TILE_SIZE;
    if (pushable.contents && !pushable.contentsRevealed) {
        pushable.contentsRevealed = true;
        pushable.revealCol = pushable.col; // remember where item was revealed
        pushable.revealRow = pushable.row;
        spawnWorldItem(pushable.id + '_item', pushable.col, pushable.row, pushable.contents);
    }

    // Start visual position from current grid position
    pushable.visualX = pushable.col * ts;
    pushable.visualY = pushable.row * ts;
    pushable.sliding = true;

    // Move logical position immediately (so collision is correct)
    pushable.col = targetCol;
    pushable.row = targetRow;

    // Crate push SFX
    playCratePush();

    // Check if heart puzzle is complete after this push
    checkHeartPuzzle();
    // Check if piazza puzzle is complete after this push
    checkPiazzaPuzzle();

    return true;
}

/** Renders "[Shift] Pull" prompt when player faces a pushable crate. */
function renderPullPrompt(ctx, cameraX, cameraY) {
    if (dialogue.active || game.showScrollOverlay) return;
    var pushable = getFacingPushable();
    if (!pushable) return;
    var ts = CONFIG.TILE_SIZE;
    var sx = pushable.col * ts - cameraX + ts / 2;
    var sy = pushable.row * ts - cameraY - 8;
    ctx.fillStyle = '#aaccff';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[Shift] Pull', sx, sy);
}

/** Returns the pushable the player is facing and adjacent to, or null. */
function getFacingPushable() {
    var ts = CONFIG.TILE_SIZE;
    var pcol = Math.floor((player.x + player.w / 2) / ts);
    var prow = Math.floor((player.y + player.h / 2) / ts);
    var targetCol = pcol, targetRow = prow;
    if (player.facing === 'up')    targetRow--;
    else if (player.facing === 'down')  targetRow++;
    else if (player.facing === 'left')  targetCol--;
    else if (player.facing === 'right') targetCol++;
    return getPushableAt(targetCol, targetRow);
}

/** Tries to pull a pushable one tile toward the player's current position. Returns true if it moved. */
function tryPull(pushable) {
    if (pushable.sliding) return false;
    var ts = CONFIG.TILE_SIZE;
    // Pull direction: crate moves toward where the player currently is
    var pcol = Math.floor((player.x + player.w / 2) / ts);
    var prow = Math.floor((player.y + player.h / 2) / ts);
    var dirCol = pcol - pushable.col;
    var dirRow = prow - pushable.row;
    // Normalize to -1/0/1
    if (dirCol > 1) dirCol = 1; if (dirCol < -1) dirCol = -1;
    if (dirRow > 1) dirRow = 1; if (dirRow < -1) dirRow = -1;
    if (dirCol === 0 && dirRow === 0) return false;

    var targetCol = pushable.col + dirCol;
    var targetRow = pushable.row + dirRow;
    var map = game.currentMap;
    // Same checks as push
    if (getTile(map, targetCol, targetRow).solid) return false;
    if (getPushableAt(targetCol, targetRow)) return false;
    if (isNPCAt(targetCol, targetRow)) return false;

    // Start slide animation
    pushable.visualX = pushable.col * ts;
    pushable.visualY = pushable.row * ts;
    pushable.sliding = true;
    pushable.col = targetCol;
    pushable.row = targetRow;
    playCratePush();
    checkHeartPuzzle();
    checkPiazzaPuzzle();
    return true;
}

/** Updates smooth slide animation for all pushables. Uses lerp for heavy, decelerating feel. */
function updatePushables() {
    const zone = game.currentZone;
    if (!zone || !zone.pushables) return;
    const ts = CONFIG.TILE_SIZE;
    const lerp = CONFIG.PUSH_SLIDE_LERP;

    for (let i = 0; i < zone.pushables.length; i++) {
        const p = zone.pushables[i];
        if (!p.sliding) continue;

        const targetX = p.col * ts;
        const targetY = p.row * ts;

        // Lerp toward target (decelerates naturally — feels heavy)
        p.visualX += (targetX - p.visualX) * lerp;
        p.visualY += (targetY - p.visualY) * lerp;

        // Snap when close enough (sub-pixel)
        if (Math.abs(targetX - p.visualX) < 0.5 && Math.abs(targetY - p.visualY) < 0.5) {
            p.visualX = targetX;
            p.visualY = targetY;
            p.sliding = false;
        }
    }
}

/** Checks if the player's intended movement would collide with a pushable. If so, tries to push it. Returns true if blocked. */
function checkPushableCollision(newX, newY, pw, ph, dirCol, dirRow) {
    const ts = CONFIG.TILE_SIZE;
    // Find which tiles the player would overlap
    const left   = Math.floor(newX / ts);
    const right  = Math.floor((newX + pw - 1) / ts);
    const top    = Math.floor(newY / ts);
    const bottom = Math.floor((newY + ph - 1) / ts);

    for (let row = top; row <= bottom; row++) {
        for (let col = left; col <= right; col++) {
            const pushable = getPushableAt(col, row);
            if (pushable) {
                // Try to push it
                tryPush(pushable, dirCol, dirRow);
                // Block player regardless (pushed or not — player doesn't overlap crate)
                return true;
            }
        }
    }
    return false;
}

/** Renders all pushable objects in the current zone. */
/** Renders pushable objects using type-specific sprites (crate, bench, planter). */
function renderPushables(ctx, cameraX, cameraY) {
    const zone = game.currentZone;
    if (!zone || !zone.pushables) return;
    const ts = CONFIG.TILE_SIZE;

    for (let i = 0; i < zone.pushables.length; i++) {
        const p = zone.pushables[i];
        // Use visual position when sliding, grid position otherwise
        const px = p.sliding ? p.visualX : p.col * ts;
        const py = p.sliding ? p.visualY : p.row * ts;
        const screenX = px - cameraX;
        const screenY = py - cameraY;

        // Pick sprite based on pushable type
        var sprite = SPRITES.objects[p.type] || SPRITES.objects.crate;
        if (sprite) {
            ctx.drawImage(sprite, screenX, screenY);
        } else {
            ctx.fillStyle = CONFIG.CRATE_COLOR;
            ctx.fillRect(screenX + 1, screenY + 1, ts - 2, ts - 2);
        }
    }
}

// ============================================================
// Heart puzzle — arrange crates into heart shape (Market zone)
// ============================================================

/** Checks if all heart target positions have a crate on them. If so, completes the puzzle. */
function checkHeartPuzzle() {
    if (getFlag('recipe_1_found')) return;
    if (!getFlag('has_market_scroll')) return;
    if (!game.currentZone || game.currentZone.id !== 'market') return;

    var targets = CONFIG.HEART_TARGETS;
    for (var i = 0; i < targets.length; i++) {
        if (!getPushableAt(targets[i].col, targets[i].row)) return; // missing a crate
    }

    // All targets filled — puzzle complete! Spawn recipe at heart center.
    setFlag('heart_puzzle_complete', true);
    spawnWorldItem('heart_recipe', 4, 10, 'recipe_1');
    // SFX cue — the standard pickup flash + "Found!" happens when player walks over the recipe
    playItemPickup();
}

/** Renders golden pulsing markers on the heart target tiles. */
function renderTargetMarkers(ctx, cameraX, cameraY) {
    if (!getFlag('has_market_scroll')) return;
    if (getFlag('recipe_1_found')) return;
    if (!game.currentZone || game.currentZone.id !== 'market') return;

    var ts = CONFIG.TILE_SIZE;
    var targets = CONFIG.HEART_TARGETS;
    var pulse = 0.2 + Math.sin(game.time * 2.5) * 0.1; // alpha oscillates 0.1–0.3

    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var sx = t.col * ts - cameraX;
        var sy = t.row * ts - cameraY;

        // Check if a crate is already on this target
        var filled = !!getPushableAt(t.col, t.row);

        if (filled) {
            // Green glow for filled targets
            ctx.fillStyle = 'rgba(0, 255, 100, ' + (pulse * 0.6) + ')';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
        } else {
            // Golden pulsing outline for empty targets
            ctx.fillStyle = 'rgba(255, 215, 0, ' + pulse + ')';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);

            // Dashed border
            ctx.strokeStyle = 'rgba(255, 215, 0, ' + (pulse + 0.15) + ')';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(sx + 3, sy + 3, ts - 6, ts - 6);
            ctx.setLineDash([]);

            // Small diamond in center
            var cx = sx + ts / 2;
            var cy = sy + ts / 2;
            ctx.fillStyle = 'rgba(255, 235, 59, ' + (pulse + 0.15) + ')';
            ctx.beginPath();
            ctx.moveTo(cx, cy - 5);
            ctx.lineTo(cx + 5, cy);
            ctx.lineTo(cx, cy + 5);
            ctx.lineTo(cx - 5, cy);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// ============================================================
// Bridge build mechanic — place planks on bridge gaps (Canal zone)
// ============================================================

/** Bridge gap positions in the Canal zone. */
const BRIDGE_GAPS = [
    { col: 14, row: 10 },
    { col: 15, row: 10 },
];

/** Returns the bridge gap tile the player is facing, or null. */
function getFacingBridgeGap() {
    if (!game.currentZone || game.currentZone.id !== 'canal') return null;
    if (getFlag('bridge_complete')) return null;
    var ts = CONFIG.TILE_SIZE;
    var pcol = Math.floor((player.x + player.w / 2) / ts);
    var prow = Math.floor((player.y + player.h / 2) / ts);
    var fcol = pcol, frow = prow;
    switch (player.facing) {
        case 'up':    frow--; break;
        case 'down':  frow++; break;
        case 'left':  fcol--; break;
        case 'right': fcol++; break;
    }
    var tile = getTile(game.currentMap, fcol, frow);
    if (tile === TILES.BRIDGEGAP && !getFlag('bridge_plank_' + fcol + '_' + frow)) {
        return { col: fcol, row: frow };
    }
    return null;
}

/** Places a plank on a bridge gap tile. Consumes one plank from inventory. */
function placeBridgePlank(col, row) {
    var plankId = getFirstPlank();
    if (!plankId) return;
    removeFromInventory(plankId);
    setFlag('bridge_plank_' + col + '_' + row, true);
    playPlankPlace();

    // Check if all gaps now have planks
    var allFilled = true;
    for (var i = 0; i < BRIDGE_GAPS.length; i++) {
        var g = BRIDGE_GAPS[i];
        if (!getFlag('bridge_plank_' + g.col + '_' + g.row)) {
            allFilled = false;
            break;
        }
    }
    if (allFilled) {
        completeBridge();
    }
}

/** Converts all bridge gap tiles to walkable PLANK tiles. Celebration effect. */
function completeBridge() {
    var map = ZONES.canal.map;
    for (var i = 0; i < BRIDGE_GAPS.length; i++) {
        var g = BRIDGE_GAPS[i];
        map[g.row][g.col] = TILES.PLANK.id;
    }
    setFlag('bridge_complete', true);
    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
    game.itemFlashName = 'Bridge Repaired!';
    playItemPickup();
}

/** Restores bridge state from quest flags when loading the Canal zone. */
function restoreBridgeState() {
    if (!getFlag('bridge_complete')) return;
    var map = ZONES.canal.map;
    for (var i = 0; i < BRIDGE_GAPS.length; i++) {
        var g = BRIDGE_GAPS[i];
        map[g.row][g.col] = TILES.PLANK.id;
    }
}

/** Renders plank visuals on bridge gaps that have a plank placed but bridge not yet complete. */
/** Renders placed bridge planks using plank sprite. */
function renderPlacedBridgePlanks(ctx, cameraX, cameraY) {
    if (getFlag('bridge_complete')) return;
    if (!game.currentZone || game.currentZone.id !== 'canal') return;
    var ts = CONFIG.TILE_SIZE;
    var plankSprite = SPRITES.tiles.plank;

    for (var i = 0; i < BRIDGE_GAPS.length; i++) {
        var g = BRIDGE_GAPS[i];
        if (!getFlag('bridge_plank_' + g.col + '_' + g.row)) continue;
        var sx = g.col * ts - Math.round(cameraX);
        var sy = g.row * ts - Math.round(cameraY);
        if (plankSprite) {
            ctx.drawImage(plankSprite, sx, sy, ts, ts);
        } else {
            ctx.fillStyle = TILES.PLANK.color;
            ctx.fillRect(sx, sy, ts, ts);
        }
    }
}

/** Renders pulsing markers on unfilled bridge gaps so the player can find them. */
function renderBridgeGapMarkers(ctx, cameraX, cameraY) {
    if (getFlag('bridge_complete')) return;
    if (!game.currentZone || game.currentZone.id !== 'canal') return;
    if (!getFirstPlank()) return; // only show when player has planks

    var ts = CONFIG.TILE_SIZE;
    var pulse = 0.25 + Math.sin(game.time * 2.5) * 0.15;

    for (var i = 0; i < BRIDGE_GAPS.length; i++) {
        var g = BRIDGE_GAPS[i];
        if (getFlag('bridge_plank_' + g.col + '_' + g.row)) continue; // already filled
        var sx = g.col * ts - Math.round(cameraX);
        var sy = g.row * ts - Math.round(cameraY);

        // Pulsing golden outline over the gap
        ctx.strokeStyle = 'rgba(255, 215, 0, ' + (pulse + 0.2) + ')';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(sx + 2, sy + 2, ts - 4, ts - 4);
        ctx.setLineDash([]);

        // Plank icon hint in center
        ctx.fillStyle = 'rgba(196, 164, 108, ' + pulse + ')';
        ctx.fillRect(sx + 6, sy + ts / 2 - 4, ts - 12, 8);
        ctx.strokeStyle = 'rgba(139, 105, 20, ' + pulse + ')';
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + 6, sy + ts / 2 - 4, ts - 12, 8);
    }
}

/** Renders "[Z] Place Plank" prompt when player faces a bridge gap with planks in inventory. */
function renderBridgePrompt(ctx, cameraX, cameraY) {
    if (getFlag('bridge_complete')) return;
    if (!game.currentZone || game.currentZone.id !== 'canal') return;
    if (!getFirstPlank()) return;
    if (dialogue.active || game.showScrollOverlay) return;

    var gap = getFacingBridgeGap();
    if (!gap) return;

    var ts = CONFIG.TILE_SIZE;
    var sx = gap.col * ts - cameraX + ts / 2;
    var sy = gap.row * ts - cameraY - 8;
    ctx.fillStyle = '#ffd54f';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('[Z] Place Plank', sx, sy);
}

// ============================================================
// Piazza build puzzle — arrange benches/planters on fill targets
// ============================================================

/** Checks if all Piazza fill target positions have a pushable on them. If so, unlocks east path. */
function checkPiazzaPuzzle() {
    if (getFlag('piazza_puzzle_complete')) return;
    if (!game.currentZone || game.currentZone.id !== 'piazza') return;

    var targets = CONFIG.PIAZZA_TARGETS;
    for (var i = 0; i < targets.length; i++) {
        if (!getPushableAt(targets[i].col, targets[i].row)) return;
    }

    // All targets filled — unlock east passage to Zone 6
    setFlag('piazza_puzzle_complete', true);
    completePiazzaPath();
    game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
    game.itemFlashName = 'Path Opened!';
    playItemPickup();
}

/** Converts fill target tiles to walkable cobble and adds Zone 6 transition tiles. */
function completePiazzaPath() {
    var map = ZONES.piazza.map;
    // Convert fill targets to walkable cobble
    var targets = CONFIG.PIAZZA_TARGETS;
    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        map[t.row][t.col] = _CB;
    }
    // Also open the adjacent wall tiles to create passage
    map[10][26] = _CB;
    map[11][26] = _CB;
    map[12][26] = _CB;
    map[13][26] = _CB;
    // Open the east wall for passage
    map[10][27] = _CB;
    map[11][27] = _CB;
    map[12][27] = _CB;
    map[13][27] = _CB;
    map[10][28] = D;
    map[11][28] = D;
    map[12][28] = D;
    map[13][28] = D;
    map[10][29] = D;
    map[11][29] = D;
    map[12][29] = D;
    map[13][29] = D;
}

/** Restores Piazza puzzle state (converts tiles back to walkable) if already completed. */
function restorePiazzaState() {
    if (!getFlag('piazza_puzzle_complete')) return;
    completePiazzaPath();
}

/** Opens the sauce machine room door in Enzo's Pizzeria if boss is defeated. */
function restoreSauceRoomDoor() {
    if (!getFlag('enzo_boss_defeated')) return;
    var map = ZONES.pizzeria.map;
    map[9][22] = D;
    map[10][22] = D;
}

/** Renders pulsing target markers on Piazza fill target tiles. */
function renderPiazzaTargetMarkers(ctx, cameraX, cameraY) {
    if (getFlag('piazza_puzzle_complete')) return;
    if (!game.currentZone || game.currentZone.id !== 'piazza') return;

    var ts = CONFIG.TILE_SIZE;
    var targets = CONFIG.PIAZZA_TARGETS;
    var pulse = 0.2 + Math.sin(game.time * 2.5) * 0.1;

    for (var i = 0; i < targets.length; i++) {
        var t = targets[i];
        var sx = t.col * ts - cameraX;
        var sy = t.row * ts - cameraY;
        var filled = !!getPushableAt(t.col, t.row);

        if (filled) {
            ctx.fillStyle = 'rgba(0, 255, 100, ' + (pulse * 0.6) + ')';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
        } else {
            ctx.fillStyle = 'rgba(255, 215, 0, ' + pulse + ')';
            ctx.fillRect(sx + 1, sy + 1, ts - 2, ts - 2);
            ctx.strokeStyle = 'rgba(255, 215, 0, ' + (pulse + 0.15) + ')';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(sx + 3, sy + 3, ts - 6, ts - 6);
            ctx.setLineDash([]);
            var cx2 = sx + ts / 2;
            var cy2 = sy + ts / 2;
            ctx.fillStyle = 'rgba(255, 235, 59, ' + (pulse + 0.15) + ')';
            ctx.beginPath();
            ctx.moveTo(cx2, cy2 - 5);
            ctx.lineTo(cx2 + 5, cy2);
            ctx.lineTo(cx2, cy2 + 5);
            ctx.lineTo(cx2 - 5, cy2);
            ctx.closePath();
            ctx.fill();
        }
    }
}

// ============================================================
// Interactable objects — BMX bike, puzzles, etc.
// ============================================================

/** Finds the nearest interactable object within interaction radius. Returns the object or null. */
function findNearbyObject() {
    var zone = game.currentZone;
    if (!zone || !zone.objects) return null;
    var ts = CONFIG.TILE_SIZE;
    var pcx = player.x + player.w / 2;
    var pcy = player.y + player.h / 2;
    var radius = CONFIG.NPC_INTERACT_RADIUS;

    for (var i = 0; i < zone.objects.length; i++) {
        var obj = zone.objects[i];
        // Skip objects that are hidden after completion
        if (obj.id === 'bmx_bike' && getFlag('bmx_completed')) continue;
        if (obj.id === 'nokia_3210' && getFlag('nokia_solved')) continue;
        if (obj.id === 'kitchen_spatula' && hasItem('spatula')) continue;
        if (obj.id === 'kitchen_flour' && hasItem('flour')) continue;
        if (obj.id === 'market_tomato' && hasItem('tomato')) continue;
        if (obj.id === 'market_banana' && hasItem('banana')) continue;
        var ocx = obj.col * ts + ts / 2;
        var ocy = obj.row * ts + ts / 2;
        var dx = pcx - ocx;
        var dy = pcy - ocy;
        if (dx * dx + dy * dy <= radius * radius) {
            return obj;
        }
    }
    return null;
}

/** Renders all interactable objects using pre-generated sprites. */
function renderObjects(ctx, cameraX, cameraY) {
    var zone = game.currentZone;
    if (!zone || !zone.objects) return;
    var ts = CONFIG.TILE_SIZE;

    for (var i = 0; i < zone.objects.length; i++) {
        var obj = zone.objects[i];
        // Skip hidden objects
        if (obj.id === 'bmx_bike' && getFlag('bmx_completed')) continue;
        if (obj.id === 'nokia_3210' && getFlag('nokia_solved')) continue;
        if (obj.id === 'kitchen_spatula' && hasItem('spatula')) continue;
        if (obj.id === 'kitchen_flour' && hasItem('flour')) continue;
        if (obj.id === 'market_tomato' && hasItem('tomato')) continue;
        if (obj.id === 'market_banana' && hasItem('banana')) continue;

        var screenX = obj.col * ts - cameraX;
        var screenY = obj.row * ts - cameraY;

        // Map object IDs to sprite keys
        var spriteKey = null;
        if (obj.id === 'bmx_bike') spriteKey = 'bmx';
        else if (obj.id === 'nokia_3210') spriteKey = 'nokia';
        else if (obj.id === 'nes_cartridge') spriteKey = 'cartridge';
        else if (obj.id === 'market_tomato') spriteKey = 'market_tomato';
        else if (obj.id === 'market_banana') spriteKey = 'market_banana';
        else if (obj.id === 'kitchen_spatula') spriteKey = 'kitchen_spatula';
        else if (obj.id === 'kitchen_flour') spriteKey = 'kitchen_flour';
        else if (obj.id && obj.id.startsWith('bookshelf')) spriteKey = 'bookshelf';
        else if (obj.id === 'papa_competition_form') spriteKey = 'papa_form';
        else if (obj.id === 'gym_tamagotchi') spriteKey = 'tamagotchi';
        else if (obj.id === 'gym_punching_bag') spriteKey = 'punching_bag';

        if (spriteKey && SPRITES.objects[spriteKey]) {
            ctx.drawImage(SPRITES.objects[spriteKey], screenX, screenY);
        } else {
            // Generic object — colored square with detail
            ctx.fillStyle = obj.color || '#aaaaaa';
            ctx.fillRect(screenX + 4, screenY + 4, ts - 8, ts - 8);
            ctx.strokeStyle = 'rgba(255,255,255,0.3)';
            ctx.lineWidth = 1;
            ctx.strokeRect(screenX + 4, screenY + 4, ts - 8, ts - 8);
        }

        // Name label
        ctx.fillStyle = '#ffffff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(obj.name, screenX + ts / 2, screenY - 4);
    }

    // Interaction prompt
    if (!dialogue.active) {
        var nearby = findNearbyObject();
        if (nearby) {
            var sx = nearby.col * ts - cameraX + ts / 2;
            var sy = nearby.row * ts - cameraY - 16;
            ctx.fillStyle = '#ffd54f';
            ctx.font = 'bold 12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('[Z] Use', sx, sy);
        }
    }
}

// ============================================================
// World items — items sitting on the ground, collectible
// ============================================================

/** Active world items in the current zone. Array of {id, col, row, itemId, collected}. */
let worldItems = [];

/** Spawns a world item at a tile position. */
function spawnWorldItem(id, col, row, itemId) {
    // Don't spawn if already collected via quest flag
    if (hasItem(itemId)) return;
    worldItems.push({ id: id, col: col, row: row, itemId: itemId, collected: false, bobTimer: 0 });
}

/** Checks if the player is near any uncollected world item and picks it up. */
function checkItemPickup() {
    if (dialogue.active) return; // don't pick up items during dialogue
    const ts = CONFIG.TILE_SIZE;
    const pcx = player.x + player.w / 2;
    const pcy = player.y + player.h / 2;
    const radius = CONFIG.ITEM_PICKUP_RADIUS;

    for (let i = 0; i < worldItems.length; i++) {
        const item = worldItems[i];
        if (item.collected) continue;
        const icx = item.col * ts + ts / 2;
        const icy = item.row * ts + ts / 2;
        const dx = pcx - icx;
        const dy = pcy - icy;
        if (dx * dx + dy * dy <= radius * radius) {
            pickupItem(item);
            return;
        }
    }

    // Also check interact key for slightly further items
    if (actionJustPressed('interact') && !dialogue.active) {
        const interactRadius = CONFIG.NPC_INTERACT_RADIUS;
        for (let i = 0; i < worldItems.length; i++) {
            const item = worldItems[i];
            if (item.collected) continue;
            const icx = item.col * ts + ts / 2;
            const icy = item.row * ts + ts / 2;
            const dx = pcx - icx;
            const dy = pcy - icy;
            if (dx * dx + dy * dy <= interactRadius * interactRadius) {
                pickupItem(item);
                return;
            }
        }
    }
}

/** Picks up a world item: adds to inventory, sets quest flag, triggers flash. */
function pickupItem(item) {
    if (addToInventory(item.itemId)) {
        item.collected = true;
        // Set quest flag for recipe fragments
        if (item.itemId.startsWith('recipe_')) {
            setFlag(item.itemId + '_found', true);
        }
        // Trigger visual flash + pickup SFX
        game.itemFlash = CONFIG.ITEM_FLASH_DURATION;
        game.itemFlashName = ITEMS[item.itemId] ? ITEMS[item.itemId].name : item.itemId;
        playItemPickup();
    }
}

/** Updates world item animations (bobbing). */
function updateWorldItems(dt) {
    for (let i = 0; i < worldItems.length; i++) {
        if (!worldItems[i].collected) {
            worldItems[i].bobTimer += dt;
        }
    }
}

/** Renders uncollected world items with sprites, glow, and sparkle effects. */
function renderWorldItems(ctx, cameraX, cameraY) {
    const ts = CONFIG.TILE_SIZE;

    for (let i = 0; i < worldItems.length; i++) {
        const item = worldItems[i];
        if (item.collected) continue;
        const itemDef = ITEMS[item.itemId];
        if (!itemDef) continue;

        const baseX = item.col * ts - cameraX;
        const baseY = item.row * ts - cameraY;

        // Bobbing effect
        const bob = Math.sin(item.bobTimer * 3) * 3;
        const cx = baseX + ts / 2;
        const cy = baseY + ts / 2 + bob;

        // Glow circle (bloom effect)
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(255, 235, 59, 0.15)';
        ctx.beginPath();
        ctx.arc(cx, cy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Item sprite lookup: try recipe first, then item type
        var spriteKey = item.itemId;
        if (spriteKey.startsWith('recipe_')) spriteKey = 'recipe';
        if (spriteKey.startsWith('plank_')) spriteKey = 'plank';
        var sprite = SPRITES.items[spriteKey];

        if (sprite) {
            ctx.drawImage(sprite, cx - sprite.width / 2, cy - sprite.height / 2);
        } else {
            // Fallback: diamond shape
            ctx.fillStyle = itemDef.color;
            ctx.beginPath();
            ctx.moveTo(cx, cy - 10);
            ctx.lineTo(cx + 8, cy);
            ctx.lineTo(cx, cy + 10);
            ctx.lineTo(cx - 8, cy);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#000';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(itemDef.icon, cx, cy + 3);
        }

        // Sparkle particles
        for (let s = 0; s < 3; s++) {
            const angle = item.bobTimer * 2 + (s * Math.PI * 2 / 3);
            const sr = 16 + Math.sin(item.bobTimer * 4 + s) * 3;
            const sx = cx + Math.cos(angle) * sr;
            const sy = cy + Math.sin(angle) * sr;
            ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.5 + Math.sin(item.bobTimer * 5 + s) * 0.5) + ')';
            ctx.fillRect(sx - 1, sy - 1, 3, 3);
        }
    }
}
