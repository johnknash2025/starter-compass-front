export const MAX_CHARACTERS = 280;

export type PulsewavePost = {
  id: string;
  author: string;
  handle: string;
  content: string;
  createdAt: string;
  tags: string[];
  likes: number;
  boosts: number;
  replies: number;
  avatarHue: number;
  userId?: string | null;
  isBot?: boolean;
};

export type TrendingTopic = {
  tag: string;
  count: number;
  momentum: number;
};

export type Insight = {
  label: string;
  value: string;
  meta: string;
};

export const SEED_POSTS: PulsewavePost[] = [
  {
    id: "p-1",
    author: "Aki Tanaka",
    handle: "@aki_design",
    content:
      "立て続けに3日 ship。夜の静けさ＋Next.js App Router の組み合わせ、やっぱり最強。",
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    tags: ["shipdaily", "nextjs", "nightshift"],
    likes: 42,
    boosts: 11,
    replies: 6,
    avatarHue: 210,
  },
  {
    id: "p-2",
    author: "Leo Martinez",
    handle: "@leo_makes",
    content:
      "Launched a vibes-only community wall with Vercel Edge Functions today. Sub-50ms everywhere 🌍⚡️",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
    tags: ["vercel", "edge", "shipdaily"],
    likes: 65,
    boosts: 18,
    replies: 9,
    avatarHue: 32,
  },
  {
    id: "p-3",
    author: "Kana",
    handle: "@kana_wave",
    content:
      "コミュニティの声、全部AI要約に任せたら21時に余裕で散歩できた。Pulsewave でも試したい。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 8).toISOString(),
    tags: ["ai", "workflow", "weekend"],
    likes: 38,
    boosts: 7,
    replies: 4,
    avatarHue: 320,
  },
  {
    id: "p-4",
    author: "Noah Park",
    handle: "@noah.codes",
    content:
      "Micro-interactions are everything. Added tactile reactions + soft audio cues and retention spiked 17%.",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 15).toISOString(),
    tags: ["ux", "motion", "buildinpublic"],
    likes: 54,
    boosts: 12,
    replies: 8,
    avatarHue: 260,
  },
  {
    id: "p-5",
    author: "Sora",
    handle: "@sora_codes",
    content:
      "朝ごはんの前に小さなSNS MVPをVercelに投げた。無駄な設定ゼロ… もう戻れない。",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    tags: ["vercel", "mvp", "founder"],
    likes: 71,
    boosts: 21,
    replies: 10,
    avatarHue: 180,
  },
];

export function deriveTrendingTopics(posts: PulsewavePost[]): TrendingTopic[] {
  const now = Date.now();
  const sixHours = 1000 * 60 * 60 * 6;
  const map = new Map<string, { count: number; recent: number }>();

  posts.forEach((post) => {
    post.tags.forEach((tag) => {
      const normalized = tag.toLowerCase();
      const existing = map.get(normalized) ?? { count: 0, recent: 0 };
      existing.count += 1;
      if (now - new Date(post.createdAt).getTime() <= sixHours) {
        existing.recent += 1;
      }
      map.set(normalized, existing);
    });
  });

  return [...map.entries()]
    .map(([tag, data]) => ({
      tag,
      count: data.count,
      momentum: data.count
        ? Math.min(120, Math.round((data.recent / data.count) * 100) + 20)
        : 20,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export function buildInsights(posts: PulsewavePost[]): Insight[] {
  if (!posts.length) {
    return [
      { label: "Pulses today", value: "0", meta: "まずは最初の投稿から" },
      {
        label: "Avg. engagement",
        value: "0",
        meta: "リアクションがつくとここに表示されます",
      },
      { label: "Momentum", value: "0%", meta: "投稿を重ねると増加" },
      {
        label: "Active tags",
        value: "0",
        meta: "タグ付き投稿があると追跡",
      },
    ];
  }

  const now = Date.now();
  const todayCount = posts.filter(
    (post) => now - new Date(post.createdAt).getTime() < 86_400_000,
  ).length;
  const totalInteractions = posts.reduce(
    (acc, post) => acc + post.likes + post.boosts + post.replies,
    0,
  );
  const uniqueTags = new Set(posts.flatMap((post) => post.tags));

  return [
    {
      label: "Pulses today",
      value: todayCount.toString(),
      meta: "24時間以内の投稿数",
    },
    {
      label: "Avg. engagement",
      value: Math.round(totalInteractions / posts.length)
        .toString()
        .concat(" /post"),
      meta: "Like + Boost + Reply",
    },
    {
      label: "Momentum",
      value: `${Math.min(100, todayCount * 12)}%`,
      meta: "投稿頻度のざっくり指数",
    },
    {
      label: "Active tags",
      value: uniqueTags.size.toString(),
      meta: "ハッシュタグの広がり",
    },
  ];
}

export function relativeTimeFromNow(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.max(1, Math.round(diff / 1000));
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (seconds < 60) return `${seconds}s`;
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;

  const date = new Date(isoDate);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function normalizeHandle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[^a-zA-Z0-9_@.-]/g, "");
  if (!cleaned.startsWith("@")) {
    return `@${cleaned.replace(/^@+/, "")}`;
  }
  return cleaned;
}

export function parseTags(value: string) {
  return [
    ...new Set(
      value
        .split(/[\s,]+/)
        .map((tag) => tag.trim().replace(/^#/, ""))
        .filter(Boolean)
        .map((tag) => tag.toLowerCase()),
    ),
  ];
}

export type PulsewavePostRow = {
  id: string;
  author: string;
  handle: string;
  content: string;
  tags: string[] | null;
  created_at: string;
  likes: number | null;
  boosts: number | null;
  replies: number | null;
  avatar_hue: number | null;
  user_id: string | null;
  is_bot: boolean | null;
};

export function mapRowToPost(row: PulsewavePostRow): PulsewavePost {
  return {
    id: row.id,
    author: row.author,
    handle: row.handle,
    content: row.content,
    createdAt: row.created_at,
    tags: row.tags ?? [],
    likes: row.likes ?? 0,
    boosts: row.boosts ?? 0,
    replies: row.replies ?? 0,
    avatarHue: row.avatar_hue ?? avatarHueFromHandle(row.handle),
    userId: row.user_id,
    isBot: row.is_bot ?? false,
  };
}

export function deriveHandleFromIdentity(
  name?: string | null,
  email?: string | null,
) {
  if (email) {
    return `@${email.split("@")[0]}`;
  }
  if (name) {
    return `@${name.replace(/\s+/g, "").toLowerCase()}`;
  }
  return undefined;
}

export function avatarHueFromHandle(handle: string) {
  const normalized = handle.toLowerCase();
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return hue;
}
