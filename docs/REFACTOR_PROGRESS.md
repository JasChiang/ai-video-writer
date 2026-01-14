# Refactor Progress

## Completed
- Split `server.js` into route modules under `routes/` and extracted video-processing routes into `routes/videoProcessing.js`.
- Added client/server service separation: frontend services moved to `services/client/`, backend services/prompts/providers moved to `services/server/`.
- Extracted types/constants/utilities from large components into `components/*/` subfolders and `utils/`.

## In Progress
- Further modularization of large UI components (e.g. `ArticleGenerator`, `ChannelDashboard`, `AnalysisMarkdown`) into subcomponents/hooks.
- Type consistency cleanup (e.g. `YouTubeVideo` numeric fields vs strings).

## Next Steps
1. Verify and fix any remaining import paths after service relocation (search for old `services/` paths).
2. Split `ArticleGenerator` into subcomponents: Notion panel, template selector, reference inputs, generation results.
3. Split `ChannelDashboard` into hooks/components: data fetch hook, chart panels, KPI cards.
4. Split `AnalysisMarkdown` chart/mermaid rendering into child components + helpers.
5. Align type definitions and normalize numeric fields (`viewCount`, `likeCount`, etc.) to a consistent type.

## Files Added/Updated (Key)
- `routes/videoProcessing.js`
- `services/client/*`
- `services/server/*`
- `components/channel-dashboard/types.ts`
- `components/channel-dashboard/constants.ts`
- `components/article-generator/types.ts`
- `components/article-generator/templateOptions.ts`
- `components/analysis-markdown/types.ts`
- `components/analysis-markdown/constants.ts`
- `utils/serverBaseUrl.ts`
- `hooks/useViewport.ts`
