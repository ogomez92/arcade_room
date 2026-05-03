// Bundle the multi-game Electron app for the current platform.
// Run with `npm run package`.
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

// Per-game directories whose runtime needs are entirely under ./public/.
// Anything else (src/, docs/, assets/, node_modules/, Gulpfile.js, etc.)
// is build-time only and stripped from the bundle.
const GAME_DIRS = [
  'bumper',
  'combat',
  'neverStop',
  'pacman',
  'pinball',
  'pong',
  'racing',
  'roadsplat',
  'tennis',
  'vfb',
  'whack',
]

// `ignore` runs against POSIX-style paths relative to the project root,
// each starting with `/`. Anything matching a regex is dropped from the
// bundle.
const ignorePatterns = [
  /^\/\.git(\/|$)/,
  /^\/\.gitignore$/,
  /^\/\.github(\/|$)/,
  /^\/\.claude(\/|$)/,
  /^\/dist(\/|$)/,
  /^\/template(\/|$)/,            // never ship the empty starter
  /^\/![^/]*(\/|$)/,              // hidden games (directories prefixed with !)
  /^\/README\.md$/,
  /^\/index\.html$/,              // Caddy-templated launcher (web-only)
]

for (const g of GAME_DIRS) {
  // Inside each game, everything outside public/ is build-time noise.
  ignorePatterns.push(new RegExp(`^/${g}/(src|docs|assets|node_modules|electron)(/|$)`))
  ignorePatterns.push(new RegExp(`^/${g}/(Gulpfile\\.js|package\\.json|package-lock\\.json|CLAUDE\\.md|README\\.md|LICENSE|\\.gitignore)$`))
}

// Skip noise inside any other nested node_modules.
ignorePatterns.push(/\/node_modules\/.*\/(test|tests|docs|man|example|examples)(\/|$)/)

;(async () => {
  // @electron/packager v20 is ESM-only.
  const {packager} = await import('@electron/packager')

  const platforms = [process.platform]
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'

  const out = await packager({
    dir: ROOT,
    out: path.join(ROOT, 'dist'),
    name: 'oriolgomez-games',
    asar: true,
    overwrite: true,
    platform: platforms,
    arch,
    icon: path.join(__dirname, 'icon', 'icon'),
    ignore: (p) => ignorePatterns.some((re) => re.test(p)),
  })

  console.log('Bundled to:')
  for (const p of out) console.log('  ' + p)
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
