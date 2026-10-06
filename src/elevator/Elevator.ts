import { Scene, TransformNode } from "@babylonjs/core";
import { CONFIG } from "../config";
import type { Npc } from "../npc/Npc";
import type { Player } from "../player/Player";
import { CabinPanel, ButtonKey } from "./CabinPanel";
import { Door } from "./Door";

/** Конечный автомат лифта. */
export type ElevatorState = "IDLE" | "CLOSING" | "OVERLOADED" | "MOVING" | "OPENING";

export class Elevator {
  state: ElevatorState = "IDLE";
  floor = CONFIG.elevator.startFloor;
  weight = 0;
  onArrived: (floor: number) => void = () => {}; // для этапов 4–5 (спавн монстров и т.д.)
  private selected: number | null = null;
  private panel: CabinPanel;
  private time = 0;
  private root: TransformNode;
  private door: Door;

  constructor(
    private scene: Scene, cabin: { root: TransformNode; door: Door }, private landing: Map<number, Door>,
    private player: Player, private npcs: Npc[], private say: (t: string) => void,
  ) {
    this.root = cabin.root;
    this.door = cabin.door;
    this.panel = new CabinPanel(scene, cabin.root);
  }

  get moving() { return this.state === "MOVING"; }

  /** Двери кабины и шахты на текущем этаже открыты — можно выбежать. */
  exitOpen(): boolean {
    const l = this.landing.get(this.floor);
    return this.door.open > 0.7 && !!l && l.open > 0.7;
  }

  /** Игрок внутри кабины (вес игрока учитывается только тогда). */
  playerInside(): boolean {
    const E = CONFIG.elevator, p = this.player.body.position, r = this.root.position, half = E.cabinSize / 2;
    const feet = p.y - CONFIG.player.ellipsoid.y;
    return Math.abs(p.x - r.x) < half && p.z > r.z - half + 0.5 && p.z < r.z + half && feet > r.y - 0.3 && feet < r.y + E.cabinHeight;
  }

  private computeWeight(): number {
    const npcW = this.npcs.reduce((sum, n) => sum + (n.alive && n.inCabin ? n.weight : 0), 0);
    return npcW + (this.playerInside() ? CONFIG.elevator.playerWeight : 0);
  }

  /** Кнопка, на которую смотрит игрок (null — нет или игрок вне кабины). */
  pickKey(): ButtonKey | null {
    if (!this.playerInside()) return null;
    const ray = this.player.getEyeRay(CONFIG.elevator.reach);
    const hit = this.scene.pickWithRay(ray, (m) => m.metadata?.button !== undefined);
    return hit?.hit && hit.pickedMesh ? (hit.pickedMesh.metadata.button as ButtonKey) : null;
  }

  press(key: ButtonKey) {
    if (key === "stop") { this.say("Аварийная остановка будет на этапе 5"); return; }
    if (this.state === "MOVING") return;
    const here = this.landing.get(this.floor);
    if (key === this.floor) {
      // Повторное нажатие текущего этажа отменяет отправку и открывает двери.
      if ((this.state === "CLOSING" || this.state === "OVERLOADED") && here) {
        this.selected = null; this.panel.setSelected(null);
        this.state = "OPENING"; this.door.setOpen(true); here.setOpen(true);
      }
      return;
    }
    this.selected = key;
    this.panel.setSelected(key);
    if (this.state === "IDLE" || this.state === "OPENING") {
      this.state = "CLOSING";
      this.door.setOpen(false);
      here?.setOpen(false);
    }
  }

  update(dt: number) {
    const E = CONFIG.elevator;
    this.time += dt;
    this.door.update(dt);
    this.landing.forEach((d) => d.update(dt));
    this.weight = this.computeWeight();
    const here = this.landing.get(this.floor);

    switch (this.state) {
      case "CLOSING":
        if (this.door.isClosed && (!here || here.isClosed)) {
          if (this.weight > E.weightLimit) {
            this.state = "OVERLOADED";
            this.say(`Перевантаження! Ліфт не поїде, поки вага більше ${E.weightLimit} кг`);
          } else this.state = "MOVING";
        }
        break;
      case "OVERLOADED":
        if (this.weight <= E.weightLimit) this.state = "MOVING";
        break;
      case "MOVING":
        this.move(dt);
        break;
      case "OPENING":
        if (this.door.isOpen && (!here || here.isOpen)) this.state = "IDLE";
        break;
    }

    // Табло: при движении показываем этаж, мимо которого проезжает кабина.
    const travelling = this.state === "MOVING" && this.selected !== null;
    const shown = travelling ? Math.round(this.root.position.y / E.floorHeight) : this.floor;
    const dir = travelling ? Math.sign(this.selected! * E.floorHeight - this.root.position.y) : 0;
    this.panel.setBoard(this.weight, E.weightLimit, this.state === "OVERLOADED", Math.floor(this.time * 2.5) % 2 === 0, String(shown), dir);
  }

  private move(dt: number) {
    const E = CONFIG.elevator;
    const targetY = this.selected! * E.floorHeight;
    const left = targetY - this.root.position.y;
    const dy = Math.sign(left) * Math.min(E.speed * dt, Math.abs(left));
    const carry = this.playerInside(); // проверяем до сдвига кабины
    this.root.position.y += dy;
    if (carry) this.player.body.position.y += dy; // игрок едет вместе с кабиной
    // Обновляем матрицы сразу, чтобы коллизии не отставали на кадр.
    this.root.getChildMeshes().forEach((m) => m.computeWorldMatrix(true));

    if (Math.abs(targetY - this.root.position.y) < 1e-4) {
      this.floor = this.selected!;
      this.selected = null;
      this.panel.setSelected(null);
      const arrived = this.landing.get(this.floor);
      if (arrived) {
        this.state = "OPENING";
        this.door.setOpen(true);
        arrived.setOpen(true);
      } else {
        this.state = "IDLE"; // этаж -1: двери остаются закрытыми
        this.say(`Этаж ${this.floor}: лава появится на этапе 5`);
      }
      this.onArrived(this.floor);
    }
  }
}
