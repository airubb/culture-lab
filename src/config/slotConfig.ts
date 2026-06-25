import type { SlotSymbolConfig } from "@/game/types";

export const SLOT_CONFIG = {
  reelCount: 3,
  normalWinChance: 0.22, // 下げた
  feverWinChance: 0.45,  // 下げた
  reelShuffleMs: 140,    // 少し遅くして目押ししやすくした
} as const;

export const SLOT_SYMBOLS: SlotSymbolConfig[] = [
  {
    id: "7",
    label: "7",
    probability: 4,
    feverProbability: 14,
    ballCount: 20,
    bounces: 5,
    colorName: "虹",
    uiColor: "from-fuchsia-400 via-yellow-300 to-cyan-300",
  },
  {
    id: "6",
    label: "6",
    probability: 8,
    feverProbability: 16,
    ballCount: 10,
    bounces: 2,
    colorName: "青",
    uiColor: "from-sky-400 to-blue-600",
  },
  {
    id: "5",
    label: "5",
    probability: 12,
    feverProbability: 18,
    ballCount: 5,
    bounces: 2,
    colorName: "緑",
    uiColor: "from-emerald-300 to-green-600",
  },
  {
    id: "4",
    label: "4",
    probability: 14,
    feverProbability: 16,
    ballCount: 4,
    bounces: 2,
    colorName: "黄",
    uiColor: "from-yellow-200 to-amber-500",
  },
  {
    id: "3",
    label: "3",
    probability: 17,
    feverProbability: 15,
    ballCount: 3,
    bounces: 2,
    colorName: "オレンジ",
    uiColor: "from-orange-300 to-orange-600",
  },
  {
    id: "2",
    label: "2",
    probability: 20,
    feverProbability: 12,
    ballCount: 2,
    bounces: 2,
    colorName: "赤",
    uiColor: "from-red-300 to-red-600",
  },
  {
    id: "1",
    label: "1",
    probability: 25,
    feverProbability: 9,
    ballCount: 1,
    bounces: 2,
    colorName: "白",
    uiColor: "from-white to-slate-200",
  },
];