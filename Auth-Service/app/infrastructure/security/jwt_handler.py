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
        self.audience = getattr(settings, 'JWT_AUDIENCE', 'hrms-services')
        self.issuer = getattr(settings, 'JWT_ISSUER', 'hrms-auth-service')
    
    def create_access_token(self, user: User) -> str:
        expires_delta = timedelta(minutes=self.access_token_expire_minutes)
        return self._create_token(
            data={
                "sub": str(user.id), 
                "email": user.email, 
                "employee_profile_status": user.employee_profile_status.value,  # Include profile status
                "type": "access",
                "aud": self.audience,
                "iss": self.issuer
            },
            expires_delta=expires_delta
        )
    
    def create_refresh_token(self, user: User) -> str:
        expires_delta = timedelta(days=self.refresh_token_expire_days)
        return self._create_token(
            data={
                "sub": str(user.id), 
                "employee_profile_status": user.employee_profile_status.value,  # Include in refresh too
                "type": "refresh",
                "aud": self.audience,
                "iss": self.issuer
            },
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
            data={
                "sub": str(user.id), 
                "email": user.email, 
                "type": "email_verification",
                "aud": self.audience,
                "iss": self.issuer
            },
            expires_delta=expires_delta
        )
    
    def create_password_reset_token(self, user: User) -> str:
        expires_delta = timedelta(minutes=self.email_token_expire_minutes)
        return self._create_token(
            data={
                "sub": str(user.id), 
                "email": user.email, 
                "type": "password_reset",
                "aud": self.audience,
                "iss": self.issuer
            },
            expires_delta=expires_delta
        )
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        try:
            payload = jwt.decode(
                token, 
                self.secret_key, 
                algorithms=[self.algorithm],
                audience=self.audience,
                issuer=self.issuer,
                options={
                    "verify_exp": True,
                    "verify_aud": True,
                    "verify_iss": True,
                    "require_exp": True,
                    "require_aud": True,
                    "require_iss": True
                }
            )
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