export function getLocalDateString(date: Date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatDateOnly(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString();
}

export function isDateTodayOrFuture(value: string, today: Date = new Date()) {
  return value.slice(0, 10) >= getLocalDateString(today);
}
