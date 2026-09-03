import { SLOT_CONFIG, SLOT_SYMBOLS } from "@/config/slotConfig";
import type { ReelTuple, SlotSymbolConfig, SlotSymbolId, SlotSpinResult } from "@/game/types";

export class SlotMachine {
  constructor(private readonly random: () => number = Math.random) {}

  spin(isFever: boolean): SlotSpinResult {
    const winChance = isFever ? SLOT_CONFIG.feverWinChance : SLOT_CONFIG.normalWinChance;

    if (this.random() < winChance) {
      const symbol = this.pickSymbol(isFever).id;
      return { reels: [symbol, symbol, symbol], isWin: true, symbol };
    }

    const reels: ReelTuple = [
      this.pickSymbol(isFever).id,
      this.pickSymbol(isFever).id,
      this.pickSymbol(isFever).id,
    ];

    if (reels[0] === reels[1] && reels[1] === reels[2]) {
      reels[2] = this.pickDifferentSymbol(reels[0], isFever);
    }

    return { reels, isWin: false, symbol: null };
  }

  pickRandomSymbol(isFever: boolean): SlotSymbolId {
    return this.pickSymbol(isFever).id;
  }

  private pickDifferentSymbol(current: SlotSymbolId, isFever: boolean): SlotSymbolId {
    const candidates = SLOT_SYMBOLS.filter((symbol) => symbol.id !== current);
    return this.pickWeighted(candidates, isFever).id;
  }

  private pickSymbol(isFever: boolean): SlotSymbolConfig {
    return this.pickWeighted(SLOT_SYMBOLS, isFever);
  }

  private pickWeighted(symbols: SlotSymbolConfig[], isFever: boolean): SlotSymbolConfig {
    const total = symbols.reduce(
      (sum, symbol) => sum + (isFever ? symbol.feverProbability : symbol.probability),
      0,
    );
    let cursor = this.random() * total;

    for (const symbol of symbols) {
      cursor -= isFever ? symbol.feverProbability : symbol.probability;
      if (cursor <= 0) {
        return symbol;
      }
    }

    return symbols[symbols.length - 1] ?? SLOT_SYMBOLS[0];
  }
}