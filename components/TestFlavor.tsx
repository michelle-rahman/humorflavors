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
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
          <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
            Dashboard
          </Link>
          <span>/</span>
          <Link
            href={`/flavors/${flavor.id}`}
            className="hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            {flavor.slug}
          </Link>
          <span>/</span>
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">Test</span>
        </div>
        <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
          Test: {flavor.slug}
        </h1>
        {flavor.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {flavor.description}
          </p>
        )}
      </div>

      {/* Generate form */}
      <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Generate captions
        </h2>
        <form onSubmit={handleGenerate} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Image URL
            </label>
            <input
              required
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://example.com/image.jpg"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={generating}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
          >
            {generating ? "Generating…" : "Generate captions"}
          </button>
        </form>

        {/* New results */}
        {result && result.length > 0 && (
          <div className="mt-5 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              New captions ({result.length})
            </h3>
            {result.map((c, i) => (
              <div
                key={c.id ?? i}
                className="p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg"
              >
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  {c.content}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Existing captions */}
      <div>
        <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
          Previous captions{" "}
          <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
            ({captions.length})
          </span>
        </h2>

        {captions.length === 0 ? (
          <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 dark:text-zinc-600">
            <p>No captions generated yet for this flavor.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {captions.map((c, i) => (
              <div
                key={c.id ?? i}
                className="p-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg"
              >
                <p className="text-sm text-zinc-800 dark:text-zinc-200">
                  {c.content}
                </p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-zinc-400 dark:text-zinc-600">
                    {new Date(c.created_datetime_utc).toLocaleString()}
                  </span>
                  {c.like_count > 0 && (
                    <span className="text-xs text-zinc-400 dark:text-zinc-600">
                      ♥ {c.like_count}
                    </span>
                  )}
                  {c.is_public && (
                    <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded">
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
