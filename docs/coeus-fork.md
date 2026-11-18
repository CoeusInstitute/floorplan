# The Coeus Institute fork

This repository is the Coeus Institute's fork of [haydenschmitty/floorplan](https://github.com/haydenschmitty/floorplan) (MIT). It follows the author's `main` and adds three things. Everything else, including the author's guides in this folder, describes the fork as well.

## What the fork adds

### 1. Hermes as an agent

[Hermes Agent](https://hermes-agent.nousresearch.com/docs) joins Claude Code and Codex.

- A map made in a Hermes session records `hermes` as its agent (`scripts/lib/agent.mjs` recognises `HERMES_AGENT` and `HERMES_SESSION_ID`; `--agent hermes` forces it). Its prompts read "Fix with Hermes", and it writes no notes file into the project.
- The map's Ask bar can answer through Hermes (`assets/serve.mjs`, `--engine hermes`, `--hermes <path>`). Each question is one `hermes chat --format stream-json` run in the codebase; a follow-up resumes that session.

**Hermes is not held to reading by its CLI.** Claude Code runs with read-only tools and Codex in a read-only sandbox. Hermes has no such mode, so its runs are narrowed instead: the file and terminal toolsets only (no web, browser, memory or connected apps), `--ignore-rules` (none of the person's rules, memory or skills), never `--yolo`, and instructions to only read. A question, or text in the codebase it reads, could still lead it to change a file. Use `--engine claude` or `--engine codex` where that matters. Hermes's answers are not held to a schema either, so the Ask bar's **Change** switch for blueprints is not offered with it.

Its runs carry `--source tool`, which keeps them out of the person's Hermes session list.

### 2. The Coeus Institute appearance

Every map is drawn in the Coeus design system: graphite neutrals, brass as the one accent, Geist and Geist Mono, small corners, nothing under 12px, in a dark and a light appearance.

- `skills/floorplan/assets/brand/coeus.css` gives every colour variable the viewer defines a house value.
- `skills/floorplan/scripts/lib/brand.mjs` inlines the fonts, logo and tab icon, and works out the type and shape overrides from the viewer's own styles at build time.
- `skills/floorplan/assets/ui/07-brand.js` sets the tab icon and the logo's name.

The viewer and its styles are not edited. The build adds one sheet to the page head ahead of them, written to outrank them, so the author's changes to the viewer merge without conflict. The map still makes no outside requests.

### 3. The project's own logo

`architecture.json` may name a logo from the mapped codebase:

```json
"project": { "name": "Shop", "logo": "web/public/logo-white.png", "logoLight": "web/public/logo-dark.png" }
```

`logo` is shown on the dark theme and `logoLight` on the light one. With only `logo`, the light theme shows it inverted, which suits a single-colour white mark. The file has to be a PNG inside the codebase, 512 KB at most; anything else is left out, the build says why, and the Coeus mark is shown. Without `logo` the map shows the Coeus mark. The "Made with Floorplan" credit on an exported copy keeps Floorplan's logo.

## Under Hermes

`hermes/` is a Hermes skill: a short layer over `skills/floorplan/SKILL.md` with what differs under Hermes. Link the Hermes skills tree to it, on Windows:

```powershell
New-Item -ItemType Junction -Path "$env:LOCALAPPDATA\hermes\skills\software-development\floorplan" -Target "$env:USERPROFILE\.local\share\floorplan\hermes"
```

## Keeping up with the author

```bash
git fetch upstream && git merge upstream/main && npm test
```

The fork adds files and changes few of the author's lines: a handful in `scripts/build.mjs`, `scripts/lib/agent.mjs`, `scripts/open.mjs`, `assets/serve.mjs`, `assets/viewer.html`, `assets/ui/50-cloud.js` and `tests/supply-chain.test.mjs`. `CHECKSUMS.txt` is the author's release record: it describes the author's files, not the fork's, so `node tools/checksums.mjs --check .` reports the fork's changed and added files.

Tests for the fork: `tests/brand.test.mjs` and `tests/hermes.test.mjs` (stand-in CLI in `tests/fixtures/fake-cli/fake-hermes.mjs`).

## Licences

Floorplan is MIT (see `LICENSE`). Geist and Geist Mono are under the SIL Open Font License 1.1 (`skills/floorplan/assets/brand/fonts/`). The Coeus Institute name and marks in `skills/floorplan/assets/brand/` belong to the Coeus Institute and are not covered by the MIT licence.
