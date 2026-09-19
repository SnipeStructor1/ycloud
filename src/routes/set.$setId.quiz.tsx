import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { generateQuiz, type QuizQuestion } from "@/lib/ai.functions";
import { TutorDrawer } from "@/components/TutorDrawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";

export const Route = createFileRoute("/set/$setId/quiz")({
  head: () => ({
    meta: [
      { title: "Quiz — yLearn" },
      {
        name: "description",
        content: "Test yourself with AI-generated multiple-choice and fill-in-the-blank questions.",
      },
      { property: "og:title", content: "Quiz — yLearn" },
      { property: "og:description", content: "AI quizzes built from your flashcards." },
    ],
  }),
  component: QuizPage,
});

function QuizPage() {
  const { setId } = Route.useParams();
  const makeQuiz = useServerFn(generateQuiz);
  const [questions, setQuestions] = useState<QuizQuestion[] | null>(null);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [loading, setLoading] = useState(true);

  const { data } = useQuery({
    queryKey: ["quiz-source", setId],
    queryFn: async () => {
      const { data: set } = await supabase
        .from("study_sets")
        .select("id, title")
        .eq("id", setId)
        .maybeSingle();
      const { data: cards } = await supabase
        .from("cards")
        .select("front, back")
        .eq("set_id", setId)
        .order("position");
      return { set, cards: cards ?? [] };
    },
  });

  useEffect(() => {
    if (!data?.set || !data.cards.length || questions) return;
    let cancelled = false;
    setLoading(true);
    makeQuiz({ data: { title: data.set.title, cards: data.cards } })
      .then((q) => {
        if (!cancelled) setQuestions(q);
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : "Could not build a quiz right now.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [data, makeQuiz, questions]);

  const question = questions?.[index];

  function check(value: string) {
    if (checked) return;
    setAnswer(value);
    setChecked(true);
    const correct =
      value.trim().toLowerCase() === (question?.answer ?? "").trim().toLowerCase();
    if (correct) setScore((s) => s + 1);
  }

  function nextQuestion() {
    setChecked(false);
    setAnswer("");
    if (!questions || index + 1 >= questions.length) setFinished(true);
    else setIndex((i) => i + 1);
  }

  if (loading || !questions) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
        <p className="text-muted-foreground">Writing your quiz questions...</p>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((score / questions.length) * 100);
    return (
      <div className="glow-grid flex min-h-screen flex-col items-center justify-center px-4 text-center">
        <p className="text-sm uppercase tracking-widest text-muted-foreground">Quiz complete</p>
        <h1 className="mt-3 text-5xl font-bold">{pct}%</h1>
        <p className="mt-2 text-muted-foreground">
          {score} of {questions.length} correct
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button
            onClick={() => {
              setQuestions(null);
              setIndex(0);
              setScore(0);
              setFinished(false);
            }}
          >
            New quiz
          </Button>
          <Button asChild variant="secondary">
            <Link to="/set/$setId/study" params={{ setId }}>
              Review flashcards
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

  const isCorrect =
    checked && answer.trim().toLowerCase() === (question?.answer ?? "").trim().toLowerCase();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-4 px-4 py-4">
        <Button asChild variant="ghost" size="icon" aria-label="Exit">
          <Link to="/set/$setId" params={{ setId }}>
            <X className="h-5 w-5" />
          </Link>
        </Button>
        <div className="flex-1">
          <p className="truncate text-sm font-medium">{data?.set?.title}</p>
          <Progress value={((index + 1) / questions.length) * 100} className="mt-2 h-1.5" />
        </div>
        <span className="text-sm text-muted-foreground">
          {index + 1}/{questions.length}
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 pb-32">
        <h1 className="text-2xl font-semibold leading-snug sm:text-3xl">{question?.prompt}</h1>

        {question?.type === "mcq" ? (
          <div className="space-y-3">
            {question.options.map((opt) => {
              const selected = answer === opt;
              const right = checked && opt === question.answer;
              return (
                <button
                  key={opt}
                  onClick={() => check(opt)}
                  disabled={checked}
                  className={`flex w-full items-center justify-between rounded-2xl border px-5 py-4 text-left transition-colors ${
                    right
                      ? "border-success bg-success/10"
                      : selected
                        ? "border-destructive bg-destructive/10"
                        : "border-border bg-card hover:border-primary/60"
                  }`}
                >
                  <span>{opt}</span>
                  {right && <Check className="h-4 w-4 text-success" />}
                  {selected && !right && <X className="h-4 w-4 text-destructive" />}
                </button>
              );
            })}
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              check(answer);
            }}
            className="flex gap-2"
          >
            <Input
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer"
              disabled={checked}
              className="h-12 text-base"
            />
            {!checked && <Button type="submit">Check</Button>}
          </form>
        )}

        {checked && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className={`font-semibold ${isCorrect ? "text-success" : "text-destructive"}`}>
              {isCorrect ? "Correct" : "Not quite"}
            </p>
            {!isCorrect && (
              <p className="mt-1 text-sm text-muted-foreground">
                Answer: <span className="text-foreground">{question?.answer}</span>
              </p>
            )}
            <Button className="mt-4 w-full sm:w-auto" onClick={nextQuestion}>
              {index + 1 >= questions.length ? "See results" : "Next question"}
            </Button>
          </div>
        )}
      </main>

      <TutorDrawer
        setTitle={data?.set?.title ?? "this set"}
        {...(question ? { cardFront: question.prompt, cardBack: question.answer } : {})}
      />
    </div>
  );
}
