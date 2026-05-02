import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { GoogleGenerativeAI } from "@google/generative-ai";

function injectContext(prompt: string, context: Record<string, string>): string {
  let result = prompt;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{\\{?${key}\\}?\\}`, "gi"), value);
  }
  return result;
}

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { message: "GEMINI_API_KEY is not set. Add it to your Vercel environment variables and redeploy." },
      { status: 500 }
    );
  }

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
    if (!humor_flavor_id || !image_url) throw new Error("missing fields");
  } catch {
    return NextResponse.json({ message: "Request must include humor_flavor_id and image_url" }, { status: 400 });
  }

  const { data: steps, error: stepsError } = await supabase
    .from("humor_flavor_steps")
    .select("*")
    .eq("humor_flavor_id", humor_flavor_id)
    .order("order_by", { ascending: true });

  if (stepsError) {
    return NextResponse.json({ message: stepsError.message }, { status: 500 });
  }
  if (!steps || steps.length === 0) {
    return NextResponse.json(
      { message: "This flavor has no steps. Add at least one step before testing." },
      { status: 422 }
    );
  }

  // Download image once and reuse across steps
  let imageBase64: string | null = null;
  let imageMimeType = "image/jpeg";
  try {
    const imgRes = await fetch(image_url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (imgRes.ok) {
      const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
      imageMimeType = ct.split(";")[0].trim() || "image/jpeg";
      const buf = await imgRes.arrayBuffer();
      imageBase64 = Buffer.from(buf).toString("base64");
    }
  } catch {
    // continue without inline image — URL will be in the prompt text
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

  const context: Record<string, string> = { image_url, imageUrl: image_url };
  let chainOutput = "";

  try {
    for (const step of steps) {
      const systemPrompt = injectContext(step.llm_system_prompt ?? "", context);
      const userPromptText = injectContext(step.llm_user_prompt ?? "", context);

      const textParts: string[] = [];
      if (systemPrompt) textParts.push(systemPrompt);
      textParts.push(
        userPromptText || `Generate a funny, creative caption for the image at: ${image_url}`
      );
      if (chainOutput) textParts.push(`\nPrevious step output:\n${chainOutput}`);

      type Part = { text: string } | { inlineData: { mimeType: string; data: string } };
      const parts: Part[] = [];

      // Always include the image so every step can see it
      if (imageBase64) {
        parts.push({ inlineData: { mimeType: imageMimeType, data: imageBase64 } });
      }
      parts.push({ text: textParts.join("\n\n") });

      const result = await model.generateContent(parts);
      chainOutput = result.response.text();
      context.previousOutput = chainOutput;
      context.step_output = chainOutput;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "LLM call failed";
    return NextResponse.json({ message: `Gemini error: ${msg}` }, { status: 502 });
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
