import { Color3, Color4, Engine, Scene } from "@babylonjs/core";
import { CONFIG } from "./config";
import { Elevator } from "./elevator/Elevator";
import { buildWorld } from "./levels/World";
import { NpcEnv, spawnNpcs } from "./npc/Npc";
import { MonsterManager } from "./monsters/MonsterManager";
import { Player } from "./player/Player";
import { Weapon } from "./player/Weapon";
import { Hud } from "./ui/Hud";

const canvas = document.getElementById("game") as HTMLCanvasElement;
const engine = new Engine(canvas, false, { stencil: false });
engine.setHardwareScalingLevel(CONFIG.render.pixelScale);

const scene = new Scene(engine);
scene.collisionsEnabled = true;
scene.clearColor = new Color4(0.02, 0.02, 0.03, 1);
scene.fogMode = Scene.FOGMODE_EXP2;
scene.fogDensity = CONFIG.render.fogDensity;
scene.fogColor = new Color3(0.03, 0.03, 0.04);

const world = buildWorld(scene);
const npcs = spawnNpcs(scene, world.cabin.root);
const player = new Player(scene, canvas, world.spawn, world.spawnYaw);
const weapon = new Weapon(scene, player);
const hud = new Hud();
const elevator = new Elevator(scene, world.cabin, world.landing, player, npcs, (t) => hud.toast(t));
const monsters = new MonsterManager(scene, player, npcs, world.cabin.root, (t, ms) => hud.toast(t, ms));

let ending = false;

const restartGame = () => {
  const url = new URL(window.location.href);
  url.searchParams.set("restart", String(Date.now()));
  window.location.assign(url.toString());
};

const showGameOver = () => {
  if (ending) return;
  ending = true;

  // Никаких таймеров и отложенных рестартов: после смерти сразу показываем экран результата.
  player.freezeInput(true);
  player.enableFreeLook();
  weapon.hide();
  monsters.freezeLiving();
  hud.showResult("GAME OVER", "ВЫ ПОГИБЛИ", restartGame);
};

const finishVictory = (message: string) => {
  if (ending) return;
  ending = true;

  // После победы останавливаем игру и освобождаем мышь.
  // В течение короткой паузы камера остаётся свободной для осмотра.
  player.freezeInput(true);
  player.enableFreeLook();
  weapon.hide();
  monsters.freezeLiving();
  hud.setEnding();
  hud.toast(message, CONFIG.result.delayBeforeMessage * 1000);

  const delay = CONFIG.result.delayBeforeMessage * 1000;
  window.setTimeout(() => {
    if (!ending) return;
    hud.showResult('ПОБЕДА', message, restartGame);
  }, delay);
};

elevator.onArrived = (floor) => monsters.spawnForFloor(floor);
monsters.onVictory = (floor) => finishVictory(floor === 4 ? "КРЫША ЗАЧИЩЕНА — ПОБЕДА" : `ЭТАЖ ${floor} ЗАЧИЩЕН — ПОБЕДА`);
player.onDamage = (hp) => {
  hud.bloodSplash(64);
  if (hp > 0 && hp < player.maxHealth * 0.3) hud.toast(`ЗДОРОВЬЕ: ${hp}%`, 700);
};

const env: NpcEnv = { cabin: world.cabin.root, scene, player, weapon, elevator, npcs };
npcs.forEach((n) => (n.env = env));

hud.setPaused(true);
hud.onStart(() => player.requestLock());
player.onLockChange = (locked) => {
  if (!ending && player.alive) hud.setPaused(!locked);
};
player.onToggleWeapon = () => weapon.toggle();
player.onFire = () => weapon.fire();
player.onInteract = () => {
  const key = elevator.pickKey();
  if (key !== null) elevator.press(key);
};

scene.onBeforeRenderObservable.add(() => {
  const dt = Math.min(engine.getDeltaTime() / 1000, 0.05);

  if (!ending) {
    elevator.update(dt);
    npcs.forEach((n) => n.update(dt));
    weapon.update(dt);
  }

  // Игрок при смерти продолжает анимировать тело/камеру; монстры — свои падающие трупы.
  player.update(dt);

  // Смерть фиксируется в игровом цикле, после завершения Player.damage().
  // Это исключает любые callback/таймеры внутри атаки монстра и убирает зависание.
  if (!ending && !player.alive) showGameOver();

  monsters.update(dt);

  if (!ending) {
    const key = player.locked ? elevator.pickKey() : null;
    hud.setHint(key === null ? null : key === "stop" ? "E — аварійна зупинка" : `E — поверх ${key}`);
  }
});

engine.runRenderLoop(() => scene.render());
window.addEventListener("resize", () => engine.resize());
