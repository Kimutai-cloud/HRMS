
from typing import Optional, Dict, Any
import jwt
from datetime import datetime

from app.config.settings import settings


class JWTHandler:
    """Enhanced JWT token handler for validating tokens from Auth Service."""
    
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.audience = settings.JWT_AUDIENCE
        self.issuer = settings.JWT_ISSUER
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return enhanced claims with employee profile status."""
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
            
            # Validate required fields
            if not payload.get("sub"):
                print("❌ JWT validation failed: Missing 'sub' claim")
                return None
            
            # Check if token is not expired
            exp = payload.get("exp")
            if exp and datetime.utcfromtimestamp(exp) < datetime.utcnow():
                print("❌ JWT validation failed: Token expired")
                return None
            
            # Validate token type (should be 'access' for API requests)
            token_type = payload.get("type")
            if token_type not in ["access"]:
                print(f"❌ JWT validation failed: Invalid token type '{token_type}'")
                return None
            
            # Extract employee profile status (new field from Auth Service)
            employee_profile_status = payload.get("employee_profile_status")
            if employee_profile_status:
                print(f"✅ JWT contains employee profile status: {employee_profile_status}")
            else:
                # Handle backward compatibility with older tokens
                print("⚠️  JWT missing employee_profile_status - using fallback")
                employee_profile_status = "UNKNOWN"
            
            # Return enhanced payload with all extracted information
            return {
                "user_id": payload.get("sub"),
                "email": payload.get("email"),
                "employee_profile_status": employee_profile_status,
                "token_type": token_type,
                "issued_at": payload.get("iat"),
                "expires_at": payload.get("exp"),
                "audience": payload.get("aud"),
                "issuer": payload.get("iss"),
                "raw_payload": payload  # Keep original for debugging
            }
            
        except jwt.ExpiredSignatureError:
            print("❌ JWT validation failed: Token has expired")
            return None
        except jwt.InvalidAudienceError:
            print(f"❌ JWT validation failed: Invalid audience (expected: {self.audience})")
            return None
        except jwt.InvalidIssuerError:
            print(f"❌ JWT validation failed: Invalid issuer (expected: {self.issuer})")
            return None
        except jwt.InvalidTokenError as e:
            print(f"❌ JWT validation failed: Invalid token - {e}")
            return None
        except Exception as e:
            print(f"❌ JWT validation failed: Unexpected error - {e}")
            return None
    
    def extract_user_claims(self, token: str) -> Optional[Dict[str, Any]]:
        """Extract user-specific claims from JWT token."""
        token_data = self.verify_token(token)
        if not token_data:
            return None
        
        return {
            "user_id": token_data["user_id"],
            "email": token_data["email"],
            "employee_profile_status": token_data["employee_profile_status"],
            "is_verified_profile": token_data["employee_profile_status"] == "VERIFIED",
            "is_pending_verification": token_data["employee_profile_status"] == "PENDING_VERIFICATION",
            "needs_profile_completion": token_data["employee_profile_status"] == "NOT_STARTED",
            "is_profile_rejected": token_data["employee_profile_status"] == "REJECTED"
        }
    
    def validate_token_for_endpoint(self, token: str, endpoint_type: str = "standard") -> Dict[str, Any]:
        """Validate token with specific requirements based on endpoint type."""
        user_claims = self.extract_user_claims(token)
        if not user_claims:
            raise Exception("Invalid or expired token")
        
        # Define endpoint access requirements
        endpoint_requirements = {
            "standard": ["VERIFIED"],  # Most endpoints require full verification
            "newcomer": ["PENDING_VERIFICATION", "VERIFIED"],  # Limited access during verification
            "profile_completion": ["NOT_STARTED", "REJECTED"],  # Profile setup endpoints
            "internal": ["NOT_STARTED", "PENDING_VERIFICATION", "VERIFIED", "REJECTED"]  # Internal endpoints
        }
        
        allowed_statuses = endpoint_requirements.get(endpoint_type, ["VERIFIED"])
        user_status = user_claims["employee_profile_status"]
        
        if user_status not in allowed_statuses:
            raise Exception(
                f"Access denied: Profile status '{user_status}' not allowed for {endpoint_type} endpoints. "
                f"Required: {allowed_statuses}"
            )
        
        return user_claims