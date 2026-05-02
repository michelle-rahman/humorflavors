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
    opacity: isDragging ? 0.5 : 1,
  };

  const model = models.find((m) => m.id === step.llm_model_id);
  const inputType = inputTypes.find((t) => t.id === step.llm_input_type_id);
  const outputType = outputTypes.find((t) => t.id === step.llm_output_type_id);
  const stepType = stepTypes.find((t) => t.id === step.humor_flavor_step_type_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden"
    >
      <div className="flex items-start gap-3 p-4">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="flex-shrink-0 mt-0.5 cursor-grab active:cursor-grabbing text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 p-1 -m-1 rounded"
          title="Drag to reorder"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-1.5 py-0.5 rounded">
              Step {step.order_by}
            </span>
            {stepType && (
              <span className="text-xs bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300 px-1.5 py-0.5 rounded">
                {stepType.slug}
              </span>
            )}
            {model && (
              <span className="text-xs text-zinc-500 dark:text-zinc-400">
                {model.name}
              </span>
            )}
          </div>

          {step.description && (
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200 mb-1">
              {step.description}
            </p>
          )}

          <div className="flex flex-wrap gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {inputType && <span>Input: {inputType.description}</span>}
            {outputType && <span>Output: {outputType.description}</span>}
            {step.llm_temperature !== null && (
              <span>Temp: {step.llm_temperature}</span>
            )}
          </div>

          {!isEditing && (
            <div className="mt-2 space-y-1">
              {step.llm_system_prompt && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    System prompt
                  </summary>
                  <pre className="mt-1 p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans">
                    {step.llm_system_prompt}
                  </pre>
                </details>
              )}
              {step.llm_user_prompt && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200">
                    User prompt
                  </summary>
                  <pre className="mt-1 p-2 bg-zinc-100 dark:bg-zinc-800 rounded text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap font-sans">
                    {step.llm_user_prompt}
                  </pre>
                </details>
              )}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex gap-1">
          <button
            onClick={onEdit}
            className="px-2.5 py-1 text-xs font-medium text-indigo-700 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-md transition-colors"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
          <button
            onClick={onDelete}
            className="px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-md transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {isEditing && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
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
