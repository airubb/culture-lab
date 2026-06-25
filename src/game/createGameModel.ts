import { GAME_CONFIG } from "@/config/gameConfig";
import { createInitialBlocks } from "@/game/blockFactory";
import type { GameModel } from "@/game/types";

export function createGameModel(now: number): GameModel {
  return {
    status: "playing",
    medals: GAME_CONFIG.initialMedals,
    score: 0,
    blocks: createInitialBlocks(),
    balls: [],
    launcher: {
      angle: GAME_CONFIG.launcher.initialAngle,
      direction: 1,
    },
    feverRemainingMs: 0,
    destroyedBlocks: 0,
    lastMessage: "レバーを押してスロットを回しましょう。Enterで左から止まります。",
    lastRespawnAt: now,
    pendingVolley: null,
    explosions: [],
  };
}