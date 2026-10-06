import { Mesh, Scene, TransformNode } from "@babylonjs/core";
import { CONFIG } from "../config";
import { addBox, Mats } from "../levels/builders";

/** Двустворчатая раздвижная дверь. open: 0 — закрыта, 1 — открыта. */
export class Door {
  open = 0;
  private target = 0;
  private panels: Mesh[] = [];

  constructor(scene: Scene, mats: Mats, name: string, private pos: number[], private width: number, height: number, parent?: TransformNode) {
    for (const s of [-1, 1]) {
      this.panels.push(addBox(scene, mats, "metal", `${name}_${s}`, [width / 2, height, 0.08],
        [pos[0] + (s * width) / 4, pos[1] + height / 2, pos[2]], parent));
    }
  }

  get meshes() { return this.panels; }
  setOpen(v: boolean) { this.target = v ? 1 : 0; }
  setInstant(v: boolean) { this.open = this.target = v ? 1 : 0; this.place(); }
  get isClosed() { return this.open <= 0.001; }
  get isOpen() { return this.open >= 0.999; }

  update(dt: number) {
    if (this.open === this.target) return;
    const step = dt / CONFIG.elevator.doorTime;
    const d = this.target - this.open;
    this.open = Math.abs(d) <= step ? this.target : this.open + Math.sign(d) * step;
    this.place();
  }

  private place() {
    [-1, 1].forEach((s, i) => (this.panels[i].position.x = this.pos[0] + s * (this.width / 4 + (this.open * this.width) / 2)));
  }
}
