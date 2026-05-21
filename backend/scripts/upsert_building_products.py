import json
import sqlite3
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
DB_PATHS = [ROOT / "app.db", ROOT / "backend" / "app.db"]

PRODUCTS = [
    {
        "cat": "Инструменты",
        "name": "Лазерный уровень 360 градусов",
        "price": 3890,
        "weight": "0.8 кг",
        "badge": "Новинка",
        "tags": ["новинка", "профи"],
        "img": "https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?w=600&q=80",
        "desc": "Самовыравнивающийся лазерный уровень для разметки стен, пола и потолка.",
        "ingr": "Дальность: 30 м, точность: +/- 0.3 мм/м, питание: Li-Ion",
    },
    {
        "cat": "Инструменты",
        "name": "Набор бит и сверл 100 предметов",
        "price": 1590,
        "weight": "1.4 кг",
        "badge": "Хит",
        "tags": ["хит"],
        "img": "https://images.unsplash.com/photo-1586864387967-d02ef85d93e8?w=600&q=80",
        "desc": "Универсальный набор для монтажа, сборки мебели и сверления по дереву, металлу и бетону.",
        "ingr": "Биты PH/PZ/Torx/Hex, сверла HSS, по дереву и бетону, кейс",
    },
    {
        "cat": "Стройматериалы",
        "name": "Гипсокартон влагостойкий 12.5 мм",
        "price": 520,
        "weight": "лист 2.5x1.2 м",
        "badge": "",
        "tags": ["стройматериалы"],
        "img": "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=80",
        "desc": "Влагостойкий лист для перегородок, облицовки стен и потолков.",
        "ingr": "Размер: 2500x1200 мм, толщина: 12.5 мм, площадь: 3 м2",
    },
    {
        "cat": "Стройматериалы",
        "name": "Сухая смесь М300 пескобетон",
        "price": 260,
        "weight": "40 кг",
        "badge": "Хит",
        "tags": ["хит", "стройматериалы"],
        "img": "https://images.unsplash.com/photo-1518005020951-eccb494ad742?w=600&q=80",
        "desc": "Пескобетон для стяжек, фундаментов, дорожек и ремонтных работ.",
        "ingr": "Марка: М300, расход: 20 кг/м2 при 10 мм, фракция: до 5 мм",
    },
    {
        "cat": "Краски",
        "name": "Краска интерьерная моющаяся",
        "price": 1190,
        "weight": "9 л",
        "badge": "Акция",
        "tags": ["акция", "краски"],
        "img": "https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600&q=80",
        "desc": "Матовая краска для стен и потолков с высокой укрывистостью.",
        "ingr": "Расход: 10-12 м2/л, база: акрил, стойкость к влажной уборке",
    },
    {
        "cat": "Краски",
        "name": "Грунт бетон-контакт",
        "price": 690,
        "weight": "6 кг",
        "badge": "",
        "tags": ["краски"],
        "img": "https://images.unsplash.com/photo-1561104879-b5b72a2cdfae?w=600&q=80",
        "desc": "Адгезионный грунт для гладких бетонных оснований перед штукатуркой и плиткой.",
        "ingr": "Основа: акрил, наполнитель: кварцевый песок, расход: 250-350 г/м2",
    },
    {
        "cat": "Плитка",
        "name": "Клей плиточный усиленный C2TE",
        "price": 430,
        "weight": "25 кг",
        "badge": "Профи",
        "tags": ["профи", "плитка"],
        "img": "https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=600&q=80",
        "desc": "Эластичный клей для керамогранита, теплого пола и влажных помещений.",
        "ingr": "Класс: C2TE, слой: 2-10 мм, жизнеспособность раствора: 3 ч",
    },
    {
        "cat": "Плитка",
        "name": "Затирка цементная серая 2 кг",
        "price": 210,
        "weight": "2 кг",
        "badge": "",
        "tags": ["плитка", "расходники"],
        "img": "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&q=80",
        "desc": "Затирка для межплиточных швов в сухих и влажных помещениях.",
        "ingr": "Шов: 1-6 мм, цвет: серый, водостойкая",
    },
    {
        "cat": "Сантехника",
        "name": "Комплект труб PPR 20 мм",
        "price": 740,
        "weight": "10 м",
        "badge": "Новинка",
        "tags": ["новинка", "сантехника"],
        "img": "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
        "desc": "Полипропиленовые трубы для горячего и холодного водоснабжения.",
        "ingr": "Диаметр: 20 мм, PN20, температура: до 95 C",
    },
    {
        "cat": "Сантехника",
        "name": "Сифон для раковины с выпуском",
        "price": 390,
        "weight": "0.4 кг",
        "badge": "",
        "tags": ["сантехника"],
        "img": "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=600&q=80",
        "desc": "Компактный сифон с гофрой и выпуском для раковины.",
        "ingr": "Диаметр выпуска: 1 1/4, подключение: 40/50 мм",
    },
    {
        "cat": "Расходники",
        "name": "Перчатки нитриловые строительные",
        "price": 180,
        "weight": "пара",
        "badge": "",
        "tags": ["расходники"],
        "img": "https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=600&q=80",
        "desc": "Износостойкие перчатки с нитриловым покрытием для монтажа и ремонта.",
        "ingr": "Размер: L/XL, покрытие: нитрил, манжета: резинка",
    },
    {
        "cat": "Расходники",
        "name": "Пена монтажная всесезонная",
        "price": 360,
        "weight": "750 мл",
        "badge": "Хит",
        "tags": ["хит", "расходники"],
        "img": "https://images.unsplash.com/photo-1504347052374-9ab8869cd3f4?w=600&q=80",
        "desc": "Полиуретановая пена для монтажа окон, дверей и заполнения швов.",
        "ingr": "Выход: до 45 л, температура применения: -10...+35 C",
    },
]


