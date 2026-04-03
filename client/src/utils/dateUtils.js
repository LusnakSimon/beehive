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

/**
 * Format a date for display using Slovak locale.
 * 
 * @param {Date|string} date - The date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
export const formatDate = (date, options = {}) => {
  const d = date instanceof Date ? date : new Date(date)
  const defaultOptions = {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options
  }
  return d.toLocaleDateString('sk-SK', defaultOptions)
}

/**
 * Format a date with time for display using Slovak locale.
 * 
 * @param {Date|string} date - The date to format
 * @returns {string} Formatted datetime string
 */
export const formatDateTime = (date) => {
  const d = date instanceof Date ? date : new Date(date)
  return d.toLocaleDateString('sk-SK', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
