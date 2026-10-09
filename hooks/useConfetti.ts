"use client";

import { useCallback } from "react";

export function useConfetti() {
  const fireConfetti = useCallback(() => {
    if (typeof window === "undefined") return;
    // Dynamically import canvas-confetti to avoid SSR issues
    import("canvas-confetti")
      .then((mod) => {
        const confetti = mod.default;
        const count = 200;
        const defaults = { origin: { y: 0.7 }, zIndex: 9999 };

        const fire = (particleRatio: number, opts: Record<string, unknown>) => {
          confetti({
            ...defaults,
            ...opts,
            particleCount: Math.floor(count * particleRatio),
          });
        };

        fire(0.25, { spread: 26, startVelocity: 55, colors: ["#6366f1", "#10b981", "#3b82f6"] });
        fire(0.2, { spread: 60, colors: ["#818cf8", "#34d399", "#60a5fa"] });
        fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8, colors: ["#a855f7", "#06b6d4", "#f43f5e"] });
        fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, colors: ["#ffffff", "#6366f1", "#10b981"] });
        fire(0.1, { spread: 120, startVelocity: 45, colors: ["#ec4899", "#8b5cf6"] });
      })
      .catch(() => {
        // silently ignore if confetti fails
      });
  }, []);

  return { fireConfetti };
}
