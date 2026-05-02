"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type {
  HumorFlavorStep,
  LLMModel,
  LLMInputType,
  LLMOutputType,
  HumorFlavorStepType,
} from "@/lib/types";
import { StepForm } from "./StepForm";

interface Props {
  step: HumorFlavorStep;
  models: LLMModel[];
  inputTypes: LLMInputType[];
  outputTypes: LLMOutputType[];
  stepTypes: HumorFlavorStepType[];
  isEditing: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSaved: (step: HumorFlavorStep) => void;
  onCancelEdit: () => void;
}

export function SortableStep({
  step,
  models,
  inputTypes,
  outputTypes,
  stepTypes,
  isEditing,
  onEdit,
  onDelete,
  onSaved,
  onCancelEdit,
}: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const model = models.find((m) => m.id === step.llm_model_id);
  const inputType = inputTypes.find((t) => t.id === step.llm_input_type_id);
  const outputType = outputTypes.find((t) => t.id === step.llm_output_type_id);
  const stepType = stepTypes.find((t) => t.id === step.humor_flavor_step_type_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-zinc-900 border rounded-2xl overflow-hidden transition-shadow ${
        isDragging
          ? "border-indigo-400 dark:border-indigo-600 shadow-lg shadow-indigo-100 dark:shadow-indigo-900/30"
          : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
      }`}
    >
      <div className="flex items-start gap-3 p-4">
        {/* Step number + drag handle */}
        <div className="flex flex-col items-center gap-1.5 flex-shrink-0 pt-0.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-400 flex items-center justify-center text-xs font-bold">
            {step.order_by}
          </div>
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-zinc-300 dark:text-zinc-700 hover:text-zinc-500 dark:hover:text-zinc-400 p-0.5 rounded transition-colors"
            title="Drag to reorder"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" />
              <circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" />
              <circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
            {stepType && (
              <span className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 px-2 py-0.5 rounded-md font-medium">
                {stepType.slug}
              </span>
            )}
            {model && (
              <span className="text-xs bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-400 px-2 py-0.5 rounded-md border border-violet-200/50 dark:border-violet-800/30">
                {model.name}
              </span>
            )}
            {inputType && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {inputType.description}
              </span>
            )}
            {outputType && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">→ {outputType.description}</span>
            )}
            {step.llm_temperature !== null && (
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                temp {step.llm_temperature}
              </span>
            )}
          </div>

          {step.description && (
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-2">
              {step.description}
            </p>
          )}

          {!isEditing && (
            <div className="space-y-1.5">
              {step.llm_system_prompt && (
                <PromptPreview label="System" content={step.llm_system_prompt} />
              )}
              {step.llm_user_prompt && (
                <PromptPreview label="User" content={step.llm_user_prompt} />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex gap-1 pt-0.5">
          <button
            onClick={onEdit}
            className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isEditing
                ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                : "text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border border-indigo-200/50 dark:border-indigo-800/30"
            }`}
          >
            {isEditing ? (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
                Cancel
              </>
            ) : (
              <>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4Z"/></svg>
                Edit
              </>
            )}
          </button>
          <button
            onClick={onDelete}
            className="flex items-center justify-center w-7 h-7 text-zinc-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            title="Delete step"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
          </button>
        </div>
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div className="border-t border-zinc-100 dark:border-zinc-800 p-4 bg-zinc-50 dark:bg-zinc-950/50 animate-slide-down">
          <StepForm
            humorFlavorId={step.humor_flavor_id}
            orderBy={step.order_by}
            existingStep={step}
            models={models}
            inputTypes={inputTypes}
            outputTypes={outputTypes}
            stepTypes={stepTypes}
            onSaved={onSaved}
            onCancel={onCancelEdit}
          />
        </div>
      )}
    </div>
  );
}

function PromptPreview({ label, content }: { label: string; content: string }) {
  return (
    <details className="group/details">
      <summary className="flex items-center gap-1.5 text-xs text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer select-none list-none transition-colors">
        <svg className="w-3 h-3 transition-transform group-open/details:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m9 18 6-6-6-6"/></svg>
        <span className="font-medium">{label} prompt</span>
        <span className="text-zinc-300 dark:text-zinc-700 truncate max-w-[200px]">
          — {content.slice(0, 60)}{content.length > 60 ? "…" : ""}
        </span>
      </summary>
      <pre className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-xl text-xs text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-mono leading-relaxed overflow-x-auto">
        {content}
      </pre>
    </details>
  );
}
