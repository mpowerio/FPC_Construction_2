# Estimate-form delivery regression

From the repository root, with Node.js 22+:

```sh
npm ci --prefix tools/contact-form
npm exec --prefix tools/contact-form -- playwright install chromium
npm test --prefix tools/contact-form
npm run check:asset --prefix tools/contact-form   # built pages match tools/site sources
```

The browser suite loads the built `/estimate/` and `/es/estimado/` pages from this checkout
(GitHub Pages-style path resolution). Every network request is intercepted: lead POSTs get
synthetic local responses and every other external request is aborted. It sends no leads or
emails to production.

Cases: receipt acceptance (200/201 with `booking_id`), HTTP / JSON / network errors,
success-shaped bodies on error statuses, missing endpoint, timeout (including a pending JSON
body and a late receipt), validation with inline errors and a focused summary, retry, ten
repeated submits, the exact CRM payload (only accepted keys; address, best time and language
folded into `notes`), Spanish `language_preference`, no SMS opt-in or photo upload, and a
negative control proving the receipt tests fail when the `booking_id` check is removed.

Browser time advances locally for the timeout checks rather than waiting fifteen seconds.
These checks do not prove live CRM capture or owner email delivery.
