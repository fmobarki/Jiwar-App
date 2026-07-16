// Jiwar — Service Worker
// نسخة الكاش: رفعها عند كل تحديث جوهري بالملفات لإجبار المتصفح على تنزيل نسخة جديدة
const CACHE_VERSION = 'jiwar-v1.0.2';
const APP_SHELL = [
    './',
    './index.html',
    './manifest.json',
    './icon-192.png',
    './icon-512.png',
    './icon-512-maskable.png',
    './apple-touch-icon.png'
];

// تثبيت: تخزين هيكل التطبيق الأساسي مسبقًا (fetch بدون كاش HTTP لضمان نسخة طازجة فعلاً)
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_VERSION).then((cache) =>
            Promise.all(
                APP_SHELL.map((url) =>
                    fetch(url, { cache: 'reload' })
                        .then((response) => cache.put(url, response))
                        .catch((err) => console.warn('Failed to cache', url, err))
                )
            )
        )
    );
    // ملاحظة: لا نستدعي skipWaiting() هنا تلقائيًا —
    // نتركه "منتظرًا" عمدًا حتى يظهر بانر "تحديث الآن" للمستخدم ويختار بنفسه.
    // بدون هذا التأجيل، يستحيل عمليًا اكتشاف وجود نسخة جديدة وعرض البانر.
});

// رسالة من الصفحة: المستخدم ضغط "تحديث الآن" بالبانر → فعّل النسخة الجديدة فورًا
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
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
    // استيلاء فوري على الصفحات الحالية
    self.clients.claim();
});

// الجلب: كاش-أولاً للأصول المحلية، شبكة-أولاً مع رجوع للكاش لخطوط جوجل
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const isGoogleFonts = url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com');

    if (isGoogleFonts) {
        // خطوط: حاول الشبكة أولاً ثم الكاش
        event.respondWith(
            caches.open(CACHE_VERSION).then((cache) =>
                fetch(event.request)
                    .then((response) => {
                        if (response.ok) cache.put(event.request, response.clone());
                        return response;
                    })
                    .catch(() => cache.match(event.request) || new Response('Offline'))
            )
        );
        return;
    }

    // الملفات المحلية: كاش-أولاً
    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            
            return fetch(event.request).then((response) => {
                // خزّن نسخة من أي طلب GET ناجح لنفس الأصل
                if (event.request.method === 'GET' && response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // خارج الاتصال ولا يوجد كاش — رجّع index.html لطلبات التصفح
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html') || new Response('Offline');
                }
            });
        })
    );
});
