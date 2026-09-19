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

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://ycloud.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/2773029a-e1b1-4251-9d12-5f1cf23ad499).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
