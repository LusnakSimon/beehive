import React from 'react';
import './EmptyState.css';

/**
 * Empty state component for when there's no data to display
 */
export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
  actionText,
  variant = 'default'
}) {
  return (
    <div className={`empty-state empty-state-${variant}`} role="status">
      <div className="empty-state-icon" aria-hidden="true">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {description && <p className="empty-state-description">{description}</p>}
      {action && actionText && (
        <button className="empty-state-action" onClick={action}>
          {actionText}
        </button>
      )}
    </div>
  );
}

// Pre-configured empty states for common scenarios
export const EmptyStates = {
  NoHives: () => (
    <EmptyState
      icon="🐝"
      title="Žiadne úle"
      description="Zatiaľ nemáte pridané žiadne úle. Pridajte svoj prvý úľ a začnite monitorovať."
      actionText="Pridať úľ"
    />
  ),
  
  NoData: () => (
    <EmptyState
      icon="📊"
      title="Žiadne dáta"
      description="Pre tento úľ zatiaľ nie sú k dispozícii žiadne údaje. Skontrolujte pripojenie senzora."
    />
  ),
  
  NoInspections: () => (
    <EmptyState
      icon="📋"
      title="Žiadne kontroly"
      description="Zatiaľ ste nevykonali žiadnu kontrolu. Zaznamenajte svoju prvú kontrolu úľa."
      actionText="Pridať kontrolu"
    />
  ),
  
  NoFriends: () => (
    <EmptyState
      icon="👥"
      title="Žiadni priatelia"
      description="Zatiaľ nemáte žiadnych priateľov. Vyhľadajte a pridajte si priateľov včelárov."
      actionText="Nájsť priateľov"
    />
  ),
  
  NoMessages: () => (
    <EmptyState
      icon="💬"
      title="Žiadne správy"
      description="Zatiaľ nemáte žiadne správy. Začnite konverzáciu s priateľom."
    />
  ),
  
  NoNotifications: () => (
    <EmptyState
      icon="🔔"
      title="Žiadne upozornenia"
      description="Momentálne nemáte žiadne upozornenia."
      variant="compact"
    />
  ),
  
  Error: ({ retry }) => (
    <EmptyState
      icon="⚠️"
      title="Niečo sa pokazilo"
      description="Pri načítavaní dát došlo k chybe. Skúste to prosím znova."
      action={retry}
      actionText="Skúsiť znova"
      variant="error"
    />
  ),
  
  Offline: () => (
    <EmptyState
      icon="📡"
      title="Ste offline"
      description="Zdá sa, že nemáte pripojenie k internetu. Skontrolujte svoje pripojenie."
      variant="warning"
    />
  ),

  SearchNoResults: ({ query }) => (
    <EmptyState
      icon="🔍"
      title="Žiadne výsledky"
      description={`Pre "${query}" sme nenašli žiadne výsledky. Skúste iné kľúčové slová.`}
    />
  )
};

export default EmptyState;
