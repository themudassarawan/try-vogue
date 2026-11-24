"use client";

import { GarmentItem, resolveStaticUrl } from "@/lib/api";
import { EASE_RATIOS, PoseLandmark } from "@/lib/poseMath";
import { useEffect, useRef } from "react";

interface Props {
  basePhotoUrl: string;
  landmarks: PoseLandmark[];
  garment: GarmentItem | null;
  accessory: GarmentItem | null;
  fitSize: "S" | "M" | "L" | "XL";
}

function loadCorsImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export default function LiveARCanvas({
  basePhotoUrl,
  landmarks,
  garment,
  accessory,
  fitSize,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderComposite() {
      const canvas = canvasRef.current;
      if (!canvas || !basePhotoUrl) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        const baseImg = await loadCorsImage(resolveStaticUrl(basePhotoUrl));
        if (cancelled) return;

        canvas.width = baseImg.naturalWidth || 720;
        canvas.height = baseImg.naturalHeight || 960;
        const W = canvas.width;
        const H = canvas.height;

        ctx.clearRect(0, 0, W, H);
        ctx.drawImage(baseImg, 0, 0, W, H);

        // Extract 33-point MediaPipe anchors or fallback to proportional torso box
        const hasPose = landmarks && landmarks.length >= 27;
        const lSh = hasPose ? landmarks[11] : { x: 0.62, y: 0.24, z: 0 };
        const rSh = hasPose ? landmarks[12] : { x: 0.38, y: 0.24, z: 0 };
        const lHip = hasPose ? landmarks[23] : { x: 0.59, y: 0.52, z: 0 };
        const rHip = hasPose ? landmarks[24] : { x: 0.41, y: 0.52, z: 0 };
        const lKnee = hasPose ? landmarks[25] : { x: 0.58, y: 0.76, z: 0 };
        const rKnee = hasPose ? landmarks[26] : { x: 0.42, y: 0.76, z: 0 };

        const shLeftX = Math.min(lSh.x, rSh.x) * W;
        const shRightX = Math.max(lSh.x, rSh.x) * W;
        const shCenterX = (shLeftX + shRightX) / 2;
        const shTopY = Math.min(lSh.y, rSh.y) * H;
        const shoulderSpan = Math.max(shRightX - shLeftX, W * 0.22);

        const hipBottomY = Math.max(lHip.y, rHip.y) * H;
        const kneeBottomY = Math.max(lKnee.y, rKnee.y) * H;
        const ease = EASE_RATIOS[fitSize] || 1.0;

        // Subtle 2.5D yaw compression & shadow from Z-axis depth difference
        const dz = (lSh.z ?? 0) - (rSh.z ?? 0);
        const yawScaleX = Math.max(0.86, 1 - Math.abs(dz) * 0.25);

        // 1. Render Primary Garment (Kurta 0.88H vs Western 0.60H + S-XL Ease Scaling)
        if (garment && garment.cutout_png_url) {
          try {
            const gImg = await loadCorsImage(resolveStaticUrl(garment.cutout_png_url));
            if (cancelled) return;

            const isKurta = garment.category === "kurta";
            const targetBottomY = isKurta
              ? kneeBottomY + H * 0.03
              : hipBottomY + H * 0.06;

            const drawWidth = shoulderSpan * 1.48 * ease * yawScaleX;
            const drawHeight = Math.max(targetBottomY - (shTopY - H * 0.04), H * 0.28);
            const drawX = shCenterX - drawWidth / 2;
            const drawY = shTopY - H * 0.045;

            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.35)";
            ctx.shadowBlur = 18;
            ctx.shadowOffsetY = 6;
            ctx.drawImage(gImg, drawX, drawY, drawWidth, drawHeight);
            ctx.restore();
          } catch {
            // Cutout image missing on disk; keep clean base image
          }
        }

        // 2. Add-On A4: Real-Time Necktie or Shawl/Dupatta Overlay
        if (accessory && accessory.cutout_png_url) {
          try {
            const accImg = await loadCorsImage(resolveStaticUrl(accessory.cutout_png_url));
            if (cancelled) return;

            ctx.save();
            ctx.shadowColor = "rgba(0, 0, 0, 0.30)";
            ctx.shadowBlur = 12;

            if (accessory.category === "accessory_tie") {
              const tieWidth = shoulderSpan * 0.24;
              const tieHeight = Math.max(hipBottomY - shTopY, H * 0.24) * 0.82;
              const tieX = shCenterX - tieWidth / 2;
              const tieY = shTopY + H * 0.01;
              ctx.drawImage(accImg, tieX, tieY, tieWidth, tieHeight);
            } else {
              // Shawl / Dupatta drape anchored over shoulder down to knee
              const shawlWidth = shoulderSpan * 0.85 * ease;
              const shawlHeight = Math.max(kneeBottomY - shTopY, H * 0.42);
              const shawlX = shLeftX - shoulderSpan * 0.12;
              const shawlY = shTopY - H * 0.03;
              ctx.drawImage(accImg, shawlX, shawlY, shawlWidth, shawlHeight);
            }
            ctx.restore();
          } catch {
            // Accessory cutout missing on disk
          }
        }
      } catch (err) {
        console.error("LiveARCanvas render error:", err);
      }
    }

    renderComposite();
    return () => {
      cancelled = true;
    };
  }, [basePhotoUrl, landmarks, garment, accessory, fitSize]);

  return (
    <div className="relative mx-auto aspect-[3/4] max-h-[540px] w-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-xl">
      <canvas ref={canvasRef} className="h-full w-full object-contain" />
      <div className="absolute bottom-3 left-3 rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-amber-300 backdrop-blur">
        Mode A: 0 ms Live 2.5D AR • Size {fitSize} ({EASE_RATIOS[fitSize]}x ease)
      </div>
    </div>
  );
}