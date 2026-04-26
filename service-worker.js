// =====================================================
// 🔧 Student Portal — Service Worker (PWA)
// เพิ่ม version เมื่อแก้ไขไฟล์ เพื่อให้ cache อัปเดต
// =====================================================
const CACHE_NAME = "student-portal-v4";

// 🟢 เปลี่ยน /wkk-learning/ เป็น /69/ ทั้งหมด
const STATIC_ASSETS = [
  "./index.html",
  "./submit-script.js",
  "./submit-style.css",
  "./manifest.json",
  "https://cdn.tailwindcss.com",
  "https://cdn.jsdelivr.net/npm/lucide@0.263.0/dist/umd/lucide.min.js",
  "https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&display=swap",
];

// =====================================================
// 1. INSTALL — ดาวน์โหลด static assets ครั้งแรก
// =====================================================
self.addEventListener("install", (event) => {
  console.log("[SW] Installing...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll จะ fail ถ้าไฟล์ใดไฟล์หนึ่งโหลดไม่ได้
      // ใช้ add ทีละไฟล์แทนเพื่อความปลอดภัย
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Could not cache:", url, err);
          })
        )
      );
    }).then(() => {
      console.log("[SW] Install complete");
      return self.skipWaiting(); // ให้ SW ใหม่เข้าควบคุมทันที ไม่ต้องรอปิด tab
    })
  );
});

// =====================================================
// 2. ACTIVATE — ลบ cache เก่าออก
// =====================================================
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating...");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      )
    ).then(() => {
      console.log("[SW] Activate complete");
      return self.clients.claim(); // ควบคุม tab ที่เปิดอยู่ทันที
    })
  );
});

// =====================================================
// 3. FETCH — กลยุทธ์การโหลด
// =====================================================
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // ❌ ไม่ cache: Firebase, Google APIs
  const skipCache =
    url.hostname.includes("firestore.googleapis.com") ||
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
          // 🟢 ถ้าออฟไลน์ ให้เปิดหน้า index.html จากโฟลเดอร์ /69/
          if (event.request.destination === "document") {
           return caches.match("./index.html");
          }
          
          // 🟢 ดัก Error: Failed to convert value to 'Response'
          return new Response('', { status: 404, statusText: 'Not Found' });
        });
      })
  );
});

// =====================================================
// 4. รับ message จากหน้าเว็บ (เช่น สั่ง skip cache)
// =====================================================
self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") {
    self.skipWaiting();
  }
});