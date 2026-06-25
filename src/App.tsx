import { useCallback, useEffect, useRef, useState } from "react";
import { GAME_CONFIG } from "@/config/gameConfig";
import { SLOT_CONFIG, SLOT_SYMBOLS } from "@/config/slotConfig";
import { GameBoard } from "@/components/GameBoard";
import { SlotPanel } from "@/components/SlotPanel";
import { StartScreen } from "@/components/StartScreen";
import { AudioEngine } from "@/game/audio/AudioEngine";
import { EventBus } from "@/game/events/EventBus";
import type { GameEvent } from "@/game/events/gameEvents";
import { createInitialBlocks } from "@/game/blockFactory";
import { createGameModel } from "@/game/createGameModel";
import { LauncherController } from "@/game/LauncherController";
import { createSingleBall, stepGamePhysics } from "@/game/physics";
import { SlotMachine } from "@/game/SlotMachine";
import type { GameModel, PendingVolley, ReelTuple, SlotSpinResult } from "@/game/types";

const INITIAL_REELS: ReelTuple = ["7", "6", "5"];

export default function App() {
  const slotMachineRef = useRef(new SlotMachine());
  const launcherControllerRef = useRef(new LauncherController());
  const eventBusRef = useRef(new EventBus<GameEvent>());
  const audioEngineRef = useRef<AudioEngine | null>(null);

  useEffect(() => {
    const audioEngine = new AudioEngine();
    audioEngineRef.current = audioEngine;

    const subscriptions = [
      eventBusRef.current.subscribe("GAME_STARTED", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("SLOT_START_SPIN", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("SLOT_STOP_REEL", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("SLOT_WIN", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("SLOT_LOSE", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("BLOCK_EXPLODED", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("MEDAL_EARNED", (event) => audioEngine.handleGameEvent(event)),
      eventBusRef.current.subscribe("FEVER_STARTED", (event) => audioEngine.handleGameEvent(event)),
    ];

    return () => {
      subscriptions.forEach((unsubscribe) => unsubscribe());
      audioEngine.dispose();
    };
  }, []);
  const [model, setModel] = useState<GameModel>(() => ({
    ...createGameModel(performance.now()),
    status: "title",
    lastMessage: "ゲーム開始を押してください。",
  }));
  const [reels, setReels] = useState<ReelTuple>(INITIAL_REELS);
  const [isSpinning, setIsSpinning] = useState(false);
  const [stoppedReels, setStoppedReels] = useState(0);
  const [spinResult, setSpinResult] = useState<SlotSpinResult | null>(null);
  const isFever = model.feverRemainingMs > 0;
  const canUseLever = model.status === "playing" && !isSpinning;

  useEffect(() => {
    const eventBus = eventBusRef.current;
    const unsubscribeSlotWin = eventBus.subscribe("SLOT_WIN", (event) => {
      setModel((current) => ({
        ...current,
        lastMessage: `${event.symbol}が3つ揃いました。${event.ballCount}個のボールを自動発射します。`,
      }));
    });
    const unsubscribeFever = eventBus.subscribe("FEVER_STARTED", () => {
      setModel((current) => ({
        ...current,
        lastMessage: "フィーバー開始。虹色の今がチャンスです。メダルが2倍になります。",
      }));
    });

    return () => {
      unsubscribeSlotWin();
      unsubscribeFever();
    };
  }, []);

  useEffect(() => {
    if (model.status !== "playing") {
      return;
    }

    let frameId = 0;
    let lastTime = performance.now();

    const tick = (now: number) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.033);
      const deltaMs = now - lastTime;
      lastTime = now;

      setModel((current) => updateGameFrame(current, deltaSeconds, deltaMs, now));
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [model.status]);

  useEffect(() => {
    if (!isSpinning || spinResult === null) {
      return;
    }

    const timerId = window.setInterval(() => {
      setReels((current) => {
        const next = [...current] as ReelTuple;

        for (let index = 0; index < SLOT_CONFIG.reelCount; index += 1) {
          next[index] =
            index < stoppedReels ? spinResult.reels[index] : slotMachineRef.current.pickRandomSymbol(isFever);
        }

        return next;
      });
    }, SLOT_CONFIG.reelShuffleMs);

    return () => window.clearInterval(timerId);
  }, [isFever, isSpinning, spinResult, stoppedReels]);

  const finishSpin = useCallback((result: SlotSpinResult) => {
    if (!result.isWin || result.symbol === null) {
      setModel((current) => ({
        ...current,
        lastMessage: "今回は揃いませんでした。もう一度レバーを回しましょう。",
      }));
      eventBusRef.current.publish({ type: "SLOT_LOSE" });
      return;
    }

    const symbol = result.symbol;
    const slotSymbol = SLOT_SYMBOLS.find((candidate) => candidate.id === symbol);
    const ballCount = slotSymbol?.ballCount ?? 1;
    const volley: PendingVolley = {
      symbol,
      ballCount,
      remaining: ballCount,
      intervalMs: 180,
      elapsedMs: 0,
      isFever: false,
    };

    setModel((current) => ({
      ...current,
      pendingVolley: { ...volley, isFever: current.feverRemainingMs > 0 },
    }));
    eventBusRef.current.publish({ type: "SLOT_WIN", symbol, ballCount });
  }, []);

  const handleStopNextReel = useCallback(() => {
    if (!isSpinning || spinResult === null) {
      return;
    }

    const nextStoppedCount = stoppedReels + 1;
    setReels((current) => {
      const next = [...current] as ReelTuple;
      next[stoppedReels] = spinResult.reels[stoppedReels];
      return next;
    });
    setStoppedReels(nextStoppedCount);
    eventBusRef.current.publish({ type: "SLOT_STOP_REEL", index: stoppedReels });

    if (nextStoppedCount >= SLOT_CONFIG.reelCount) {
      setIsSpinning(false);
      setSpinResult(null);
      finishSpin(spinResult);
    }
  }, [finishSpin, isSpinning, spinResult, stoppedReels]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleStopNextReel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleStopNextReel]);

  const handleStart = useCallback(() => {
    setModel(createGameModel(performance.now()));
    setReels(INITIAL_REELS);
    setIsSpinning(false);
    setStoppedReels(0);
    setSpinResult(null);
    eventBusRef.current.publish({ type: "GAME_STARTED" });
  }, []);

  const handleSpin = useCallback(() => {
    if (!canUseLever) {
      return;
    }

    if (model.medals < GAME_CONFIG.slotCost) {
      setModel((current) => ({
        ...current,
        medals: current.medals + 10,
        lastMessage: "メダルが足りないため、応援メダルを10枚受け取りました。",
      }));
      return;
    }

    const result = slotMachineRef.current.spin(isFever);
    setSpinResult(result);
    setStoppedReels(0);
    setIsSpinning(true);
    setModel((current) => ({
      ...current,
      medals: current.medals - GAME_CONFIG.slotCost,
      lastMessage: "スロット回転中。Enterキーで左から順番に止めてください。",
    }));
    eventBusRef.current.publish({ type: "SLOT_START_SPIN" });
    eventBusRef.current.publish({ type: "SLOT_SPENT", amount: GAME_CONFIG.slotCost });
  }, [canUseLever, isFever, model.medals]);

  if (model.status === "title") {
    return <StartScreen onStart={handleStart} />;
  }

  return (
    <main className="min-h-screen bg-amber-50">
      <GameBoard model={model} isFever={isFever} />
      <SlotPanel
        reels={reels}
        medals={model.medals}
        score={model.score}
        destroyedBlocks={model.destroyedBlocks}
        isSpinning={isSpinning}
        stoppedReels={stoppedReels}
        canSpin={canUseLever}
        isFever={isFever}
        lastMessage={model.lastMessage}
        onSpin={handleSpin}
        onStop={handleStopNextReel}
      />
    </main>
  );

  function updateGameFrame(current: GameModel, deltaSeconds: number, deltaMs: number, now: number): GameModel {
    if (current.status !== "playing") {
      return current;
    }

    const launcher = launcherControllerRef.current.update(current.launcher, deltaSeconds);
    const feverRemainingMs = Math.max(0, current.feverRemainingMs - deltaMs);
    const shouldRespawn = now - current.lastRespawnAt >= GAME_CONFIG.blockRespawnMs;
    let blocks = shouldRespawn ? createInitialBlocks() : current.blocks;
    let balls = current.balls;
    let medals = current.medals;
    let score = current.score;
    let destroyedBlocks = current.destroyedBlocks;
    let nextFeverRemainingMs = feverRemainingMs;
    let lastMessage = shouldRespawn ? "5分経過したので、壊れたブロックが復活しました。" : current.lastMessage;
    let pendingVolley = current.pendingVolley;

    if (pendingVolley !== null) {
      const nextElapsedMs = pendingVolley.elapsedMs + deltaMs;
      const ballsToLaunch = Math.floor(nextElapsedMs / pendingVolley.intervalMs);
      const isVolleyFever = pendingVolley.isFever || feverRemainingMs > 0;

      if (ballsToLaunch > 0) {
        const remainingAfterLaunch = Math.max(0, pendingVolley.remaining - ballsToLaunch);
        const volleyStartIndex = pendingVolley.ballCount - pendingVolley.remaining;
        const volleyBallCount = pendingVolley.ballCount;
        const volleySymbol = pendingVolley.symbol;
        const launchedBalls = Array.from({ length: ballsToLaunch }, (_, index) =>
          createSingleBall(
            volleySymbol,
            launcher,
            isVolleyFever,
            volleyStartIndex + index,
            volleyBallCount,
          ),
        );
        balls = [...balls, ...launchedBalls];
        pendingVolley =
          remainingAfterLaunch > 0
            ? {
                ...pendingVolley,
                remaining: remainingAfterLaunch,
                elapsedMs: nextElapsedMs - ballsToLaunch * pendingVolley.intervalMs,
              }
            : null;
      } else {
        pendingVolley = { ...pendingVolley, elapsedMs: nextElapsedMs };
      }
    }

    const previousExplosions = current.explosions.filter(
      (explosion) => now - explosion.createdAt < 400,
    );

    if (balls.length > 0) {
      const physics = stepGamePhysics({
        balls,
        blocks,
        deltaSeconds,
        isFever: feverRemainingMs > 0,
      });
      blocks = physics.blocks;
      balls = physics.balls;
      medals += physics.medalsEarned;
      score += physics.scoreEarned;
      destroyedBlocks += physics.destroyedCount;

      if (physics.message !== null) {
        lastMessage = physics.message;
      }

      if (physics.medalsEarned > 0) {
        eventBusRef.current.publish({ type: "MEDAL_EARNED", amount: physics.medalsEarned });
      }

      if (physics.feverTriggered && nextFeverRemainingMs <= 0) {
        nextFeverRemainingMs = GAME_CONFIG.feverDurationMs;
        eventBusRef.current.publish({ type: "FEVER_STARTED" });
      }

      if (physics.explosions.length > 0) {
        previousExplosions.push(...physics.explosions);
        physics.explosions.forEach((explosion) => {
          eventBusRef.current.publish({ type: "BLOCK_EXPLODED", x: explosion.x, y: explosion.y });
        });
      }
    }

    if (blocks.every((block) => block.destroyed)) {
      blocks = createInitialBlocks();
      medals += 10;
      lastMessage = "すべてのブロックを壊しました。ボーナスメダル +10。ブロックが復活します。";
    }

    return {
      ...current,
      launcher,
      feverRemainingMs: nextFeverRemainingMs,
      blocks,
      balls,
      medals,
      score,
      destroyedBlocks,
      lastMessage,
      lastRespawnAt: shouldRespawn ? now : current.lastRespawnAt,
      pendingVolley,
      explosions: previousExplosions,
    };
  }
}