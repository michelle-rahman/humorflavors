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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400 mb-1">
            <Link href="/dashboard" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Dashboard
            </Link>
            <span>/</span>
            <span className="text-zinc-900 dark:text-zinc-100 font-medium truncate max-w-xs">
              {flavorData.slug}
            </span>
          </div>
          {flavorData.is_pinned && (
            <span className="text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded font-medium">
              Pinned
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Link
            href={`/flavors/${flavorData.id}/test`}
            className="px-3 py-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 rounded-lg transition-colors"
          >
            Test flavor
          </Link>
          <button
            onClick={() => setEditingFlavor(!editingFlavor)}
            className="px-3 py-1.5 text-sm font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
          >
            {editingFlavor ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={handleDeleteFlavor}
            className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Flavor Details */}
      {editingFlavor ? (
        <form
          onSubmit={handleSaveFlavor}
          className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-4"
        >
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Edit Flavor
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                Name (slug)
              </label>
              <input
                name="slug"
                required
                defaultValue={flavorData.slug}
                className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  name="is_pinned"
                  defaultChecked={flavorData.is_pinned}
                  className="rounded border-zinc-300 dark:border-zinc-700 text-indigo-600 focus:ring-indigo-500"
                />
                Pinned
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
              Description
            </label>
            <textarea
              name="description"
              defaultValue={flavorData.description}
              rows={3}
              className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {flavorError && (
            <p className="text-xs text-red-500">{flavorError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={savingFlavor}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {savingFlavor ? "Saving…" : "Save changes"}
            </button>
            <button
              type="button"
              onClick={() => setEditingFlavor(false)}
              className="px-4 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <div className="p-5 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
          <h1 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            {flavorData.slug}
          </h1>
          {flavorData.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {flavorData.description}
            </p>
          )}
          <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-600">
            ID: {flavorData.id} · Modified{" "}
            {new Date(flavorData.modified_datetime_utc).toLocaleString()}
          </p>
        </div>
      )}

      {/* Steps */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-zinc-900 dark:text-zinc-100">
            Steps{" "}
            <span className="text-sm font-normal text-zinc-500 dark:text-zinc-400">
              ({steps.length})
            </span>
          </h2>
          <button
            onClick={() => setShowAddStep(!showAddStep)}
            className="px-3 py-1.5 text-sm font-medium bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            + Add step
          </button>
        </div>

        {showAddStep && (
          <div className="mb-4 p-4 bg-zinc-50 dark:bg-zinc-900 border border-dashed border-indigo-300 dark:border-indigo-700 rounded-xl">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 mb-3">
              New Step
            </h3>
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
          <div className="text-center py-10 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-400 dark:text-zinc-600">
            <p>No steps yet. Add one to define the prompt chain.</p>
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
              <div className="space-y-3">
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
