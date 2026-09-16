import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Camera, Loader2, Sparkle, Type, Upload, Wand2 } from "lucide-react";
import { generateStudySet, type GeneratedSet } from "@/lib/ai.functions";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/create")({
  head: () => ({
    meta: [
      { title: "Generate a study set — yLearn" },
      {
        name: "description",
        content: "Turn a topic, your notes or a photo of a textbook page into flashcards with AI.",
      },
      { property: "og:title", content: "Generate a study set — yLearn" },
      { property: "og:description", content: "AI-made flashcards from anything you feed it." },
    ],
  }),
  component: CreatePage,
});

const EXAMPLES = ["French Unit 3 Vocab", "Human Digestive System", "Causes of World War I"];

function CreatePage() {
  const navigate = useNavigate();
  const generate = useServerFn(generateStudySet);
  const [topic, setTopic] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<GeneratedSet | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function run(mode: "topic" | "text" | "file") {
    setBusy(true);
    setPreview(null);
    try {
      let payload: Record<string, unknown> = { mode, topic, text };
      if (mode === "file") {
        if (!file) throw new Error("Please choose an image or PDF first.");
        if (file.size > 8 * 1024 * 1024) throw new Error("Please use a file under 8 MB.");
        const base64 = await fileToBase64(file);
        payload = { mode, fileData: base64, fileType: file.type, fileName: file.name };
      }
      const result = await generate({ data: payload });
      setPreview(result);
      toast.success(`${result.cards.length} cards ready`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    setSaving(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const user = auth.user;
      if (!user) throw new Error("Please sign in again.");
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      const { data: set, error } = await supabase
        .from("study_sets")
        .insert({
          user_id: user.id,
          author_name: profile?.display_name ?? user.email?.split("@")[0] ?? "Student",
          title: preview.title,
          subject: preview.subject,
          description: preview.description,
          summary: preview.summary,
          visibility: "public",
        })
        .select("id")
        .single();
      if (error) throw error;

      const { error: cardsError } = await supabase.from("cards").insert(
        preview.cards.map((c, i) => ({
          set_id: set.id,
          front: c.front,
          back: c.back,
          position: i,
        })),
      );
      if (cardsError) throw cardsError;

      toast.success("Saved to your library");
      navigate({ to: "/set/$setId", params: { setId: set.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the set.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold sm:text-4xl">Generate a study set</h1>
        <p className="mt-2 text-muted-foreground">
          yLearn writes every card for you — pick where the material comes from.
        </p>

        <Tabs defaultValue="topic" className="mt-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="topic">
              <Sparkle className="mr-1.5 h-4 w-4" /> Topic
            </TabsTrigger>
            <TabsTrigger value="text">
              <Type className="mr-1.5 h-4 w-4" /> Notes
            </TabsTrigger>
            <TabsTrigger value="file">
              <Camera className="mr-1.5 h-4 w-4" /> Photo / PDF
            </TabsTrigger>
          </TabsList>

          <TabsContent value="topic" className="mt-5 space-y-4">
            <Input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g. Human Digestive System"
              className="h-12 text-base"
            />
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <Badge
                  key={e}
                  variant="secondary"
                  className="cursor-pointer rounded-full px-3 py-1"
                  onClick={() => setTopic(e)}
                >
                  {e}
                </Badge>
              ))}
            </div>
            <Button onClick={() => run("topic")} disabled={busy || !topic.trim()} size="lg">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Generate cards
            </Button>
          </TabsContent>

          <TabsContent value="text" className="mt-5 space-y-4">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={10}
              placeholder="Paste your lesson notes, a summary or an article here..."
            />
            <Button onClick={() => run("text")} disabled={busy || text.trim().length < 20} size="lg">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Generate cards
            </Button>
          </TabsContent>

          <TabsContent value="file" className="mt-5 space-y-4">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center transition-colors hover:border-primary"
            >
              <Upload className="h-6 w-6 text-accent" />
              <span className="font-medium">{file ? file.name : "Choose a photo or PDF"}</span>
              <span className="text-xs text-muted-foreground">
                Textbook page, summary sheet or your own handwriting — max 8 MB
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <Button onClick={() => run("file")} disabled={busy || !file} size="lg">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Read it and generate
            </Button>
          </TabsContent>
        </Tabs>

        {busy && (
          <p className="mt-8 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the material and writing your
            cards. This takes a few seconds.
          </p>
        )}

        {preview && (
          <section className="mt-10 rounded-3xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="secondary" className="rounded-full">
                  {preview.subject}
                </Badge>
                <h2 className="mt-2 text-2xl font-bold">{preview.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{preview.description}</p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={() => setPreview(null)} disabled={saving}>
                  <ArrowLeft className="h-4 w-4" /> Discard
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" />} Save set
                </Button>
              </div>
            </div>

            <ul className="mt-5 space-y-1.5 text-sm text-muted-foreground">
              {preview.summary.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-accent">•</span>
                  {s}
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2">
              {preview.cards.map((c, i) => (
                <div key={i} className="rounded-xl border border-border bg-background/50 p-4">
                  <p className="font-medium">{c.front}</p>
                  <p className="mt-1 text-sm text-muted-foreground">{c.back}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}
