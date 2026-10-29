# HomeFund

**A family budget app that answers one question: how much can I spend today?**

Set your payday and HomeFund shows what is left until the next one and how much
you can spend per day. Photograph a receipt and it is cropped, read line by line
and sorted into categories by Meta's models. The whole family shares one
household, and everyone sees their own numbers on their own phone.

HomeFund is a web app that installs on any phone like a native app and keeps
working offline.

Live app: https://homefund.motionflowstudio.com

Try it without signing up: https://homefund.motionflowstudio.com/demo

## What it does

- **Payday countdown.** Income, fixed costs and a savings goal give the money
  left until payday and a daily amount that adapts to every expense. Warnings
  when spending runs ahead or the budget is used up.
- **Money in and out.** Record bonuses, side jobs, refunds, gifts and sales
  next to expenses; extra income adds to what can be spent until payday.
- **Payday forecast and charts.** Where the current pace leads on payday (or
  the day the money runs out), spending through the period against an even
  pace, the last 14 days and a category ring.
- **A money coach.** Muse Spark 1.3 writes three insights about the pay
  period and answers questions such as "Can I afford a $120 dinner on
  Friday?" using the user's own numbers.
- **Receipt scanning.** Take a photo in the app; the receipt is found, cropped
  and read: shop, date, every line, discounts and the total, each line in a
  category. You check and correct the lines, pick who paid, and save.
- **Say it.** Tap the microphone and say "groceries at FreshMart, 42 dollars"
  or "got a 200 dollar bonus": the entry is filled in for you to confirm.
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
- **Demo family.** One tap on the home page opens a fresh copy of the
  Walkers, a family with two paydays, bills, two weeks of spending, a scanned
  receipt and extra income. Each visitor gets their own copy, removed after a
  day.
- **Settings and data control.** Name, payday, income, household name and
  currency; sign out without losing unsynced changes; delete all your data.

## How Meta models are used

Meta models do the heavy lifting in three places, all run on our
server so the API key never reaches the phone.

| Model | Where | What it does |
|---|---|---|
| **SAM 3.1** | [`src/server/receipt-scan.ts`](src/server/receipt-scan.ts), [`src/server/meta-api.ts`](src/server/meta-api.ts) | Finds the receipt in the photo (prompt: "receipt") and returns its box, so a small, tilted or off-centre receipt is cut out of the background before it is read. |
| **Muse Voice Transcribe** | [`src/server/meta-api.ts`](src/server/meta-api.ts), [`src/app/api/voice/route.ts`](src/app/api/voice/route.ts) | Writes down a spoken expense or income (16 kHz WAV made in the browser); Muse Spark 1.3 then turns the sentence into amount, category or income source, a short title and the day. |
| **Muse Spark 1.3** (coach) | [`src/server/assistant.ts`](src/server/assistant.ts), [`src/app/app/coach.tsx`](src/app/app/coach.tsx) | Reads the pay period's totals (what is left, the pace, categories, last week against the week before, top shops) and writes three insights, or answers a question about the user's money with a verdict: fits, tight, doesn't fit. |
| **Muse Spark 1.3** (receipts) | [`src/server/receipt-scan.ts`](src/server/receipt-scan.ts), [`src/server/receipt-parse.ts`](src/server/receipt-parse.ts) | Reads the cropped receipt into a strict JSON schema: shop, date, currency, total and every line with its amount, quantity, unit price, kind (item, line discount, receipt discount) and one of ten categories. It also says when a receipt is too blurry to read, instead of guessing. |

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

## Receipt reading test

Self-made test receipts in [`test/fixtures/`](test/fixtures/), photographed
on a table the way a phone would, are read completely right: every line, the
total, the currency, the date and the categories, in 6–10 seconds each.

| Receipt | Country | Currency | What it tests | Total |
|---|---|---|---|---|
| Green Valley Market | United States | USD | 7 lines, weighed item, multi-buy | 34.52 ✓ |
| Lidl | Romania | RON | 7 lines, weighed item | 105.07 ✓ |
| SPAR | Hungary | HUF | line discount, bottle deposit, VAT lines | 7 834 ✓ |
| REWE | Germany | EUR | decimal commas, deposit, 2 € coupon | 15.81 ✓ |

[`scripts/receipt-benchmark.mjs`](scripts/receipt-benchmark.mjs) runs the same
check on any folder of receipt photos (kept out of the repository) and
reports how many totals were read right.

## Privacy

- **Voice recordings are never stored.** They are made in memory, sent once
  to be written down and wiped when the request ends.
- **Receipt photos are never stored.** On the phone the photo is turned
  upright, shrunk and re-encoded in memory, which removes all metadata
  (location, camera, time). The server keeps it in memory only: never on
  disk, in a database, a cache or a log, and its bytes are wiped when the
  request ends. Only the result is kept: shop, date, amounts, lines and
  categories.
