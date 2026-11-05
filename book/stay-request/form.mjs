import { addDays, dateLabel, isStayDate, propertyToday, stayNights, validStayDates } from '../shared/stay-dates.mjs';
import { locales, translations } from './translations.mjs';

const element = id => document.getElementById(id);
const parameters = new URLSearchParams(window.location.search);
let savedLanguage;
try { savedLanguage = localStorage.getItem('preferred-lang'); } catch { /* Storage is optional. */ }
let language = [parameters.get('lang'), savedLanguage, navigator.language.split('-')[0]].find(value => translations[value]) || 'en';
let sending = false;
const form = element('stay-form');
const checkIn = element('check-in');
const checkOut = element('check-out');

function syncDates() {
  checkIn.min = propertyToday();
  checkOut.min = isStayDate(checkIn.value) ? addDays(checkIn.value, 1) : addDays(propertyToday(), 1);
  const nights = stayNights(checkIn.value, checkOut.value);
  const content = translations[language];
  element('stay-date-summary').textContent = nights ? content.summary.replace('{arrival}', dateLabel(checkIn.value, locales[language])).replace('{departure}', dateLabel(checkOut.value, locales[language])).replace('{nights}', nights === 1 ? content.oneNight : content.nights.replace('{count}', nights)) : '';
}

function setLanguage(next) {
  language = next;
  const content = translations[language];
  document.documentElement.lang = language === 'pt' ? 'pt-BR' : language;
  document.title = `${content.formTitle} | The Yellow Aurora House`;
  document.querySelectorAll('[data-text]').forEach(node => { node.textContent = content[node.dataset.text]; });
  document.querySelectorAll('[data-language]').forEach(button => {
    const active = button.dataset.language === language;
    button.className = `p-1 rounded border ${active ? 'border-white/30 bg-white/15' : 'border-transparent hover:bg-white/10'}`;
    button.setAttribute('aria-pressed', String(active));
  });
  element('notes').placeholder = content.notesPlaceholder;
  element('submit-button').textContent = content[sending ? 'sending' : 'submit'];
  for (const id of ['form-error', 'form-success']) {
    const key = element(id).dataset.message;
    if (key) element(id).textContent = content[key];
  }
  syncDates();
  try { localStorage.setItem('preferred-lang', language); } catch { /* Storage is optional. */ }
}

for (const [key, input] of [['checkIn', checkIn], ['checkOut', checkOut]]) {
  const value = parameters.get(key);
  if (isStayDate(value) && value >= propertyToday()) input.value = value;
}
const guests = Number(parameters.get('guests'));
if ([1, 2, 3, 4].includes(guests)) element('guests').value = guests;
const pets = Number(parameters.get('pets'));
if (Number.isInteger(pets) && pets >= 0 && pets <= 99) element('pets').value = pets;
element('contact-language').value = language === 'pt' ? 'Português' : 'English';
checkIn.addEventListener('change', syncDates);
checkOut.addEventListener('change', syncDates);
document.querySelectorAll('[data-language]').forEach(button => button.addEventListener('click', () => setLanguage(button.dataset.language)));

function message(id, key) {
  const node = element(id);
  node.dataset.message = key;
  node.textContent = translations[language][key];
  node.classList.remove('hidden');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (sending) return;
  element('form-error').classList.add('hidden');
  element('form-success').classList.add('hidden');
  syncDates();
  if (!validStayDates(checkIn.value, checkOut.value)) {
    message('form-error', 'dateError');
    return;
  }
  if (!form.checkValidity()) {
    message('form-error', 'error');
    form.reportValidity();
    return;
  }
  const data = new FormData(form);
  const token = window.borealStayToken || data.get('cf-turnstile-response');
  if (!token) {
    message('form-error', 'verification');
    return;
  }
  sending = true;
  element('submit-button').disabled = true;
  element('submit-button').textContent = translations[language].sending;
  try {
    const response = await fetch('/api/booking-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        service: 'stay', checkIn: data.get('checkIn'), checkOut: data.get('checkOut'),
        guests: data.get('guests'), pets: data.get('pets'), name: data.get('name'),
        email: data.get('email'), phone: data.get('phone'), language: data.get('language'),
        locale: language, notes: data.get('notes'), website: data.get('website'), terms: true, turnstileToken: token
      })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error('Delivery failed');
    form.reset();
    element('contact-language').value = language === 'pt' ? 'Português' : 'English';
    syncDates();
    message('form-success', 'success');
    element('form-success').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch {
    message('form-error', 'deliveryError');
  } finally {
    // Turnstile tokens are single-use, including when email delivery fails.
    window.borealStayToken = '';
    if (window.turnstile) window.turnstile.reset();
    sending = false;
    element('submit-button').disabled = false;
    element('submit-button').textContent = translations[language].submit;
  }
});

setLanguage(language);
element('submit-button').disabled = false;
