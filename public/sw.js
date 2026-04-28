// Service Worker للتعامل مع الإشعارات وPWA
// Updated for Next.js App Router

const CACHE_NAME = 'masarx-v3';

// Simple environment check helper for SW
const isDev = (url) => {
  return url.hostname === 'localhost' || 
         url.hostname === '127.0.0.1' || 
         url.hostname.endsWith('.local');
};

// تثبيت Service Worker
self.addEventListener('install', (event) => {
  if (isDev(new URL(self.location.href))) {
    console.log('Service Worker installing.');
  }
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll with only essential files that should exist
      // Handle failures gracefully - don't block SW installation
      const essentialFiles = [
        '/',
        '/manifest.json',
        '/logo.png'
      ];

      // Try to cache essential files, but don't fail if some are missing
      return Promise.allSettled(
        essentialFiles.map(file =>
          cache.add(file).catch(err => {
            console.warn(`Failed to cache ${file}:`, err.message);
            return null;
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// تفعيل Service Worker
self.addEventListener('activate', (event) => {
  if (isDev(new URL(self.location.href))) {
    console.log('Service Worker activating.');
  }
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Cache Strategy للتحسين الأداء
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // تخطي API calls - خليهم يروحوا للشبكة
  if (url.pathname.startsWith('/api/') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('puter.com') ||
    event.request.method !== 'GET') {
    return;
  }

  // Network-first for navigation requests to prevent stale page loops
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Optional: match existing v3 logic by caching successful navigation
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request).then((resp) => resp || caches.match('/'));
        })
    );
    return;
  }

  // Skip development resources

  // Stale-while-revalidate strategy للصفحات والأصول الثابتة
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            // Cache successful responses
            if (networkResponse && networkResponse.ok) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                // Don't cache if not http/https (e.g. chrome-extension)
                if (url.protocol.startsWith('http')) {
                  cache.put(event.request, responseClone).catch(() => {
                    // Ignore cache put failures
                  });
                }
              }).catch(() => {
                // Ignore cache open failures
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            // Network request failed, return cached response if available
            if (isDev(url)) {
              console.warn('Fetch failed for:', event.request.url, error.message);
            }
            if (cachedResponse) {
              return cachedResponse;
            }
            // If no cached response and it's a document, return cached homepage
            if (event.request.destination === 'document') {
              return caches.match('/');
            }
            // For other resources, return a clean error response
            return new Response('', {
              status: 504,
              statusText: 'Gateway Timeout'
            });
          });

        // Return cached version immediately if available, otherwise wait for network
        return cachedResponse || fetchPromise;
      })
      .catch((error) => {
        if (isDev(url)) {
          console.warn('Cache match failed:', error.message);
        }
        // Offline fallback
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
        return new Response('', {
          status: 504,
          statusText: 'Gateway Timeout'
        });
      })
  );
});

// استقبال الرسائل من التطبيق الرئيسي
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'NOTIFICATION_REQUEST') {
    const { title, body, icon, tag } = event.data.payload;

    self.registration.showNotification(title, {
      body: body,
      icon: icon || '/logo.png',
      badge: '/logo.png',
      tag: tag || 'masarx-notification',
      requireInteraction: false,
      silent: false,
      actions: [
        {
          action: 'view',
          title: 'عرض'
        },
        {
          action: 'close',
          title: 'إغلاق'
        }
      ]
    });
  }

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// التعامل مع النقر على الإشعار
self.addEventListener('notificationclick', (event) => {
  console.log('Notification click received.');

  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  // افتح التطبيق أو انتقل لصفحة معينة
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const url = event.action === 'view' ? '/' : '/';

      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// التعامل مع الإشعارات المغلقة
self.addEventListener('notificationclose', (event) => {
  console.log('Notification closed.', event);
});

// تسجيل الاشتراك في الإشعارات (للاستخدام المستقبلي مع FCM أو خدمة إشعارات أخرى)
self.addEventListener('push', (event) => {
  console.log('Push message received.');

  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body || 'إشعار جديد من Masar X',
      icon: data.icon || '/logo.png',
      badge: '/logo.png',
      tag: data.tag || 'masarx-push',
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      actions: [
        {
          action: 'view',
          title: 'عرض'
        },
        {
          action: 'close',
          title: 'إغلاق'
        }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title || 'Masar X', options)
    );
  }
});

// معالجة الخلفية للإشعارات (background sync)
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  if (event.tag === 'background-notification') {
    event.waitUntil(sendBackgroundNotification());
  }
});

async function sendBackgroundNotification() {
  try {
    // هنا يمكن إضافة منطق لإرسال إشعارات في الخلفية
    console.log('Background notification sent');
  } catch (error) {
    console.error('Background notification failed:', error);
  }
}

