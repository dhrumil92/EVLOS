import { useEffect, useRef } from 'react';

const WIDTH = 240;
const HEIGHT = 420;
const MAX_LIFE = 300;

interface Wisp {
  age: number;
  phase: number;
}

function softPuff(): HTMLCanvasElement | null {
  const puff = document.createElement('canvas');
  puff.width = puff.height = 64;
  const context = puff.getContext('2d');
  if (!context) return null;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(226, 216, 238, 1)');
  gradient.addColorStop(1, 'rgba(226, 216, 238, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  return puff;
}

function paint(context: CanvasRenderingContext2D, puff: HTMLCanvasElement, wisps: Wisp[]) {
  context.clearRect(0, 0, WIDTH, HEIGHT);
  for (const wisp of wisps) {
    const t = wisp.age / MAX_LIFE;
    const curl =
      Math.sin(wisp.phase + t * 6) * 34 * t + Math.sin(wisp.phase * 2.3 + t * 11) * 9 * t;
    const size = 7 + t * 46;
    context.globalAlpha = Math.min(t * 8, 1) * (1 - t) * 0.11;
    context.drawImage(
      puff,
      WIDTH / 2 + curl - size / 2,
      HEIGHT - t * (HEIGHT - 8) - size / 2,
      size,
      size,
    );
  }
}

// Soft puffs rise from the ember and curl as they fade.
function useSmoke() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    const puff = softPuff();
    if (!canvas || !context || !puff) return;
    const scale = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * scale;
    canvas.height = HEIGHT * scale;
    context.scale(scale, scale);

    let wisps: Wisp[] = [];
    let tick = 0;
    let frame = 0;
    const step = () => {
      tick += 1;
      if (tick % 3 === 0) wisps.push({ age: 0, phase: tick * 0.018 });
      wisps = wisps.filter((wisp) => (wisp.age += 1) < MAX_LIFE);
    };
    const loop = () => {
      step();
      paint(context, puff, wisps);
      frame = requestAnimationFrame(loop);
    };
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      for (let i = 0; i < MAX_LIFE; i += 1) step();
      paint(context, puff, wisps);
    } else {
      loop();
    }
    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return canvasRef;
}

function Diya({ flareKey }: { flareKey: string | null }) {
  return (
    // A new key restarts the flare for each new Punch.
    <div key={flareKey ?? 'still'} className={`corner diya ${flareKey ? 'flare' : ''}`}>
      <svg viewBox="0 0 230 170">
        <defs>
          <radialGradient id="glow">
            <stop offset="0" stopColor="#ffcf6b" stopOpacity=".75" />
            <stop offset=".45" stopColor="#f29a2e" stopOpacity=".26" />
            <stop offset="1" stopColor="#f29a2e" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="clay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#e0a24a" />
            <stop offset="1" stopColor="#8a4418" />
          </linearGradient>
          <linearGradient id="fire" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" stopColor="#ff7a18" />
            <stop offset=".55" stopColor="#ffb52e" />
            <stop offset="1" stopColor="#ffe27a" />
          </linearGradient>
        </defs>
        <circle className="halo" cx="160" cy="80" r="92" fill="url(#glow)" />
        <path
          d="M16 122 C24 158 58 166 90 166 C124 166 156 150 178 110 C160 120 130 124 86 124 C60 124 36 124 16 122Z"
          fill="url(#clay)"
        />
        <ellipse cx="88" cy="122" rx="72" ry="11" fill="#6a3312" />
        <ellipse cx="86" cy="122" rx="60" ry="7" fill="#c98a2b" />
        <path
          d="M146 122 Q154 113 160 104"
          fill="none"
          stroke="#fff2c4"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <g className="flame">
          <path d="M160 106 C140 90 147 66 160 42 C173 66 180 90 160 106Z" fill="url(#fire)" />
          <path
            className="flame-core"
            d="M160 104 C151 94 154 78 160 66 C166 78 169 94 160 104Z"
            fill="#fff6cf"
          />
        </g>
      </svg>
    </div>
  );
}

function Dhoop() {
  const canvasRef = useSmoke();
  return (
    <div className="corner dhoop">
      <canvas ref={canvasRef} className="smoke" />
      <svg viewBox="0 0 120 150">
        <defs>
          <linearGradient id="brass" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#8a5a1e" />
            <stop offset=".5" stopColor="#f0cf7a" />
            <stop offset="1" stopColor="#7a4d18" />
          </linearGradient>
        </defs>
        <rect x="59" y="20" width="3" height="84" fill="#3a2418" />
        <circle cx="60.5" cy="20" r="3.4" fill="#ff8a2a" />
        <path d="M26 98 C30 122 90 122 94 98Z" fill="url(#brass)" />
        <ellipse cx="60" cy="98" rx="34" ry="6" fill="#5e3a14" />
        <rect x="53" y="118" width="14" height="14" fill="url(#brass)" />
        <ellipse cx="60" cy="136" rx="34" ry="8" fill="url(#brass)" />
      </svg>
    </div>
  );
}

// The ledge along the bottom: a diya on the left and burning dhoop on the right.
export function Altar({ flareKey }: { flareKey: string | null }) {
  return (
    <div aria-hidden="true">
      <div className="ledge" />
      <Diya flareKey={flareKey} />
      <Dhoop />
    </div>
  );
}
