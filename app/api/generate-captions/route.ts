import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";

function injectContext(prompt: string, ctx: Record<string, string>): string {
  let s = prompt;
  for (const [k, v] of Object.entries(ctx)) {
    s = s.replace(new RegExp(`\\{\\{?${k}\\}?\\}`, "gi"), v);
  }
  return s;
}

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

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }

  let humor_flavor_id: number;
  let image_url: string;
  try {
    const body = await request.json();
    humor_flavor_id = Number(body.humor_flavor_id);
    image_url = String(body.image_url ?? "").trim();
    if (!humor_flavor_id || !image_url) throw new Error();
  } catch {
    return NextResponse.json({ message: "Request must include humor_flavor_id and image_url" }, { status: 400 });
  }

  // ── 1. Try the class REST API ──────────────────────────────────────────────
  const apiUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/caption-requests`;
  try {
    const upstream = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${session.access_token}`,
        "Accept": "application/json",
      },
      body: JSON.stringify({ humor_flavor_id, image_url }),
    });

    if (upstream.ok) {
      const json = await upstream.json();
      return NextResponse.json(json);
    }
    // Non-405 errors (auth, server errors) surface directly
    if (upstream.status !== 405) {
      const text = await upstream.text();
      return NextResponse.json({ message: `API error ${upstream.status}: ${text}` }, { status: upstream.status });
    }
    // 405 → fall through to Gemini
  } catch {
    // network error → fall through to Gemini
  }

  // ── 2. Gemini fallback ─────────────────────────────────────────────────────
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { message: "Caption generation unavailable: the class API returned 405 and GEMINI_API_KEY is not set as a fallback." },
      { status: 502 }
    );
  }

  const { data: steps, error: stepsErr } = await supabase
    .from("humor_flavor_steps")
    .select("*")
    .eq("humor_flavor_id", humor_flavor_id)
    .order("order_by", { ascending: true });

  if (stepsErr) return NextResponse.json({ message: stepsErr.message }, { status: 500 });
  if (!steps?.length) {
    return NextResponse.json(
      { message: "This flavor has no steps. Add at least one step before testing." },
      { status: 422 }
    );
  }

  let imageBase64: string | null = null;
  let imageMimeType = "image/jpeg";
  try {
    const imgRes = await fetch(image_url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (imgRes.ok) {
      imageMimeType = (imgRes.headers.get("content-type") ?? "image/jpeg").split(";")[0].trim() || "image/jpeg";
      imageBase64 = Buffer.from(await imgRes.arrayBuffer()).toString("base64");
    }
  } catch { /* use URL text reference only */ }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
  const ctx: Record<string, string> = { image_url, imageUrl: image_url };
  let chainOutput = "";

  try {
    for (const step of steps) {
      const systemPrompt = injectContext(step.llm_system_prompt ?? "", ctx);
      const userPromptText = injectContext(step.llm_user_prompt ?? "", ctx);
      const textParts = [
        systemPrompt,
        userPromptText || `Generate a funny, creative caption for this image: ${image_url}`,
        chainOutput ? `\nPrevious step output:\n${chainOutput}` : "",
      ].filter(Boolean).join("\n\n");

      type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
      const parts: Part[] = [];
      if (imageBase64) parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
      parts.push({ text: textParts });

      const result = await model.generateContent(parts);
      chainOutput = result.response.text();
      ctx.previousOutput = chainOutput;
      ctx.step_output = chainOutput;
    }
  } catch (err: unknown) {
    return NextResponse.json({ message: `Gemini error: ${err instanceof Error ? err.message : err}` }, { status: 502 });
  }

  return NextResponse.json({
    captions: [{
      id: crypto.randomUUID(),
      content: chainOutput,
      humor_flavor_id,
      image_id: null,
      caption_request_id: null,
      is_public: false,
      profile_id: session.user.id,
      like_count: 0,
      created_datetime_utc: new Date().toISOString(),
      modified_datetime_utc: new Date().toISOString(),
    }],
  });
}