def ensure_schema(cur):
    cur.execute(
        """
        CREATE TABLE IF NOT EXISTS menu_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cat TEXT NOT NULL,
            name TEXT NOT NULL,
            price INTEGER NOT NULL DEFAULT 0,
            discount_percent INTEGER NOT NULL DEFAULT 0,
            weight TEXT,
            badge TEXT,
            tags_json TEXT,
            img TEXT,
            desc TEXT,
            ingr TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
        """
    )


def upsert_db(path: Path) -> tuple[int, int]:
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    try:
        cur = conn.cursor()
        ensure_schema(cur)
        inserted = 0
        updated = 0
        for item in PRODUCTS:
            cur.execute("SELECT id FROM menu_items WHERE name = ? LIMIT 1", (item["name"],))
            row = cur.fetchone()
            values = (
                item["cat"],
                item["name"],
                item["price"],
                0,
                item["weight"],
                item["badge"],
                json.dumps(item["tags"], ensure_ascii=False),
                item["img"],
                item["desc"],
                item["ingr"],
                1,
            )
            if row:
                cur.execute(
                    """
                    UPDATE menu_items
                    SET cat=?, name=?, price=?, discount_percent=?, weight=?, badge=?, tags_json=?,
                        img=?, desc=?, ingr=?, is_active=?, updated_at=CURRENT_TIMESTAMP
                    WHERE id=?
                    """,
                    (*values, row[0]),
                )
                updated += 1
            else:
                cur.execute(
                    """
                    INSERT INTO menu_items
                        (cat, name, price, discount_percent, weight, badge, tags_json, img, desc, ingr, is_active, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """,
                    values,
                )
                inserted += 1
        conn.commit()
        return inserted, updated
    finally:
        conn.close()


def main():
    for db_path in DB_PATHS:
        ins, upd = upsert_db(db_path)
        print(f"{db_path}: inserted={ins}, updated={upd}")


if __name__ == "__main__":
    main()
