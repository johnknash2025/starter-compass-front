import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { mapRowToPost, type PulsewavePostRow } from "@/lib/pulsewave";

const ALLOWED_FIELDS = new Set(["likes", "boosts", "replies"]);

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const payload = (await request.json()) as { field?: string };
    const field = payload.field;

    if (!field || !ALLOWED_FIELDS.has(field)) {
      return NextResponse.json({ error: "Invalid field." }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.rpc("increment_post_metric", {
      p_post_id: id,
      p_metric: field,
    });

    if (error || !data) {
      console.error("[api/posts/:id] increment error", error);
      return NextResponse.json(
        { error: "Failed to update reaction." },
        { status: 500 },
      );
    }

    return NextResponse.json({ post: mapRowToPost(data as PulsewavePostRow) });
  } catch (error) {
    console.error("[api/posts/:id] unexpected error", error);
    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 },
    );
  }
}
