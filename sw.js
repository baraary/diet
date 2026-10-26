const CACHE_NAME = 'nutrition-pwa-v5';
const APP_SHELL = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((k) => {
          if (k !== CACHE_NAME && k !== 'nutrition-shared-auth-v1') {
            return caches.delete(k);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // هرگز درخواست‌های API جمینای، گیت‌هاب یا فایل بک‌آپ را رهگیری نکن
  if (
    url.origin !== self.location.origin ||
    url.pathname.startsWith('/api/') ||
    url.pathname === '/__nutrition_auth_backup__.json'
  ) {
    return;
  }

  // برای صفحه اصلی و فایل‌های داخلی: شبکه با تایم‌اوت ۲.۵ ثانیه، و در صورت کندی فوری از کش بخوان
  event.respondWith(
    new Promise((resolve) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          caches.match(event.request).then((cached) => {
            resolve(cached || caches.match('./index.html') || fetch(event.request));
          });
        }
      }, 2500);

      fetch(event.request)
        .then((response) => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            if (response && response.status === 200) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
            }
            resolve(response);
          }
        })
        .catch(() => {
          clearTimeout(timer);
          if (!settled) {
            settled = true;
            caches.match(event.request).then((cached) => {
              resolve(cached || caches.match('./index.html'));
            });
          }
        });
    })
  );
});
