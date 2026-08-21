// Service Worker للتعامل مع الإشعارات وPWA
// Updated for Next.js App Router
//
// ⚠️ DO NOT EDIT public/sw.js DIRECTLY — it is generated from this template
// by scripts/inject-sw-version.mjs at build/dev time. The masarx-local-1787276276052
// placeholder below is replaced with the current Vercel commit SHA so
// every deploy produces a different Service Worker byte sequence, which
// forces the browser to install + activate the new SW and purge the
// previous cache automatically.

const CACHE_NAME = "masarx-local-1787276276052";

// Simple environment check helper for SW
const isDev = (url) => {
  return url.hostname === "localhost" ||
    url.hostname === "127.0.0.1" ||
    url.hostname.endsWith(".local");
};

// تثبيت Service Worker
// Pre-cache removed: every request now uses an explicit strategy below.
// Manifest + favicon are cheap to cache at runtime when first requested.
self.addEventListener("install", (event) => {
  if (isDev(new URL(self.location.href))) {
    console.log("Service Worker installing.");
  }
  self.skipWaiting();
});

// تفعيل Service Worker — امسح أي كاش قديم (versions قبل الـ build الحالي)
self.addEventListener("activate", (event) => {
  if (isDev(new URL(self.location.href))) {
    console.log("Service Worker activating.");
  }
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("Deleting old cache:", key);
            return caches.delete(key);
          })
      );
      await self.clients.claim();
    })()
  );
});

// Cache Strategy
// 1) Navigation (HTML): network-only, fall back to cache ONLY if offline.
// 2) Next.js hashed chunks (/_next/static/*): cache-first — filenames are
//    content-hashed and immutable per build, so an old hash will simply
//    404 from the network.
// 3) Everything else (images, fonts, third-party): network-first with
//    cache fallback for offline.
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // تخطي POST/PUT/DELETE — خليهم يروحوا للشبكة مباشرة
  if (request.method !== "GET") return;

  // تخطي API calls (Supabase, Puter) — كلها dynamic وبتستخدم session cookies
  if (
    url.pathname.startsWith("/api/") ||
    url.hostname.includes("supabase") ||
    url.hostname.includes("puter.com")
  ) {
    return;
  }

  // 1) Navigation (HTML): network-only
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(request).then((r) => r || caches.match("/"))
      )
    );
    return;
  }

  // 2) Next.js hashed chunks: cache-first
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          }
          return response;
        } catch (err) {
          return cached || new Response("", { status: 504 });
        }
      })()
    );
    return;
  }

  // 3) Everything else: network-first with cache fallback
  event.respondWith(
    (async () => {
      try {
        const response = await fetch(request);
        if (response.ok && url.protocol.startsWith("http")) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return response;
      } catch (err) {
        if (isDev(url)) {
          console.warn("Fetch failed for:", request.url, err.message);
        }
        const cached = await caches.match(request);
        if (cached) return cached;
        if (request.destination === "document") return caches.match("/");
        return new Response("", { status: 504 });
      }
    })()
  );
});

// استقبال الرسائل من التطبيق الرئيسي
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "NOTIFICATION_REQUEST") {
    const { title, body, icon, tag } = event.data.payload;

    self.registration.showNotification(title, {
      body: body,
      icon: icon || "/favicon.svg",
      badge: "/favicon.svg",
      tag: tag || "masarx-notification",
      requireInteraction: false,
      silent: false,
      actions: [
        {
          action: "view",
          title: "عرض",
        },
        {
          action: "close",
          title: "إغلاق",
        },
      ],
    });
  }

  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// التعامل مع النقر على الإشعار
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received.");

  event.notification.close();

  if (event.action === "close") {
    return;
  }

  // افتح التطبيق أو انتقل لصفحة معينة
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        const url = event.action === "view" ? "/" : "/";

        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url === url && "focus" in client) {
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
self.addEventListener("notificationclose", (event) => {
  console.log("Notification closed.", event);
});

// تسجيل الاشتراك في الإشعارات (للاستخدام المستقبلي مع FCM أو خدمة إشعارات أخرى)
self.addEventListener("push", (event) => {
  console.log("Push message received.");

  if (event.data) {
    const data = event.data.json();

    const options = {
      body: data.body || "إشعار جديد من Masar X",
      icon: data.icon || "/favicon.svg",
      badge: "/favicon.svg",
      tag: data.tag || "masarx-push",
      requireInteraction: data.requireInteraction || false,
      data: data.data || {},
      actions: [
        {
          action: "view",
          title: "عرض",
        },
        {
          action: "close",
          title: "إغلاق",
        },
      ],
    };

    event.waitUntil(
      self.registration.showNotification(data.title || "Masar X", options)
    );
  }
});

// معالجة الخلفية للإشعارات (background sync)
self.addEventListener("sync", (event) => {
  console.log("Background sync triggered:", event.tag);

  if (event.tag === "background-notification") {
    event.waitUntil(sendBackgroundNotification());
  }
});

async function sendBackgroundNotification() {
  try {
    // هنا يمكن إضافة منطق لإرسال إشعارات في الخلفية
    console.log("Background notification sent");
  } catch (error) {
    console.error("Background notification failed:", error);
  }
}
