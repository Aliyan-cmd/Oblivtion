"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { Sparkles, Layers, Cpu } from "lucide-react";

interface SplineVisualProps {
  sceneUrl?: string;
  className?: string;
}

export const SplineVisual: React.FC<SplineVisualProps> = ({
  sceneUrl = "https://prod.spline.design/6Wnt1BdUMxsQZo9f/scene.splinecode",
  className = "",
}) => {
  const [splineLoaded, setSplineLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fallbackRef = useRef<HTMLDivElement>(null);

  // Dynamic import of @splinetool/runtime inside useEffect to prevent SSR crashes
  useEffect(() => {
    if (typeof window === "undefined") return;
    const canvas = canvasRef.current;
    if (!canvas || !sceneUrl) return;

    let isMounted = true;
    let appInstance: { dispose: () => void } | null = null;

    import("@splinetool/runtime")
      .then(({ Application }) => {
        if (!isMounted || !canvasRef.current) return;
        const app = new Application(canvasRef.current);
        appInstance = app;
        return app.load(sceneUrl);
      })
      .then(() => {
        if (isMounted) setSplineLoaded(true);
      })
      .catch((err) => {
        console.warn("Spline scene loading fallback to Three.js:", err);
        if (isMounted) setHasError(true);
      });

    return () => {
      isMounted = false;
      if (appInstance) {
        try {
          appInstance.dispose();
        } catch {
          // ignore cleanup
        }
      }
    };
  }, [sceneUrl]);

  // Fallback 3D Canvas rendering with Three.js
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (splineLoaded && !hasError) return;
    const container = fallbackRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 14;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(280, 280);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // Glowing 3D Glass Octahedron Core
    const geometry = new THREE.OctahedronGeometry(3.5, 0);
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x6366f1,
      emissive: 0x4338ca,
      roughness: 0.1,
      metalness: 0.8,
      transmission: 0.6,
      thickness: 1.2,
      wireframe: true,
    });
    const coreMesh = new THREE.Mesh(geometry, material);
    scene.add(coreMesh);

    // Inner glowing sphere
    const innerGeo = new THREE.IcosahedronGeometry(2.2, 1);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      wireframe: true,
      transparent: true,
      opacity: 0.6,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    scene.add(innerMesh);

    // Orbital Ring
    const ringGeo = new THREE.TorusGeometry(5.5, 0.08, 16, 100);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x818cf8,
      transparent: true,
      opacity: 0.8,
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3;
    scene.add(ringMesh);

    // Lighting
    const pointLight = new THREE.PointLight(0x6366f1, 2, 50);
    pointLight.position.set(10, 10, 10);
    scene.add(pointLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    let frameId: number;
    const animate = () => {
      frameId = requestAnimationFrame(animate);
      coreMesh.rotation.x += 0.005;
      coreMesh.rotation.y += 0.008;
      innerMesh.rotation.y -= 0.01;
      ringMesh.rotation.z += 0.006;
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(frameId);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      geometry.dispose();
      material.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
    };
  }, [splineLoaded, hasError]);

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-950/40 via-zinc-950/20 to-neutral-900/30 p-4 backdrop-blur-xl ${className}`}>
      {/* Background Glow */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-neutral-800/20 to-neutral-900/20 opacity-70 blur-xl" />

      {/* Canvas for Spline 3D Scene */}
      {!hasError && (
        <div className={`relative h-72 w-full transition-opacity duration-700 ${splineLoaded ? "opacity-100" : "opacity-0 absolute inset-0 pointer-events-none"}`}>
          <canvas ref={canvasRef} className="h-full w-full" />
        </div>
      )}

      {/* Fallback Three.js Visualizer if Spline is loading or errors out */}
      {(!splineLoaded || hasError) && (
        <div className="relative flex flex-col items-center justify-center py-4 text-center">
          <div ref={fallbackRef} className="h-64 w-64 cursor-grab active:cursor-grabbing" />
          <div className="mt-2 flex items-center gap-2 rounded-full border border-neutral-500/30 bg-neutral-500/10 px-3 py-1 text-xs font-medium text-neutral-300">
            <Cpu className="h-3.5 w-3.5 animate-pulse text-neutral-300" />
            <span>Interactive 3D Engine</span>
            <span className="flex h-2 w-2 rounded-full bg-neutral-300 animate-ping" />
          </div>
        </div>
      )}

      {/* Floating Badges */}
      <div className="absolute left-4 top-4 flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-2.5 py-1 text-[11px] text-neutral-300 backdrop-blur-md">
        <Sparkles className="h-3.5 w-3.5 text-neutral-400" />
        <span>Spline &amp; Three.js 3D</span>
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-1.5 rounded-lg border border-neutral-200/30 bg-neutral-200/10 px-2.5 py-1 text-[11px] text-neutral-400 backdrop-blur-md">
        <Layers className="h-3.5 w-3.5" />
        <span>Hinglish Parser 3D</span>
      </div>
    </div>
  );
};
