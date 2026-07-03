import { BALL_CONFIG_BY_SYMBOL } from "@/config/ballConfig";
import { BLOCK_CONFIG_BY_TYPE } from "@/config/blockConfig";
import { GAME_CONFIG, MEDAL_AREAS } from "@/config/gameConfig";
import { SLOT_SYMBOLS } from "@/config/slotConfig";
import { angleToVelocity } from "@/game/LauncherController";
import type { BallInstance, BlockInstance, ExplosionEffect, LauncherState, PhysicsResult, SlotSymbolId } from "@/game/types";

interface StepPhysicsInput {
  balls: BallInstance[];
  blocks: BlockInstance[];
  deltaSeconds: number;
  isFever: boolean;
}

const WALL_BOUNCE_ABILITIES = new Set(["none", "penetrate", "explode", "doubleMedal", "extraBounce", "rainbow"]);

export function createSingleBall(
  symbol: SlotSymbolId,
  launcher: LauncherState,
  isFever: boolean,
  volleyIndex: number,
  totalCount: number,
): BallInstance {
  const ballConfig = BALL_CONFIG_BY_SYMBOL[symbol];
  const spreadStep = totalCount > 1 ? 1.2 : 0;
  const firstOffset = -((totalCount - 1) * spreadStep) / 2;
  const angle = launcher.angle + firstOffset + volleyIndex * spreadStep;
  const speed = ballConfig.speed * (isFever ? 1.08 : 1);
  const { vx, vy } = angleToVelocity(angle, speed);
  const isRainbow = ballConfig.ability === "rainbow";
  const isDoubleMedal = ballConfig.ability === "doubleMedal" || ballConfig.ability === "all" || isRainbow;

  return {
    id: `${symbol}-${Date.now()}-${volleyIndex}-${Math.random().toString(36).slice(2, 6)}`,
    x: GAME_CONFIG.board.launcherX,
    y: GAME_CONFIG.board.launcherY - 20,
    vx,
    vy,
    radius: ballConfig.radius,
    symbol,
    ability: ballConfig.ability,
    colorName: ballConfig.colorName,
    fill: ballConfig.fill,
    stroke: ballConfig.stroke,
    bouncesLeft: ballConfig.bounces,
    medalMultiplier: isDoubleMedal ? 2 : 1,
  } satisfies BallInstance;
}

export function createVolley(symbol: SlotSymbolId, launcher: LauncherState, isFever: boolean): BallInstance[] {
  const symbolConfig = SLOT_SYMBOLS.find((slotSymbol) => slotSymbol.id === symbol);
  const ballCount = symbolConfig?.ballCount ?? 1;

  return Array.from({ length: ballCount }, (_, index) => createSingleBall(symbol, launcher, isFever, index, ballCount));
}

