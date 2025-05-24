class Platformer extends Phaser.Scene {
    constructor() {
        super("platformerScene");
    }

    init() {
        this.ACCELERATION = 200;
        this.DRAG = 6000;
        this.VELOCITY = 250;
        this.physics.world.gravity.y = 1500;
        this.JUMP_VELOCITY = -500;
        this.PARTICLE_VELOCITY = 50;
        this.SCALE = 2.0;

        this.VELOCITY_CLIMB = 130;
        this.CLIMB_IDLE_DROP_SPEED = 35;

        this.onLadder = false;

        // health stuff
        this.healthValue = 10;
        this.coolDown = 0;

        this.teleportCooldown = 0;

        this.moneyCount = 0;
        this.frameCount = 0;
        this.stopwatchTime = 0;
    }

    create() {
        // Tilemap & Tileset
        this.map = this.add.tilemap("platformer-level-1", 16, 16, 45, 25);
        this.tileset = this.map.addTilesetImage("monochrome_tilemap_packed", "tilemap_tiles");

        // Draw layers (in correct order)
        this.groundLayer = this.map.createLayer("Ground-n-Platforms", this.tileset, 0, 0);
        this.ladderLayer = this.map.createLayer("ladder", this.tileset, 0, 0);
        this.spikeLayer = this.map.createLayer("spikes", this.tileset, 0, 0);

        // Set collisions by properties set in Tiled
        this.groundLayer.setCollisionByProperty({ collides: true });
        this.spikeLayer.setCollisionByProperty({ spike: true });

        // Coins
        this.coins = this.map.createFromObjects("Objects", {
            name: "coin",
            key: "tilemap_sheet",
            frame: 151
        });
        this.physics.world.enable(this.coins, Phaser.Physics.Arcade.STATIC_BODY);
        this.coinGroup = this.add.group(this.coins);

        // Player setup
        my.sprite.player = this.physics.add.sprite(30, 210, "platformer_characters", "tile_0000.png");
        my.sprite.player.setCollideWorldBounds(true);

        // Physics interactions
        this.physics.add.collider(my.sprite.player, this.groundLayer);
        this.physics.add.collider(my.sprite.player, this.spikeLayer, () => {
            this.playerDie();
        });
        this.physics.add.overlap(my.sprite.player, this.coinGroup, (obj1, obj2) => {
            obj2.destroy();
        });

        // Controls
        cursors = this.input.keyboard.createCursorKeys();
        this.rKey = this.input.keyboard.addKey('R');

        // Debug toggle
        this.input.keyboard.on('keydown-D', () => {
            this.physics.world.drawDebug = !this.physics.world.drawDebug;
            this.physics.world.debugGraphic.clear();
        });

        // Particles
        my.vfx.walking = this.add.particles(0, 0, "kenny-particles", {
            frame: ['smoke_03.png', 'smoke_09.png'],
            scale: { start: 0.03, end: 0.1 },
            lifespan: 350,
            alpha: { start: 1, end: 0.1 },
        });
        my.vfx.walking.stop();

        // Camera
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        this.cameras.main.startFollow(my.sprite.player, true, 0.25, 0.25);
        this.cameras.main.setDeadzone(50, 50);
        this.cameras.main.setZoom(this.SCALE);
    }

    update() {
        // Check if player is on a ladder tile
        let playerTile = this.map.getTileAtWorldXY(
            my.sprite.player.x,
            my.sprite.player.y,
            true,
            this.cameras.main,
            this.ladderLayer
        );

        // Determine if player is on ladder based on tile and player position
        if (playerTile && playerTile.properties.ladder) {
            this.onLadder = true;
        } else {
            this.onLadder = false;
        }

        if (this.onLadder) {
            // Disable gravity while on ladder
            my.sprite.player.body.setAllowGravity(false);
            my.sprite.player.setAccelerationX(0);
            my.sprite.player.setDragX(this.DRAG);

            // Vertical climbing
            if (cursors.up.isDown) {
                my.sprite.player.setVelocityY(-this.VELOCITY_CLIMB);
                my.sprite.player.anims.play('climb', true);
            } else if (cursors.down.isDown) {
                my.sprite.player.setVelocityY(this.VELOCITY_CLIMB);
                my.sprite.player.anims.play('climb', true);
            } else {
                // Idle on ladder: slow slide down
                my.sprite.player.setVelocityY(this.CLIMB_IDLE_DROP_SPEED);
                my.sprite.player.anims.play('climb_idle', true);
            }

            // --- NEW: Allow horizontal movement while on ladder ---
            if (cursors.left.isDown) {
                my.sprite.player.setVelocityX(-this.VELOCITY);
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                // Exit ladder if moving off ladder tile horizontally
                // We'll check if next position is still ladder tile
                let nextTile = this.map.getTileAtWorldXY(
                    my.sprite.player.x - 2,  // slightly left
                    my.sprite.player.y,
                    true,
                    this.cameras.main,
                    this.ladderLayer
                );
                if (!nextTile || !nextTile.properties.ladder) {
                    this.onLadder = false;
                    my.sprite.player.body.setAllowGravity(true);
                }
            } else if (cursors.right.isDown) {
                my.sprite.player.setVelocityX(this.VELOCITY);
                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);
                // Exit ladder if moving off ladder tile horizontally
                let nextTile = this.map.getTileAtWorldXY(
                    my.sprite.player.x + 2,  // slightly right
                    my.sprite.player.y,
                    true,
                    this.cameras.main,
                    this.ladderLayer
                );
                if (!nextTile || !nextTile.properties.ladder) {
                    this.onLadder = false;
                    my.sprite.player.body.setAllowGravity(true);
                }
            } else {
                // No horizontal input on ladder
                my.sprite.player.setVelocityX(0);
            }
        } else {
            // Normal gravity and controls when NOT on ladder
            my.sprite.player.body.setAllowGravity(true);

            if (cursors.left.isDown) {
                my.sprite.player.setAccelerationX(-this.ACCELERATION);
                my.sprite.player.resetFlip();
                my.sprite.player.anims.play('walk', true);
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                if (my.sprite.player.body.blocked.down) my.vfx.walking.start();
            } else if (cursors.right.isDown) {
                my.sprite.player.setAccelerationX(this.ACCELERATION);
                my.sprite.player.setFlip(true, false);
                my.sprite.player.anims.play('walk', true);
                my.vfx.walking.startFollow(my.sprite.player, my.sprite.player.displayWidth / 2 - 10, my.sprite.player.displayHeight / 2 - 5, false);
                my.vfx.walking.setParticleSpeed(this.PARTICLE_VELOCITY, 0);
                if (my.sprite.player.body.blocked.down) my.vfx.walking.start();
            } else {
                my.sprite.player.setAccelerationX(0);
                my.sprite.player.setDragX(this.DRAG);
                my.sprite.player.anims.play('idle');
                my.vfx.walking.stop();
            }

            if (!my.sprite.player.body.blocked.down) {
                my.sprite.player.anims.play('jump');
            }

            if (my.sprite.player.body.blocked.down && Phaser.Input.Keyboard.JustDown(cursors.up)) {
                my.sprite.player.body.setVelocityY(this.JUMP_VELOCITY);
            }
        }

        if (Phaser.Input.Keyboard.JustDown(this.rKey)) {
            this.scene.restart();
        }
    }


    playerDie() {
        this.scene.restart();
    }
}
