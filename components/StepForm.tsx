"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type {
  HumorFlavorStep,
  LLMModel,
  LLMInputType,
  LLMOutputType,
  HumorFlavorStepType,
} from "@/lib/types";

interface Props {
  humorFlavorId: number;
  orderBy: number;
  existingStep?: HumorFlavorStep;
  models: LLMModel[];
  inputTypes: LLMInputType[];
  outputTypes: LLMOutputType[];
  stepTypes: HumorFlavorStepType[];
  onSaved: (step: HumorFlavorStep) => void;
  onCancel: () => void;
}

export function StepForm({
  humorFlavorId,
  orderBy,
  existingStep,
  models,
  inputTypes,
  outputTypes,
  stepTypes,
  onSaved,
  onCancel,
}: Props) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [selectedModelId, setSelectedModelId] = useState(
    existingStep?.llm_model_id ?? models[0]?.id ?? 1
  );
  const supabase = createClient();

  const selectedModel = models.find((m) => m.id === Number(selectedModelId));

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const form = e.currentTarget;
    const get = (name: string) =>
      (form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)?.value;

    const tempRaw = get("llm_temperature");
    const llm_temperature =
      selectedModel?.is_temperature_supported && tempRaw !== ""
        ? parseFloat(tempRaw)
        : null;

    const payload = {
      humor_flavor_id: humorFlavorId,
      order_by: existingStep?.order_by ?? orderBy,
      description: get("description") || null,
      llm_model_id: Number(get("llm_model_id")),
      llm_input_type_id: Number(get("llm_input_type_id")),
      llm_output_type_id: Number(get("llm_output_type_id")),
      humor_flavor_step_type_id: Number(get("humor_flavor_step_type_id")),
      llm_system_prompt: get("llm_system_prompt"),
      llm_user_prompt: get("llm_user_prompt"),
      llm_temperature,
    };

    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    let result;
    if (existingStep) {
      result = await supabase
        .from("humor_flavor_steps")
        .update({
          ...payload,
          modified_by_user_id: userId,
          modified_datetime_utc: new Date().toISOString(),
        })
        .eq("id", existingStep.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("humor_flavor_steps")
        .insert({ ...payload, created_by_user_id: userId, modified_by_user_id: userId })
        .select()
        .single();
    }

    if (result.error) {
      setError(result.error.message);
    } else {
      onSaved(result.data as HumorFlavorStep);
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Step type
          </label>
          <select
            name="humor_flavor_step_type_id"
            defaultValue={existingStep?.humor_flavor_step_type_id ?? stepTypes[0]?.id}
            className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {stepTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.slug} — {t.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Description (optional)
          </label>
          <input
            name="description"
            defaultValue={existingStep?.description ?? ""}
            placeholder="Brief step description"
            className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            LLM model
          </label>
          <select
            name="llm_model_id"
            value={selectedModelId}
            onChange={(e) => setSelectedModelId(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {models.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Temperature{" "}
            {!selectedModel?.is_temperature_supported && (
              <span className="text-zinc-400">(not supported)</span>
            )}
          </label>
          <input
            name="llm_temperature"
            type="number"
            step="0.1"
            min="0"
            max="2"
            defaultValue={existingStep?.llm_temperature ?? ""}
            disabled={!selectedModel?.is_temperature_supported}
            placeholder="0.7"
            className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Input type
          </label>
          <select
            name="llm_input_type_id"
            defaultValue={existingStep?.llm_input_type_id ?? inputTypes[0]?.id}
            className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {inputTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.description}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
            Output type
          </label>
          <select
            name="llm_output_type_id"
            defaultValue={existingStep?.llm_output_type_id ?? outputTypes[0]?.id}
            className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {outputTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.description}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          System prompt
        </label>
        <textarea
          name="llm_system_prompt"
          defaultValue={existingStep?.llm_system_prompt ?? ""}
          rows={4}
          placeholder="You are a helpful assistant…"
          className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
          User prompt
        </label>
        <textarea
          name="llm_user_prompt"
          defaultValue={existingStep?.llm_user_prompt ?? ""}
          rows={4}
          placeholder="Describe what you see in this image…"
          className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono"
        />
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
        >
          {saving ? "Saving…" : existingStep ? "Save changes" : "Add step"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-1.5 border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
