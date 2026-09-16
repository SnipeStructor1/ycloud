import { Link } from "@tanstack/react-router";
import { Layers, Lock, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type SetSummary = {
  id: string;
  title: string;
  subject: string;
  description: string | null;
  author_name: string;
  visibility: string;
  cardCount?: number;
};

export function SetCard({ set }: { set: SetSummary }) {
  return (
    <Link
      to="/set/$setId"
      params={{ setId: set.id }}
      className="group flex h-full flex-col rounded-2xl border border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10"
    >
      <div className="flex items-center justify-between gap-2">
        <Badge variant="secondary" className="rounded-full">
          {set.subject}
        </Badge>
        {set.visibility === "private" ? (
          <Lock className="h-4 w-4 text-muted-foreground" />
        ) : (
          <Globe className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
        {set.title}
      </h3>
      {set.description && (
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{set.description}</p>
      )}
      <div className="mt-4 flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>by {set.author_name}</span>
        {typeof set.cardCount === "number" && (
          <span className="inline-flex items-center gap-1">
            <Layers className="h-3.5 w-3.5" /> {set.cardCount} cards
          </span>
        )}
      </div>
    </Link>
  );
}
