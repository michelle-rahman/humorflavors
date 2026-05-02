import { createClient } from "@/lib/supabase/server";
import type { HumorFlavor } from "@/lib/types";
import { FlavorList } from "@/components/FlavorList";

export default async function DashboardPage() {
  const supabase = createClient();

  const { data: flavors, error } = await supabase
    .from("humor_flavors")
    .select("*")
    .order("modified_datetime_utc", { ascending: false });

  if (error) {
    return (
      <p className="text-red-500 text-sm">
        Failed to load flavors: {error.message}
      </p>
    );
  }

  return <FlavorList initialFlavors={(flavors as HumorFlavor[]) ?? []} />;
}
