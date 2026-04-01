# GTCP — Real-time Update Architecture Analysis

**Дата:** 01.04.2026
**Статус:** Анализ завершён, внедрение отложено
**Контекст:** Frontend не обновляется автоматически при изменении данных в backend

---

## Проблема

Frontend (`GTCP_MVP.html`) вызывает `_refreshFromBackend()` только при:
- Login
- Клик на раздел в навигации
- Ручное действие (создать номинацию, confirm, matching)

Нет автоматического обновления → при перезапуске backend или изменении данных другим пользователем — данные на экране устаревают.

---

## Вариант 1 — Auto-refresh (Polling)

**Решение:** `setInterval(() => _refreshFromBackend(), 30000)`

**Effort:** 1 минута (1 строка кода)

| Плюс | Минус |
|------|-------|
| Тривиальная реализация | Задержка до 30 сек |
| Нет зависимостей | ~15 запросов × каждые 30 сек = нагрузка |
| Работает везде | Не масштабируется (N пользователей × 15 req × 2/min) |

**Подходит для:** MVP, 1-2 пользователя, демо.

---

## Вариант 2 — WebSocket (Real-time Push)

**Решение:** Backend пушит обновления через WebSocket при каждом событии.

### Архитектура

```
┌──────────────┐         WebSocket (ws://localhost:3000)        ┌──────────────┐
│   Backend    │ ──────────────────────────────────────────────→ │   Frontend   │
│  Express.js  │                                                 │  GTCP_MVP    │
│              │ ←── HTTP REST (как сейчас) ──────────────────── │  .html       │
└──────┬───────┘                                                 └──────┬───────┘
       │                                                                │
       │  При событии:                                                  │  При получении:
       │  - nomination created/confirmed                                │  - _refreshFromBackend()
       │  - auction closed                                              │  - renderNominations()
       │  - invoice issued                                              │  - updateNavBadges()
       │  - margin call triggered                                       │  - toast('Новая номинация')
       │                                                                │
       │  ws.broadcast({                                                │  ws.onmessage = (msg) => {
       │    event: 'nomination:created',                                │    if (msg.event.startsWith('nom'))
       │    data: { reference, shipper }                                │      _refreshFromBackend();
       │  })                                                            │  }
       └────────────────────────────────────────────────────────────────┘
```

### Backend (app.js)

```js
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server: httpServer });

function broadcast(event, data) {
  const msg = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(msg);
  });
}

// Export for use in routes
module.exports.broadcast = broadcast;
```

### Routes — вызов broadcast после действий

```js
// nominations.js — после создания
await db.query('INSERT INTO nominations ...');
broadcast('nomination:created', { reference, shipper_code });

// billing.js — после смены статуса
await db.query('UPDATE invoices SET status = $1 ...');
broadcast('invoice:status_changed', { invoice_no, status });

// auctions.js — после закрытия
broadcast('auction:closed', { auction_id, winners });
```

### Frontend (GTCP_MVP.html)

```js
let ws;
function connectWS() {
  ws = new WebSocket('ws://localhost:3000');
  ws.onmessage = (e) => {
    const msg = JSON.parse(e.data);
    console.log('[WS]', msg.event, msg.data);
    _refreshFromBackend();
    toast(`${msg.event}`, 'info');
  };
  ws.onclose = () => setTimeout(connectWS, 5000); // auto-reconnect
  ws.onerror = () => ws.close();
}
connectWS();
```

### События для broadcast

| Событие | Trigger | Кто обновляет |
|---------|---------|--------------|
| `nomination:created` | POST /nominations | Nominations, Dashboard, Balance |
| `nomination:confirmed` | PATCH /nominations/:id/status | Nominations, Balance |
| `nomination:matched` | POST /nominations/match | Nominations, Balance |
| `invoice:created` | POST /billing | Billing, Dashboard |
| `invoice:status_changed` | PATCH /billing/:id/status | Billing, Dashboard |
| `auction:closed` | Auction end time | Auctions, Capacity |
| `capacity:booked` | POST /capacity | Capacity, Dashboard, Auctions |
| `credit:margin_call` | Exposure > limit | Credit, Dashboard |
| `shipper:status_changed` | PATCH /shippers/:id/status | All modules |

**Effort:** 2-3 часа
**Зависимости:** пакет `ws` (npm install ws)

| Плюс | Минус |
|------|-------|
| Мгновенные обновления (<100ms) | Нужен ws:// поддержка |
| Нет polling — 0 лишних запросов | Сложнее debug |
| Push уведомления в открытой вкладке | Нужен reconnect logic |
| Multi-user (user A создал → user B увидел) | +50 строк backend + 20 frontend |
| Масштабируется до ~1000 подключений | WebSocket через nginx требует настройки |

