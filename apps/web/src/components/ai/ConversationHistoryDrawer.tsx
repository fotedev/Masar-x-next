"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import { X } from "lucide-react";
import { useFocusTrap } from "@/hooks/admin-shell/useFocusTrap";
import { useScrollLock } from "@/hooks/admin-shell/useScrollLock";
import type { Conversation } from "@/types/database";
import { ConversationList, ConversationPanelHeader } from "./ConversationPanel";
import type { ZaneStatus } from "./ZaneAvatar";

/**
 * Narrow-viewport counterpart of the ConversationPanel (spec 051): the same
 * avatar-home header + conversation list inside an end-side drawer — logical
 * `end-0`/`border-s` positioning mirrors it in RTL automatically. Portaled
 * to document.body: a fixed overlay inside a backdrop-blur ancestor would
 * anchor to that ancestor (repo lesson). Follows the admin MobileNav drawer
 * pattern: scroll lock with scrollbar compensation, focus trap with focus
 * restore, Escape, and document-level pointerdown containment dismissal.
 */

interface ConversationHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
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

export function ConversationHistoryDrawer({
  open,
  onClose,
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
}: ConversationHistoryDrawerProps) {
  const t = useTranslations("aiAssistant");
  // Layout direction precedent (ChatContainer): the repo's locales are ar/en.
  const isRTL = useLocale() === "ar";
  const panelRef = useRef<HTMLDivElement>(null!);
  // Keep the portal mounted after the first open so the exit transition
  // plays (admin MobileNav pattern).
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useScrollLock(open);
  useFocusTrap(panelRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Document-level pointerdown + containment check (ChatInput lesson):
  // covers backdrop taps and any outside tap in one handler.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const el = panelRef.current;
      if (el && e.target instanceof Node && el.contains(e.target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, onClose]);

  // Slide from the panel side (end side): LTR end = right → +100%; RTL end
  // = left → −100%.
  const slideVariants: Variants = {
    closed: { x: isRTL ? "-100%" : "100%", transition: { type: "spring", stiffness: 320, damping: 32 } },
    open: { x: "0%", transition: { type: "spring", stiffness: 320, damping: 32 } },
  };

  // Selection and fresh-start both leave the drawer closed again.
  const handleSwitch = useCallback(
    async (id: string) => {
      await onSwitch(id);
      onClose();
    },
    [onSwitch, onClose],
  );
  const handleNewChat = useCallback(async () => {
    onNewChat();
    await refresh();
    onClose();
  }, [onNewChat, refresh, onClose]);

  if (!everOpened || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="lg:hidden fixed inset-0 z-[9999]">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md touch-none overscroll-none"
          />
          <motion.div
            ref={panelRef}
            id="conversation-history-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t("chatHistory")}
            variants={slideVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="fixed inset-y-0 end-0 z-[10000] flex h-[100dvh] w-[min(320px,85vw)] flex-col border-s border-slate-200/80 bg-white shadow-2xl dark:border-slate-800/80 dark:bg-slate-950"
          >
            <ConversationPanelHeader
              status={status}
              onNewChat={isSignedIn ? handleNewChat : undefined}
              trailing={
                <button
                  type="button"
                  onClick={onClose}
                  aria-label={t("close")}
                  title={t("close")}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              }
            />
            <ConversationList
              conversations={conversations}
              activeId={activeId}
              loading={loading}
              hasMore={hasMore}
              loadMore={loadMore}
              onSwitch={handleSwitch}
              onDelete={onDelete}
              isSignedIn={isSignedIn}
            />
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
