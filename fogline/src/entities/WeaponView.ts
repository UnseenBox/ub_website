import Phaser from 'phaser';
import { WeaponDef } from '../data/weapons';
import { VIEW } from '../game/config';
import { DEPTH } from '../game/depths';
import { computeViewModelPose, ResolvedViewModel, resolveViewModel } from './viewModelPose';

/**
 * The first-person gun: follows the aim point from a pivot below the HUD,
 * sways while idle, kicks on recoil, dips for reloads, drops and rises for
 * weapon switches. Also owns the muzzle flash and the crosshair.
 */
export class WeaponView {
  private gun: Phaser.GameObjects.Image;
  private flash: Phaser.GameObjects.Image;
  private flashLight: Phaser.GameObjects.Image;
  private cross: Phaser.GameObjects.Graphics;
  private reloadText: Phaser.GameObjects.Text;
  private kick = 0;
  private kickRot = 0;
  private flashLeft = 0;
  private time = 0;
  private switchT = 0;
  private switching = false;
  private hitMarker = 0;
  private hitMarkerHead = false;
  /** Current muzzle position in screen space (for tracers). */
  readonly muzzle = { x: 0, y: 0 };
  readonly ejectPort = { x: 0, y: 0 };
  private model: ResolvedViewModel;
  /** How far the camera is zoomed on the scene; the crosshair is drawn smaller by the same amount. */
  private cameraZoom = 1;
  /** The Tesla's crosshair is a ring, not ticks. */
  private roundCross = false;

