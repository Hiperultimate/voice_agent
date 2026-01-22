import uuid
import logging
import os
from bot import run_bot, active_freeze_processors
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Voice Agent WS Server")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"status": "running", "message": "Agent server is active"}

# Structure: { 
#   "session_id": 
#       { "status": "active" } >> "active" | "waiting" | "ended"
#    }
active_sessions = {} 

@app.post("/start-session")
async def start_session():
    session_id = str(uuid.uuid4())
    active_sessions[session_id] = { "status": "waiting" }
    return {
        "session_id": session_id,
        "url": f"ws://localhost:8000/ws/{session_id}"
    }

@app.get("/session/{session_id}/data")
async def get_session_data(session_id: str):
    try:
        return FileResponse(f"data/{session_id}.json")
    except RuntimeError:
        return {"error": "File not found"}
    
@app.api_route("/session/{session_id}/audio", methods=["GET", "HEAD"])
async def get_audio(session_id: str):
    file_path = f"data/{session_id}.wav"
    if os.path.exists(file_path):
        return FileResponse(file_path, media_type="audio/wav")
    return {"error": "Audio file not found"}, 404

@app.post("/session/{session_id}/freeze")
async def toggle_freeze(session_id: str, frozen: bool):
    processor = active_freeze_processors.get(session_id)
    
    if not processor:
        return {"error": "Session not found or not active"}, 404

    processor.set_frozen(frozen)
    return {"status": "success", "session_id": session_id, "is_frozen": frozen}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):

    if( session_id not in active_sessions):
        logger.error(f"Invalid session ID attempt: {session_id}")
        await websocket.close(code=4003) # Forbidden
        return

    await websocket.accept()
    active_sessions[session_id]["status"] = "active"

    try:
        await run_bot(websocket, session_id)
    except WebSocketDisconnect:
        logger.info(f"An error occured {WebSocketDisconnect}")
    except Exception as e:
        logger.error(f"Error in session {session_id}: {e}")
    finally:
        # Cleanup
        if session_id in active_sessions:
            del active_sessions[session_id]
        logger.info(f"Session closed: {session_id}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)