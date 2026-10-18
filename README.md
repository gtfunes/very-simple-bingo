# Very Simple Bingo

A tiny bingo ball caller (a "bolillero") for game night with friends. It draws numbers at random, announces each one out loud, and keeps a board of the numbers that came out.

It is made for phones first. No build step and no dependencies: plain HTML, CSS and JavaScript.

## Features

- Big "Sacar bolilla" button pinned to the bottom of the screen, within thumb reach.
- Draws balls from 1–90 (default) or 1–75, with no repeats.
- Auto mode (**▶ Auto**): draws a ball after each callout ends, until you tap **Pausar**. **Ritmo** sets the pause before the next ball: Tranqui (2 s), Normal (1.2 s) or Rápido (0.6 s), in `AUTO_PACES` in `app.js`. Auto mode pauses when the screen locks, when the voice does not start, when a card wins and when all balls are out.
- Voice picker (**Voz**): the device's Spanish voices, the natural ones first, then the funny ones (on iPhone and Mac: Grandpa, Rocko, Flo…). **Estilo** changes the pitch and the speed: Normal, Ardilla, Monstruo or Apurado (`VOICE_STYLES` in `app.js`). A change plays a short sample only when nothing is being said, so it never cuts off a number.
- Sayings (**Dichos**): a joke right after each number, by voice and on screen, such as "8, ¡el culo te abrocho!". Edit them in `SAYINGS` and `RHYMES` in `app.js`.
- Card sets (**Cartones**): pick the set of printed cards you play with, and the app shows and says which cards have a line or a bingo after each ball. Auto mode pauses when a card wins. See [Card sets](#card-sets).
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
| `sw.js`                | Service worker: network first, with the cache as the offline fallback.  |
| `manifest.webmanifest` | Home Screen app name, colors and icons.                                 |
| `cards.json`           | Card sets: the numbers on each printed bingo card.                      |
| `icons/`               | `icon.svg` (source and favicon) and the PNG sizes made from it.         |
| `.nojekyll`            | Tells GitHub Pages to serve the files as they are, without Jekyll.      |
| `CNAME`                | The custom domain of the GitHub Pages site (`bingo.gtfunes.com`).       |

## Card sets

`cards.json` holds sets of real, printed bingo cards. The cards are transcribed from photos, not read on the device. A set is useful only to people who play with the same printed cards. When the file has no sets, the **Cartones** picker and the card results stay hidden.

```json
{
  "sets": [
    {
      "id": "casa",
      "name": "Cartones de casa",
      "cards": [
        { "id": "0123", "rows": [[3, 15, 42, 60, 81], [7, 22, 38, 55, 76], [9, 28, 47, 69, 90]] }
      ]
    }
  ]
}
```

- `id` of a set: a short name that does not change. The app saves it to remember the picked set.
- `name`: the text in the **Cartones** picker.
- `id` of a card: the serial number printed on the card, as text, so leading zeros stay.
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

## Security

The site is static: no backend, no accounts, no cookies, and no third-party scripts. Saved state goes into the page as text, never as HTML.

GitHub Pages cannot send custom headers, so `index.html` sets these with `<meta>` tags:

- A strict Content Security Policy: only files from the site itself, no inline scripts.
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
