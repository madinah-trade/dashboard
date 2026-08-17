/* عامل الخدمة — لوحة قيادة إدارة العروض والشراكات
   يجعل اللوحة تُثبَّت كتطبيق ويفتح بلا إنترنت.

   القاعدة الحاكمة: الصفحة نفسها «الشبكة أولًا» — أي نسخة جديدة تُنشر من زر
   «حفظ وانشر» تظهر فورًا عند وجود إنترنت، والنسخة المخزَّنة احتياطٌ للانقطاع فقط.
   الأيقونات وبقية الملفات «المخزَّن أولًا» لأنها لا تتغيّر.

   عند تحديث هذا الملف: ارفع رقم CACHE_VERSION سطرًا واحدًا ليُنظَّف القديم. */

const CACHE_VERSION = 'v1';
const CACHE = 'mdmo-trade-' + CACHE_VERSION;

/* الأصول الثابتة — تُجلب مرة وتبقى */
const STATIC_ASSETS = [
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './favicon-32.png',
];

/* الصفحة — تُخزَّن أيضًا لتعمل بلا إنترنت */
const PAGE = './index.html';

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    /* كلٌّ على حدة: فشل ملفٍ واحد يجب ألّا يُسقط التثبيت كله */
    await Promise.all(
      [PAGE, ...STATIC_ASSETS].map((u) => cache.add(u).catch(() => {}))
    );
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('mdmo-trade-') && k !== CACHE)
          .map((k) => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;

  /* لا نتدخّل إلا في طلبات GET من نطاق اللوحة نفسه.
     الرفع إلى غيتهب والبريد وواجهة الذكاء الاصطناعي تمرّ كما هي. */
  if (req.method !== 'GET') return;

  let url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  const isPage =
    req.mode === 'navigate' ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('/index.html');

  if (isPage) {
    /* الشبكة أولًا — النسخة المنشورة حديثًا تفوز دائمًا */
    e.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        if (fresh && fresh.ok) {
          const cache = await caches.open(CACHE);
          cache.put(PAGE, fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cache = await caches.open(CACHE);
        const hit = (await cache.match(req)) || (await cache.match(PAGE));
        if (hit) return hit;
        return new Response(
          '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8">' +
          '<title>لا يوجد اتصال</title>' +
          '<body style="margin:0;display:grid;place-items:center;height:100vh;' +
          'background:#FBF7EC;color:#13282E;font-family:Tahoma,Arial,sans-serif;text-align:center">' +
          '<div><p style="font-size:19px;margin:0 0 6px">لا يوجد اتصال بالإنترنت</p>' +
          '<p style="font-size:15px;color:#4A5A5E;margin:0">افتح اللوحة مرةً واحدة وأنت متصل، ثم ستعمل بعدها دون اتصال.</p></div>',
          { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      }
    })());
    return;
  }

  /* بقية ملفات النطاق — المخزَّن أولًا */
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch (err) {
      return new Response('', { status: 504 });
    }
  })());
});
