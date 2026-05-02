import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_FALLBACK = "claude-haiku-4-5-20251001";

function resolveModel(providerModelId: string): string {
  // Map provider model IDs to Anthropic model IDs
  if (providerModelId?.toLowerCase().includes("haiku")) return "claude-haiku-4-5-20251001";
  if (providerModelId?.toLowerCase().includes("sonnet")) return "claude-sonnet-4-6";
  if (providerModelId?.toLowerCase().includes("opus")) return "claude-opus-4-7";
  if (providerModelId?.toLowerCase().includes("gpt")) return MODEL_FALLBACK; // fall back for OpenAI models
  return providerModelId || MODEL_FALLBACK;
}

function injectContext(prompt: string, context: Record<string, string>): string {
  let result = prompt;
  for (const [key, value] of Object.entries(context)) {
    result = result.replace(new RegExp(`\\{\\{?${key}\\}?\\}`, "gi"), value);
  }
  return result;
}

export async function POST(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { message: "ANTHROPIC_API_KEY is not configured on the server." },
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

  // Fetch steps for this flavor, ordered
  const { data: steps, error: stepsError } = await supabase
    .from("humor_flavor_steps")
    .select(`
      *,
      llm_models ( provider_model_id, is_temperature_supported ),
      llm_input_types ( slug ),
      llm_output_types ( slug )
    `)
    .eq("humor_flavor_id", humor_flavor_id)
    .order("order_by", { ascending: true });

  if (stepsError) {
    return NextResponse.json({ message: stepsError.message }, { status: 500 });
  }
  if (!steps || steps.length === 0) {
    return NextResponse.json({ message: "This flavor has no steps. Add at least one step before testing." }, { status: 422 });
  }

  // Run the prompt chain
  let chainOutput = "";
  const context: Record<string, string> = { image_url, imageUrl: image_url };

  try {
    for (const step of steps) {
      const modelId = resolveModel(step.llm_models?.provider_model_id ?? "");
      const systemPrompt = injectContext(step.llm_system_prompt ?? "", context);
      const userPromptText = injectContext(step.llm_user_prompt ?? "", context);
      const inputSlug: string = step.llm_input_types?.slug ?? "";
      const isImageInput = inputSlug.toLowerCase().includes("image") || inputSlug.toLowerCase().includes("vision");

      // Build message content: include previous chain output if available
      type ContentBlock =
        | { type: "text"; text: string }
        | { type: "image"; source: { type: "url"; url: string } };

      const contentBlocks: ContentBlock[] = [];

      if (isImageInput) {
        contentBlocks.push({ type: "image", source: { type: "url", url: image_url } });
      }

      const userText = [
        userPromptText,
        chainOutput ? `\n\nPrevious step output:\n${chainOutput}` : "",
      ].filter(Boolean).join("");

      contentBlocks.push({ type: "text", text: userText });

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model: modelId,
        max_tokens: 1024,
        messages: [{ role: "user", content: contentBlocks }],
      };

      if (systemPrompt) params.system = systemPrompt;
      if (step.llm_temperature !== null && step.llm_models?.is_temperature_supported) {
        params.temperature = step.llm_temperature;
      }

      const response = await anthropic.messages.create(params);
      chainOutput = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      context.previousOutput = chainOutput;
      context.step_output = chainOutput;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "LLM call failed";
    return NextResponse.json({ message: msg }, { status: 502 });
  }

  // Return as caption array matching the Caption type shape
  const caption = {
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
  };

  return NextResponse.json({ captions: [caption] });
}
