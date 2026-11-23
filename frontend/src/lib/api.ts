export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

export interface BiometricProfilePayload {
  height_cm: number;
  weight_kg: number;
  body_type: "slim" | "regular" | "athletic" | "heavy";
  fit_preference: "slim" | "regular" | "loose";
}

export interface BiometricProfileResponse {
  user_id: string;
  bmi: number;
  estimated_chest_cm: number;
  estimated_waist_cm: number;
  recommended_size: "S" | "M" | "L" | "XL";
  confidence: number;
  ease_ratio: number;
  all_ease_ratios: Record<string, number>;
}

export interface GarmentItem {
  garment_id: string;
  shop_id: string;
  name: string;
  category: "kurta" | "shirt" | "jacket" | "pants" | "accessory_tie" | "accessory_shawl";
  image_url: string;
  cutout_png_url: string;
  available_sizes: string[];
  dominant_colors: string[];
  price: number;
  color_match_percent?: number;
}

export interface TryOnResponse {
  cache_key: string;
  status: "ready" | "pending" | "fallback";
  mask_type: string;
  before_url: string;
  result_image_url: string;
  latency_ms: number;
}

export function resolveStaticUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function createBiometricProfile(
  payload: BiometricProfilePayload
): Promise<BiometricProfileResponse> {
  const res = await fetch(`${API_BASE}/api/biometrics/profile`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function uploadBasePhoto(
  userId: string,
  photoBlob: Blob,
  landmarks: Array<{ x: number; y: number; z: number; visibility?: number }>
) {
  const form = new FormData();
  form.append("user_id", userId);
  form.append("landmarks_json", JSON.stringify(landmarks));
  form.append("photo", photoBlob, "user_base.jpg");

  const res = await fetch(`${API_BASE}/api/biometrics/upload-photo`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchCatalog(params?: {
  category?: string;
  size?: string;
  q?: string;
  userId?: string;
}): Promise<{ count: number; items: GarmentItem[] }> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== "all") query.set("category", params.category);
  if (params?.size && params.size !== "ALL") query.set("size", params.size);
  if (params?.q) query.set("q", params.q);
  if (params?.userId) query.set("user_id", params.userId);

  const res = await fetch(`${API_BASE}/api/catalog?${query.toString()}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function triggerTop2Prefetch(
  userId: string,
  photoId: string,
  fitSize: "S" | "M" | "L" | "XL"
) {
  const query = new URLSearchParams({
    user_id: userId,
    photo_id: photoId,
    fit_size: fitSize,
  });
  const res = await fetch(`${API_BASE}/api/tryon/prefetch?${query.toString()}`, {
    method: "POST",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function generateHdTryOn(payload: {
  user_id: string;
  photo_id: string;
  garment_id: string;
  fit_size: "S" | "M" | "L" | "XL";
}): Promise<TryOnResponse> {
  const res = await fetch(`${API_BASE}/api/tryon/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function clearUserSession(userId: string, photoId: string) {
  const res = await fetch(`${API_BASE}/api/tryon/session/${userId}/${photoId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function saveFavorite(payload: {
  user_id: string;
  garment_id: string;
  selected_size: "S" | "M" | "L" | "XL";
  share_card_url?: string;
}) {
  const res = await fetch(`${API_BASE}/api/tryon/favorites`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}