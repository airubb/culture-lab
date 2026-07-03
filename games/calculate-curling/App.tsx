import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, Volume2, VolumeX, User, Cpu, Award, 
  Brain, Sparkles, Target, Zap
} from 'lucide-react';

// ==========================================
// A. 型定義 & 物理・ゲームパラメータ
// ==========================================
type GameMode = 'cpu' | 'local';
type CpuDifficulty = 'easy' | 'normal' | 'hard';
type StoneStatus = 'idle' | 'aiming' | 'sliding' | 'stopped'; 

const BOARD_WIDTH = 500;
const BOARD_HEIGHT = 600;
const HEADER_HEIGHT = 80;
const GRID_ROWS = 4;
const GRID_COLS = 5;
const CELL_SIZE = 100; 
const STONE_RADIUS = 18;
const FRICTION = 0.985;
const BOUNCE = 0.8;
const MAX_LAUNCH_VELOCITY = 17; 

interface Token {
  type: 'num' | 'op';
  val: string; 
}

interface PlayedStone {
  id: string;      
  player: 1 | 2;   
  x: number;
  y: number;
  vx: number;
  vy: number;
  op: '+' | '-' | '*' | '/'; 
  capturedNum: number;      
}

interface PlayerState {
  tokens: Token[];
  currentValue: number;
  turnsLeft: number;
  shotHistory: {
    startPos: { x: number; y: number };
    endPos: { x: number; y: number };
    numberCaptured: number;
    opUsed: string;
    resultValue: number;
  }[];
  aimErrors: number[];      
  powerErrors: number[];    
  decisionTimes: number[];  
  selectionQuality: number[]; 
}

interface BoardCell {
  num: number; 
  x: number;   
  y: number;   
}

// ==========================================
// B. サウンドエンジン (Web Audio API)
// ==========================================
class SoundManager {
  private ctx: AudioContext | null = null;
  public muted: boolean = false;

  private initCtx() {
    if (!this.ctx) {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playAim(pitchPercent: number) {
    if (this.muted) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220 + pitchPercent * 440, ctx.currentTime);
    
    gain.gain.setValueAtTime(0.03, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  }

  playLaunch() {
    if (this.muted) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const bufferSize = ctx.sampleRate * 0.4;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'lowpass';
    noiseFilter.frequency.setValueAtTime(800, ctx.currentTime);
    noiseFilter.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.4);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.15, ctx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);

    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.3);
    
    oscGain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);

    noise.start();
    osc.start();
    noise.stop(ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  }

  playBounce() {
    if (this.muted) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(90, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  playCapture() {
    if (this.muted) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(523.25, now); 
    gain1.gain.setValueAtTime(0.12, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(783.99, now + 0.08); 
    gain2.gain.setValueAtTime(0.12, now + 0.08);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.08);
    osc2.stop(now + 0.25);
  }

  playSuccess() {
    if (this.muted) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const chords = [261.63, 329.63, 392.00, 523.25]; 

    chords.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      osc.frequency.setValueAtTime(freq * 1.5, now + 0.4);
      
      gain.gain.setValueAtTime(0.1, now + idx * 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.08);
      osc.stop(now + 0.8);
    });
  }

  playGameEnd() {
    if (this.muted) return;
    this.initCtx();
    const ctx = this.ctx;
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [349.23, 392.00, 440.00, 523.25, 587.33, 659.25]; 

    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      gain.gain.setValueAtTime(0.12, now + idx * 0.12);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.5);
    });
  }
}

const sounds = new SoundManager();

// ==========================================
// C. 数式トークンと計算エンジン
// ==========================================
function evaluateFormula(tokens: Token[]): number {
  if (tokens.length === 0) return 0;
  
  let tempTokens: { type: 'num' | 'op'; val: number | string }[] = [];
  
  let i = 0;
  while (i < tokens.length && tokens[i].type === 'op') {
    i++;
  }
  if (i >= tokens.length) return 0;
  
  tempTokens.push({ type: 'num', val: parseFloat(tokens[i].val) });
  i++;

  while (i < tokens.length) {
    const token = tokens[i];
    if (token.type === 'op') {
      tempTokens.push({ type: 'op', val: token.val });
    } else {
      tempTokens.push({ type: 'num', val: parseFloat(token.val) });
    }
    i++;
  }

  // 1. 掛け算 (*) と 割り算 (/) を優先処理
  let postMD: { type: 'num' | 'op'; val: number | string }[] = [];
  let idx = 0;
  while (idx < tempTokens.length) {
    const token = tempTokens[idx];
    if (token.type === 'op' && (token.val === '*' || token.val === '/')) {
      const op = token.val;
      const prev = postMD.pop();
      const next = tempTokens[idx + 1];
      
      if (prev && prev.type === 'num' && next && next.type === 'num') {
        let res = 0;
        const v1 = prev.val as number;
        const v2 = next.val as number;
        if (op === '*') {
          res = v1 * v2;
        } else {
          res = v2 !== 0 ? Math.floor(v1 / v2) : 0; 
        }
        postMD.push({ type: 'num', val: res });
        idx += 2; 
      } else {
        if (prev) postMD.push(prev);
        postMD.push(token);
        idx++;
      }
    } else {
      postMD.push(token);
      idx++;
    }
  }

  // 2. 足し算 (+) と 引き算 (-) を処理
  if (postMD.length === 0) return 0;
  let result = postMD[0].type === 'num' ? (postMD[0].val as number) : 0;
  
  idx = 1;
  while (idx < postMD.length) {
    const opToken = postMD[idx];
    const numToken = postMD[idx + 1];
    if (opToken && opToken.type === 'op' && numToken && numToken.type === 'num') {
      const op = opToken.val as string;
      const val = numToken.val as number;
      if (op === '+') result += val;
      else if (op === '-') result -= val;
    }
    idx += 2;
  }

  return Math.floor(result);
}

function formatFormula(tokens: Token[]): string {
  if (tokens.length === 0) return '未投入';
  
  let str = '';
  let skipOp = true;
  
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.type === 'op') {
      if (skipOp) {
        continue;
      }
      let opChar = t.val;
      if (opChar === '*') opChar = '×';
      if (opChar === '/') opChar = '÷';
      str += ` ${opChar} `;
    } else {
      str += t.val;
      skipOp = false;
    }
  }
  return str || '0';
}

// ==========================================
// D. 脳活スコアの計算 ＆ レーダーチャート計算ヘルパー
// ==========================================
function calculateDiagnosticScores(player: PlayerState, targetVal: number) {
  const avgSelectionQuality = player.selectionQuality.length > 0 
    ? player.selectionQuality.reduce((a, b) => a + b, 0) / player.selectionQuality.length
    : 80;
  const calcScore = Math.round(Math.max(40, Math.min(100, avgSelectionQuality)));

  const avgAimError = player.aimErrors.length > 0
    ? player.aimErrors.reduce((a, b) => a + b, 0) / player.aimErrors.length
    : 50;
  const spatialScore = Math.round(Math.max(40, Math.min(100, 110 - (avgAimError * 0.45))));

  const attentionScore = Math.round(Math.max(45, Math.min(100, 100 - (player.aimErrors.reduce((a,b)=>a+b, 0) / 15))));

  const finalDiff = Math.abs(player.currentValue - targetVal);
  let wmScore = 100 - (finalDiff * 2.5);
  wmScore = Math.round(Math.max(40, Math.min(100, wmScore)));

  const avgDecisionTime = player.decisionTimes.length > 0
    ? (player.decisionTimes.reduce((a, b) => a + b, 0) / player.decisionTimes.length) / 1000
    : 5;
  let decisionScore = 100;
  if (avgDecisionTime < 2) {
    decisionScore = 75; 
  } else if (avgDecisionTime > 12) {
    decisionScore = 80; 
  } else {
    decisionScore = 100 - (avgDecisionTime - 4) * 2; 
  }
  decisionScore = Math.round(Math.max(50, Math.min(100, decisionScore)));

  return {
    calc: calcScore,
    spatial: spatialScore,
    attention: attentionScore,
    wm: wmScore,
    decision: decisionScore
  };
}

