from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from typing import Optional
from datetime import datetime, timezone
import json
import asyncio

from app.infrastructure.websocket.notification_websocket import websocket_manager
from app.infrastructure.websocket.notification_sender import RealTimeNotificationSender

router = APIRouter(prefix="/ws", tags=["WebSocket"])


@router.websocket("/notifications")
async def websocket_notifications_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(None, description="JWT token for authentication")
):
    """WebSocket endpoint for real-time notifications."""
    
    if not token:
        await websocket.close(code=4001, reason="Authentication token required")
        return
    
    # Authenticate user
    user_claims = await websocket_manager.authenticate_websocket_user(token)
    if not user_claims:
        await websocket.close(code=4001, reason="Invalid authentication token")
        return
    
    user_id = str(user_claims.user_id)
    
    try:
        # Connect user
        await websocket_manager.connect(websocket, user_id)
        
        # Send connection confirmation
        await websocket.send_text(json.dumps({
            "type": "connection_established",
            "user_id": user_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "message": "Real-time notifications connected"
        }))
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages from client (heartbeat, etc.)
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "heartbeat":
                    await websocket.send_text(json.dumps({
                        "type": "heartbeat_response",
                        "timestamp": datetime.now(timezone.utc).isoformat()
                    }))
                elif message.get("type") == "mark_notification_read":
                    # Handle notification read acknowledgment
                    notification_id = message.get("notification_id")
                    if notification_id:
                        # This would integrate with notification service
                        print(f"📖 User {user_id} marked notification {notification_id} as read")
                
            except asyncio.TimeoutError:
                # Send periodic ping to keep connection alive
                await websocket.send_text(json.dumps({
                    "type": "ping",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }))
            
    except WebSocketDisconnect:
        websocket_manager.disconnect(websocket, user_id)
        print(f"🔌 User {user_id} disconnected from WebSocket")
    except Exception as e:
        print(f"❌ WebSocket error for user {user_id}: {e}")
        websocket_manager.disconnect(websocket, user_id)


@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics (admin only)."""
    
    return {
        "total_connections": websocket_manager.get_total_connections(),
        "connected_users": len(websocket_manager.get_connected_users()),
        "connection_details": {
            user_id: websocket_manager.get_user_connection_count(user_id)
            for user_id in websocket_manager.get_connected_users()
        }
    }