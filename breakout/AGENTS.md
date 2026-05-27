# Repository Guidelines

## Project Structure & Module Organization

This repository is an audio-first Breakout game built on the syngen template. Source code lives in `src/`: game logic and audio are under `src/js/content/`, app screens and UI helpers under `src/js/app/`, and styles under `src/css/`. Static entry files live in `public/`; generated bundles are `public/scripts.min.js` and `public/styles.min.css`. Design notes and task lists are in `docs/`. Assets such as icons live in `assets/`.

## Build, Test, and Development Commands

- `./node_modules/.bin/gulp build`: builds CSS and JS bundles into `public/`.
- `./node_modules/.bin/gulp watch`: rebuilds when `src/**` changes.
- `./node_modules/.bin/gulp serve`: serves `public/` locally, if port permissions allow.
- `node --check src/js/content/audio.js`: syntax-check a single JavaScript file.

There is no automated test suite yet. Always run `gulp build` before handing off changes.

## Coding Style & Naming Conventions

Use plain browser JavaScript with global namespaces: `app`, `content`, and `engine`. Follow existing style: two-space indentation, no semicolons, concise functions, and IIFE-style modules such as `content.audio = (() => { ... })()`. Keep gameplay state in `content.game`; keep screen files thin and focused on input, transitions, and rendering.

## Testing Guidelines

Use syntax checks for edited JS files and a full Gulp build for integration. For audio changes, verify through the Learn Sounds screen and actual gameplay. New audio cues must be reachable via `content.audio.previewLearn(key)` and have localized `learn.*` labels.

## Commit & Pull Request Guidelines

Git history currently has only a root commit, so use clear imperative commit messages, for example `Add learn sounds screen` or `Retune brick impact audio`. Pull requests should describe gameplay/audio changes, list verification commands, and note accessibility effects. Include screenshots only for visible UI changes.

## Agent-Specific Instructions

Accessibility is required. The paddle, active ball, and falling powerups must have continuous position-bearing audio, not only collision sounds. Preserve sub-stepped ball collision and deterministic paddle reflection from impact offset. Avoid cute beeps; use arcade-like synthesized material sounds.
