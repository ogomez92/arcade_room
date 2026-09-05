#!/usr/bin/env node
// Validates games.json against what is actually on disk.
//
//   pnpm run games:check
//
// Catches the three things that go wrong when adding a game:
//   1. an entry whose folder (or public/index.html) is missing
//   2. a game folder on disk that nobody listed
//   3. a malformed entry — bad category, duplicate id, missing en/es text

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const LANGS = ['en', 'es']

// Directories that live here but are not games.
const NOT_GAMES = new Set(['node_modules', 'electron', 'tools', 'dist', '.git'])

const problems = []
const warnings = []
const fail = (m) => problems.push(m)
const warn = (m) => warnings.push(m)

let data
try {
  data = JSON.parse(fs.readFileSync(path.join(ROOT, 'games.json'), 'utf8'))
} catch (err) {
  console.error(`games.json could not be read: ${err.message}`)
  process.exit(1)
}

for (const key of ['site', 'languages', 'categories', 'games']) {
  if (!data[key]) fail(`games.json is missing the top-level "${key}" key`)
}
if (problems.length) {
  problems.forEach((p) => console.error(`  ✗ ${p}`))
  process.exit(1)
}

const bilingual = (obj, where) => {
  for (const l of LANGS) {
    if (!obj || typeof obj[l] !== 'string' || !obj[l].trim()) {
      fail(`${where} has no ${l.toUpperCase()} text`)
    }
  }
}

bilingual(data.site.title, 'site.title')
bilingual(data.site.tagline, 'site.tagline')

const categoryIds = new Set()
for (const cat of data.categories) {
  if (!cat.id) fail('a category has no id')
  if (categoryIds.has(cat.id)) fail(`duplicate category id "${cat.id}"`)
  categoryIds.add(cat.id)
  bilingual(cat.name, `category "${cat.id}" name`)
}

const listed = new Set()
for (const game of data.games) {
  const where = `game "${game.id || '(no id)'}"`

  if (!game.id) { fail('a game entry has no id'); continue }
  if (listed.has(game.id)) fail(`duplicate game id "${game.id}"`)
  listed.add(game.id)

  if (!categoryIds.has(game.category)) {
    fail(`${where} is in unknown category "${game.category}"`)
  }
  bilingual(game.name, `${where} name`)
  bilingual(game.description, `${where} description`)

  const expectedPath = `/${game.id}/`
  if (game.path !== expectedPath) {
    warn(`${where} has path "${game.path}" (expected "${expectedPath}")`)
  }

  const dir = path.join(ROOT, game.id)
  if (!fs.existsSync(dir)) {
    fail(`${where} has no folder at ${dir}`)
  } else if (!fs.existsSync(path.join(dir, 'public', 'index.html'))) {
    fail(`${where} has no public/index.html — it will 404`)
  }
}

// Anything on disk that looks like a game but is not listed.
for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name.startsWith('.')) continue
  if (NOT_GAMES.has(entry.name)) continue
  if (listed.has(entry.name)) continue
  if (fs.existsSync(path.join(ROOT, entry.name, 'public', 'index.html'))) {
    fail(`"${entry.name}/" looks like a game but has no entry in games.json`)
  }
}

const counts = data.categories.map(
  (c) => `${c.id}: ${data.games.filter((g) => g.category === c.id && !g.hidden).length}`
)

for (const w of warnings) console.warn(`  ! ${w}`)

if (problems.length) {
  console.error(`\ngames.json — ${problems.length} problem(s):`)
  problems.forEach((p) => console.error(`  ✗ ${p}`))
  process.exit(1)
}

console.log(`games.json OK — ${data.games.length} games`)
console.log(`  ${counts.join('  ')}`)
