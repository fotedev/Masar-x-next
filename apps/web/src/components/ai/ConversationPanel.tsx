"use client";

import { useCallback, useRef, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Plus, Trash2, Wrench, Zap } from "lucide-react";
import { useRouter } from "@/navigation";
import { confirmToast } from "@/lib/confirmToast";
import { formatConversationUpdatedAt } from "@/lib/conversation-time";
import type { Conversation } from "@/types/database";
import { ZaneAvatar, type ZaneStatus } from "./ZaneAvatar";

/**
 * Zane chat-history side menu (spec 051) — the avatar's permanent home
 * (Muse pattern: circle + name + status in the panel header) and the
 * conversation switcher. Presentational: the page owns useAiChat /
 * useConversations and passes state + actions down (no new store). The
 * header and list are shared with the narrow-viewport drawer.
 */

interface ConversationPanelHeaderProps {
  status: ZaneStatus;
  onNewChat?: () => void;
  /** Extra trailing control (the narrow-viewport drawer's close button). */
  trailing?: ReactNode;
}

export function ConversationPanelHeader({ status, onNewChat, trailing }: ConversationPanelHeaderProps) {
  const t = useTranslations("aiAssistant");
  const statusLabel = status === "working" ? t("statusWorking") : t("statusConnected");

  return (
    <div className="flex shrink-0 items-center gap-2.5 border-b border-slate-200/80 px-3 py-3 dark:border-slate-800/80">
      <ZaneAvatar status={status} className="h-10 w-10 shrink-0" />
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-sm font-extrabold text-slate-900 dark:text-white" dir="auto">
          {t("assistantName")}
        </span>
        <span
          className={`flex items-center gap-1 text-xs leading-tight ${
            status === "working"
              ? "text-slate-500 dark:text-slate-400"
              : "text-green-600 dark:text-green-400"
          }`}
          dir="auto"
        >
          {status === "working" ? (
            <Wrench className="h-3 w-3" aria-hidden="true" />
          ) : (
            <Zap className="h-3 w-3 fill-current" aria-hidden="true" />
          )}
          {statusLabel}
        </span>
      </div>
      {onNewChat && (
        <button
          type="button"
          onClick={onNewChat}
          aria-label={t("newChat")}
          title={t("newChat")}
          className="ms-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200/80 text-slate-500 transition-colors hover:border-cyan-500/40 hover:text-cyan-600 dark:border-slate-700/80 dark:text-slate-300 dark:hover:text-cyan-400"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
        </button>
      )}
      {trailing}
    </div>
  );
}

interface ConversationListProps {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void | Promise<void>;
  onSwitch: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  isSignedIn: boolean;
}

export function ConversationList({
  conversations,
  activeId,
  loading,
  hasMore,
  loadMore,
  onSwitch,
  onDelete,
  isSignedIn,
}: ConversationListProps) {
  const t = useTranslations("aiAssistant");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const router = useRouter();
  const listRef = useRef<HTMLDivElement>(null!);

  // The list owns its own scroller; approaching its end fetches the next
  // page (the transcript scroller and its spec-012 logic stay untouched).
  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el || loading || !hasMore) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 96) void loadMore();
  }, [loading, hasMore, loadMore]);

  // Deletion is destructive — the confirm-toast pattern guards the hook's
  // server delete (labels come from `common` per confirmToast's contract).
  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await confirmToast(t("deleteConversationConfirm"), {
        confirmLabel: tCommon("confirm"),
        cancelLabel: tCommon("cancel"),
      });
      if (!confirmed) return;
      await onDelete(id);
    },
    [t, tCommon, onDelete],
  );

  // Guests have no server-backed history (spec 049): the whole hint is the
  // sign-in affordance (the localized text doubles as the login button,
  // NewsClient's pattern).
  if (!isSignedIn) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center"
        data-testid="conversation-list-guest"
      >
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="text-sm text-slate-500 underline-offset-2 transition-colors hover:text-cyan-600 hover:underline dark:text-slate-400 dark:hover:text-cyan-400"
        >
          {t("signInToSeeHistory")}
        </button>
      </div>
    );
  }

  if (loading && conversations.length === 0) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-3"
        aria-busy="true"
        data-testid="conversation-list-loading"
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-12 w-full animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60"
          />
        ))}
        <span className="sr-only">{t("loadingConversations")}</span>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-4 py-6 text-center"
        data-testid="conversation-list-empty"
      >
        <p className="text-sm text-slate-500 dark:text-slate-400">{t("noConversations")}</p>
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      data-testid="conversation-list"
      className="min-h-0 flex-1 overflow-y-auto px-2 py-2"
    >
      <ul className="flex flex-col gap-1">
        {conversations.map((conv) => {
          const isActive = conv.id === activeId;
          return (
            <li key={conv.id}>
              <div
                className={`group flex w-full items-center gap-1 rounded-xl px-2.5 py-2 transition-colors ${
                  isActive
                    ? "bg-cyan-500/10 text-cyan-700 ring-1 ring-cyan-500/30 dark:bg-cyan-400/10 dark:text-cyan-300"
                    : "text-slate-700 hover:bg-slate-200/60 dark:text-slate-200 dark:hover:bg-slate-800/60"
                }`}
              >
                <button
                  type="button"
                  onClick={() => void onSwitch(conv.id)}
                  aria-current={isActive ? "true" : undefined}
                  className="flex min-w-0 flex-1 flex-col items-start text-start"
                >
                  <span className="w-full truncate text-sm font-semibold" dir="auto">
                    {conv.title || t("noTitle")}
                  </span>
                  <span className="text-xs text-slate-400 dark:text-slate-500" dir="ltr">
                    {formatConversationUpdatedAt(conv.updated_at, locale)}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(conv.id)}
                  aria-label={t("deleteConversation")}
                  title={t("deleteConversation")}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 opacity-0 transition-opacity hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100 dark:text-slate-500"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ConversationPanelProps {
  conversations: Conversation[];
  activeId: string | null;
  loading: boolean;
  hasMore: boolean;
  loadMore: () => void | Promise<void>;
  refresh: () => void | Promise<void>;
  onSwitch: (id: string) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  onNewChat: () => void;
  status: ZaneStatus;
  isSignedIn: boolean;
}

export function ConversationPanel({
  conversations,
  activeId,
  loading,
  hasMore,
  loadMore,
  refresh,
  onSwitch,
  onDelete,
  onNewChat,
  status,
  isSignedIn,
}: ConversationPanelProps) {
  const t = useTranslations("aiAssistant");
  // After a fresh start, one re-query surfaces any conversation a dropped
  // in-flight reply materialized server-side (spec D3).
  const handleNewChat = useCallback(async () => {
    onNewChat();
    await refresh();
  }, [onNewChat, refresh]);

  return (
    <aside
      aria-label={t("chatHistory")}
      data-testid="conversation-panel"
      className="hidden shrink-0 flex-col border-s border-slate-200/80 bg-slate-50/80 dark:border-slate-800/80 dark:bg-slate-900/60 lg:flex lg:w-72"
    >
      <ConversationPanelHeader status={status} onNewChat={handleNewChat} />
      <ConversationList
        conversations={conversations}
        activeId={activeId}
        loading={loading}
        hasMore={hasMore}
        loadMore={loadMore}
        onSwitch={onSwitch}
        onDelete={onDelete}
        isSignedIn={isSignedIn}
      />
    </aside>
  );
}
