import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle, Send, Wand2, X } from "lucide-react";
import { askTutor } from "@/lib/ai.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

export function TutorDrawer({
  setTitle,
  cardFront,
  cardBack,
}: {
  setTitle: string;
  cardFront?: string;
  cardBack?: string;
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askTutor);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next = [...messages, { role: "user" as const, content: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const reply = await ask({
        data: { setTitle, cardFront, cardBack, messages: next.slice(-12) },
      });
      setMessages([...next, { role: "assistant", content: reply }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The tutor is unavailable right now.");
      setMessages(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {!open && (
        <Button
          onClick={() => setOpen(true)}
          size="lg"
          className="fixed bottom-5 right-5 z-40 rounded-full shadow-xl shadow-primary/25"
        >
          <MessageCircle className="h-4 w-4" /> Ask the tutor
        </Button>
      )}

      {open && (
        <div className="fixed inset-x-0 bottom-0 z-50 mx-auto flex h-[70vh] w-full max-w-md flex-col rounded-t-3xl border border-border bg-card shadow-2xl sm:right-5 sm:left-auto sm:mx-0 sm:h-[32rem] sm:rounded-3xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold">yLearn tutor</p>
              <p className="text-xs text-muted-foreground">Ask anything about this card</p>
            </div>
            <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  I can re-explain the card you're on, give an example, or quiz you on it.
                </p>
                <div className="flex flex-wrap gap-2">
                  {["Explain this simpler", "Give me an example", "Why does this matter?"].map(
                    (q) => (
                      <Button key={q} variant="secondary" size="sm" onClick={() => send(q)}>
                        <Wand2 className="h-3.5 w-3.5" /> {q}
                      </Button>
                    ),
                  )}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    {m.content}
                  </p>
                </div>
              ) : (
                <p key={i} className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {m.content}
                </p>
              ),
            )}

            {busy && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking...
              </p>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              placeholder="Ask a follow-up question..."
              className="max-h-28 min-h-10 resize-none"
            />
            <Button type="submit" size="icon" disabled={busy || !input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
}
