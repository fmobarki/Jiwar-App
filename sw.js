// Jiwar — Service Worker
// نسخة الكاش: رفعها عند كل تحديث جوهري بالملفات لإجبار المتصفح على تنزيل نسخة جديدة
const CACHE_VERSION = 'jiwar-v1.0.0';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-512-maskable.png',
    './apple-touch-icon.png'
];

// تثبيت: تخزين هيكل التطبيق الأساسي مسبقًا
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL))
    );
    self.skipWaiting();
});

// التفعيل: حذف أي نسخ كاش قديمة من إصدارات سابقة
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// الجلب: كاش-أولاً للأصول المحلية، شبكة-أولاً مع رجوع للكاش لخطوط جوجل
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

    if (isGoogleFonts) {
        event.respondWith(
            caches.open(CACHE_VERSION).then((cache) =>
                fetch(event.request)
                    .then((response) => {
                        cache.put(event.request, response.clone());
                        return response;
                    })
                    .catch(() => cache.match(event.request))
            )
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // نخزّن نسخة من أي طلب GET ناجح لنفس الأصل (index.html وما شابه)
                if (event.request.method === 'GET' && response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // خارج الاتصال ولا يوجد كاش — رجّع صفحة index.html كحل أخير لطلبات التصفح
                if (event.request.mode === 'navigate') return caches.match('./index.html');
            });
        })
    );
});
