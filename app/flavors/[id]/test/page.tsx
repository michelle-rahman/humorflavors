import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { HumorFlavor, Caption } from "@/lib/types";
import { TestFlavor } from "@/components/TestFlavor";

export default async function TestFlavorPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const id = Number(params.id);

  const [{ data: flavor }, { data: captions }] = await Promise.all([
    supabase.from("humor_flavors").select("*").eq("id", id).single(),
    supabase
      .from("captions")
      .select("*")
      .eq("humor_flavor_id", id)
      .order("created_datetime_utc", { ascending: false })
      .limit(50),
  ]);

  if (!flavor) notFound();

  return (
    <TestFlavor
      flavor={flavor as HumorFlavor}
      existingCaptions={(captions as Caption[]) ?? []}
    />
  );
}
