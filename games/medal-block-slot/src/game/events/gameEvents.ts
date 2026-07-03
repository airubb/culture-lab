import type { SlotSymbolId } from "@/game/types";

export type GameEvent =
  | { type: "GAME_STARTED" }
  | { type: "SLOT_SPENT"; amount: number }
  | { type: "SLOT_START_SPIN" }
  | { type: "SLOT_STOP_REEL"; index: number }
  | { type: "SLOT_WIN"; symbol: SlotSymbolId; ballCount: number }
  | { type: "SLOT_LOSE" }
  | { type: "BALL_LAUNCHED" }
  | { type: "BLOCK_HIT"; x: number; y: number }
  | { type: "BLOCK_EXPLODED"; x: number; y: number }
  | { type: "MEDAL_EARNED"; amount: number }
  | { type: "FEVER_STARTED" };