"use client";

import { useCallback } from 'react';
import { analytics, SystemLog } from '../lib/analytics';

export const useAnalytics = () => {
  // Page-view tracking was removed with the lean-analytics migration
  // (2026-10-21): the Postgres analytics table receives no event rows.
  // Meaningful signals (downloads, AI usage, active users) go through
  // lib/metrics-client.ts; user_login is recorded in AuthContext.

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
