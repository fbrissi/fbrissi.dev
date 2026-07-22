 'use client';

import { useEffect, useRef } from 'react';

// Grid pattern must match the previous CSS background (50px cells, --line color at 0.5 alpha).
const CELL_SIZE = 50;
const LINE_COLOR = 'rgba(42, 42, 42, 0.5)';

// Gravity-well style distortion around the cursor, like spacetime bending near a mass.
const DISTORTION_RADIUS = 260;
const DISTORTION_STRENGTH = 42;
const EVENT_HORIZON_RADIUS = 10;
const SAMPLE_STEP = 8;
const IDLE_DELAY_MS = 3000;
const EASE_RATE = 0.12;

export function GridBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let width = 0;
    let height = 0;
    let mouseX = -DISTORTION_RADIUS * 2;
    let mouseY = -DISTORTION_RADIUS * 2;
    let intensity = 0;
    let targetIntensity = 0;
    let idleTimeout: ReturnType<typeof setTimeout>;
    let rafId: number;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // Pulls a point toward the mouse, stronger the closer it is (smoothstep falloff).
    function warp(x: number, y: number): [number, number] {
      const dx = x - mouseX;
      const dy = y - mouseY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist >= DISTORTION_RADIUS || dist === 0) return [x, y];

      const t = 1 - dist / DISTORTION_RADIUS;
      const eased = t * t * (3 - 2 * t);
      const pull = Math.min(
        DISTORTION_STRENGTH * eased * intensity,
        Math.max(0, dist - EVENT_HORIZON_RADIUS)
      );

      return [x - (dx / dist) * pull, y - (dy / dist) * pull];
    }

    function drawVerticalLine(x: number) {
      ctx!.beginPath();

      if (intensity <= 0.001 || Math.abs(x - mouseX) >= DISTORTION_RADIUS) {
        ctx!.moveTo(x, 0);
        ctx!.lineTo(x, height);
      } else {
        const [startX, startY] = warp(x, 0);
        ctx!.moveTo(startX, startY);

        for (let y = SAMPLE_STEP; y < height; y += SAMPLE_STEP) {
          const [wx, wy] = warp(x, y);
          ctx!.lineTo(wx, wy);
        }

        const [endX, endY] = warp(x, height);
        ctx!.lineTo(endX, endY);
      }

      ctx!.stroke();
    }

    function drawHorizontalLine(y: number) {
      ctx!.beginPath();

      if (intensity <= 0.001 || Math.abs(y - mouseY) >= DISTORTION_RADIUS) {
        ctx!.moveTo(0, y);
        ctx!.lineTo(width, y);
      } else {
        const [startX, startY] = warp(0, y);
        ctx!.moveTo(startX, startY);

        for (let x = SAMPLE_STEP; x < width; x += SAMPLE_STEP) {
          const [wx, wy] = warp(x, y);
          ctx!.lineTo(wx, wy);
        }

        const [endX, endY] = warp(width, y);
        ctx!.lineTo(endX, endY);
      }

      ctx!.stroke();
    }

    function drawBlackHole() {
      ctx!.fillStyle = 'rgba(0, 0, 0, 0.96)';
      ctx!.beginPath();
      ctx!.arc(mouseX, mouseY, EVENT_HORIZON_RADIUS, 0, Math.PI * 2);
      ctx!.fill();
    }

    function draw() {
      ctx!.clearRect(0, 0, width, height);
      ctx!.strokeStyle = LINE_COLOR;
      ctx!.lineWidth = 1;

      for (let x = 0; x <= width; x += CELL_SIZE) drawVerticalLine(x);
      for (let y = 0; y <= height; y += CELL_SIZE) drawHorizontalLine(y);
      drawBlackHole();
    }

    function tick() {
      intensity += (targetIntensity - intensity) * EASE_RATE;
      if (Math.abs(intensity - targetIntensity) < 0.001) intensity = targetIntensity;

      draw();
      rafId = requestAnimationFrame(tick);
    }

    function activateAt(clientX: number, clientY: number) {
      mouseX = clientX;
      mouseY = clientY;
      targetIntensity = 1;

      clearTimeout(idleTimeout);
      idleTimeout = setTimeout(() => {
        targetIntensity = 0;
      }, IDLE_DELAY_MS);
    }

    function handleMouseMove(event: MouseEvent) {
      activateAt(event.clientX, event.clientY);
    }

    function handleTouch(event: TouchEvent) {
      const touch = event.touches[0];
      if (touch) activateAt(touch.clientX, touch.clientY);
    }

    resize();
    draw();
    rafId = requestAnimationFrame(tick);

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchstart', handleTouch, { passive: true });
    window.addEventListener('touchmove', handleTouch, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      clearTimeout(idleTimeout);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchstart', handleTouch);
      window.removeEventListener('touchmove', handleTouch);
    };
  }, []);

  return <canvas ref={canvasRef} className="grid-canvas" aria-hidden="true" />;
}
