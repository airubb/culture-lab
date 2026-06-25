import { GAME_CONFIG } from "@/config/gameConfig";
import { SLOT_SYMBOLS } from "@/config/slotConfig";
import type { ReelTuple, SlotSymbolId } from "@/game/types";

interface SlotPanelProps {
  reels: ReelTuple;
  medals: number;
  score: number;
  destroyedBlocks: number;
  isSpinning: boolean;
  stoppedReels: number;
  canSpin: boolean;
  isFever: boolean;
  lastMessage: string;
  onSpin: () => void;
  onStop: () => void;
}

export function SlotPanel({
  reels,
  medals,
  score,
  destroyedBlocks,
  isSpinning,
  stoppedReels,
  canSpin,
  isFever,
  lastMessage,
  onSpin,
  onStop,
}: SlotPanelProps) {
  return (
    <section className="min-h-[48vh] bg-amber-50 px-4 py-4 text-slate-950 sm:px-6">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white px-4 py-3 shadow-sm ring-1 ring-amber-200">
          <StatusValue label="メダル" value={medals.toLocaleString()} />
          <StatusValue label="スコア" value={score.toLocaleString()} />
          <StatusValue label="壊したブロック" value={destroyedBlocks.toLocaleString()} />
          <div className="rounded-2xl bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-900">
            1回 {GAME_CONFIG.slotCost} メダル
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <div className="rounded-[2rem] bg-slate-900 p-4 text-white shadow-xl shadow-amber-200/60">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-2xl font-black tracking-tight">下半分: スロット</h2>
              <div
                className={`rounded-full px-4 py-2 text-sm font-black ${
                  isFever ? "bg-fuchsia-200 text-fuchsia-950" : "bg-slate-800 text-slate-100"
                }`}
              >
                {isFever ? "フィーバー中" : "通常モード"}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {reels.map((symbol, index) => (
                <Reel key={`${index}-${symbol}`} symbol={symbol} isStopped={!isSpinning || index < stoppedReels} />
              ))}
            </div>

            <p className="mt-4 min-h-12 rounded-2xl bg-slate-800 px-4 py-3 text-lg font-bold leading-relaxed text-amber-100">
              {lastMessage}
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <button
              className="min-h-24 rounded-[2rem] bg-blue-700 px-6 py-5 text-3xl font-black text-white shadow-lg shadow-blue-200 transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500"
              type="button"
              disabled={!canSpin}
              onClick={onSpin}
            >
              レバーを回す
            </button>

            <button
              className="min-h-20 rounded-[1.6rem] bg-emerald-600 px-6 py-4 text-2xl font-black text-white shadow-md shadow-emerald-100 transition active:scale-[0.98] disabled:bg-slate-300 disabled:text-slate-500"
              type="button"
              disabled={!isSpinning}
              onClick={onStop}
            >
              Enterで停止
            </button>

            <p className="rounded-3xl bg-white px-4 py-4 text-base font-bold leading-relaxed text-slate-700 ring-1 ring-amber-200">
              操作は簡単です。まず青いボタンを押します。回り始めたらEnterキー、または緑のボタンで左から順番に止めます。
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function Reel({ symbol, isStopped }: { symbol: SlotSymbolId; isStopped: boolean }) {
  const config = SLOT_SYMBOLS.find((slotSymbol) => slotSymbol.id === symbol) ?? SLOT_SYMBOLS[0];

  return (
    <div
      className={`flex aspect-[4/3] items-center justify-center rounded-[1.6rem] bg-gradient-to-br ${config.uiColor} text-6xl font-black text-slate-950 shadow-inner transition-transform duration-150 sm:text-7xl ${
        isStopped ? "scale-100" : "scale-[1.03]"
      }`}
    >
      {config.label}
    </div>
  );
}

function StatusValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-28">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="text-2xl font-black text-slate-950">{value}</p>
    </div>
  );
}