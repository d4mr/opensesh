// deno-fmt-ignore-file
// biome-ignore format: generated types do not need formatting
// prettier-ignore
import type { PathsForPages } from 'waku/router'

// prettier-ignore
type Page =
  | { path: '/api/agenda'; render: 'static' }
  | { path: '/api/crm'; render: 'static' }
  | { path: '/api/events'; render: 'static' }
  | { path: '/api'; render: 'static' }
  | { path: '/api/integrations'; render: 'static' }
  | { path: '/api/mail'; render: 'static' }
  | { path: '/api/organization'; render: 'static' }
  | { path: '/api/pipeline'; render: 'static' }
  | { path: '/api/reviews'; render: 'static' }
  | { path: '/api/speakers'; render: 'static' }
  | { path: '/api/submissions'; render: 'static' }
  | { path: '/api/widgets'; render: 'static' }
  | { path: '/deployment'; render: 'static' }
  | { path: '/getting-started'; render: 'static' }
  | { path: '/guides/agenda'; render: 'static' }
  | { path: '/guides/call-for-papers'; render: 'static' }
  | { path: '/guides/email'; render: 'static' }
  | { path: '/guides/evaluation'; render: 'static' }
  | { path: '/guides/integrations'; render: 'static' }
  | { path: '/guides/sessions'; render: 'static' }
  | { path: '/guides/speaker-portal'; render: 'static' }
  | { path: '/guides/speakers'; render: 'static' }
  | { path: '/guides/submissions'; render: 'static' }
  | { path: '/guides/widgets'; render: 'static' }
  | { path: '/guides/workspace'; render: 'static' }
  | { path: '/'; render: 'static' }

// prettier-ignore
declare module 'waku/router' {
  interface RouteConfig {
    paths: PathsForPages<Page>
  }
  interface CreatePagesConfig {
    pages: Page
  }
}