---

## Вариант 3 — Service Worker + PWA

**Решение:** Service Worker перехватывает все fetch запросы, кеширует статику, обновляет API в фоне. Push Notifications через Web Push API.

### Архитектура

```
┌──────────────┐                                    ┌──────────────┐
│   Backend    │ ── REST API ──────────────────────→ │  Service     │
│  Express.js  │                                     │  Worker      │
│              │ ← Push Notification ────────────── │  (sw.js)     │
└──────────────┘                                     └──────┬───────┘
                                                            │
                                                     Cache Storage
                                                     ┌──────┴───────┐
                                                     │ /api/shippers│ Network-first
                                                     │ /api/noms    │ (always fresh,
                                                     │ /api/billing │  fallback cache)
                                                     ├──────────────┤
                                                     │ GTCP_MVP.html│ Cache-first
                                                     │ api.js       │ (instant load,
                                                     │ CSS/icons    │  background update)
                                                     └──────┬───────┘
                                                            │
                                                     ┌──────┴───────┐
                                                     │  Frontend    │
                                                     │  (installable│
                                                     │   as app)    │
                                                     └──────────────┘
```

### Файлы

```
sw.js              — Service Worker
manifest.json      — PWA manifest (icon, name, colors, display: standalone)
GTCP_MVP.html      — SW registration + Push subscription
backend/push.js    — Web Push API (VAPID keys, send push)
```

### sw.js

```js
const CACHE = 'gtcp-v2';
const STATIC = ['/Soft/GTCP_MVP.html', '/backend/frontend/api.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) {
    // API: Network-first (always fresh data)
    e.respondWith(
      fetch(e.request)
        .then(r => { caches.open(CACHE).then(c => c.put(e.request, r.clone())); return r; })
        .catch(() => caches.match(e.request))
    );
  } else {
    // Static: Cache-first (instant load)
    e.respondWith(caches.match(e.request).then(r => r || fetch(e.request)));
  }
});

// Push Notification
self.addEventListener('push', e => {
  const data = e.data.json();
  self.registration.showNotification('GTCP', {
    body: data.message,
    icon: '/icon-192.png',
    data: { url: data.url },
  });
});
```

### Возможности

| Функция | Описание |
|---------|----------|
| **Offline mode** | Приложение работает без интернета (API из кеша) |
| **Background sync** | Действия сохраняются в IndexedDB, отправляются при восстановлении связи |
| **Push notifications** | Сервер пушит через Web Push API — даже при закрытой вкладке |
| **Install as app** | Иконка на рабочем столе, полноэкранный режим (display: standalone) |
| **Cache-first** | Страница загружается мгновенно из кеша (<50ms) |
| **Auto-update** | SW обновляется в фоне, пользователь видит prompt "Доступно обновление" |

**Effort:** 4-5 часов
**Зависимости:** HTTPS (обязательно для production SW), Web Push VAPID keys, manifest.json

| Плюс | Минус |
|------|-------|
| Работает офлайн | Сложная логика кеширования |
| Push даже при закрытой вкладке | HTTPS обязателен (localhost OK для dev) |
| Устанавливается как приложение | Debug Service Worker = сложно |
| Мгновенная загрузка из кеша | Cache invalidation — hard problem |
| Фоновая синхронизация | Overkill для 1-2 пользователей |

---

## Сравнительная таблица

| Критерий | Вар.1 Polling | Вар.2 WebSocket | Вар.3 PWA |
|----------|--------------|----------------|-----------|
| **Задержка обновления** | 30 сек | <100 мс | 0 (кеш) + фон |
| **Лишние запросы** | ~30/мин | 0 | 0 |
| **Offline** | Нет | Нет | Да |
| **Push notifications** | Нет | В открытой вкладке | Даже при закрытой |
| **Multi-user sync** | Нет | Да | Нет |
| **Install as app** | Нет | Нет | Да |
| **Effort** | 1 мин | 2-3 часа | 4-5 часов |
| **Сложность** | Тривиально | Средне | Высоко |
| **Для MVP** | ✅ | ✅ | Overkill |
| **Для production** | ❌ | ✅ | ✅ |
| **Масштабируемость** | ~10 users | ~1000 users | ~10000 users |
| **Зависимости** | Нет | npm ws | HTTPS + VAPID |

---

## Рекомендация

1. **Сейчас:** Вариант 1 (polling 30 сек) — 1 строка, мгновенно
2. **Sprint 15:** Вариант 2 (WebSocket) — если нужен multi-user или демо для дипломной защиты
3. **Production:** Вариант 2 + 3 (WebSocket для real-time + PWA для offline/push)
