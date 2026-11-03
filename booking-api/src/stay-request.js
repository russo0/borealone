import { dateLabel, stayNights, validStayDates } from '../../book/shared/stay-dates.mjs';

function text(value, limit) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, limit) : '';
}

export function validateStayRequest(payload) {
  const request = {
    service: 'stay', checkIn: payload.checkIn, checkOut: payload.checkOut,
    guests: Number(payload.guests), pets: Number(payload.pets ?? 0),
    name: text(payload.name, 120), email: text(payload.email, 254), phone: text(payload.phone, 60),
    language: text(payload.language, 40), locale: payload.locale || 'en', notes: text(payload.notes, 2000),
  };
  if (!validStayDates(request.checkIn, request.checkOut)) return null;
  if (!Number.isInteger(request.guests) || request.guests < 1 || request.guests > 4) return null;
  if (!Number.isInteger(request.pets) || request.pets < 0 || request.pets > 99) return null;
  if (request.name.length < 2 || request.phone.length < 5 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(request.email)) return null;
  if (!['English', 'Português'].includes(request.language)) return null;
  if (!['en', 'pt', 'sv', 'de'].includes(request.locale) || payload.terms !== true) return null;
  return { ...request, nights: stayNights(request.checkIn, request.checkOut) };
}

export function stayOwnerEmail(request, id) {
  return [
    'New stay request | The Yellow Aurora House', '', `Reference: ${id}`,
    `Arrival: ${request.checkIn} (check-in from 16:00)`, `Departure: ${request.checkOut} (check-out by 11:00)`,
    `Nights: ${request.nights}`, `Guests, including children: ${request.guests}`, `Pets: ${request.pets}`,
    'Pet fee policy: 250 SEK or EUR 25 per pet, per stay.', '',
    `Name: ${request.name}`, `Email: ${request.email}`, `Phone / WhatsApp: ${request.phone}`,
    `Language for personal contact: ${request.language}`, `Receipt language: ${request.locale}`, '',
    `Notes: ${request.notes || 'None'}`, '',
    'This is an unconfirmed stay request. Check the Booking.com calendar and any direct bookings before quoting or confirming. No dates have been blocked automatically.'
  ].join('\n');
}

const messages = {
  en: {
    locale: 'en-GB', subject: 'We received your stay request', greeting: 'Hello',
    received: 'We received your stay request for The Yellow Aurora House.', reference: 'Reference',
    arrival: 'Arrival', departure: 'Departure', nights: 'Nights', guests: 'Guests, including children', pets: 'Pets',
    times: 'Check-in from 16:00. Check-out by 11:00. All times are local to the house.',
    petPolicy: 'Pets are welcome by prior arrangement. The fee is 250 SEK or EUR 25 per pet, per stay.',
    next: 'Your stay is not confirmed yet. We will check availability and contact you with the price, final details and a secure payment link. Sending this request does not reserve any dates and no payment has been taken.',
    thanks: 'Thank you,',
  },
  pt: {
    locale: 'pt-BR', subject: 'Recebemos seu pedido de estadia', greeting: 'Olá',
    received: 'Recebemos seu pedido de estadia na The Yellow Aurora House.', reference: 'Referência',
    arrival: 'Chegada', departure: 'Saída', nights: 'Noites', guests: 'Hóspedes, incluindo crianças', pets: 'Animais',
    times: 'Check-in a partir das 16:00. Check-out até as 11:00. Todos os horários são locais da casa.',
    petPolicy: 'Animais são bem-vindos quando combinados antes da chegada. A taxa é de 250 SEK ou 25 € por animal e por estadia.',
    next: 'Sua estadia ainda não está confirmada. Vamos conferir a disponibilidade e entrar em contato com o preço, os detalhes finais e um link seguro para pagamento. O envio desta solicitação não reserva as datas e nenhum pagamento foi cobrado.',
    thanks: 'Obrigado,',
  },
  sv: {
    locale: 'sv-SE', subject: 'Vi har tagit emot din förfrågan om boende', greeting: 'Hej',
    received: 'Vi har tagit emot din förfrågan om en vistelse på The Yellow Aurora House.', reference: 'Referens',
    arrival: 'Ankomst', departure: 'Avresa', nights: 'Nätter', guests: 'Gäster, inklusive barn', pets: 'Husdjur',
    times: 'Incheckning från 16.00. Utcheckning senast 11.00. Alla tider är lokala för huset.',
    petPolicy: 'Husdjur är välkomna efter överenskommelse före ankomst. Avgiften är 250 SEK eller 25 € per husdjur och vistelse.',
    next: 'Vistelsen är ännu inte bekräftad. Vi kontrollerar tillgängligheten och kontaktar dig med pris, slutliga detaljer och en säker betalningslänk. Förfrågan reserverar inga datum och ingen betalning har tagits.',
    thanks: 'Tack,',
  },
  de: {
    locale: 'de-DE', subject: 'Wir haben Ihre Aufenthaltsanfrage erhalten', greeting: 'Hallo',
    received: 'Wir haben Ihre Anfrage für einen Aufenthalt im The Yellow Aurora House erhalten.', reference: 'Referenz',
    arrival: 'Anreise', departure: 'Abreise', nights: 'Nächte', guests: 'Gäste, einschließlich Kinder', pets: 'Haustiere',
    times: 'Check-in ab 16:00 Uhr. Check-out bis 11:00 Uhr. Alle Zeiten beziehen sich auf die Ortszeit des Hauses.',
    petPolicy: 'Haustiere sind nach vorheriger Absprache willkommen. Die Gebühr beträgt 250 SEK oder 25 € pro Haustier und Aufenthalt.',
    next: 'Ihr Aufenthalt ist noch nicht bestätigt. Wir prüfen die Verfügbarkeit und melden uns mit dem Preis, den endgültigen Details und einem sicheren Zahlungslink. Diese Anfrage reserviert keine Daten und es wurde keine Zahlung eingezogen.',
    thanks: 'Vielen Dank,',
  },
};

export function stayGuestSubject(request, id) {
  return `${messages[request.locale].subject} | The Yellow Aurora House | ${id}`;
}

export function stayGuestEmail(request, id) {
  const content = messages[request.locale];
  return [
    `${content.greeting} ${request.name},`, '', content.received, '', `${content.reference}: ${id}`,
    `${content.arrival}: ${dateLabel(request.checkIn, content.locale)}`,
    `${content.departure}: ${dateLabel(request.checkOut, content.locale)}`,
    `${content.nights}: ${request.nights}`, `${content.guests}: ${request.guests}`, `${content.pets}: ${request.pets}`,
    '', content.times, ...(request.pets > 0 ? ['', content.petPolicy] : []), '', content.next, '', content.thanks,
    'Alex & Natalia', 'The Yellow Aurora House', 'Boreal One AB'
  ].join('\n');
}