  constructor(scene: Phaser.Scene, def: WeaponDef) {
    this.model = resolveViewModel(def);
    this.roundCross = def.id === 'tesla';
    this.gun = scene.add.image(0, 0, def.viewTexture).setOrigin(0.5, 1).setDepth(DEPTH.gun);
    this.flash = scene.add.image(0, 0, 'flash_0').setDepth(DEPTH.muzzle).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.flashLight = scene.add.image(0, 0, 'glow').setDepth(DEPTH.muzzle - 1).setBlendMode(Phaser.BlendModes.ADD).setVisible(false);
    this.cross = scene.add.graphics().setDepth(DEPTH.crosshair);
    this.reloadText = scene.add.text(0, 0, 'RELOADING', {
      fontFamily: '"Saira", sans-serif', fontSize: '17px', color: '#e8d890', stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5, 0).setDepth(DEPTH.crosshair).setVisible(false);
  }

  setWeapon(def: WeaponDef): void {
    this.gun.setTexture(def.viewTexture);
    this.model = resolveViewModel(def);
    this.roundCross = def.id === 'tesla';
  }

  beginSwitch(): void {
    this.switching = true;
    this.switchT = 0;
  }

  fire(def: WeaponDef): void {
    this.kick = Math.min(60, this.kick + def.recoil);
    this.kickRot += (Math.random() - 0.5) * def.recoil * 0.004;
    this.flashLeft = 0.05;
    this.flash.setTexture(`flash_${Math.floor(Math.random() * 3)}`);
    this.flash.setScale(def.muzzleFlash.scale * (0.85 + Math.random() * 0.3));
    this.flash.setRotation(Math.random() * Math.PI * 2);
    this.flash.setTint(def.muzzleFlash.tint);
    this.flashLight.setScale(def.muzzleFlash.scale * 3.2).setTint(0xffb060);
  }

  showHitMarker(headshot: boolean): void {
    this.hitMarker = headshot ? 0.22 : 0.12;
    this.hitMarkerHead = headshot;
  }

  update(
    dt: number,
    cursorX: number,
    cursorY: number,
    gunAimX: number,
    gunAimY: number,
    spread: number,
    reloadProgress: number,
    reloading: boolean,
    overEnemyHead: boolean,
    overEnemy: boolean,
  ): void {
    this.time += dt;
    this.kick *= Math.exp(-dt * 14);
    this.kickRot *= Math.exp(-dt * 10);
    this.flashLeft -= dt;
    this.hitMarker = Math.max(0, this.hitMarker - dt);

    let dropY = 0, tilt = 0, reloadDrop = 0;
    if (this.switching) {
      this.switchT += dt / 0.32;
      const k = this.switchT < 0.5 ? this.switchT / 0.5 : 1 - (this.switchT - 0.5) / 0.5;
      dropY = this.model.switchDrop * Phaser.Math.Easing.Quadratic.In(Phaser.Math.Clamp(k, 0, 1));
      if (this.switchT >= 1) this.switching = false;
    }
    if (reloading) {
      const k = Math.sin(Math.min(1, reloadProgress) * Math.PI);
      reloadDrop = 110 * k;
      dropY += reloadDrop;
      tilt -= 0.42 * k * this.model.reloadTilt;
    }
    const swayX = Math.sin(this.time * 1.3) * 2.2 * this.model.sway;
    const swayY = Math.sin(this.time * 2.1) * 1.6 * this.model.sway;
    const cx = Phaser.Math.Clamp(cursorX, 0, VIEW.width);
    const cy = Phaser.Math.Clamp(cursorY, 0, VIEW.hudTop);
    const pose = computeViewModelPose({
      model: this.model,
      textureWidth: this.gun.width,
      textureHeight: this.gun.height,
      aimX: gunAimX,
      aimY: gunAimY,
      cursorX: cx,
      cursorY: cy,
      kick: this.kick,
      kickRot: this.kickRot,
      tilt,
      dropY,
      swayX,
      swayY,
    });
    // The camera may be zoomed on the scene: the gun stays where it is on screen, so it is placed
    // back through the zoom, and drawn smaller by the same amount.
    const [gx, gy] = this.screenToWorld(pose.pivotX, pose.pivotY);
    this.gun.setPosition(gx, gy).setRotation(pose.rotation).setScale(pose.scale / this.cameraZoom);
    this.muzzle.x = pose.muzzleX;
    this.muzzle.y = pose.muzzleY;
    this.ejectPort.x = pose.ejectX;
    this.ejectPort.y = pose.ejectY;

    // The spark (and its glow) can be nudged per weapon so it sits in the barrel opening.
    const fx = this.muzzle.x + this.model.flashOffsetX;
    const fy = this.muzzle.y + this.model.flashOffsetY;
    const flashOn = this.flashLeft > 0;
    const [flx, fly] = this.screenToWorld(fx, fy);
    this.flash.setVisible(flashOn).setPosition(flx, fly);
    this.flashLight.setVisible(flashOn).setPosition(flx, fly).setAlpha(0.35);

    // crosshair
    const g = this.cross;
    g.clear();
    if (cy >= VIEW.hudTop) {
      this.reloadText.setVisible(false);
      return;
    }
    // While reloading, the crosshair travels with the gun as it dips and tilts (you
    // cannot fire then). It follows the muzzle's reload motion and settles back after.
    let drawX = cx, drawY = cy;
    if (reloading) {
      const rest = computeViewModelPose({
        model: this.model,
        textureWidth: this.gun.width,
        textureHeight: this.gun.height,
        aimX: gunAimX,
        aimY: gunAimY,
        cursorX: cx,
        cursorY: cy,
        kick: this.kick,
        kickRot: this.kickRot,
        tilt: 0,
        dropY: dropY - reloadDrop,
        swayX,
        swayY,
      });
      drawX = Phaser.Math.Clamp(cx + (pose.muzzleX - rest.muzzleX), 0, VIEW.width);
      drawY = Phaser.Math.Clamp(cy + (pose.muzzleY - rest.muzzleY), 0, VIEW.hudTop - 10);
    }
    const col = overEnemyHead ? 0xff5040 : overEnemy ? 0xffb040 : 0xd8f0c8;
    const gap = 6 + spread;
    const len2 = 9;
    g.lineStyle(3, 0x000000, 0.55);
    if (this.roundCross) {
      g.lineStyle(3, 0x000000, 0.55);
      g.strokeCircle(drawX, drawY, gap + 4);
      g.lineStyle(1.6, col, 0.95);
      g.strokeCircle(drawX, drawY, gap + 4);
    } else {
      this.ticks(g, drawX, drawY, gap, len2);
      g.lineStyle(1.6, col, 0.95);
      this.ticks(g, drawX, drawY, gap, len2);
    }
    g.fillStyle(col, 1);
    g.fillCircle(drawX, drawY, 1.4);
    if (this.hitMarker > 0) {
      const c = this.hitMarkerHead ? 0xff3020 : 0xffffff;
      const s = this.hitMarkerHead ? 11 : 8;
      g.lineStyle(2.4, c, Math.min(1, this.hitMarker * 8));
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        g.lineBetween(drawX + dx * 4, drawY + dy * 4, drawX + dx * (4 + s), drawY + dy * (4 + s));
      }
    }
    if (reloading) {
      g.lineStyle(3, 0x000000, 0.5);
      g.beginPath();
      g.arc(drawX, drawY, gap + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reloadProgress);
      g.strokePath();
      g.lineStyle(2, 0xe8d890, 0.95);
      g.beginPath();
      g.arc(drawX, drawY, gap + 16, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * reloadProgress);
      g.strokePath();
    }
    // The crosshair stays the same size on screen, whatever the camera's zoom: scaled about its
    // own centre, so it is drawn where it always is.
    const s = 1 / this.cameraZoom;
    g.setScale(s).setPosition(drawX * (1 - s), drawY * (1 - s));
    this.reloadText.setVisible(reloading).setPosition(drawX, drawY + gap + 22);
  }

  private ticks(g: Phaser.GameObjects.Graphics, x: number, y: number, gap: number, len: number): void {
    g.lineBetween(x - gap - len, y, x - gap, y);
    g.lineBetween(x + gap, y, x + gap + len, y);
    g.lineBetween(x, y - gap - len, x, y - gap);
    g.lineBetween(x, y + gap, x, y + gap + len);
  }

  /** Sets the camera's zoom on the scene, so the gun and crosshair keep their size and place on screen. */
  setCameraZoom(k: number): void {
    this.cameraZoom = k;
  }

  /** A screen point (design pixels) as the world point the zoomed camera shows it at. */
  private screenToWorld(x: number, y: number): [number, number] {
    const k = this.cameraZoom;
    return [VIEW.centerX + (x - VIEW.centerX) / k, VIEW.height / 2 + (y - VIEW.height / 2) / k];
  }

  /** Through a scope only the sight shows: the gun and its flash step out of the picture. */
  hideGun(): void {
    this.gun.setVisible(false);
    this.flash.setVisible(false);
    this.flashLight.setVisible(false);
  }

  setVisible(v: boolean): void {
    this.gun.setVisible(v);
    this.cross.setVisible(v);
    if (!v) {
      this.flash.setVisible(false);
      this.flashLight.setVisible(false);
      this.reloadText.setVisible(false);
    }
  }
}
