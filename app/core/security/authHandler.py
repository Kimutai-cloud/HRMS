import jwt
from decouple import config
import time

JWT_SECRET = config('JWT_SECRET')
JWT_ALGORITHM = config('JWT_ALGORITHM')

class authHandler(object):
    @staticmethod
    def sign_jwt(user_id: str) -> str:
        """Sign a JWT token."""
        payload = {
            'user_id': user_id,
            'expires': time.time() + 900
        }
        return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
    
    @staticmethod
    def decode_jwt(token: str) -> dict:
        """Decode a JWT token."""
        try:
            decoded_token = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return decoded_token if decoded_token['expires'] >= time.time() else None
        except:
            print("Unable to Decode Token")
            return None
