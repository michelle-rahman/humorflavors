"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { HumorFlavor, Caption } from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_URL!;

const ACCEPTED = "image/jpeg,image/jpg,image/png,image/webp,image/gif,image/heic";

interface Props {
  flavor: HumorFlavor;
  existingCaptions: Caption[];
}

export function TestFlavor({ flavor, existingCaptions }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [captions, setCaptions] = useState(existingCaptions);
  const [result, setResult] = useState<Caption[] | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function pickFile(f: File) {
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setResult(null);
    setError("");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) pickFile(f);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) pickFile(f);
  }

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setGenerating(true);
    setError("");
    setResult(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("No session — please sign out and sign in again.");
      setGenerating(false);
      return;
    }

    try {
      // Step 1: Get presigned upload URL
      setStepLabel("Getting upload URL…");
      const presignRes = await fetch(`${API}/pipeline/generate-presigned-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presignRes.ok) {
        const j = await presignRes.json().catch(() => ({}));
        throw new Error(`Presign failed (${presignRes.status}): ${j.message ?? presignRes.statusText}`);
      }
      const { presignedUrl, cdnUrl } = await presignRes.json();

      // Step 2: Upload image bytes to S3
      setStepLabel("Uploading image…");
      const uploadRes = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed (${uploadRes.status})`);

      // Step 3: Register image URL with pipeline
      setStepLabel("Registering image…");
      const regRes = await fetch(`${API}/pipeline/upload-image-from-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
      });
      if (!regRes.ok) {
        const j = await regRes.json().catch(() => ({}));
        throw new Error(`Register failed (${regRes.status}): ${j.message ?? regRes.statusText}`);
      }
      const { imageId } = await regRes.json();

      // Step 4: Generate captions
      setStepLabel("Generating captions…");
      const captionRes = await fetch(`${API}/pipeline/generate-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageId, humorFlavorId: flavor.id }),
      });
      if (!captionRes.ok) {
        const j = await captionRes.json().catch(() => ({}));
        throw new Error(`Caption generation failed (${captionRes.status}): ${j.message ?? captionRes.statusText}`);
      }
      const data = await captionRes.json();
      const newCaptions: Caption[] = Array.isArray(data) ? data : data.captions ?? [data];
      setResult(newCaptions);
      setCaptions([...newCaptions, ...captions]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }

    setStepLabel("");
    setGenerating(false);
  }

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header */}
      <div>
        <nav className="flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-600 mb-2">
          <Link href="/dashboard" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">Dashboard</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          <Link href={`/flavors/${flavor.id}`} className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">{flavor.slug}</Link>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
          <span className="text-zinc-700 dark:text-zinc-300 font-medium">Test</span>
        </nav>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          Test: <span className="text-indigo-600 dark:text-indigo-400">{flavor.slug}</span>
        </h1>
        {flavor.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">{flavor.description}</p>
        )}
      </div>

      {/* Generate panel */}
      <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Generate captions</h2>

        <form onSubmit={handleGenerate} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed cursor-pointer transition-colors min-h-[140px] ${
              dragging
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20"
                : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-zinc-800"
            }`}
          >
            {previewUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewUrl} alt="Preview" className="max-h-64 w-full object-contain rounded-xl p-1" />
            ) : (
              <>
                <svg className="w-8 h-8 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Drop an image or click to browse</p>
                <p className="text-xs text-zinc-400 dark:text-zinc-500">JPEG, PNG, WebP, GIF, HEIC</p>
              </>
            )}

            {/* Loading overlay */}
            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/50 backdrop-blur-sm rounded-xl">
                <LoadingSpinner large />
                <span className="text-xs font-medium text-white">{stepLabel}</span>
              </div>
            )}

            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={generating || !file}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-xl transition-all active:scale-[0.97]"
          >
            {generating ? (
              <><LoadingSpinner />{stepLabel || "Working…"}</>
            ) : (
              <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>Generate captions</>
            )}
          </button>
        </form>

        {/* Fresh results */}
        {result && result.length > 0 && (
          <div className="space-y-2 animate-slide-down">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              {result.length} caption{result.length !== 1 ? "s" : ""} generated
            </p>
            {result.map((c, i) => (
              <div key={c.id ?? i} className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Caption history */}
      <div>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">Caption history</h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          {captions.length} caption{captions.length !== 1 ? "s" : ""} generated with this flavor
        </p>

        {captions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400">No captions yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-0.5">Upload an image above to generate captions</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {captions.map((c, i) => (
              <div key={c.id ?? i} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">{c.content}</p>
                <div className="flex items-center gap-3 mt-2.5">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">
                    {new Date(c.created_datetime_utc).toLocaleString(undefined, {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </span>
                  {c.like_count > 0 && (
                    <span className="flex items-center gap-1 text-xs text-rose-500 dark:text-rose-400">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
                      {c.like_count}
                    </span>
                  )}
                  {c.is_public && (
                    <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/30">Public</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner({ large }: { large?: boolean }) {
  return (
    <svg className={`animate-spin ${large ? "w-6 h-6" : "w-3.5 h-3.5"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"/>
    </svg>
  );
}
