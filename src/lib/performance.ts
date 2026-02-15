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
    } catch {
      // ignore
    }
  }

  private observeCLS() {
    try {
      if (!('PerformanceObserver' in window)) return;

      let clsValue = 0;

      type LayoutShiftEntry = PerformanceEntry & {
        value: number;
        hadRecentInput: boolean;
      };

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const layoutShiftEntry = entry as LayoutShiftEntry;
          if (!layoutShiftEntry.hadRecentInput) {
            clsValue += layoutShiftEntry.value;
          }
        }
      });

      observer.observe({ entryTypes: ['layout-shift'] });

      // Report CLS on page hide
      const reportCLS = () => {
        if (clsValue > 0) {
          this.recordMetric('CLS', clsValue);
        }
      };

      window.addEventListener('pagehide', reportCLS);
      window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          reportCLS();
        }
      });
    } catch {
      // ignore
    }
  }

  private observeFID() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const eventEntry = entry as PerformanceEventTiming;
          this.recordMetric('FID', eventEntry.processingStart - eventEntry.startTime);
        }
      });

      observer.observe({ entryTypes: ['first-input'] });
    } catch {
      // ignore
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
      });

      observer.observe({ entryTypes: ['largest-contentful-paint'] });
    } catch {
      // ignore
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
      });

      observer.observe({ entryTypes: ['paint'] });
    } catch {
      // ignore
    }
  }

  private observeTTFB() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const navEntry = entry as PerformanceNavigationTiming;
          this.recordMetric('TTFB', navEntry.responseStart);
        }
      });

      observer.observe({ entryTypes: ['navigation'] });
    } catch {
      // ignore
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
            }
          }
        }, 0);
      });
    } catch {
      // ignore
    }
  }

  private observeResourceTiming() {
    try {
      if (!('PerformanceObserver' in window)) return;

      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resourceEntry = entry as PerformanceResourceTiming;
          if (resourceEntry.duration > 1000) { // Log slow resources (>1s)
            this.recordMetric('Slow Resource', resourceEntry.duration);
          }
        }
      });

      observer.observe({ entryTypes: ['resource'] });
    } catch {
      // ignore
    }
  }

  private recordMetric(name: string, value: number) {
    try {
      const metric: PerformanceMetric = {
        name,
        value,
        timestamp: Date.now(),
      };
      this.metrics.push(metric);

      // Send to analytics if available
      type GtagFn = (...args: unknown[]) => void;
      const w = window as unknown as { gtag?: GtagFn };
      if (typeof window !== 'undefined' && w.gtag) {
        w.gtag('event', 'web_vitals', {
          event_category: 'Web Vitals',
          event_label: name,
          value: Math.round(value),
          non_interaction: true,
        });
      }
    } catch {
      // ignore
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
  (window as unknown as { performanceMonitor?: PerformanceMonitor }).performanceMonitor = performanceMonitor;
}

