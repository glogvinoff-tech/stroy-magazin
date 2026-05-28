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

## Email-подтверждение
Для реальной отправки кода подтверждения на почту заполни SMTP-настройки в `.env` и перезапусти backend:

```env
SMTP_HOST=smtp.yandex.ru
SMTP_PORT=465
SMTP_USER=your-email@yandex.ru
SMTP_PASS=your-app-password
SMTP_FROM=your-email@yandex.ru
EMAIL_CODE_DEV_MODE=0
```

Для Gmail/Yandex/Mail.ru обычно нужен пароль приложения, а не обычный пароль от почты. Если `EMAIL_CODE_DEV_MODE=1` и SMTP не заполнен, код не отправляется письмом, а выводится в терминал backend строкой `[email verification] code for ...`.

## PRO (demo)
В профиле можно включить PRO. Сейчас это демо-активация (без оплаты) — открывает бронирование нескольких столов и закрытые мероприятия, а также VIP-линию в чате поддержки.

## Локальное тестирование + CORS

Если фронт открыт не с того же origin, что и бэкенд (например, фронт на хостинге, а API локально `http://127.0.0.1:8001`), то нужно разрешить CORS на бэкенде:

- Добавь origin фронта в `FRONTEND_ORIGINS` в `.env` **или** включи `CORS_ALLOW_ALL=1`.
- Для туннелей можно задать шаблон: `FRONTEND_ORIGIN_REGEX=^https://.*\\.ngrok-free\\.app$`

Важно: если фронт открыт по `https://...`, браузер может блокировать запросы к локальному `http://...` (mixed content). В этом случае тестируй фронт локально (`npm start`) или подними HTTPS/туннель для API и укажи его в `REACT_APP_API_BASE`.
