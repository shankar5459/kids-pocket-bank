# Pocket Money Bank

A free, mobile-first PWA for tracking kids' pocket money — earnings, spending, and balances. No backend, no accounts, no subscriptions. All data stays in your browser.

**Live demo:** deploy to GitHub Pages (see below) at `https://<username>.github.io/kids-pocket-bank/`

## Features

- **Multiple kids** — each with their own balance and transaction history
- **Manual transactions** — credit (money in) and debit (money out) with date, description, and category
- **Derived balances** — always calculated from transactions, never stored separately
- **Bank statement view** — running balance, filters, search; mobile cards and desktop table
- **Edit & delete transactions** — fix mistakes without correction entries
- **Negative balance warning** — allowed after confirmation
- **JSON backup & restore** — export/import full data to move between devices
- **CSV export** — per-kid statement download
- **Print / PDF** — print-friendly statement layout
- **Offline PWA** — install on phone home screen; works offline after first load

## Categories

Pocket Money · Gift · Reward · Food · Toys · Books · Savings · Other

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | HTML, CSS, vanilla JavaScript |
| Storage | `localStorage` (`pocketbank.v1`) |
| Hosting | GitHub Pages (static, free, HTTPS) |
| PWA | `manifest.json` + `service-worker.js` |
| Currency | INR (₹) |

No build step, no npm, no backend.

## Run locally

A local server is required for the service worker (opening `index.html` directly via `file://` will not register the PWA).

```bash
cd kids-pocket-bank
python3 -m http.server 8765
```

Open [http://localhost:8765](http://localhost:8765)

## Deploy to GitHub Pages

1. Push this repo to GitHub (public repo for free Pages).
2. Go to **Settings → Pages**.
3. Source: **Deploy from branch** → `main` → `/ (root)`.
4. Your app will be at `https://<username>.github.io/kids-pocket-bank/`.

All asset paths are relative, so the app works under any GitHub Pages subpath.

## Install on your phone

**Android (Chrome):** Open the hosted URL → menu → **Install app** or **Add to Home screen**.

**iPhone (Safari):** Open the hosted URL → **Share** → **Add to Home Screen**.

After the first online visit, the app works offline.

## Data & privacy

- All kid profiles and transactions are stored in **this browser's local storage only**.
- GitHub Pages serves the app files (HTML, CSS, JS). **No transaction data is uploaded to GitHub or any server.**
- Clearing browser data erases your records.
- **Export a JSON backup regularly** (Settings → Export Backup) to preserve history and move data between devices.

## Project structure

```
index.html              # App shell, views, modals
manifest.json           # PWA manifest
service-worker.js       # Offline asset cache
css/styles.css          # Mobile-first bank theme
js/
  utils.js              # Formatting, categories, helpers
  store.js              # localStorage CRUD, balances
  backup.js             # JSON export/import
  export.js             # CSV + print
  views.js              # UI rendering
  app.js                # Routing and events
  sw-register.js        # Service worker registration
icons/                  # PWA icons (192, 512)
```

## Backup format

Exported files are named `pocketbank-backup-YYYY-MM-DD.json`:

```json
{
  "format": "pocketbank-backup",
  "version": 1,
  "exportedAt": "2026-07-04T10:30:00.000Z",
  "data": {
    "kids": [...],
    "transactions": [...]
  }
}
```

Import replaces all local data after validation and confirmation.

## License

Personal / family use. Free and open source.
