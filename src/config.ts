import { Vector3 } from "@babylonjs/core";

/** Единый конфиг игры: все числа и тайминги настраиваются здесь. */
export const CONFIG = {
  render: { pixelScale: 3, fov: 1.2, fogDensity: 0.015 },
  player: {
    moveSpeed: 6,
    mouseSensitivity: 0.0022,
    maxPitch: 1.5,
    eyeHeight: 1.6,
    ellipsoid: new Vector3(0.4, 0.9, 0.4),
    gravity: 9.8,
    health: 100,
    deathCameraRise: 1.2,
    deathCameraForward: -0.45,
    deathCameraPitch: 0.95,
    deathCameraTime: 0.55,
  },
  level: { tile: 2, wallHeight: 4, roofHeight: 4, wallThickness: 0.4, halfX: 10, halfZ: 8 },
  elevator: {
    cabinSize: 5, cabinHeight: 3, doorWidth: 2.4, floorHeight: 5,
    floors: [-1, 0, 1, 2, 3, 4], startFloor: 0,
    speed: 3, doorTime: 1.2, reach: 3.5,
    weightLimit: 300, playerWeight: 80, npcWeight: [60, 100], npcCount: [3, 5],
  },
  weapon: { pellets: 8, damage: 10, spread: 0.045, cooldown: 0.85, range: 40, recoil: 0.03 },
  npc: { hp: 40, runSpeed: 3.2, sightRange: 18 },
  monsters: {
    walker: {
      count: [1, 2], hp: 225, speed: 1.9, damage: 12, attackRange: 1.5, attackCooldown: 0.9,
      attackDuration: 0.55, attackHitTime: 0.26, sightRange: 30, radius: 0.55, bodyHeight: 2.15,
    },
    flying: {
      count: [2, 3], hp: 175, damage: 18, attackRange: 1.4, hitRadius: 2.1,
      attackCooldown: 1.2, orbitRadiusMin: 6, orbitRadiusMax: 9, orbitHeight: 5.5,
      orbitSpeed: 0.8, diveSpeed: 8, recoverSpeed: 5, diveInterval: 2.8,
      deathDropHeight: 0.18, wingFlapSpeed: 9,
    },
  },
  result: {
    delayBeforeMessage: 2,
    restartAfterMessage: 2,
  },
};