export function stepGamePhysics(input: StepPhysicsInput): PhysicsResult & { explosions: ExplosionEffect[] } {
  const nextBlocks = input.blocks.map((block) => ({ ...block, justExploded: false }));
  const nextBalls: BallInstance[] = [];
  const explosions: ExplosionEffect[] = [];
  let medalsEarned = 0;
  let scoreEarned = 0;
  let destroyedCount = 0;
  let feverTriggered = false;
  let message: string | null = null;

  for (const ball of input.balls) {
    const movedBall = moveBall(ball, input.deltaSeconds);

    if (handleMedalArea(movedBall, input.isFever) > 0) {
      const earned = handleMedalArea(movedBall, input.isFever);
      medalsEarned += earned;
      message = `メダルエリアに入りました。メダル +${earned}`;
      continue;
    }

    if (!handleWallCollision(movedBall)) {
      continue;
    }

    const hitBlock = nextBlocks.find((block) => !block.destroyed && isBallTouchingBlock(movedBall, block));

    if (hitBlock) {
      const rewards = applyBlockHit(hitBlock, movedBall, nextBlocks, input.isFever);
      medalsEarned += rewards.medals;
      scoreEarned += rewards.score;
      destroyedCount += rewards.destroyedCount;
      feverTriggered = feverTriggered || rewards.feverTriggered;
      message = rewards.message;

      if (rewards.exploded) {
        explosions.push({
          id: `explosion-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          x: hitBlock.x + hitBlock.width / 2,
          y: hitBlock.y + hitBlock.height / 2,
          createdAt: performance.now(),
        });
      }

      if (movedBall.ability !== "penetrate" && movedBall.ability !== "all" && movedBall.ability !== "rainbow") {
        movedBall.vy *= -1;
        movedBall.bouncesLeft -= 1;
      }
    }

    if (movedBall.bouncesLeft >= 0) {
      nextBalls.push(movedBall);
    }
  }

  return {
    balls: nextBalls,
    blocks: nextBlocks,
    medalsEarned,
    scoreEarned,
    destroyedCount,
    feverTriggered,
    message,
    explosions,
  };
}

function moveBall(ball: BallInstance, deltaSeconds: number): BallInstance {
  return {
    ...ball,
    x: ball.x + ball.vx * deltaSeconds,
    y: ball.y + ball.vy * deltaSeconds,
  };
}

function handleMedalArea(ball: BallInstance, isFever: boolean): number {
  const bottomLine = GAME_CONFIG.board.height - 24;

  if (ball.y + ball.radius < bottomLine) {
    return 0;
  }

  const area = MEDAL_AREAS.find((medalArea) => ball.x >= medalArea.x && ball.x <= medalArea.x + medalArea.width);

  if (!area) {
    return ball.y > GAME_CONFIG.board.height + 40 ? 0 : 0;
  }

  const feverMultiplier = isFever ? 2 : 1;
  return area.reward * ball.medalMultiplier * feverMultiplier;
}

function handleWallCollision(ball: BallInstance): boolean {
  const passesWall = ball.ability === "wallPass" || ball.ability === "all" || ball.ability === "rainbow";

  if (ball.x - ball.radius <= 0 || ball.x + ball.radius >= GAME_CONFIG.board.width) {
    if (passesWall) {
      return ball.x > -40 && ball.x < GAME_CONFIG.board.width + 40;
    }

    ball.vx *= -1;
    ball.x = Math.min(Math.max(ball.x, ball.radius), GAME_CONFIG.board.width - ball.radius);
    ball.bouncesLeft -= 1;
  }

  if (ball.y - ball.radius <= 0) {
    if (passesWall) {
      return ball.y > -40;
    }

    ball.vy *= -1;
    ball.y = ball.radius;
    ball.bouncesLeft -= 1;
  }

  if (ball.y > GAME_CONFIG.board.height + 44) {
    return false;
  }

  return WALL_BOUNCE_ABILITIES.has(ball.ability) || passesWall;
}

function isBallTouchingBlock(ball: BallInstance, block: BlockInstance): boolean {
  const closestX = clamp(ball.x, block.x, block.x + block.width);
  const closestY = clamp(ball.y, block.y, block.y + block.height);
  const distanceX = ball.x - closestX;
  const distanceY = ball.y - closestY;

  return distanceX * distanceX + distanceY * distanceY <= ball.radius * ball.radius;
}

function applyBlockHit(
  block: BlockInstance,
  ball: BallInstance,
  blocks: BlockInstance[],
  isFever: boolean,
): { medals: number; score: number; destroyedCount: number; feverTriggered: boolean; message: string; exploded: boolean } {
  const isPenetrating = ball.ability === "penetrate" || ball.ability === "all";
  block.hp -= isPenetrating ? 2 : 1;

  if (block.hp > 0) {
    return {
      medals: 0,
      score: 0,
      destroyedCount: 0,
      feverTriggered: false,
      message: "鉄ブロックにヒット。もう一回で壊れます。",
      exploded: false,
    };
  }

  return destroyBlock(block, ball, blocks, isFever);
}

function destroyBlock(
  block: BlockInstance,
  ball: BallInstance,
  blocks: BlockInstance[],
  isFever: boolean,
): { medals: number; score: number; destroyedCount: number; feverTriggered: boolean; message: string; exploded: boolean } {
  const config = BLOCK_CONFIG_BY_TYPE[block.type];
  const feverMultiplier = isFever ? 2 : 1;
  let medals = config.medalReward * ball.medalMultiplier * feverMultiplier;
  let score = config.score;
  let destroyedCount = block.destroyed ? 0 : 1;
  let feverTriggered = block.type === "fever";
  const exploded = block.type === "explode" || ball.ability === "explode" || ball.ability === "all" || ball.ability === "rainbow";

  block.destroyed = true;
  block.justExploded = exploded;

  if (exploded) {
    const nearbyBlocks = blocks.filter(
      (candidate) => !candidate.destroyed && candidate.id !== block.id && isNearBlock(block, candidate),
    );

    for (const nearbyBlock of nearbyBlocks.slice(0, 3)) {
      const nearbyConfig = BLOCK_CONFIG_BY_TYPE[nearbyBlock.type];
      nearbyBlock.destroyed = true;
      nearbyBlock.justExploded = true;
      medals += nearbyConfig.medalReward * ball.medalMultiplier * feverMultiplier;
      score += nearbyConfig.score;
      destroyedCount += 1;
      feverTriggered = feverTriggered || nearbyBlock.type === "fever";
    }
  }

  if (block.type === "recover") {
    medals += 2 * feverMultiplier;
  }

  return {
    medals,
    score,
    destroyedCount,
    feverTriggered,
    exploded,
    message: `${config.label}ブロックを壊しました。`,
  };
}

function isNearBlock(source: BlockInstance, target: BlockInstance): boolean {
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const targetCenterX = target.x + target.width / 2;
  const targetCenterY = target.y + target.height / 2;
  const distanceX = sourceCenterX - targetCenterX;
  const distanceY = sourceCenterY - targetCenterY;

  return Math.sqrt(distanceX * distanceX + distanceY * distanceY) < 130;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}