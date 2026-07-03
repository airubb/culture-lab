import { useEffect, useState } from "react";
import { BLOCK_CONFIG_BY_TYPE } from "@/config/blockConfig";
import { GAME_CONFIG, MEDAL_AREAS } from "@/config/gameConfig";
import type { GameModel } from "@/game/types";

interface ExplosionRingProps {
  x: number;
  y: number;
  createdAt: number;
}

function ExplosionRing({ x, y, createdAt }: ExplosionRingProps) {
  const elapsedMs = performance.now() - createdAt;
  const progress = Math.min(elapsedMs / 400, 1);
  const radius = 14 + progress * 100;
  const opacity = 1 - progress;
  const strokeWidth = 15 - progress * 13;

  // 破片エフェクト
  const particles = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * 45 * Math.PI) / 180;
    const dist = progress * 80;
    return {
      px: x + Math.cos(angle) * dist,
      py: y + Math.sin(angle) * dist,
      r: 4 * (1 - progress),
    };
  });

  return (
    <g>
      {/* 衝撃波 */}
      <circle cx={x} cy={y} r={radius} fill="none" stroke="#fb923c" strokeOpacity={opacity} strokeWidth={strokeWidth} />
      <circle cx={x} cy={y} r={radius * 0.7} fill="none" stroke="#fde047" strokeOpacity={opacity * 0.8} strokeWidth={strokeWidth * 0.7} />
      
      {/* 破片 */}
      {particles.map((p, i) => (
        <circle key={i} cx={p.px} cy={p.py} r={p.r} fill="#fb923c" opacity={opacity} />
      ))}
      
      {/* 中心部 */}
      <circle cx={x} cy={y} r={12 * (1 - progress)} fill="#fff" opacity={opacity} />
    </g>
  );
}

interface GameBoardProps {
  model: GameModel;
  isFever: boolean;
}

export function GameBoard({ model, isFever }: GameBoardProps) {
  const launcherLength = 54;
  const radians = (model.launcher.angle * Math.PI) / 180;
  const launcherEndX = GAME_CONFIG.board.launcherX + Math.cos(radians) * launcherLength;
  const launcherEndY = GAME_CONFIG.board.launcherY - Math.sin(radians) * launcherLength;
  const [, setTick] = useState(0);

  useEffect(() => {
    if (model.explosions.length === 0) {
      return;
    }

    const animationFrameId = window.setInterval(() => setTick((previous) => previous + 1), 33);
    return () => window.clearInterval(animationFrameId);
  }, [model.explosions.length]);

  return (
    <section className="relative flex min-h-[48vh] items-center justify-center overflow-hidden bg-slate-950 px-2 py-3 sm:min-h-[52vh]">
      <div
        className={`absolute inset-0 transition-opacity duration-500 ${
          isFever ? "opacity-80" : "opacity-25"
        }`}
        style={{
          background: isFever
            ? "linear-gradient(120deg, #f0abfc, #fde047, #38bdf8, #4ade80, #f472b6)"
            : "radial-gradient(circle at 50% 12%, rgba(59,130,246,.35), transparent 42%)",
        }}
      />

      <svg
        className="relative h-full max-h-[52vh] w-full max-w-5xl touch-none select-none"
        viewBox={`0 0 ${GAME_CONFIG.board.width} ${GAME_CONFIG.board.height}`}
        role="img"
        aria-label="ブロック崩しエリア"
      >
        <defs>
          <linearGradient id="rainbowBall" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#f472b6" />
            <stop offset="24%" stopColor="#fde047" />
            <stop offset="52%" stopColor="#4ade80" />
            <stop offset="78%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#a78bfa" />
          </linearGradient>
        </defs>

        <rect width="720" height="420" rx="0" fill="rgba(15,23,42,0.82)" />
        <path d="M0 398H720" stroke="rgba(148,163,184,0.45)" strokeWidth="2" />

        {MEDAL_AREAS.map((area) => (
          <g key={area.x}>
            <rect
              x={area.x}
              y="392"
              width={area.width}
              height="22"
              rx="8"
              fill={isFever ? "#fde047" : "#fbbf24"}
              opacity={isFever ? "1" : "0.86"}
            />
            <text
              x={area.x + area.width / 2}
              y="408"
              fill="#422006"
              fontSize="16"
              fontWeight="800"
              textAnchor="middle"
            >
              メダル {area.label}
            </text>
          </g>
        ))}

        {model.blocks.map((block) => {
          const config = BLOCK_CONFIG_BY_TYPE[block.type];
          const opacity = block.destroyed ? 0.12 : 1;

          return (
            <g key={block.id} opacity={opacity}>
              <rect
                x={block.x}
                y={block.y}
                width={block.width}
                height={block.height}
                rx="8"
                fill={block.destroyed ? "#1e293b" : config.fill}
                stroke={block.destroyed ? "#334155" : config.border}
                strokeWidth="3"
              />
              {!block.destroyed && (
                <text
                  x={block.x + block.width / 2}
                  y={block.y + 23}
                  fill="#0f172a"
                  fontSize="14"
                  fontWeight="800"
                  textAnchor="middle"
                >
                  {config.label}
                  {block.maxHp > 1 ? ` ${block.hp}` : ""}
                </text>
              )}
            </g>
          );
        })}

        {model.explosions.map((explosion) => (
          <ExplosionRing key={explosion.id} x={explosion.x} y={explosion.y} createdAt={explosion.createdAt} />
        ))}

        {model.balls.map((ball) => (
          <circle
            key={ball.id}
            cx={ball.x}
            cy={ball.y}
            r={ball.radius}
            fill={ball.fill}
            stroke={ball.stroke}
            strokeWidth="2"
          />
        ))}

        <line
          x1={GAME_CONFIG.board.launcherX}
          y1={GAME_CONFIG.board.launcherY}
          x2={launcherEndX}
          y2={launcherEndY}
          stroke={isFever ? "#fde047" : "#e2e8f0"}
          strokeLinecap="round"
          strokeWidth="12"
        />
        <circle cx={GAME_CONFIG.board.launcherX} cy={GAME_CONFIG.board.launcherY} r="24" fill="#1d4ed8" />
        <circle cx={GAME_CONFIG.board.launcherX} cy={GAME_CONFIG.board.launcherY} r="12" fill="#bfdbfe" />
        <text x="360" y="26" fill="#e2e8f0" fontSize="18" fontWeight="800" textAnchor="middle">
          上半分: ブロック崩し
        </text>
      </svg>
    </section>
  );
}