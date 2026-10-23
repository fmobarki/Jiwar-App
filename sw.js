// ============================================================
// Jiwar Service Worker
// كل تحديث جديد للتطبيق يتطلب رفع CACHE_VERSION رقم واحد فقط
// هذا يجبر كل المستخدمين على استلام آخر نسخة تلقائياً
// ============================================================

const CACHE_VERSION = 'jiwar-v11';   // ⬅️ غيّر هذا الرقم مع كل تحديث فعلي (v12, v13, ...)
const CACHE_NAME = CACHE_VERSION;

const CORE_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    './icons/icon-192.png',
    './icons/icon-512.png',
    './icons/icon-512-maskable.png',
    './icons/apple-touch-icon.png'
];

// خطوط Google: تُخزَّن أيضاً حتى يبقى خط Cairo ظاهراً بدون إنترنت
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// عند التثبيت: خزّن الملفات الأساسية فوراً بدون انتظار
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
    );
    self.skipWaiting(); // فعّل النسخة الجديدة فوراً بدل الانتظار لإغلاق كل التبويبات
});

// عند التفعيل: احذف أي كاش قديم من إصدارات سابقة، ثم تحكّم فوري بكل الصفحات المفتوحة
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// يُخزَّن فقط: ردود ناجحة من نفس الموقع، أو ملفات الخطوط. لا تُخزَّن ردود الأخطاء (404/500)
// ولا أي خدمة خارجية أخرى (مثل واجهة المستشار الذكي)
function shouldCache(request, response) {
    const url = new URL(request.url);
    if (url.origin === self.location.origin) return response.ok && response.type === 'basic';
    if (FONT_HOSTS.includes(url.hostname)) return response.ok || response.type === 'opaque';
    return false;
}

// استراتيجية الجلب: الشبكة أولاً، والكاش فقط عند فشل الاتصال
// (يضمن دائماً أحدث نسخة عند توفر إنترنت، ويعمل offline عند انقطاعه)
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const url = new URL(event.request.url);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (shouldCache(event.request, response)) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(async () => {
                const cached = await caches.match(event.request, { ignoreSearch: true });
                if (cached) return cached;
                // فتح التطبيق بدون إنترنت من أي رابط داخلي: اعرض الصفحة الرئيسية المخزّنة
                if (event.request.mode === 'navigate') return caches.match('./index.html');
                return Response.error();
            })
    );
});
