"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, Trash2, Loader2, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import {
  useAiMemory, useAiChat, useClearAiMemory,
  type AiContextType, type AiMessage,
} from "@/hooks/useAiChat";

// ── Markdown-lite renderer ────────────────────────────────────────────────────
function renderContent(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code class=\"px-1 py-0.5 rounded bg-muted text-xs font-mono\">$1</code>")
    .replace(/\n/g, "<br/>");
}

// ── Message bubble ────────────────────────────────────────────────────────────
function MessageBubble({ msg }: { msg: AiMessage }) {
  const isUser = msg.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2.5", isUser && "flex-row-reverse")}
    >
      <div className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
        isUser
          ? "bg-primary text-primary-foreground"
          : "bg-violet-500/20 text-violet-400 border border-violet-500/30",
      )}>
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>
      <div className={cn(
        "max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
        isUser
          ? "bg-primary text-primary-foreground rounded-tr-sm"
          : "bg-muted/60 text-foreground border border-border/50 rounded-tl-sm",
      )}>
        <span
          dangerouslySetInnerHTML={{ __html: renderContent(msg.content) }}
          className="[&_strong]:font-semibold [&_code]:inline"
        />
        <p className={cn(
          "mt-1 text-[10px]",
          isUser ? "text-primary-foreground/60 text-right" : "text-muted-foreground",
        )}>
          {new Date(msg.createdAt).toLocaleTimeString("en-AE", {
            hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Dubai",
          })}
        </p>
      </div>
    </motion.div>
  );
}

// ── Suggestions per context ───────────────────────────────────────────────────
const SUGGESTIONS: Record<AiContextType, string[]> = {
  lead:   ["Summarize this lead", "Draft a follow-up message", "What should I do next?"],
  team:   ["How is my team performing?", "Who are the top performers?", "How can I improve conversions?"],
  report: ["What are the key trends?", "Who is the best performer?", "How can we improve bookings?"],
};

const TITLES: Record<AiContextType, string> = {
  lead:   "AI Sales Assistant",
  team:   "AI Team Assistant",
  report: "AI Analytics Assistant",
};

function EmptyState({ contextType, onSuggest }: { contextType: AiContextType; onSuggest: (s: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/10 border border-violet-500/20">
        <Sparkles className="h-5 w-5 text-violet-400" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{TITLES[contextType]}</p>
        <p className="text-xs text-muted-foreground max-w-[230px]">
          {contextType === "lead" && "Ask about this lead — get suggestions, draft messages, or request a summary."}
          {contextType === "team" && "Ask about your team performance, member stats, or get coaching advice."}
          {contextType === "report" && "Ask about your sales data, trends, rankings, or get strategic insights."}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 mt-1">
        {SUGGESTIONS[contextType].map((s) => (
          <button
            key={s}
            onClick={() => onSuggest(s)}
            className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────
interface AiChatPanelProps {
  contextType: AiContextType;
  contextId: string;
  title?: string;
}

export function AiChatPanel({ contextType, contextId, title }: AiChatPanelProps) {
  const [input, setInput]         = useState("");
  const [clearOpen, setClearOpen] = useState(false);
  const bottomRef                 = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useAiMemory(contextType, contextId);
  const chatMut  = useAiChat(contextType, contextId);
  const clearMut = useClearAiMemory(contextType, contextId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatMut.isPending]);

  const send = (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chatMut.isPending) return;
    setInput("");
    chatMut.mutate(msg);
  };

  return (
    <Card className="border-border/50 flex flex-col">
      <CardHeader className="pb-3 px-4 pt-4 shrink-0">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-400" />
            {title ?? TITLES[contextType]}
            {messages.length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-500/15 px-1.5 text-[10px] font-bold text-violet-400">
                {messages.length}
              </span>
            )}
          </span>
          {messages.length > 0 && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-red-400"
              title="Clear conversation"
              onClick={() => setClearOpen(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col px-4 pb-4 gap-3 min-h-0">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[400px] min-h-[120px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <EmptyState contextType={contextType} onSuggest={(s) => send(s)} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, i) => <MessageBubble key={i} msg={msg} />)}
            </AnimatePresence>
          )}

          {/* Typing indicator */}
          {chatMut.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-2.5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-500/20 text-violet-400 border border-violet-500/30">
                <Bot className="h-3.5 w-3.5" />
              </div>
              <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-muted/60 border border-border/50 px-3.5 py-2.5">
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                  />
                ))}
              </div>
            </motion.div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2 items-end shrink-0">
          <Textarea
            placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={2}
            className="text-sm resize-none min-h-[60px] flex-1"
            disabled={chatMut.isPending}
          />
          <Button
            size="icon"
            className="h-[60px] w-10 shrink-0 bg-violet-600 hover:bg-violet-500"
            onClick={() => send()}
            disabled={!input.trim() || chatMut.isPending}
          >
            {chatMut.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </CardContent>

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              The AI will lose all memory of this conversation. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => clearMut.mutate(undefined, { onSuccess: () => setClearOpen(false) })}
            >
              Clear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
