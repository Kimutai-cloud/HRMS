from google.auth.transport import requests
from google.oauth2 import id_token
import httpx

from app.core.interfaces.services import GoogleAuthServiceInterface
from app.core.exceptions.auth_exceptions import GoogleAuthException
from app.config.settings import settings


class GoogleAuthService(GoogleAuthServiceInterface):
    def __init__(self):
        self.client_id = settings.GOOGLE_CLIENT_ID
    
    async def verify_google_token(self, token: str) -> dict:
        try:
            # Verify the token with Google
            idinfo = id_token.verify_oauth2_token(
                token, 
                requests.Request(), 
                self.client_id
            )
            
            # Check if token is valid
            if idinfo['iss'] not in ['accounts.google.com', 'https://accounts.google.com']:
                raise GoogleAuthException('Invalid token issuer')
            
            return {
                'email': idinfo.get('email'),
                'name': idinfo.get('name'),
                'picture': idinfo.get('picture'),
                'email_verified': idinfo.get('email_verified', False)
            }
            
        except ValueError as e:
            raise GoogleAuthException(f'Invalid Google token: {str(e)}')
        except Exception as e:
            raise GoogleAuthException(f'Google token verification failed: {str(e)}')