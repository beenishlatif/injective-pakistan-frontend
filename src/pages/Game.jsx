// client/src/pages/Game.jsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import axios from "axios";
import {
  Play,
  Pause,
  Gamepad2,
  Sparkles,
  Trophy,
  PersonStanding,
  Orbit,
  Spline,
  Brain,
  Shield,
  Magnet,
  Timer,
  Zap,
  Heart,
  ChevronRight,
  Users,
} from "lucide-react";

/* ============================================================
   THEME
   ------------------------------------------------------------
   Matches Home.jsx / the Academy / AI Assistant page's --nv-*
   token set (dark bg, teal signal, amber, violet, danger red)
   and its Space Grotesk / Inter / IBM Plex Mono type system,
   so this page reads as part of the same site. Text colors
   below reuse the exact same values Home.jsx uses:
     heading   -> #e7eaee
     body/dim  -> #8992a1
     faint/mono-> #545c67
     signal    -> #47d6c4
     amber     -> #e8a33d
     violet    -> #9b8cff
     danger    -> #e5645f
   ============================================================ */
const THEME_FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
`;

/* ============================================================
   CONFIG
   ------------------------------------------------------------
   Same fix as Home.jsx: don't rely solely on VITE_API_URL. If
   that env var isn't set/picked up at build/deploy time, this
   used to silently fall back to http://127.0.0.1:5000 — which
   only works locally and breaks all API calls in production
   (that's why it worked locally but not after deployment).
   Hardcode the real deployed backend origin as the default,
   same as DEFAULT_API_BASE_URL in Home.jsx.
   ============================================================ */
const DEFAULT_API_ORIGIN = "https://injective-pakistan-backend-2gbb.vercel.app";
const API_ORIGIN = import.meta.env.VITE_API_URL || DEFAULT_API_ORIGIN;
const API_BASE = `${API_ORIGIN}/api/game`;

/**
 * FIX (session shared with AI Assistant / rest of the app):
 * This used to be a bare "token" key, while AuthContext.jsx (used by
 * the AI Assistant page and everywhere else auth is wired through
 * useAuth()) stores the JWT under "nova_auth_token". Because the two
 * pages read/wrote different localStorage keys, connecting via X on
 * one page was invisible to the other — Game.jsx always thought the
 * user was signed out, even right after a successful X connect on
 * the AI Assistant page (and vice versa).
 *
 * Using the exact same key here makes both pages share one session.
 * The game now simply relies on whatever session the rest of the
 * site has already established (regular site login/AuthContext) —
 * there is no separate "connect to play" step here anymore.
 */
const TOKEN_KEY = "nova_auth_token"; // MUST match AuthContext.jsx's TOKEN_KEY exactly

const GAME_WIDTH = 900;
const GAME_HEIGHT = 400;
const GROUND_Y = 330;
const ROUND_DURATION = 60; // seconds — survive this long to win (Shadow Arena)

const PLAYER_X = 140;
const PLAYER_WIDTH = 34;
const PLAYER_HEIGHT = 54;
const PLAYER_DUCK_HEIGHT = 30;

const GRAVITY = 0.85;
const JUMP_FORCE = -14.5;
const DOUBLE_JUMP_FORCE = -12.5;
const MAX_JUMPS = 2; // double-jump built in

const START_SPEED = 5.2;
const MAX_SPEED = 11;
const SPEED_RAMP_PER_SEC = 0.045; // how fast the run speeds up

const OBSTACLE_MIN_INTERVAL = 650; // ms, fastest spawn rate
const OBSTACLE_MAX_INTERVAL = 1500; // ms, slowest spawn rate
const COIN_SPAWN_CHANCE = 0.55; // chance a coin (or power-up) spawns between obstacles
const POWERUP_CHANCE_OF_DROP = 0.22; // of the coin-spawn roll, chance it's a power-up instead

const COIN_SCORE = 15;
const DISTANCE_SCORE_PER_SEC = 12;
const START_LIVES = 3;

const STREAK_WINDOW = 3; // obstacles cleared per combo step
const MAX_COMBO = 4;

const SHIELD_LABEL = "shield";
const MAGNET_LABEL = "magnet";
const SLOWMO_LABEL = "slowmo";
const MULT_LABEL = "multiplier";
const MAGNET_DURATION = 6000;
const SLOWMO_DURATION = 5000;
const MULT_DURATION = 7000;
const MAGNET_RADIUS = 100;

// XP is intentionally small — capped hard at 50 per run regardless of score,
// regardless of which game was played.
const XP_CAP = 50;
const XP_SCORE_DIVISOR = 22; // score points needed per 1 xp before the cap

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
function authHeaders() {
  const token = getToken();
  return {
    withCredentials: true,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  };
}

function rand(min, max) {
  return Math.random() * (max - min) + min;
}
function randInt(min, max) {
  return Math.floor(rand(min, max + 1));
}
function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/* ============================================================
   GAME CATALOG — 4 curated, "advanced" games in the arcade.
   `skills` are short tags shown as chips on each game card for
   extra detail at a glance (in addition to the full theory row).
   ============================================================ */
const GAMES = [
  {
    id: "shadow-arena",
    title: "Shadow Arena",
    icon: "shadow-arena",
    accent: "#47d6c4",
    difficulty: "Hard",
    avgTime: "~60s",
    skills: ["Reflexes", "Timing", "Combo Chaining"],
    tagline: "Endless runner through a neon skyline.",
    theory:
      "An endless cyber-runner set in the arena's neon skyline. Your character sprints forward automatically while low bars and tall blocks rush in from the right — jump (even double-jump mid-air) or duck to get past them. Collect glowing orbs for score and chain dodges together to build a combo multiplier that boosts every orb you grab. Four power-ups can drop: a Shield that absorbs one hit, a Magnet that pulls nearby orbs to you, Slow-Mo that eases the pace, and a 2x Score multiplier.",
    controls: "W / ↑ / Space — jump (double-tap for double jump) · S / ↓ — duck · P / Esc — pause",
    winCondition: "3 lives. Survive the full 60-second run to win.",
  },
  {
    id: "asteroid-dodge",
    title: "Asteroid Dodge",
    icon: "asteroid-dodge",
    accent: "#47d6c4",
    difficulty: "Hard",
    avgTime: "~40s",
    skills: ["Reaction Speed", "Lane Control"],
    tagline: "Steer between five lanes, dodge falling rocks.",
    theory:
      "A five-lane dodging game. Rocks fall from the top of the screen at increasing speed as the run goes on, and you steer your ship left and right between lanes to avoid being crushed. The pace ramps continuously, so the last few seconds of a run demand sharp reflexes.",
    controls: "← / A and → / D (or the on-screen arrows) to switch lanes.",
    winCondition: "One hit ends the run. Survive the full 40 seconds to win.",
  },
  {
    id: "neon-snake",
    title: "Neon Snake",
    icon: "neon-snake",
    accent: "#47d6c4",
    difficulty: "Medium",
    avgTime: "~2-3 min",
    skills: ["Planning", "Precision Control"],
    tagline: "The arcade classic, reskinned for the arena.",
    theory:
      "The arcade classic, reskinned in the arena's neon palette. Steer your glowing trail around the grid, eating amber orbs to grow longer and speed up as you go. Every bite tightens the margin for error, so late-game runs become a real test of control.",
    controls: "Arrow keys or WASD (or the on-screen D-pad) to steer.",
    winCondition: "Hitting a wall or your own tail ends the run. Grow to length 15 to win.",
  },
  {
    id: "memory-grid",
    title: "Memory Grid",
    icon: "memory-grid",
    accent: "#47d6c4",
    difficulty: "Medium",
    avgTime: "~2 min",
    skills: ["Memory", "Focus"],
    tagline: "Watch the sequence, then repeat it back. Simon says.",
    theory:
      "A Simon-style memory challenge on a 3×3 grid. The game lights up a sequence of tiles, then you must tap them back in the exact same order. Every round the sequence grows by one more tile, testing how far your memory can stretch before it breaks.",
    controls: "Watch the lit sequence, then tap the tiles back in the same order.",
    winCondition: "One wrong tap ends the run. Reach round 10 in a row to win.",
  },
];

/* ============================================================
   GAME ICONS — real imported icon set (lucide-react), always
   rendered in the single neon-teal signal color so every card
   reads as one consistent, premium icon set. No emoji anywhere.
   ============================================================ */
const GAME_ICON_MAP = {
  "shadow-arena": PersonStanding,
  "asteroid-dodge": Orbit,
  "neon-snake": Spline,
  "memory-grid": Brain,
};

function GameIcon({ id, size = 22, color = "#47d6c4", strokeWidth = 1.8 }) {
  const Icon = GAME_ICON_MAP[id];
  if (!Icon) return null;
  return <Icon size={size} color={color} strokeWidth={strokeWidth} />;
}

/* ============================================================
   SMALL SHARED UI PIECES
   ============================================================ */
function LiveDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#47d6c4] animate-pulse" />;
}

function Eyebrow({ children }) {
  return (
    <div className="inline-flex items-center gap-2 text-[10px] sm:text-xs tracking-[0.15em] uppercase text-[#47d6c4] border border-[#1d232b] bg-[#47d6c4]/10 px-3 py-1.5 rounded-full [font-family:'IBM_Plex_Mono',monospace]">
      <LiveDot />
      {children}
    </div>
  );
}

function StatChip({ label, value, color }) {
  return (
    <div
      className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0b0d10]/70 border text-[10px] sm:text-xs md:text-sm [font-family:'IBM_Plex_Mono',monospace]"
      style={{ borderColor: `${color}33` }}
    >
      {label} <span className="font-bold ml-1" style={{ color }}>{value}</span>
    </div>
  );
}

// Larger stat tile for the "Arena Stats" strip — same visual language
// as Home.jsx's stat cards (faint mono label, bold display-font value).
function ArenaStatTile({ label, value, color }) {
  return (
    <div className="flex-1 min-w-[140px] bg-[#0b0d10]/70 border border-[#1d232b] rounded-2xl px-5 py-4 flex flex-col gap-1.5 hover:border-[#1d232b] hover:bg-[#0d1013] transition-colors">
      <span className="text-[10px] uppercase tracking-[0.15em] text-[#545c67] [font-family:'IBM_Plex_Mono',monospace]">
        {label}
      </span>
      <span className="text-xl sm:text-2xl font-bold [font-family:'Space_Grotesk',sans-serif]" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function EndOverlay({ result, resultData, submitting, gameTitle, onPlayAgain, onBackToHub }) {
  const win = result === "victory";
  return (
    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4 text-center px-4 z-20">
      <h2
        className="text-3xl md:text-4xl font-bold tracking-widest [font-family:'Space_Grotesk',sans-serif]"
        style={{ color: win ? "#47d6c4" : "#e7eaee" }}
      >
        {win ? "VICTORY" : "WIPED OUT"}
      </h2>
      <p className="text-[#8992a1] text-sm">{gameTitle}</p>
      <p className="text-[#e7eaee]">Score: {resultData?.score ?? 0}</p>
      <p className="text-[#47d6c4] text-lg font-bold">+{resultData?.xpEarned ?? 0} XP</p>
      {resultData?.perfectRun && (
        <p className="text-[#47d6c4] font-semibold tracking-wide inline-flex items-center gap-1.5">
          <Sparkles size={16} /> FLAWLESS RUN
        </p>
      )}
      <div className="flex gap-3 mt-2">
        <button
          onClick={onPlayAgain}
          disabled={submitting}
          className="px-6 py-2.5 rounded-full bg-[#47d6c4] font-bold uppercase text-sm text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif]"
        >
          {submitting ? "Saving..." : "Play Again"}
        </button>
        <button
          onClick={onBackToHub}
          className="px-6 py-2.5 rounded-full border border-[#1d232b] text-[#8992a1] font-bold uppercase text-sm hover:bg-[#0d1013] transition [font-family:'Space_Grotesk',sans-serif]"
        >
          All Games
        </button>
      </div>
    </div>
  );
}

/* ============================================================
   GAME 1 — SHADOW ARENA (endless runner, canvas)
   ============================================================ */
function ShadowArenaGame({ onFinish, paused, setPaused }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(0);
  const inputRef = useRef({ jumpQueued: false, ducking: false });
  const pausedRef = useRef(false);
  const stateRef = useRef(null);
  const [micro, setMicro] = useState("intro"); // intro | active
  const [hud, setHud] = useState({
    score: 0, timeLeft: ROUND_DURATION, lives: START_LIVES, combo: 1, speed: START_SPEED,
    shield: false, magnetUntil: 0, slowmoUntil: 0, multUntil: 0,
  });

  useEffect(() => { pausedRef.current = paused; }, [paused]);

  function buildWorld() {
    const skyline = Array.from({ length: 14 }, (_, i) => ({
      x: i * 90 + rand(-15, 15), w: rand(50, 85), h: rand(60, 170), lit: Math.random() < 0.5,
    }));
    const stars = Array.from({ length: 40 }, () => ({ x: rand(0, GAME_WIDTH), y: rand(0, GROUND_Y * 0.6), size: rand(0.6, 1.8) }));
    return {
      player: { jumpY: 0, vy: 0, jumping: false, ducking: false, jumpsLeft: MAX_JUMPS, hitFlashUntil: 0, invulnUntil: 0, shielded: false, magnetUntil: 0, slowmoUntil: 0, multUntil: 0 },
      skyline, stars, speed: START_SPEED, obstacles: [], coins: [], powerups: [], particles: [],
      nextSpawnAt: rand(OBSTACLE_MIN_INTERVAL, OBSTACLE_MAX_INTERVAL),
      timeLeft: ROUND_DURATION, elapsed: 0, distance: 0, score: 0, lives: START_LIVES,
      streak: 0, comboMultiplier: 1, shakeUntil: 0, shakeMag: 0, tookHit: false, ended: false,
    };
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      switch (e.key) {
        case "ArrowUp": case "w": case "W": case " ":
          if (!e.repeat) inputRef.current.jumpQueued = true;
          e.preventDefault(); break;
        case "ArrowDown": case "s": case "S": inputRef.current.ducking = true; break;
        case "p": case "P": case "Escape": setPaused((prev) => !prev); break;
        default: break;
      }
    };
    const onKeyUp = (e) => {
      if (["ArrowDown", "s", "S"].includes(e.key)) inputRef.current.ducking = false;
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => { window.removeEventListener("keydown", onKeyDown); window.removeEventListener("keyup", onKeyUp); };
  }, [setPaused]);

  function spawnParticles(world, x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const angle = rand(0, Math.PI * 2);
      const speed = rand(1, 3.6);
      world.particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, life: rand(250, 500), maxLife: 500, color });
    }
  }
  function triggerShake(world, now, magnitude, durationMs) { world.shakeUntil = now + durationMs; world.shakeMag = magnitude; }

  const spawnObstacle = (world) => {
    const useBar = Math.random() < 0.4;
    if (useBar) world.obstacles.push({ type: "bar", x: GAME_WIDTH + 20, width: 46, height: 22, bottomGap: 46, passed: false });
    else world.obstacles.push({ type: "block", x: GAME_WIDTH + 20, width: 30, height: rand(34, 54), passed: false });

    if (Math.random() < COIN_SPAWN_CHANCE) {
      if (Math.random() < POWERUP_CHANCE_OF_DROP) {
        const types = [SHIELD_LABEL, MAGNET_LABEL, SLOWMO_LABEL, MULT_LABEL];
        world.powerups.push({ type: types[randInt(0, types.length - 1)], x: GAME_WIDTH + rand(90, 160), y: GROUND_Y - rand(50, 120) });
      } else {
        world.coins.push({ x: GAME_WIDTH + rand(90, 160), y: GROUND_Y - rand(40, 130), collected: false });
      }
    }
  };

  const endRun = useCallback((result) => {
    const world = stateRef.current;
    if (!world || world.ended) return;
    world.ended = true;
    cancelAnimationFrame(rafRef.current);
    const perfectRun = result === "win" && !world.tookHit;
    onFinish(result, Math.floor(world.score), perfectRun);
  }, [onFinish]);

  const loop = useCallback((timestamp) => {
    const world = stateRef.current;
    if (!world || world.ended) return;
    if (!lastTimeRef.current) lastTimeRef.current = timestamp;

    if (pausedRef.current) {
      lastTimeRef.current = timestamp;
      render(world, timestamp);
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    const dt = Math.min(timestamp - lastTimeRef.current, 50);
    lastTimeRef.current = timestamp;
    const now = timestamp;

    world.timeLeft -= dt / 1000;
    world.elapsed += dt / 1000;
    if (world.timeLeft <= 0) { world.timeLeft = 0; endRun("win"); return; }

    const slowmoActive = now < world.player.slowmoUntil;
    const multActive = now < world.player.multUntil;
    const magnetActive = now < world.player.magnetUntil;
    const speedMul = slowmoActive ? 0.55 : 1;

    world.speed = clamp(START_SPEED + world.elapsed * SPEED_RAMP_PER_SEC, START_SPEED, MAX_SPEED);
    const effectiveSpeed = world.speed * speedMul;
    world.distance += effectiveSpeed * (dt / 16.6667);
    world.score += (DISTANCE_SCORE_PER_SEC * dt) / 1000;

    const input = inputRef.current;
    const p = world.player;
    p.ducking = input.ducking && !p.jumping;

    if (input.jumpQueued && p.jumpsLeft > 0) {
      p.jumping = true;
      p.vy = p.jumpsLeft === MAX_JUMPS ? JUMP_FORCE : DOUBLE_JUMP_FORCE;
      p.jumpsLeft -= 1;
      spawnParticles(world, PLAYER_X, GROUND_Y + p.jumpY, "#47d6c4", 6);
    }
    input.jumpQueued = false;

    if (p.jumping) {
      p.vy += GRAVITY;
      p.jumpY += p.vy;
      if (p.jumpY >= 0) { p.jumpY = 0; p.vy = 0; p.jumping = false; p.jumpsLeft = MAX_JUMPS; }
    }

    const playerHeight = p.ducking ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT;
    const feetY = GROUND_Y + p.jumpY;
    const playerRect = { x: PLAYER_X - PLAYER_WIDTH / 2, y: feetY - playerHeight, w: PLAYER_WIDTH, h: playerHeight };

    world.nextSpawnAt -= dt;
    if (world.nextSpawnAt <= 0) {
      spawnObstacle(world);
      const speedFactor = (world.speed - START_SPEED) / (MAX_SPEED - START_SPEED);
      world.nextSpawnAt = OBSTACLE_MAX_INTERVAL - speedFactor * (OBSTACLE_MAX_INTERVAL - OBSTACLE_MIN_INTERVAL);
    }

    const moveAmount = effectiveSpeed * (dt / 16.6667);
    for (let i = world.obstacles.length - 1; i >= 0; i--) {
      const ob = world.obstacles[i];
      ob.x -= moveAmount;
      let obRect;
      if (ob.type === "block") obRect = { x: ob.x, y: GROUND_Y - ob.height, w: ob.width, h: ob.height };
      else { const barBottom = GROUND_Y - ob.bottomGap; obRect = { x: ob.x, y: barBottom - ob.height, w: ob.width, h: ob.height }; }

      if (!ob.passed && ob.x + ob.width < PLAYER_X - PLAYER_WIDTH / 2) {
        ob.passed = true;
        world.streak += 1;
        world.comboMultiplier = clamp(1 + Math.floor(world.streak / STREAK_WINDOW), 1, MAX_COMBO);
      }

      if (now >= p.invulnUntil && rectsOverlap(playerRect, obRect)) {
        if (p.shielded) {
          p.shielded = false; p.hitFlashUntil = now + 200; p.invulnUntil = now + 500;
          spawnParticles(world, PLAYER_X, feetY - playerHeight / 2, "#9b8cff", 14);
          world.obstacles.splice(i, 1); continue;
        }
        world.lives -= 1; world.tookHit = true; world.streak = 0; world.comboMultiplier = 1;
        p.hitFlashUntil = now + 300; p.invulnUntil = now + 900;
        triggerShake(world, now, 7, 260);
        spawnParticles(world, PLAYER_X, feetY - playerHeight / 2, "#e5645f", 12);
        world.obstacles.splice(i, 1);
        if (world.lives <= 0) { endRun("loss"); return; }
        continue;
      }
      if (ob.x + ob.width < -20) world.obstacles.splice(i, 1);
    }

    for (let i = world.coins.length - 1; i >= 0; i--) {
      const coin = world.coins[i];
      coin.x -= moveAmount;
      if (magnetActive) {
        const dx = PLAYER_X - coin.x, dy = feetY - playerHeight / 2 - coin.y;
        const d = Math.hypot(dx, dy);
        if (d < MAGNET_RADIUS) { coin.x += dx * 0.18; coin.y += dy * 0.18; }
      }
      const coinRect = { x: coin.x - 10, y: coin.y - 10, w: 20, h: 20 };
      if (!coin.collected && rectsOverlap(playerRect, coinRect)) {
        coin.collected = true;
        const gained = COIN_SCORE * world.comboMultiplier * (multActive ? 2 : 1);
        world.score += gained;
        spawnParticles(world, coin.x, coin.y, "#e8a33d", 8);
      }
      if (coin.collected || coin.x < -20) world.coins.splice(i, 1);
    }

    for (let i = world.powerups.length - 1; i >= 0; i--) {
      const pu = world.powerups[i];
      pu.x -= moveAmount;
      const puRect = { x: pu.x - 12, y: pu.y - 12, w: 24, h: 24 };
      if (rectsOverlap(playerRect, puRect)) {
        if (pu.type === SHIELD_LABEL) p.shielded = true;
        else if (pu.type === MAGNET_LABEL) p.magnetUntil = now + MAGNET_DURATION;
        else if (pu.type === SLOWMO_LABEL) p.slowmoUntil = now + SLOWMO_DURATION;
        else if (pu.type === MULT_LABEL) p.multUntil = now + MULT_DURATION;
        spawnParticles(world, pu.x, pu.y, "#9b8cff", 10);
        world.powerups.splice(i, 1); continue;
      }
      if (pu.x < -30) world.powerups.splice(i, 1);
    }

    for (let i = world.particles.length - 1; i >= 0; i--) {
      const pt = world.particles[i];
      pt.x += pt.vx; pt.y += pt.vy; pt.vy += 0.12; pt.life -= dt;
      if (pt.life <= 0) world.particles.splice(i, 1);
    }

    world.skyline.forEach((b) => {
      b.x -= effectiveSpeed * 0.18 * (dt / 16.6667);
      if (b.x + b.w < -20) { b.x = GAME_WIDTH + rand(0, 60); b.h = rand(60, 170); b.w = rand(50, 85); b.lit = Math.random() < 0.5; }
    });

    render(world, now);

    setHud({
      score: Math.floor(world.score), timeLeft: Math.max(0, Math.ceil(world.timeLeft)), lives: world.lives,
      combo: world.comboMultiplier, speed: Math.round(world.speed * 10) / 10, shield: p.shielded,
      magnetUntil: p.magnetUntil, slowmoUntil: p.slowmoUntil, multUntil: p.multUntil,
    });

    rafRef.current = requestAnimationFrame(loop);
  }, [endRun]);

  function drawPlayer(ctx, world, now) {
    const p = world.player;
    const hit = now < p.hitFlashUntil;
    const invuln = now < p.invulnUntil;
    const playerHeight = p.ducking ? PLAYER_DUCK_HEIGHT : PLAYER_HEIGHT;
    const feetY = GROUND_Y + p.jumpY;
    ctx.save();
    if (invuln && Math.floor(now / 80) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.translate(PLAYER_X, feetY);
    if (p.shielded) {
      ctx.save();
      ctx.strokeStyle = "rgba(155, 140, 255, 0.85)"; ctx.lineWidth = 2;
      ctx.shadowColor = "#9b8cff"; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(0, -playerHeight / 2, playerHeight * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const airFactor = clamp(1 - Math.abs(p.jumpY) / 90, 0.25, 1);
    ctx.beginPath(); ctx.ellipse(0, 4, 16 * airFactor, 6 * airFactor, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fill();
    const bodyColor = hit ? "#ffffff" : "#47d6c4";
    ctx.shadowColor = "#47d6c4"; ctx.shadowBlur = p.jumping ? 26 : 16; ctx.fillStyle = bodyColor;
    if (p.ducking) {
      ctx.beginPath(); ctx.roundRect(-18, -playerHeight, 36, playerHeight, 8); ctx.fill();
      ctx.beginPath(); ctx.arc(14, -playerHeight + 8, 10, 0, Math.PI * 2); ctx.fill();
    } else {
      const cycle = (now / 90) % 2;
      const legOffset = p.jumping ? 6 : Math.sin(cycle * Math.PI) * 8;
      ctx.fillRect(-13, -30 + legOffset * 0.2, 9, 30 - legOffset * 0.2);
      ctx.fillRect(4, -30 - legOffset * 0.2, 9, 30 + legOffset * 0.2);
      const tilt = p.jumping ? clamp(p.vy * 0.02, -0.15, 0.15) : 0;
      ctx.rotate(tilt);
      ctx.beginPath(); ctx.roundRect(-15, -playerHeight, 30, playerHeight - 30, 8); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -playerHeight + 4, 13, 0, Math.PI * 2); ctx.fill();
      ctx.rotate(-tilt);
    }
    ctx.restore();
  }
  function drawObstacle(ctx, ob) {
    ctx.save(); ctx.shadowColor = "#e5645f"; ctx.shadowBlur = 14; ctx.fillStyle = "#f0a5a1";
    if (ob.type === "block") { ctx.beginPath(); ctx.roundRect(ob.x, GROUND_Y - ob.height, ob.width, ob.height, 4); ctx.fill(); }
    else { const barBottom = GROUND_Y - ob.bottomGap; ctx.beginPath(); ctx.roundRect(ob.x, barBottom - ob.height, ob.width, ob.height, 4); ctx.fill(); }
    ctx.restore();
  }
  function drawCoin(ctx, coin, now) {
    ctx.save();
    const bob = Math.sin(now / 200 + coin.x) * 3;
    ctx.translate(coin.x, coin.y + bob);
    ctx.shadowColor = "#e8a33d"; ctx.shadowBlur = 16; ctx.fillStyle = "#f3c98a";
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#c9862f"; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
  }
  function drawPowerup(ctx, pu, now) {
    const colors = { [SHIELD_LABEL]: "#47d6c4", [MAGNET_LABEL]: "#9b8cff", [SLOWMO_LABEL]: "#e8a33d", [MULT_LABEL]: "#e5645f" };
    const labels = { [SHIELD_LABEL]: "S", [MAGNET_LABEL]: "M", [SLOWMO_LABEL]: "T", [MULT_LABEL]: "x2" };
    ctx.save();
    const bob = Math.sin(now / 180 + pu.x) * 3;
    ctx.translate(pu.x, pu.y + bob);
    ctx.shadowColor = colors[pu.type]; ctx.shadowBlur = 16; ctx.fillStyle = colors[pu.type];
    ctx.beginPath(); ctx.arc(0, 0, 12, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0b0d10"; ctx.font = "bold 10px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(labels[pu.type], 0, 1);
    ctx.restore();
  }
  function drawParticle(ctx, pt) {
    ctx.save(); ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1); ctx.fillStyle = pt.color;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 2.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
  function render(world, now) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.save();
    if (now < world.shakeUntil) ctx.translate(rand(-world.shakeMag, world.shakeMag), rand(-world.shakeMag, world.shakeMag));
    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, "#0b0d10"); grad.addColorStop(1, "#12101c");
    ctx.fillStyle = grad; ctx.fillRect(-20, -20, GAME_WIDTH + 40, GAME_HEIGHT + 40);
    world.stars.forEach((star) => { ctx.fillStyle = "rgba(226,232,240,0.55)"; ctx.beginPath(); ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2); ctx.fill(); });
    world.skyline.forEach((b) => {
      ctx.fillStyle = "rgba(30, 24, 46, 0.9)"; ctx.fillRect(b.x, GROUND_Y - b.h, b.w, b.h);
      if (b.lit) { ctx.fillStyle = "rgba(71, 214, 196, 0.35)"; for (let wy = GROUND_Y - b.h + 10; wy < GROUND_Y - 10; wy += 16) { ctx.fillRect(b.x + 6, wy, 5, 5); ctx.fillRect(b.x + b.w - 11, wy, 5, 5); } }
    });
    ctx.strokeStyle = "rgba(71, 214, 196, 0.12)"; ctx.lineWidth = 2;
    const scrollOffset = (world.elapsed * world.speed * 12) % 80;
    for (let x = -scrollOffset; x < GAME_WIDTH; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, GAME_HEIGHT); ctx.stroke(); }
    ctx.fillStyle = "#0d1013"; ctx.fillRect(0, GROUND_Y + 6, GAME_WIDTH, GAME_HEIGHT - GROUND_Y - 6);
    ctx.strokeStyle = "rgba(155, 140, 255, 0.35)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y + 6); ctx.lineTo(GAME_WIDTH, GROUND_Y + 6); ctx.stroke();
    world.powerups.forEach((pu) => drawPowerup(ctx, pu, now));
    world.obstacles.forEach((ob) => drawObstacle(ctx, ob));
    world.coins.forEach((coin) => drawCoin(ctx, coin, now));
    world.particles.forEach((pt) => drawParticle(ctx, pt));
    drawPlayer(ctx, world, now);
    ctx.restore();
  }

  useEffect(() => {
    if (micro === "active") {
      stateRef.current = buildWorld();
      lastTimeRef.current = 0;
      inputRef.current = { jumpQueued: false, ducking: false };
      rafRef.current = requestAnimationFrame(loop);
    }
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micro]);

  const handleTouchJump = (e) => { e.preventDefault(); inputRef.current.jumpQueued = true; };
  const handleDuckStart = (e) => { e.preventDefault(); inputRef.current.ducking = true; };
  const handleDuckEnd = (e) => { e.preventDefault(); inputRef.current.ducking = false; };

  const magnetActive = hud.magnetUntil > Date.now();
  const slowmoActive = hud.slowmoUntil > Date.now();
  const multActive = hud.multUntil > Date.now();

  if (micro === "intro") {
    return (
      <div className="flex flex-col items-center gap-5 py-10 text-center px-4">
        <div className="w-16 h-16 rounded-2xl border border-[#47d6c4]/40 bg-[#47d6c4]/10 flex items-center justify-center">
          <GameIcon id="shadow-arena" size={30} />
        </div>
        <h3 className="text-xl font-bold [font-family:'Space_Grotesk',sans-serif]">Shadow Arena</h3>
        <p className="text-[#545c67] text-xs max-w-md space-y-1">
          <b>W / ↑ / Space</b> — jump (double-tap for a double jump) · <b>S / ↓</b> — duck under bars ·{" "}
          <b>P / Esc</b> — pause. Collect orbs, chain dodges for combo, grab power-ups. Survive {ROUND_DURATION}s to win.
        </p>
        <button onClick={() => setMicro("active")} className="px-8 py-3 rounded-full bg-[#47d6c4] font-bold tracking-widest uppercase text-sm text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif]">
          Start Run
        </button>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-3">
      <div className="flex flex-wrap gap-2 mb-3 text-[10px] sm:text-xs">
        <StatChip label="SCORE" value={hud.score} color="#47d6c4" />
        <StatChip label="COMBO" value={`x${hud.combo}`} color="#47d6c4" />
        <StatChip label="SPEED" value={hud.speed} color="#47d6c4" />
        <div className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0b0d10]/70 border border-[#47d6c4]/20 text-[10px] sm:text-xs md:text-sm [font-family:'IBM_Plex_Mono',monospace] flex items-center gap-1">
          LIVES
          <span className="ml-1 flex items-center gap-0.5">
            {Array.from({ length: START_LIVES }).map((_, i) => (
              <Heart key={i} size={12} color="#47d6c4" fill={i < hud.lives ? "#47d6c4" : "none"} strokeWidth={1.6} />
            ))}
          </span>
        </div>
        <StatChip label="TIME" value={`${hud.timeLeft}s`} color="#47d6c4" />
        <button onClick={() => setPaused((v) => !v)} className="px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#0b0d10]/70 border border-[#1d232b] text-[#8992a1] font-bold hover:bg-[#0d1013] transition inline-flex items-center gap-1.5">
          {paused ? <Play size={13} /> : <Pause size={13} />} {paused ? "Resume" : "Pause"}
        </button>
      </div>
      {(hud.shield || magnetActive || slowmoActive || multActive) && (
        <div className="flex flex-wrap gap-2 mb-3 text-[10px] sm:text-xs [font-family:'IBM_Plex_Mono',monospace]">
          {hud.shield && (
            <span className="px-2 py-1 rounded-full bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-semibold inline-flex items-center gap-1">
              <Shield size={12} /> Shield
            </span>
          )}
          {magnetActive && (
            <span className="px-2 py-1 rounded-full bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-semibold inline-flex items-center gap-1">
              <Magnet size={12} /> Magnet
            </span>
          )}
          {slowmoActive && (
            <span className="px-2 py-1 rounded-full bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-semibold inline-flex items-center gap-1">
              <Timer size={12} /> Slow-Mo
            </span>
          )}
          {multActive && (
            <span className="px-2 py-1 rounded-full bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-semibold inline-flex items-center gap-1">
              <Zap size={12} /> 2x Score
            </span>
          )}
        </div>
      )}
      <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} className="w-full h-auto block bg-black touch-none rounded-lg" />
      {paused && (
        <div className="flex flex-col items-center justify-center gap-3 text-center py-6">
          <h2 className="text-xl font-bold text-[#e7eaee] tracking-widest [font-family:'Space_Grotesk',sans-serif]">PAUSED</h2>
          <button onClick={() => setPaused(false)} className="px-6 py-2 rounded-full bg-[#47d6c4] font-bold uppercase text-xs text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif] inline-flex items-center gap-1.5">
            <Play size={14} /> Resume
          </button>
        </div>
      )}
      <div className="flex gap-3 mt-3 md:hidden select-none">
        <button onPointerDown={handleTouchJump} className="flex-1 py-4 rounded-xl bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-bold uppercase text-sm active:bg-[#47d6c4]/25 transition">⬆ Jump</button>
        <button onPointerDown={handleDuckStart} onPointerUp={handleDuckEnd} onPointerLeave={handleDuckEnd} className="flex-1 py-4 rounded-xl bg-[#9b8cff]/10 border border-[#9b8cff]/40 text-[#9b8cff] font-bold uppercase text-sm active:bg-[#9b8cff]/25 transition">⬇ Duck</button>
      </div>
    </div>
  );
}

/* ============================================================
   GAME 2 — ASTEROID DODGE
   ============================================================ */
function AsteroidDodgeGame({ onFinish }) {
  const DURATION = 40;
  const LANE_COUNT = 5;
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const worldRef = useRef(null);
  const lastRef = useRef(0);
  const [micro, setMicro] = useState("intro");
  const [hud, setHud] = useState({ timeLeft: DURATION, score: 0 });
  const doneRef = useRef(false);
  const W = 480, H = 340;
  const laneW = W / LANE_COUNT;

  const finish = useCallback((result) => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onFinish(result, Math.floor(worldRef.current?.score || 0), result === "win");
  }, [onFinish]);

  useEffect(() => {
    if (micro !== "active") return;
    worldRef.current = { lane: 2, rocks: [], elapsed: 0, score: 0, nextSpawn: 0 };
    lastRef.current = 0;

    const onKey = (e) => {
      const w = worldRef.current;
      if (!w) return;
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") w.lane = clamp(w.lane - 1, 0, LANE_COUNT - 1);
      if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") w.lane = clamp(w.lane + 1, 0, LANE_COUNT - 1);
    };
    window.addEventListener("keydown", onKey);

    const tick = (ts) => {
      const w = worldRef.current;
      if (!w || doneRef.current) return;
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min(ts - lastRef.current, 50);
      lastRef.current = ts;
      w.elapsed += dt / 1000;
      w.score += dt / 40;

      if (w.elapsed >= DURATION) { finish("win"); return; }

      const speed = clamp(2.5 + w.elapsed * 0.06, 2.5, 7);
      w.nextSpawn -= dt;
      if (w.nextSpawn <= 0) {
        w.rocks.push({ lane: randInt(0, LANE_COUNT - 1), y: -30, size: rand(24, 40) });
        w.nextSpawn = rand(280, 650) - Math.min(300, w.elapsed * 4);
      }

      for (let i = w.rocks.length - 1; i >= 0; i--) {
        const r = w.rocks[i];
        r.y += speed * (dt / 16.6667) * 4;
        if (r.y > H - 50 && r.y < H - 10 && r.lane === w.lane) {
          finish("loss"); return;
        }
        if (r.y > H + 40) w.rocks.splice(i, 1);
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#0b0d10"; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(71,214,196,0.12)"; ctx.lineWidth = 1;
        for (let l = 1; l < LANE_COUNT; l++) { ctx.beginPath(); ctx.moveTo(l * laneW, 0); ctx.lineTo(l * laneW, H); ctx.stroke(); }
        ctx.fillStyle = "#e5645f"; ctx.shadowColor = "#e5645f"; ctx.shadowBlur = 12;
        w.rocks.forEach((r) => {
          ctx.beginPath();
          ctx.arc(r.lane * laneW + laneW / 2, r.y, r.size / 2, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.shadowBlur = 20; ctx.shadowColor = "#47d6c4"; ctx.fillStyle = "#47d6c4";
        ctx.beginPath();
        ctx.roundRect(w.lane * laneW + laneW / 2 - 16, H - 44, 32, 30, 6);
        ctx.fill();
      }

      setHud({ timeLeft: Math.max(0, Math.ceil(DURATION - w.elapsed)), score: Math.floor(w.score) });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micro]);

  const moveLane = (dir) => { if (worldRef.current) worldRef.current.lane = clamp(worldRef.current.lane + dir, 0, LANE_COUNT - 1); };

  if (micro === "intro") {
    return (
      <div className="flex flex-col items-center gap-5 py-14 text-center px-4">
        <div className="w-16 h-16 rounded-2xl border border-[#47d6c4]/40 bg-[#47d6c4]/10 flex items-center justify-center">
          <GameIcon id="asteroid-dodge" size={30} />
        </div>
        <h3 className="text-xl font-bold [font-family:'Space_Grotesk',sans-serif]">Asteroid Dodge</h3>
        <p className="text-[#545c67] text-xs max-w-md">
          Use <b>←/A</b> and <b>→/D</b> (or the buttons) to switch lanes and dodge falling rocks. Survive {DURATION} seconds to win.
        </p>
        <button onClick={() => setMicro("active")} className="px-8 py-3 rounded-full bg-[#47d6c4] font-bold tracking-widest uppercase text-sm text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif]">
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <StatChip label="SCORE" value={hud.score} color="#47d6c4" />
        <StatChip label="TIME" value={`${hud.timeLeft}s`} color="#47d6c4" />
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="rounded-lg bg-black max-w-full" />
      <div className="flex gap-3 w-full max-w-xs">
        <button onClick={() => moveLane(-1)} className="flex-1 py-3 rounded-xl bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-bold">◀</button>
        <button onClick={() => moveLane(1)} className="flex-1 py-3 rounded-xl bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4] font-bold">▶</button>
      </div>
    </div>
  );
}

/* ============================================================
   GAME 3 — NEON SNAKE
   ============================================================ */
function NeonSnakeGame({ onFinish }) {
  const GRID = 16;
  const CELL = 20;
  const WIN_LENGTH = 15;
  const [micro, setMicro] = useState("intro");
  const worldRef = useRef(null);
  const rafRef = useRef(null);
  const lastRef = useRef(0);
  const doneRef = useRef(false);
  const canvasRef = useRef(null);
  const [hud, setHud] = useState({ length: 3, score: 0 });

  const finish = useCallback((result) => {
    if (doneRef.current) return;
    doneRef.current = true;
    cancelAnimationFrame(rafRef.current);
    onFinish(result, worldRef.current?.score || 0, result === "win");
  }, [onFinish]);

  useEffect(() => {
    if (micro !== "active") return;
    worldRef.current = {
      snake: [{ x: 7, y: 8 }, { x: 6, y: 8 }, { x: 5, y: 8 }],
      dir: { x: 1, y: 0 },
      nextDir: { x: 1, y: 0 },
      food: { x: 11, y: 8 },
      score: 0,
      stepMs: 140,
      acc: 0,
    };
    lastRef.current = 0;

    const onKey = (e) => {
      const w = worldRef.current; if (!w) return;
      const map = {
        ArrowUp: { x: 0, y: -1 }, w: { x: 0, y: -1 }, W: { x: 0, y: -1 },
        ArrowDown: { x: 0, y: 1 }, s: { x: 0, y: 1 }, S: { x: 0, y: 1 },
        ArrowLeft: { x: -1, y: 0 }, a: { x: -1, y: 0 }, A: { x: -1, y: 0 },
        ArrowRight: { x: 1, y: 0 }, d: { x: 1, y: 0 }, D: { x: 1, y: 0 },
      };
      const nd = map[e.key];
      if (nd && !(nd.x === -w.dir.x && nd.y === -w.dir.y)) w.nextDir = nd;
    };
    window.addEventListener("keydown", onKey);

    const placeFood = (w) => {
      let pos;
      do { pos = { x: randInt(0, GRID - 1), y: randInt(0, GRID - 1) }; }
      while (w.snake.some((s) => s.x === pos.x && s.y === pos.y));
      w.food = pos;
    };

    const draw = (w) => {
      const canvas = canvasRef.current; if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#0b0d10"; ctx.fillRect(0, 0, GRID * CELL, GRID * CELL);
      ctx.strokeStyle = "rgba(71,214,196,0.06)";
      for (let i = 0; i <= GRID; i++) {
        ctx.beginPath(); ctx.moveTo(i * CELL, 0); ctx.lineTo(i * CELL, GRID * CELL); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * CELL); ctx.lineTo(GRID * CELL, i * CELL); ctx.stroke();
      }
      ctx.fillStyle = "#e8a33d"; ctx.shadowColor = "#e8a33d"; ctx.shadowBlur = 12;
      ctx.beginPath(); ctx.arc(w.food.x * CELL + CELL / 2, w.food.y * CELL + CELL / 2, CELL / 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.shadowColor = "#47d6c4"; ctx.shadowBlur = 10;
      w.snake.forEach((seg, i) => {
        ctx.fillStyle = i === 0 ? "#47d6c4" : "rgba(71,214,196,0.75)";
        ctx.beginPath(); ctx.roundRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2, 4); ctx.fill();
      });
    };

    const tick = (ts) => {
      const w = worldRef.current;
      if (!w || doneRef.current) return;
      if (!lastRef.current) lastRef.current = ts;
      const dt = ts - lastRef.current;
      lastRef.current = ts;
      w.acc += dt;
      if (w.acc >= w.stepMs) {
        w.acc = 0;
        w.dir = w.nextDir;
        const head = { x: w.snake[0].x + w.dir.x, y: w.snake[0].y + w.dir.y };
        if (head.x < 0 || head.y < 0 || head.x >= GRID || head.y >= GRID || w.snake.some((s) => s.x === head.x && s.y === head.y)) {
          finish("loss"); return;
        }
        w.snake.unshift(head);
        if (head.x === w.food.x && head.y === w.food.y) {
          w.score += 25;
          w.stepMs = Math.max(80, w.stepMs - 4);
          placeFood(w);
          if (w.snake.length >= WIN_LENGTH) { finish("win"); return; }
        } else {
          w.snake.pop();
        }
        setHud({ length: w.snake.length, score: w.score });
      }
      draw(w);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafRef.current); window.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micro]);

  const steer = (dx, dy) => {
    const w = worldRef.current; if (!w) return;
    if (!(dx === -w.dir.x && dy === -w.dir.y)) w.nextDir = { x: dx, y: dy };
  };

  if (micro === "intro") {
    return (
      <div className="flex flex-col items-center gap-5 py-14 text-center px-4">
        <div className="w-16 h-16 rounded-2xl border border-[#47d6c4]/40 bg-[#47d6c4]/10 flex items-center justify-center">
          <GameIcon id="neon-snake" size={30} />
        </div>
        <h3 className="text-xl font-bold [font-family:'Space_Grotesk',sans-serif]">Neon Snake</h3>
        <p className="text-[#545c67] text-xs max-w-md">
          Arrow keys or WASD to steer. Eat the amber orbs to grow. Hit a wall or yourself and it's over — reach length {WIN_LENGTH} to win.
        </p>
        <button onClick={() => setMicro("active")} className="px-8 py-3 rounded-full bg-[#47d6c4] font-bold tracking-widest uppercase text-sm text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif]">
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col items-center gap-3">
      <div className="flex gap-2">
        <StatChip label="LENGTH" value={`${hud.length}/${WIN_LENGTH}`} color="#47d6c4" />
        <StatChip label="SCORE" value={hud.score} color="#47d6c4" />
      </div>
      <canvas ref={canvasRef} width={GRID * CELL} height={GRID * CELL} className="rounded-lg bg-black max-w-full" />
      <div className="grid grid-cols-3 gap-2 w-32 md:hidden">
        <span />
        <button onClick={() => steer(0, -1)} className="py-2 rounded-lg bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4]">▲</button>
        <span />
        <button onClick={() => steer(-1, 0)} className="py-2 rounded-lg bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4]">◀</button>
        <button onClick={() => steer(0, 1)} className="py-2 rounded-lg bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4]">▼</button>
        <button onClick={() => steer(1, 0)} className="py-2 rounded-lg bg-[#47d6c4]/10 border border-[#47d6c4]/40 text-[#47d6c4]">▶</button>
      </div>
    </div>
  );
}

/* ============================================================
   GAME 4 — MEMORY GRID (Simon)
   ============================================================ */
function MemoryGridGame({ onFinish }) {
  const TILES = 9;
  const WIN_ROUND = 10;
  const [micro, setMicro] = useState("intro");
  const [sequence, setSequence] = useState([]);
  const [playerStep, setPlayerStep] = useState(0);
  const [showing, setShowing] = useState(false);
  const [litTile, setLitTile] = useState(null);
  const [round, setRound] = useState(0);
  const doneRef = useRef(false);

  const finish = useCallback((result) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const score = round * 40;
    onFinish(result, score, result === "win");
  }, [onFinish, round]);

  const playSequence = useCallback(async (seq) => {
    setShowing(true);
    await new Promise((r) => setTimeout(r, 500));
    for (const tile of seq) {
      setLitTile(tile);
      await new Promise((r) => setTimeout(r, 380));
      setLitTile(null);
      await new Promise((r) => setTimeout(r, 180));
    }
    setShowing(false);
    setPlayerStep(0);
  }, []);

  const nextRound = useCallback((seq) => {
    const newSeq = [...seq, randInt(0, TILES - 1)];
    setSequence(newSeq);
    setRound(newSeq.length);
    playSequence(newSeq);
  }, [playSequence]);

  useEffect(() => {
    if (micro === "active") nextRound([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [micro]);

  const handleTileClick = (i) => {
    if (showing || doneRef.current) return;
    if (i === sequence[playerStep]) {
      setLitTile(i);
      setTimeout(() => setLitTile(null), 180);
      const step = playerStep + 1;
      if (step === sequence.length) {
        if (sequence.length >= WIN_ROUND) { finish("win"); return; }
        setTimeout(() => nextRound(sequence), 500);
      } else {
        setPlayerStep(step);
      }
    } else {
      finish("loss");
    }
  };

  if (micro === "intro") {
    return (
      <div className="flex flex-col items-center gap-5 py-14 text-center px-4">
        <div className="w-16 h-16 rounded-2xl border border-[#47d6c4]/40 bg-[#47d6c4]/10 flex items-center justify-center">
          <GameIcon id="memory-grid" size={30} />
        </div>
        <h3 className="text-xl font-bold [font-family:'Space_Grotesk',sans-serif]">Memory Grid</h3>
        <p className="text-[#545c67] text-xs max-w-md">
          Watch the tiles light up, then tap them back in the same order. Each round adds one more tile. Reach round {WIN_ROUND} to win — one wrong tap ends it.
        </p>
        <button onClick={() => setMicro("active")} className="px-8 py-3 rounded-full bg-[#47d6c4] font-bold tracking-widest uppercase text-sm text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif]">
          Start
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col items-center gap-4">
      <div className="flex gap-2">
        <StatChip label="ROUND" value={`${round}/${WIN_ROUND}`} color="#47d6c4" />
        <StatChip label="STATUS" value={showing ? "Watch..." : "Your turn"} color="#47d6c4" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: TILES }).map((_, i) => (
          <button
            key={i}
            onClick={() => handleTileClick(i)}
            disabled={showing}
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl border transition"
            style={{
              background: litTile === i ? "#47d6c4" : "#0b0d10",
              borderColor: litTile === i ? "#47d6c4" : "#1d232b",
              boxShadow: litTile === i ? "0 0 25px rgba(71,214,196,0.7)" : "none",
            }}
          />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   THEORY ROW — full description of one game, one full-width row
   ============================================================ */
function GameTheoryRow({ game, index }) {
  return (
    <div
      className="rounded-2xl border bg-[#0b0d10]/70 p-5 sm:p-7 flex flex-col gap-4 hover:bg-[#0d1013] transition-colors"
      style={{ borderColor: `${game.accent}33` }}
    >
      <div className="flex items-start sm:items-center gap-4">
        <span
          className="w-14 h-14 flex items-center justify-center rounded-2xl border shrink-0"
          style={{ borderColor: `${game.accent}55`, background: `${game.accent}12` }}
        >
          <GameIcon id={game.id} size={26} color={game.accent} />
        </span>
        <div className="min-w-0">
          <span
            className="text-[10px] uppercase tracking-[0.2em] [font-family:'IBM_Plex_Mono',monospace]"
            style={{ color: game.accent }}
          >
            Game 0{index + 1}
          </span>
          <h3 className="font-bold text-lg sm:text-xl leading-snug [font-family:'Space_Grotesk',sans-serif] text-[#e7eaee]">
            {game.title}
          </h3>
          <p className="text-[#8992a1] text-xs sm:text-sm mt-0.5">{game.tagline}</p>
        </div>
        <span
          className="ml-auto text-[10px] uppercase tracking-widest px-3 py-1 rounded-full border shrink-0 [font-family:'IBM_Plex_Mono',monospace]"
          style={{ borderColor: `${game.accent}55`, color: game.accent }}
        >
          {game.difficulty}
        </span>
      </div>

      <p className="text-[#c3c9d1] text-sm sm:text-base leading-relaxed">{game.theory}</p>

      <div className="flex flex-wrap gap-2">
        {game.skills.map((s) => (
          <span
            key={s}
            className="text-[10px] sm:text-xs px-2.5 py-1 rounded-full border text-[#8992a1] [font-family:'IBM_Plex_Mono',monospace]"
            style={{ borderColor: "#1d232b" }}
          >
            {s}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-4 border-t border-[#1d232b]">
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[#545c67] uppercase tracking-[0.15em] [font-family:'IBM_Plex_Mono',monospace]">Controls</span>
          <span className="text-[#8992a1] text-xs sm:text-sm leading-relaxed">{game.controls}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[#545c67] uppercase tracking-[0.15em] [font-family:'IBM_Plex_Mono',monospace]">Win Condition</span>
          <span className="text-[#8992a1] text-xs sm:text-sm leading-relaxed">{game.winCondition}</span>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-[#545c67] uppercase tracking-[0.15em] [font-family:'IBM_Plex_Mono',monospace]">Avg. Run</span>
          <span className="text-[#8992a1] text-xs sm:text-sm leading-relaxed">{game.avgTime}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function Game() {
  // "checking" | "hub" | "playing" | "victory" | "gameover"
  const [phase, setPhase] = useState("checking");
  const [profile, setProfile] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [paused, setPaused] = useState(false); // only meaningful for Shadow Arena
  const [activeGameId, setActiveGameId] = useState(null);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState("");
  const [runKey, setRunKey] = useState(0);
  const [showGamesGrid, setShowGamesGrid] = useState(false); // games are hidden until "Play Game" is pressed
  const arenaSectionRef = useRef(null);
  const gamesGridRef = useRef(null);

  /* ------------------------------------------------------------
     LEADERBOARD
     ------------------------------------------------------------ */
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await axios.get(`${API_BASE}/leaderboard`, authHeaders());
      setLeaderboard(res.data.leaderboard || []);
    } catch (err) {
      // non-fatal
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);

  /* ------------------------------------------------------------
     SESSION BOOTSTRAP — the game page always lands on the hub.
     It simply reads whatever session token the rest of the site
     (regular site login / AuthContext) has already stored under
     TOKEN_KEY. There is no separate connect-to-play step here:
     if the user is logged in on the site, they're logged in here.
     ------------------------------------------------------------ */
  const fetchProfile = useCallback(async () => {
    const res = await axios.get(`${API_BASE}/profile`, authHeaders());
    setProfile(res.data.profile);
    return res.data.profile;
  }, []);

  useEffect(() => {
    const bootstrap = async () => {
      const token = getToken();
      if (token) {
        try {
          await fetchProfile();
        } catch (err) {
          // token invalid/expired — leave profile empty, hub still shows
        }
      }
      setPhase("hub");
    };
    bootstrap();
  }, [fetchProfile]);

  /* ------------------------------------------------------------
     GAME SELECTION / FINISH / SUBMIT
     ------------------------------------------------------------ */
  const scrollToArena = () => {
    arenaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleShowGames = () => {
    setShowGamesGrid(true);
    setTimeout(() => gamesGridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleBackToHub = () => {
    setPhase("hub");
    setActiveGameId(null);
    setShowGamesGrid(true);
    setTimeout(scrollToArena, 50);
  };

  const startGame = async (gameId) => {
    setError("");
    try {
      await axios.post(`${API_BASE}/start`, { gameId }, authHeaders());
    } catch (err) {
      if (err?.response?.status === 401) {
        // Session on the site has expired/logged out — just surface a message,
        // no separate connect flow. User can log back in via the site's own login.
        localStorage.removeItem(TOKEN_KEY);
        setProfile(null);
        setError("Your session has expired. Please log in again to save your score.");
        return;
      }
      setError(err?.response?.data?.message || "Failed to start mission.");
      return;
    }
    setActiveGameId(gameId);
    setResultData(null);
    setPaused(false);
    setRunKey((k) => k + 1);
    setPhase("playing");
  };

  const handlePlayGame = (gameId) => {
    // No more "connect to play" gate — anyone already logged in on the
    // site can play directly. XP/ranking are tied to that same session.
    startGame(gameId);
  };

  const handleGameFinish = useCallback(
    async (result, score, perfectRun) => {
      const finalScore = Math.floor(score || 0);
      const xpEarned = Math.min(XP_CAP, Math.floor(finalScore / XP_SCORE_DIVISOR));

      setResultData({ xpEarned, perfectRun: !!perfectRun, score: finalScore, result });
      setPhase(result === "win" ? "victory" : "gameover");

      setSubmitting(true);
      try {
        await axios.post(`${API_BASE}/finish`, { gameId: activeGameId, result, score: finalScore }, authHeaders());
        const submitRes = await axios.post(
          `${API_BASE}/submit-score`,
          { gameId: activeGameId, score: finalScore, xpEarned, result, perfectRun: !!perfectRun },
          authHeaders()
        );
        if (submitRes.data?.profile) setProfile(submitRes.data.profile);
        fetchLeaderboard();
      } catch (err) {
        setError(err?.response?.data?.message || "Failed to submit your score.");
      } finally {
        setSubmitting(false);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [activeGameId, fetchLeaderboard]
  );

  const handlePlayAgain = () => {
    setResultData(null);
    setPaused(false);
    setRunKey((k) => k + 1);
    setPhase("playing");
  };

  const activeGameMeta = GAMES.find((g) => g.id === activeGameId);
  const topScore = leaderboard[0]?.totalXP ?? 0;

  const renderActiveGame = () => {
    const props = { key: runKey, onFinish: handleGameFinish };
    switch (activeGameId) {
      case "shadow-arena": return <ShadowArenaGame {...props} paused={paused} setPaused={setPaused} />;
      case "asteroid-dodge": return <AsteroidDodgeGame {...props} />;
      case "neon-snake": return <NeonSnakeGame {...props} />;
      case "memory-grid": return <MemoryGridGame {...props} />;
      default: return null;
    }
  };

  /* ------------------------------------------------------------
     UI
     ------------------------------------------------------------ */
  return (
    <div className="min-h-screen w-full bg-[#0b0d10] text-[#e7eaee] flex flex-col items-center px-3 sm:px-4 py-6 sm:py-8 [font-family:'Inter',sans-serif]">
      <style>{THEME_FONTS}</style>
      <div className="w-full max-w-5xl">

        {/* ============ TOP: hero, split like the Academy landing —
            eyebrow + big headline + description on the left,
            an "up next" style preview card on the right ============ */}
        <header className="mb-12">
          <div className="flex justify-center sm:justify-start mb-6">
            <Eyebrow>Arena // Arcade</Eyebrow>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 lg:gap-10 items-start">
            {/* left: headline + copy + CTAs */}
            <div className="text-center lg:text-left">
              <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.05] tracking-tight [font-family:'Space_Grotesk',sans-serif] text-[#e7eaee] mb-5">
                Four games.
                <br />
                Zero cost.
                <br />
                One shared leaderboard.
              </h1>
              <p className="text-[#8992a1] text-sm sm:text-base max-w-lg mx-auto lg:mx-0 mb-7 leading-relaxed">
                A curated arcade built to test reflexes, precision, planning, and memory —
                each run earns capped XP toward the arena leaderboard, tied to your
                account on the site.
              </p>
              <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                <button
                  onClick={() => { handleShowGames(); scrollToArena(); }}
                  className="px-8 sm:px-10 py-3 rounded-full bg-[#47d6c4] font-bold tracking-wide uppercase text-sm text-[#0b0d10] hover:brightness-110 transition shadow-[0_0_30px_rgba(71,214,196,0.35)] [font-family:'Space_Grotesk',sans-serif] inline-flex items-center gap-2"
                >
                  Start Playing
                  <span aria-hidden>›</span>
                </button>
                <button
                  onClick={scrollToArena}
                  className="px-8 py-3 rounded-full border border-[#1d232b] text-[#e7eaee] font-bold uppercase text-sm hover:bg-[#0d1013] transition [font-family:'Space_Grotesk',sans-serif]"
                >
                  See the leaderboard
                </button>
              </div>
            </div>

            {/* right: "up next" style preview card, mirrors the Academy hero card */}
            <div className="rounded-2xl border border-[#1d232b] bg-[#0b0d10]/70 p-5 sm:p-6 w-full">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-[0.2em] text-[#47d6c4] [font-family:'IBM_Plex_Mono',monospace]">
                  Up Next · Game 01
                </span>
              </div>
              <h2 className="text-xl sm:text-2xl font-bold [font-family:'Space_Grotesk',sans-serif] text-[#e7eaee] mb-4">
                {GAMES[0].title}
              </h2>
              <ul className="flex flex-col gap-3 mb-5">
                {GAMES.slice(0, 3).map((g, i) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2.5 text-[#c3c9d1] min-w-0">
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ background: i === 0 ? "#47d6c4" : "transparent", border: i === 0 ? "none" : "1px solid #545c67" }}
                      />
                      <span className="truncate">{g.title}</span>
                    </span>
                    <span className="text-[#545c67] text-xs shrink-0 [font-family:'IBM_Plex_Mono',monospace]">{g.avgTime}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between text-xs text-[#545c67] pt-4 border-t border-[#1d232b] [font-family:'IBM_Plex_Mono',monospace]">
                <span>{GAMES.length} games</span>
                <span>Capped at {XP_CAP} XP / run</span>
              </div>
            </div>
          </div>
        </header>

        {/* ============ ARENA STATS STRIP ============ */}
        <section className="mb-12 flex flex-wrap gap-3 sm:gap-4">
          <ArenaStatTile label="Games Available" value={GAMES.length} color="#47d6c4" />
          <ArenaStatTile label="Players Ranked" value={leaderboard.length} color="#47d6c4" />
          <ArenaStatTile label="Top XP" value={topScore} color="#47d6c4" />
          <ArenaStatTile label="Max XP / Run" value={XP_CAP} color="#47d6c4" />
        </section>

        {/* ============ THEORY SECTION — one row per game ============ */}
        <section className="mb-12">
          <div className="mb-6 text-center lg:text-left">
            <span className="text-[#545c67] text-[11px] tracking-[0.2em] uppercase [font-family:'IBM_Plex_Mono',monospace]">
              How Each Game Works
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold [font-family:'Space_Grotesk',sans-serif] text-[#e7eaee] mt-2">
              4 games, fully explained before you play.
            </h2>
            <p className="text-[#8992a1] text-sm mt-2 max-w-2xl mx-auto lg:mx-0">
              Every card below covers what the game is, how it plays, what the controls
              are, and exactly what counts as a win — so there are no surprises once
              the run starts.
            </p>
          </div>
          <div className="flex flex-col gap-4 sm:gap-5">
            {GAMES.map((g, i) => (
              <GameTheoryRow key={g.id} game={g} index={i} />
            ))}
          </div>
        </section>

        {error && (
          <div className="mb-6 rounded-lg border border-[#e5645f]/40 bg-[#e5645f]/10 px-4 py-3 text-[#f0a5a1] text-sm">
            {error}
          </div>
        )}

        {/* ============ PLAYABLE ARENA + LEADERBOARD ============ */}
        <div ref={arenaSectionRef} className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 sm:gap-6 scroll-mt-6">
          {/* MAIN PANEL */}
          <div className="rounded-2xl border border-[#47d6c4]/20 bg-[#0d1013]/80 backdrop-blur p-3 sm:p-4 md:p-6 shadow-[0_0_40px_rgba(71,214,196,0.15)]">
            {phase === "checking" && (
              <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
                <div className="w-10 h-10 border-2 border-[#47d6c4]/60 border-t-transparent rounded-full animate-spin" />
                <p className="text-[#545c67] text-sm">Checking session...</p>
              </div>
            )}

            {phase === "hub" && (
              <div className="flex flex-col items-center gap-8 py-10 sm:py-12">
                {profile && (
                  <div className="flex items-center gap-4 bg-[#0b0d10]/70 border border-[#47d6c4]/20 rounded-2xl px-5 sm:px-6 py-4 w-full sm:w-auto">
                    <img
                      src={profile.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=hacker"}
                      alt="avatar"
                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-full border-2 border-[#47d6c4]/60"
                    />
                    <div className="text-left">
                      <p className="font-bold text-base sm:text-lg [font-family:'Space_Grotesk',sans-serif]">{profile.username}</p>
                      <p className="text-[#47d6c4] text-sm">Level XP: {profile.totalXP ?? 0}</p>
                      <p className="text-[#545c67] text-xs">Wins {profile.wins ?? 0} · Losses {profile.losses ?? 0}</p>
                    </div>
                  </div>
                )}

                {!showGamesGrid ? (
                  <div className="flex flex-col items-center gap-5 text-center py-6">
                    <div className="w-16 h-16 rounded-2xl border-2 border-[#47d6c4]/50 flex items-center justify-center shadow-[0_0_25px_rgba(71,214,196,0.35)]">
                      <span className="text-2xl">🕹️</span>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold [font-family:'Space_Grotesk',sans-serif] text-[#e7eaee] mb-2">
                        Ready when you are
                      </h3>
                      <p className="text-[#8992a1] text-sm max-w-sm">
                        Press Play Game to open the arena's 4 titles and jump straight into a run.
                      </p>
                    </div>
                    <button
                      onClick={handleShowGames}
                      className="px-8 py-3 rounded-full bg-[#47d6c4] font-bold tracking-wide uppercase text-sm text-[#0b0d10] hover:brightness-110 transition [font-family:'Space_Grotesk',sans-serif] inline-flex items-center gap-2"
                    >
                      <Play size={15} fill="#0b0d10" /> Play Game
                    </button>
                  </div>
                ) : (
                  <div ref={gamesGridRef} className="w-full">
                    <div className="flex items-center justify-between mb-5">
                      <h3 className="text-sm font-bold tracking-[0.15em] text-[#e7eaee] uppercase [font-family:'Space_Grotesk',sans-serif]">
                        Pick a Game
                      </h3>
                      <span className="text-[10px] text-[#545c67] uppercase tracking-[0.15em] [font-family:'IBM_Plex_Mono',monospace]">
                        {GAMES.length} available
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
                      {GAMES.map((g) => (
                        <div
                          key={g.id}
                          className="text-left rounded-2xl border bg-[#0b0d10]/70 p-5 sm:p-6 hover:bg-[#0d1013] transition-colors group flex flex-col"
                          style={{ borderColor: `${g.accent}33` }}
                        >
                          <div className="flex items-center gap-3 mb-3">
                            <span
                              className="w-11 h-11 flex items-center justify-center rounded-xl border shrink-0"
                              style={{ borderColor: `${g.accent}55`, background: `${g.accent}12` }}
                            >
                              <GameIcon id={g.id} size={20} color={g.accent} />
                            </span>
                            <span className="font-bold text-base [font-family:'Space_Grotesk',sans-serif] text-[#e7eaee]">
                              {g.title}
                            </span>
                            <span
                              className="ml-auto text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full border shrink-0 [font-family:'IBM_Plex_Mono',monospace]"
                              style={{ borderColor: `${g.accent}55`, color: g.accent }}
                            >
                              {g.difficulty}
                            </span>
                          </div>
                          <p className="text-[#8992a1] text-sm leading-relaxed mb-3">{g.tagline}</p>
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {g.skills.map((s) => (
                              <span key={s} className="text-[10px] px-2 py-0.5 rounded-full border border-[#1d232b] text-[#545c67] [font-family:'IBM_Plex_Mono',monospace]">
                                {s}
                              </span>
                            ))}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-[#545c67] mb-4 [font-family:'IBM_Plex_Mono',monospace] uppercase tracking-widest">
                            <span>{g.avgTime}</span>
                            <span>{g.winCondition.split(".")[0]}.</span>
                          </div>
                          <button
                            onClick={() => handlePlayGame(g.id)}
                            className="w-full py-3 rounded-xl font-bold uppercase text-xs tracking-widest text-[#0b0d10] transition hover:brightness-110 mt-auto [font-family:'Space_Grotesk',sans-serif]"
                            style={{ background: g.accent }}
                          >
                            ▶ Play
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {(phase === "playing" || phase === "victory" || phase === "gameover") && activeGameMeta && (
              <div className="relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{activeGameMeta.icon}</span>
                    <h2 className="font-bold [font-family:'Space_Grotesk',sans-serif]" style={{ color: activeGameMeta.accent }}>
                      {activeGameMeta.title}
                    </h2>
                  </div>
                  <button onClick={handleBackToHub} className="text-[#545c67] hover:text-[#8992a1] text-xs underline transition">
                    Quit to Games
                  </button>
                </div>

                <div className="relative w-full rounded-xl overflow-hidden border border-[#47d6c4]/30 shadow-[0_0_50px_rgba(71,214,196,0.25)] bg-black">
                  {renderActiveGame()}

                  {phase === "victory" && resultData && (
                    <EndOverlay
                      result="victory"
                      resultData={resultData}
                      submitting={submitting}
                      gameTitle={activeGameMeta.title}
                      onPlayAgain={handlePlayAgain}
                      onBackToHub={handleBackToHub}
                    />
                  )}
                  {phase === "gameover" && resultData && (
                    <EndOverlay
                      result="gameover"
                      resultData={resultData}
                      submitting={submitting}
                      gameTitle={activeGameMeta.title}
                      onPlayAgain={handlePlayAgain}
                      onBackToHub={handleBackToHub}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* LEADERBOARD */}
          <div className="rounded-2xl border border-[#47d6c4]/20 bg-[#0d1013]/80 backdrop-blur p-4 sm:p-5 shadow-[0_0_40px_rgba(71,214,196,0.12)]">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold tracking-[0.15em] text-[#47d6c4] uppercase [font-family:'Space_Grotesk',sans-serif]">
                Arena Leaderboard
              </h3>
              <LiveDot />
            </div>
            <div className="flex flex-col gap-2 max-h-[300px] lg:max-h-[500px] overflow-y-auto pr-1">
              {leaderboard.length === 0 && <p className="text-[#545c67] text-xs">No runs recorded yet.</p>}
              {leaderboard.map((entry, i) => {
                const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : null;
                return (
                  <div
                    key={entry._id || entry.user || i}
                    className="flex items-center justify-between bg-[#0b0d10]/60 border rounded-xl px-3 py-2.5 text-sm"
                    style={{ borderColor: i < 3 ? "#47d6c455" : "#1d232b" }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="font-bold w-6 text-right [font-family:'IBM_Plex_Mono',monospace]"
                        style={{ color: "#47d6c4" }}
                      >
                        {medal || i + 1}
                      </span>
                      <img
                        src={entry.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=" + (entry.username || i)}
                        alt=""
                        className="w-6 h-6 rounded-full"
                      />
                      <span className="truncate">{entry.username}</span>
                    </div>
                    <span className="text-[#47d6c4] font-semibold shrink-0 [font-family:'IBM_Plex_Mono',monospace]">{entry.totalXP} XP</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}