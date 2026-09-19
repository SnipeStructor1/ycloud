# AI Study Buddy

Build a comprehensive, production-ready web application called "yLearn" tailored for middle and high school students. The focus is strictly on AI-driven study set creation, user accounts, and community sharing.



### 1. Authentication & User System:

- Easy-to-use authentication system (Email/Password & Social Logins).

- User Profile Dashboard: Displays user's created sets, saved community sets, total cards learned, and study streak (days in a row).

- Row-Level Security: Each study set is associated with a specific user account.



2. AI-Only Study Set Generator (No Manual Creation):

- Core Feature: Users CANNOT manually add cards one by one. Creation is 100% AI-powered.

- Multi-Input Parsing:

  - Image/PDF Upload: Scan summary pages, textbook photos, or handwritten notes.

  - Raw Text / Topic Prompt: Users can paste text or simply type a topic (e.g., "French Unit 3 Vocab" or "Human Digestive System").

- Output Processing: The AI automatically extracts key concepts and formats them into structured Flashcards (Front: Question/Term, Back: Detailed Answer/Definition) and short summary bullet points.



3. Privacy & Visibility Settings:

- Default Status: Every newly generated study set is set to "Public" automatically.

- Visibility Toggle: A clear switch on each set allowing the owner to toggle between "Public" and "Private".

- Community Marketplace / Explore Page: A searchable public feed where users can browse, search by subject (e.g., Biology, Languages), and clone/save public sets created by others.



4. Interactive Learning Modes:

- Flashcards Mode: Interactive flip-cards with smooth swipe/keyboard controls. Includes a rating system (Easy, Medium, Hard) powered by a basic Spaced Repetition System (SRS).

- Quiz Mode: AI automatically generates dynamic Multiple-Choice and Fill-in-the-Blank quizzes based on the set.

- AI Tutor Assistant: A persistent chat drawer on learning pages where students can click "Explain this simpler" or ask follow-up questions about any difficult card.



5. UI & UX Requirements:

- Modern, clean Dark-Mode first aesthetic with crisp typography and vibrant accent colors.

- Fully responsive layout optimized for both desktop browsers and mobile screens.

- Pre-populated with realistic mock data (e.g., "Biology: Human Organs", "French Vocabulary") so the

 app is instantly testable.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Architecture

The app runs as one Cloudflare Worker. TanStack Start provides the React
frontend, SSR and server functions; Supabase provides authentication and data;
AI calls stay server-side in `src/lib/ai-gateway.server.ts`.

Important application code is organized as:

- `src/routes`: pages and route guards
- `src/components`: reusable UI
- `src/lib/auth.ts`: login MFA checks and TOTP verification
- `src/integrations/supabase`: the only Supabase client/middleware layer
- `src/lib/*.server.ts`: Worker-only integrations and secrets

There is no Pages deployment in this setup. Pages would split the frontend
from SSR and server functions and make the auth flow harder to reason about.

## Deploy to Cloudflare Workers

This project uses TanStack Start's Cloudflare Workers runtime. Configure the
following production secrets before deploying:

```sh
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_PUBLISHABLE_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put AI_API_KEY
```

The client bundle also needs these public build-time variables:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Set them in the
Cloudflare build environment (or in an untracked `.env.production` file when
deploying locally). They are intentionally public; keep
`SUPABASE_SERVICE_ROLE_KEY` and `AI_API_KEY` server-only. Set `AI_BASE_URL`
and `AI_MODEL` when using an OpenAI-compatible provider other than the defaults.

Then deploy with:

```sh
npm run deploy
```

`wrangler.jsonc` points Cloudflare at the custom `src/server.ts` entrypoint
and enables the Node.js compatibility layer required by the server-side
dependencies. Never commit secret values to the repository.
