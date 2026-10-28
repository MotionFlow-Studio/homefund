# HomeFund

**A family budget app that answers one question: how much can I spend today?**

Set your payday and HomeFund shows what is left until the next one and how much
you can spend per day. Photograph a receipt and it is cropped, read line by line
and sorted into categories by Meta's models. The whole family shares one
household, and everyone sees their own numbers on their own phone.

HomeFund is a web app that installs on any phone like a native app and keeps
working offline.

Live app: https://homefund.motionflowstudio.com

## What it does

- **Payday countdown.** Income, fixed costs and a savings goal give the money
  left until payday and a daily amount that adapts to every expense. Warnings
  when spending runs ahead or the budget is used up.
- **Receipt scanning.** Take a photo in the app; the receipt is found, cropped
  and read: shop, date, every line, discounts and the total, each line in a
  category. You check and correct the lines, pick who paid, and save.
- **Manual entry** in a few taps, with edit, delete and undo.
- **One household for the family.** The owner invites another adult with a
  one-time code. Every member has their own payday and budget; a family
  overview shows where everyone stands and where the money goes, with a page
  per member.
- **Works offline.** Everything is stored on the phone first and synced in the
  background; an expense added on one phone appears on the others within
  seconds.
- **Every currency.** All ISO 4217 currencies, exact to the last decimal, each
  written the way its users write it: 1 234,56 € · 1.234,56 lei · 12 345 Ft.
- **Settings and data control.** Name, payday, income, household name and
  currency; sign out without losing unsynced changes; delete all your data.

## How Meta models are used

Receipt reading is a two-model pipeline on the Meta Model API, run on our
server so the API key never reaches the phone.

| Model | Where | What it does |
|---|---|---|
| **SAM 3.1** | [`src/server/receipt-scan.ts`](src/server/receipt-scan.ts), [`src/server/meta-api.ts`](src/server/meta-api.ts) | Finds the receipt in the photo (prompt: "receipt") and returns its box, so a small, tilted or off-centre receipt is cut out of the background before it is read. |
| **Muse Spark 1.3** | [`src/server/receipt-scan.ts`](src/server/receipt-scan.ts), [`src/server/receipt-parse.ts`](src/server/receipt-parse.ts) | Reads the cropped receipt into a strict JSON schema: shop, date, currency, total and every line with its amount, quantity, unit price, kind (item, line discount, receipt discount) and one of ten categories. It also says when a receipt is too blurry to read, instead of guessing. |

```
photo (phone: upright, max 3072 px, metadata removed)
  → POST /api/receipt/scan            signed-in users only, size and rate limits
  → SAM 3.1                           find the receipt, crop it
  → Muse Spark 1.3                    read every line into JSON
  → checks                            lines add up to the total? unit prices right?
      └ if not: read once more with more reasoning effort, keep the answer that adds up
  → review screen                     the user corrects and saves
```

Discounts and coupons are spread over the lines they apply to, to the exact
cent, so category totals are right. Bottle deposits stay with their drink;
VAT summaries, subtotals and payment lines are left out. Details, request
formats and measurements: [docs/meta-model-api.md](docs/meta-model-api.md).

## Receipt accuracy test

Method: ten real receipts from Hungary, Romania and other European countries
are photographed with a phone and put through the same path as in the app
([`scripts/receipt-benchmark.mjs`](scripts/receipt-benchmark.mjs)). For each
receipt the total read by the app is compared with the printed total. The
goal is at least 8 of 10 totals right. The photos themselves are never
committed.

**Results with ten real receipts: pending.** They will be added here after the
run.

Self-made test receipts in [`test/fixtures/`](test/fixtures/) are read
completely right: every line, the total, the currency, the date and the
categories, in 6–8 seconds each.

| Receipt | Country | Currency | What it tests | Total |
|---|---|---|---|---|
| Lidl | Romania | RON | 7 lines, weighed item | 105.07 ✓ |
| SPAR | Hungary | HUF | line discount, bottle deposit, VAT lines | 7 834 ✓ |
| REWE | Germany | EUR | decimal commas, deposit, 2 € coupon | 15.81 ✓ |

