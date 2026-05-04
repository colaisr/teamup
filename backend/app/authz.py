from app.models import User


def user_is_platform_admin(user: User) -> bool:
    return bool(user.is_system_admin)
