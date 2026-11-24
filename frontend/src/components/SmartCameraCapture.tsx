"use client";

import { triggerTop2Prefetch, uploadBasePhoto } from "@/lib/api";
import { evaluatePostureGate, PoseLandmark, PostureGateStatus } from "@/lib/poseMath";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { Camera, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import Webcam from "react-webcam";

export interface CaptureSessionData {
  photo_id: string;
  before_url: string;
  undertone: "Warm" | "Cool" | "Neutral";
  lab_skin_tone: number[];
  warmth_index: number;
  landmarks: PoseLandmark[];
}

interface Props {
  userId: string;
  recommendedSize: "S" | "M" | "L" | "XL";
  onCaptured: (data: CaptureSessionData) => void;
}

export default function SmartCameraCapture({ userId, recommendedSize, onCaptured }: Props) {
  const webcamRef = useRef<Webcam>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafRef = useRef<number | null>(null);
  const latestLandmarksRef = useRef<PoseLandmark[]>([]);
  const steadyStartRef = useRef<number | null>(null);
  const capturingRef = useRef<boolean>(false);

  const [modelReady, setModelReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gateStatus, setGateStatus] = useState<PostureGateStatus>({
    isReady: false,
    yawDeg: 0,
    leanDeg: 0,
    minVisibility: 0,
    guidanceMessage: "Initializing 3D MediaPipe Pose engine...",
  });

  // Load MediaPipe Pose Landmarker WebAssembly
  useEffect(() => {
    let active = true;
    async function initPose() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          numPoses: 1,
        });
        if (active) {
          landmarkerRef.current = landmarker;
          setModelReady(true);
        }
      } catch (err) {
        console.error("MediaPipe init error:", err);
        if (active) {
          setError("Could not initialize webcam pose tracker. You can upload a photo below.");
        }
      }
    }
    initPose();
    return () => {
      active = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      landmarkerRef.current?.close();
    };
  }, []);

  const submitCapturedBlob = useCallback(
    async (blob: Blob, landmarks: PoseLandmark[]) => {
      if (capturingRef.current) return;
      capturingRef.current = true;
      setUploading(true);
      setError(null);

      try {
        const res = await uploadBasePhoto(userId, blob, landmarks);
        // Speculatively pre-fetch Top 2 Color-Harmony garments in background (Module M6)
        triggerTop2Prefetch(userId, res.photo_id, recommendedSize).catch(() => {});

        onCaptured({
          photo_id: res.photo_id,
          before_url: res.before_url,
          undertone: res.undertone,
          lab_skin_tone: res.lab_skin_tone,
          warmth_index: res.warmth_index,
          landmarks,
        });
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to upload photo");
        capturingRef.current = false;
        setUploading(false);
      }
    },
    [userId, recommendedSize, onCaptured]
  );

  const captureFromWebcam = useCallback(async () => {
    const screenshot = webcamRef.current?.getScreenshot();
    if (!screenshot) return;
    const response = await fetch(screenshot);
    const blob = await response.blob();
    await submitCapturedBlob(blob, latestLandmarksRef.current);
  }, [submitCapturedBlob]);

  // 30 FPS Posture Verification Loop
  useEffect(() => {
    if (!modelReady) return;

    const detectFrame = () => {
      const video = webcamRef.current?.video;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && video.readyState === 4 && !capturingRef.current) {
        const result = landmarker.detectForVideo(video, performance.now());
        const pose = (result.landmarks?.[0] || []) as PoseLandmark[];
        latestLandmarksRef.current = pose;

        const status = evaluatePostureGate(pose);
        setGateStatus(status);

        if (status.isReady) {
          if (!steadyStartRef.current) {
            steadyStartRef.current = performance.now();
          }
          const elapsedSec = (performance.now() - steadyStartRef.current) / 1000;
          const remaining = Math.max(0, Math.ceil(3 - elapsedSec));
          setCountdown(remaining);

          if (elapsedSec >= 3.0) {
            captureFromWebcam();
            return;
          }
        } else {
          steadyStartRef.current = null;
          setCountdown(null);
        }
      }
      rafRef.current = requestAnimationFrame(detectFrame);
    };

    rafRef.current = requestAnimationFrame(detectFrame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [modelReady, captureFromWebcam]);

  const handleManualFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await submitCapturedBlob(file, []);
  };

  return (
    <div className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/90 p-6 shadow-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
            Step 2 of 3 • Module M2 & M3
          </span>
          <h2 className="text-xl font-bold text-white">
            30 FPS 3D Posture-Guided Smart Camera
          </h2>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          <ShieldCheck className="h-4 w-4" /> Ephemeral Session (Add-On A1)
        </div>
      </div>

      {/* Live Webcam Frame with Dynamic Silhouette Guide */}
      <div className="relative mx-auto aspect-[3/4] max-h-[520px] overflow-hidden rounded-2xl border-2 border-slate-800 bg-black">
        <Webcam
          ref={webcamRef}
          audio={false}
          mirrored
          screenshotFormat="image/jpeg"
          screenshotQuality={0.92}
          videoConstraints={{ facingMode: "user", width: 720, height: 960 }}
          className="h-full w-full object-cover"
        />

        {/* Silhouette Alignment Guide Overlay */}
        <div
          className={`pointer-events-none absolute inset-6 rounded-3xl border-2 border-dashed transition-colors duration-300 ${
            gateStatus.isReady
              ? "border-emerald-400 bg-emerald-500/5 shadow-[0_0_35px_rgba(16,185,129,0.25)]"
              : "border-amber-400/70"
          }`}
        />

        {/* 3D Telemetry HUD Pill */}
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between rounded-xl bg-slate-950/80 px-4 py-2 text-xs backdrop-blur">
          <span className="text-slate-300">
            Yaw: <strong className="text-white">{gateStatus.yawDeg}°</strong> (&lt;15°) • Lean:{" "}
            <strong className="text-white">{gateStatus.leanDeg}°</strong> (&lt;15°)
          </span>
          <span
            className={`font-semibold ${
              gateStatus.isReady ? "text-emerald-400" : "text-amber-400"
            }`}
          >
            {gateStatus.isReady ? "LOCKED" : "ALIGNING"}
          </span>
        </div>

        {/* 3-Second Auto-Capture Countdown */}
        {countdown !== null && countdown > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-emerald-400 bg-slate-950/90 text-5xl font-black text-emerald-400">
              {countdown}
            </div>
          </div>
        )}

        {/* Bottom Guidance Banner */}
        <div className="absolute bottom-4 left-4 right-4 rounded-xl bg-slate-950/85 px-4 py-3 text-center text-sm font-medium text-white backdrop-blur">
          {uploading ? (
            <span className="flex items-center justify-center gap-2 text-amber-400">
              <RefreshCw className="h-4 w-4 animate-spin" /> Analyzing CIELAB Skin Undertone &
              Pre-Fetching Top Outfits...
            </span>
          ) : (
            gateStatus.guidanceMessage
          )}
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      {/* Manual Capture & Desktop Photo Upload Controls */}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={captureFromWebcam}
          disabled={uploading}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          <Camera className="h-4 w-4" /> Capture Now
        </button>

        <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
          <Upload className="h-4 w-4" /> Upload Full-Body Photo
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleManualFileUpload}
            className="hidden"
            disabled={uploading}
          />
        </label>
      </div>
    </div>
  );
}