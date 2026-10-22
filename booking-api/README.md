# Boreal One booking request API

This Cloudflare Worker receives a private Aurora Chase request from `borealone.com`, verifies Turnstile, and sends a detailed email to `info@borealone.com`. It also sends the guest a receipt that makes clear the request is not a confirmed booking.

## One-time setup

1. Create a free Resend account and verify `borealone.com` as a sending domain. Use the DNS records Resend provides in Cloudflare.
2. In Cloudflare Turnstile, create a managed widget for `borealone.com` and `www.borealone.com`.
3. Add the public Turnstile site key to the booking page. It is safe to expose in the page source.
4. Keep the Resend API key and Turnstile secret out of Git. Add them to the Worker as Cloudflare secrets:

   ```sh
   cd booking-api
   npx wrangler login
   npx wrangler secret put RESEND_API_KEY
   npx wrangler secret put TURNSTILE_SECRET
   npx wrangler deploy
   ```

`wrangler.toml` deploys the Worker only for these two paths:

- `https://borealone.com/api/booking-request`
- `https://www.borealone.com/api/booking-request`

The sender is `Boreal One Bookings <bookings@borealone.com>` and replies go to `info@borealone.com`. Change the two non-secret values in `wrangler.toml` if a different sender is preferred.

## Security notes

- The endpoint only accepts requests that originate from Boreal One.
- Turnstile is mandatory before an email is sent.
- The Worker does not log booking details or write secrets into the repository.
- The next version can add D1 storage and a private admin panel without changing the public form endpoint.
