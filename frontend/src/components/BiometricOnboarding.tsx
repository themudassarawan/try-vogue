"use client";

import React, { useState } from "react";
import { Ruler, Scale, Sparkles, ArrowRight, CheckCircle2 } from "lucide-react";
import {
  createBiometricProfile,
  BiometricProfileResponse,
} from "@/lib/api";

interface Props {
  onComplete: (profile: BiometricProfileResponse) => void;
}

export default function BiometricOnboarding({ onComplete }: Props) {
  const [heightCm, setHeightCm] = useState<number>(175);
  const [weightKg, setWeightKg] = useState<number>(72);
  const [bodyType, setBodyType] = useState<"slim" | "regular" | "athletic" | "heavy">("regular");
  const [fitPreference, setFitPreference] = useState<"slim" | "regular" | "loose">("regular");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<BiometricProfileResponse | null>(null);

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const profile = await createBiometricProfile({
        height_cm: heightCm,
        weight_kg: weightKg,
        body_type: bodyType,
        fit_preference: fitPreference,
      });
      setPreviewResult(profile);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to calculate biometric profile");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl backdrop-blur">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
          <Sparkles className="h-6 w-6" />
        </div>
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Step 1 of 3 • Module M1
          </span>
          <h2 className="text-xl font-bold text-white">
            Anthropometric Size & Ease-Allowance Profile
          </h2>
        </div>
      </div>

      <form onSubmit={handleCalculate} className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Ruler className="h-4 w-4 text-amber-400" /> Height (cm)
              </span>
              <span className="font-mono text-base font-bold text-white">{heightCm} cm</span>
            </label>
            <input
              type="range"
              min={140}
              max={210}
              value={heightCm}
              onChange={(e) => setHeightCm(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
            <label className="mb-2 flex items-center justify-between text-sm font-medium text-slate-300">
              <span className="flex items-center gap-1.5">
                <Scale className="h-4 w-4 text-amber-400" /> Weight (kg)
              </span>
              <span className="font-mono text-base font-bold text-white">{weightKg} kg</span>
            </label>
            <input
              type="range"
              min={40}
              max={150}
              value={weightKg}
              onChange={(e) => setWeightKg(Number(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">Body Build</label>
          <div className="grid grid-cols-4 gap-2">
            {(["slim", "regular", "athletic", "heavy"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setBodyType(type)}
                className={`rounded-xl border py-2.5 text-sm font-semibold capitalize transition ${
                  bodyType === type
                    ? "border-amber-500 bg-amber-500/20 text-amber-300"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-300">
            Preferred Drape & Fit
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["slim", "regular", "loose"] as const).map((fit) => (
              <button
                key={fit}
                type="button"
                onClick={() => setFitPreference(fit)}
                className={`rounded-xl border py-2.5 text-sm font-semibold capitalize transition ${
                  fitPreference === fit
                    ? "border-emerald-500 bg-emerald-500/20 text-emerald-300"
                    : "border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700"
                }`}
              >
                {fit} Fit
              </button>
            ))}
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {loading ? "Computing Biometrics..." : "Calculate Recommended Fit"}
        </button>
      </form>

      {previewResult && (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="text-sm font-semibold">Biometric Match Ready</span>
              </div>
              <p className="mt-1 text-2xl font-extrabold text-white">
                Recommended Size:{" "}
                <span className="text-amber-400">{previewResult.recommended_size}</span>{" "}
                <span className="text-sm font-normal text-slate-300">
                  ({previewResult.confidence}% confidence • {previewResult.ease_ratio}x ease)
                </span>
              </p>
              <p className="mt-1 text-xs text-slate-400">
                BMI: {previewResult.bmi} • Est. Chest: {previewResult.estimated_chest_cm} cm • Est.
                Waist: {previewResult.estimated_waist_cm} cm
              </p>
            </div>

            <button
              type="button"
              onClick={() => onComplete(previewResult)}
              className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 transition hover:bg-emerald-400"
            >
              Proceed to Smart Camera <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}