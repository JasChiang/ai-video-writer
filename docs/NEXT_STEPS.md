# Next Steps

## Frontend
- Split `ArticleGenerator` into focused subcomponents (reference inputs, Notion panel, template selector, results view).
- Split `ChannelDashboard` into data hooks + chart panels to reduce re-render cost.
- Lazy-load heavy visual modules (`AnalysisMarkdown`, Mermaid/Chart.js) with `React.lazy`.
- Add a shared `client/api` wrapper to centralize fetch + error handling.

## Backend
- Move shared logic in `routes/videoProcessing.js` into helper modules (upload, prompt assembly, JSON parsing).
- Add request schema validation middleware (zod/joi) across routes.
- Add structured logging with request ID/task ID.

## Type Safety
- Normalize numeric fields in `types.ts` (e.g. `viewCount`, `likeCount`) to `number`.
- Introduce shared DTOs for API responses to avoid implicit shapes.

## Performance & Reliability
- Add caching for expensive analytics calls with TTL.
- Add retry/backoff for external API calls and consistent timeout handling.
- Add integration tests for critical routes (download/analyze/generate).

## Dev Experience
- Document required env vars in `docs/SETUP.md`.
- Add a `dev:clean` script for temp folder cleanup.
- Consider CI checks for `lint` + `build`.
