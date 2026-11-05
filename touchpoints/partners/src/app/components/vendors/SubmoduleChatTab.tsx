import React, { useEffect, useMemo, useRef, useState } from "react";
import { Send, MessageSquare } from "lucide-react";
import { getAvatarTint } from "../../utils/avatarTints";

/**
 * Reusable chat tab for any submodule detail modal (payment terms, pricing
 * rules, shipping methods, etc.). Designed to be the single shared chat
 * surface across the system so we get consistent behaviour and styling.
 *
 * The submodule passes a `threadKey` (typically the record's id) that
 * scopes the conversation. Persistence is mocked via in-component state
 * for now; once the chat backend lands the parent can hand in
 * `messages` + `onSend` props instead.
 */

export interface SubmoduleChatMessage {
  id: string;
  authorName: string;
  authorInitials: string;
  /** ISO timestamp (or pre-formatted display string when seeding mock data). */
  timestamp: string;
  body: string;
  /** Marks this as the current user's message so it renders right-aligned. */
  isMine?: boolean;
}

interface SubmoduleChatTabProps {
  /** Stable identifier for the conversation — usually the record's id. */
  threadKey: string;
  /** Display name shown in the empty state, e.g. "this payment term". */
  contextLabel?: string;
  /** Pre-seeded mock messages used until the chat backend is wired up. */
  initialMessages?: SubmoduleChatMessage[];
  /** Current user's display name and initials, used for new messages. */
  currentUserName?: string;
  currentUserInitials?: string;
}

const DEFAULT_SEED: SubmoduleChatMessage[] = [
  {
    id: "seed-1",
    authorName: "Sarah Johnson",
    authorInitials: "SJ",
    timestamp: "Mar 28, 2026 · 9:14 AM",
    body: "Heads up, the CFO asked us to verify the discount rate before applying this to any new vendors.",
  },
  {
    id: "seed-2",
    authorName: "Michael Torres",
    authorInitials: "MT",
    timestamp: "Mar 28, 2026 · 9:42 AM",
    body: "Already reviewed with finance. We're good to roll it out across Tier 1 vendors.",
  },
];

export function SubmoduleChatTab({
  threadKey,
  contextLabel = "this record",
  initialMessages,
  currentUserName = "You",
  currentUserInitials = "AA",
}: SubmoduleChatTabProps) {
  // Reset to seed when the thread changes (different record opened).
  const seed = useMemo(() => initialMessages ?? DEFAULT_SEED, [initialMessages]);
  const [messages, setMessages] = useState<SubmoduleChatMessage[]>(seed);
  useEffect(() => { setMessages(seed); }, [threadKey, seed]);

  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new message — feels right for a chat surface.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const send = () => {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `local-${Date.now()}`,
        authorName: currentUserName,
        authorInitials: currentUserInitials,
        timestamp: new Date().toLocaleString(undefined, { month: "short", day: "2-digit", year: "numeric", hour: "numeric", minute: "2-digit" }),
        body: trimmed,
        isMine: true,
      },
    ]);
    setDraft("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter sends, Shift+Enter inserts a newline — common chat UX.
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-[#FAFBFC]">
      {/* Message list */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center max-w-[280px]">
              <div className="w-10 h-10 rounded-full bg-white border border-[#E8ECF1] flex items-center justify-center mx-auto mb-3 text-slate-400">
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-[13px] text-slate-700" style={{ fontWeight: 600 }}>Start the conversation</p>
              <p className="text-[12px] text-slate-500 mt-1 leading-relaxed">
                Use chat to discuss {contextLabel} with your team. Conversation history stays attached to this record.
              </p>
            </div>
          </div>
        ) : (
          messages.map((m) => {
            const tint = getAvatarTint(m.authorName);
            return (
              <div key={m.id} className={`flex items-start gap-2.5 ${m.isMine ? "flex-row-reverse" : ""}`}>
                <div
                  className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[10px]"
                  style={{ backgroundColor: tint.bg, color: tint.fg, fontWeight: 700 }}
                >
                  {m.authorInitials}
                </div>
                <div className={`max-w-[75%] ${m.isMine ? "items-end" : "items-start"} flex flex-col`}>
                  <div className={`flex items-center gap-2 mb-1 ${m.isMine ? "flex-row-reverse" : ""}`}>
                    <span className="text-[11px] text-slate-700" style={{ fontWeight: 600 }}>{m.authorName}</span>
                    <span className="text-[10px] text-slate-400">{m.timestamp}</span>
                  </div>
                  <div
                    className={`rounded-xl px-3 py-2 text-[12px] leading-relaxed border ${
                      m.isMine
                        ? "bg-primary/10 border-primary/20 text-foreground"
                        : "bg-white border-[#E8ECF1] text-slate-700"
                    }`}
                  >
                    {m.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Composer */}
      <div className="shrink-0 px-4 sm:px-6 py-3 bg-white border-t border-[#E8ECF1]">
        <div className="flex items-end gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message… (Enter to send, Shift+Enter for new line)"
            rows={2}
            className="flex-1 resize-none rounded-lg border border-[#E8ECF1] bg-white px-3 py-2 text-[13px] text-foreground placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="h-10 px-3.5 rounded-lg bg-primary text-white text-[12px] hover:bg-primary/90 transition-colors cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ fontWeight: 600 }}
          >
            <Send className="w-3.5 h-3.5" /> Send
          </button>
        </div>
      </div>
    </div>
  );
}
