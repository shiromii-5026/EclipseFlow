// EclipseFlow Service Worker
// 处理离线缓存和推送通知

const CACHE_NAME = 'eclipseflow-v1';
const CACHE_URLS = [
    './',
    'index.html',
    'style.css',
    'app.js',
    'manifest.json',
    'icon-192.png',
    'icon-512.png',
    'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700;900&display=swap',
    'https://cdn.jsdelivr.net/npm/interactjs/dist/interact.min.js',
];

// 安装：预缓存核心文件
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(CACHE_URLS))
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

// 请求拦截：缓存优先，网络回退
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('/api/') || event.request.url.includes('/ocr')) return;
    event.respondWith(
        caches.match(event.request).then((cached) => cached || fetch(event.request))
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
