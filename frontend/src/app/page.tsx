"use client";

import BiometricOnboarding from "@/components/BiometricOnboarding";
import ShopAdminModal from "@/components/ShopAdminModal";
import SmartCameraCapture, { CaptureSessionData } from "@/components/SmartCameraCapture";
import TryOnStudio from "@/components/TryOnStudio";
import { BiometricProfileResponse } from "@/lib/api";
import { RotateCcw, Sparkles, Store } from "lucide-react";
import { useState } from "react";

export default function TryVogueHomePage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [profile, setProfile] = useState<BiometricProfileResponse | null>(null);
  const [captureSession, setCaptureSession] = useState<CaptureSessionData | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [catalogRefreshKey, setCatalogRefreshKey] = useState(0);

  const handleProfileComplete = (newProfile: BiometricProfileResponse) => {
    setProfile(newProfile);
    setStep(2);
  };

  const handlePhotoCaptured = (sessionData: CaptureSessionData) => {
    setCaptureSession(sessionData);
    setStep(3);
  };

  const handleResetSession = () => {
    setCaptureSession(null);
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Top Luxury Navigation Bar */}
      <header className="sticky top-0 z-40 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 shadow-lg shadow-amber-500/20">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-white">
                Try<span className="text-amber-400">Vogue</span>
              </h1>
              <p className="text-[11px] text-slate-400">
                Hybrid 2.5D AR & Cloud Diffusion Virtual Try-On
              </p>
            </div>
          </div>

          {/* Step Indicator Pills */}
          <div className="hidden items-center gap-2 text-xs font-semibold md:flex">
            <span
              className={`rounded-full px-3 py-1 ${
                step === 1
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              1. Biometrics (M1)
            </span>
            <span className="text-slate-600">→</span>
            <span
              className={`rounded-full px-3 py-1 ${
                step === 2
                  ? "bg-amber-500 text-slate-950"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              2. 3D Smart Camera (M2/M3)
            </span>
            <span className="text-slate-600">→</span>
            <span
              className={`rounded-full px-3 py-1 ${
                step === 3
                  ? "bg-emerald-500 text-slate-950"
                  : "bg-slate-900 text-slate-400"
              }`}
            >
              3. Virtual Try-On Studio (M4–M6)
            </span>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2">
            {step > 1 && (
              <button
                type="button"
                onClick={() => {
                  setCaptureSession(null);
                  setProfile(null);
                  setStep(1);
                }}
                className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:bg-slate-800"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Start Over
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsAdminOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3.5 py-2 text-xs font-bold text-amber-300 transition hover:bg-amber-500/20"
            >
              <Store className="h-4 w-4" /> Shop Admin (M7)
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Stage */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {step === 1 && <BiometricOnboarding onComplete={handleProfileComplete} />}

        {step === 2 && profile && (
          <SmartCameraCapture
            userId={profile.user_id}
            recommendedSize={profile.recommended_size}
            onCaptured={handlePhotoCaptured}
          />
        )}

        {step === 3 && profile && captureSession && (
          <TryOnStudio
            key={catalogRefreshKey}
            profile={profile}
            session={captureSession}
            onSessionCleared={handleResetSession}
          />
        )}
      </main>

      {/* Module M7: Boutique Shop Admin Modal */}
      <ShopAdminModal
        isOpen={isAdminOpen}
        onClose={() => setIsAdminOpen(false)}
        onGarmentAdded={() => setCatalogRefreshKey((k) => k + 1)}
      />
    </div>
  );
}