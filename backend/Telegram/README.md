# Telegram Official Auth

This folder contains Telegram-specific backend pieces:

- `official_router.py`:
  - `GET /api/auth/telegram/official/widget-config`
  - `GET /api/auth/telegram/official/callback`
- `ngrok_setup.ps1`: helper script for setting up ngrok-based public callback URL.

## Required env vars

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_BOT_USERNAME` (without `@`)
- `FRONTEND_PUBLIC_URL` (e.g. `https://xxxx.ngrok-free.app`)

## Telegram BotFather setup

1. Open BotFather.
2. Use `/setdomain` for your bot.
3. Set domain to your public frontend domain from ngrok (without protocol).

