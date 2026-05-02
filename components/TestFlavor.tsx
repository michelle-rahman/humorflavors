"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { HumorFlavor, Caption } from "@/lib/types";

interface Props {
  flavor: HumorFlavor;
  existingCaptions: Caption[];
}

export function TestFlavor({ flavor, existingCaptions }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [captions, setCaptions] = useState(existingCaptions);
  const [result, setResult] = useState<Caption[] | null>(null);
  const [error, setError] = useState("");
  const supabase = createClient();

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    setGenerating(true);
    setError("");
    setResult(null);

    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    if (!token) {
      setError("Not authenticated. Please sign in again.");
      setGenerating(false);
      return;
    }

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/caption-requests`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            humor_flavor_id: flavor.id,
            image_url: imageUrl.trim(),
          }),
        }
      );

      const json = await response.json();

      if (!response.ok) {
        setError(
          json?.message ||
            `API error ${response.status}: ${response.statusText}`
        );
      } else {
        const newCaptions = Array.isArray(json) ? json : json.captions ?? [json];
        setResult(newCaptions as Caption[]);
        setCaptions([...(newCaptions as Caption[]), ...captions]);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Request failed");
    }

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
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 leading-relaxed">
            {flavor.description}
          </p>
        )}
      </div>

      {/* Generate panel */}
      <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Generate captions
        </h2>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
              Image URL
            </label>
            <div className="flex gap-2">
              <input
                required
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://example.com/image.jpg"
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
              <button
                type="submit"
                disabled={generating}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.97] whitespace-nowrap"
              >
                {generating ? (
                  <><LoadingSpinner />Generating…</>
                ) : (
                  <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>Generate</>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
        </form>

        {/* Fresh results */}
        {result && result.length > 0 && (
          <div className="mt-5 space-y-2 animate-slide-down">
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">
              {result.length} new caption{result.length !== 1 ? "s" : ""} generated
            </p>
            {result.map((c, i) => (
              <div key={c.id ?? i} className="p-3.5 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/50 rounded-xl">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{c.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Caption history */}
      <div>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
          Caption history
        </h2>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
          {captions.length} caption{captions.length !== 1 ? "s" : ""} generated with this flavor
        </p>

        {captions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400">No captions yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-0.5">Generate your first caption above</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {captions.map((c, i) => (
              <div key={c.id ?? i} className="p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <p className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed">{c.content}</p>
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
                    <span className="text-xs bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/30">
                      Public
                    </span>
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

function LoadingSpinner() {
  return (
    <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
    </svg>
  );
}
