export type SlotSymbolId = "1" | "2" | "3" | "4" | "5" | "6" | "7";

export type ReelTuple = [SlotSymbolId, SlotSymbolId, SlotSymbolId];

export type BallAbility =
  | "none"
  | "penetrate"
  | "explode"
  | "wallPass"
  | "doubleMedal"
  | "extraBounce"
  | "all"
  | "rainbow";

export type BlockType = "normal" | "iron" | "explode" | "recover" | "medal" | "fever";

export type GameStatus = "title" | "playing";

export interface SlotSymbolConfig {
  id: SlotSymbolId;
  label: string;
  probability: number;
  feverProbability: number;
  ballCount: number;
  bounces: number;
  colorName: string;
  uiColor: string;
}

export interface BallConfig {
  symbol: SlotSymbolId;
  colorName: string;
  ability: BallAbility;
  bounces: number;
  speed: number;
  radius: number;
  fill: string;
  stroke: string;
}

export interface BlockConfig {
  type: BlockType;
  label: string;
  hp: number;
  score: number;
  medalReward: number;
  fill: string;
  border: string;
}

export interface BlockInstance {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  justExploded: boolean;
}

export interface ExplosionEffect {
  id: string;
  x: number;
  y: number;
  createdAt: number;
}

export interface BallInstance {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  symbol: SlotSymbolId;
  ability: BallAbility;
  colorName: string;
  fill: string;
  stroke: string;
  bouncesLeft: number;
  medalMultiplier: number;
}

export interface LauncherState {
  angle: number;
  direction: 1 | -1;
}

export interface MedalArea {
  x: number;
  width: number;
  reward: number;
  label: string;
}

export interface SlotSpinResult {
  reels: ReelTuple;
  isWin: boolean;
  symbol: SlotSymbolId | null;
}

export interface GameModel {
  status: GameStatus;
  medals: number;
  score: number;
  blocks: BlockInstance[];
  balls: BallInstance[];
  launcher: LauncherState;
  feverRemainingMs: number;
  destroyedBlocks: number;
  lastMessage: string;
  lastRespawnAt: number;
  pendingVolley: PendingVolley | null;
  explosions: ExplosionEffect[];
}

export interface PendingVolley {
  symbol: SlotSymbolId;
  ballCount: number;
  remaining: number;
  intervalMs: number;
  elapsedMs: number;
  isFever: boolean;
}

export interface PhysicsResult {
  balls: BallInstance[];
  blocks: BlockInstance[];
  medalsEarned: number;
  scoreEarned: number;
  destroyedCount: number;
  feverTriggered: boolean;
  message: string | null;
}