function getDiagnosticAdvice(scores: { calc: number; spatial: number; attention: number; wm: number; decision: number }) {
  const minScore = Math.min(scores.calc, scores.spatial, scores.attention, scores.wm, scores.decision);
  
  let weakPoint = '';
  if (minScore === scores.calc) weakPoint = '計算力';
  else if (minScore === scores.spatial) weakPoint = '空間認知力';
  else if (minScore === scores.attention) weakPoint = '注意力';
  else if (minScore === scores.wm) weakPoint = 'ワーキングメモリ';
  else weakPoint = '判断力';

  const advices: Record<string, string> = {
    '計算力': '四則演算を頭の中でシミュレーションする速度を高めるとさらにスコアが伸びます。普段から買い物時のお釣りの計算などを意識して行うのがおすすめです。',
    '空間認知力': 'ストーンが壁でどのように反射するか、その角度とスピードを予想する力を鍛えましょう。折り紙や地図を見る習慣が空間認識の維持に役立ちます。',
    '注意力': '引っ張っている間に動くゲージを見極め、ベストなタイミングで指を離す高い集中力が必要です。リズムを掴んでリリースすると安定します。',
    'ワーキングメモリ': 'これまでの途中式と次の演算子を頭の中に留めておくトレーニングになります。ゲーム中、次の次の一手を常に頭に思い描くよう意識してみましょう。',
    '判断力': 'ピンチのときでも焦らず、今一番効果的なマスを冷静に見分けることができました。日々のルーティンに少し変化を取り入れると、即断即決の脳力がさらに活性化します。',
  };

  return {
    weakPoint,
    advice: advices[weakPoint] || '全体的に非常にバランスが良く、素晴らしい脳の活性化が見られます！今後もこの調子で脳トレを習慣化していましょう。'
  };
}

function getRadarCoordinates(scores: { calc: number; spatial: number; attention: number; wm: number; decision: number }, size: number) {
  const center = size / 2;
  const r = (size / 2) * 0.75; 

  const angles = [
    -Math.PI / 2,                  
    -Math.PI / 2 + (Math.PI * 2) / 5,  
    -Math.PI / 2 + (Math.PI * 4) / 5,  
    -Math.PI / 2 + (Math.PI * 6) / 5,  
    -Math.PI / 2 + (Math.PI * 8) / 5,  
  ];

  const values = [scores.calc, scores.spatial, scores.attention, scores.wm, scores.decision];
  const points = values.map((val, idx) => {
    const radius = r * (val / 100);
    const x = center + radius * Math.cos(angles[idx]);
    const y = center + radius * Math.sin(angles[idx]);
    return { x, y };
  });

  return {
    pointsStr: points.map(p => `${p.x},${p.y}`).join(' '),
    points,
    center,
    r,
    angles
  };
}

