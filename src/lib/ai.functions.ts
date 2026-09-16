import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type GeneratedCard = { front: string; back: string };
export type GeneratedSet = {
  title: string;
  subject: string;
  description: string;
  summary: string[];
  cards: GeneratedCard[];
};

const GenerateInput = z.object({
  mode: z.enum(["topic", "text", "file"]),
  topic: z.string().optional(),
  text: z.string().optional(),
  fileData: z.string().optional(), // base64 (no data: prefix)
  fileType: z.string().optional(),
  fileName: z.string().optional(),
});

const SYSTEM = `You are yLearn, an expert study coach for middle and high school students.
You turn source material into a clean, accurate study set.
Rules:
- Write 10 to 20 flashcards. Front = a short term or question. Back = a clear, complete explanation in 1-3 sentences a 14 year old understands.
- Never invent facts that contradict the source. If the source is a topic name, use well-established curriculum knowledge.
- For vocabulary sets, front = the foreign word (with article/gender when relevant), back = the translation plus a short usage note.
- Write 3 to 5 summary bullets capturing the big ideas.
- subject must be one of: Biology, Chemistry, Physics, Mathematics, History, Geography, Languages, Literature, Computer Science, Economics, General.
- Answer in the language of the source material (vocabulary definitions stay in the student's language).
Return JSON only.`;

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("No JSON found");
  return JSON.parse(raw.slice(start, end + 1));
}

function normalizeSet(value: unknown): GeneratedSet {
  const parsed = z
    .object({
      title: z.string(),
      subject: z.string(),
      description: z.string(),
      summary: z.array(z.string()),
      cards: z.array(z.object({ front: z.string(), back: z.string() })),
    })
    .parse(value);

  return {
    title: parsed.title.slice(0, 120),
    subject: parsed.subject.slice(0, 40),
    description: parsed.description.slice(0, 300),
    summary: parsed.summary.slice(0, 6),
    cards: parsed.cards.filter((c) => c.front.trim() && c.back.trim()).slice(0, 24),
  };
}

export const generateStudySet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => GenerateInput.parse(input))
  .handler(async ({ data }): Promise<GeneratedSet> => {
    const { createLovableAiGatewayProvider, requireLovableApiKey, CHAT_MODEL } = await import(
      "./ai-gateway.server"
    );
    const { streamText } = await import("ai");

    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());

    const instruction = `Produce a JSON object shaped exactly like:
{"title": string, "subject": string, "description": string, "summary": string[], "cards": [{"front": string, "back": string}]}`;

    let content: Array<Record<string, unknown>>;
    if (data.mode === "file") {
      if (!data.fileData || !data.fileType) throw new Error("No file received.");
      content = [
        {
          type: "text",
          text: `Create a study set from this uploaded material${
            data.fileName ? ` (${data.fileName})` : ""
          }. Read all visible text, including handwriting. ${instruction}`,
        },
        data.fileType.startsWith("image/")
          ? { type: "image", image: data.fileData, mediaType: data.fileType }
          : { type: "file", data: data.fileData, mediaType: data.fileType },
      ];
    } else if (data.mode === "text") {
      const text = (data.text ?? "").trim();
      if (text.length < 20) throw new Error("Please paste a bit more text to work with.");
      content = [
        {
          type: "text",
          text: `Create a study set from these notes:\n\n"""${text.slice(0, 20000)}"""\n\n${instruction}`,
        },
      ];
    } else {
      const topic = (data.topic ?? "").trim();
      if (!topic) throw new Error("Please enter a topic.");
      content = [
        {
          type: "text",
          text: `Create a study set for this topic: "${topic}".\n\n${instruction}`,
        },
      ];
    }

    const result = streamText({
      model: gateway(CHAT_MODEL),
      system: SYSTEM,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      messages: [{ role: "user", content: content as any }],
    });

    const text = await result.text;
    return normalizeSet(extractJson(text));
  });

export type QuizQuestion = {
  type: "mcq" | "blank";
  prompt: string;
  options: string[];
  answer: string;
};

export const generateQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string(),
        cards: z.array(z.object({ front: z.string(), back: z.string() })).min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<QuizQuestion[]> => {
    const { createLovableAiGatewayProvider, requireLovableApiKey, CHAT_MODEL } = await import(
      "./ai-gateway.server"
    );
    const { streamText } = await import("ai");
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());

    const cards = data.cards.slice(0, 20);
    const result = streamText({
      model: gateway(CHAT_MODEL),
      system: `You write quizzes for middle and high school students. Mix multiple-choice and fill-in-the-blank questions.
- For "mcq": 4 plausible options, exactly one correct, "answer" must match one option exactly.
- For "blank": the prompt contains a "____" gap, "options" is an empty array, "answer" is one or two words.
Return JSON only.`,
      prompt: `Set: "${data.title}"
Cards:
${cards.map((c, i) => `${i + 1}. ${c.front} => ${c.back}`).join("\n")}

Write ${Math.min(10, Math.max(5, cards.length))} questions covering different cards.
Return {"questions": [{"type": "mcq"|"blank", "prompt": string, "options": string[], "answer": string}]}`,
    });

    const text = await result.text;
    const parsed = z
      .object({
        questions: z.array(
          z.object({
            type: z.enum(["mcq", "blank"]),
            prompt: z.string(),
            options: z.array(z.string()).default([]),
            answer: z.string(),
          }),
        ),
      })
      .parse(extractJson(text));

    return parsed.questions
      .filter((q) => (q.type === "mcq" ? q.options.includes(q.answer) : true))
      .slice(0, 12);
  });

export const askTutor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        setTitle: z.string(),
        cardFront: z.string().optional(),
        cardBack: z.string().optional(),
        messages: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .min(1)
          .max(30),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<string> => {
    const { createLovableAiGatewayProvider, requireLovableApiKey, CHAT_MODEL } = await import(
      "./ai-gateway.server"
    );
    const { streamText } = await import("ai");
    const gateway = createLovableAiGatewayProvider(requireLovableApiKey());

    const context = data.cardFront
      ? `The student is currently looking at this card from the set "${data.setTitle}":
Front: ${data.cardFront}
Back: ${data.cardBack ?? ""}`
      : `The student is studying the set "${data.setTitle}".`;

    const result = streamText({
      model: gateway(CHAT_MODEL),
      system: `You are the yLearn tutor: warm, encouraging and extremely clear.
Explain things to a 13-17 year old. Keep answers under 130 words, use plain language, a concrete example or analogy, and short markdown-free sentences. Never make up facts.
${context}`,
      messages: data.messages,
    });

    return await result.text;
  });
