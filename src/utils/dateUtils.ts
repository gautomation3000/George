const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats any date string or Date object into strict DD.MMM.YYYY format.
 * Examples:
 * - "2026-06-21T08:00:00.000Z" -> "21.Jun.2026"
 * - "21-Jun-2026" -> "21.Jun.2026"
 * - "2026-10-05" -> "05.Oct.2026"
 */
export function formatDateStamp(dateStr?: string | null): string {
  if (!dateStr || dateStr.trim() === '' || dateStr.toUpperCase() === 'NA') {
    return '—';
  }

  const clean = dateStr.trim();

  // Try parsing ISO or standard formats
  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    const day = String(parsed.getDate()).padStart(2, '0');
    const month = MONTH_NAMES[parsed.getMonth()];
    const year = parsed.getFullYear();
    return `${day}.${month}.${year}`;
  }

  // Handle DD-MMM-YYYY or DD.MMM.YYYY
  const parts = clean.split(/[-./\s]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1];
    let year = parts[2];

    // If month is numeric
    const monthNum = parseInt(month, 10);
    if (!isNaN(monthNum) && monthNum >= 1 && monthNum <= 12) {
      month = MONTH_NAMES[monthNum - 1];
    } else {
      // Capitalize 3 letter month
      month = month.charAt(0).toUpperCase() + month.slice(1, 3).toLowerCase();
    }

    if (year.length === 2) year = '20' + year;
    return `${day}.${month}.${year}`;
  }

  return clean;
}

/**
 * Calculates due days dynamically from Calibration Due Date vs Current Date.
 * Positive number = days remaining until calibration.
 * Negative number = days overdue.
 */
export function calculateDueDays(dateStr?: string | null): number | null {
  if (!dateStr || dateStr.trim() === '' || dateStr.toUpperCase() === 'NA') {
    return null;
  }

  const clean = dateStr.trim();
  let targetDate: Date | null = null;

  const direct = new Date(clean);
  if (!isNaN(direct.getTime())) {
    targetDate = direct;
  } else {
    // Try DD-MMM-YYYY
    const parts = clean.split(/[-./\s]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      let monthIndex = -1;
      const mStr = parts[1].toLowerCase();
      monthIndex = MONTH_NAMES.findIndex((m) => m.toLowerCase().startsWith(mStr.slice(0, 3)));
      if (monthIndex === -1 && !isNaN(parseInt(parts[1], 10))) {
        monthIndex = parseInt(parts[1], 10) - 1;
      }
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;

      if (!isNaN(day) && monthIndex >= 0 && !isNaN(year)) {
        targetDate = new Date(year, monthIndex, day);
      }
    }
  }

  if (!targetDate) return null;

  // Compare start of target day vs start of today
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate()).getTime();

  const diffMs = targetStart - todayStart;
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}
