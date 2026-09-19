import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Bookmark, Flame, Layers, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { streakFromDays } from "@/lib/study";
import { SiteHeader } from "@/components/SiteHeader";
import { SetCard, type SetSummary } from "@/components/SetCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "My library — yLearn" },
      {
        name: "description",
        content: "Your AI-generated study sets, saved community sets, cards learned and streak.",
      },
      { property: "og:title", content: "My library — yLearn" },
      { property: "og:description", content: "Track your study sets, cards learned and streak." },
    ],
  }),
  component: Dashboard,
});

type DashboardData = {
  displayName: string;
  mine: SetSummary[];
  saved: SetSummary[];
  cardsLearned: number;
  streak: number;
};

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user!;
      const select = "id, title, subject, description, author_name, visibility, cards(count)";

      const [profile, mine, saved, reviews, days] = await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("study_sets")
          .select(select)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("saved_sets")
          .select(`set_id, study_sets(${select})`)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase.from("card_reviews").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("study_days").select("day").eq("user_id", user.id),
      ]);

      const shape = (row: Record<string, unknown>): SetSummary => ({
        ...(row as unknown as SetSummary),
        cardCount: (row["cards"] as unknown as { count: number }[])?.[0]?.count ?? 0,
      });

      return {
        displayName: profile.data?.display_name ?? "Student",
        mine: (mine.data ?? []).map(shape),
        saved: (saved.data ?? [])
          .map((r) => r.study_sets as unknown as Record<string, unknown> | null)
          .filter(Boolean)
          .map((r) => shape(r as Record<string, unknown>)),
        cardsLearned: reviews.count ?? 0,
        streak: streakFromDays((days.data ?? []).map((d) => String(d.day))),
      };
    },
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold sm:text-4xl">
              {data ? `Hey ${data.displayName}` : "My library"}
            </h1>
            <p className="mt-2 text-muted-foreground">Everything you've made and saved.</p>
          </div>
          <Button asChild size="lg">
            <Link to="/create">
              <Plus className="h-4 w-4" /> New set
            </Link>
          </Button>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Layers} label="Sets created" value={data?.mine.length} />
          <Stat icon={Bookmark} label="Saved sets" value={data?.saved.length} />
          <Stat icon={BookOpen} label="Cards learned" value={data?.cardsLearned} />
          <Stat icon={Flame} label="Day streak" value={data?.streak} accent />
        </div>

        <Tabs defaultValue="mine" className="mt-10">
          <TabsList>
            <TabsTrigger value="mine">My sets</TabsTrigger>
            <TabsTrigger value="saved">Saved</TabsTrigger>
          </TabsList>

          <TabsContent value="mine" className="mt-6">
            <Grid
              loading={isLoading}
              sets={data?.mine ?? []}
              empty="No sets yet. Generate your first one — it takes seconds."
            />
          </TabsContent>
          <TabsContent value="saved" className="mt-6">
            <Grid
              loading={isLoading}
              sets={data?.saved ?? []}
              empty="Nothing saved yet. Find something good on Explore."
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Grid({
  loading,
  sets,
  empty,
}: {
  loading: boolean;
  sets: SetSummary[];
  empty: string;
}) {
  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-44 rounded-2xl" />
        ))}
      </div>
    );
  }
  if (sets.length === 0) {
    return <p className="py-12 text-center text-muted-foreground">{empty}</p>;
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sets.map((s) => (
        <SetCard key={s.id} set={s} />
      ))}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Flame;
  label: string;
  value: number | undefined;
  accent?: boolean | undefined;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <Icon className={`h-4 w-4 ${accent ? "text-accent" : "text-primary"}`} />
      <p className="mt-2 text-2xl font-bold">{value ?? "—"}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
