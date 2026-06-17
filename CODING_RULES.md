# Coding Rules

Use these rules to save tokens and keep the project maintainable.

## Before Editing

- Read `PROJECT_CONTEXT.md` first.
- Check `git status --short --branch`.
- Prefer small, targeted changes over broad rewrites.

## Frontend

- Keep `src/main.jsx` as the entry point only.
- Put reusable UI in `src/components/`.
- Put frontend API calls in `src/api/`.
- Keep the result order: PDFs, research plan/advice, references.
- UI should stay minimal: one main column, restrained colors, no marketing landing page.

## Backend

- Keep Netlify Functions in modern default-export style.
- Use structured scholarly APIs before webpage scraping.
- Add bounded timeouts to external requests.
- Keep URL availability checks lightweight: HEAD first, partial GET only when needed, and skip only clear 523 / origin-unreachable signals.
- Return compact JSON: papers, plan, actions, researchAdvice, summary.

## Verification

- Run `npm run build` after code changes.
- For UI changes, verify desktop and mobile width when possible.
- Before pushing, make sure `git status` only contains intended files.
