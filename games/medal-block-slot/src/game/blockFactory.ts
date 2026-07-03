import { BLOCK_CONFIG_BY_TYPE } from "@/config/blockConfig";
import { GAME_CONFIG } from "@/config/gameConfig";
import type { BlockInstance, BlockType } from "@/game/types";

const BLOCK_LAYOUT: BlockType[][] = [
  ["normal", "normal", "medal", "iron", "normal", "fever", "normal"],
  ["explode", "normal", "iron", "normal", "medal", "normal", "explode"],
  ["normal", "recover", "normal", "iron", "normal", "recover", "normal"],
  ["iron", "normal", "explode", "normal", "fever", "normal", "iron"],
];

export function createInitialBlocks(): BlockInstance[] {
  const gap = 10;
  const columns = BLOCK_LAYOUT[0]?.length ?? 0;
  const blockWidth = (GAME_CONFIG.board.width - 80 - gap * (columns - 1)) / columns;
  const blockHeight = 34;
  const startX = 40;
  const startY = 42;

  return BLOCK_LAYOUT.flatMap((row, rowIndex) =>
    row.map((type, columnIndex) => {
      const config = BLOCK_CONFIG_BY_TYPE[type];

      return {
        id: `${rowIndex}-${columnIndex}`,
        type,
        x: startX + columnIndex * (blockWidth + gap),
        y: startY + rowIndex * (blockHeight + gap),
        width: blockWidth,
        height: blockHeight,
        hp: config.hp,
        maxHp: config.hp,
        destroyed: false,
        justExploded: false,
      } satisfies BlockInstance;
    }),
  );
}