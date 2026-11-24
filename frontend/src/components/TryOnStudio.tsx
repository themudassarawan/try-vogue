"use client";

import {
    BiometricProfileResponse,
    GarmentItem,
    TryOnResponse,
    clearUserSession,
    fetchCatalog,
    generateHdTryOn,
    resolveStaticUrl,
} from "@/lib/api";
import {
    CheckCircle2,
    Layers,
    Palette,
    RefreshCw,
    Search,
    Shirt,
    Sparkles,
    Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import LiveARCanvas from "./LiveARCanvas";
import { CaptureSessionData } from "./SmartCameraCapture";
import SplitCompareSlider from "./SplitCompareSlider";

interface Props {
  profile: BiometricProfileResponse;
  session: CaptureSessionData;
  onSessionCleared: () => void;
}

export default function TryOnStudio({ profile, session, onSessionCleared }: Props) {
  const [garments, setGarments] = useState<GarmentItem[]>([]);
  const [selectedGarment, setSelectedGarment] = useState<GarmentItem | null>(null);
  const [selectedAccessory, setSelectedAccessory] = useState<GarmentItem | null>(null);
  const [fitSize, setFitSize] = useState<"S" | "M" | "L" | "XL">(profile.recommended_size);

  // Filters (Module M4)
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Mode A (0 ms Live AR) vs Mode B (Cloud HD Try-On)
  const [viewMode, setViewMode] = useState<"ar" | "hd">("ar");
  const [hdLoading, setHdLoading] = useState(false);
  const [hdResult, setHdResult] = useState<TryOnResponse | null>(null);
  const [hdError, setHdError] = useState<string | null>(null);

  // Load personalized catalog sorted by CIELAB Color-Harmony %
  useEffect(() => {
    let active = true;
    async function loadItems() {
      try {
        const res = await fetchCatalog({
          userId: profile.user_id,
          q: searchQuery || undefined,
        });
        if (!active) return;
        setGarments(res.items);

        // Auto-select top wearable outfit on initial load
        if (!selectedGarment && res.items.length > 0) {
          const firstWearable =
            res.items.find((i) => !i.category.startsWith("accessory_")) || res.items[0];
          setSelectedGarment(firstWearable);
        }
      } catch (err) {
        console.error("Catalog load error:", err);
      }
    }
    loadItems();
    return () => {
      active = false;
    };
  }, [profile.user_id, searchQuery]);

  // Trigger Mode B Cloud HD Try-On (or retrieve <0.1s pre-fetched cache)
  const handleRunHdTryOn = async (targetGarment?: GarmentItem, targetSize?: "S" | "M" | "L" | "XL") => {
    const item = targetGarment || selectedGarment;
    const size = targetSize || fitSize;
    if (!item) return;

    setViewMode("hd");
    setHdLoading(true);
    setHdError(null);

    try {
      const res = await generateHdTryOn({
        user_id: profile.user_id,
        photo_id: session.photo_id,
        garment_id: item.garment_id,
        fit_size: size,
      });
      setHdResult(res);
    } catch (err: unknown) {
      setHdError(err instanceof Error ? err.message : "Cloud HD Try-On failed");
    } finally {
      setHdLoading(false);
    }
  };

  const handleSelectItem = (item: GarmentItem) => {
    if (item.category.startsWith("accessory_")) {
      // Toggle Add-On A4 Necktie / Shawl overlay on Mode A AR canvas
      setSelectedAccessory((prev) => (prev?.garment_id === item.garment_id ? null : item));
      setViewMode("ar");
      return;
    }

    setSelectedGarment(item);
    if (viewMode === "hd") {
      handleRunHdTryOn(item, fitSize);
    }
  };

  const handleSizeChange = (newSize: "S" | "M" | "L" | "XL") => {
    setFitSize(newSize);
    if (viewMode === "hd" && selectedGarment) {
      handleRunHdTryOn(selectedGarment, newSize);
    }
  };

  // Add-On A1: 1-Click Privacy Purge
  const handleClearMyPhoto = async () => {
    try {
      await clearUserSession(profile.user_id, session.photo_id);
    } catch {
      // Ignore if already expired
    }
    onSessionCleared();
  };

  const filteredItems = garments.filter((item) => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "accessories") return item.category.startsWith("accessory_");
    return item.category === categoryFilter;
  });

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Top Telemetry & Privacy Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/90 px-5 py-4">
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-3 py-1.5 font-semibold text-amber-300">
            <Shirt className="h-4 w-4" /> Recommended Size: {profile.recommended_size} (
            {profile.confidence}%)
          </span>
          <span className="flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 font-semibold text-emerald-300">
            <Palette className="h-4 w-4" /> Skin Undertone: {session.undertone} (Warmth:{" "}
            {session.warmth_index})
          </span>
        </div>

        <button
          type="button"
          onClick={handleClearMyPhoto}
          className="flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-2 text-xs font-bold text-rose-300 transition hover:bg-rose-500/20"
        >
          <Trash2 className="h-4 w-4" /> Clear My Photo (Add-On A1)
        </button>
      </div>

      {/* Main Split Workspace: Left Viewport (M5/M6/A2) | Right Catalog (M3/M4) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: Virtual Try-On Stage */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:col-span-5">
          {/* Dual-Mode Switcher */}
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-950 p-1.5">
            <button
              type="button"
              onClick={() => setViewMode("ar")}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                viewMode === "ar"
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Layers className="h-4 w-4" /> Mode A: 0 ms Live AR
            </button>
            <button
              type="button"
              onClick={() => handleRunHdTryOn()}
              disabled={!selectedGarment || hdLoading}
              className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition ${
                viewMode === "hd"
                  ? "bg-emerald-500 text-slate-950"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Sparkles className="h-4 w-4" /> Mode B: Cloud HD Try-On
            </button>
          </div>

          {/* Interactive S / M / L / XL Fit Selector */}
          <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/70 px-4 py-2.5">
            <span className="text-xs font-semibold text-slate-400">Try Fit Size:</span>
            <div className="flex gap-1.5">
              {(["S", "M", "L", "XL"] as const).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => handleSizeChange(sz)}
                  className={`h-8 w-10 rounded-lg text-xs font-extrabold transition ${
                    fitSize === sz
                      ? "bg-amber-500 text-slate-950"
                      : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          {/* Viewport Stage */}
          {viewMode === "ar" ? (
            <LiveARCanvas
              basePhotoUrl={session.before_url}
              landmarks={session.landmarks}
              garment={selectedGarment}
              accessory={selectedAccessory}
              fitSize={fitSize}
            />
          ) : hdLoading ? (
            <div className="flex aspect-[3/4] max-h-[540px] flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center">
              <RefreshCw className="mb-3 h-10 w-10 animate-spin text-emerald-400" />
              <p className="text-base font-bold text-white">
                Synthesizing HD Drape & CIELAB Complexion Lock...
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Applying{" "}
                {selectedGarment?.category === "kurta"
                  ? "0.88H Knee-Length Kurta Mask"
                  : "0.60H Hip-Length Western Mask"}{" "}
                • Size {fitSize}
              </p>
            </div>
          ) : hdError ? (
            <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-300">
              {hdError}
            </div>
          ) : hdResult && selectedGarment ? (
            <SplitCompareSlider
              userId={profile.user_id}
              beforeUrl={hdResult.before_url}
              afterUrl={hdResult.result_image_url}
              garment={selectedGarment}
              fitSize={fitSize}
              maskType={hdResult.mask_type}
              latencyMs={hdResult.latency_ms}
            />
          ) : null}
        </div>

        {/* RIGHT COLUMN: Personalized Fashion Discovery Catalog (Module M3 & M4) */}
        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/90 p-5 lg:col-span-7">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">
                Color-Matched Wardrobe Catalog
              </h3>
              <p className="text-xs text-slate-400">
                Ranked by CIELAB ΔE*76 harmony for your{" "}
                <span className="font-semibold text-emerald-400">{session.undertone}</span>{" "}
                undertone
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search kurta, shirt, tie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Category Filter Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "All Styles" },
              { id: "kurta", label: "Pakistani Kurtas (0.88H)" },
              { id: "shirt", label: "Western Shirts (0.60H)" },
              { id: "jacket", label: "Jackets" },
              { id: "accessories", label: "Ties & Shawls (A4)" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setCategoryFilter(tab.id)}
                className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                  categoryFilter === tab.id
                    ? "bg-amber-500 text-slate-950"
                    : "bg-slate-950 text-slate-400 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Garment Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {filteredItems.map((item) => {
              const isSelected =
                selectedGarment?.garment_id === item.garment_id ||
                selectedAccessory?.garment_id === item.garment_id;
              const matchScore = item.color_match_percent ?? 90;

              return (
                <div
                  key={item.garment_id}
                  onClick={() => handleSelectItem(item)}
                  className={`group cursor-pointer rounded-2xl border p-3 transition ${
                    isSelected
                      ? "border-amber-500 bg-amber-500/10"
                      : "border-slate-800 bg-slate-950/70 hover:border-slate-700"
                  }`}
                >
                  <div className="relative mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-slate-900 p-2">
                    <img
                      src={resolveStaticUrl(item.image_url)}
                      alt={item.name}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src =
                          "https://placehold.co/300x300/1e293b/f59e0b?text=" +
                          encodeURIComponent(item.category.toUpperCase());
                      }}
                      className="h-full w-full object-contain transition group-hover:scale-105"
                    />
                    <span className="absolute right-2 top-2 rounded-full bg-emerald-950/90 px-2 py-0.5 text-[11px] font-bold text-emerald-300 backdrop-blur">
                      {matchScore}% Match
                    </span>
                    {isSelected && (
                      <CheckCircle2 className="absolute left-2 top-2 h-5 w-5 text-amber-400" />
                    )}
                  </div>

                  <p className="truncate text-sm font-bold text-white">{item.name}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-400">
                    <span className="capitalize">{item.category.replace("accessory_", "")}</span>
                    <span className="font-semibold text-amber-400">
                      PKR {item.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}