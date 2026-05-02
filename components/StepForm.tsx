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

  const fieldCls = "w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow";
  const labelCls = "block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wide";

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Row 1: type + description */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Step type</label>
          <select name="humor_flavor_step_type_id" defaultValue={existingStep?.humor_flavor_step_type_id ?? stepTypes[0]?.id} className={fieldCls}>
            {stepTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.slug} — {t.description}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Description <span className="normal-case text-zinc-400">(optional)</span></label>
          <input name="description" defaultValue={existingStep?.description ?? ""} placeholder="Brief step description" className={fieldCls} />
        </div>
      </div>

      {/* Row 2: model + temperature */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>LLM model</label>
          <select name="llm_model_id" value={selectedModelId} onChange={(e) => setSelectedModelId(Number(e.target.value))} className={fieldCls}>
            {models.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>
            Temperature{" "}
            {!selectedModel?.is_temperature_supported && (
              <span className="text-zinc-400 normal-case">— not supported</span>
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
            className={`${fieldCls} disabled:opacity-40 disabled:cursor-not-allowed`}
          />
        </div>
      </div>

      {/* Row 3: input + output type */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Input type</label>
          <select name="llm_input_type_id" defaultValue={existingStep?.llm_input_type_id ?? inputTypes[0]?.id} className={fieldCls}>
            {inputTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.description}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Output type</label>
          <select name="llm_output_type_id" defaultValue={existingStep?.llm_output_type_id ?? outputTypes[0]?.id} className={fieldCls}>
            {outputTypes.map((t) => (
              <option key={t.id} value={t.id}>{t.description}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Prompts */}
      <div>
        <label className={labelCls}>System prompt</label>
        <textarea
          name="llm_system_prompt"
          defaultValue={existingStep?.llm_system_prompt ?? ""}
          rows={4}
          placeholder="You are a helpful assistant…"
          className={`${fieldCls} resize-none font-mono text-xs leading-relaxed`}
        />
      </div>
      <div>
        <label className={labelCls}>User prompt</label>
        <textarea
          name="llm_user_prompt"
          defaultValue={existingStep?.llm_user_prompt ?? ""}
          rows={4}
          placeholder="Describe what you see in this image…"
          className={`${fieldCls} resize-none font-mono text-xs leading-relaxed`}
        />
      </div>

      {error && (
        <div className="px-3 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-medium rounded-xl transition-all active:scale-[0.97]"
        >
          {saving ? (
            <><LoadingSpinner />{existingStep ? "Saving…" : "Adding…"}</>
          ) : (
            existingStep ? "Save changes" : "Add step"
          )}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-sm rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
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
