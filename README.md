# Arcade Room

A collection of accessible, audio-first games, most of them built on top of
[syngen](https://github.com/nicross/syngen) — a procedural audio synthesis
engine for the web by [nicross](https://github.com/nicross).

Served at **play.oriolgomez.com** (and play.gomsen.com).

## The launcher

`index.html` is a static launcher: it reads `games.json` and renders every game
grouped by category, in English or Spanish. It needs no server-side rendering —
the Caddy `templates` / `listFiles()` directive it used to depend on is gone.

### Interaction

Both popups are the **same widget**: a `<ul role="listbox">` of
`<li role="option">`. Options are never links, buttons or anything focusable —
the role forbids it — so activation is by handler and `aria-selected` is set
**only** on the active option, never `"false"` on the rest (which some screen
readers read out as "not selected" on every row).

- **Search — editable combobox.** `role="combobox"` +
  `aria-autocomplete="list"` + `aria-controls` over the listbox, with
  `aria-activedescendant` on the input so DOM focus never leaves it. Type to
  filter across both languages, accent-insensitively. Down/Up walk and wrap,
  Home/End jump, Enter opens the highlighted game — or the only match, if
  there is exactly one. Escape collapses; a second Escape empties the box.
  Down on an empty box lists the whole collection. When nothing matches, the
  popup **collapses** and the "no games match" message renders outside the
  listbox — a listbox may only own options.
- **Categories — a disclosure button per category.**
  `<button aria-haspopup="listbox" aria-expanded aria-controls>` revealing the
  same listbox. Focus moves onto the listbox itself (`tabindex="-1"`), which
  carries `aria-activedescendant`; options stay unfocusable. Enter/Space or
  click toggles; Down opens on the first option, Up on the last; Up/Down walk
  and wrap; Home/End jump; a letter is type-ahead; Enter or Space opens the
  highlighted game; Escape closes and returns focus to the button. Tabbing out
  or clicking away closes it. Left/Right travel the row of buttons as an extra
  on top of Tab — there is **no roving tabindex**, so every button stays
  reachable by Tab alone. The last option in each list jumps to that
  category's section in the page and parks focus on its heading.
- **Language — a select combobox.** A native `<select>`, which is the
  `combobox` role done right: arrow keys and type-ahead come free, and on
  mobile it opens the platform picker. It is never re-created on change, so
  focus survives the re-render.

Deliberately absent: `menu`, `menuitem` and `menubar` roles. Those are for
application commands, not site navigation. A test asserts they never appear.

`/` from anywhere outside a text field or an open listbox focuses the search
box.

Also: skip link, labelled landmarks, `aria-describedby` blurbs kept outside
link text so a links list reads as clean names, a polite live region for
result counts, the active option marked by outline as well as colour, and
`prefers-reduced-motion` / `prefers-contrast` support.

Language is remembered in `localStorage["play.lang"]` and settable with
`?lang=es`.

### Touch

On narrow screens and coarse pointers both popups become in-flow blocks
instead of floating overlays — a touch screen reader swipes straight into the
results rather than hunting for a layer, and nothing hides behind the
on-screen keyboard. The category buttons stack full width, rows grow to 48px,
and the card grid drops to one column.

### Adding a game

1. Put the game folder in this directory, with its entry point at
   `<game>/public/index.html`. Caddy maps `/<folder>/` to `<folder>/public/`.
2. Add an entry to the `games` array in `games.json`:

   ```json
   {
     "id": "my_game",
     "path": "/my_game/",
     "category": "arcade",
     "name":        { "en": "My Game",        "es": "Mi Juego" },
     "description": { "en": "One-line blurb.", "es": "Una línea." }
   }
   ```

   `id` must match the folder name. Both languages are required for `name` and
   `description`. `category` must be one of the ids in the `categories` array —
   add a new category there if none fit. Set `"hidden": true` to keep an entry
   but drop it from the listing.

3. Validate:

   ```sh
   pnpm run games:check
   ```

   It fails on a missing folder, a game folder nobody listed, a bad category, a
   duplicate id, or missing English/Spanish text.

No build step — `games.json` is served as-is and revalidates on every load.

## Dependencies: one shared tree

Every game is a package in a single **pnpm workspace** (`pnpm-workspace.yaml`),
so the ~40 identical copies of gulp + syngen resolve to one on-disk set in
`node_modules/.pnpm`. Each game's `node_modules/` is just symlinks into it.
This took the checkout from 3.7 GB to well under 1 GB.

```sh
pnpm install                              # install/refresh the whole workspace
pnpm run build:all                        # gulp build in every game
pnpm --filter asteroids exec gulp build   # build one game
pnpm --filter asteroids exec gulp watch   # rebuild on change
```

`--filter` takes the **package name** from that game's `package.json`, which is
not always the folder name (e.g. folder `circulocos` is package `vault`). Or
just `cd` into the game and run `pnpx gulp build`.

Most games depend on `syngen` via `link:/home/syngen`, so a local syngen change
is picked up by every game at once. `curb` deliberately uses the published
`syngen` from npm instead.

Games are still independent otherwise — each keeps its own `Gulpfile.js`,
`CLAUDE.md`, `src/` and built `public/` bundle.

## Desktop builds

The repo root is also the Electron shell:

```sh
pnpm start        # run the collection in Electron
pnpm run package  # package it
```
