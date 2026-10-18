# Very Simple Bingo

A tiny bingo ball caller (a "bolillero") for game night with friends. It draws numbers at random, announces each one out loud, and keeps a board of the numbers that came out.

It is made for phones first. No build step and no dependencies: plain HTML, CSS and JavaScript.

## Features

- Big "Sacar bolilla" button pinned to the bottom of the screen, within thumb reach.
- Draws balls from 1–90 (default) or 1–75, with no repeats.
- **↩ Deshacer** puts the last ball back in the drum after a mis-tap. It asks first.
- **¡Línea!** and **¡Bingo!**: when a player shouts, tap one. Auto mode pauses, the voice says it and a fanfare plays, so the host can check the card against the board.
- Sound effects: a knock for each number during the roll, and a fanfare for a line or a bingo. They are made in the browser with Web Audio (no audio files) and follow **Voz** on/off.
- Auto mode (**▶ Auto**): draws a ball after each callout ends, until you tap **Pausar**. **Ritmo** sets the pause before the next ball: Tranqui (2 s), Normal (1.2 s) or Rápido (0.6 s), in `AUTO_PACES` in `app.js`. Auto mode pauses when the screen locks, when the voice does not start, when a card wins and when all balls are out.
- Voice picker (**Voz**): the device's Spanish voices, the natural ones first, then the funny ones (on iPhone and Mac: Grandpa, Rocko, Flo…). **Estilo** changes the pitch and the speed: Normal, Ardilla, Monstruo or Apurado (`VOICE_STYLES` in `app.js`). A change plays a short sample only when nothing is being said, so it never cuts off a number.
- Sayings (**Dichos**): a joke right after each number, by voice and on screen, such as "8, ¡el culo te abrocho!". Edit them in `SAYINGS` and `RHYMES` in `app.js`.
- Card sets (**Cartones**): pick the set of printed cards you play with, and the app shows and says which cards (number and color) have a line or a bingo after each ball. Auto mode pauses when a card wins. See [Card sets](#card-sets).
- Announces each number by voice in Spanish: the number, a short pause, then its digits ("47" … "cuatro, siete"). It uses the browser's Web Speech API. Both parts are queued together, because phones clip the start of speech that follows a silence.
- Shows a board with every number that came out, plus the last five balls.
- Keeps the game after a page reload (saved in the browser's `localStorage`).
- Keeps open tabs in sync, so a second tab never repeats a ball.
- Keeps the screen on during a game, where the browser supports it.
- Works offline after the first visit, and installs to the Home Screen with its own icon.
- Shows a hint when the voice does not start (for example, silent mode on an iPhone).
- Press <kbd>Space</kbd> to draw a ball (or to pause auto mode).

The interface text is in Spanish (Argentina).

## Files

| File                   | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `index.html`           | Page markup and meta tags.                                              |
| `styles.css`           | All styles. Phone layout first, two columns from 900 px wide.           |
| `app.js`               | Game logic, voice, wake lock, tab sync and service worker registration. |
| `analytics.js`         | Google Analytics: off until `GA_MEASUREMENT_ID` is set.                 |
| `sw.js`                | Service worker: network first, with the cache as the offline fallback.  |
| `manifest.webmanifest` | Home Screen app name, colors and icons.                                 |
| `cards.json`           | Card sets: the numbers on each printed bingo card.                      |
| `icons/`               | `icon.svg` (source and favicon) and the PNG sizes made from it.         |
| `.nojekyll`            | Tells GitHub Pages to serve the files as they are, without Jekyll.      |
| `CNAME`                | The custom domain of the GitHub Pages site (`bingo.gtfunes.com`).       |

## Card sets

`cards.json` holds sets of real, printed bingo cards. The cards are transcribed from photos, not read on the device. A set is useful only to people who play with the same printed cards. When the file has no sets, the **Cartones** picker and the card results stay hidden.

The file has one set today: **Chino**, 24 cards from 1 to 90, printed in three colors (violeta, naranja, azul). Its cards are irregular: rows have 3 to 7 numbers, and card 16 naranja has 45 twice. The file keeps them exactly as printed.

```json
{
  "sets": [
    {
      "id": "chino",
      "name": "Chino",
      "max": 90,
      "colors": { "violeta": "#8e3fa8", "naranja": "#f0642c", "azul": "#2b93d6" },
      "cards": [
        { "id": "17", "color": "violeta", "rows": [[7, 88, 56, 75], [14, 36, 48, 59, 61, 82], [3, 25, 32, 63, 85]] }
      ]
    }
  ]
}
```

- `id` of a set: a short name that does not change. The app saves it to remember the picked set.
- `name`: the text in the **Cartones** picker.
- `max` (optional): the ball range the cards were printed for, `90` or `75`. Picking the set switches **Bolillas** to it and locks it. If balls are already out, the app asks first, because the change starts a new game.
- `colors` (optional): for a set printed in several colors, each color name with the hex color of its dot on screen.
- `id` of a card: the number printed on the card, as text and without leading zeros, so the voice says "cinco" and not "cero cinco".
- `color` of a card (optional): one of the names in `colors`. The app then names the card with it: "¡Línea en el cartón 17 violeta!".
- `rows`: the numbers of each row, from left to right. A line is one full row. A bingo is every number on the card.

To add a set, take clear photos of the cards (the serial number must be readable) and ask Claude to transcribe them into `cards.json`. Check a few cards against the photos before game night.

## Run locally

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

- The service worker (offline support) is off on `localhost`, so it never caches other local dev servers. To test it, open <http://bingo.localhost:5173> instead.
- The security `<meta>` tags in `index.html` apply on the local server too.

## Deploy

The live site is <https://bingo.gtfunes.com>, served by GitHub Pages from the `main` branch. There is no build step: each push to `main` publishes the site in about a minute.

The setup, done once:

1. **Settings → Pages**: source **Deploy from a branch**, branch `main`, folder `/ (root)`.
2. Custom domain `bingo.gtfunes.com`. GitHub keeps it in the `CNAME` file, so do not delete that file.
3. At the DNS provider of `gtfunes.com`: a `CNAME` record with the name `bingo` and the value `gtfunes.github.io`.
4. When GitHub has issued the certificate, turn on **Enforce HTTPS** in **Settings → Pages**.
5. Verify `gtfunes.com` in your profile **Settings → Pages**, so no other GitHub account can use the domain.

- Pages serves every tracked file, so `README.md` and `LICENSE` also get public URLs. There is nothing secret in the repository.
- Pages caches each file for 10 minutes (`max-age=600`), so a phone can show the old version for up to 10 minutes after a deploy.
- `https://gtfunes.github.io/very-simple-bingo/` redirects to the custom domain.
- Saved games and Home Screen installs belong to one address. After a move to a new domain, players must add the app to the Home Screen again.

## Analytics

Google Analytics 4 is wired in, but it stays off until the site has a measurement ID:

1. In Google Analytics, add a web data stream for `bingo.gtfunes.com` and copy its measurement ID (`G-…`).
2. Paste it into `GA_MEASUREMENT_ID` at the top of `analytics.js`, then push to `main`.

- It never runs on `localhost`, `*.localhost` or LAN addresses, so local tests are not counted.
- Besides the page views, it sends two events: `game_start` (the first ball, with the ball range and the card set) and `game_end` (a card with bingo or a tap on **¡Bingo!**, with the balls drawn). The events never include the names people type.
- The ads features are off: ad cookies are denied by default (consent mode), and Google signals and ad personalization are disabled. To turn Google signals on, add the extra Google domains to the Content Security Policy first.
- Google Analytics sets its own cookies (`_ga`). The site has no cookie banner, so it does not ask visitors for consent. Visitors in the EU or the UK would need one.
- `analytics.js` is the same file in the bingo, generala and truco repositories. Only the ID line differs.

## Security

The site is static: no backend and no accounts. The only third-party script is Google Analytics, and only once it has an ID (see [Analytics](#analytics)). Saved state goes into the page as text, never as HTML.

GitHub Pages cannot send custom headers, so `index.html` sets these with `<meta>` tags:

- A strict Content Security Policy: only files from the site itself and the Google Analytics domains, no inline scripts.
- `referrer: no-referrer`.
- `robots: noindex, nofollow`, so search engines skip the site. Delete it if you want the site indexed.

The protections that exist only as headers are missing: `frame-ancestors` and `X-Frame-Options` (framing by other sites), `X-Content-Type-Options`, `Cross-Origin-Opener-Policy` and a Permissions Policy. The risk is low: the app has no accounts and no data worth stealing. GitHub Pages serves the site over HTTPS once **Enforce HTTPS** is on.

## Notes

- The voices depend on the device. With **Voz** on «Automática», the app picks a natural Spanish voice and skips Apple's robotic novelty voices. If the device has no Spanish voice, the browser uses its default voice.
- If you hear nothing on an iPhone, turn off silent mode and tap **Repetir**.
- For a full-screen app feel, open the site on the phone and use **Add to Home Screen**.
- If you add a file the app needs, add it to `ASSETS` in `sw.js`, so it works offline.
- To regenerate the PNG icons after you edit `icons/icon.svg`, install `librsvg` (`brew install librsvg`) and run:

```bash
for s in 180 192 512; do rsvg-convert -w $s -h $s icons/icon.svg -o icons/icon-$s.png; done
```

## License

[MIT](LICENSE)
