import { defineConfig } from 'vocs/config'

export default defineConfig({
  title: 'opensesh docs',
  description:
    'Documentation for opensesh — the open program OS for conferences. Call for papers, review, agenda, speakers, and embeds, self-hosted on Cloudflare Workers.',
  baseUrl: 'https://docs.opensesh.io',
  accentColor: '#1d6b4c',
  srcDir: 'docs',
  renderStrategy: 'full-static',
  topNav: [
    { text: 'Guides', link: '/guides/call-for-papers' },
    { text: 'API', link: '/api' },
    { text: 'app.opensesh.io', link: 'https://app.opensesh.io' },
  ],
  sidebar: [
    {
      text: 'Overview',
      items: [
        { text: 'What is opensesh?', link: '/' },
        { text: 'Getting started', link: '/getting-started' },
        { text: 'Deployment', link: '/deployment' },
      ],
    },
    {
      text: 'Guides',
      items: [
        { text: 'Call for Papers', link: '/guides/call-for-papers' },
        { text: 'Submissions & review desk', link: '/guides/submissions' },
        { text: 'Evaluation', link: '/guides/evaluation' },
        { text: 'Sessions & content', link: '/guides/sessions' },
        { text: 'Speakers & speaker CRM', link: '/guides/speakers' },
        { text: 'Speaker portal', link: '/guides/speaker-portal' },
        { text: 'Agenda', link: '/guides/agenda' },
        { text: 'Widgets & embeds', link: '/guides/widgets' },
        { text: 'Email', link: '/guides/email' },
        { text: 'Integrations', link: '/guides/integrations' },
        { text: 'Workspace & roles', link: '/guides/workspace' },
      ],
    },
    {
      text: 'API reference',
      items: [
        { text: 'Overview', link: '/api' },
        { text: 'Organization', link: '/api/organization' },
        { text: 'Events', link: '/api/events' },
        { text: 'Submissions', link: '/api/submissions' },
        { text: 'Speakers', link: '/api/speakers' },
        { text: 'Reviews', link: '/api/reviews' },
        { text: 'Agenda', link: '/api/agenda' },
        { text: 'CRM', link: '/api/crm' },
        { text: 'Pipeline', link: '/api/pipeline' },
        { text: 'Widgets', link: '/api/widgets' },
        { text: 'Mail', link: '/api/mail' },
        { text: 'Integrations', link: '/api/integrations' },
      ],
    },
  ],
})
