import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  HumorFlavor,
  HumorFlavorStep,
  LLMModel,
  LLMInputType,
  LLMOutputType,
  HumorFlavorStepType,
} from "@/lib/types";
import { FlavorEditor } from "@/components/FlavorEditor";

export default async function FlavorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const id = Number(params.id);

  const [
    { data: flavor },
    { data: steps },
    { data: models },
    { data: inputTypes },
    { data: outputTypes },
    { data: stepTypes },
  ] = await Promise.all([
    supabase.from("humor_flavors").select("*").eq("id", id).single(),
    supabase
      .from("humor_flavor_steps")
      .select("*")
      .eq("humor_flavor_id", id)
      .order("order_by"),
    supabase.from("llm_models").select("id, name, provider_model_id, is_temperature_supported, llm_provider_id").order("name"),
    supabase.from("llm_input_types").select("*"),
    supabase.from("llm_output_types").select("*"),
    supabase.from("humor_flavor_step_types").select("*"),
  ]);

  if (!flavor) notFound();

  return (
    <FlavorEditor
      flavor={flavor as HumorFlavor}
      initialSteps={(steps as HumorFlavorStep[]) ?? []}
      models={(models as LLMModel[]) ?? []}
      inputTypes={(inputTypes as LLMInputType[]) ?? []}
      outputTypes={(outputTypes as LLMOutputType[]) ?? []}
      stepTypes={(stepTypes as HumorFlavorStepType[]) ?? []}
    />
  );
}
