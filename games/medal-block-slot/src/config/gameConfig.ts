import type { MedalArea } from "@/game/types";

export const GAME_CONFIG = {
  initialMedals: 40,
  slotCost: 3,
  feverDurationMs: 25_000,
  blockRespawnMs: 5 * 60 * 1000,
  board: {
    width: 720,
    height: 420,
    launcherX: 360,
    launcherY: 382,
  },
  launcher: {
    minAngle: 30,
    maxAngle: 150,
    initialAngle: 90,
    rotationSpeedDegreesPerSecond: 42,
  },
} as const;

export const MEDAL_AREAS: MedalArea[] = [
  { x: 96, width: 128, reward: 2, label: "+2" },
  { x: 296, width: 128, reward: 4, label: "+4" },
  { x: 496, width: 128, reward: 2, label: "+2" },
];