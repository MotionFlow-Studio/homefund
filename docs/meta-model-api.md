# Meta Model API: receipt reading

How HomeFund reads a receipt photo, verified against the live API on 2026-10-27
with `test/fixtures/receipt-lidl-ro.jpg`.

## Access

- Base URL: `https://api.meta.ai/v1`.
- Auth: `Authorization: Bearer $META_API_KEY`.
- The key lives only in the server environment (`META_API_KEY`), never in the
  repository or the browser.

## Pipeline

```
photo (browser, memory only)
  -> shrink in the browser to max 3072 px, JPEG 85 (usually 1-3 MB)
  -> POST /api/receipt/scan (our server, rejects anything over 10 MB)
  -> turn upright, strip metadata, keep up to 4096 px
  -> SAM 3.1 on a 1600 px copy: find the receipt, get its box
  -> crop the full-size photo to the box + 1.2% padding, fit to
     1024 x 1600 (small receipts enlarged up to 2x), JPEG 85
  -> Muse Spark 1.3: read items into a fixed JSON schema
  -> validate (items add up to the total)
  -> JSON back to the browser; the image is dropped
```

## Step 1: SAM 3.1 (hosted on the Meta Model API)

`POST /v1/responses`, streaming only (`Accept: text/event-stream`).

```json
{
  "model": "sam-3.1",
  "stream": true,
  "metadata": { "include_confidence": "true", "mask_encoding": "one_bit" },
  "input": [{ "type": "message", "role": "user", "content": [
    { "type": "input_text", "text": "receipt" },
    { "type": "input_image", "image_url": "data:image/jpeg;base64,..." }
  ]}]
}
```

- The result arrives in `response.output_text.delta` events as one text line:
  `<0f>0<|box;x1=473;y1=186;x2=1249;y2=1722;w=1600;h=2000;c=0.808|><|mask;...|>`
- Box coordinates are source pixels (top-left `x1,y1`, bottom-right `x2,y2`).
  We only need the box; the mask is ignored.
- Several matches are comma-separated records; use the highest `c`.
- No receipt in the photo: the output text is empty.
- Measured: ~1.5–1.9 s. Price: $2.50 per 1,000 images.

## Step 2: Muse Spark 1.3

`POST /v1/responses` with the cropped image and a strict JSON schema:

```json
{
  "model": "muse-spark-1.3",
  "reasoning": { "effort": "low" },
  "text": { "format": { "type": "json_schema", "name": "receipt", "strict": true, "schema": { ... } } },
  "input": [{ "type": "message", "role": "user", "content": [
    { "type": "input_text", "text": "<instructions>" },
    { "type": "input_image", "image_url": "data:image/jpeg;base64,..." }
  ]}]
}
```

- The answer is in the `output_text` content of the response.
- Amounts are requested as decimal strings (`"105.07"`) and converted to
  minor units on our side, so nothing is rounded.
- Strict schemas need `additionalProperties: false` and every property in
  `required`; optional values use `["string", "null"]`.
- Measured: 3.7 s (`minimal` effort) to 4.5 s (`low`), ~1,700 input and
  ~700–1,200 output tokens. Price: about $0.007 per receipt.

Result for the test receipt (all 7 lines, total 105.07 RON, categories
groceries / household / kids) was exactly right with `low` effort.

## Limits

- Meta accepts JPEG, PNG, GIF, WebP up to 50 MB; **HomeFund caps uploads at
  10 MB** and shrinks photos in the browser first. Images are processed in
  memory and never written to disk.
- Rate limits (per team): Muse Spark 1.3 3,000 RPM; SAM 3.1 3,000 RPM.
- No server timeout is documented; HomeFund aborts after 30 s and offers
  manual entry.

## Our endpoint: `POST /api/receipt/scan`

- Multipart form: `image` (JPEG, PNG or WebP, max 10 MB) and `currency`
  (household currency, used when the receipt prints none).
- Only for signed-in users, only from our own origin.
- Limits: one scan at a time per user, 6 per minute and 60 per day per user,
  1,000 per day for the whole server. Over the limit: `429` with `Retry-After`.
- 30 s timeout (`504 timeout`). Photos that are not receipts: `422 not_a_receipt`.
  Unreadable files: `415 unsupported_image`.
- The server turns the photo upright, strips its metadata and never stores it.
  If SAM finds no receipt box, the whole photo is read.
- Discounts printed under an item are taken off that item, so every line
  holds what was actually paid. The answer says whether the lines add up to
  the printed total (`totalsMatch`).
- The answer includes `crop`: where the receipt was found, as fractions of
  the upright photo (null when the whole photo was read).
- Measured: 7/7 lines and 105.07 RON both for the test receipt and for the
  same receipt photographed small and tilted on a table or pushed into a
  corner (it fills 5-10% of the photo); about 7.5-8 s each.

## Cost per scanned receipt

About **$0.01** (SAM $0.0025 + Muse Spark ~$0.007), and ~6 s end to end.
