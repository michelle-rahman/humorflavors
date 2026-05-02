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
    } else {
      setFlavors([data as HumorFlavor, ...flavors]);
      setNewSlug("");
      setNewDesc("");
      setShowForm(false);
      router.push(`/flavors/${data.id}`);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this humor flavor and all its steps?")) return;

    await supabase.from("humor_flavor_steps").delete().eq("humor_flavor_id", id);
    const { error } = await supabase
      .from("humor_flavors")
      .delete()
      .eq("id", id);

    if (!error) {
      setFlavors(flavors.filter((f) => f.id !== id));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
            Humor Flavors
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            {flavors.length} flavor{flavors.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New flavor
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-6 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3"
        >
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
            New Humor Flavor
          </h2>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Name (slug)
            </label>
            <input
              required
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="my-flavor-name"
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="Describe what this humor flavor does…"
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {error && (
            <p className="text-xs text-red-500">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? "Creating…" : "Create"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mb-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search flavors…"
          className="w-full max-w-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-zinc-400 dark:text-zinc-600">
          <p className="text-lg">No flavors found</p>
          <p className="text-sm mt-1">Create one to get started</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map((flavor) => (
            <div
              key={flavor.id}
              className="flex items-start justify-between p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {flavor.is_pinned && (
                    <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
                      Pinned
                    </span>
                  )}
                  <Link
                    href={`/flavors/${flavor.id}`}
                    className="font-medium text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 truncate"
                  >
                    {flavor.slug}
                  </Link>
                </div>
                {flavor.description && (
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
                    {flavor.description}
                  </p>
                )}
                <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-1">
                  Modified{" "}
                  {new Date(flavor.modified_datetime_utc).toLocaleDateString()}
                </p>
              </div>

              <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <Link
                  href={`/flavors/${flavor.id}/test`}
                  className="px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-md transition-colors"
                >
                  Test
                </Link>
                <Link
                  href={`/flavors/${flavor.id}`}
                  className="px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-md transition-colors"
                >
                  Edit
                </Link>
                <button
                  onClick={() => handleDelete(flavor.id)}
                  className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