## Privacy

- **Receipt photos are never stored.** On the phone the photo is turned
  upright, shrunk and re-encoded in memory, which removes all metadata
  (location, camera, time). The server keeps it in memory only: never on
  disk, in a database, a cache or a log, and its bytes are wiped when the
  request ends. Only the result is kept: shop, date, amounts, lines and
  categories.
- **The Meta API key stays on the server.** The phone never sees it.
- **Only the household sees its data.** Every table has row level security
  with no public access; all reads and writes go through the HomeFund server,
  which checks household membership. The app shows members each other's
  budget and spending, not each other's income.
- **Checked, not just promised.** `npm run check:leaks` verifies that no key
  and no receipt photo is in the repository, its full git history or the code
  sent to browsers. The only images in the repository are the app artwork,
  screenshots of the app with demo data and the three self-made test receipts.
- **Delete my data.** Settings → Delete my data removes everything for good
  after the user types DELETE:
  - the login account and all its sessions; every signed-in device clears
    what HomeFund kept on it;
  - a household nobody else uses, with everything in it;
  - in a shared household, the person's expenses, receipt lines, budget and
    fixed costs. The others keep the household; their phones drop these
    records on the next sync, and on the server only an empty marker of each
    remains (no names, notes or amounts) so that they can. If the person set
    up the household, the adult who joined first takes it over.

## Built during the hackathon

Everything in this repository was built from scratch during the Meta Global AI
Developer Hackathon (October 27 – November 4, 2026). The first commit is dated
October 27, 2026. That includes:

- the receipt pipeline with SAM 3.1 and Muse Spark 1.3, its checks and the
  benchmark script;
- the camera, review and error screens;
- the budget engine and every screen of the app;
- the offline store and the sync server;
- households, invites, settings and data deletion;
- the database schema, the security setup, the icon and the launch screens.

**Existing before the hackathon:** nothing. HomeFund uses no code, backend or
assets created before the event.

## Tech stack

- **App:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, an
  installable Progressive Web App with a service worker
- **On the phone:** IndexedDB (Dexie) as the main store, with a queue of
  changes for sync
- **Server:** Next.js route handlers; Supabase Postgres through Drizzle ORM,
  Supabase Auth with HttpOnly cookies
- **AI:** Meta Model API (SAM 3.1, Muse Spark 1.3); image handling with sharp
- **Tests:** Vitest (unit), Playwright (end-to-end, two phones at once)

## Running it

You need Node.js 20.9 or newer, a Supabase project and a Meta Model API key.

1. Install:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill it in:
   - `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`: Supabase → Project
     Settings → API;
   - `DATABASE_URL`: Supabase → Connect → Session pooler;
   - `META_API_KEY`: your Meta Model API key.

   In Supabase, turn off email confirmation (Authentication → Sign In / Providers → Email),
   or new accounts must confirm by email first.

3. Create the tables:

   ```bash
   node --env-file=.env.local node_modules/.bin/drizzle-kit migrate
   ```

4. Start:

   ```bash
   npm run dev                  # development, http://localhost:3000
   npm run build && npm start   # production
   ```

Other commands:

| Command | What it does |
|---|---|
| `npm test` | unit tests |
| `npm run lint` | lint |
| `npm run check:leaks` | no secrets or receipt photos in the repo, its history or the build |
| `npm run icons` | redraw the icon and launch screens |
| `node --env-file=.env.local scripts/receipt-benchmark.mjs` | receipt accuracy test (see the script for setup) |

## Install on your phone

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** menu → Install app

## Roadmap

- Voice expense entry with Muse Voice Transcribe
- Supervised kids' accounts managed by parents
- Native iOS and Android apps

## License

Copyright (c) 2026 MotionFlow Studio. All rights reserved. See [LICENSE](LICENSE).
