// EclipseFlow Service Worker
// 离线缓存 + 推送通知
// 策略：网络优先，失败时用缓存兜底

const CACHE_NAME = 'eclipseflow-v3';
const CACHE_URLS = [
    './',
    'index.html',
    'login.html',
    'style.css',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@100..900&family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,1,0',
    'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 网络优先，失败才用缓存
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/') || event.request.url.includes('/ocr')) return;
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

// 推送事件：收到后端推送时弹通知
self.addEventListener('push', (event) => {
    let data = { title: 'EclipseFlow', body: '任务提醒' };
    if (event.data) {
        try {
            data = event.data.json();
        } catch (e) {
            data.body = event.data.text();
        }
    }
    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: 'icon-192.png',
            badge: 'icon-192.png',
            tag: 'eclipseflow-reminder',
            requireInteraction: true,
            vibrate: [200, 100, 200],
        })
    );
});

// 点击通知：打开主页面
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then((clients) => {
            if (clients.length > 0) {
                clients[0].focus();
            } else {
                clients.openWindow('./');
            }
        })
    );
});
