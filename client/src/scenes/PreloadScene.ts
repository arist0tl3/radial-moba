import Phaser from 'phaser';

import soldierIdle from '../assets/sprites/soldier-idle.png';
import soldierWalk from '../assets/sprites/soldier-walk.png';
import soldierAttack from '../assets/sprites/soldier-attack.png';
import soldierDeath from '../assets/sprites/soldier-death.png';
import orcIdle from '../assets/sprites/orc-idle.png';
import orcWalk from '../assets/sprites/orc-walk.png';
import orcAttack from '../assets/sprites/orc-attack.png';
import orcDeath from '../assets/sprites/orc-death.png';
import statueImg from '../assets/sprites/statue.png';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload() {
    // Soldier spritesheets (player) — 100x100 frames, single row
    this.load.spritesheet('soldier-idle', soldierIdle, { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('soldier-walk', soldierWalk, { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('soldier-attack', soldierAttack, { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('soldier-death', soldierDeath, { frameWidth: 100, frameHeight: 100 });

    // Orc spritesheets (minion) — 100x100 frames, single row
    this.load.spritesheet('orc-idle', orcIdle, { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('orc-walk', orcWalk, { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('orc-attack', orcAttack, { frameWidth: 100, frameHeight: 100 });
    this.load.spritesheet('orc-death', orcDeath, { frameWidth: 100, frameHeight: 100 });

    // Statue (pre-cropped for bases)
    this.load.image('statue', statueImg);
  }

  create() {
    // Create soldier animations
    this.anims.create({ key: 'soldier-idle', frames: this.anims.generateFrameNumbers('soldier-idle', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'soldier-walk', frames: this.anims.generateFrameNumbers('soldier-walk', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'soldier-attack', frames: this.anims.generateFrameNumbers('soldier-attack', { start: 0, end: 5 }), frameRate: 10, repeat: 0 });
    this.anims.create({ key: 'soldier-death', frames: this.anims.generateFrameNumbers('soldier-death', { start: 0, end: 3 }), frameRate: 8, repeat: 0 });

    // Create orc animations
    this.anims.create({ key: 'orc-idle', frames: this.anims.generateFrameNumbers('orc-idle', { start: 0, end: 5 }), frameRate: 8, repeat: -1 });
    this.anims.create({ key: 'orc-walk', frames: this.anims.generateFrameNumbers('orc-walk', { start: 0, end: 7 }), frameRate: 10, repeat: -1 });
    this.anims.create({ key: 'orc-attack', frames: this.anims.generateFrameNumbers('orc-attack', { start: 0, end: 5 }), frameRate: 10, repeat: 0 });
    this.anims.create({ key: 'orc-death', frames: this.anims.generateFrameNumbers('orc-death', { start: 0, end: 3 }), frameRate: 8, repeat: 0 });

    // All loaded — go to lobby
    this.scene.start('LobbyScene');
  }
}