// ==========================================
// E. メインコンポーネント
// ==========================================
export default function App() {
  const [screen, setScreen] = useState<'menu' | 'playing' | 'diagnosing'>('menu');
  const [gameMode, setGameMode] = useState<GameMode>('cpu');
  const [cpuDifficulty, setCpuDifficulty] = useState<CpuDifficulty>('normal');
  const [isMuted, setIsMuted] = useState(false);

  const [targetValue, setTargetValue] = useState<number>(30);
  const [board, setBoard] = useState<BoardCell[]>([]);
  const [currentPlayer, setCurrentPlayer] = useState<1 | 2>(1);
  const [player1, setPlayer1] = useState<PlayerState>(createInitialPlayerState());
  const [player2, setPlayer2] = useState<PlayerState>(createInitialPlayerState());
  
  const [playedStones, setPlayedStones] = useState<PlayedStone[]>([]);

  const [stoneX, setStoneX] = useState(250);
  const [stoneY, setStoneY] = useState(540);
  const [stoneVx, setStoneVx] = useState(0);
  const [stoneVy, setStoneVy] = useState(0);
  const [stoneStatus, setStoneStatus] = useState<StoneStatus>('idle');
  const [currentOperator, setCurrentOperator] = useState<'+' | '-' | '*' | '/'>('+');

  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);
  
  const [powerPercent, setPowerPercent] = useState<number>(0);
  const [powerDirection, setPowerDirection] = useState<1 | -1>(1);

  const [capturedCell, setCapturedCell] = useState<{ row: number; col: number; num: number; x: number; y: number; op: string } | null>(null);
  const [popupText, setPopupText] = useState<string | null>(null);
  const [confettiActive, setConfettiActive] = useState(false);
  const [winMessage, setWinMessage] = useState<string>('');
  
  const [isCpuThinking, setIsCpuThinking] = useState(false);
  const [cpuTargetCell, setCpuTargetCell] = useState<BoardCell | null>(null);

  const turnStartTimeRef = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  function createInitialPlayerState(): PlayerState {
    return {
      tokens: [],
      currentValue: 0,
      turnsLeft: 5,
      shotHistory: [],
      aimErrors: [],
      powerErrors: [],
      decisionTimes: [],
      selectionQuality: []
    };
  }

  // ==========================================
  // マウス/タッチ座標の取得
  // ==========================================
  const getCanvasCoords = (e: React.MouseEvent | React.TouchEvent) => {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    
    let clientX = 0;
    let clientY = 0;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const scaleX = BOARD_WIDTH / rect.width;
    const scaleY = BOARD_HEIGHT / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const toggleMute = () => {
    sounds.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const startNewGame = () => {
    const target = Math.floor(Math.random() * 41) + 10;
    setTargetValue(target);

    const newBoard: BoardCell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        newBoard.push({
          num: Math.floor(Math.random() * 9) + 1, 
          x: c * CELL_SIZE + CELL_SIZE / 2,
          y: HEADER_HEIGHT + r * CELL_SIZE + CELL_SIZE / 2
        });
      }
    }
    setBoard(newBoard);

    setPlayer1(createInitialPlayerState());
    setPlayer2(createInitialPlayerState());
    setPlayedStones([]); 
    setCurrentPlayer(1);

    resetStoneForTurn('+'); 
    
    setCapturedCell(null);
    setPopupText(null);
    setConfettiActive(false);
    setScreen('playing');
    setIsCpuThinking(false);
    setCpuTargetCell(null);
    
    turnStartTimeRef.current = Date.now();
  };

  const resetStoneForTurn = (forcedOp?: '+' | '-' | '*' | '/') => {
    setStoneX(250);
    setStoneY(540);
    setStoneVx(0);
    setStoneVy(0);
    setStoneStatus('idle');
    setDragStart(null);
    setDragCurrent(null);
    setPowerDirection(1);

    if (forcedOp) {
      setCurrentOperator(forcedOp);
    } else {
      const ops: ('+' | '-' | '*' | '/')[] = ['+', '-', '*', '/'];
      const randOp = ops[Math.floor(Math.random() * ops.length)];
      setCurrentOperator(randOp);
    }
    
    turnStartTimeRef.current = Date.now();
  };

  const getCellNumAt = (x: number, y: number): number => {
    let col = Math.floor(x / CELL_SIZE);
    let row = Math.floor((y - HEADER_HEIGHT) / CELL_SIZE);
    col = Math.max(0, Math.min(GRID_COLS - 1, col));
    row = Math.max(0, Math.min(GRID_ROWS - 1, row));
    const idx = row * GRID_COLS + col;
    return board[idx] ? board[idx].num : 1;
  };

  // ==========================================
  // 発射関数
  // ==========================================
  const fireStone = (angle: number, powerRatio: number) => {
    const vx = Math.cos(angle) * (powerRatio * MAX_LAUNCH_VELOCITY);
    const vy = Math.sin(angle) * (powerRatio * MAX_LAUNCH_VELOCITY);

    setStoneVx(vx);
    setStoneVy(vy);
    setStoneStatus('sliding');
    sounds.playLaunch();
  };

  // ==========================================
  // マウスダウン（ドラッグ開始）ハンドラ
  // ==========================================
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (screen !== 'playing' || stoneStatus !== 'idle') return;
    if (gameMode === 'cpu' && currentPlayer === 2) return; 

    const coords = getCanvasCoords(e);
    const distToStone = Math.hypot(coords.x - stoneX, coords.y - stoneY);
    if (distToStone < 40) {
      if (e.cancelable) e.preventDefault();
      setPowerPercent(0);
      setPowerDirection(1);
      setStoneStatus('aiming');
      setDragStart({ x: stoneX, y: stoneY });
      setDragCurrent(coords);
      sounds.playAim(0.1);
    }
  };

  // ==========================================
  // マウス移動（ドラッグ中）ハンドラ
  // ==========================================
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (stoneStatus !== 'aiming' || !dragStart) return;
    if (e.cancelable) e.preventDefault();

    const coords = getCanvasCoords(e);
    setDragCurrent(coords);

    const dx = coords.x - dragStart.x;
    const dy = coords.y - dragStart.y;
    const dist = Math.min(120, Math.hypot(dx, dy));
    if (Math.random() < 0.15) {
      sounds.playAim(dist / 120);
    }
  };

  // ==========================================
  // マウスアップ（ドラッグ終了＝発射）ハンドラ
  // ==========================================
  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (stoneStatus !== 'aiming' || !dragStart || !dragCurrent) return;
    if (e.cancelable) e.preventDefault();

    const dx = dragCurrent.x - dragStart.x;
    const dy = dragCurrent.y - dragStart.y;
    const dragDistance = Math.hypot(dx, dy);

    if (dragDistance < 10) {
      setStoneStatus('idle');
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const angle = Math.atan2(-dy, -dx);
    const aimPower = Math.min(120, dragDistance) / 120;
    const finalPowerRatio = aimPower * (0.2 + (powerPercent / 100) * 0.8);

    setDragStart(null);
    setDragCurrent(null);
    fireStone(angle, finalPowerRatio);
  };

  // ==========================================
  // 物理シミュレーション (Game Loop & 衝突判定)
  // ==========================================
  useEffect(() => {
    if (screen !== 'playing' || stoneStatus !== 'sliding') return;

    let animFrameId: number;
    
    let active = { x: stoneX, y: stoneY, vx: stoneVx, vy: stoneVy };
    let stones = playedStones.map(s => ({ ...s }));

    const updatePhysics = () => {
      active.x += active.vx;
      active.y += active.vy;
      active.vx *= FRICTION;
      active.vy *= FRICTION;

      stones.forEach(s => {
        s.x += s.vx;
        s.y += s.vy;
        s.vx *= FRICTION;
        s.vy *= FRICTION;
      });

      // 壁反射と場外防止 (厳密に境界クランプしてはみ出しをゼロにする)
      const handleWallCollision = (obj: { x: number; y: number; vx: number; vy: number }) => {
        if (obj.x - STONE_RADIUS < 0) {
          obj.x = STONE_RADIUS;
          obj.vx = -obj.vx * BOUNCE;
          sounds.playBounce();
        } else if (obj.x + STONE_RADIUS > BOARD_WIDTH) {
          obj.x = BOARD_WIDTH - STONE_RADIUS;
          obj.vx = -obj.vx * BOUNCE;
          sounds.playBounce();
        }

        if (obj.y - STONE_RADIUS < HEADER_HEIGHT) {
          obj.y = HEADER_HEIGHT + STONE_RADIUS;
          obj.vy = -obj.vy * BOUNCE;
          sounds.playBounce();
        } else if (obj.y + STONE_RADIUS > BOARD_HEIGHT) {
          obj.y = BOARD_HEIGHT - STONE_RADIUS;
          obj.vy = -obj.vy * BOUNCE;
          sounds.playBounce();
        }
      };

      handleWallCollision(active);
      stones.forEach(handleWallCollision);

      // 円同士の衝突判定 (弾性衝突)
      const allObjects = [active, ...stones];
      const minDist = STONE_RADIUS * 2;

      for (let i = 0; i < allObjects.length; i++) {
        for (let j = i + 1; j < allObjects.length; j++) {
          const o1 = allObjects[i];
          const o2 = allObjects[j];
          const dx = o2.x - o1.x;
          const dy = o2.y - o1.y;
          const dist = Math.hypot(dx, dy);

          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / (dist || 1);
            const ny = dy / (dist || 1);

            o1.x -= nx * overlap * 0.5;
            o1.y -= ny * overlap * 0.5;
            o2.x += nx * overlap * 0.5;
            o2.y += ny * overlap * 0.5;

            const kx = o1.vx - o2.vx;
            const ky = o1.vy - o2.vy;
            const p = nx * kx + ny * ky;

            if (p > 0) { 
              o1.vx -= p * nx * BOUNCE;
              o1.vy -= p * ny * BOUNCE;
              o2.vx += p * nx * BOUNCE;
              o2.vy += p * ny * BOUNCE;
              sounds.playBounce();
            }
          }
        }
      }

      allObjects.forEach(handleWallCollision);

      setStoneX(active.x);
      setStoneY(active.y);
      setStoneVx(active.vx);
      setStoneVy(active.vy);
      
      const updatedStones = stones.map((s, idx) => {
        const num = getCellNumAt(s.x, s.y);
        return {
          ...playedStones[idx],
          x: s.x,
          y: s.y,
          vx: s.vx,
          vy: s.vy,
          capturedNum: num
        };
      });
      setPlayedStones(updatedStones);

      const activeSpeed = Math.hypot(active.vx, active.vy);
      const stonesSpeed = stones.reduce((acc, s) => acc + Math.hypot(s.vx, s.vy), 0);

      if (activeSpeed < 0.15 && stonesSpeed < 0.15) {
        setStoneStatus('stopped');
        
        active.vx = 0;
        active.vy = 0;
        updatedStones.forEach(s => {
          s.vx = 0;
          s.vy = 0;
        });
        setPlayedStones(updatedStones);

        handleAllStonesStopped(active.x, active.y, updatedStones);
      } else {
        animFrameId = requestAnimationFrame(updatePhysics);
      }
    };

    animFrameId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animFrameId);
  }, [stoneStatus, screen, stoneX, stoneY, stoneVx, stoneVy, playedStones]);

  // パワーゲージのアニメーションループ (aiming 中に動作)
  useEffect(() => {
    if (screen !== 'playing' || stoneStatus !== 'aiming') return;

    const interval = setInterval(() => {
      setPowerPercent((prev) => {
        let next = prev + powerDirection * 5;
        if (next >= 100) {
          next = 100;
          setPowerDirection(-1);
        } else if (next <= 0) {
          next = 0;
          setPowerDirection(1);
        }
        return next;
      });
    }, 16);

    return () => clearInterval(interval);
  }, [stoneStatus, powerDirection, screen]);

  // ==========================================
  // 5. ショット終了・スコア再計算
  // ==========================================
  const handleAllStonesStopped = (finalX: number, finalY: number, currentStones: PlayedStone[]) => {
    let col = Math.floor(finalX / CELL_SIZE);
    let row = Math.floor((finalY - HEADER_HEIGHT) / CELL_SIZE);
    col = Math.max(0, Math.min(GRID_COLS - 1, col));
    row = Math.max(0, Math.min(GRID_ROWS - 1, row));

    const cellIndex = row * GRID_COLS + col;
    const cell = board[cellIndex];
    
    if (!cell) {
      advanceTurn();
      return;
    }

    const capturedNum = cell.num;
    const op = currentOperator;

    setCapturedCell({
      row,
      col,
      num: capturedNum,
      x: cell.x,
      y: cell.y,
      op: op
    });

    const activePlayer = currentPlayer === 1 ? player1 : player2;
    const isFirstShot = activePlayer.tokens.length === 0;
    const opSymbol = op === '*' ? '×' : op === '/' ? '÷' : op;
    const displayPop = isFirstShot ? `${capturedNum}` : `${opSymbol} ${capturedNum}`;
    setPopupText(displayPop);
    sounds.playCapture();

    const newStone: PlayedStone = {
      id: Math.random().toString(36).substr(2, 9),
      player: currentPlayer,
      x: finalX,
      y: finalY,
      vx: 0,
      vy: 0,
      op: op,
      capturedNum: capturedNum
    };

    const nextStones = [...currentStones, newStone];
    setPlayedStones(nextStones);

    const decisionTime = Date.now() - turnStartTimeRef.current;
    let aimError = 0;
    if (gameMode === 'cpu' && currentPlayer === 2 && cpuTargetCell) {
      aimError = Math.hypot(finalX - cpuTargetCell.x, finalY - cpuTargetCell.y);
    } else {
      aimError = Math.hypot(finalX - cell.x, finalY - cell.y);
    }

    const scores = board.map((c) => {
      const testTokens = [...activePlayer.tokens, { type: 'op', val: op } as Token, { type: 'num', val: String(c.num) } as Token];
      const val = evaluateFormula(testTokens);
      return { cell: c, diff: Math.abs(val - targetValue) };
    });
    scores.sort((a, b) => a.diff - b.diff);
    const bestDiff = scores[0].diff;
    const worstDiff = scores[scores.length - 1].diff;
    
    const testTokens = [...activePlayer.tokens, { type: 'op', val: op } as Token, { type: 'num', val: String(capturedNum) } as Token];
    const actualDiff = Math.abs(evaluateFormula(testTokens) - targetValue);
    let selectionQuality = 100;
    if (worstDiff !== bestDiff) {
      selectionQuality = Math.round(100 * (1 - (actualDiff - bestDiff) / (worstDiff - bestDiff)));
    }

    setTimeout(() => {
      setCapturedCell(null);
      setPopupText(null);
      recalculatePlayerValues(nextStones, aimError, decisionTime, selectionQuality);
    }, 1500);
  };

  const recalculatePlayerValues = (
    allStones: PlayedStone[], 
    aimError: number, 
    decisionTime: number, 
    selectionQuality: number
  ) => {
    const p1Stones = allStones.filter(s => s.player === 1);
    const p2Stones = allStones.filter(s => s.player === 2);

    const p1Tokens: Token[] = [];
    p1Stones.forEach(s => {
      p1Tokens.push({ type: 'op', val: s.op });
      p1Tokens.push({ type: 'num', val: String(s.capturedNum) });
    });
    const p1Val = evaluateFormula(p1Tokens);

    const p2Tokens: Token[] = [];
    p2Stones.forEach(s => {
      p2Tokens.push({ type: 'op', val: s.op });
      p2Tokens.push({ type: 'num', val: String(s.capturedNum) });
    });
    const p2Val = evaluateFormula(p2Tokens);

    setPlayer1(prev => {
      const isMyTurn = currentPlayer === 1;
      return {
        ...prev,
        tokens: p1Tokens,
        currentValue: p1Val,
        turnsLeft: isMyTurn ? prev.turnsLeft - 1 : prev.turnsLeft,
        aimErrors: isMyTurn ? [...prev.aimErrors, aimError] : prev.aimErrors,
        decisionTimes: isMyTurn ? [...prev.decisionTimes, decisionTime] : prev.decisionTimes,
        selectionQuality: isMyTurn ? [...prev.selectionQuality, selectionQuality] : prev.selectionQuality
      };
    });

    setPlayer2(prev => {
      const isMyTurn = currentPlayer === 2;
      return {
        ...prev,
        tokens: p2Tokens,
        currentValue: p2Val,
        turnsLeft: isMyTurn ? prev.turnsLeft - 1 : prev.turnsLeft,
        aimErrors: isMyTurn ? [...prev.aimErrors, aimError] : prev.aimErrors,
        decisionTimes: isMyTurn ? [...prev.decisionTimes, decisionTime] : prev.decisionTimes,
        selectionQuality: isMyTurn ? [...prev.selectionQuality, selectionQuality] : prev.selectionQuality
      };
    });

    advanceTurn();
  };

  const advanceTurn = () => {
    const isP1Turn = currentPlayer === 1;
    const nextPlayer = isP1Turn ? 2 : 1;
    
    const p1Remaining = isP1Turn ? player1.turnsLeft - 1 : player1.turnsLeft;
    const p2Remaining = !isP1Turn ? player2.turnsLeft - 1 : player2.turnsLeft;

    if (p1Remaining === 0 && p2Remaining === 0) {
      handleGameEnd();
    } else {
      setCurrentPlayer(nextPlayer);
      resetStoneForTurn();
    }
  };

  const handleGameEnd = () => {
    // 最新のストーン位置から計算値を再取得して正確に勝敗判定する
    setTimeout(() => {
      // playedStones から最新の計算結果を取得
      const p1Stones = playedStones.filter(s => s.player === 1);
      const p2Stones = playedStones.filter(s => s.player === 2);

      const p1Tokens: Token[] = [];
      p1Stones.forEach(s => {
        p1Tokens.push({ type: 'op', val: s.op });
        p1Tokens.push({ type: 'num', val: String(s.capturedNum) });
      });
      const p1FinalVal = evaluateFormula(p1Tokens);

      const p2Tokens: Token[] = [];
      p2Stones.forEach(s => {
        p2Tokens.push({ type: 'op', val: s.op });
        p2Tokens.push({ type: 'num', val: String(s.capturedNum) });
      });
      const p2FinalVal = evaluateFormula(p2Tokens);

      // 最新値でプレイヤーステートも更新
      setPlayer1(prev => ({ ...prev, tokens: p1Tokens, currentValue: p1FinalVal }));
      setPlayer2(prev => ({ ...prev, tokens: p2Tokens, currentValue: p2FinalVal }));

      setScreen('diagnosing');
      sounds.playGameEnd();

      const p1Diff = Math.abs(p1FinalVal - targetValue);
      const p2Diff = Math.abs(p2FinalVal - targetValue);

      let msg = '';
      if (p1Diff < p2Diff) {
        msg = gameMode === 'cpu' ? 'Player 1（あなた）の勝利！ 🎉' : 'Player 1 の勝利！ 🎉';
        setConfettiActive(true);
        sounds.playSuccess();
      } else if (p2Diff < p1Diff) {
        msg = gameMode === 'cpu' ? 'CPU の勝利！ 🤖' : 'Player 2 の勝利！ 🎉';
        if (gameMode === 'local') {
          setConfettiActive(true);
          sounds.playSuccess();
        }
      } else {
        msg = '引き分け！両者素晴らしい計算力です！ 🤝';
      }
      setWinMessage(msg);
    }, 500);
  };

  // ==========================================
  // 6. CPU思考アルゴリズム & アニメーション演出
  // ==========================================
  useEffect(() => {
    if (screen !== 'playing' || currentPlayer !== 2 || gameMode !== 'cpu' || stoneStatus !== 'idle') return;

    setIsCpuThinking(true);
    
    const thinkTimer = setTimeout(() => {
      const targetCell = selectCpuTarget();
      setCpuTargetCell(targetCell);

      const { angle, rawPower } = calculateShotParams(targetCell);
      simulateCpuDragging(angle, rawPower);
    }, 1500);

    return () => clearTimeout(thinkTimer);
  }, [currentPlayer, stoneStatus, screen, gameMode, cpuDifficulty, board, currentOperator]);

  const selectCpuTarget = (): BoardCell => {
    const op = currentOperator;
    const currentTokens = player2.tokens;

    const scoredCells = board.map((cell) => {
      const testTokens = [...currentTokens, { type: 'op', val: op } as Token, { type: 'num', val: String(cell.num) } as Token];
      const testVal = evaluateFormula(testTokens);
      const diff = Math.abs(testVal - targetValue);
      return { cell, diff };
    });

    if (cpuDifficulty === 'easy') {
      return board[Math.floor(Math.random() * board.length)];
    } else if (cpuDifficulty === 'normal') {
      scoredCells.sort((a, b) => a.diff - b.diff);
      const candidates = scoredCells.slice(0, Math.min(5, scoredCells.length));
      const chosen = candidates[Math.floor(Math.random() * candidates.length)];
      return chosen.cell;
    } else {
      scoredCells.sort((a, b) => a.diff - b.diff);
      return scoredCells[0].cell;
    }
  };

  const calculateShotParams = (target: BoardCell) => {
    const startX = 250;
    const startY = 540;
    
    const tx = target.x;
    const ty = target.y;

    const dx = tx - startX;
    const dy = ty - startY;
    const distance = Math.hypot(dx, dy);

    const angle = Math.atan2(dy, dx);
    const idealV0 = distance * (1 - FRICTION) * 1.05; 
    
    let rawPower = idealV0 / MAX_LAUNCH_VELOCITY;
    rawPower = Math.max(0.15, Math.min(1.0, rawPower));

    let finalAngle = angle;
    let finalPower = rawPower;

    if (cpuDifficulty === 'easy') {
      finalAngle += (Math.random() - 0.5) * 0.5; 
      finalPower += (Math.random() - 0.5) * 0.4; 
    } else if (cpuDifficulty === 'normal') {
      finalAngle += (Math.random() - 0.5) * 0.15; 
      finalPower += (Math.random() - 0.5) * 0.1;  
    }
    finalPower = Math.max(0.15, Math.min(1.0, finalPower));

    return { angle: finalAngle, rawPower: finalPower };
  };

  const simulateCpuDragging = (angle: number, targetPowerRatio: number) => {
    const startX = 250;
    const startY = 540;
    
    const dragLength = 100;
    const dragDx = -Math.cos(angle) * dragLength;
    const dragDy = -Math.sin(angle) * dragLength;

    let steps = 20;
    let currentStep = 0;

    setIsCpuThinking(false);
    setStoneStatus('aiming');
    setDragStart({ x: startX, y: startY });

    const dragInterval = setInterval(() => {
      currentStep++;
      const ratio = currentStep / steps;
      setDragCurrent({
        x: startX + dragDx * ratio,
        y: startY + dragDy * ratio
      });
      
      sounds.playAim(ratio);

      if (currentStep >= steps) {
        clearInterval(dragInterval);
        
        const targetPercent = targetPowerRatio * 100;
        let gaugeWaitTime = 600; 
        
        setTimeout(() => {
          setDragStart(null);
          setDragCurrent(null);
          setPowerPercent(targetPercent);
          fireStone(angle, targetPercent / 100);
        }, gaugeWaitTime);
      }
    }, 25);
  };

  // ==========================================
  // 8. Canvas 描画ロジック
  // ==========================================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    // 1. 背景の描画
    const bgGrad = ctx.createLinearGradient(0, 0, 0, BOARD_HEIGHT);
    bgGrad.addColorStop(0, '#f0f9ff');
    bgGrad.addColorStop(0.8, '#e0f2fe');
    bgGrad.addColorStop(1, '#bae6fd');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

    const houseX = 250;
    const houseY = 280;
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.15)'; 
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.arc(houseX, houseY, 140, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.15)'; 
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(houseX, houseY, 80, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.1)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(250, HEADER_HEIGHT);
    ctx.lineTo(250, BOARD_HEIGHT);
    ctx.stroke();

    // 2. グリッドと数字マスの描画
    board.forEach((cell, idx) => {
      const col = idx % GRID_COLS;
      const row = Math.floor(idx / GRID_COLS);

      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(col * CELL_SIZE, HEADER_HEIGHT + row * CELL_SIZE, CELL_SIZE, CELL_SIZE);

      const isCaptured = capturedCell && capturedCell.row === row && capturedCell.col === col;
      
      if (isCaptured) {
        ctx.fillStyle = 'rgba(253, 224, 71, 0.4)'; 
        ctx.fillRect(col * CELL_SIZE + 2, HEADER_HEIGHT + row * CELL_SIZE + 2, CELL_SIZE - 4, CELL_SIZE - 4);
      }

      const cardMargin = 8;
      const cardX = col * CELL_SIZE + cardMargin;
      const cardY = HEADER_HEIGHT + row * CELL_SIZE + cardMargin;
      const cardW = CELL_SIZE - cardMargin * 2;
      const cardH = CELL_SIZE - cardMargin * 2;

      ctx.fillStyle = isCaptured ? '#fef08a' : 'rgba(255, 255, 255, 0.8)';
      ctx.shadowColor = 'rgba(0, 0, 0, 0.04)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 2;
      
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(cardX, cardY, cardW, cardH, 12) : ctx.rect(cardX, cardY, cardW, cardH);
      ctx.fill();
      ctx.shadowColor = 'transparent'; 

      ctx.fillStyle = isCaptured ? '#a16207' : '#1e293b';
      ctx.font = '700 32px "Outfit", "Kiwi Maru", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(cell.num), cell.x, cell.y);
    });

    // 3. 発射エリア境界線
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 480);
    ctx.lineTo(BOARD_WIDTH, 480);
    ctx.stroke();
    ctx.setLineDash([]); 

    if (stoneStatus === 'idle') {
      ctx.fillStyle = 'rgba(71, 85, 105, 0.6)';
      ctx.font = '500 14px "Kiwi Maru", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(gameMode === 'cpu' && currentPlayer === 2 ? '相手のターンです' : 'ストーンを上に引っ張って狙おう！', 250, 505);
    }

    // 4. 引っ張りエイムガイドライン
    if (stoneStatus === 'aiming' && dragStart && dragCurrent) {
      const dx = dragCurrent.x - dragStart.x;
      const dy = dragCurrent.y - dragStart.y;
      const distance = Math.hypot(dx, dy);

      if (distance > 5) {
        const angle = Math.atan2(-dy, -dx);
        const intensity = Math.min(120, distance) / 120;
        const arrowLength = 60 + intensity * 120;

        const targetX = stoneX + Math.cos(angle) * arrowLength;
        const targetY = stoneY + Math.sin(angle) * arrowLength;

        const guideGrad = ctx.createLinearGradient(stoneX, stoneY, targetX, targetY);
        if (currentPlayer === 1) {
          guideGrad.addColorStop(0, 'rgba(59, 130, 246, 0.8)');
          guideGrad.addColorStop(1, 'rgba(96, 165, 250, 0.1)');
        } else {
          guideGrad.addColorStop(0, 'rgba(239, 68, 68, 0.8)');
          guideGrad.addColorStop(1, 'rgba(248, 113, 113, 0.1)');
        }

        ctx.strokeStyle = guideGrad;
        ctx.lineWidth = 4;
        ctx.setLineDash([8, 6]);
        ctx.beginPath();
        ctx.moveTo(stoneX, stoneY);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(stoneX, stoneY, 120, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = currentPlayer === 1 ? 'rgba(59, 130, 246, 0.3)' : 'rgba(239, 68, 68, 0.3)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(stoneX, stoneY, Math.min(120, distance), 0, Math.PI * 2);
        ctx.stroke();

        const arrowSize = 10;
        ctx.fillStyle = currentPlayer === 1 ? 'rgba(59, 130, 246, 0.8)' : 'rgba(239, 68, 68, 0.8)';
        ctx.beginPath();
        ctx.moveTo(targetX, targetY);
        ctx.lineTo(
          targetX - arrowSize * Math.cos(angle - Math.PI / 6),
          targetY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          targetX - arrowSize * Math.cos(angle + Math.PI / 6),
          targetY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
      }
    }

    // 描画用の共通ストーン描画ヘルパー (演算子フォントサイズを大きく)
    const drawStoneHelper = (x: number, y: number, isP1Stone: boolean, op: string) => {
      ctx.save();
      ctx.shadowColor = 'rgba(15, 23, 42, 0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 4;

      ctx.fillStyle = '#e2e8f0'; 
      ctx.beginPath();
      ctx.arc(x, y, STONE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      const innerGrad = ctx.createRadialGradient(x, y, 0, x, y, STONE_RADIUS - 3);
      if (isP1Stone) {
        innerGrad.addColorStop(0, '#60a5fa');
        innerGrad.addColorStop(1, '#2563eb');
      } else {
        innerGrad.addColorStop(0, '#f87171');
        innerGrad.addColorStop(1, '#dc2626');
      }
      ctx.fillStyle = innerGrad;
      ctx.beginPath();
      ctx.arc(x, y, STONE_RADIUS - 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - 10, y - 4, 20, 8, 4) : ctx.rect(x - 10, y - 4, 20, 8);
      ctx.fill();
      ctx.fillStyle = isP1Stone ? '#1d4ed8' : '#b91c1c';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x - 8, y - 3, 16, 6, 3) : ctx.rect(x - 8, y - 3, 16, 6);
      ctx.fill();

      ctx.shadowColor = 'transparent'; 
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 24px "Outfit", "Kiwi Maru", sans-serif'; 
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      let opStr = op;
      if (opStr === '*') opStr = '×';
      if (opStr === '/') opStr = '÷';
      ctx.fillText(opStr, x, y - 1); 
      ctx.restore();
    };

    // 5. 配置済みストーンの描画
    playedStones.forEach(s => {
      drawStoneHelper(s.x, s.y, s.player === 1, s.op);
    });

    // 6. 操作中のアクティブストーンの描画
    if (stoneStatus !== 'stopped') {
      drawStoneHelper(stoneX, stoneY, currentPlayer === 1, currentOperator);
    }

    // 7. 数字獲得のポップアップ演出
    if (popupText && capturedCell) {
      ctx.fillStyle = '#f59e0b'; 
      ctx.font = 'bold 24px "Outfit", "Kiwi Maru", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 4;
      ctx.strokeText(popupText, capturedCell.x, capturedCell.y - 35);
      ctx.fillText(popupText, capturedCell.x, capturedCell.y - 35);
    }
  }, [stoneX, stoneY, stoneStatus, dragStart, dragCurrent, board, currentPlayer, currentOperator, popupText, capturedCell, playedStones, gameMode]);

  // 紙吹雪アニメーション
  useEffect(() => {
    if (!confettiActive) return;

    const canvas = document.createElement('canvas');
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '9999';
    document.body.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    class ConfettiParticle {
      x: number = Math.random() * width;
      y: number = Math.random() * -height - 20;
      size: number = Math.random() * 8 + 6;
      color: string = `hsl(${Math.random() * 360}, 90%, 60%)`;
      speedX: number = Math.random() * 4 - 2;
      speedY: number = Math.random() * 5 + 4;
      rotation: number = Math.random() * 360;
      rotationSpeed: number = Math.random() * 4 - 2;

      update() {
        this.y += this.speedY;
        this.x += this.speedX + Math.sin(this.y / 30) * 0.5;
        this.rotation += this.rotationSpeed;
        if (this.y > height) {
          this.y = -20;
          this.x = Math.random() * width;
        }
      }

      draw() {
        if (!ctx) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate((this.rotation * Math.PI) / 180);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.restore();
      }
    }

    const particles: ConfettiParticle[] = Array.from({ length: 120 }, () => new ConfettiParticle());

    const animate = () => {
      ctx.clearRect(0, 0, width, height);
      particles.forEach((p) => {
        p.update();
        p.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (document.body.contains(canvas)) {
        document.body.removeChild(canvas);
      }
    };
  }, [confettiActive]);

  // 診断データ
  const finalP1Scores = calculateDiagnosticScores(player1, targetValue);
  const finalP1Advice = getDiagnosticAdvice(finalP1Scores);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col items-center justify-center font-sans p-4 md:p-6">
      
      <header className="w-full max-w-lg flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-2">
          <Brain className="w-9 h-9 text-sky-400 animate-pulse" />
          <h1 className="font-bold text-2xl md:text-3xl font-serif text-transparent bg-clip-text bg-gradient-to-r from-sky-400 to-emerald-400">
            計算カーリング
          </h1>
        </div>
        <button 
          onClick={toggleMute} 
          className="p-2.5 rounded-full bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700/80 shadow-md text-slate-300 hover:text-white"
          aria-label={isMuted ? "音声をONにする" : "音声をミュートする"}
        >
          {isMuted ? <VolumeX className="w-5 h-5 text-red-400" /> : <Volume2 className="w-5 h-5 text-emerald-400" />}
        </button>
      </header>

      {/* ==========================================
          画面1: メインメニュー (Menu Screen)
         ========================================== */}
      {screen === 'menu' && (
        <main className="w-full max-w-lg bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-700/50 flex flex-col items-center text-center relative overflow-hidden animate-fade-in">
          <div className="absolute -top-20 -left-20 w-48 h-48 bg-sky-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="absolute -bottom-20 -right-20 w-48 h-48 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="mb-8">
            <div className="inline-flex p-4 rounded-full bg-sky-500/10 border border-sky-500/20 mb-4 shadow-inner">
              <Sparkles className="w-12 h-12 text-sky-400" />
            </div>
            <h2 className="text-3xl font-extrabold font-serif text-white tracking-wider mb-2">
              Calculation Curling
            </h2>
            <p className="text-base text-slate-400 max-w-sm mx-auto leading-relaxed">
              引っ張って、狙って、計算する！<br />
              指先と頭脳をフル活用する、新感覚の認知症予防カーリングゲーム。
            </p>
          </div>

          <div className="w-full bg-slate-800/60 rounded-2xl p-4 mb-8 border border-slate-700/30 text-left space-y-3">
            <h3 className="text-sm font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
              <Brain className="w-5 h-5" /> 5つの脳活アプローチ
            </h3>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-300">
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                <span><strong>計算力:</strong> 四則演算の脳トレ</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                <span><strong>空間認知:</strong> 反射と物理予測</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                <span><strong>注意力:</strong> ゲージを止める集中</span>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/40 p-2 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
                <span><strong>記憶力:</strong> 数式の記憶保持</span>
              </div>
            </div>
          </div>

          <div className="w-full space-y-5 mb-8">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-400 block text-left pl-1">
                対戦モードを選択
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setGameMode('cpu')}
                  className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                    gameMode === 'cpu'
                      ? 'bg-sky-600 border-sky-500 text-white shadow-lg shadow-sky-600/20'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                  CPU対戦
                </button>
                <button
                  onClick={() => setGameMode('local')}
                  className={`py-3 px-4 rounded-xl font-bold flex items-center justify-center gap-2 border transition-all ${
                    gameMode === 'local'
                      ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <User className="w-5 h-5" />
                  2人対戦 (ローカル)
                </button>
              </div>
            </div>

            {gameMode === 'cpu' && (
              <div className="space-y-2 animate-fade-in">
                <label className="text-sm font-semibold text-slate-400 block text-left pl-1">
                  CPUの強さ
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['easy', 'normal', 'hard'] as CpuDifficulty[]).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setCpuDifficulty(diff)}
                      className={`py-2.5 px-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border ${
                        cpuDifficulty === diff
                          ? 'bg-indigo-600 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
                      }`}
                    >
                      {diff === 'easy' ? 'かんたん' : diff === 'normal' ? 'ふつう' : 'むずかしい'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <button
            onClick={startNewGame}
            className="w-full py-4 px-6 rounded-2xl font-extrabold text-lg text-white bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 shadow-xl hover:shadow-2xl hover:shadow-sky-500/10 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
          >
            <Play className="w-6 h-6 fill-current" />
            ゲーム開始！
          </button>
        </main>
      )}

      {/* ==========================================
          画面2: ゲームプレイ画面 (Playing Screen)
         ========================================== */}
      {screen === 'playing' && (
        <main className="w-full max-w-lg bg-slate-800 rounded-3xl overflow-hidden shadow-2xl border border-slate-700/50 flex flex-col relative">
          
          <div className="bg-slate-800/90 border-b border-slate-700/50 p-4 flex flex-col gap-3 z-10">
            
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 bg-slate-900/60 py-1.5 px-4 rounded-full border border-slate-700/50">
                <Target className="w-5 h-5 text-rose-400" />
                <span className="text-base text-slate-300 font-bold">目標値をつくれ！</span>
              </div>
              <div className="text-3xl md:text-4xl font-black font-serif text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-500 tracking-wider">
                {targetValue}
              </div>
            </div>

            {/* プレイヤー情報カード */}
            <div className="grid grid-cols-2 gap-3">
              <div className={`p-3 rounded-2xl border transition-all ${
                currentPlayer === 1 
                  ? 'bg-blue-950/40 border-blue-500/50 shadow-lg shadow-blue-950/50' 
                  : 'bg-slate-900/30 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${currentPlayer === 1 ? 'bg-blue-400 animate-pulse' : 'bg-slate-500'}`}></div>
                    <span className="text-sm font-bold text-white">Player 1</span>
                  </div>
                  <span className="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded font-bold">
                    残 {player1.turnsLeft}投
                  </span>
                </div>
                <div className="text-base font-semibold truncate text-slate-300 mb-1" title={formatFormula(player1.tokens)}>
                  式: {formatFormula(player1.tokens)}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-slate-400 font-bold">現在値:</span>
                  <span className="text-2xl font-black text-blue-400 font-serif">
                    {player1.tokens.length > 0 ? Math.floor(player1.currentValue) : '0'}
                  </span>
                </div>
              </div>

              <div className={`p-3 rounded-2xl border transition-all ${
                currentPlayer === 2 
                  ? 'bg-red-950/40 border-red-500/50 shadow-lg shadow-red-950/50' 
                  : 'bg-slate-900/30 border-slate-800 text-slate-400'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-full ${currentPlayer === 2 ? 'bg-red-400 animate-pulse' : 'bg-slate-500'}`}></div>
                    <span className="text-sm font-bold text-white">
                      {gameMode === 'cpu' ? `CPU (${cpuDifficulty === 'easy' ? '初級' : cpuDifficulty === 'normal' ? '中級' : '上級'})` : 'Player 2'}
                    </span>
                  </div>
                  <span className="text-xs bg-red-900/50 text-red-300 px-2 py-0.5 rounded font-bold">
                    残 {player2.turnsLeft}投
                  </span>
                </div>
                <div className="text-base font-semibold truncate text-slate-300 mb-1" title={formatFormula(player2.tokens)}>
                  式: {formatFormula(player2.tokens)}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xs text-slate-400 font-bold">現在値:</span>
                  <span className="text-2xl font-black text-red-400 font-serif">
                    {player2.tokens.length > 0 ? Math.floor(player2.currentValue) : '0'}
                  </span>
                </div>
              </div>
            </div>

            {/* ★ 今回の演算子（上部表示） ★ */}
            <div className="w-full bg-slate-900/40 border border-slate-800/50 p-3 rounded-2xl flex items-center justify-between shadow-inner">
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">
                今回の演算子:
              </span>
              <div className="flex items-center gap-2">
                {['+', '-', '*', '/'].map((op) => {
                  const isCurrent = currentOperator === op;
                  let displayOp = op;
                  if (op === '*') displayOp = '×';
                  if (op === '/') displayOp = '÷';
                  
                  return (
                    <span
                      key={op}
                      className={`w-12 h-12 rounded-xl font-extrabold flex items-center justify-center text-xl transition-all border-2 ${
                        isCurrent
                          ? currentPlayer === 1
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40 scale-110'
                            : 'bg-red-600 border-red-400 text-white shadow-lg shadow-red-500/40 scale-110'
                          : 'bg-slate-800 border-slate-700/60 text-slate-500'
                      }`}
                    >
                      {displayOp}
                    </span>
                  );
                })}
              </div>
            </div>

          </div>

          {/* B. カーリング盤面 (Canvas) */}
          <div className="relative flex justify-center bg-slate-950 select-none">
            <canvas
              ref={canvasRef}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              className="max-w-full aspect-[5/6] touch-none cursor-crosshair bg-slate-950"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onTouchStart={handleMouseDown}
              onTouchMove={handleMouseMove}
              onTouchEnd={handleMouseUp}
            />

            {isCpuThinking && (
              <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700/80 px-4 py-2 rounded-full shadow-xl flex items-center gap-2 z-10 animate-pulse">
                <Cpu className="w-4 h-4 text-red-400 animate-spin" />
                <span className="text-xs font-bold text-slate-200">CPU思考中...</span>
              </div>
            )}
          </div>

          {/* C. 下部ゲージ・ターン表示 */}
          <div className="bg-slate-900 border-t border-slate-800 p-4 flex flex-col gap-4">
            {/* ★ パワーゲージ（常時表示・aiming時のみアクティブ化） ★ */}
            <div className={`w-full border p-4 rounded-2xl space-y-2 transition-all ${
              stoneStatus === 'aiming' || stoneStatus === 'sliding' || stoneStatus === 'stopped'
                ? 'bg-slate-800 border-slate-600 shadow-xl' 
                : 'bg-slate-900/60 border-slate-800/80'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-base font-bold flex items-center gap-2 transition-colors ${
                  stoneStatus === 'aiming' ? 'text-amber-400' : stoneStatus === 'sliding' || stoneStatus === 'stopped' ? 'text-emerald-400' : 'text-slate-500'
                }`}>
                  <Zap className={`w-5 h-5 ${stoneStatus === 'aiming' ? 'fill-current animate-bounce' : stoneStatus === 'sliding' || stoneStatus === 'stopped' ? 'fill-current' : ''}`} />
                  {stoneStatus === 'aiming' ? 'ベストタイミングで指を離せ！' : stoneStatus === 'sliding' || stoneStatus === 'stopped' ? `パワー確定！` : 'パワーゲージ（待機中）'}
                </span>
                <span className={`text-2xl font-black font-serif transition-colors ${
                  stoneStatus === 'aiming' || stoneStatus === 'sliding' || stoneStatus === 'stopped' ? 'text-white' : 'text-slate-500'
                }`}>{powerPercent}%</span>
              </div>
              <div className="h-6 w-full bg-slate-950 rounded-full border border-slate-700 overflow-hidden p-0.5 relative">
                <div 
                  className={`h-full rounded-full transition-all duration-75 ${
                    stoneStatus === 'aiming' || stoneStatus === 'sliding' || stoneStatus === 'stopped'
                      ? 'bg-gradient-to-r from-emerald-500 via-yellow-400 to-rose-500' 
                      : 'bg-slate-800'
                  }`}
                  style={{ width: `${powerPercent}%` }}
                ></div>
                <div className="absolute top-0 bottom-0 left-[70%] w-0.5 bg-white/30"></div>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  if (window.confirm('ゲームをあきらめてメニューに戻りますか？')) {
                    setScreen('menu');
                  }
                }}
                className="text-sm font-semibold text-slate-400 hover:text-rose-400 transition-all flex items-center gap-1.5 py-1.5 px-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl border border-slate-700/50"
              >
                <RotateCcw className="w-4 h-4" />
                ギブアップ
              </button>
            </div>
          </div>

        </main>
      )}

      {/* ==========================================
          画面3: 認知力診断 ＆ リザルト画面 (Result Screen)
         ========================================== */}
      {screen === 'diagnosing' && (
        <main className="w-full max-w-lg bg-gradient-to-b from-slate-800 to-slate-900 rounded-3xl p-6 md:p-8 shadow-2xl border border-slate-700/50 flex flex-col gap-6 relative animate-fade-in overflow-y-auto max-h-[85vh] scrollbar-thin">
          
          <div className="text-center">
            <div className="inline-flex p-3 bg-amber-500/10 rounded-full border border-amber-500/20 mb-3 shadow-inner">
              <Award className="w-10 h-10 text-amber-400" />
            </div>
            <h2 className="text-2xl font-black text-white font-serif tracking-wide mb-1">
              試合終了！
            </h2>
            <p className="text-amber-300 font-bold text-lg px-4 py-1.5 bg-amber-950/40 rounded-full inline-block border border-amber-500/20">
              {winMessage}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-2xl border border-slate-700/40">
            <div className="text-center border-r border-slate-700/50">
              <span className="text-sm font-bold text-slate-400 block mb-1">Player 1</span>
              <div className="text-3xl font-black text-blue-400 font-serif">
                {Math.floor(player1.currentValue)}
              </div>
              <span className="text-sm text-slate-500 block mt-1">
                目標との差: <strong className="text-blue-300 font-serif text-base">{Math.abs(Math.floor(player1.currentValue) - targetValue)}</strong>
              </span>
            </div>
            <div className="text-center">
              <span className="text-sm font-bold text-slate-400 block mb-1">
                {gameMode === 'cpu' ? 'CPU' : 'Player 2'}
              </span>
              <div className="text-3xl font-black text-red-400 font-serif">
                {Math.floor(player2.currentValue)}
              </div>
              <span className="text-sm text-slate-500 block mt-1">
                目標との差: <strong className="text-red-300 font-serif text-base">{Math.abs(Math.floor(player2.currentValue) - targetValue)}</strong>
              </span>
            </div>
          </div>

          <div className="bg-slate-900/40 border border-slate-700/30 rounded-3xl p-5 space-y-6">
            <h3 className="text-base font-bold text-sky-400 flex items-center gap-2 pb-2 border-b border-slate-800">
              <Brain className="w-6 h-6 text-sky-400" />
              脳活パラメータ診断 (Player 1)
            </h3>

            <div className="flex flex-col md:flex-row items-center gap-6">
              
              <div className="w-48 h-48 flex-shrink-0 relative mx-auto">
                <svg className="w-full h-full" viewBox="0 0 200 200">
                  {(() => {
                    const radar = getRadarCoordinates(finalP1Scores, 200);
                    return (
                      <>
                        {[1, 0.75, 0.5, 0.25].map((scale, i) => (
                          <polygon
                            key={i}
                            points={radar.angles.map(angle => {
                              const x = radar.center + radar.r * scale * Math.cos(angle);
                              const y = radar.center + radar.r * scale * Math.sin(angle);
                              return `${x},${y}`;
                            }).join(' ')}
                            fill="none"
                            stroke="rgba(148, 163, 184, 0.15)"
                            strokeWidth="1"
                          />
                        ))}
                        
                        {radar.angles.map((angle, i) => {
                          const x = radar.center + radar.r * Math.cos(angle);
                          const y = radar.center + radar.r * Math.sin(angle);
                          return (
                            <line
                              key={i}
                              x1={radar.center}
                              y1={radar.center}
                              x2={x}
                              y2={y}
                              stroke="rgba(148, 163, 184, 0.15)"
                              strokeWidth="1"
                            />
                          );
                        })}

                        <polygon
                          points={radar.pointsStr}
                          fill="rgba(14, 165, 233, 0.25)"
                          stroke="rgba(14, 165, 233, 0.8)"
                          strokeWidth="2.5"
                        />

                        {radar.points.map((p, idx) => (
                          <circle
                            key={idx}
                            cx={p.x}
                            cy={p.y}
                            r="4"
                            fill="#0ea5e9"
                            stroke="#ffffff"
                            strokeWidth="1.5"
                          />
                        ))}

                        {(() => {
                          const labels = ['計算力', '空間認知', '注意力', '記憶力', '判断力'];
                          return labels.map((label, idx) => {
                            const angle = radar.angles[idx];
                            const labelR = radar.r + 16;
                            const x = radar.center + labelR * Math.cos(angle);
                            const y = radar.center + labelR * Math.sin(angle);

                            let anchor: 'start' | 'middle' | 'end' = 'middle';
                            if (Math.cos(angle) > 0.1) anchor = 'start';
                            if (Math.cos(angle) < -0.1) anchor = 'end';

                            return (
                              <text
                                key={idx}
                                x={x}
                                y={y + 4} 
                                fill="#94a3b8"
                                fontSize="10"
                                fontWeight="bold"
                                textAnchor={anchor}
                              >
                                {label}
                              </text>
                            );
                          });
                        })()}
                      </>
                    );
                  })()}
                </svg>
              </div>

              <div className="flex-1 w-full space-y-3">
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-blue-400"></span>計算力
                    </span>
                    <span className="font-bold text-white font-serif text-base">{finalP1Scores.calc} / 100</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-400 rounded-full" style={{ width: `${finalP1Scores.calc}%` }}></div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-400"></span>空間認知力
                    </span>
                    <span className="font-bold text-white font-serif text-base">{finalP1Scores.spatial} / 100</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${finalP1Scores.spatial}%` }}></div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-400"></span>注意力
                    </span>
                    <span className="font-bold text-white font-serif text-base">{finalP1Scores.attention} / 100</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400 rounded-full" style={{ width: `${finalP1Scores.attention}%` }}></div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-indigo-400"></span>ワーキングメモリ
                    </span>
                    <span className="font-bold text-white font-serif text-base">{finalP1Scores.wm} / 100</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-400 rounded-full" style={{ width: `${finalP1Scores.wm}%` }}></div>
                  </div>
                </div>

                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 font-semibold flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-purple-400"></span>判断力
                    </span>
                    <span className="font-bold text-white font-serif text-base">{finalP1Scores.decision} / 100</span>
                  </div>
                  <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-purple-400 rounded-full" style={{ width: `${finalP1Scores.decision}%` }}></div>
                  </div>
                </div>
              </div>

            </div>

            <div className="mt-4 bg-sky-950/40 border border-sky-900/50 rounded-2xl p-4 text-sm leading-relaxed text-slate-300">
              <h4 className="font-bold text-sky-400 mb-2 flex items-center gap-1.5 text-base">
                <Sparkles className="w-5 h-5 text-yellow-400" />
                脳活性化アドバイス（特に<strong>{finalP1Advice.weakPoint}</strong>の強化）
              </h4>
              <p>{finalP1Advice.advice}</p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={startNewGame}
              className="w-full py-3.5 px-6 rounded-2xl font-bold text-white bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 shadow-lg active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-5 h-5" />
              もう一度遊ぶ！
            </button>
            <button
              onClick={() => setScreen('menu')}
              className="w-full py-3 px-6 rounded-2xl font-bold text-slate-300 bg-slate-800 hover:bg-slate-700 hover:text-white border border-slate-700 transition-all flex items-center justify-center gap-2"
            >
              メインメニューに戻る
            </button>
          </div>

        </main>
      )}

      {/* 紙吹雪用の非表示要素、または単に confettiActive 警告防止のためのダミー */}
      <div className="hidden" aria-hidden="true">{confettiActive ? 'Active' : 'Inactive'}</div>

      <footer className="w-full max-w-lg text-center mt-6 text-[11px] text-slate-500 space-y-2">
        <p>© 2026 Calculation Curling - 脳の活性化をサポートする健康ゲーム</p>
      </footer>
    </div>
  );
}
