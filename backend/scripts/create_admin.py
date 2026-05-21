"""
Скрипт для создания администратора или присвоения роли администратора существующему пользователю.
Запуск: python scripts/create_admin.py
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy.orm import Session
from database import SessionLocal
from models import User
from utils import hash_password


def create_admin():
    """Создать нового администратора или назначить роль администратора существующему пользователю"""
    db: Session = SessionLocal()
    
    try:
        print("=== Создание/Назначение администратора ===\n")
        
        # Проверяем существующие пользователи
        users = db.query(User).all()
        if users:
            print("Существующие пользователи:")
            for user in users:
                print(f"  ID: {user.id}, Email: {user.email}, Username: {user.username}, Role: {user.role}")
            print()
            
            choice = input("Выберите действие: (1) Назначить админа существующему пользователю, (2) Создать нового админа\nВыбор (1 или 2): ").strip()
            
            if choice == "1":
                # Назначить админа существующему пользователю
                user_id = input("Введите ID пользователя для назначения роли администратора: ").strip()
                try:
                    user_id = int(user_id)
                    user = db.query(User).filter(User.id == user_id).first()
                    
                    if not user:
                        print(f"Ошибка: Пользователь с ID {user_id} не найден")
                        return
                    
                    user.role = "admin"
                    db.add(user)
                    db.commit()
                    print(f"✓ Пользователю {user.email} назначена роль администратора")
                except ValueError:
                    print("Ошибка: Неверный ID пользователя")
                return
        
        print("Создание нового администратора:\n")
        
        # Получаем данные нового администратора
        email = input("Email: ").strip()
        username = input("Username: ").strip()
        password = input("Пароль: ").strip()
        full_name = input("Полное имя (опционально): ").strip() or None
        phone = input("Номер телефона (опционально): ").strip() or None
        
        # Проверяем, не существует ли уже такой email или username
        existing_email = db.query(User).filter(User.email == email).first()
        if existing_email:
            print(f"Ошибка: Пользователь с email {email} уже существует")
            return
        
        existing_username = db.query(User).filter(User.username == username).first()
        if existing_username:
            print(f"Ошибка: Пользователь с username {username} уже существует")
            return
        
        # Создаем администратора
        hashed_password = hash_password(password)
        admin_user = User(
            email=email,
            username=username,
            hashed_password=hashed_password,
            full_name=full_name,
            phone=phone,
            role="admin",
            is_active=True
        )
        
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print(f"\n✓ Администратор успешно создан!")
        print(f"  ID: {admin_user.id}")
        print(f"  Email: {admin_user.email}")
        print(f"  Username: {admin_user.username}")
        print(f"  Role: {admin_user.role}")
        
    except Exception as e:
        print(f"Ошибка: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
