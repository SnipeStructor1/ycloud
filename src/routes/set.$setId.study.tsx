import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, RotateCcw, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { recordReview, type Rating } from "@/lib/study";
import { TutorDrawer } from "@/components/TutorDrawer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/set/$setId/study")({
  head: () => ({
    meta: [
      { title: "Flashcards — yLearn" },
      { name: "description", content: "Flip through the cards and rate how well you knew each one." },
      { property: "og:title", content: "Flashcards — yLearn" },
      { property: "og:description", content: "Study with spaced repetition on yLearn." },
    ],
  }),
  component: StudyPage,
});

function StudyPage() {
  const { setId } = Route.useParams();
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [done, setDone] = useState(false);
  const touchStart = useRef<number | null>(null);

  const { data } = useQuery({
    queryKey: ["study", setId],
    queryFn: async () => {
      const { data: set } = await supabase
        .from("study_sets")
        .select("id, title")
        .eq("id", setId)
        .maybeSingle();
      const { data: cards } = await supabase
        .from("cards")
        .select("id, front, back")
        .eq("set_id", setId)
        .order("position");
      return { set, cards: cards ?? [] };
    },
  });

  const cards = data?.cards ?? [];
  const card = cards[index];

  const next = useCallback(() => {
    setFlipped(false);
    setIndex((i) => {
      if (i + 1 >= cards.length) {
        setDone(true);
        return i;
      }
      return i + 1;
    });
  }, [cards.length]);

  const prev = useCallback(() => {
    setFlipped(false);
    setIndex((i) => Math.max(0, i - 1));
  }, []);

  const rate = useCallback(
    async (rating: Rating) => {
      if (card && user) {
        void recordReview({ userId: user.id, setId, cardId: card.id, rating });
      }
      next();
    },
    [card, user, setId, next],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " ") {
        e.preventDefault();
        setFlipped((f) => !f);
      } else if (e.key === "ArrowRight") next();
      else if (e.key === "ArrowLeft") prev();
      else if (flipped && ["1", "2", "3"].includes(e.key)) {
        void rate((["hard", "medium", "easy"] as Rating[])[Number(e.key) - 1]!);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev, rate, flipped]);

  if (done) {
    return (
      <div className="glow-grid flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <h1 className="text-3xl font-bold">Session complete</h1>
        <p className="mt-2 text-muted-foreground">
          You went through {cards.length} cards. Nice work.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              setIndex(0);
              setDone(false);
              setFlipped(false);
            }}
          >
            <RotateCcw className="h-4 w-4" /> Study again
          </Button>
          <Button asChild variant="secondary">
            <Link to="/set/$setId/quiz" params={{ setId }}>
              Take the quiz
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link to="/set/$setId" params={{ setId }}>
              Back to set
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 px-4 py-4">
        <Button asChild variant="ghost" size="icon" aria-label="Exit">
          <Link to="/set/$setId" params={{ setId }}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="truncate text-sm font-medium">{data?.set?.title ?? "Loading..."}</p>
          <Progress value={cards.length ? ((index + 1) / cards.length) * 100 : 0} className="mt-2 h-1.5" />
        </div>
        <span className="text-sm text-muted-foreground">
          {cards.length ? index + 1 : 0}/{cards.length}
        </span>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-32">
        {card && (
          <div
            className="w-full max-w-2xl"
            onTouchStart={(e) => (touchStart.current = e.touches[0]!.clientX)}
            onTouchEnd={(e) => {
              if (touchStart.current === null) return;
              const dx = e.changedTouches[0]!.clientX - touchStart.current;
              if (dx < -60) next();
              else if (dx > 60) prev();
              touchStart.current = null;
            }}
          >
            <button
              type="button"
              onClick={() => setFlipped((f) => !f)}
              className="flex min-h-[18rem] w-full flex-col items-center justify-center rounded-3xl border border-border bg-card px-6 py-10 text-center transition-transform active:scale-[0.99] sm:min-h-[22rem]"
            >
              {flipped ? (
                <>
                  <span className="text-xs uppercase tracking-widest text-accent">Answer</span>
                  <p className="mt-4 text-xl leading-relaxed sm:text-2xl">{card.back}</p>
                </>
              ) : (
                <>
                  <span className="text-xs uppercase tracking-widest text-muted-foreground">
                    Tap to flip
                  </span>
                  <p className="mt-4 text-2xl font-semibold leading-snug sm:text-3xl">
                    {card.front}
                  </p>
                </>
              )}
            </button>

            <div className="mt-6 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={prev} aria-label="Previous card">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              {flipped ? (
                <div className="flex gap-2">
                  {(
                    [
                      { key: "hard", label: "Hard", cls: "bg-destructive text-destructive-foreground" },
                      { key: "medium", label: "Medium", cls: "bg-warning text-warning-foreground" },
                      { key: "easy", label: "Easy", cls: "bg-success text-success-foreground" },
                    ] as const
                  ).map((b) => (
                    <button
                      key={b.key}
                      onClick={() => rate(b.key)}
                      className={`rounded-full px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 ${b.cls}`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              ) : (
                <Button variant="secondary" onClick={() => setFlipped(true)}>
                  Show answer
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={next} aria-label="Next card">
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>
            <p className="mt-4 hidden text-center text-xs text-muted-foreground sm:block">
              Space flips · arrow keys move · 1 / 2 / 3 rates the card
            </p>
          </div>
        )}
      </main>

      <TutorDrawer
        setTitle={data?.set?.title ?? "this set"}
        {...(card ? { cardFront: card.front, cardBack: card.back } : {})}
      />
    </div>
  );
}
