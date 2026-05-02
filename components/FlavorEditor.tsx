"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import type {
  HumorFlavor,
  HumorFlavorStep,
  LLMModel,
  LLMInputType,
  LLMOutputType,
  HumorFlavorStepType,
} from "@/lib/types";
import { SortableStep } from "./SortableStep";
import { StepForm } from "./StepForm";

interface Props {
  flavor: HumorFlavor;
  initialSteps: HumorFlavorStep[];
  models: LLMModel[];
  inputTypes: LLMInputType[];
  outputTypes: LLMOutputType[];
  stepTypes: HumorFlavorStepType[];
}

export function FlavorEditor({
  flavor,
  initialSteps,
  models,
  inputTypes,
  outputTypes,
  stepTypes,
}: Props) {
  const [flavorData, setFlavorData] = useState(flavor);
  const [steps, setSteps] = useState(initialSteps);
  const [editingFlavor, setEditingFlavor] = useState(false);
  const [savingFlavor, setSavingFlavor] = useState(false);
  const [showAddStep, setShowAddStep] = useState(false);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [flavorError, setFlavorError] = useState("");
  const router = useRouter();
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  async function handleSaveFlavor(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSavingFlavor(true);
    setFlavorError("");

    const form = e.currentTarget;
    const slug = (form.elements.namedItem("slug") as HTMLInputElement).value.trim();
    const description = (form.elements.namedItem("description") as HTMLTextAreaElement).value.trim();
    const is_pinned = (form.elements.namedItem("is_pinned") as HTMLInputElement).checked;

    const { data: userData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("humor_flavors")
      .update({
        slug,
        description,
        is_pinned,
        modified_by_user_id: userData.user?.id,
        modified_datetime_utc: new Date().toISOString(),
      })
      .eq("id", flavorData.id)
      .select()
      .single();

    if (error) {
      setFlavorError(error.message);
    } else {
      setFlavorData(data as HumorFlavor);
      setEditingFlavor(false);
    }
    setSavingFlavor(false);
  }

  async function handleDeleteFlavor() {
    if (!confirm("Delete this humor flavor and all its steps? This cannot be undone."))
      return;

    await supabase
      .from("humor_flavor_steps")
      .delete()
      .eq("humor_flavor_id", flavorData.id);
    await supabase.from("humor_flavors").delete().eq("id", flavorData.id);
    router.push("/dashboard");
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = steps.findIndex((s) => s.id === active.id);
    const newIndex = steps.findIndex((s) => s.id === over.id);
    const newSteps = arrayMove(steps, oldIndex, newIndex);

    const reordered = newSteps.map((step, i) => ({ ...step, order_by: i + 1 }));
    setSteps(reordered);

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    await Promise.all(
      reordered.map((step) =>
        supabase
          .from("humor_flavor_steps")
          .update({
            order_by: step.order_by,
            modified_by_user_id: userId,
            modified_datetime_utc: new Date().toISOString(),
          })
          .eq("id", step.id)
      )
    );
  }

  async function handleDeleteStep(stepId: number) {
    if (!confirm("Delete this step?")) return;

    const { error } = await supabase
      .from("humor_flavor_steps")
      .delete()
      .eq("id", stepId);

    if (!error) {
      const remaining = steps
        .filter((s) => s.id !== stepId)
        .map((s, i) => ({ ...s, order_by: i + 1 }));
      setSteps(remaining);

      const { data: userData } = await supabase.auth.getUser();
      await Promise.all(
        remaining.map((s) =>
          supabase
            .from("humor_flavor_steps")
            .update({ order_by: s.order_by, modified_by_user_id: userData.user?.id })
            .eq("id", s.id)
        )
      );
    }
  }

  function handleStepSaved(saved: HumorFlavorStep, isNew: boolean) {
    if (isNew) {
      setSteps([...steps, saved]);
      setShowAddStep(false);
    } else {
      setSteps(steps.map((s) => (s.id === saved.id ? saved : s)));
      setEditingStep(null);
    }
  }

  return (
    <div className="space-y-7 animate-fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <nav className="flex items-center gap-1.5 text-sm text-zinc-400 dark:text-zinc-600 mb-2">
            <Link href="/dashboard" className="hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors">
              Dashboard
            </Link>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
            <span className="text-zinc-700 dark:text-zinc-300 font-medium truncate max-w-xs">
              {flavorData.slug}
            </span>
          </nav>
          {flavorData.is_pinned && (
            <span className="inline-flex items-center gap-1 text-xs bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded-md font-medium border border-amber-200 dark:border-amber-800/50">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
              Pinned
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href={`/flavors/${flavorData.id}/test`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-xl transition-colors border border-emerald-200/50 dark:border-emerald-800/30"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
            Test
          </Link>
          <button
            onClick={() => setEditingFlavor(!editingFlavor)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-xl transition-colors border border-indigo-200/50 dark:border-indigo-800/30"
          >
            {editingFlavor ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>Cancel</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>Edit</>
            )}
          </button>
          <button
            onClick={handleDeleteFlavor}
            className="flex items-center justify-center w-8 h-8 text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors"
            title="Delete flavor"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>

      {/* Flavor info card */}
      {editingFlavor ? (
        <form
          onSubmit={handleSaveFlavor}
          className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl space-y-4 animate-slide-down"
        >
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">Edit Flavor</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
                Name (slug)
              </label>
              <input
                name="slug"
                required
                defaultValue={flavorData.slug}
                className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2.5 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  name="is_pinned"
                  defaultChecked={flavorData.is_pinned}
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-600 text-indigo-600 focus:ring-indigo-500"
                />
                Pin to top
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide">
              Description
            </label>
            <textarea
              name="description"
              defaultValue={flavorData.description}
              rows={3}
              className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition-shadow"
            />
          </div>
          {flavorError && (
            <p className="text-xs text-red-500 dark:text-red-400">{flavorError}</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={savingFlavor}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.97]"
            >
              {savingFlavor ? <><LoadingSpinner />Saving…</> : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditingFlavor(false)}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
            {flavorData.slug}
          </h1>
          {flavorData.description && (
            <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {flavorData.description}
            </p>
          )}
          <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-600">
            ID #{flavorData.id} · Last modified{" "}
            {new Date(flavorData.modified_datetime_utc).toLocaleString(undefined, {
              month: "short", day: "numeric", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
      )}

      {/* Steps section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
              Prompt Chain Steps
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              {steps.length === 0
                ? "No steps yet"
                : `${steps.length} step${steps.length !== 1 ? "s" : ""} · drag to reorder`}
            </p>
          </div>
          <button
            onClick={() => setShowAddStep(!showAddStep)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition-all active:scale-[0.97] ${
              showAddStep
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
                : "bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
            }`}
          >
            {showAddStep ? (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>Cancel</>
            ) : (
              <><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12h14"/></svg>Add step</>
            )}
          </button>
        </div>

        {showAddStep && (
          <div className="mb-4 p-5 bg-zinc-50 dark:bg-zinc-900 border-2 border-dashed border-indigo-300 dark:border-indigo-700/50 rounded-2xl animate-slide-down">
            <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mb-4">
              New Step #{steps.length + 1}
            </p>
            <StepForm
              humorFlavorId={flavorData.id}
              orderBy={steps.length + 1}
              models={models}
              inputTypes={inputTypes}
              outputTypes={outputTypes}
              stepTypes={stepTypes}
              onSaved={(s) => handleStepSaved(s, true)}
              onCancel={() => setShowAddStep(false)}
            />
          </div>
        )}

        {steps.length === 0 && !showAddStep ? (
          <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-center">
            <div className="w-12 h-12 rounded-xl bg-zinc-100 dark:bg-zinc-900 flex items-center justify-center mb-3">
              <svg className="w-6 h-6 text-zinc-400 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>
            </div>
            <p className="font-medium text-zinc-600 dark:text-zinc-400">No steps yet</p>
            <p className="text-sm text-zinc-400 dark:text-zinc-600 mt-0.5">Add a step to build your prompt chain</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={steps.map((s) => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-2.5">
                {steps.map((step) => (
                  <SortableStep
                    key={step.id}
                    step={step}
                    models={models}
                    inputTypes={inputTypes}
                    outputTypes={outputTypes}
                    stepTypes={stepTypes}
                    isEditing={editingStep === step.id}
                    onEdit={() =>
                      setEditingStep(editingStep === step.id ? null : step.id)
                    }
                    onDelete={() => handleDeleteStep(step.id)}
                    onSaved={(s) => handleStepSaved(s, false)}
                    onCancelEdit={() => setEditingStep(null)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
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
