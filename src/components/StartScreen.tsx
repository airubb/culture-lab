import { GAME_CONFIG } from "@/config/gameConfig";

interface StartScreenProps {
  onStart: () => void;
}

export function StartScreen({ onStart }: StartScreenProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-amber-50 px-5 py-8 text-slate-950">
      <section className="mx-auto max-w-3xl text-center">
        <p className="mb-4 text-lg font-black text-blue-700">毎日5分の色と判断のゲーム</p>
        <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">メダルブロック・スロット</h1>
        <p className="mx-auto mt-5 max-w-2xl text-xl font-bold leading-relaxed text-slate-700">
          スロットを止めて、揃った絵柄のボールを発射します。ランチャーは自動で動くので、むずかしい操作はありません。
        </p>
        <button
          className="mt-8 min-h-20 rounded-[2rem] bg-blue-700 px-10 py-5 text-3xl font-black text-white shadow-xl shadow-blue-200 transition hover:bg-blue-800 active:scale-[0.98]"
          type="button"
          onClick={onStart}
        >
          ゲーム開始
        </button>
        <p className="mt-5 text-lg font-bold text-slate-600">
          開始時メダル: {GAME_CONFIG.initialMedals}枚 / スロット1回: {GAME_CONFIG.slotCost}枚
        </p>
      </section>
    </main>
  );
}