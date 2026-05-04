# TeamUp Frontend

Next.js App Router frontend for TeamUp MVP.

## Run locally

1. Install dependencies:
   - `npm install`
2. Start backend on port `8000` (FastAPI / uvicorn).
3. Запросы к API идут на тот же origin: `fetch('/api/...')`; в `next.config.js` они проксируются на `http://127.0.0.1:8000` (параметр `API_PROXY_TARGET`, при необходимости).
   - Если меняете `next.config.js`, перезапустите `npm run dev`.
4. Запуск:
   - `npm run dev`

Для продакшена задаётте `NEXT_PUBLIC_API_BASE_URL` на публичный URL API — на `localhost` / `127.0.0.1` приложение игнорирует его и продолжает использовать `/api`-прокси.

## Russian-first

- Default locale: `ru`
- Fallback locale: `en`
- All strings should come from translation keys in `lib/i18n.ts`

