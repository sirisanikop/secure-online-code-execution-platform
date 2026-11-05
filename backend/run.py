"""Start the platform:  python run.py   (API + built front end on http://127.0.0.1:8000)"""
import os

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:create_app", factory=True, host=os.environ.get("HOST", "127.0.0.1"),
                port=int(os.environ.get("PORT", "8000")), log_level="info")
