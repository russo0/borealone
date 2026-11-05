import { addDays, dateLabel, propertyToday, stayNights, validStayDates } from '../book/shared/stay-dates.mjs';
import { locales, translations } from '../book/stay-request/translations.mjs';

const element = id => document.getElementById(id);
const today = () => propertyToday();
let language = document.documentElement.lang.split('-')[0];
let arrival = '';
let departure = '';
let selecting = 'arrival';
let month = new Date(`${today().slice(0, 7)}-01T12:00:00Z`);

function render() {
  const content = translations[language] || translations.en;
  const locale = locales[language] || locales.en;
  document.querySelectorAll('[data-stay-text]').forEach(node => { node.textContent = content[node.dataset.stayText]; });
  const firstKey = month.toISOString().slice(0, 10);
  element('stay-previous').disabled = firstKey <= `${today().slice(0, 7)}-01`;
  element('stay-previous').setAttribute('aria-label', content.previous);
  element('stay-next').setAttribute('aria-label', content.next);
  element('stay-month').textContent = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(month);
  element('stay-arrival-value').textContent = arrival ? dateLabel(arrival, locale) : content.pickDate;
  element('stay-departure-value').textContent = departure ? dateLabel(departure, locale) : content.pickDate;

  ['arrival', 'departure'].forEach(field => {
    element(`stay-${field}`).className = `rounded-xl border p-3 text-left ${selecting === field ? 'border-aurora/60 bg-aurora/10' : 'border-white/15 bg-black/15'}`;
    element(`stay-${field}`).setAttribute('aria-pressed', String(selecting === field));
  });
  element('stay-weekdays').replaceChildren();
  for (let index = 0; index < 7; index += 1) {
    const label = document.createElement('span');
    label.textContent = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(new Date(Date.UTC(2024, 0, 1 + index, 12)));
    element('stay-weekdays').append(label);
  }

  element('stay-days').replaceChildren();
  for (let offset = 0; offset < (month.getUTCDay() + 6) % 7; offset += 1) {
    const spacer = document.createElement('span');
    spacer.setAttribute('aria-hidden', 'true');
    element('stay-days').append(spacer);
  }
  const lastDay = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0, 12)).getUTCDate();
  for (let day = 1; day <= lastDay; day += 1) {
    const key = addDays(firstKey, day - 1);
    const selected = key === arrival || key === departure;
    const inRange = arrival && departure && key > arrival && key < departure;
    const disabled = key < today() || (selecting === 'departure' && arrival && key <= arrival);
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = day;
    button.disabled = Boolean(disabled);
    button.setAttribute('aria-label', `${content[selecting]}: ${dateLabel(key, locale, { weekday: 'long' })}`);
    button.setAttribute('aria-pressed', String(selected));
    if (key === today()) button.setAttribute('aria-current', 'date');
    button.className = `h-10 rounded-lg text-sm border transition ${disabled ? 'border-transparent text-slate-700 cursor-not-allowed' : selected ? 'border-aurora bg-aurora text-gray-950 font-bold' : inRange ? 'border-aurora/20 bg-aurora/15 text-aurora' : key === today() ? 'border-aurora/50 text-aurora hover:bg-white/5' : 'border-transparent text-slate-200 hover:bg-white/5 hover:border-slate-600'}`;
    button.addEventListener('click', () => {
      if (selecting === 'arrival') {
        arrival = key;
        if (departure <= arrival) departure = '';
        selecting = 'departure';
      } else {
        departure = key;
        selecting = 'arrival';
      }
      render();
      element(selecting === 'departure' ? 'stay-departure' : 'stay-continue').focus({ preventScroll: true });
    });
    element('stay-days').append(button);
  }
  const nights = stayNights(arrival, departure);
  const summary = nights ? content.summary.replace('{arrival}', dateLabel(arrival, locale)).replace('{departure}', dateLabel(departure, locale)).replace('{nights}', nights === 1 ? content.oneNight : content.nights.replace('{count}', nights)) : '';
  element('stay-summary').textContent = summary;
  element('stay-instruction').textContent = nights ? '' : content[selecting === 'arrival' ? 'chooseArrival' : 'chooseDeparture'];
  element('stay-continue').disabled = !validStayDates(arrival, departure) || !element('stay-pets').checkValidity();
}

element('stay-previous').addEventListener('click', () => {
  const previous = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() - 1, 1, 12));
  if (previous.toISOString().slice(0, 7) >= today().slice(0, 7)) month = previous;
  render();
});
element('stay-next').addEventListener('click', () => {
  month = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 1, 12));
  render();
});
['arrival', 'departure'].forEach(field => element(`stay-${field}`).addEventListener('click', () => {
  selecting = field === 'departure' && !arrival ? 'arrival' : field;
  render();
}));
element('stay-pets').addEventListener('input', render);
element('stay-continue').addEventListener('click', () => {
  if (!validStayDates(arrival, departure) || !element('stay-pets').reportValidity()) return;
  const parameters = new URLSearchParams({ checkIn: arrival, checkOut: departure, guests: element('stay-guests').value, pets: element('stay-pets').value || '0', lang: language });
  window.location.href = `../book/stay-request/?${parameters}`;
});
document.addEventListener('boreal:language', event => { language = event.detail; render(); });
render();
