// =====================================================
// 🔧 Student Portal — Service Worker (PWA)
// =====================================================
const CACHE_NAME = "student-portal-v6";

const STATIC_ASSETS = [
  "./index.html",
  "./submit-script.js",
  "./submit-style.css",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/lucide@0.263.0/dist/umd/lucide.min.js",
  "https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap"
];

// 1. INSTALL — ดาวน์โหลด static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  self.skipWaiting(); 
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.error("[SW] Failed to cache:", url, err);
          })
        )
      );
    })
  );
});

// 2. ACTIVATE — ลบแคชเวอร์ชันเก่าทิ้ง
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) 
  );
});

// 3. FETCH — ดึงข้อมูลจาก Network หรือ Cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ข้ามการแคชสำหรับ API หรือ Database ภายนอก
  const skipCache =
    url.hostname.includes("firebasedatabase.app") ||
    url.hostname.includes("googleapis.com") ||
    url.hostname.includes("script.google.com") ||
    url.hostname.includes("pic.in.th") ||
    event.request.method !== "GET";

  if (skipCache) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.destination === "document") {
            return caches.match("./index.html"); 
          }
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
      })
  );
});