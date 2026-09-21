export function formatMoney(minor, currency = 'INR') {
  const numeric = Number(minor);
  if (!Number.isFinite(numeric)) return '—';
  const value = numeric / 100;
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function formatDate(value, options = {}) {
  if (!value) return '—';
  const text = String(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(text)
    ? new Date(`${text}T12:00:00`)
    : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', ...options }).format(date);
}

export function formatMonth(value) {
  const text = String(value ?? '');
  const match = /^(\d{4})-(\d{2})$/.exec(text);
  if (!match) return '—';
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return '—';
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));
}

export function localDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function capFirst(value = '') {
  return String(value).charAt(0).toUpperCase() + String(value).slice(1);
}

export function statusLabel(value) {
  return capFirst(String(value || '').replace(/_/g, ' '));
}
