"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { compassToBearing, type ThermalCue } from "@/lib/windViz";

// An ambient flow field drawn over the map imagery: dozens of faint streaks
// drifting the way today's wind blows (downwind, the direction your scent
// carries), their speed scaled to the wind speed and their tint hinting the
// thermal phase. It reads wind direction and strength at a glance and layers
// under the per-stand arrows and every map control. Purely decorative — the
// canvas never takes pointer events and pauses under reduced-motion.

type WindFlowOverlayProps = {
  fromCompass: string;
  speedMph: number | null;
  thermal?: ThermalCue | null;
  /**
   * How far the map is turned (heading-up mode, degrees clockwise from north;
   * null or 0 = north-up). The streaks are drawn on the screen, so they're
   * turned back by this much to keep pointing the true downwind direction.
   */
  mapBearing?: number | null;
};

// Streak tint by thermal phase: warm when thermals lift scent upslope, cool when
// they sink it downhill, soft white when neutral.
function flowColor(phase?: ThermalCue["phase"]): string {
  if (phase === "uphill") return "255, 206, 138";
  if (phase === "downhill") return "150, 205, 255";
  return "223, 232, 245";
}

type Particle = {
  x: number;
  y: number;
  px: number;
  py: number;
  age: number;
  life: number;
};

export default function WindFlowOverlay({
  fromCompass,
  speedMph,
  thermal,
  mapBearing = null,
}: WindFlowOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Read each frame, so turning the map steers the streaks without restarting
  // the animation (the compass updates many times a second).
  const bearingRef = useRef(0);
  useEffect(() => {
    bearingRef.current = mapBearing ?? 0;
  }, [mapBearing]);
  const fromBearing = compassToBearing(fromCompass);
  const phase = thermal?.phase;

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !parent || !ctx || fromBearing === null) return;

    // Air travels the way the wind blows *to* — 180° off the "from" bearing —
    // measured on screen, so a heading-up map's turn is taken back out.
    let dirX = 0;
    let dirY = -1;
    const aim = () => {
      const downwind = ((fromBearing + 180 - bearingRef.current) % 360) * (Math.PI / 180);
      dirX = Math.sin(downwind);
      dirY = -Math.cos(downwind); // screen y grows downward, so north is -y
    };
    aim();
    const speed = Math.max(0.5, Math.min(3.2, 0.6 + (speedMph ?? 4) * 0.16));
    const rgb = flowColor(phase);

    const reduce =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let w = 0;
    let h = 0;
    let particles: Particle[] = [];

    const newParticle = (): Particle => {
      const x = Math.random() * w;
      const y = Math.random() * h;
      return { x, y, px: x, py: y, age: Math.random() * 80, life: 50 + Math.random() * 90 };
    };

    const drawStatic = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";
      ctx.lineWidth = 1.2;
      for (const p of particles) {
        ctx.strokeStyle = `rgba(${rgb}, 0.3)`;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + dirX * 9, p.y + dirY * 9);
        ctx.stroke();
      }
    };

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const target = Math.round(Math.min(140, (w * h) / 9000));
      particles = Array.from({ length: Math.max(12, target) }, newParticle);
      if (reduce) drawStatic();
    };

    let raf = 0;
    const frame = () => {
      aim();
      // Fade prior streaks toward transparent so trails linger and dissolve.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
      ctx.fillRect(0, 0, w, h);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineCap = "round";
      ctx.lineWidth = 1.3;

      for (const p of particles) {
        p.px = p.x;
        p.py = p.y;
        p.x += dirX * speed;
        p.y += dirY * speed;
        p.age += 1;

        if (p.age > p.life || p.x < -12 || p.x > w + 12 || p.y < -12 || p.y > h + 12) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.px = p.x;
          p.py = p.y;
          p.age = 0;
          p.life = 50 + Math.random() * 90;
          continue;
        }

        const fade = Math.sin((p.age / p.life) * Math.PI); // 0 → 1 → 0 over its life
        ctx.strokeStyle = `rgba(${rgb}, ${0.5 * fade})`;
        ctx.beginPath();
        ctx.moveTo(p.px, p.py);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      }

      raf = requestAnimationFrame(frame);
    };

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(parent);
    if (!reduce) raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [fromBearing, speedMph, phase]);

  if (fromBearing === null) return null;

  return <canvas ref={canvasRef} aria-hidden="true" style={overlayStyle} />;
}

const overlayStyle: CSSProperties = {
  position: "absolute",
  inset: 0,
  // Above the golden-hour tint, below every map control and marker.
  zIndex: 460,
  pointerEvents: "none",
};
