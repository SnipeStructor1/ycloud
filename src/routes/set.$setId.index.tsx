import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Bookmark, Copy, Globe, ListChecks, Lock, Play, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/set/$setId/")({
  head: () => ({
    meta: [
      { title: "Study set — yLearn" },
      {
        name: "description",
        content: "Flashcards, summary and quiz for this yLearn study set.",
      },
      { property: "og:title", content: "Study set — yLearn" },
      { property: "og:description", content: "AI-generated flashcards on yLearn." },
    ],
  }),
  component: SetDetail,
});

export function useSetQuery(setId: string) {
  return useQuery({
    queryKey: ["set", setId],
    queryFn: async () => {
      const { data: set, error } = await supabase
        .from("study_sets")
        .select("*")
        .eq("id", setId)
        .maybeSingle();
      if (error) throw error;
      if (!set) throw new Error("This set is private or no longer exists.");
      const { data: cards, error: cardsError } = await supabase
        .from("cards")
        .select("id, front, back, position")
        .eq("set_id", setId)
        .order("position");
      if (cardsError) throw cardsError;
      return { set, cards: cards ?? [] };
    },
  });
}

function SetDetail() {
  const { setId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useSetQuery(setId);

  const isOwner = !!user && data?.set.user_id === user.id;

  const { data: isSaved } = useQuery({
    queryKey: ["saved", setId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("saved_sets")
        .select("set_id")
        .eq("user_id", user!.id)
        .eq("set_id", setId)
        .maybeSingle();
      return !!data;
    },
  });

  async function toggleVisibility(next: boolean) {
    const { error } = await supabase
      .from("study_sets")
      .update({ visibility: next ? "public" : "private" })
      .eq("id", setId);
    if (error) return toast.error("Could not change visibility.");
    toast.success(next ? "Set is now public" : "Set is now private");
    queryClient.invalidateQueries({ queryKey: ["set", setId] });
  }

  async function toggleSave() {
    if (!user) return navigate({ to: "/auth" });
    if (isSaved) {
      await supabase.from("saved_sets").delete().eq("user_id", user.id).eq("set_id", setId);
      toast.success("Removed from your library");
    } else {
      await supabase.from("saved_sets").insert({ user_id: user.id, set_id: setId });
      toast.success("Saved to your library");
    }
    queryClient.invalidateQueries({ queryKey: ["saved", setId, user.id] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  async function cloneSet() {
    if (!user || !data) return navigate({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();
    const { data: copy, error } = await supabase
      .from("study_sets")
      .insert({
        user_id: user.id,
        author_name: profile?.display_name ?? "Student",
        title: data.set.title,
        subject: data.set.subject,
        description: data.set.description,
        summary: data.set.summary,
        visibility: "public",
        cloned_from: data.set.id,
      })
      .select("id")
      .single();
    if (error || !copy) return toast.error("Could not copy this set.");
    await supabase.from("cards").insert(
      data.cards.map((c, i) => ({ set_id: copy.id, front: c.front, back: c.back, position: i })),
    );
    toast.success("Copied into your library");
    navigate({ to: "/set/$setId", params: { setId: copy.id } });
  }

  async function deleteSet() {
    if (!confirm("Delete this set and all of its cards?")) return;
    const { error } = await supabase.from("study_sets").delete().eq("id", setId);
    if (error) return toast.error("Could not delete this set.");
    toast.success("Set deleted");
    navigate({ to: "/dashboard" });
  }

  if (isLoading) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-4xl space-y-4 px-4 py-10">
          <Skeleton className="h-10 w-2/3" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen">
        <SiteHeader />
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <h1 className="text-2xl font-bold">Set unavailable</h1>
          <p className="mt-2 text-muted-foreground">
            This set is private or has been deleted by its owner.
          </p>
          <Button asChild className="mt-6">
            <Link to="/explore">Back to Explore</Link>
          </Button>
        </div>
      </div>
    );
  }

  const { set, cards } = data;
  const summary = Array.isArray(set.summary) ? (set.summary as string[]) : [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-10">
        <Badge variant="secondary" className="rounded-full">
          {set.subject}
        </Badge>
        <h1 className="mt-3 text-3xl font-bold sm:text-4xl">{set.title}</h1>
        <p className="mt-2 text-muted-foreground">{set.description}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          by {set.author_name} · {cards.length} cards
        </p>

        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg">
            <Link to="/set/$setId/study" params={{ setId }}>
              <Play className="h-4 w-4" /> Study flashcards
            </Link>
          </Button>
          <Button asChild size="lg" variant="secondary">
            <Link to="/set/$setId/quiz" params={{ setId }}>
              <ListChecks className="h-4 w-4" /> Take a quiz
            </Link>
          </Button>
          {!isOwner && (
            <>
              <Button size="lg" variant="secondary" onClick={toggleSave}>
                <Bookmark className="h-4 w-4" /> {isSaved ? "Saved" : "Save"}
              </Button>
              <Button size="lg" variant="ghost" onClick={cloneSet}>
                <Copy className="h-4 w-4" /> Make a copy
              </Button>
            </>
          )}
        </div>

        {isOwner && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              {set.visibility === "public" ? (
                <Globe className="h-5 w-5 text-accent" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <div>
                <Label htmlFor="visibility" className="text-sm font-medium">
                  {set.visibility === "public" ? "Public" : "Private"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {set.visibility === "public"
                    ? "Anyone can find this set on Explore."
                    : "Only you can see this set."}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="visibility"
                checked={set.visibility === "public"}
                onCheckedChange={toggleVisibility}
              />
              <Button variant="ghost" size="icon" onClick={deleteSet} aria-label="Delete set">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>
        )}

        {summary.length > 0 && (
          <section className="mt-8 rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold">Quick summary</h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {summary.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent">•</span>
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-8 space-y-2">
          <h2 className="text-lg font-semibold">All cards</h2>
          {cards.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-border bg-card p-4 sm:flex sm:gap-6"
            >
              <p className="font-medium sm:w-1/3">{c.front}</p>
              <p className="mt-1 text-sm text-muted-foreground sm:mt-0 sm:flex-1">{c.back}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}
