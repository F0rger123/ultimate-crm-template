import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Stamp the commit this build came from into index.html
// (<meta name="build-sha">). Cloudflare Pages sets CF_PAGES_COMMIT_SHA at
// build time. Lets anyone check that a
// change is really live: `curl -s https://<your-app>/ | grep build-sha`.
const buildSha = () => ({
  name: 'build-sha',
  transformIndexHtml(html: string) {
    const sha = process.env.CF_PAGES_COMMIT_SHA || 'local'
    return html.replace('</head>', `  <meta name="build-sha" content="${sha}" />\n  </head>`)
  },
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildSha()],
})
