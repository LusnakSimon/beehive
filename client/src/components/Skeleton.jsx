import React from 'react';
import './Skeleton.css';

/**
 * Skeleton loading placeholder component
 * Use for content that's loading to prevent layout shift
 */
export function Skeleton({ 
  variant = 'text', 
  width, 
  height, 
  className = '',
  count = 1,
  style = {}
}) {
  const baseClass = `skeleton skeleton-${variant}`;
  const customStyle = {
    ...style,
    ...(width && { width }),
    ...(height && { height })
  };

  if (count > 1) {
    return (
      <>
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className={`${baseClass} ${className}`} style={customStyle} />
        ))}
      </>
    );
  }

  return <div className={`${baseClass} ${className}`} style={customStyle} />;
}

/**
 * Card skeleton for dashboard metrics
 */
export function MetricCardSkeleton() {
  return (
    <div className="skeleton-card">
      <div className="skeleton-card-header">
        <Skeleton variant="circle" width="40px" height="40px" />
        <Skeleton width="60%" height="16px" />
      </div>
      <Skeleton width="50%" height="48px" style={{ marginTop: '1rem' }} />
      <Skeleton width="80%" height="12px" style={{ marginTop: '0.5rem' }} />
      <Skeleton variant="rect" height="60px" style={{ marginTop: '1rem' }} />
    </div>
  );
}

/**
 * Dashboard loading skeleton
 */
export function DashboardSkeleton() {
  return (
    <div className="dashboard-skeleton">
      <div className="skeleton-header">
        <Skeleton width="200px" height="32px" />
        <Skeleton width="100px" height="40px" style={{ borderRadius: '10px' }} />
      </div>
      <Skeleton variant="rect" height="80px" style={{ marginBottom: '1.5rem' }} />
      <div className="skeleton-metrics-grid">
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
        <MetricCardSkeleton />
      </div>
    </div>
  );
}

export default Skeleton;
