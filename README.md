# Very Simple Bingo

A tiny bingo ball caller (a "bolillero") for game night with friends. It draws numbers at random, announces each one out loud, and keeps a board of the numbers that came out.

It is made for phones first. No build step and no dependencies: plain HTML, CSS and JavaScript.

## Features

- Big "Sacar bolilla" button pinned to the bottom of the screen, within thumb reach.
- Draws balls from 1–90 (default) or 1–75, with no repeats.
- Announces each number by voice in Spanish, for example "47. Cuatro, siete." It uses the browser's Web Speech API.
- Shows a board with every number that came out, plus the last five balls.
- Keeps the game after a page reload (saved in the browser's `localStorage`).
- Keeps the screen on during a game, where the browser supports it.
- Works offline after the first visit, and installs to the Home Screen with its own icon.
- Shows a hint when the voice does not start (for example, silent mode on an iPhone).
- Press <kbd>Space</kbd> to draw a ball.

The interface text is in Spanish (Argentina).

## Run locally

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

The service worker (offline support) is off on `localhost`, so it never caches other local dev servers. To test it, open <http://bingo.localhost:5173> instead.

## Deploy to Vercel

1. Push the repository to GitHub.
2. In Vercel, select **Add New → Project** and import the repository.
3. Keep the **Other** framework preset and the default settings, then select **Deploy**.

To deploy from the terminal instead, use the Vercel CLI:

```bash
pnpm dlx vercel --prod
```

## Security

The site is static: no backend, no accounts, no cookies, and no third-party scripts. `vercel.json` adds security headers (a strict Content Security Policy, no framing, no referrer, and a Permissions Policy that blocks camera, microphone and location). It also asks search engines not to index the site. Delete the `X-Robots-Tag` header if you want it indexed.

## Notes

- The voice depends on the device. If it has no Spanish voice, the browser uses its default voice.
- If you hear nothing on an iPhone, turn off silent mode and tap **Repetir**.
- For a full-screen app feel, open the site on the phone and use **Add to Home Screen**.
- To regenerate the PNG icons after editing `icons/icon.svg`: `for s in 180 192 512; do rsvg-convert -w $s -h $s icons/icon.svg -o icons/icon-$s.png; done`.

## License

[MIT](LICENSE)
