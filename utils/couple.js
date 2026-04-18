export const STORAGE_KEYS = {
  DRAFT: 'couple_moment_draft',
  NOTICE: 'couple_notice',
};

function pad(value) {
  return value < 10 ? `0${value}` : `${value}`;
}

export function formatDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toDateValue(dateText) {
  return new Date(`${dateText}T00:00:00`).getTime();
}

export function getDaysBetween(startDate, endDate = formatDate()) {
  if (!startDate || !endDate) return 0;
  const diffTime = toDateValue(endDate) - toDateValue(startDate);
  return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1);
}

export function getDateDistance(targetDate, baseDate = formatDate()) {
  if (!targetDate || !baseDate) return 0;
  const diffTime = toDateValue(targetDate) - toDateValue(baseDate);
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
}
