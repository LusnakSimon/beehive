import { useState, useEffect } from 'react'
import './VarroaReminder.css'

export default function VarroaReminder() {
  const [lastCheck, setLastCheck] = useState(null)
  const [showReminder, setShowReminder] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Load last check from localStorage
    const stored = localStorage.getItem('lastVarroaCheck')
    if (stored) {
      setLastCheck(new Date(stored))
    }
    
    // Load dismissed state
    const dismissedUntil = localStorage.getItem('varroaReminderDismissed')
    if (dismissedUntil) {
      const until = new Date(dismissedUntil)
      if (until > new Date()) {
        setDismissed(true)
        return
      }
    }
    
    // Check if reminder should show
    checkReminder()
  }, [])

  const checkReminder = () => {
    if (dismissed) return
    
    const stored = localStorage.getItem('lastVarroaCheck')
    if (!stored) {
      // No check recorded - show reminder
      setShowReminder(true)
      return
    }
    
    const lastCheckDate = new Date(stored)
    const daysSinceCheck = Math.floor((new Date() - lastCheckDate) / (1000 * 60 * 60 * 24))
    
    // Show reminder if more than 14 days (2 weeks) since last check
    if (daysSinceCheck >= 14) {
      setShowReminder(true)
    }
  }

  const markAsChecked = () => {
    const now = new Date()
    localStorage.setItem('lastVarroaCheck', now.toISOString())
    setLastCheck(now)
    setShowReminder(false)
    setDismissed(false)
  }

  const dismissReminder = (days = 7) => {
    const dismissUntil = new Date()
    dismissUntil.setDate(dismissUntil.getDate() + days)
    localStorage.setItem('varroaReminderDismissed', dismissUntil.toISOString())
    setDismissed(true)
    setShowReminder(false)
  }

  if (!showReminder || dismissed) return null

  return (
    <div className="varroa-reminder">
      <div className="varroa-reminder-content">
        <div className="varroa-icon">🐛</div>
        <div className="varroa-text">
          <h3>Pripomienka: Kontrola kliešťov Varroa</h3>
          <p>
            {lastCheck 
              ? `Posledná kontrola bola ${Math.floor((new Date() - lastCheck) / (1000 * 60 * 60 * 24))} dní dozadu.`
              : 'Ešte ste neurobili kontrolu klieštov Varroa.'}
          </p>
          <p className="varroa-info">
            Odporúčame pravidelné kontroly každé 2 týždne, najmä v letných mesiacoch.
          </p>
        </div>
        <div className="varroa-actions">
          <button onClick={markAsChecked} className="btn btn-primary">
            ✅ Kontrola vykonaná
          </button>
          <button onClick={() => dismissReminder(7)} className="btn btn-secondary">
            ⏰ Pripomenúť o týždeň
          </button>
          <button onClick={() => setShowReminder(false)} className="btn btn-text">
            ✕ Zavrieť
          </button>
        </div>
      </div>
    </div>
  )
}
