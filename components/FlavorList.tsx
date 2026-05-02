"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { HumorFlavor } from "@/lib/types";

interface Props {
  initialFlavors: HumorFlavor[];
}

export function FlavorList({ initialFlavors }: Props) {
  const [flavors, setFlavors] = useState(initialFlavors);
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [newSlug, setNewSlug] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const filtered = flavors.filter(
    (f) =>
      f.slug.toLowerCase().includes(search.toLowerCase()) ||
      f.description?.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const { data, error } = await supabase
      .from("humor_flavors")
      .insert({
        slug: newSlug.trim(),
        description: newDesc.trim(),
        is_pinned: false,
        created_by_user_id: userId,
        modified_by_user_id: userId,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
      setSaving(false);
    } else {
      setFlavors([data as HumorFlavor, ...flavors]);
      setNewSlug("");
      setNewDesc("");
      setShowForm(false);
      router.push(`/flavors/${data.id}`);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this humor flavor and all its steps?")) return;
    setDeletingId(id);

    await supabase.from("humor_flavor_steps").delete().eq("humor_flavor_id", id);
    const { error } = await supabase.from("humor_flavors").delete().eq("id", id);

    if (!error) setFlavors(flavors.filter((f) => f.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-7">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            Humor Flavors
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {flavors.length} flavor{flavors.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(""); }}
          className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-all duration-150 active:scale-[0.97] shadow-sm ${
            showForm
              ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200 dark:shadow-indigo-900/40"
          }`}
        >
          {showForm ? (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
              Cancel
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>
              New flavor
            </>
          )}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4 animate-slide-down"
        >
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            New Humor Flavor
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Name (slug)
              </label>
              <input
                required
                value={newSlug}
                onChange={(e) => setNewSlug(e.target.value)}
                placeholder="my-flavor-name"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Description
              </label>
              <input
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="What does this flavor do?"
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
          </div>
          {error && (
            <p className="text-xs text-red-500 dark:text-red-400">{error}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.97]"
            >
              {saving ? (
                <><LoadingSpinner /> Creating…</>
              ) : (
                "Create & edit steps"
              )}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search */}
      <div className="relative mb-5">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flavors…"
          className="w-full max-w-sm pl-9 pr-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow placeholder-zinc-400"
        />
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-zinc-400 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2a7 7 0 0 1 7 7c0 5-7 13-7 13S5 14 5 9a7 7 0 0 1 7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          </div>
          <p className="font-medium text-zinc-700 dark:text-zinc-300">
            {search ? "No flavors match your search" : "No flavors yet"}
          </p>
          <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-1">
            {search ? "Try a different search term" : "Create your first humor flavor to get started"}
          </p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {filtered.map((flavor) => (
            <div
              key={flavor.id}
              className="group relative flex items-center gap-4 p-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm transition-all duration-150"
            >
              {/* Pin indicator */}
              {flavor.is_pinned && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-amber-400 rounded-r-full" />
              )}

              <div className="flex-1 min-w-0 pl-1">
                <div className="flex items-center gap-2">
                  {flavor.is_pinned && (
                    <span className="text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-md font-medium border border-amber-200 dark:border-amber-800/50">
                      Pinned
                    </span>
                  )}
                  <Link
                    href={`/flavors/${flavor.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors truncate"
                  >
                    {flavor.slug}
                  </Link>
                </div>
                {flavor.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-1">
                    {flavor.description}
                  </p>
                )}
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                  Modified {new Date(flavor.modified_datetime_utc).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>

              {/* Action buttons — always visible on mobile, hover on desktop */}
              <div className="flex items-center gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150">
                <Link
                  href={`/flavors/${flavor.id}/test`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors border border-emerald-200/50 dark:border-emerald-800/30"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                  Test
                </Link>
                <Link
                  href={`/flavors/${flavor.id}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors border border-indigo-200/50 dark:border-indigo-800/30"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(flavor.id)}
                  disabled={deletingId === flavor.id}
                  className="flex items-center justify-center w-7 h-7 text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
                  title="Delete"
                >
                  {deletingId === flavor.id ? (
                    <LoadingSpinner />
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
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
