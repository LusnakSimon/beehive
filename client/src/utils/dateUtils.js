/**
 * Format a date as a human-readable "time ago" string in Slovak.
 * 
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted string like "Pred 5 min", "Pred 2 hod", "Včera", etc.
 */
export const formatTimeAgo = (date) => {
  const now = new Date()
  const d = date instanceof Date ? date : new Date(date)
  const diffMs = now - d
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Práve teraz'
  if (diffMins < 60) return `Pred ${diffMins} min`
  if (diffHours < 24) return `Pred ${diffHours} hod`
  if (diffDays === 1) return 'Včera'
  return `Pred ${diffDays} dňami`
}
