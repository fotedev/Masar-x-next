"use client";

import { useCallback, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { analytics, SystemLog } from '../lib/analytics';

export const useAnalytics = () => {
  const pathname = usePathname();
  const lastTrackedPath = useRef<string | null>(null);

  // Track page views automatically when location changes
  useEffect(() => {
    // Prevent duplicate tracking for the same pathname in the same mount cycle
    if (lastTrackedPath.current === pathname) return;
    
    analytics.trackPageView();
    lastTrackedPath.current = pathname;
  }, [pathname]);

  const trackEvent = useCallback((eventName: string, metadata?: Record<string, unknown>) => {
    analytics.trackEvent(eventName, metadata);
  }, []);

  const logError = useCallback((error: Error | string, context?: Partial<SystemLog>) => {
    analytics.logError(error, context);
  }, []);

  const log = useCallback((logData: SystemLog) => {
    analytics.log(logData);
  }, []);

  const trackSummaryView = useCallback((id: string, examInfo?: Record<string, unknown>) => {
    trackEvent('summary_view', { id, ...examInfo });
  }, [trackEvent]);

  const trackSummaryClick = useCallback((id: string, action: string) => {
    trackEvent('summary_click', { id, action });
  }, [trackEvent]);

  const trackClick = useCallback((contentType: string, contentId?: string, metadata?: Record<string, unknown>) => {
    trackEvent('click', { contentType, contentId, ...metadata });
  }, [trackEvent]);

  return {
    trackEvent,
    logError,
    log,
    trackSummaryView,
    trackSummaryClick,
    trackClick
  };
};
