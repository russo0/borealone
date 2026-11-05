# Boreal One booking request API

This Cloudflare Worker receives private Aurora Chase requests and Yellow Aurora House stay requests from `borealone.com`, verifies Turnstile, and sends a detailed email to `info@borealone.com`. It also sends the guest a receipt that makes clear the request is not a confirmed booking.

## Yellow Aurora House requests

The house calendar at `/yellow-aurora-house/#stay-request` selects arrival, departure, guests (1–4, including children) and pets. It opens `/book/stay-request/` with those fields prefilled. That form uses the same endpoint and existing Resend and Turnstile credentials, with `service: "stay"`. The original Aurora form is unchanged and works without a service field.

Stay dates are validated on both client and server against the current date in Sweden. Departure must follow arrival; nights are calendar days, independent of daylight saving time. The pet policy is 250 SEK or EUR 25 per pet, per stay. No nightly rates are invented or charged by this form.

The house form and guest receipt support English, Brazilian Portuguese, Swedish and German. The page's selected language controls the receipt (`locale`), while personal contact remains in English or Portuguese (`language`). Owner emails clearly identify a stay request and remind the host to check all calendars before confirming.

This phase does not import Booking.com availability, block dates, create confirmed reservations, or take payments. Requests can overlap and must be checked manually. Booking.com remains linked as an alternative on the house page. Future iCalendar import/export can add occupancy separately without mixing house dates with tours.

Deploy this Worker update **before** pushing the new website files:

```sh
cd booking-api
npm test
npx wrangler deploy
```

Then push the website as usual. Existing Worker routes, sending domain, recipient and secrets do not need to change. `/book/stay-request/` remains `noindex,nofollow` and is not added to the sitemap.

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
