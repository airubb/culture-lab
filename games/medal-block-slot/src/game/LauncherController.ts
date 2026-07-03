import { GAME_CONFIG } from "@/config/gameConfig";
import type { LauncherState } from "@/game/types";

export class LauncherController {
  update(state: LauncherState, deltaSeconds: number): LauncherState {
    const { maxAngle, minAngle, rotationSpeedDegreesPerSecond } = GAME_CONFIG.launcher;
    let nextAngle = state.angle + state.direction * rotationSpeedDegreesPerSecond * deltaSeconds;
    let nextDirection = state.direction;

    if (nextAngle > maxAngle) {
      nextAngle = maxAngle - (nextAngle - maxAngle);
      nextDirection = -1;
    }

    if (nextAngle < minAngle) {
      nextAngle = minAngle + (minAngle - nextAngle);
      nextDirection = 1;
    }

    return { angle: nextAngle, direction: nextDirection };
  }
}

export function angleToVelocity(angle: number, speed: number): { vx: number; vy: number } {
  const radians = (angle * Math.PI) / 180;

  return {
    vx: Math.cos(radians) * speed,
    vy: -Math.sin(radians) * speed,
  };
}