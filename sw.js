// ============================================================
// Jiwar Service Worker
// كل تحديث جديد للتطبيق يتطلب رفع CACHE_VERSION رقم واحد فقط
// هذا يجبر كل المستخدمين على استلام آخر نسخة تلقائياً
// ============================================================

const CACHE_VERSION = 'jiwar-v3';   // ⬅️ غيّر هذا الرقم مع كل تحديث فعلي (v3, v4, ...)
const CACHE_NAME = CACHE_VERSION;

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico'
];

// عند التثبيت: خزّن الملفات الأساسية فوراً بدون انتظار
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting(); // فعّل النسخة الجديدة فوراً بدل الانتظار لإغلاق كل التبويبات
});

// عند التفعيل: احذف أي كاش قديم من إصدارات سابقة
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        )
    );
    self.clients.claim(); // تحكّم فوري بكل الصفحات المفتوحة
});

// استراتيجية الجلب: الشبكة أولاً، والكاش فقط عند فشل الاتصال
// (يضمن دائماً أحدث نسخة عند توفر إنترنت، ويعمل offline عند انقطاعه)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                const clone = response.clone();
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                return response;
            })
            .catch(() => caches.match(event.request))
    );
});
