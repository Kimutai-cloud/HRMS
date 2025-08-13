from typing import Optional, Dict, Any
import jwt
from datetime import datetime

from app.config.settings import settings


class JWTHandler:
    """JWT token handler for validating tokens from Auth Service."""
    
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.audience = settings.JWT_AUDIENCE
        self.issuer = settings.JWT_ISSUER
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return claims."""
        try:
            # Decode and verify token
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
            
            # Additional validation
            if not payload.get("sub"):
                return None
            
            # Check if token is not expired
            exp = payload.get("exp")
            if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
                return None
            
            return payload
            
        except jwt.ExpiredSignatureError:
            print("Token has expired")
            return None
        except jwt.InvalidAudienceError:
            print("Invalid audience")
            return None
        except jwt.InvalidIssuerError:
            print("Invalid issuer")
            return None
        except jwt.InvalidTokenError as e:
            print(f"Invalid token: {e}")
            return None
        except Exception as e:
            print(f"Token verification error: {e}")
            return None
