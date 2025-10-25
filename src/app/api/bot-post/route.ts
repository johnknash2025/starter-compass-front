import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseTags } from "@/lib/pulsewave";

const payloadSchema = z.object({
  content: z.string().min(1).max(280),
  tags: z.union([z.string(), z.array(z.string())]).default([]),
  author: z.string().nonempty().default("Pulsewave Bot"),
  handle: z
    .string()
    .regex(/^@[a-zA-Z0-9_.-]+$/, "Handle must start with '@'")
    .default("@pulsewave_bot"),
});

function verifySecret(request: Request) {
  const header = request.headers.get("x-pulsewave-bot-secret");
  const expected = process.env.BOT_POST_SECRET;
  return Boolean(header && expected && header === expected);
}

export async function POST(request: Request) {
  if (!verifySecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const raw = await request.json();
    const parsed = payloadSchema.parse(raw);
    const tags = Array.isArray(parsed.tags)
      ? parseTags(parsed.tags.join(" "))
      : parseTags(parsed.tags);

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from("posts")
      .insert({
        author: parsed.author,
        handle: parsed.handle,
        content: parsed.content,
        tags,
        likes: 0,
        boosts: 0,
        replies: 0,
        avatar_hue: parsed.handle.length * 13,
        user_id: "ai-bot",
        is_bot: true,
      })
      .select()
      .single();

    if (error || !data) {
      throw error ?? new Error("Insert failed");
    }

    return NextResponse.json({ status: "ok" }, { status: 201 });
  } catch (error) {
    console.error("[api/bot-post] error", error);
    return NextResponse.json(
      { error: "Failed to create bot post." },
      { status: 500 },
    );
  }
}
