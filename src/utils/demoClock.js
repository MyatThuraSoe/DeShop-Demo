// Fixed "now" for the frontend-only demo.
//
// The demo seed data is generated relative to this anchor, and every relative
// date window (dashboard "today", sales trend, movement stats, month/year
// defaults) is measured from it too. Because both sides share the same fixed
// date, the seeded charts and totals never drift no matter how much real time
// passes between visits.

export const DEMO_NOW = new Date('2026-08-30T09:00:00');

export const pad2 = (n) => String(n).padStart(2, '0');

export const toDateStr = (date) =>
  `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

export const demoNow = () => new Date(DEMO_NOW.getTime());

export const demoToday = () => toDateStr(DEMO_NOW);

export const demoYear = () => DEMO_NOW.getFullYear();

export const demoMonth = () => DEMO_NOW.getMonth() + 1;
