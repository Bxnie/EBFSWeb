// Loaded ticket data from spreadsheet
window.TICKET_DATA_LOADED = fetch('ticket-data.json').then(r => r.json());

// Loaded "what's on tonight" override (manually edited per show)
window.CURRENT_EVENT_LOADED = fetch('current-event.json')
  .then(r => r.ok ? r.json() : null)
  .catch(() => null);

// Helpers
window.formatDay = (d) => {
  const n = d % 100;
  if (n >= 11 && n <= 13) return d.toString().padStart(2,'0') + 'TH';
  const last = d % 10;
  if (last === 1) return d.toString().padStart(2,'0') + 'ST';
  if (last === 2) return d.toString().padStart(2,'0') + 'ND';
  if (last === 3) return d.toString().padStart(2,'0') + 'RD';
  return d.toString().padStart(2,'0') + 'TH';
};

// Just the suffix for a day number (no padding, no number)
window.daySuffix = (d) => {
  const n = d % 100;
  if (n >= 11 && n <= 13) return 'TH';
  const last = d % 10;
  if (last === 1) return 'ST';
  if (last === 2) return 'ND';
  if (last === 3) return 'RD';
  return 'TH';
};

// Status from sales %
// >= 95% sold => sold out, >= ~77% sold (1000/1300 baseline) => low tickets, otherwise blank
window.statusFor = (pct) => {
  if (pct >= 0.95) return 'sold';
  if (pct >= (1000 / 1300)) return 'low';
  return null;
};

// Group events by month (calendar month)
window.groupByMonth = (events) => {
  const map = new Map();
  events.forEach(e => {
    const key = `${e.year}-${e.month}`;
    if (!map.has(key)) map.set(key, { key, year: e.year, month: e.month, monthName: e.monthName, events: [] });
    map.get(key).events.push(e);
  });
  return [...map.values()].sort((a,b) => (a.year-b.year) || (a.month-b.month));
};

// Cleanup names from spreadsheet
window.cleanName = (n) => {
  if (!n) return '';
  let out = n.trim();
  // shorten verbose names
  out = out.replace(/^fakemink:.*$/i, 'Fakemink');
  out = out.replace(/^Despised Icon, Carnifex, Suffocation$/i, 'Despised Icon + Carnifex');
  out = out.replace(/^Chuckie & Tazer Present RNB & Slow Jams$/i, 'RNB & Slow Jams');
  out = out.replace(/PRIMAL SCREAM - XTRMNTR/i, 'Primal Scream — XTRMNTR');
  // title case if all caps
  if (out === out.toUpperCase() && out.length > 3) {
    out = out.toLowerCase().replace(/\b([a-z])/g, (m,c) => c.toUpperCase());
  }
  return out;
};
