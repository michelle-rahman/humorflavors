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
  const [imageUrl, setImageUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewSrc, setPreviewSrc] = useState("");
  const [generating, setGenerating] = useState(false);
  const [stepLabel, setStepLabel] = useState("");
  const [captions, setCaptions] = useState(existingCaptions);
  const [result, setResult] = useState<Caption[] | null>(null);
  const [imageDescription, setImageDescription] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  function pickFile(f: File) {
    setFile(f);
    setPreviewSrc(URL.createObjectURL(f));
    setImageUrl("");
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

  function handleUrlChange(e: React.ChangeEvent<HTMLInputElement>) {
    setImageUrl(e.target.value);
    setFile(null);
    setPreviewSrc(e.target.value);
    setResult(null);
    setError("");
  }

  const canGenerate = !generating && (!!file || imageUrl.trim().length > 0);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!canGenerate) return;
    setGenerating(true);
    setError("");
    setResult(null);
    setImageDescription(null);

    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("No session — please sign out and sign in again.");
      setGenerating(false);
      return;
    }

    try {
      let imageId: string;

      if (file) {
        // ── File upload path ──────────────────────────────────────────────
        setStepLabel("Step 1/4 — Getting upload URL…");
        const presignRes = await fetch(`${API}/pipeline/generate-presigned-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ contentType: file.type || "image/jpeg" }),
        });
        const presignJson = await presignRes.json().catch(() => ({})) as Record<string, string>;
        if (!presignRes.ok) throw new Error(`Step 1 failed (${presignRes.status}): ${presignJson.message ?? presignRes.statusText}`);
        const { presignedUrl, cdnUrl } = presignJson;
        if (!presignedUrl || !cdnUrl) throw new Error("Step 1: API did not return presignedUrl/cdnUrl");

        setStepLabel("Step 2/4 — Uploading image…");
        const uploadRes = await fetch(presignedUrl, {
          method: "PUT",
          headers: { "Content-Type": file.type || "image/jpeg" },
          body: file,
        });
        if (!uploadRes.ok) {
          const body = await uploadRes.text().catch(() => "");
          throw new Error(`Step 2 (S3 upload) failed (${uploadRes.status}): ${body.slice(0, 200)}`);
        }

        setStepLabel("Step 3/4 — Registering image…");
        const regRes = await fetch(`${API}/pipeline/upload-image-from-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageUrl: cdnUrl, isCommonUse: false }),
        });
        const regJson = await regRes.json().catch(() => ({})) as Record<string, string>;
        if (!regRes.ok) throw new Error(`Step 3 failed (${regRes.status}): ${regJson.message ?? regRes.statusText}`);
        imageId = regJson.imageId;
        if (!imageId) throw new Error("Step 3: API did not return imageId");

      } else {
        // ── URL path: register directly (skips presign + S3 upload) ──────
        setStepLabel("Step 1/2 — Registering image URL…");
        const regRes = await fetch(`${API}/pipeline/upload-image-from-url`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ imageUrl: imageUrl.trim(), isCommonUse: false }),
        });
        const regJson = await regRes.json().catch(() => ({})) as Record<string, string>;
        if (!regRes.ok) throw new Error(`Register failed (${regRes.status}): ${regJson.message ?? regRes.statusText}`);
        imageId = regJson.imageId;
        if (!imageId) throw new Error("Register: API did not return imageId");
        setStepLabel("Step 2/2 — Generating captions…");
      }

      // ── Generate captions ─────────────────────────────────────────────
      if (!file) { /* label already set */ } else setStepLabel("Step 4/4 — Generating captions…");
      const captionRes = await fetch(`${API}/pipeline/generate-captions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ imageId, humorFlavorId: flavor.id }),
      });

      if (!captionRes.ok) {
        const errText = await captionRes.text().catch(() => captionRes.statusText);
        throw new Error(`Caption generation failed (${captionRes.status}): ${errText.slice(0, 300)}`);
      }

      const rawText = await captionRes.text();
      let newCaptions: Caption[];
      try {
        const parsed = JSON.parse(rawText);
        newCaptions = Array.isArray(parsed)
          ? parsed
          : (parsed as { captions?: Caption[] }).captions ?? [parsed as Caption];
      } catch {
        newCaptions = [{
          id: crypto.randomUUID(),
          content: rawText,
          humor_flavor_id: flavor.id,
          image_id: null as unknown as string,
          caption_request_id: null as unknown as number,
          is_public: false,
          profile_id: "",
          like_count: 0,
          created_datetime_utc: new Date().toISOString(),
          modified_datetime_utc: new Date().toISOString(),
        }];
      }
      setResult(newCaptions);
      setCaptions([...newCaptions, ...captions]);

      // Fetch the image description the pipeline stored on the image record
      const { data: imgRecord } = await supabase
        .from("images")
        .select("image_description")
        .eq("id", imageId)
        .single();
      if (imgRecord?.image_description) setImageDescription(imgRecord.image_description);

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

          {/* URL input */}
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
              Image URL
            </label>
            <input
              type="url"
              value={imageUrl}
              onChange={handleUrlChange}
              placeholder="https://example.com/image.jpg"
              disabled={!!file}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
            <span className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">or upload a file</span>
            <div className="flex-1 h-px bg-zinc-200 dark:bg-zinc-700" />
          </div>

          {/* File drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => !imageUrl && inputRef.current?.click()}
            className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed transition-colors min-h-[130px] ${
              imageUrl
                ? "opacity-40 cursor-not-allowed border-zinc-200 dark:border-zinc-700"
                : dragging
                ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 cursor-copy"
                : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-zinc-800 cursor-pointer"
            }`}
          >
            {previewSrc && file ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={previewSrc} alt="Preview" className="max-h-56 w-full object-contain rounded-xl p-1" />
            ) : (
              <>
                <svg className="w-7 h-7 text-zinc-400 dark:text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                </svg>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">
                  {file ? file.name : "Drop an image or click to browse"}
                </p>
                {!file && <p className="text-xs text-zinc-400 dark:text-zinc-500">JPEG · PNG · WebP · GIF · HEIC</p>}
              </>
            )}

            {generating && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900/50 backdrop-blur-sm rounded-xl">
                <LoadingSpinner large />
                <span className="text-xs font-medium text-white">{stepLabel}</span>
              </div>
            )}

            <input ref={inputRef} type="file" accept={ACCEPTED} className="hidden" onChange={handleFileInput} />
          </div>

          {/* Clear file */}
          {file && (
            <button
              type="button"
              onClick={() => { setFile(null); setPreviewSrc(""); if (inputRef.current) inputRef.current.value = ""; }}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              ✕ Remove file
            </button>
          )}

          {error && (
            <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={!canGenerate}
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
          <div className="space-y-3 animate-slide-down">
            {/* Image description from intermediate step */}
            {imageDescription && (
              <div className="p-3.5 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl">
                <p className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide mb-1.5">
                  Image description
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">{imageDescription}</p>
              </div>
            )}

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
            <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-0.5">Paste a URL or upload an image above</p>
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
