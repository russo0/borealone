import assert from 'node:assert/strict';
import test from 'node:test';
import worker from '../src/index.js';
import { validateStayRequest } from '../src/stay-request.js';
import { addDays, propertyToday, stayNights, validStayDates } from '../../book/shared/stay-dates.mjs';

const today = propertyToday();
const stay = {
  service: 'stay', checkIn: addDays(today, 10), checkOut: addDays(today, 13), guests: '4', pets: '2',
  name: 'Test Guest', email: 'guest@example.com', phone: '+46000000000', language: 'English', locale: 'de',
  terms: true, turnstileToken: 'test-only-token'
};
const aurora = {
  experience: 'Private Aurora Chase, up to 3 hours', date: addDays(today, 10), guests: '2',
  location: 'Överkalix', stay: 'Yellow Aurora House', name: 'Test Guest', email: 'guest@example.com',
  phone: '+46000000000', language: 'Português', turnstileToken: 'test-only-token'
};
const env = { TURNSTILE_SECRET: 'test-only', RESEND_API_KEY: 'test-only' };
const post = body => new Request('https://borealone.com/api/booking-request', {
  method: 'POST', headers: { Origin: 'https://borealone.com', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

function upstream(context, { verified = true, delivery = true } = {}) {
  const emails = [];
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    if (url === 'https://challenges.cloudflare.com/turnstile/v0/siteverify') return Response.json({ success: verified });
    assert.equal(url, 'https://api.resend.com/emails');
    emails.push(JSON.parse(options.body));
    return Response.json(delivery ? { id: 'test-id' } : { name: 'test_failure' }, { status: delivery ? 200 : 503 });
  });
  return emails;
}

test('stay nights use calendar days across both Swedish daylight-saving transitions', () => {
  assert.equal(stayNights('2027-03-27', '2027-03-29'), 2);
  assert.equal(stayNights('2027-10-30', '2027-11-01'), 2);
  assert.equal(propertyToday(new Date('2026-11-03T23:30:00Z')), '2026-11-04');
});

test('reversed, same-day, impossible and past dates cannot become a stay request', () => {
  for (const invalid of [
    { checkOut: stay.checkIn }, { checkIn: stay.checkOut, checkOut: stay.checkIn },
    { checkIn: '2027-02-30' }, { checkIn: '2026-02-01' }, { checkOut: 'not-a-date' }
  ]) assert.equal(validateStayRequest({ ...stay, ...invalid }), null);
  assert(!validStayDates('2027-02-29', '2027-03-02', '2027-01-01'));
});

test('house capacity, pet counts and request acknowledgement are validated on the server', () => {
  assert.equal(validateStayRequest(stay).nights, 3);
  for (const invalid of [
    { guests: '5' }, { guests: '2.5' }, { guests: '2 guests' }, { pets: '-1' }, { pets: '1.5' },
    { terms: false }, { locale: 'xx' }, { language: 'Svenska' }
  ]) assert.equal(validateStayRequest({ ...stay, ...invalid }), null);
});

test('a stay reaches the owner and the guest in German, without Aurora tour text', async context => {
  const emails = upstream(context);
  const response = await worker.fetch(post(stay), env);
  assert.equal(response.status, 200);
  assert.match((await response.json()).requestId, /^YAH-/);
  assert.equal(emails.length, 2);
  assert.match(emails[0].subject, /Yellow Aurora House/);
  assert.match(emails[0].text, /Nights: 3/);
  assert.match(emails[0].text, /Pets: 2/);
  assert.match(emails[0].text, /250 SEK or EUR 25 per pet, per stay/);
  assert.match(emails[0].text, /No dates have been blocked/);
  assert.match(emails[1].subject, /Aufenthaltsanfrage/);
  assert.match(emails[1].text, /Nächte: 3/);
  assert.match(emails[1].text, /noch nicht bestätigt/);
  assert(!emails[1].text.includes('Aurora Chase'));
  assert.equal(emails[0].reply_to, stay.email);
});

test('all four house page languages receive localized acknowledgements', async context => {
  const emails = upstream(context);
  const phrases = { en: 'not confirmed yet', pt: 'ainda não está confirmada', sv: 'ännu inte bekräftad', de: 'noch nicht bestätigt' };
  for (const [locale, phrase] of Object.entries(phrases)) {
    assert.equal((await worker.fetch(post({ ...stay, locale }), env)).status, 200);
    assert(emails.at(-1).text.includes(phrase));
  }
});

test('the existing Aurora form without a service field still sends its Portuguese receipt', async context => {
  const emails = upstream(context);
  assert.equal((await worker.fetch(post(aurora), env)).status, 200);
  assert.match(emails[0].subject, /Aurora Chase request/);
  assert.match(emails[1].text, /Caçada Privativa de Aurora/);
  assert(!emails[1].text.includes('Check-out'));
});

test('failed verification cannot send either email', async context => {
  const emails = upstream(context, { verified: false });
  assert.equal((await worker.fetch(post(stay), env)).status, 400);
  assert.equal(emails.length, 0);
});

test('an owner delivery failure is not reported as a received booking', async context => {
  const emails = upstream(context, { delivery: false });
  const response = await worker.fetch(post(stay), env);
  assert.equal(response.status, 502);
  assert.equal((await response.json()).ok, false);
  assert.equal(emails.length, 1);
});

test('malformed payloads, unknown services and foreign origins are rejected', async () => {
  for (const payload of [null, [], { ...stay, service: 'invalid' }, { ...stay, checkOut: stay.checkIn }]) {
    assert.equal((await worker.fetch(post(payload), env)).status, 400);
  }
  const external = new Request('https://borealone.com/api/booking-request', {
    method: 'POST', headers: { Origin: 'https://example.com', 'Content-Type': 'application/json' }, body: JSON.stringify(stay)
  });
  assert.equal((await worker.fetch(external, env)).status, 403);
});
