import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        },
      },
    }
  );

  // Use getUser() for a verified, fresh token
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return NextResponse.json({ message: "No session token found. Please sign in again." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/caption-requests`;

  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        "Accept": "application/json",
      },
      body: JSON.stringify(body),
    });

    const text = await upstream.text();
    let json: unknown;
    try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!upstream.ok) {
      // Return the full upstream error so it's visible in the UI
      return NextResponse.json(
        { message: `API error ${upstream.status}: ${JSON.stringify(json)}` },
        { status: upstream.status }
      );
    }

    return NextResponse.json(json, { status: 200 });
  } catch (err: unknown) {
    return NextResponse.json(
      { message: err instanceof Error ? err.message : "Request to caption API failed" },
      { status: 502 }
    );
  }
}
