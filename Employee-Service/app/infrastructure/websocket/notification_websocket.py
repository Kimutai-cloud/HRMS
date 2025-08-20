from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List, Optional
from uuid import UUID
import json
import asyncio
from datetime import datetime

from app.core.entities.user_claims import UserClaims
from app.infrastructure.security.jwt_handler import JWTHandler
from app.presentation.schema.websocket_schema import (
    NotificationWebSocketMessage,
    ProfileUpdateWebSocketMessage,
    SystemUpdateWebSocketMessage
)


class WebSocketConnectionManager:
    """Manages WebSocket connections for real-time notifications."""
    
    def __init__(self):
        # Dictionary mapping user_id to list of WebSocket connections
        self.active_connections: Dict[str, List[WebSocket]] = {}
        self.jwt_handler = JWTHandler()
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Accept WebSocket connection and add to active connections."""
        await websocket.accept()
        
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        
        self.active_connections[user_id].append(websocket)
        print(f"🔌 WebSocket connected for user {user_id}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Remove WebSocket connection."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            
            # Clean up empty user entries
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        
        print(f"🔌 WebSocket disconnected for user {user_id}")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Send message to specific user's connections."""
        if user_id not in self.active_connections:
            return
        
        # Send to all connections for this user (multiple tabs/devices)
        disconnected_websockets = []
        
        for websocket in self.active_connections[user_id]:
            try:
                await websocket.send_text(json.dumps(message, default=str))
            except Exception as e:
                print(f"❌ Failed to send WebSocket message to {user_id}: {e}")
                disconnected_websockets.append(websocket)
        
        # Clean up disconnected websockets
        for ws in disconnected_websockets:
            self.disconnect(ws, user_id)
    
    async def send_to_admins(self, message: dict):
        """Send message to all connected admin users."""
        # This would require integration with role service
        # For now, send to all connections (in production, filter by admin role)
        admin_user_ids = await self._get_admin_user_ids()
        
        for admin_id in admin_user_ids:
            await self.send_personal_message(message, str(admin_id))
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected users."""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)
    
    def get_user_connection_count(self, user_id: str) -> int:
        """Get number of active connections for a user."""
        return len(self.active_connections.get(user_id, []))
    
    def get_total_connections(self) -> int:
        """Get total number of active connections."""
        return sum(len(connections) for connections in self.active_connections.values())
    
    def get_connected_users(self) -> List[str]:
        """Get list of connected user IDs."""
        return list(self.active_connections.keys())
    
    async def _get_admin_user_ids(self) -> List[UUID]:
        """Get admin user IDs - placeholder for actual implementation."""
        # This would integrate with your role repository
        return []
    
    async def authenticate_websocket_user(self, token: str) -> Optional[UserClaims]:
        """Authenticate user from WebSocket token."""
        try:
            token_data = self.jwt_handler.verify_token(token)
            if not token_data:
                return None
            
            user_claims = UserClaims(
                user_id=UUID(token_data["user_id"]),
                email=token_data["email"],
                employee_profile_status=token_data["employee_profile_status"],
                token_type=token_data["token_type"],
                raw_payload=token_data
            )
            
            return user_claims
            
        except Exception as e:
            print(f"❌ WebSocket authentication failed: {e}")
            return None


# Global connection manager instance
websocket_manager = WebSocketConnectionManager()