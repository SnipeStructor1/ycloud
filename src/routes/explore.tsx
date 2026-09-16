import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { SetCard, type SetSummary } from "@/components/SetCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

const SUBJECTS = [
  "All",
  "Biology",
  "Chemistry",
  "Physics",
  "Mathematics",
  "History",
  "Geography",
  "Languages",
  "Literature",
  "Computer Science",
  "Economics",
  "General",
];

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore study sets — yLearn" },
      {
        name: "description",
        content:
          "Browse and save public flashcard sets from other students: biology, languages, history, chemistry and more.",
      },
      { property: "og:title", content: "Explore study sets — yLearn" },
      {
        property: "og:description",
        content: "Search community flashcard sets by subject and save them to your library.",
      },
    ],
  }),
  component: Explore,
});

function Explore() {
  const [term, setTerm] = useState("");
  const [subject, setSubject] = useState("All");

  const { data, isLoading } = useQuery({
    queryKey: ["explore", term, subject],
    queryFn: async (): Promise<SetSummary[]> => {
      let query = supabase
        .from("study_sets")
        .select("id, title, subject, description, author_name, visibility, cards(count)")
        .eq("visibility", "public")
        .order("created_at", { ascending: false })
        .limit(60);
      if (subject !== "All") query = query.eq("subject", subject);
      if (term.trim()) query = query.ilike("title", `%${term.trim()}%`);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((s) => ({
        ...s,
        cardCount: (s.cards as unknown as { count: number }[])?.[0]?.count ?? 0,
      })) as SetSummary[];
    },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">Explore</h1>
        <p className="mt-2 text-muted-foreground">
          Study sets shared by other students. Save any of them to your library.
        </p>

        <div className="mt-6 flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search by title, e.g. cold war"
              className="pl-9"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {SUBJECTS.map((s) => (
            <Button
              key={s}
              size="sm"
              variant={subject === s ? "default" : "secondary"}
              className="rounded-full"
              onClick={() => setSubject(s)}
            >
              {s}
            </Button>
          ))}
        </div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-44 rounded-2xl" />
              ))
            : (data ?? []).map((set) => <SetCard key={set.id} set={set} />)}
        </div>

        {!isLoading && (data ?? []).length === 0 && (
          <p className="mt-16 text-center text-muted-foreground">
            No sets match that search yet. Try another subject.
          </p>
        )}
      </main>
    </div>
  );
}