- **The Meta API key stays on the server.** The phone never sees it.
- **The coach sees totals, not people.** Insights and answers are based on
  sums per category and day, shop names and dates; never names of family
  members, notes or receipt lines. Nothing is stored or logged.
- **Only the household sees its data.** Every table has row level security
  with no public access; all reads and writes go through the HomeFund server,
  which checks household membership. The app shows members each other's
  budget and spending, not each other's income.
- **Checked, not just promised.** `npm run check:leaks` verifies that no key
  and no receipt photo is in the repository, its full git history or the code
  sent to browsers. The only images in the repository are the app artwork,
  screenshots of the app with demo data and the four self-made test receipts.
- **Delete my data.** Settings → Delete my data removes everything for good
  after the user types DELETE:
  - the login account and all its sessions; every signed-in device clears
    what HomeFund kept on it;
  - a household nobody else uses, with everything in it;
  - in a shared household, the person's expenses, incomes, receipt lines, budget and
    fixed costs. The others keep the household; their phones drop these
    records on the next sync, and on the server only an empty marker of each
    remains (no names, notes or amounts) so that they can. If the person set
    up the household, the adult who joined first takes it over.

## The business

### Who it is for

Families and couples who live from payday to payday and share the household
money: two incomes, two paydays, one fridge. Most budgeting apps are built for
one person who likes spreadsheets. They ask for categories, envelopes and
monthly plans, and most people give up within weeks. HomeFund asks for one
thing, the payday, and answers the one question people actually have: how much
can I spend today?

The first users we design for:

- **Young families** with two earners and children, where both parents buy
  groceries and nobody knows the total until the end of the month.
- **Couples moving in together** who want a shared view without merging their
  bank accounts.
- **Households abroad and in mixed currencies**, from the US to Europe, who are
  poorly served by bank-linked apps that only work in a few countries.

### Why HomeFund wins

- **One number instead of a spreadsheet.** "$171.75 a day until Nov 14" is
  something a person can act on at the checkout.
- **Zero typing.** A receipt photo or one spoken sentence becomes a booked
  expense with every line in a category. Meta's models do the work that makes
  people quit other apps.
- **Built for the family, not the individual.** Every member has their own
  payday and budget, and everyone sees the shared picture on their own phone.
- **Works everywhere.** No bank connection needed, every currency, offline
  first, installs from the browser on any phone.
- **Private by design.** Receipt photos and voice recordings are never stored;
  the coach sees totals only. That is a reason to choose us, not a footnote.

### How it makes money

HomeFund is free to start and earns from households that use it every day.

| Plan | Price (planned) | What it includes |
|---|---|---|
| **Free** | $0 | One household, two adults, manual and voice entry, a limited number of receipt scans and coach answers each month |
| **HomeFund Plus** | $4.99 per household per month, or $39.99 per year | Unlimited receipt scans, the money coach without limits, more family members, full history and export |
| **HomeFund for partners** | Per active household, billed to the partner | A white-label version for banks, credit unions and employers' financial wellbeing programmes |

- **Subscriptions** are the main income. The price is per household, not per
  person, so inviting the family never costs more. That makes sharing, the
  feature that keeps people in the app, free to grow.
- **Costs grow with use.** The main running cost is the AI calls for receipts,
  voice and the coach. The free tier caps them, and Plus covers them many
  times over, so every paying household is profitable from the first month.
- **Partners** bring distribution: a bank or employer offers HomeFund to its
  customers or staff and pays per active household. Partners never see
  individual spending, only anonymous usage counts.
- **No ads, no selling data.** A budgeting app that sells its users' spending
  data loses the trust it runs on.

### Going to market

1. **Launch as a web app** that installs from the browser, with no app-store
   fees and no store review between an idea and the user.
2. **Grow through the family invite.** Every household that signs up brings in
   a second adult; the invite code is the built-in referral loop.
3. **Share-worthy moments.** The payday forecast and the coach's insights are
   made to be shown to a partner, which is how the app spreads.
4. **Partners** once the consumer product shows retention: credit unions and
   employers are looking for financial wellbeing tools their members actually
   use.

### What we measure

- Households that log spending on at least four days a week
- The share of households where a second adult joined
- Expenses added by photo or voice, compared with typing
- Free to Plus conversion, and households still active after 30 and 90 days

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
- the demo family, the landing page and the business plan;
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

- HomeFund Plus: plan limits, payments and the yearly plan
- Supervised kids' accounts managed by parents, with pocket money
- Shared savings goals for the family (a holiday, a new car)
- Bill reminders and the coach warning before a payday shortfall
- A partner version for banks, credit unions and employers
- Native iOS and Android apps

## License

Copyright (c) 2026 MotionFlow Studio. All rights reserved. See [LICENSE](LICENSE).
