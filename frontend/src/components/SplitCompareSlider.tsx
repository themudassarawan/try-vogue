"use client";

import { GarmentItem, resolveStaticUrl, saveFavorite } from "@/lib/api";
import { Check, Download, Heart, MoveHorizontal, Sparkles } from "lucide-react";
import { useState } from "react";

interface Props {
  userId: string;
  beforeUrl: string;
  afterUrl: string;
  garment: GarmentItem;
  fitSize: "S" | "M" | "L" | "XL";
  maskType: string;
  latencyMs: number;
}

export default function SplitCompareSlider({
  userId,
  beforeUrl,
  afterUrl,
  garment,
  fitSize,
  maskType,
  latencyMs,
}: Props) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const resolvedBefore = resolveStaticUrl(beforeUrl);
  const resolvedAfter = resolveStaticUrl(afterUrl);

  const handleSaveFavorite = async () => {
    if (saved || saving) return;
    setSaving(true);
    try {
      await saveFavorite({
        user_id: userId,
        garment_id: garment.garment_id,
        selected_size: fitSize,
        share_card_url: afterUrl,
      });
      setSaved(true);
    } catch (err) {
      console.error("Failed to save favorite:", err);
    } finally {
      setSaving(false);
    }
  };

  // Add-On A3: Generates a branded TryVogue comparison PNG on client canvas and downloads it
  const handleDownloadShareCard = async () => {
    const loadImg = (url: string) =>
      new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
      });

    try {
      const [imgBefore, imgAfter] = await Promise.all([
        loadImg(resolvedBefore),
        loadImg(resolvedAfter),
      ]);

      const cardW = 1080;
      const cardH = 820;
      const canvas = document.createElement("canvas");
      canvas.width = cardW;
      canvas.height = cardH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Dark luxury background
      ctx.fillStyle = "#090d16";
      ctx.fillRect(0, 0, cardW, cardH);

      // Draw Before & After portraits side-by-side
      ctx.drawImage(imgBefore, 36, 95, 490, 620);
      ctx.drawImage(imgAfter, 554, 95, 490, 620);

      // Header branding
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 28px sans-serif";
      ctx.fillText("TryVogue • AI Virtual Try-On", 36, 56);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = "20px sans-serif";
      ctx.fillText("Original", 48, 130);
      ctx.fillStyle = "#10b981";
      ctx.fillText("HD Try-On", 568, 130);

      // Footer metadata bar
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText(
        `${garment.name}  •  Size ${fitSize}  •  Color Harmony: ${
          garment.color_match_percent ?? 92
        }%`,
        36,
        768
      );

      const link = document.createElement("a");
      link.download = `TryVogue_${garment.garment_id}_${fitSize}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      console.error("Share card generation error:", err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Add-On A2: Interactive Split-Screen Slider */}
      <div className="relative mx-auto aspect-[3/4] max-h-[540px] w-full select-none overflow-hidden rounded-2xl border border-slate-800 bg-slate-950 shadow-2xl">
        {/* After Image (Full Background) */}
        <img
          src={resolvedAfter}
          alt="Cloud HD Try-On Result"
          className="h-full w-full object-contain"
        />

        {/* Before Image (Clipped to Slider Percentage) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img
            src={resolvedBefore}
            alt="Original User Photo"
            className="h-full w-full object-contain"
          />
        </div>

        {/* Vertical Divider Line & Handle */}
        <div
          className="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.9)]"
          style={{ left: `${sliderPos}%` }}
        >
          <div className="absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-amber-400 bg-slate-950 text-amber-400 shadow-lg">
            <MoveHorizontal className="h-5 w-5" />
          </div>
        </div>

        {/* Invisible Full-Area Range Scrubber */}
        <input
          type="range"
          min={0}
          max={100}
          value={sliderPos}
          onChange={(e) => setSliderPos(Number(e.target.value))}
          aria-label="Before and After Comparison Slider"
          className="absolute inset-0 z-10 h-full w-full cursor-ew-resize opacity-0"
        />

        {/* Top Labels */}
        <div className="pointer-events-none absolute left-3 top-3 rounded-lg bg-slate-950/80 px-2.5 py-1 text-xs font-semibold text-slate-200 backdrop-blur">
          Before
        </div>
        <div className="pointer-events-none absolute right-3 top-3 rounded-lg bg-emerald-950/85 px-2.5 py-1 text-xs font-semibold text-emerald-300 backdrop-blur">
          HD Result ({maskType})
        </div>

        {/* Bottom Telemetry Pill */}
        <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between rounded-lg bg-slate-950/80 px-3 py-1.5 text-xs text-slate-300 backdrop-blur">
          <span className="flex items-center gap-1 text-emerald-400">
            <Sparkles className="h-3.5 w-3.5" /> CIELAB Skin Lock Active
          </span>
          <span>Latency: {(latencyMs / 1000).toFixed(2)}s</span>
        </div>
      </div>

      {/* Add-On A3: Save Favorite & Download Share Card */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSaveFavorite}
          disabled={saved || saving}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
            saved
              ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
              : "border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
          }`}
        >
          {saved ? (
            <>
              <Check className="h-4 w-4" /> Saved to Favorites
            </>
          ) : (
            <>
              <Heart className="h-4 w-4 text-rose-400" /> Save Outfit
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadShareCard}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-amber-400"
        >
          <Download className="h-4 w-4" /> Share Card (PNG)
        </button>
      </div>
    </div>
  );
}