---
name: floorplan
description: Use when mapping a codebase or planning one from a PRD.
version: 1.0.0
author: Hayden Smith (haydenschmitty), Hermes Agent
license: MIT
platforms: [windows, linux, macos]
metadata:
  hermes:
    tags: [codebase-map, architecture, onboarding, visualization, coeus-brand, blueprint]
    related_skills: [archivist, repo-docs-audit, coeus-brand-ui, workstation-canvas]
---

# Floorplan

Draws an interactive map of a codebase (one repo or several side by side) as a single offline page, `floorplan/index.html` in that codebase: every part, file and endpoint with a plain name and one-line description, the connections between them, a health check, screens, guided flows and an Ask bar. It also draws a blueprint from a PRD before any code exists. Every map carries the Coeus Institute appearance and the mapped project's own logo.

Two layers. This file is the Hermes layer: paths, what differs under Hermes, the logo step, the brand layer, updating, pitfalls. The kit manual, `$K/SKILL.md`, is the author's workflow: scan, write `architecture.json`, build, describe, mark recent work, show, report. **Read the kit manual in full with `read_file` before the first map of a session.** Where the two differ, this file wins.

## Layout

- `FP="${USERPROFILE:-$HOME}/.local/share/floorplan"`: a clone of `CoeusInstitute/floorplan`, the Coeus fork of `haydenschmitty/floorplan` (MIT). `K="$FP/skills/floorplan"` is the kit; in the kit manual `${CLAUDE_SKILL_DIR}` means `$K`.
- This skill is the folder `$FP/hermes` (the Hermes skills tree holds a junction to it). Edit it through the clone path and commit.
- Needs Node 18 or newer and nothing else. Scripts take native paths (`C:/...`), not `/c/...`.

## When to Use

- "Draw / make / update a floorplan", "map this codebase", "how does this app fit together", "how does the frontend talk to the backend", onboarding onto an unfamiliar repo.
- A PRD or a description of something not built yet, and the question is what pieces it needs: draw a blueprint (kit manual, "Nothing built yet?").
- A question about a codebase that already has a `floorplan/` folder: look it up in the map first with `terminal(command='node floorplan/query.mjs overview')` (also `find <words>`, `show <id>`, `path <a> <b>`) from the codebase root, then read source.

Don't use for: writing a repo's docs tree (`archivist`), drawn architecture diagrams for a document (`diagram-design`), restyling an app's UI (`coeus-brand-ui`).

## What differs under Hermes

1. **Status first.** The kit manual's "Existing map" line is not filled in here. Run `terminal(command='node "$K/scripts/status.mjs"', workdir=<root>)` and take the root and `--refresh` from the request.
2. **The agent is Hermes.** The scripts recognise a Hermes session, so the map's prompts read "Fix with Hermes" and its Ask bar runs Hermes. Skip everything in the kit manual about `CLAUDE.local.md`, `--claude-md` and publishing to the Claude app; none of it applies. `--agent hermes` forces it when a script runs outside a session.
3. **Where it writes.** Only the `floorplan/` folder in the mapped codebase, which ignores itself in git. A request for a floorplan of a named repo is the request to work in that repo, for that folder only. Never map a repo under `D:\My apps` that the user did not name.
4. **The logo (after `architecture.json`, before the build).** See the next section.
5. **Descriptions on a large codebase.** Over about 150 files, split the worksheets with `delegate_task`: one child per area, each given the codebase root, its worksheet keys, the full path of `$K/references/writing-descriptions.md` to read first, and the rule to edit only its own `floorplan/descriptions/<key>.json` files and keep the keys. Children know nothing else. Rebuild and read `DESCRIPTIONS files X/Y` yourself; a child's "done" is not proof.
6. **Show it.** `terminal(command='FLOORPLAN_NO_PROMPTS=1 node "$K/scripts/open.mjs" "<root>"')` starts the map's server and opens the browser. When the prompt carries a `[workstation-ui: canvas ...]` tag, add `--no-open` and open the printed URL in the canvas (skill `workstation-canvas`). `FLOORPLAN_NO_PROMPTS=1` keeps the upstream author's cloud waitlist card off the map.
7. **Report** as the kit manual says, in the user's style: the URL, the shape of the system in 3 to 5 lines, every high-severity Health item (never a secret's value), which logo the map carries, and what was not checked.

## The project's logo

The top bar shows the mapped project's own logo, taken from its codebase. A wrong logo is worse than none: when unsure, leave it unset and the map shows the Coeus mark.

