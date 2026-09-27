# Ambuj Jaiswal — Portfolio

My portfolio, built as a macOS Tahoe desktop that runs in the browser. Open apps, poke around the Terminal, or ask Siri about me.

Built with React, TypeScript, Zustand, UnoCSS, Framer Motion and Vite. Deployed on Vercel.

## Development

```bash
pnpm install
pnpm dev        # dev server (also serves api/ locally)
pnpm build      # typecheck + production build → dist/
pnpm optimize   # re-encode images added to public/
```

Siri needs a Groq API key. Copy `.env.example` to `.env` and set `GROQ_API_KEY` (server-side only — it is never sent to the browser). On Vercel, set the same variable under Project → Settings → Environment Variables.

## Editing content

Everything personal lives in [`src/data/profile.ts`](src/data/profile.ts): bio, education, projects, skills, certifications and links. Every app reads from it.

- Project screenshots: put them in `public/img/projects/` and list the paths in the project's `screenshots` array.
- Profile photo: set `avatar` in `profile.ts`.
- Résumé: replace `public/resume.pdf`.

## Contact

[ambujjais1@gmail.com](mailto:ambujjais1@gmail.com) · [GitHub](https://github.com/iambuzzz) · [LinkedIn](https://www.linkedin.com/in/ambuj-jaiswal-68385a290)
