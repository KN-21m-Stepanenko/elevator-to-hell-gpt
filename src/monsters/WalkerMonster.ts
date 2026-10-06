import { Color3, Mesh, Scene, Vector3 } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Npc } from "../npc/Npc";
import type { Player } from "../player/Player";
import { DamageTarget, horizontalDistance, Monster, randomFloat } from "./Monster";

export type WalkerState = "CHASE" | "ATTACK" | "DEAD";

/** Наземный монстр: преследует ближайшую живую цель, не проходит сквозь объекты и атакует с замахом. */
export class WalkerMonster extends Monster {
  state: WalkerState = "CHASE";
  private attackTimer = randomFloat(0.2, CONFIG.monsters.walker.attackCooldown);
  private attackProgress = -1;
  private attackHit = false;
  private readonly player: Player;
  private readonly npcs: Npc[];
  private readonly armL: Mesh;
  private readonly armR: Mesh;
  private readonly torso: Mesh;

  constructor(scene: Scene, position: Vector3, floor: number, player: Player, npcs: Npc[], color: Color3) {
    super(scene, "walker", position, CONFIG.monsters.walker.hp);
    this.player = player;
    this.npcs = npcs;

    this.root.scaling.setAll(1.05);
    this.createPart("walker_legs", [0.65, 0.9, 0.45], [0, 0.45, 0], new Color3(0.12, 0.14, 0.16));
    this.torso = this.createPart("walker_torso", [0.75, 0.9, 0.5], [0, 1.25, 0], color);
    this.createPart("walker_head", [0.5, 0.5, 0.5], [0, 1.95, 0], new Color3(0.34, 0.35, 0.33));
    this.armL = this.createPart("walker_arm_l", [0.2, 0.75, 0.2], [-0.52, 1.22, 0], color);
    this.armR = this.createPart("walker_arm_r", [0.2, 0.75, 0.2], [0.52, 1.22, 0], color);
    this.createPart("walker_eye_l", [0.12, 0.08, 0.04], [-0.12, 2.02, 0.25], new Color3(0.7, 0.05, 0.02), new Color3(0.7, 0.05, 0.02));
    this.createPart("walker_eye_r", [0.12, 0.08, 0.04], [0.12, 2.02, 0.25], new Color3(0.7, 0.05, 0.02), new Color3(0.7, 0.05, 0.02));
  }

  update(dt: number) {
    if (!this.alive) {
      this.state = "DEAD";
      this.updateCorpse(dt);
      return;
    }

    this.updateHitFlash(dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    const target = this.findTarget();
    if (!target) {
      this.resetAttackPose(dt);
      return;
    }

    const from = this.getWorldPosition();
    const to = target.getWorldPosition();
    const distance = horizontalDistance(from, to);

    if (this.attackProgress >= 0) {
      this.updateAttack(dt, target);
      this.face(to, dt);
      return;
    }

    if (distance <= CONFIG.monsters.walker.attackRange) {
      this.state = "ATTACK";
      this.face(to, dt);
      if (this.attackTimer <= 0) this.startAttack();
      return;
    }

    this.state = "CHASE";
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return;

    const desiredGap = CONFIG.monsters.walker.radius + 0.45;
    const step = Math.min(CONFIG.monsters.walker.speed * dt, Math.max(0, len - desiredGap));
    if (step <= 0) {
      this.separateGround(
        CONFIG.monsters.walker.radius,
        [
          { target: this.player, radius: 0.45 },
          ...this.npcs.map((npc) => ({ target: npc, radius: 0.38 })),
        ],
        2.0,
      );
      this.face(to, dt);
      return;
    }
    const tx = this.root.position.x + (dx / len) * step;
    const tz = this.root.position.z + (dz / len) * step;
    this.moveGround(tx, tz, CONFIG.monsters.walker.radius, CONFIG.monsters.walker.bodyHeight);

    this.clampToRoom();
    this.separateGround(
      CONFIG.monsters.walker.radius,
      [
        { target: this.player, radius: 0.45 },
        ...this.npcs.map((npc) => ({ target: npc, radius: 0.38 })),
      ],
      2.0,
    );
    this.face(to, dt);
  }

  private startAttack() {
    this.attackProgress = 0;
    this.attackHit = false;
    this.state = "ATTACK";
  }

  private updateAttack(dt: number, target: DamageTarget) {
    const W = CONFIG.monsters.walker;
    this.attackProgress += dt / W.attackDuration;
    const t = Math.min(1, this.attackProgress);

    // Руки резко идут вперёд в середине замаха и возвращаются назад.
    const swing = Math.sin(t * Math.PI);
    this.armL.rotation.x = -1.05 * swing;
    this.armR.rotation.x = -1.05 * swing;
    this.armL.rotation.z = -0.15 * swing;
    this.armR.rotation.z = 0.15 * swing;
    this.torso.rotation.x = 0.12 * swing;

    if (!this.attackHit && this.attackProgress >= W.attackHitTime / W.attackDuration) {
      this.attackHit = true;
      const currentDistance = horizontalDistance(this.getWorldPosition(), target.getWorldPosition());
      if (target.alive && currentDistance <= W.attackRange + 0.15) {
        if (target === this.player) this.player.damage(W.damage, this.getWorldPosition());
        else target.damage(W.damage);
      }
    }

    if (this.attackProgress >= 1) {
      this.attackProgress = -1;
      this.attackTimer = W.attackCooldown;
      this.resetAttackPose(1);
      this.state = "CHASE";
    }
  }

  private resetAttackPose(_dt: number) {
    if (this.attackProgress >= 0) return;
    this.armL.rotation.x = 0;
    this.armR.rotation.x = 0;
    this.armL.rotation.z = 0;
    this.armR.rotation.z = 0;
    this.torso.rotation.x = 0;
  }

  private findTarget(): DamageTarget | null {
    const candidates: Array<{ target: DamageTarget; pos: Vector3 }> = [];
    if (this.player.alive && Math.abs(this.player.getWorldPosition().y - this.root.position.y) < 2) {
      candidates.push({ target: this.player, pos: this.player.getWorldPosition() });
    }
    for (const npc of this.npcs) {
      if (!npc.alive) continue;
      const p = npc.getWorldPosition();
      if (Math.abs(p.y - this.root.position.y) < 2) candidates.push({ target: npc, pos: p });
    }
    if (!candidates.length) return null;
    candidates.sort((a, b) => horizontalDistance(this.root.position, a.pos) - horizontalDistance(this.root.position, b.pos));
    return horizontalDistance(this.root.position, candidates[0].pos) <= CONFIG.monsters.walker.sightRange ? candidates[0].target : null;
  }

  private face(target: Vector3, dt: number) {
    const wanted = Math.atan2(target.x - this.root.position.x, target.z - this.root.position.z);
    let delta = wanted - this.root.rotation.y;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    this.root.rotation.y += delta * Math.min(1, dt * 8);
  }
}
