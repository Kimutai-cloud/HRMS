from passlib.context import CryptContext

from app.core.interfaces.services import PasswordServiceInterface


class PasswordHasher(PasswordServiceInterface):
    def __init__(self):
        self.pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
    
    def hash_password(self, password: str) -> str:
        return self.pwd_context.hash(password)
    
    def verify_password(self, password: str, hashed_password: str) -> bool:
        return self.pwd_context.verify(password, hashed_password)