1. List candidates: `search_files(pattern='*logo*.png', target='files', path=<root>)`, then `*brand*.png` and `*mark*.png` if that finds nothing. Ignore `node_modules`, build output and screenshots.
2. Pick the logo the app shows as its own in its header, side menu or sign-in page: search the UI code for the image (`search_files(pattern='logo', path=<root>, file_glob='*.tsx')`) and take the file it loads there. A partner's, a vendor's or the Coeus corporate mark shown elsewhere is not it. Look with `vision_analyze` when the file names do not settle it, and say in the report which logo the map carries.
3. In `floorplan/architecture.json` set `project.logo` to the light-on-transparent version (for the dark map) and, when the codebase has one, `project.logoLight` to the dark version. Paths are relative to the codebase root. With only `project.logo`, the light theme shows it inverted, which is right for a single-colour white mark and wrong for a coloured one.
4. Build and read the `BRAND` line. `! project.logo ... was left out: <why>` means the Coeus mark was used: the file has to be a PNG inside the codebase and no larger than 512 KB.

## The Coeus appearance

Every build adds one sheet to the page head ahead of the viewer's own styles; the viewer itself is not edited.

- `$K/assets/brand/coeus.css`: the dark-warm and light-warm appearances of the Coeus design system (`coeus-website/design-system/tokens.css`) mapped onto the viewer's variable names. Graphite neutrals, brass as the one accent, status hues for kinds of part and connection, no purple. Change colours here, as `oklch()`.
- `$K/scripts/lib/brand.mjs`: inlines Geist and Geist Mono, the logo and the tab icon, and derives the house type and shape rules from the viewer's styles at build time (nothing under 12px, no weight over 600, corners 4/6/8 in place of pills; fixed-size dots and switches keep their shape).
- `$K/assets/brand/`: the Coeus mark for dark and light, the tab icon, the fonts and their licences.
- After any change: `terminal(command='npm test', workdir=$FP, timeout=600)`, then build a map and look at it in both themes (headless Chrome `--screenshot`, then `vision_analyze`). `tests/brand.test.mjs` fails when the viewer gains a colour variable the sheet does not set, when a pair of text and background falls under 4.5:1, or when a rule under 12px is left without an override.

## The Ask bar

It runs `hermes chat` once per question in the codebase, on the model Hermes is set to use; `--model <name>` on `open.mjs` picks another. Hermes has no read-only sandbox, so unlike the Claude Code and Codex engines this one is not held to reading by its CLI: it gets the file and terminal tools only, none of the user's rules, memory or skills, and instructions to only read. Its runs are tagged `tool`, so they stay out of the session list. Answers are not held to a schema, so a blueprint's **Change** switch is not offered; change a blueprint by editing `plan.json` and `architecture.json` and running `refresh.mjs`.

## Updating from the author

```
terminal(command='git fetch upstream && git merge upstream/main && npm test', workdir=$FP, timeout=900)
```

The fork adds files and touches few upstream lines, so most merges are clean. Lines of the author's that the fork changed: `scripts/build.mjs` (one import, the fonts line, one `brand(...)` line, one report line), `scripts/lib/agent.mjs`, `scripts/open.mjs`, `assets/serve.mjs` (the Hermes engine), `assets/viewer.html` (one agent entry), `assets/ui/50-cloud.js` (one condition), `tests/supply-chain.test.mjs` (`.css` allowed). On a conflict keep both sides' intent, run the tests, rebuild a map and look at it. `CHECKSUMS.txt` is the author's release record and is left as merged. Commit and push `main`; `docs/coeus-fork.md` is the record of what the fork changes.

## Pitfalls

- **Write scripts with `write_file`, not a shell heredoc.** Why: git-bash rewrote backslashes inside heredocs (a `\r?\n` became a real line break and broke a regex in `serve.mjs`; `sed` with `\\` silently matched nothing).
- **`canvas js` does not run on a map.** Why: the page's security policy allows only its own scripts. Use `canvas read`, `canvas look` and `canvas shot` there.
- **A logo is named, never guessed.** Why: several Coeus repos hold partner and customer logos next to their own. The build takes only `project.logo`; it does not search.
- **Add a house value when the viewer gains a colour variable.** Why: a variable the sheet does not set keeps the author's colour, often a purple. The brand test names it.
- **The map's server is one per codebase** on 127.0.0.1:4378 or the next free port, and stops two hours after its last tab closes. Stop it now with `node floorplan/serve.mjs --stop` from the codebase root.
- **Unattended runs** (cron, CI): set `FLOORPLAN_UNATTENDED=1`; nothing is opened and the map names no agent.
- **Do not hand-edit `floorplan/graph.json` or `index.html`.** They are rebuilt every time.

## Verification

- The build ends with `✓ wrote floorplan/index.html`, `DESCRIPTIONS` at 100% for files and routes, a `BRAND` line naming the logo you chose, and `AGENT  Hermes`.
- `open.mjs` prints `ASK  works: questions run through Hermes`.
- The page shows a graphite background, a brass primary button and the right logo in both themes. Check a screenshot; do not infer it from the build output.
