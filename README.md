## Запуск backend (локально)
```bash
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

## Запуск frontend (dev, локально)
```bash
npm install
npm start
```

## Админ (dev)
При старте backend создаётся демо-админ (если ещё не существует):
- логин/пароль по умолчанию: `admin` / `admin123`
- можно переопределить через `.env`: `ADMIN_USERNAME`, `ADMIN_PASSWORD`

## PRO (demo)
В профиле можно включить PRO. Сейчас это демо-активация (без оплаты) — открывает бронирование нескольких столов и закрытые мероприятия, а также VIP-линию в чате поддержки.

## ИИ-бот (GigaChat / demo)
В правом чате поддержки есть переключатель `Support / AI`. Режим `AI` делает автоподбор ответа через бэкенд‑прокси (секреты остаются на сервере).

### Быстро включить демо (без внешних API)
- Оставь `AI_PROVIDER=mock` в `.env` — бот будет отвечать офлайн “заглушкой”, чтобы проверить UX.

### Подключить GigaChat
1) В `.env` выставь `AI_PROVIDER=gigachat`
2) Укажи **один** из вариантов авторизации:
   - `GIGACHAT_AUTHORIZATION_KEY` (как в документации: `Authorization: Basic <Authorization key>`) — самый простой вариант
   - **или** пару `GIGACHAT_CLIENT_ID` / `GIGACHAT_CLIENT_SECRET` (бэкенд сам соберёт Basic)
   - **или** `GIGACHAT_ACCESS_TOKEN` (тогда токен придётся обновлять вручную, обычно раз в ~30 минут)
3) При необходимости поправь `GIGACHAT_SCOPE`, `GIGACHAT_MODEL`, `GIGACHAT_OAUTH_URL`, `GIGACHAT_API_URL` (актуальные значения смотри в документации GigaChat)
   - Если словишь SSL-ошибки, сначала поставь нормальные сертификаты (или укажи CA-файл через `GIGACHAT_CA_FILE`). `GIGACHAT_VERIFY_SSL=0` оставил только как аварийный dev‑флаг (не для продакшена).
4) Перезапусти backend

### Как вручную получить Access Token (если нужно)
Запрос в GigaChat OAuth:
```bash
curl -L -X POST "https://ngw.devices.sberbank.ru:9443/api/v2/oauth" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -H "Accept: application/json" \
  -H "RqUID: <uuid>" \
  -H "Authorization: Basic <Authorization key>" \
  --data-urlencode "scope=GIGACHAT_API_PERS"
```
В ответе придёт `access_token` — его можно положить в `.env` как `GIGACHAT_ACCESS_TOKEN`, но удобнее хранить `GIGACHAT_AUTHORIZATION_KEY`, чтобы бэкенд сам обновлял токен.

### Где это реализовано
- Backend: `backend/ai.py` (эндпоинты: `/api/ai/support/thread/{id}/reply` и `/api/ai/admin/thread/{id}/reply`)
- Frontend: `src/components/support/SupportWidget.jsx` и `src/components/admin/AdminModal.jsx`

Важно: сейчас “авторизация” в API упрощённая (через `user_id/admin_id`), для продакшена добавь нормальные токены/сессии и лимиты на запросы к ИИ.

## Локальное тестирование + CORS

Если фронт открыт не с того же origin, что и бэкенд (например, фронт на хостинге, а API локально `http://127.0.0.1:8001`), то нужно разрешить CORS на бэкенде:

- Добавь origin фронта в `FRONTEND_ORIGINS` в `.env` **или** включи `CORS_ALLOW_ALL=1`.
- Для туннелей можно задать шаблон: `FRONTEND_ORIGIN_REGEX=^https://.*\\.ngrok-free\\.app$`

Важно: если фронт открыт по `https://...`, браузер может блокировать запросы к локальному `http://...` (mixed content). В этом случае тестируй фронт локально (`npm start`) или подними HTTPS/туннель для API и укажи его в `REACT_APP_API_BASE`.
