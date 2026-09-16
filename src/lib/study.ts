import { supabase } from "@/integrations/supabase/client";

export type Rating = "easy" | "medium" | "hard";

const STEPS: Record<Rating, (prev: number) => number> = {
  hard: () => 1,
  medium: (prev) => Math.max(2, Math.round(prev * 1.6)),
  easy: (prev) => Math.max(3, Math.round(prev * 2.5)),
};

export async function recordReview(params: {
  userId: string;
  setId: string;
  cardId: string;
  rating: Rating;
}) {
  const { data: existing } = await supabase
    .from("card_reviews")
    .select("interval_days, repetitions")
    .eq("user_id", params.userId)
    .eq("card_id", params.cardId)
    .maybeSingle();

  const prevInterval = existing?.interval_days ?? 1;
  const intervalDays = STEPS[params.rating](prevInterval);
  const dueAt = new Date(Date.now() + intervalDays * 86400000).toISOString();

  await supabase.from("card_reviews").upsert(
    {
      user_id: params.userId,
      card_id: params.cardId,
      set_id: params.setId,
      rating: params.rating,
      interval_days: intervalDays,
      repetitions: (existing?.repetitions ?? 0) + 1,
      due_at: dueAt,
      reviewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,card_id" },
  );

  const today = new Date().toISOString().slice(0, 10);
  const { data: day } = await supabase
    .from("study_days")
    .select("cards_studied")
    .eq("user_id", params.userId)
    .eq("day", today)
    .maybeSingle();

  await supabase.from("study_days").upsert(
    {
      user_id: params.userId,
      day: today,
      cards_studied: (day?.cards_studied ?? 0) + 1,
    },
    { onConflict: "user_id,day" },
  );
}

export function streakFromDays(days: string[]): number {
  const set = new Set(days);
  let streak = 0;
  const cursor = new Date();
  // Allow the streak to stand if today hasn't been studied yet but yesterday was.
  if (!set.has(cursor.toISOString().slice(0, 10))) {
    cursor.setDate(cursor.getDate() - 1);
    if (!set.has(cursor.toISOString().slice(0, 10))) return 0;
  }
  while (set.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
