import httpx
import asyncio
from typing import Optional, Dict, Any
from uuid import UUID
import logging
from enum import Enum
import time

from app.config.settings import settings

class ServiceUnavailableException(Exception):
    """Exception raised when a service is unavailable due to circuit breaker."""
    pass

class CircuitState(Enum):
    CLOSED = "closed"
    OPEN = "open" 
    HALF_OPEN = "half_open"

class CircuitBreaker:
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = CircuitState.CLOSED


class AuthServiceClient:
    """HTTP client for communicating with Auth Service internal API."""
    
    def __init__(self):
        self.base_url = settings.AUTH_SERVICE_URL
        self.service_token = settings.INTERNAL_SERVICE_TOKEN
        self.service_name = settings.INTERNAL_SERVICE_NAME
        self.timeout = 30.0
        self.max_retries = 3
        self.logger = logging.getLogger(__name__)
        self.circuit_breaker = CircuitBreaker()  # Initialize circuit breaker
    
    def _get_headers(self) -> Dict[str, str]:
        """Get headers for internal service authentication."""
        return {
            "Content-Type": "application/json",
            "X-Service-Name": self.service_name,
            "X-Service-Token": self.service_token,
            "User-Agent": f"{self.service_name}/1.0"
        }
    
    async def _make_request(self, method: str, endpoint: str, data: Optional[Dict[str, Any]] = None, retries: int = 0) -> Optional[Dict[str, Any]]:
        """Make HTTP request to Auth Service with retry logic."""
        
        if self.circuit_breaker.state == CircuitState.OPEN:
            if time.time() - self.circuit_breaker.last_failure_time > self.circuit_breaker.timeout:
                self.circuit_breaker.state = CircuitState.HALF_OPEN
            else:
                raise ServiceUnavailableException("Auth Service circuit breaker is open")
        
        url = f"{self.base_url}/api/v1/internal{endpoint}"
        headers = self._get_headers()
        
        self.logger.info(f"🔗 Making request to Auth Service: {method} {url}")
        
        try:
            async with httpx.AsyncClient(
                timeout=httpx.Timeout(self.timeout, connect=10.0),
                limits=httpx.Limits(max_keepalive_connections=5, max_connections=10)
            ) as client:
                if method.upper() == "GET":
                    response = await client.get(url, headers=headers)
                elif method.upper() == "POST":
                    response = await client.post(url, headers=headers, json=data)
                elif method.upper() == "PATCH":
                    response = await client.patch(url, headers=headers, json=data)
                elif method.upper() == "DELETE":
                    response = await client.delete(url, headers=headers)
                else:
                    raise ValueError(f"Unsupported HTTP method: {method}")
                
                if response.status_code == 200:
                    # Reset circuit breaker on success
                    self.circuit_breaker.failure_count = 0
                    self.circuit_breaker.state = CircuitState.CLOSED
                    
                    self.logger.info(f"✅ Auth Service call successful: {method} {endpoint}")
                    return response.json()
                elif response.status_code == 404:
                    self.logger.warning(f"⚠️  Auth Service: User not found for {endpoint}")
                    return None
                elif response.status_code in [401, 403]:
                    self.logger.error(f"❌ Auth Service authentication failed: {response.status_code}")
                    self.logger.error(f"🔑 Service Name: {self.service_name}")
                    self.logger.error(f"🔑 Token: {self.service_token[:10]}...")
                    self.logger.error(f"📨 Headers: {headers}")
                    raise Exception(f"Authentication failed with Auth Service: {response.status_code}")
                else:
                    self.logger.error(f"❌ Auth Service error: {response.status_code} - {response.text}")
                    # Increment circuit breaker failure count
                    self._handle_failure()
                    
                    if retries < self.max_retries:
                        await self._exponential_backoff(retries)
                        return await self._make_request(method, endpoint, data, retries + 1)
                    raise Exception(f"Auth Service request failed: {response.status_code}")
        
        except httpx.TimeoutException:
            self.logger.error(f"⏰ Auth Service timeout for {endpoint}")
            self._handle_failure()
            
            if retries < self.max_retries:
                await self._exponential_backoff(retries)
                return await self._make_request(method, endpoint, data, retries + 1)
            raise Exception("Auth Service timeout - service may be unavailable")
        
        except httpx.ConnectError:
            self.logger.error(f"🔌 Cannot connect to Auth Service at {self.base_url}")
            self._handle_failure()
            
            if retries < self.max_retries:
                await self._exponential_backoff(retries)
                return await self._make_request(method, endpoint, data, retries + 1)
            raise Exception("Cannot connect to Auth Service - service may be down")
        
        except Exception as e:
            self.logger.error(f"❌ Unexpected error calling Auth Service: {e}")
            self._handle_failure()
            
            if retries < self.max_retries:
                await self._exponential_backoff(retries)
                return await self._make_request(method, endpoint, data, retries + 1)
            raise

    def _handle_failure(self):
        """Handle circuit breaker failure logic."""
        self.circuit_breaker.failure_count += 1
        if self.circuit_breaker.failure_count >= self.circuit_breaker.failure_threshold:
            self.circuit_breaker.state = CircuitState.OPEN
            self.circuit_breaker.last_failure_time = time.time()
    
    async def _exponential_backoff(self, retry_count: int):
        """Implement exponential backoff for retries."""
        delay = min(2 ** retry_count, 10)  # Max 10 seconds
        self.logger.info(f"⏳ Retrying in {delay} seconds...")
        await asyncio.sleep(delay)
    
    async def update_user_profile_status(
        self, 
        user_id: UUID, 
        status: str
    ) -> bool:
        """Update user's employee profile status in Auth Service."""
        
        try:
            self.logger.info(f"🔄 Updating user {user_id} profile status to: {status}")
            
            data = {"employee_profile_status": status}
            result = await self._make_request("PATCH", f"/users/{user_id}/profile-status", data)
            
            if result and result.get("success"):
                self.logger.info(f"✅ Successfully updated user {user_id} status to {status}")
                return True
            else:
                self.logger.error(f"❌ Failed to update user {user_id} status: {result}")
                return False
        
        except Exception as e:
            self.logger.error(f"❌ Error updating user {user_id} profile status: {e}")
            # Don't raise exception - this is a non-critical operation
            # The system can continue functioning even if Auth Service sync fails
            return False
    
    async def get_user_profile_status(self, user_id: UUID) -> Optional[str]:
        """Get user's current employee profile status from Auth Service."""
        
        try:
            self.logger.info(f"📋 Getting user {user_id} profile status")
            
            result = await self._make_request("GET", f"/users/{user_id}/profile-status")
            
            if result:
                status = result.get("employee_profile_status")
                self.logger.info(f"✅ User {user_id} profile status: {status}")
                return status
            else:
                self.logger.warning(f"⚠️  No profile status found for user {user_id}")
                return None
        
        except Exception as e:
            self.logger.error(f"❌ Error getting user {user_id} profile status: {e}")
            return None
        
    async def _fallback_user_status(self, user_id: UUID) -> str:
        """Fallback when Auth Service is unavailable"""
        self.logger.warning(f"Using fallback status for user {user_id}")
        return "UNKNOWN"  

    async def update_user_profile_status_with_fallback(self, user_id: UUID, status: str) -> bool:
        try:
            return await self.update_user_profile_status(user_id, status)
        except ServiceUnavailableException:
            await self._queue_status_update(user_id, status)
            return False 
        
    async def get_users_by_profile_status(self, status: str, limit: int = 100) -> list[Dict[str, Any]]:
        """Get users by their employee profile status."""
        
        try:
            self.logger.info(f"📋 Getting users with profile status: {status}")
            
            result = await self._make_request("GET", f"/users/by-profile-status/{status}?limit={limit}")
            
            if result:
                self.logger.info(f"✅ Found {len(result)} users with status {status}")
                return result
            else:
                self.logger.info(f"📭 No users found with status {status}")
                return []
        
        except Exception as e:
            self.logger.error(f"❌ Error getting users by status {status}: {e}")
            return []
    
    async def health_check(self) -> bool:
        """Check if Auth Service internal API is available."""
        
        try:
            result = await self._make_request("GET", "/health")
            return result is not None and result.get("status") == "healthy"
        
        except Exception as e:
            self.logger.error(f"❌ Auth Service health check failed: {e}")
            return False
    
    async def sync_user_status_background(self, user_id: UUID, status: str):
        """Background task to sync user status (non-blocking)."""
        
        try:
            # Run in background without blocking the main operation
            await asyncio.create_task(self.update_user_profile_status(user_id, status))
        except Exception as e:
            # Log but don't raise - this is a background operation
            self.logger.error(f"❌ Background sync failed for user {user_id}: {e}")


# Singleton instance for dependency injection
auth_service_client = AuthServiceClient()