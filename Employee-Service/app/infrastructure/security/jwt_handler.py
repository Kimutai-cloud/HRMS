
from typing import Optional, Dict, Any
import jwt
import logging
from datetime import datetime, timezone
from dataclasses import dataclass

from app.config.settings import settings


class JWTHandler:
    """Enhanced JWT token handler for validating tokens from Auth Service."""
    
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.audience = settings.JWT_AUDIENCE
        self.issuer = settings.JWT_ISSUER
        self.logger = logging.getLogger(__name__)
    
    def verify_token(self, token: str) -> Optional[Dict[str, Any]]:
        """Verify JWT token and return enhanced claims with employee profile status."""
        try:
            if not token or not isinstance(token, str):
                self.logger.error("Invalid token format: token must be non-empty string")
                return None
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
                    "verify_iat": False,  # Keep disabled as Auth Service might not always include iat
                    "require_iat": False,  # Keep disabled as Auth Service might not always include iat
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
            if exp and datetime.fromtimestamp(exp, tz=timezone.utc) < datetime.now(timezone.utc):
                print("❌ JWT validation failed: Token expired")
                return None
            
            # Validate token type (should be 'access' for API requests)
            token_type = payload.get("type")
            if token_type not in ["access"]:
                print(f"❌ JWT validation failed: Invalid token type '{token_type}'")
                return None
            
            # Extract employee profile status (synced field from Auth Service)
            employee_profile_status = payload.get("employee_profile_status")
            if employee_profile_status:
                print(f"✅ JWT contains employee profile status: {employee_profile_status}")
            else:
                # Handle backward compatibility with older tokens - default to NOT_STARTED for new users
                print("⚠️  JWT missing employee_profile_status - using NOT_STARTED for new users")
                employee_profile_status = "NOT_STARTED"
            
            validation_result = self._validate_payload_claims(payload)
            if not validation_result.is_valid:
                    self.logger.error(f"Token validation failed: {validation_result.error}")
                    return None
                    
            return {
                "sub": payload.get("sub"),  # Keep original field for dependencies validation
                "user_id": payload.get("sub"),  # Also provide as user_id for convenience
                "email": payload.get("email"),
                "employee_profile_status": employee_profile_status,
                "type": token_type,  # Keep original field name
                "token_type": token_type,  # Also provide as token_type for convenience
                "iat": payload.get("iat"),  # Keep original field
                "issued_at": payload.get("iat"),  # Also provide convenience name
                "exp": payload.get("exp"),  # Keep original field
                "expires_at": payload.get("exp"),  # Also provide convenience name
                "aud": payload.get("aud"),  # Keep original field
                "audience": payload.get("aud"),  # Also provide convenience name
                "iss": payload.get("iss"),  # Keep original field
                "issuer": payload.get("iss"),  # Also provide convenience name
                "raw_payload": payload  
            }
            

        except jwt.InvalidIssuerError:
            print(f"❌ JWT validation failed: Invalid issuer (expected: {self.issuer})")
            return None
        except jwt.InvalidTokenError as e:
            print(f"❌ JWT validation failed: Invalid token - {e}")
            return None
        except Exception as e:
            print(f"❌ JWT validation failed: Unexpected error - {e}")
            return None
        except jwt.ExpiredSignatureError:
            self.logger.warning("Token validation failed: Token has expired")
            return None
        except jwt.InvalidAudienceError:
            self.logger.error(f"Token validation failed: Invalid audience (expected: {self.audience})")
            return None
        
    @dataclass
    class ValidationResult:
        is_valid: bool
        error: Optional[str] = None

    def _validate_payload_claims(self, payload: Dict[str, Any]) -> ValidationResult:
        """Comprehensive payload validation"""
        
        required_claims = ["sub", "email", "type", "iat", "exp"]
        for claim in required_claims:
            if claim not in payload:
                return self.ValidationResult(False, f"Missing required claim: {claim}")
        
        try:
            from uuid import UUID
            UUID(payload["sub"])
        except (ValueError, TypeError):
            return self.ValidationResult(False, "Invalid user ID format in 'sub' claim")
        
        email = payload.get("email", "")
        if not email or "@" not in email:
            return self.ValidationResult(False, "Invalid email format in token")
        
        if payload.get("type") not in ["access", "refresh"]:
            return self.ValidationResult(False, f"Invalid token type: {payload.get('type')}")
        
        now = datetime.now(timezone.utc).timestamp()
        if payload.get("iat", 0) > now + 300:  
            return self.ValidationResult(False, "Token issued in the future")
        
        return self.ValidationResult(True)
    
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
            "is_pending_verification": token_data["employee_profile_status"] in [
                "PENDING_DETAILS_REVIEW", 
                "PENDING_DOCUMENTS_REVIEW",
                "PENDING_ROLE_ASSIGNMENT", 
                "PENDING_FINAL_APPROVAL"
            ],
            "needs_profile_completion": token_data["employee_profile_status"] in ["NOT_STARTED", "NOT_SUBMITTED"],
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
            "newcomer": [  # Limited access during verification process
                "PENDING_DETAILS_REVIEW", 
                "PENDING_DOCUMENTS_REVIEW",
                "PENDING_ROLE_ASSIGNMENT", 
                "PENDING_FINAL_APPROVAL",
                "VERIFIED"
            ],
            "profile_completion": ["NOT_STARTED", "NOT_SUBMITTED", "REJECTED"],  # Profile setup endpoints
            "internal": [  # Internal endpoints - all statuses allowed
                "NOT_STARTED", "NOT_SUBMITTED", 
                "PENDING_DETAILS_REVIEW", "PENDING_DOCUMENTS_REVIEW",
                "PENDING_ROLE_ASSIGNMENT", "PENDING_FINAL_APPROVAL", 
                "VERIFIED", "REJECTED"
            ]
        }
        
        allowed_statuses = endpoint_requirements.get(endpoint_type, ["VERIFIED"])
        user_status = user_claims["employee_profile_status"]
        
        if user_status not in allowed_statuses:
            raise Exception(
                f"Access denied: Profile status '{user_status}' not allowed for {endpoint_type} endpoints. "
                f"Required: {allowed_statuses}"
            )
        
        return user_claims