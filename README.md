# 🍊 Puzzle Juicer

**Candy-coated chess puzzles.** A static, zero-build web game that serves ~12,000 hand-sampled
[Lichess puzzles](https://database.lichess.org/#puzzles) wrapped in an absurd amount of juice:
shattering captures, screen shake, hit-stop, confetti cannons, synthesized sound that climbs a
pentatonic scale with your combo, a generative music loop, a mascot with feelings, and a
Candy-Crush-style adventure map.

Everything runs in the browser. No server, no build step, no dependencies to install.

## Modes
| Mode | What it is |
|---|---|
| 🗺️ **Adventure** | 195 levels across 13 themed worlds (Mate Meadow → Grandmaster Galaxy). 3 ❤️ per level, 3 ⭐ for flawless solves, a boss every 5th level. |
| ⚡ **Rush** | 3 minutes. Combo bonuses add time, mistakes cost 10 s. Difficulty ramps as you go. |
| ❤️ **Survival** | Three hearts. Puzzles get harder until you run out. |
| ☀️ **Daily** | Today's real Lichess daily puzzle (falls back to a bundled one offline). Daily streak. |
| 🎯 **Training** | Rated, adaptive, filterable by theme (forks, pins, back-rank mates, endgames…). |
| 🧠 **Review** | Re-try every puzzle you missed until you solve it cleanly. |

Plus: XP & levels, 38 trophies, unlockable boards and piece sets, stats with a rating graph,
shareable puzzle links (`#p=<lichess id>`), keyboard shortcuts (`H` hint, `F` flip, `M` music),
installable PWA with offline play, save export/import, and accessibility switches
(reduce motion, effects level, haptics, volume sliders).

## Run locally
```bash
node tools/serve.mjs        # http://localhost:8123
```
(Any static file server works; ES modules just need http(s), not `file://`.)

## Deploy to GitHub Pages
1. Push this folder to a GitHub repo (branch `main`).
2. **Settings → Pages → Build and deployment → Source: GitHub Actions.**
3. The included workflow (`.github/workflows/pages.yml`) validates the puzzle bundle and publishes the site.

All asset paths are relative, so it works from `https://<user>.github.io/<repo>/`.

## How it works
- `js/board.js` – DOM board with spring-follow drag, click-to-move, arcing slides, squash & stretch,
  shattering captures (the captured piece's own artwork is cut into shards), castling / en passant / promotion.
- `js/fx.js` – canvas particle engine, screen shake (trauma model), hit-stop, slow-mo, popups.
- `js/audio.js` – every sound is synthesized with WebAudio; the music is generated live.
- `js/session.js` – pure puzzle logic, including Lichess's rule that *any* checkmate is a valid solution.
- `js/pieces.js` – recolors the cburnett SVG pieces into glossy gradient colorways at runtime.
- `js/play.js` + `js/modes.js` – the play screen and the game modes (hook objects).

## Refreshing the puzzle bundle
```bash
curl -O https://database.lichess.org/lichess_db_puzzle.csv.zst
zstd -d lichess_db_puzzle.csv.zst
node tools/build-puzzles.mjs lichess_db_puzzle.csv    # stratified, seeded sample → data/puzzles.json
node tools/validate-puzzles.mjs                       # every puzzle loads and solves
node tools/test-session.mjs                           # solves all of them through the game logic
```
Tune `QUOTA`/`QUOTA_MULT` in `tools/build-puzzles.mjs` for a bigger or smaller bundle, and bump
`VERSION` in `sw.js` so installed copies pick up the new data.

## Credits & licenses
- Puzzle data: [Lichess puzzle database](https://database.lichess.org/#puzzles), **CC0**. Not affiliated with Lichess.
- Piece artwork: *cburnett* by Colin M.L. Burnett (CC BY-SA 3.0 / GPLv2+) via [lila](https://github.com/lichess-org/lila).
- Rules engine: [chess.js](https://github.com/jhlywa/chess.js) (BSD-2-Clause).
- Font: [Fredoka](https://fonts.google.com/specimen/Fredoka) (SIL OFL).
- Everything else (code, mascot, sounds, music): this project.
