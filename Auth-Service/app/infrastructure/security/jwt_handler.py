from datetime import datetime, timedelta
from typing import Optional, Dict, Any
import jwt

from app.core.entities.user import User
from app.core.entities.token import JWTTokenPair
from app.core.interfaces.services import TokenServiceInterface
from app.config.settings import settings


class JWTHandler(TokenServiceInterface):
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        self.refresh_token_expire_days = settings.REFRESH_TOKEN_EXPIRE_DAYS
        self.email_token_expire_minutes = settings.EMAIL_TOKEN_EXPIRE_MINUTES
    
    def create_access_token(self, user: User) -> str:
        expires_delta = timedelta(minutes=self.access_token_expire_minutes)
        return self._create_token(
            data={"sub": str(user.id), "email": user.email, "type": "access"},
            expires_delta=expires_delta
        )
    
    def create_refresh_token(self, user: User) -> str:
        expires_delta = timedelta(days=self.refresh_token_expire_days)
        return self._create_token(
            data={"sub": str(user.id), "type": "refresh"},
            expires_delta=expires_delta
        )
    
    def create_token_pair(self, user: User) -> JWTTokenPair:
        access_token = self.create_access_token(user)
        refresh_token = self.create_refresh_token(user)
        
        return JWTTokenPair(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=self.access_token_expire_minutes * 60
        )
    
    def create_email_verification_token(self, user: User) -> str:
        expires_delta = timedelta(minutes=self.email_token_expire_minutes)
        return self._create_token(
            data={"sub": str(user.id), "email": user.email, "type": "email_verification"},
            expires_delta=expires_delta
        )
    
    def create_password_reset_token(self, user: User) -> str:
        expires_delta = timedelta(minutes=self.email_token_expire_minutes)
        return self._create_token(
            data={"sub": str(user.id), "email": user.email, "type": "password_reset"},
            expires_delta=expires_delta
        )
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except jwt.ExpiredSignatureError:
            return None
        except jwt.JWTError:
            return None
    
    def _create_token(self, data: Dict[str, Any], expires_delta: timedelta) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + expires_delta
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        
        return jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
