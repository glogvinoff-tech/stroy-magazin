from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from database import get_db
from models import Role, Permission
from schemas import RoleResponse, RoleCreate, PermissionResponse, PermissionCreate

router = APIRouter(prefix="/api/roles", tags=["roles"])

permission_router = APIRouter(prefix="/api/permissions", tags=["permissions"])


# ================ РАЗРЕШЕНИЯ ================

@permission_router.post("/", response_model=PermissionResponse)
def create_permission(permission: PermissionCreate, db: Session = Depends(get_db)):
    """Создать новое разрешение"""
    
    # Проверяем, существует ли разрешение с таким именем
    existing = db.query(Permission).filter(Permission.name == permission.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешение с таким именем уже существует"
        )
    
    db_permission = Permission(name=permission.name)
    db.add(db_permission)
    db.commit()
    db.refresh(db_permission)
    
    return db_permission


@permission_router.get("/", response_model=list[PermissionResponse])
def get_all_permissions(db: Session = Depends(get_db)):
    """Получить все разрешения"""
    permissions = db.query(Permission).all()
    return permissions


@permission_router.get("/{permission_id}", response_model=PermissionResponse)
def get_permission(permission_id: int, db: Session = Depends(get_db)):
    """Получить разрешение по ID"""
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Разрешение не найдено"
        )
    return permission


@permission_router.put("/{permission_id}", response_model=PermissionResponse)
def update_permission(
    permission_id: int,
    permission: PermissionCreate,
    db: Session = Depends(get_db)
):
    """Обновить разрешение"""
    db_permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not db_permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Разрешение не найдено"
        )
    
    # Проверяем уникальность имени
    existing = db.query(Permission).filter(
        Permission.name == permission.name,
        Permission.id != permission_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Разрешение с таким именем уже существует"
        )
    
    db_permission.name = permission.name
    db.add(db_permission)
    db.commit()
    db.refresh(db_permission)
    
    return db_permission


@permission_router.delete("/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_permission(permission_id: int, db: Session = Depends(get_db)):
    """Удалить разрешение"""
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Разрешение не найдено"
        )
    
    db.delete(permission)
    db.commit()
    return None


# ================ РОЛИ ================

@router.post("/", response_model=RoleResponse)
def create_role(role: RoleCreate, db: Session = Depends(get_db)):
    """Создать новую роль"""
    
    # Проверяем, существует ли роль с таким именем
    existing = db.query(Role).filter(Role.name == role.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Роль с таким именем уже существует"
        )
    
    db_role = Role(name=role.name)
    
    # Добавляем разрешения, если они переданы
    if role.permission_ids:
        for permission_id in role.permission_ids:
            permission = db.query(Permission).filter(Permission.id == permission_id).first()
            if not permission:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Разрешение с ID {permission_id} не найдено"
                )
            db_role.permissions.append(permission)
    
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    
    return db_role


@router.get("/", response_model=list[RoleResponse])
def get_all_roles(db: Session = Depends(get_db)):
    """Получить все роли"""
    roles = db.query(Role).all()
    return roles


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(role_id: int, db: Session = Depends(get_db)):
    """Получить роль по ID"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    return role


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: int,
    role: RoleCreate,
    db: Session = Depends(get_db)
):
    """Обновить роль"""
    db_role = db.query(Role).filter(Role.id == role_id).first()
    if not db_role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    # Проверяем уникальность имени
    existing = db.query(Role).filter(
        Role.name == role.name,
        Role.id != role_id
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Роль с таким именем уже существует"
        )
    
    db_role.name = role.name
    
    # Обновляем разрешения
    if role.permission_ids is not None:
        db_role.permissions.clear()
        for permission_id in role.permission_ids:
            permission = db.query(Permission).filter(Permission.id == permission_id).first()
            if not permission:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Разрешение с ID {permission_id} не найдено"
                )
            db_role.permissions.append(permission)
    
    db.add(db_role)
    db.commit()
    db.refresh(db_role)
    
    return db_role


@router.delete("/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_role(role_id: int, db: Session = Depends(get_db)):
    """Удалить роль"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    db.delete(role)
    db.commit()
    return None


# ================ УПРАВЛЕНИЕ РАЗРЕШЕНИЯМИ РОЛИ ================

@router.post("/{role_id}/permissions/{permission_id}")
def add_permission_to_role(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db)
):
    """Добавить разрешение к роли"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Разрешение не найдено"
        )
    
    if permission not in role.permissions:
        role.permissions.append(permission)
        db.commit()
    
    return {"message": "Разрешение добавлено к роли", "role_id": role_id, "permission_id": permission_id}


@router.delete("/{role_id}/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_permission_from_role(
    role_id: int,
    permission_id: int,
    db: Session = Depends(get_db)
):
    """Удалить разрешение из роли"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    permission = db.query(Permission).filter(Permission.id == permission_id).first()
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Разрешение не найдено"
        )
    
    if permission in role.permissions:
        role.permissions.remove(permission)
        db.commit()
    
    return None


@router.get("/{role_id}/permissions", response_model=list[PermissionResponse])
def get_role_permissions(role_id: int, db: Session = Depends(get_db)):
    """Получить все разрешения роли"""
    role = db.query(Role).filter(Role.id == role_id).first()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Роль не найдена"
        )
    
    return role.permissions
