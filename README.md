# HomeFund

A family budget web app that installs on any phone like a native app. Set your payday and HomeFund shows how much money is left until the next payday and how much you can spend per day. Snap a receipt and it is cropped, read line by line and sorted into categories automatically.

## Features (in progress)

- Payday countdown and daily allowance
- Manual expense entry
- Receipt scanning with SAM 3.1 and Muse Spark 1.3 (Meta Model API)
- Voice expense entry with Muse Voice Transcribe
- Shared household with a budget per member
- Every currency (EUR, USD, GBP, HUF, RON and all other ISO 4217 currencies)

## Privacy: receipt photos are never stored

- On the phone, the photo is turned upright, shrunk and re-encoded in memory
  before upload. This removes all metadata: location (GPS), camera and time.
- The server reads it in memory only. It is never written to disk, a
  database, a cache or a log, and its bytes are wiped when the request ends.
- Only the result is kept: shop, date, amounts, items and categories.
- The Meta API key stays on the server; the phone never sees it.

## Built during the hackathon

Everything in this repository was built from scratch during the Meta Global AI Developer Hackathon (October 27 – November 4, 2026). The first commit is dated October 27, 2026.

## Existing before the hackathon

None. HomeFund uses no code, backend or assets created before the event.

## Tech stack

- Next.js, TypeScript, Tailwind CSS
- Meta Model API

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Install on your phone

HomeFund is a Progressive Web App.

- **iPhone (Safari):** Share → Add to Home Screen
- **Android (Chrome):** menu → Install app

## Roadmap

- Supervised kids' accounts managed by parents
- Native iOS and Android apps

## License

Copyright (c) 2026 MotionFlow Studio. All rights reserved. See [LICENSE](LICENSE).
