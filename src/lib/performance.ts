// Performance monitoring utilities
interface PerformanceMetric {
  name: string;
  value: number;
  timestamp: number;
  navigationType?: string;
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];

  constructor() {
    this.init();
  }

  private init() {
    try {
      // Check if PerformanceObserver is supported
      if (typeof window === 'undefined' || !('PerformanceObserver' in window)) {
        console.warn('PerformanceObserver is not supported in this browser');
        return;
      }

      // Monitor Core Web Vitals
      this.observeCLS();
      this.observeFID();
      this.observeLCP();
      this.observeFCP();
      this.observeTTFB();

      // Monitor navigation timing
      this.observeNavigationTiming();

      // Monitor resource loading
      this.observeResourceTiming();
    } catch (error) {
      console.error('Failed to initialize performance monitoring:', error);
    }
  }

  private observeCLS() {
    try {
      if (!('PerformanceObserver' in window)) return;

      let clsValue = 0;
      let sessionEntries: PerformanceEntry[] = [];

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!(entry as any).hadRecentInput) {
            clsValue += (entry as any).value;
            sessionEntries.push(entry);
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });

      // Report CLS on page hide
      const reportCLS = () => {
        if (clsValue > 0) {
          this.recordMetric('CLS', clsValue);
          console.log(`CLS: ${clsValue}`);
        }
      };

      window.addEventListener('pagehide', reportCLS);
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          reportCLS();
        }
      });
    } catch (e) {
      console.warn('CLS observation failed:', e);
    }
  }

  private observeFID() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEventTiming;
          this.recordMetric('FID', eventEntry.processingStart - eventEntry.startTime);
          console.log(`FID: ${eventEntry.processingStart - eventEntry.startTime}ms`);
        }
      });

      observer.observe({ entryTypes: ['first-input'] });
    } catch (e) {
      console.warn('FID observation failed:', e);
    }
  }

  private observeLCP() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length === 0) return;
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('LCP', lastEntry.startTime);
        console.log(`LCP: ${lastEntry.startTime}ms`);
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('LCP observation failed:', e);
    }
  }

  private observeFCP() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        if (entries.length === 0) return;
        const lastEntry = entries[entries.length - 1];
        this.recordMetric('FCP', lastEntry.startTime);
        console.log(`FCP: ${lastEntry.startTime}ms`);
      });

      observer.observe({ entryTypes: ['paint'] });
    } catch (e) {
      console.warn('FCP observation failed:', e);
    }
  }

  private observeTTFB() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          this.recordMetric('TTFB', navEntry.responseStart);
          console.log(`TTFB: ${navEntry.responseStart}ms`);
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
    } catch (e) {
      console.warn('TTFB observation failed:', e);
    }
  }

  private observeNavigationTiming() {
    try {
      window.addEventListener('load', () => {
        setTimeout(() => {
          if (typeof performance !== 'undefined' && performance.getEntriesByType) {
            const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
            if (navigation) {
              this.recordMetric('DOM Content Loaded', navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart);
              this.recordMetric('Load Complete', navigation.loadEventEnd - navigation.loadEventStart);
              console.log(`Page Load Time: ${navigation.loadEventEnd - navigation.loadEventStart}ms`);
            }
          }
        }, 0);
      });
    } catch (e) {
      console.warn('Navigation timing observation failed:', e);
    }
  }

  private observeResourceTiming() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resourceEntry = entry as PerformanceResourceTiming;
          if (resourceEntry.duration > 1000) { // Log slow resources (>1s)
            console.log(`Slow resource: ${resourceEntry.name} (${resourceEntry.duration}ms)`);
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch (e) {
      console.warn('Resource timing observation failed:', e);
    }
  }

  private recordMetric(name: string, value: number) {
    try {
      const navigationEntry = typeof performance !== 'undefined' && performance.getEntriesByType
        ? (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming)
        : null;

      const metric: PerformanceMetric = {
        name,
        value: Math.round(value * 100) / 100,
        timestamp: Date.now(),
        navigationType: navigationEntry?.type
      };

      this.metrics.push(metric);

      // Send to analytics if available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'web_vitals', {
          event_category: 'Web Vitals',
          event_label: name,
          value: Math.round(value),
          non_interaction: true,
        });
      }
    } catch (e) {
      // Silently fail for metric recording
    }
  }

  public getMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }

  public clearMetrics(): void {
    this.metrics = [];
  }
}

// Initialize performance monitoring
export const performanceMonitor = new PerformanceMonitor();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}

