export interface PoseLandmark {
    x: number;
    y: number;
    z: number;
    visibility?: number;
  }
  
  export interface PostureGateStatus {
    isReady: boolean;
    yawDeg: number;
    leanDeg: number;
    minVisibility: number;
    guidanceMessage: string;
  }
  
  export const EASE_RATIOS: Record<"S" | "M" | "L" | "XL", number> = {
    S: 0.92,
    M: 1.0,
    L: 1.08,
    XL: 1.16,
  };
  
  /**
   * Module M2: Evaluates 3D (X, Y, Z) MediaPipe Pose landmarks at 30 FPS:
   * 1. Full-body visibility (shoulders, hips, knees > 0.70)
   * 2. Horizontal torso yaw < 15 deg (user facing straight toward camera)
   * 3. Z-axis forward/backward shoulder lean < 15 deg
   */
  export function evaluatePostureGate(landmarks: PoseLandmark[]): PostureGateStatus {
    if (!landmarks || landmarks.length < 27) {
      return {
        isReady: false,
        yawDeg: 0,
        leanDeg: 0,
        minVisibility: 0,
        guidanceMessage: "Step back so your full body (head to knees) is visible",
      };
    }
  
    // Key landmarks: 0=nose, 11=L_shoulder, 12=R_shoulder, 23=L_hip, 24=R_hip, 25=L_knee, 26=R_knee
    const requiredIndices = [0, 11, 12, 23, 24, 25, 26];
    let minVis = 1.0;
    for (const idx of requiredIndices) {
      const vis = landmarks[idx]?.visibility ?? 0;
      if (vis < minVis) minVis = vis;
    }
  
    if (minVis < 0.7) {
      return {
        isReady: false,
        yawDeg: 0,
        leanDeg: 0,
        minVisibility: Number(minVis.toFixed(2)),
        guidanceMessage: "Step back slightly — ensure shoulders, hips & knees are clearly in frame",
      };
    }
  
    const lSh = landmarks[11];
    const rSh = landmarks[12];
    const lHip = landmarks[23];
    const rHip = landmarks[24];
  
    // Horizontal shoulder span vs Z-depth difference -> Torso Yaw angle
    const dxShoulder = Math.max(Math.abs(lSh.x - rSh.x), 0.05);
    const dzShoulder = Math.abs(lSh.z - rSh.z);
    const yawRad = Math.atan2(dzShoulder * 0.55, dxShoulder);
    const yawDeg = Number(((yawRad * 180) / Math.PI).toFixed(1));
  
    // Shoulder midpoint vs Hip midpoint Z-depth -> Forward/Backward Lean angle
    const midShoulderY = (lSh.y + rSh.y) / 2;
    const midHipY = (lHip.y + rHip.y) / 2;
    const torsoHeight = Math.max(Math.abs(midHipY - midShoulderY), 0.1);
    const midShoulderZ = (lSh.z + rSh.z) / 2;
    const midHipZ = (lHip.z + rHip.z) / 2;
    const leanRad = Math.atan2(Math.abs(midShoulderZ - midHipZ) * 0.55, torsoHeight);
    const leanDeg = Number(((leanRad * 180) / Math.PI).toFixed(1));
  
    if (yawDeg >= 15) {
      return {
        isReady: false,
        yawDeg,
        leanDeg,
        minVisibility: Number(minVis.toFixed(2)),
        guidanceMessage: `Turn slightly to face the camera straight-on (Yaw: ${yawDeg}° / <15° required)`,
      };
    }
  
    if (leanDeg >= 15) {
      return {
        isReady: false,
        yawDeg,
        leanDeg,
        minVisibility: Number(minVis.toFixed(2)),
        guidanceMessage: `Stand upright without leaning forward/back (Lean: ${leanDeg}° / <15° required)`,
      };
    }
  
    return {
      isReady: true,
      yawDeg,
      leanDeg,
      minVisibility: Number(minVis.toFixed(2)),
      guidanceMessage: "Posture locked! Hold steady for 3-second auto-capture...",
    };
  }