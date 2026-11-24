"use client";

import { API_BASE, GarmentItem } from "@/lib/api";
import { CheckCircle2, Sparkles, Store, Upload, X } from "lucide-react";
import React, { useState } from "react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onGarmentAdded?: (item: GarmentItem) => void;
}

export default function ShopAdminModal({ isOpen, onClose, onGarmentAdded }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState<
    "kurta" | "shirt" | "jacket" | "pants" | "accessory_tie" | "accessory_shawl"
  >("kurta");
  const [price, setPrice] = useState<number>(4500);
  const [sizes, setSizes] = useState<string[]>(["S", "M", "L", "XL"]);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdItem, setCreatedItem] = useState<GarmentItem | null>(null);

  if (!isOpen) return null;

  const toggleSize = (sz: string) => {
    setSizes((prev) =>
      prev.includes(sz) ? prev.filter((s) => s !== sz) : [...prev, sz]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !file) {
      setError("Please enter a garment name and select a PNG/JPG image.");
      return;
    }

    setSubmitting(true);
    setError(null);
    setCreatedItem(null);

    try {
      const form = new FormData();
      form.append("shop_id", "shop_lahore_flagship");
      form.append("name", name.trim());
      form.append("category", category);
      form.append("price", String(price));
      form.append("available_sizes", sizes.join(",") || "S,M,L,XL");
      form.append("image", file);

      const res = await fetch(`${API_BASE}/api/catalog/admin/garments`, {
        method: "POST",
        body: form,
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setCreatedItem(data.garment);
      setName("");
      setFile(null);
      if (onGarmentAdded && data.garment) {
        onGarmentAdded(data.garment);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to upload garment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Store className="h-5 w-5" />
          </div>
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              Module M7 • Boutique Portal
            </span>
            <h2 className="text-lg font-bold text-white">
              Add Garment & Auto-Extract K-Means Palette
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-300">
              Garment Title
            </label>
            <input
              type="text"
              placeholder="e.g., Emerald Embroidered Cotton Kurta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-amber-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Category & Mask Profile
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | "kurta"
                      | "shirt"
                      | "jacket"
                      | "pants"
                      | "accessory_tie"
                      | "accessory_shawl"
                  )
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              >
                <option value="kurta">Kurta (0.88H Knee Mask)</option>
                <option value="shirt">Western Shirt (0.60H Mask)</option>
                <option value="jacket">Jacket / Coat (0.60H Mask)</option>
                <option value="pants">Trousers / Shalwar</option>
                <option value="accessory_tie">Necktie (Add-On A4)</option>
                <option value="accessory_shawl">Shawl / Dupatta (Add-On A4)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-300">
                Price (PKR)
              </label>
              <input
                type="number"
                min={500}
                step={100}
                value={price}
                onChange={(e) => setPrice(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3.5 py-2.5 text-sm text-white focus:border-amber-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Available Sizes
            </label>
            <div className="flex gap-2">
              {["S", "M", "L", "XL"].map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => toggleSize(sz)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-bold transition ${
                    sizes.includes(sz)
                      ? "border-amber-500 bg-amber-500/20 text-amber-300"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  {sz}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-300">
              Garment Cutout Image (PNG recommended for 0 ms AR)
            </label>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-700 bg-slate-950/70 px-4 py-4 text-xs font-medium text-slate-300 hover:border-amber-500">
              <Upload className="h-4 w-4 text-amber-400" />
              <span>{file ? file.name : "Choose PNG / JPG / WEBP Garment Image"}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          {createdItem && (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-xs text-emerald-300">
              <div className="flex items-center gap-1.5 font-bold">
                <CheckCircle2 className="h-4 w-4" /> Added &quot;{createdItem.name}&quot; to Live Catalog!
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-slate-300">
                <Sparkles className="h-3.5 w-3.5 text-amber-400" /> K-Means Dominant Colors:
                {createdItem.dominant_colors?.map((hex) => (
                  <span
                    key={hex}
                    className="inline-flex items-center gap-1 rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[11px]"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full border border-white/30"
                      style={{ backgroundColor: hex }}
                    />
                    {hex}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-amber-500 py-3 text-sm font-bold text-slate-950 transition hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? "Extracting Colors & Uploading..." : "Publish Garment to Catalog"}
          </button>
        </form>
      </div>
    </div>
  );
}