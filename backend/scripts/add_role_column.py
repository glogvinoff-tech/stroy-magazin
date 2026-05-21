"""
Скрипт для добавления колонки role к таблице users (если она уже существует)
Запуск: python scripts/add_role_column.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from database import SessionLocal, engine


def add_role_column():
    """Добавить колонку role к таблице users"""
    db = SessionLocal()
    
    try:
        print("Проверка наличия колонки 'role' в таблице 'users'...\n")
        
        # Проверяем что таблица users существует
        inspector_query = text("SELECT 1 FROM PRAGMA_TABLE_INFO('users') WHERE name='role'")
        
        # Для SQLite
        try:
            result = db.execute(inspector_query).first()
            if result:
                print("✓ Колонка 'role' уже существует в таблице 'users'")
                return
        except:
            pass
        
        # Для PostgreSQL
        try:
            pg_query = text("""
                SELECT 1 FROM information_schema.columns 
                WHERE table_name='users' AND column_name='role'
            """)
            result = db.execute(pg_query).first()
            if result:
                print("✓ Колонка 'role' уже существует в таблице 'users'")
                return
        except:
            pass
        
        # Добавляем колонку
        print("Добавление колонки 'role' к таблице 'users'...\n")
        
        try:
            # Для SQLite
            add_column_query = text("""
                ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL
            """)
            db.execute(add_column_query)
            db.commit()
            print("✓ Колонка 'role' успешно добавлена")
            print("  Тип: VARCHAR")
            print("  По умолчанию: 'user'")
            print("  Nullable: False")
        except Exception as e:
            print(f"Ошибка при добавлении колонки: {e}")
            print("\nПопытка использовать синтаксис PostgreSQL...")
            
            try:
                db.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL;"))
                db.commit()
                print("✓ Колонка 'role' успешно добавлена (PostgreSQL)")
            except Exception as e2:
                print(f"Ошибка: {e2}")
                db.rollback()
        
    except Exception as e:
        print(f"Ошибка: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    add_role_column()
