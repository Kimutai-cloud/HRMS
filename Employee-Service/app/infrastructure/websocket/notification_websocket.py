from fastapi import WebSocket, WebSocketDisconnect, Depends
from typing import Dict, List, Optional, Set
from uuid import UUID
import json
import asyncio
from datetime import datetime, timedelta, timezone
from dataclasses import dataclass

from app.core.entities.user_claims import UserClaims
from app.infrastructure.security.jwt_handler import JWTHandler
from app.presentation.schema.websocket_schema import (
    NotificationWebSocketMessage,
    ProfileUpdateWebSocketMessage,
    SystemUpdateWebSocketMessage
)

@dataclass
class WebSocketSession:
    """Represents a WebSocket session with user context."""
    websocket: WebSocket
    user_id: str
    connected_at: datetime
    last_heartbeat: datetime
    session_id: str
    is_admin: bool = False
    client_info: Optional[Dict[str, str]] = None


class WebSocketConnectionManager:
    """Enhanced WebSocket connection manager with session tracking and role-based routing."""
    
    def __init__(self):
        # Enhanced session management
        self.active_sessions: Dict[str, List[WebSocketSession]] = {}  # user_id -> sessions
        self.session_lookup: Dict[str, WebSocketSession] = {}  # session_id -> session
        self.admin_sessions: Set[str] = set()  # Set of admin user_ids
        self.jwt_handler = JWTHandler()
        
        # Connection health management
        self._cleanup_task = None
        self._start_cleanup_task()
    
    async def connect_with_session(
        self, 
        websocket: WebSocket, 
        user_id: str, 
        session_id: str,
        is_admin: bool = False,
        client_info: Optional[Dict[str, str]] = None
    ):
        """Enhanced connection with session tracking."""
        await websocket.accept()
        
        now = datetime.now(timezone.utc)
        session = WebSocketSession(
            websocket=websocket,
            user_id=user_id,
            connected_at=now,
            last_heartbeat=now,
            session_id=session_id,
            is_admin=is_admin,
            client_info=client_info or {}
        )
        
        # Add to user sessions
        if user_id not in self.active_sessions:
            self.active_sessions[user_id] = []
        self.active_sessions[user_id].append(session)
        
        # Add to session lookup
        self.session_lookup[session_id] = session
        
        # Track admin sessions
        if is_admin:
            self.admin_sessions.add(user_id)
        
        print(f"🔌 WebSocket session {session_id} connected for user {user_id} (admin: {is_admin})")
        return session
    
    async def connect(self, websocket: WebSocket, user_id: str):
        """Legacy connect method - creates session automatically."""
        import uuid
        session_id = str(uuid.uuid4())
        return await self.connect_with_session(websocket, user_id, session_id)
    
    def disconnect_session(self, session_id: str):
        """Enhanced session disconnect."""
        if session_id not in self.session_lookup:
            return
            
        session = self.session_lookup[session_id]
        user_id = session.user_id
        
        # Remove from user sessions
        if user_id in self.active_sessions:
            self.active_sessions[user_id] = [
                s for s in self.active_sessions[user_id] 
                if s.session_id != session_id
            ]
            
            # Clean up empty user entries
            if not self.active_sessions[user_id]:
                del self.active_sessions[user_id]
                # Remove from admin sessions if no more sessions
                self.admin_sessions.discard(user_id)
        
        # Remove from session lookup
        del self.session_lookup[session_id]
        
        print(f"🔌 WebSocket session {session_id} disconnected for user {user_id}")
    
    def disconnect(self, websocket: WebSocket, user_id: str):
        """Legacy disconnect method."""
        # Find session by websocket
        session_to_remove = None
        for session_id, session in self.session_lookup.items():
            if session.websocket == websocket and session.user_id == user_id:
                session_to_remove = session_id
                break
        
        if session_to_remove:
            self.disconnect_session(session_to_remove)
        else:
            print(f"🔌 WebSocket disconnected for user {user_id} (legacy)")
    
    async def send_personal_message(self, message: dict, user_id: str):
        """Enhanced personal message sending with session tracking."""
        if user_id not in self.active_sessions:
            return
        
        # Send to all sessions for this user (multiple tabs/devices)
        disconnected_sessions = []
        
        for session in self.active_sessions[user_id]:
            try:
                await session.websocket.send_text(json.dumps(message, default=str))
                # Update last heartbeat on successful send
                session.last_heartbeat = datetime.now(timezone.utc)
            except Exception as e:
                print(f"❌ Failed to send WebSocket message to session {session.session_id}: {e}")
                disconnected_sessions.append(session.session_id)
        
        # Clean up disconnected sessions
        for session_id in disconnected_sessions:
            self.disconnect_session(session_id)
    
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
        return len(self.session_lookup)
    
    def get_connected_users(self) -> List[str]:
        """Get list of connected user IDs."""
        return list(self.active_sessions.keys())
    
    def update_heartbeat(self, session_id: str) -> bool:
        """Update heartbeat for a session."""
        if session_id in self.session_lookup:
            self.session_lookup[session_id].last_heartbeat = datetime.now(timezone.utc)
            return True
        return False
    
    def get_session_info(self, session_id: str) -> Optional[Dict[str, any]]:
        """Get session information."""
        if session_id not in self.session_lookup:
            return None
            
        session = self.session_lookup[session_id]
        return {
            "session_id": session.session_id,
            "user_id": session.user_id,
            "connected_at": session.connected_at.isoformat(),
            "last_heartbeat": session.last_heartbeat.isoformat(),
            "is_admin": session.is_admin,
            "client_info": session.client_info
        }
    
    def _start_cleanup_task(self):
        """Start background cleanup task."""
        async def cleanup_inactive_sessions():
            while True:
                try:
                    await asyncio.sleep(60)  # Check every minute
                    await self._cleanup_inactive_sessions()
                except Exception as e:
                    print(f"❌ Cleanup task error: {e}")
        
        if not self._cleanup_task or self._cleanup_task.done():
            self._cleanup_task = asyncio.create_task(cleanup_inactive_sessions())
    
    async def _cleanup_inactive_sessions(self):
        """Clean up sessions that haven't sent heartbeat in 5 minutes."""
        cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=5)
        inactive_sessions = []
        
        for session_id, session in self.session_lookup.items():
            if session.last_heartbeat < cutoff_time:
                inactive_sessions.append(session_id)
        
        for session_id in inactive_sessions:
            print(f"🧹 Cleaning up inactive session: {session_id}")
            self.disconnect_session(session_id)
    
    def get_admin_sessions(self) -> List[str]:
        """Get list of admin user IDs with active sessions."""
        return list(self.admin_sessions)
    
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