"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type {
  ChangeEvent,
  Dispatch,
  FormEvent,
  ReactNode,
  SetStateAction,
} from "react";
import { signIn, signOut, useSession } from "next-auth/react";
import {
  MAX_CHARACTERS,
  SEED_POSTS,
  buildInsights,
  deriveHandleFromIdentity,
  deriveTrendingTopics,
  normalizeHandle,
  relativeTimeFromNow,
  type Insight,
  type PulsewavePost,
  type TrendingTopic,
} from "@/lib/pulsewave";

const API_BASE = "/api/posts";

type Draft = {
  content: string;
  tags: string;
};

type UserIdentity = {
  name: string;
  handle: string;
  image?: string | null;
};

type ReactionField = "likes" | "boosts" | "replies";

type PostsResponse = {
  posts: PulsewavePost[];
  fallback?: boolean;
  error?: string;
};

const defaultDraft = (): Draft => ({
  content: "",
  tags: "shipdaily",
});

export default function Home() {
  const [posts, setPosts] = useState<PulsewavePost[]>(SEED_POSTS);
  const [draft, setDraft] = useState<Draft>(defaultDraft);
  const [formError, setFormError] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState("");
  const [isFallback, setIsFallback] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { data: session, status } = useSession();
  const isAuthenticated = status === "authenticated";
  const [providerAvailability, setProviderAvailability] = useState<
    Record<string, boolean>
  >({});

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/providers")
      .then((res) => (res.ok ? res.json() : null))
      .then((result: Record<string, { id: string }> | null) => {
        if (!cancelled && result) {
          setProviderAvailability({
            github: Boolean(result.github),
            google: Boolean(result.google),
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setProviderAvailability({});
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const sessionHandle =
    session?.user
      ?
          normalizeHandle(
            deriveHandleFromIdentity(session.user.name, session.user.email) ??
              session.user.id ??
              "",
          ) || "@pulsewave"
      : null;
  const currentUser: UserIdentity | null =
    isAuthenticated && session?.user && sessionHandle
      ? {
          name: session.user.name ?? "Pulsewave user",
          handle: sessionHandle,
          image: session.user.image,
        }
      : null;

  useEffect(() => {
    let cancelled = false;
    const fetchPosts = async () => {
      try {
        const response = await fetch(API_BASE, { cache: "no-store" });
        const payload = (await response.json()) as PostsResponse;
        if (cancelled) return;
        setPosts(payload.posts ?? []);
        setIsFallback(Boolean(payload.fallback));
        setSyncError(payload.error ?? "");
      } catch (error) {
        console.error("[pulsewave] failed to load posts", error);
        if (!cancelled) {
          setSyncError("Supabaseへの接続に失敗しました。ローカルデータを表示します。");
          setPosts(SEED_POSTS);
          setIsFallback(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchPosts();
    return () => {
      cancelled = true;
    };
  }, []);

  const trendingTopics = useMemo(() => deriveTrendingTopics(posts), [posts]);
  const visiblePosts = useMemo(
    () =>
      filterTag ? posts.filter((post) => post.tags.includes(filterTag)) : posts,
    [posts, filterTag],
  );
  const insights = useMemo(() => buildInsights(posts), [posts]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = draft.content.trim();
    if (!trimmed) {
      setFormError("まずは一言でもOK。想いを落としてみよう。");
      return;
    }
    if (trimmed.length > MAX_CHARACTERS) {
      setFormError("280文字以内にギュッとまとめてください。");
      return;
    }

    if (!isAuthenticated || !session?.user) {
      setFormError("投稿するにはログインが必要です。");
      return;
    }

    setIsSubmitting(true);
    setFormError("");

    try {
      const response = await fetch(API_BASE, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: trimmed,
          tags: draft.tags,
        }),
      });

      const payload = (await response.json()) as { post?: PulsewavePost; error?: string };

      if (!response.ok || !payload.post) {
        setFormError(payload.error ?? "投稿に失敗しました。もう一度お試しください。");
        return;
      }

      setPosts((prev) => [payload.post!, ...prev]);
      setDraft((current) => ({ ...current, content: "", tags: "" }));
      setSyncError("");
      setIsFallback(false);
      if (filterTag && !payload.post.tags.includes(filterTag)) {
        setFilterTag(null);
      }
    } catch (error) {
      console.error("[pulsewave] submit failed", error);
      setFormError("ネットワークに接続できませんでした。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReaction = (id: string, field: ReactionField) => {
    const snapshot = posts;
    setPosts((prev) =>
      prev.map((post) =>
        post.id === id ? { ...post, [field]: post[field] + 1 } : post,
      ),
    );

    fetch(`${API_BASE}/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ field }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as { post?: PulsewavePost; error?: string };
        if (!response.ok || !payload.post) {
          throw new Error(payload.error ?? "Failed to update post");
        }
        setPosts((prev) =>
          prev.map((post) => (post.id === payload.post!.id ? payload.post! : post)),
        );
      })
      .catch((error) => {
        console.error("[pulsewave] reaction failed", error);
        setSyncError("リアクションを保存できませんでした。");
        setPosts(snapshot);
      });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen px-4 py-10 sm:px-8 md:py-16">
        <main className="mx-auto flex max-w-5xl flex-col gap-8">
          <AuthToolbar
            user={null}
            isAuthenticated={false}
            providers={providerAvailability}
          />
          <Hero />
          <section className="glass-panel grid gap-6 p-8 md:grid-cols-2">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-slate-400">
                community only
              </p>
              <h2 className="text-3xl font-semibold text-white">
                招待制タイムライン
              </h2>
              <p className="text-slate-300">
                ここは AI を日常的に使い倒す開発者のための脳内ダンプ。プロダクトの進捗や試行錯誤を気兼ねなく共有するため、ログインしたメンバーだけが投稿とタイムラインを閲覧できます。
              </p>
              <ul className="list-disc space-y-2 pl-4 text-sm text-slate-400">
                <li>GitHub / Google 認証で本人確認</li>
                <li>投稿は Supabase に暗号化保存</li>
                <li>タグ・リアクション・インサイトもログイン後に解放</li>
              </ul>
              <SignInButtons providers={providerAvailability} />
            </div>
            <div className="rounded-2xl border border-white/5 bg-white/5 p-6 text-sm text-slate-300">
              <p className="mb-4 font-semibold text-white">なぜロックするのか</p>
              <p className="mb-3">
                アイデアの芽や市場の仮説を安心して共有するために、Pulsewave
                は公開せずコミュニティ内に閉じています。承認されたメンバーだけがログを追えます。
              </p>
              <p>
                ログインが完了するとフルタイムラインと composer
                が解放され、Supabase に同期されるリアルタイムの Pulse
                を閲覧・投稿できます。
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-10 sm:px-8 md:py-16">
      <main className="mx-auto flex max-w-6xl flex-col gap-8">
        <AuthToolbar
          user={currentUser}
          isAuthenticated={isAuthenticated}
          providers={providerAvailability}
        />
        <Hero />
        <DataStatusBanner isFallback={isFallback} error={syncError} />
        <section className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <Composer
              draft={draft}
              formError={formError}
              onChange={setDraft}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
              isAuthenticated={isAuthenticated}
              currentUser={currentUser}
              providers={providerAvailability}
            />
            <Feed
              posts={visiblePosts}
              activeTag={filterTag}
              onReact={handleReaction}
              onTagClick={(tag) =>
                setFilterTag((current) => (current === tag ? null : tag))
              }
              isLoading={loading}
            />
          </div>
          <aside className="space-y-6">
            <Trends
              topics={trendingTopics}
              activeTag={filterTag}
              onSelect={setFilterTag}
              isLoading={loading}
            />
            <InsightPanel insights={insights} />
          </aside>
        </section>
      </main>
    </div>
  );
}

function Hero() {
  return (
    <header className="glass-panel relative overflow-hidden p-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,rgba(56,189,248,0.25),transparent_45%)]" />
        <div className="h-full w-full bg-[radial-gradient(circle_at_80%_0%,rgba(232,121,249,0.3),transparent_35%)]" />
      </div>
      <div className="relative space-y-6">
        <span className="pill inline-flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
          Powered by Supabase
        </span>
        <div className="space-y-4">
          <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
            Pulsewave
          </h1>
          <p className="max-w-3xl text-lg text-slate-300">
            AI を武器にものづくりを続ける開発者たちのための、招待制ミニSNS。Next.js 15 と Supabase で構築された進捗ログです。
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <a
            href="#composer"
            className="rounded-xl bg-gradient-to-r from-sky-400 via-cyan-400 to-blue-500 px-5 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-cyan-500/30 transition hover:translate-y-0.5"
          >
            まずはポストしてみる
          </a>
        </div>
      </div>
    </header>
  );
}

function AuthToolbar({
  user,
  isAuthenticated,
  providers,
}: {
  user: UserIdentity | null;
  isAuthenticated: boolean;
  providers: Record<string, boolean>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-5 py-3">
      <div>
        <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Pulsewave</p>
        <p className="text-sm text-slate-300">Global indie maker feed</p>
      </div>
      {isAuthenticated && user ? (
        <div className="flex flex-wrap items-center gap-3">
          <UserBadge user={user} variant="toolbar" />
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-full border border-white/15 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/60"
          >
            ログアウト
          </button>
        </div>
      ) : (
        <SignInButtons compact providers={providers} />
      )}
    </div>
  );
}

type ComposerProps = {
  draft: Draft;
  formError: string;
  onChange: Dispatch<SetStateAction<Draft>>;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  isAuthenticated: boolean;
  currentUser: UserIdentity | null;
  providers: Record<string, boolean>;
};

function Composer({
  draft,
  formError,
  onChange,
  onSubmit,
  isSubmitting,
  isAuthenticated,
  currentUser,
  providers,
}: ComposerProps) {
  const remaining = MAX_CHARACTERS - draft.content.length;
  const composerDisabled = !draft.content.trim() || isSubmitting || !isAuthenticated;

  const handleInput =
    (field: keyof Draft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange((prev) => ({ ...prev, [field]: event.target.value }));
    };

  return (
    <form id="composer" onSubmit={onSubmit} className="glass-panel space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Composer</p>
          <h2 className="text-2xl font-semibold text-white">今日の Pulse を落とす</h2>
        </div>
        <span className="pill">Supabase Sync</span>
      </div>
      {currentUser ? (
        <UserBadge user={currentUser} variant="panel" />
      ) : (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          <p className="mb-3 font-medium text-white">まずはログインしてください。</p>
          <p className="mb-3">GitHub または Google で認証すると、あなたのアイデンティティで Pulse を投稿できます。</p>
          <SignInButtons providers={providers} />
        </div>
      )}
      <label className="space-y-2 text-sm text-slate-300">
        いま何してる？
        <textarea
          value={draft.content}
          onChange={handleInput("content")}
          rows={4}
          disabled={!isAuthenticated}
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white outline-none transition focus:border-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="progress, learnings, random sparks..."
        />
      </label>
      <label className="space-y-1 text-sm text-slate-300">
        ハッシュタグ（カンマまたはスペース区切り）
        <input
          type="text"
          value={draft.tags}
          onChange={handleInput("tags")}
          disabled={!isAuthenticated}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-base text-white outline-none transition focus:border-cyan-300/70 disabled:cursor-not-allowed disabled:opacity-60"
          placeholder="shipdaily, vercel"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-400">
        <span>{remaining} / 280</span>
        {formError ? (
          <span className="text-sm text-rose-300">{formError}</span>
        ) : (
          <span className="text-sm text-emerald-300">
            {isAuthenticated ? "Supabaseと同期" : "ログインして投稿を有効化"}
          </span>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-3">
        <button
          type="button"
          onClick={() =>
            onChange((prev) => ({
              ...prev,
              content:
                prev.content +
                (prev.content ? "\n" : "") +
                "Building something small but meaningful.",
            }))
          }
          className="rounded-xl border border-white/20 px-4 py-2 text-sm font-medium text-slate-100 transition hover:border-cyan-300/60"
        >
          インスピレーション
        </button>
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-cyan-400 via-sky-400 to-blue-500 px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={composerDisabled}
        >
          {isAuthenticated ? (isSubmitting ? "送信中..." : "Pulse を共有") : "ログインが必要"}
        </button>
      </div>
    </form>
  );
}

type FeedProps = {
  posts: PulsewavePost[];
  activeTag: string | null;
  onReact: (id: string, field: ReactionField) => void;
  onTagClick: (tag: string) => void;
  isLoading: boolean;
};

function Feed({ posts, activeTag, onReact, onTagClick, isLoading }: FeedProps) {
  const showEmpty = !isLoading && posts.length === 0;

  return (
    <section className="glass-panel space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Timeline</p>
          <h2 className="text-2xl font-semibold text-white">Live pulses</h2>
        </div>
        {activeTag && (
          <button
            type="button"
            onClick={() => onTagClick(activeTag)}
            className="rounded-full border border-emerald-300/60 px-3 py-1 text-xs font-medium text-emerald-200 transition hover:bg-emerald-300/10"
          >
            #{activeTag} を解除
          </button>
        )}
      </div>
      <div className="space-y-4">
        {isLoading && <LoadingSkeletonList />}
        {!isLoading &&
          posts.map((post) => (
            <PostCard key={post.id} post={post} onReact={onReact} onTagClick={onTagClick} />
          ))}
        {showEmpty && (
          <div className="rounded-2xl border border-dashed border-white/20 p-6 text-center text-sm text-slate-400">
            まだこのタグの投稿はありません。最初の Pulse を落としてみませんか？
          </div>
        )}
      </div>
    </section>
  );
}

type PostCardProps = {
  post: PulsewavePost;
  onReact: (id: string, field: ReactionField) => void;
  onTagClick: (tag: string) => void;
};

function PostCard({ post, onReact, onTagClick }: PostCardProps) {
  const initials = post.author.slice(0, 1).toUpperCase();
  const hueB = (post.avatarHue + 35) % 360;
  const accent = `linear-gradient(135deg, hsl(${post.avatarHue} 80% 60%), hsl(${hueB} 90% 70%))`;

  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-start gap-4">
        <div
          aria-hidden
          className="flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-semibold text-slate-900"
          style={{ backgroundImage: accent }}
        >
          {initials}
        </div>
        <div className="flex-1 space-y-3">
          <header className="flex flex-wrap items-baseline gap-2">
            <div>
              <p className="text-base font-semibold text-white">{post.author}</p>
              <p className="text-sm text-slate-400">{post.handle}</p>
            </div>
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs text-slate-400">{relativeTimeFromNow(post.createdAt)}</span>
          </header>
          <p className="whitespace-pre-line text-base text-slate-100">{post.content}</p>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <button
                key={tag}
                type="button"
                onClick={() => onTagClick(tag)}
                className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-cyan-200 transition hover:bg-cyan-400/10"
              >
                #{tag}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-slate-300">
            <ReactionButton
              label="Boost"
              value={post.boosts}
              onClick={() => onReact(post.id, "boosts")}
              icon={
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M5 11L9 7L11 9L15 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  <path d="M11 5H15V9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              }
            />
            <ReactionButton
              label="Like"
              value={post.likes}
              onClick={() => onReact(post.id, "likes")}
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 20.5L10.55 19.17C5.4 14.36 2 11.28 2 7.5C2 4.42 4.42 2 7.5 2C9.24 2 10.91 2.81 12 4.08C13.09 2.81 14.76 2 16.5 2C19.58 2 22 4.42 22 7.5C22 11.28 18.6 14.36 13.45 19.18L12 20.5Z"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              }
            />
            <ReactionButton
              label="Reply"
              value={post.replies}
              onClick={() => onReact(post.id, "replies")}
              icon={
                <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                  <path d="M4 9H8L6 13H8L4 17V11H2L4 9Z" fill="currentColor" />
                  <path d="M10 4H18V14H12L8 18V4H10Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                </svg>
              }
            />
          </div>
        </div>
      </div>
    </article>
  );
}

type ReactionButtonProps = {
  label: string;
  value: number;
  icon: ReactNode;
  onClick: () => void;
};

function ReactionButton({ label, value, icon, onClick }: ReactionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-cyan-300/60"
    >
      <span className="text-cyan-200">{icon}</span>
      {label}
      <span className="text-white">{value}</span>
    </button>
  );
}

type TrendsProps = {
  topics: TrendingTopic[];
  activeTag: string | null;
  onSelect: (tag: string | null) => void;
  isLoading: boolean;
};

function Trends({ topics, activeTag, onSelect, isLoading }: TrendsProps) {
  return (
    <section className="glass-panel space-y-5 p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Trending rooms</h3>
        {activeTag && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-slate-400 underline underline-offset-4"
          >
            全て表示
          </button>
        )}
      </div>
      <ul className="space-y-4">
        {isLoading && <LoadingSkeletonList compact />}
        {!isLoading &&
          topics.map((topic) => (
            <li
              key={topic.tag}
              className={`rounded-2xl border px-4 py-3 transition ${
                activeTag === topic.tag
                  ? "border-cyan-400/70 bg-cyan-400/10"
                  : "border-white/10 bg-white/5 hover:border-cyan-200/40"
              }`}
            >
              <button
                type="button"
                className="flex w-full items-center justify-between text-left"
                onClick={() => onSelect(activeTag === topic.tag ? null : topic.tag)}
              >
                <div>
                  <p className="text-sm font-semibold text-white">#{topic.tag}</p>
                  <p className="text-xs text-slate-400">
                    {topic.count} posts · momentum +{topic.momentum}%
                  </p>
                </div>
                <span className="pill text-xs text-slate-200">
                  {topic.momentum > 50 ? "🔥 hot" : "↗︎ rising"}
                </span>
              </button>
            </li>
          ))}
        {!isLoading && !topics.length && (
          <li className="rounded-2xl border border-dashed border-white/20 px-4 py-3 text-center text-sm text-slate-400">
            まだタグがありません。最初の投稿で作ってみましょう。
          </li>
        )}
      </ul>
    </section>
  );
}

function InsightPanel({ insights }: { insights: Insight[] }) {
  return (
    <section className="glass-panel space-y-5 p-6">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Insights</p>
        <h3 className="text-lg font-semibold text-white">Community vitals</h3>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {insights.map((insight) => (
          <div key={insight.label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <p className="text-xs text-slate-400">{insight.label}</p>
            <p className="text-2xl font-semibold text-white">{insight.value}</p>
            <p className="text-xs text-slate-500">{insight.meta}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function UserBadge({
  user,
  variant = "panel",
}: {
  user: UserIdentity;
  variant?: "panel" | "toolbar";
}) {
  const initials = user.name.slice(0, 1).toUpperCase();
  return (
    <div
      className={`flex items-center gap-3 ${
        variant === "toolbar" ? "text-sm" : "text-base"
      }`}
    >
      {user.image ? (
        <Image
          src={user.image}
          alt={`${user.name} avatar`}
          width={40}
          height={40}
          className="h-10 w-10 rounded-full border border-white/20 object-cover"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold text-white">
          {initials}
        </div>
      )}
      <div>
        <p className="font-semibold text-white">{user.name}</p>
        <p className="text-xs text-slate-400">{user.handle}</p>
      </div>
    </div>
  );
}

function SignInButtons({
  compact = false,
  providers,
}: {
  compact?: boolean;
  providers: Record<string, boolean>;
}) {
  const baseClass =
    "rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:border-cyan-300/60 disabled:cursor-not-allowed disabled:border-white/10 disabled:text-slate-500";
  const githubEnabled = providers.github ?? false;
  const googleEnabled = providers.google ?? false;
  return (
    <div className={`flex flex-wrap gap-2 ${compact ? "text-xs" : "text-sm"}`}>
      <button
        type="button"
        onClick={() => signIn("github", { callbackUrl: "/" })}
        className={baseClass}
        disabled={!githubEnabled}
      >
        {githubEnabled ? "GitHubでログイン" : "GitHub未設定"}
      </button>
      <button
        type="button"
        onClick={() => signIn("google", { callbackUrl: "/" })}
        className={baseClass}
        disabled={!googleEnabled}
      >
        {googleEnabled ? "Googleでログイン" : "Google未設定"}
      </button>
    </div>
  );
}

function DataStatusBanner({
  isFallback,
  error,
}: {
  isFallback: boolean;
  error?: string;
}) {
  if (!isFallback && !error) return null;
  return (
    <div className="glass-panel border-yellow-300/30 bg-yellow-300/5 px-6 py-4 text-sm text-yellow-100">
      {error ? error : "現在はシードデータを表示しています。Supabase を接続するとリアルタイム投稿に切り替わります。"}
    </div>
  );
}

function LoadingSkeletonList({ compact = false }: { compact?: boolean }) {
  const items = compact ? 2 : 3;
  return (
    <div className="space-y-4">
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="animate-pulse rounded-2xl border border-white/5 bg-white/5 p-4">
          <div className="mb-3 h-4 w-1/3 rounded bg-white/10" />
          <div className="mb-2 h-3 w-full rounded bg-white/10" />
          <div className="mb-2 h-3 w-5/6 rounded bg-white/10" />
          <div className="h-3 w-1/2 rounded bg-white/10" />
        </div>
      ))}
    </div>
  );
}
