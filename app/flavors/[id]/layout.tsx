import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { NavBar } from "@/components/NavBar";
import type { Profile } from "@/lib/types";

export default async function FlavorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_superadmin, is_matrix_admin")
    .eq("id", user.id)
    .single<Profile>();

  const isAdmin = profile?.is_superadmin || profile?.is_matrix_admin;

  if (!isAdmin) {
    return (
      <>
        <NavBar />
        <main className="max-w-6xl mx-auto px-4 py-12 text-center">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
            Access denied
          </h1>
        </main>
      </>
    );
  }

  return (
    <>
      <NavBar />
      <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
    </>
  );
}
