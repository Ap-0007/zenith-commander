import asyncio
import json
import time
from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
import uvicorn

app = FastAPI()

# In-memory session state
class ZenithSession:
    def __init__(self):
        self.active_missions = []
        self.logs = []
        self.agent_states = {
            "friday": {"status": "online", "task": "Monitoring system vitals"},
            "researcher": {"status": "idle", "task": "Waiting for directive"},
            "builder": {"status": "idle", "task": "Standing by"}
        }

session = ZenithSession()

# Serve static files
app.mount("/static", StaticFiles(directory="."), name="static")

@app.get("/", response_class=HTMLResponse)
async def get_index():
    with open("index.html", "r") as f:
        return f.read()

@app.post("/mission")
async def create_mission(request: Request):
    data = await request.json()
    goal = data.get("goal")
    
    # Simulate mission processing
    log_entry = {"type": "SYS", "msg": f"Director assigned new objective: {goal}"}
    session.logs.append(log_entry)
    
    # Update agents
    session.agent_states["researcher"]["status"] = "online"
    session.agent_states["researcher"]["task"] = f"Analyzing: {goal}"
    
    return {"status": "accepted", "goal": goal}

async def event_generator():
    """Streams logs and status updates to the frontend."""
    last_log_idx = 0
    while True:
        # Check for new logs
        if last_log_idx < len(session.logs):
            for i in range(last_log_idx, len(session.logs)):
                yield f"data: {json.dumps({'type': 'log', 'data': session.logs[i]})}\n\n"
            last_log_idx = len(session.logs)
        
        # Periodic Heartbeat / Telemetry
        yield f"data: {json.dumps({'type': 'status', 'agents': session.agent_states})}\n\n"
        
        await asyncio.sleep(2)

@app.get("/events")
async def events():
    return StreamingResponse(event_generator(), media_type="text/event-stream")

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=9988)
