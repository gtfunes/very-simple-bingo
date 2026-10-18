# Very Simple Bingo

A tiny bingo ball caller (a "bolillero") for game night with friends. It draws numbers at random, announces each one out loud, and keeps a board of the numbers that came out.

It is made for phones first. No build step and no dependencies: plain HTML, CSS and JavaScript.

## Features

- Big "Sacar bolilla" button pinned to the bottom of the screen, within thumb reach.
- Draws balls from 1–90 (default) or 1–75, with no repeats.
- Announces each number by voice in Spanish: the number, a short pause, then its digits ("47" … "cuatro, siete"). It uses the browser's Web Speech API. Change the pause with `DIGITS_PAUSE_MS` in `app.js`.
- Shows a board with every number that came out, plus the last five balls.
- Keeps the game after a page reload (saved in the browser's `localStorage`).
- Keeps open tabs in sync, so a second tab never repeats a ball.
- Keeps the screen on during a game, where the browser supports it.
- Works offline after the first visit, and installs to the Home Screen with its own icon.
- Shows a hint when the voice does not start (for example, silent mode on an iPhone).
- Press <kbd>Space</kbd> to draw a ball.

The interface text is in Spanish (Argentina).

## Files

| File                   | Purpose                                                                 |
| ---------------------- | ----------------------------------------------------------------------- |
| `index.html`           | Page markup and meta tags.                                              |
| `styles.css`           | All styles. Phone layout first, two columns from 900 px wide.           |
| `app.js`               | Game logic, voice, wake lock, tab sync and service worker registration. |
| `sw.js`                | Service worker: network first, with the cache as the offline fallback.  |
| `manifest.webmanifest` | Home Screen app name, colors and icons.                                 |
| `icons/`               | `icon.svg` (source and favicon) and the PNG sizes made from it.         |
| `.nojekyll`            | Tells GitHub Pages to serve the files as they are, without Jekyll.      |
| `vercel.json`          | Security headers for the Vercel deployment.                             |
| `.vercelignore`        | Allow-list of the files uploaded to Vercel (they are all public).      |

## Run locally

```bash
python3 -m http.server 5173
```

Then open <http://localhost:5173>.

- The service worker (offline support) is off on `localhost`, so it never caches other local dev servers. To test it, open <http://bingo.localhost:5173> instead.
- The security `<meta>` tags in `index.html` apply everywhere. The extra headers in `vercel.json` apply only on Vercel.

## Deploy to GitHub Pages

The site works on GitHub Pages as it is, at `https://gtfunes.github.io/very-simple-bingo/` or at a custom domain. All paths are relative, so no path changes are needed.

1. Make the repository public. GitHub Pages on a private repository needs GitHub Pro or Team.
2. Open **Settings → Pages** and set the source to **Deploy from a branch**, branch `main`, folder `/ (root)`.
3. Each push to `main` publishes the site in about a minute.

- Pages serves every tracked file, so `README.md` and `LICENSE` also get public URLs. There is nothing secret in the repository.
- Pages caches each file for 10 minutes (`max-age=600`), so a phone can show the old version for up to 10 minutes after a deploy.
- For a custom domain, add a `CNAME` DNS record from the subdomain to `gtfunes.github.io`, then set the domain in **Settings → Pages**. GitHub commits a `CNAME` file to the repository: keep it. Turn on **Enforce HTTPS**. Also verify the domain in your account settings (profile **Settings → Pages**), so nobody else can take it.
- Saved games and Home Screen installs belong to one address. After a move to a new domain, players must add the app to the Home Screen again.

## Deploy to Vercel

The live site is <https://simple-bingo-rho.vercel.app> (Vercel project `simple-bingo`). Vercel serves the uploaded files as a static site. There is no build step.

Deploy from the terminal with the Vercel CLI. Run `login` and `link` once per machine.

```bash
pnpm dlx vercel login
```

```bash
pnpm dlx vercel link --yes --project simple-bingo
```

```bash
pnpm dlx vercel deploy --prod
```

- `.vercelignore` is an allow-list. Only the files the site serves are uploaded, so a new file the site needs must be added there, or it returns 404 in production.
- `vercel link` creates `.vercel/` and `.env.local`. Both are in `.gitignore`, and `.vercelignore` keeps them out of the upload.
- To deploy on every push to `main` instead, give the Vercel GitHub app access to this private repository (GitHub → **Settings → Applications → Vercel → Configure**). Then connect the repository in the project's **Settings → Git**.

## Security

The site is static: no backend, no accounts, no cookies, and no third-party scripts. Saved state goes into the page as text, never as HTML.

GitHub Pages cannot send custom headers, so `index.html` sets these with `<meta>` tags on every host:

- A strict Content Security Policy: only files from the site itself, no inline scripts.
- `referrer: no-referrer`.
- `robots: noindex, nofollow`, so search engines skip the site. Delete it if you want the site indexed.

On Vercel, `vercel.json` also sends the same policies as headers, plus the ones that have no `<meta>` form:

- `frame-ancestors 'none'` and `X-Frame-Options`, so no other site can show the app in a frame.
- `X-Content-Type-Options` and `Cross-Origin-Opener-Policy`.
- A Permissions Policy that blocks camera, microphone, location, payments and USB.

On GitHub Pages these last protections are missing. The risk is low: the app has no accounts and no data worth stealing.

## Notes

- The voice depends on the device. The app picks a natural Spanish voice and skips Apple's robotic novelty voices. If the device has no Spanish voice, the browser uses its default voice.
- If you hear nothing on an iPhone, turn off silent mode and tap **Repetir**.
- For a full-screen app feel, open the site on the phone and use **Add to Home Screen**.
- If you add a file the app needs, add it to `.vercelignore` (so it is uploaded) and to `ASSETS` in `sw.js` (so it works offline).
- To regenerate the PNG icons after you edit `icons/icon.svg`, install `librsvg` (`brew install librsvg`) and run:

```bash
for s in 180 192 512; do rsvg-convert -w $s -h $s icons/icon.svg -o icons/icon-$s.png; done
```

## License

[MIT](LICENSE)
