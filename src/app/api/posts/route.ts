import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import {
  MAX_CHARACTERS,
  SEED_POSTS,
  mapRowToPost,
  normalizeHandle,
  parseTags,
} from "@/lib/pulsewave";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      console.error("[api/posts] fetch error", error);
      return NextResponse.json(
        { posts: SEED_POSTS, fallback: true },
        { status: 200 },
      );
    }

    const posts = (data ?? []).map(mapRowToPost);
    return NextResponse.json({ posts });
  } catch (error) {
    console.error("[api/posts] unexpected error", error);
    return NextResponse.json(
      {
        posts: SEED_POSTS,
        fallback: true,
        error: "Supabase is not configured yet.",
      },
      { status: 200 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Partial<
      Record<"author" | "handle" | "content" | "tags", unknown>
    >;
    const content = String(payload.content ?? "").trim();

    if (!content) {
      return NextResponse.json(
        { error: "Content is required." },
        { status: 400 },
      );
    }

    if (content.length > MAX_CHARACTERS) {
      return NextResponse.json(
        { error: "Content exceeds character limit." },
        { status: 400 },
      );
    }

    const author = String(payload.author ?? "").trim() || "Guest";
    const handle =
      normalizeHandle(String(payload.handle ?? "")) || "@guest";

    const tagsInput = Array.isArray(payload.tags)
      ? payload.tags.join(" ")
      : String(payload.tags ?? "");
    const tags = parseTags(tagsInput);

    const supabase = getSupabaseAdmin();
    const avatarHue = Math.floor(Math.random() * 360);

    const { data, error } = await supabase
      .from("posts")
      .insert({
        author,
        handle,
        content,
        tags,
        likes: 0,
        boosts: 0,
        replies: 0,
        avatar_hue: avatarHue,
      })
      .select()
      .single();

    if (error || !data) {
      console.error("[api/posts] insert error", error);
      return NextResponse.json(
        { error: "Failed to create post." },
        { status: 500 },
      );
    }

    return NextResponse.json({ post: mapRowToPost(data) }, { status: 201 });
  } catch (error) {
    console.error("[api/posts] unexpected insert error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
