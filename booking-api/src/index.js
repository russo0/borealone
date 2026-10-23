const ALLOWED_ORIGINS = new Set([
  'https://borealone.com',
  'https://www.borealone.com'
]);

const EXPERIENCES = new Set([
  'Private Aurora Chase, up to 3 hours',
  'Private Aurora Chase, up to 6 hours'
]);

const LOCATIONS = new Set([
  'Överkalix',
  'Kiruna, selected partner date'
]);

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...corsHeaders(origin)
    }
  });
}

function cleanText(value, maxLength) {
  return typeof value === 'string'
    ? value.replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateRequest(payload) {
  const request = {
    experience: cleanText(payload.experience, 80),
    date: cleanText(payload.date, 10),
    guests: Number.parseInt(payload.guests, 10),
    location: cleanText(payload.location, 60),
    stay: cleanText(payload.stay, 300),
    name: cleanText(payload.name, 120),
    email: cleanText(payload.email, 254),
    phone: cleanText(payload.phone, 60),
    language: cleanText(payload.language, 40),
    notes: cleanText(payload.notes, 2000)
  };

  if (!EXPERIENCES.has(request.experience)) return null;
  if (!isValidDate(request.date)) return null;
  if (![1, 2, 3].includes(request.guests)) return null;
  if (!LOCATIONS.has(request.location)) return null;
  if (request.stay.length < 2 || request.name.length < 2 || request.phone.length < 5) return null;
  if (!isEmail(request.email)) return null;
  return request;
}

async function verifyTurnstile(token, request, secret) {
  if (!token || !secret) return false;
  const formData = new FormData();
  formData.append('secret', secret);
  formData.append('response', token);
  const clientIp = request.headers.get('CF-Connecting-IP');
  if (clientIp) formData.append('remoteip', clientIp);

  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    console.warn('Turnstile Siteverify returned an HTTP error', response.status);
    return false;
  }
  const result = await response.json();
  if (result.success !== true) {
    console.warn('Turnstile verification failed', result['error-codes'] || []);
  }
  return result.success === true;
}

function bookingEmail(request, requestId) {
  return [
    'New private Aurora Chase request',
    '',
    `Reference: ${requestId}`,
    `Experience: ${request.experience}`,
    `Preferred date: ${request.date}`,
    `Guests: ${request.guests}`,
    `Departure area: ${request.location}`,
    `Staying at: ${request.stay}`,
    '',
    `Name: ${request.name}`,
    `Email: ${request.email}`,
    `Phone / WhatsApp: ${request.phone}`,
    `Preferred language: ${request.language || 'Not stated'}`,
    '',
    `Notes: ${request.notes || 'None'}`
  ].join('\n');
}

function guestEmail(request, requestId) {
  return [
    `Hello ${request.name},`,
    '',
    'Your request for a private Aurora Chase has been received.',
    '',
    `Reference: ${requestId}`,
    `Preferred date: ${request.date}`,
    `Experience: ${request.experience}`,
    `Guests: ${request.guests}`,
    `Departure area: ${request.location}`,
    '',
    'This is not a confirmed booking yet. I will check the forecast, route, and availability personally, then contact you with the final details and payment link if the night is suitable.',
    '',
    'The Aurora is a natural phenomenon. Weather and visibility can never be guaranteed.',
    '',
    'Best regards,',
    'Alex',
    'Boreal One AB'
  ].join('\n');
}

async function sendEmail(apiKey, email) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(email)
  });
  if (!response.ok) {
    const details = await response.json().catch(() => null);
    console.error(
      'Resend email delivery failed',
      response.status,
      details?.name || 'Unknown error',
      details?.message || ''
    );
  }
  return response.ok;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'Method not allowed' }, 405, origin);
    }
    if (!request.headers.get('Content-Type')?.includes('application/json')) {
      return json({ ok: false, error: 'Unsupported content type' }, 415, origin);
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json({ ok: false, error: 'Invalid request' }, 400, origin);
    }

    if (payload.website) {
      return json({ ok: true }, 200, origin);
    }

    const booking = validateRequest(payload);
    if (!booking) {
      return json({ ok: false, error: 'Invalid booking details' }, 400, origin);
    }

    const isHuman = await verifyTurnstile(payload.turnstileToken, request, env.TURNSTILE_SECRET);
    if (!isHuman) {
      return json({ ok: false, error: 'Verification failed' }, 400, origin);
    }

    if (!env.RESEND_API_KEY) {
      return json({ ok: false, error: 'Email delivery is not configured' }, 503, origin);
    }

    const requestId = crypto.randomUUID().split('-')[0].toUpperCase();
    const from = env.BOOKING_FROM || 'Boreal One Bookings <bookings@borealone.com>';
    const recipient = env.BOOKING_RECIPIENT || 'info@borealone.com';

    const delivered = await sendEmail(env.RESEND_API_KEY, {
      from,
      to: [recipient],
      reply_to: booking.email,
      subject: `Aurora Chase request | ${booking.date} | ${booking.name}`,
      text: bookingEmail(booking, requestId)
    });

    if (!delivered) {
      return json({ ok: false, error: 'Unable to deliver request' }, 502, origin);
    }

    await sendEmail(env.RESEND_API_KEY, {
      from,
      to: [booking.email],
      reply_to: recipient,
      subject: `We received your Aurora Chase request | ${requestId}`,
      text: guestEmail(booking, requestId)
    });

    return json({ ok: true, requestId }, 200, origin);
  }
};

