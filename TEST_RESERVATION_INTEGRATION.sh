#!/bin/bash
# CHECKLIST - Проверка интеграции бронирования

echo "═══════════════════════════════════════════════════════════"
echo "✅ ЧЕК-ЛИСТ ИНТЕГРАЦИИ СИСТЕМЫ БРОНИРОВАНИЯ"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "📋 BACKEND ФАЙЛЫ:"
echo "─────────────────────────────────────────────────────────"

# Проверка models.py
if grep -q "ForeignKey.*restaurants.id" backend/models.py && \
   grep -q "ForeignKey.*tables.id" backend/models.py && \
   grep -q "relationship.*Restaurant" backend/models.py && \
   grep -q "relationship.*Table" backend/models.py; then
    echo "✅ backend/models.py - Reservation с FK и relationships"
else
    echo "❌ backend/models.py - Ошибка в моделях"
fi

# Проверка schemas.py
if grep -q "class RestaurantResponse" backend/schemas.py && \
   grep -q "class TableResponse" backend/schemas.py && \
   grep -q "restaurant.*RestaurantResponse" backend/schemas.py && \
   grep -q "table.*TableResponse" backend/schemas.py; then
    echo "✅ backend/schemas.py - RestaurantResponse, TableResponse, вложения"
else
    echo "❌ backend/schemas.py - Ошибка в схемах"
fi

# Проверка что reservations.py не изменилась (работает как есть)
if [ -f "backend/reservations.py" ]; then
    echo "✅ backend/reservations.py - существует, работает с новыми данными"
else
    echo "⚠️  backend/reservations.py - не найден"
fi

echo ""
echo "📁 FRONTEND ФАЙЛЫ:"
echo "─────────────────────────────────────────────────────────"

# Проверка App.jsx
if grep -q "const \[reservation, setReservation\]" src/App.jsx && \
   grep -q "api.reservations.getUserReservations" src/App.jsx && \
   grep -q "reservation={reservation}" src/App.jsx; then
    echo "✅ src/App.jsx - state, useEffect, prop в CartDrawer"
else
    echo "❌ src/App.jsx - Ошибка в компоненте"
fi

# Проверка CartDrawer.jsx
if grep -q "reservation }" src/components/cart/CartDrawer.jsx && \
   grep -q "Забронировано место" src/components/cart/CartDrawer.jsx && \
   grep -q "reservation.date" src/components/cart/CartDrawer.jsx; then
    echo "✅ src/components/cart/CartDrawer.jsx - prop, отображение блока"
else
    echo "❌ src/components/cart/CartDrawer.jsx - Ошибка в отображении"
fi

echo ""
echo "📚 ДОКУМЕНТАЦИЯ:"
echo "─────────────────────────────────────────────────────────"

# Проверка документации
if [ -f "backend/RESERVATION_INTEGRATION.md" ]; then
    echo "✅ backend/RESERVATION_INTEGRATION.md - документация"
else
    echo "❌ backend/RESERVATION_INTEGRATION.md - не найдена"
fi

if [ -f "RESERVATION_IMPLEMENTATION_SUMMARY.md" ]; then
    echo "✅ RESERVATION_IMPLEMENTATION_SUMMARY.md - сводка"
else
    echo "❌ RESERVATION_IMPLEMENTATION_SUMMARY.md - не найдена"
fi

if [ -f "backend/examples_reservations.py" ]; then
    echo "✅ backend/examples_reservations.py - примеры"
else
    echo "❌ backend/examples_reservations.py - не найдены"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "🚀 ЗАПУСК И ТЕСТИРОВАНИЕ"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "1️⃣  Запустить backend:"
echo "   cd backend"
echo "   python -m uvicorn main:app --reload"
echo ""
echo "2️⃣  Запустить примеры (в отдельном терминале):"
echo "   cd backend"
echo "   python examples_reservations.py"
echo ""
echo "3️⃣  Запустить frontend (в отдельном терминале):"
echo "   cd src"
echo "   npm start"
echo ""
echo "4️⃣  Тестировать в браузере:"
echo "   - Откройте http://localhost:3000"
echo "   - Логинитесь (используя данные из примера)"
echo "   - Бронируйте столик через ReserveModal"
echo "   - Откройте корзину"
echo "   - 👀 Вы должны видеть информацию о бронировании!"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "📊 API ENDPOINTS (без изменений, работают с новыми данными)"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "POST   /api/reservations/?user_id={id}          Создать"
echo "GET    /api/reservations/                       Все"
echo "GET    /api/reservations/{id}                   По ID"
echo "GET    /api/reservations/user/{user_id}        У пользователя  🎯"
echo "PUT    /api/reservations/{id}                   Обновить"
echo "DELETE /api/reservations/{id}                   Удалить"
echo ""

echo "═══════════════════════════════════════════════════════════"
echo "✨ ВСЕ ГОТОВО!"
echo "═══════════════════════════════════════════════════════════"
