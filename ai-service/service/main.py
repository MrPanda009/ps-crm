from __future__ import annotations

import os
import traceback
import uuid
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

try:
    from service.onnx_inference_service import InferenceConfig, OnnxInferenceService
except ModuleNotFoundError:
    # Supports direct run: python service/main.py
    from onnx_inference_service import InferenceConfig, OnnxInferenceService

# Updated model path for consolidated ai-service structure
DEFAULT_MODEL = str(Path(__file__).parent.parent / "models/best.onnx")
MODEL_PATH = os.getenv("MODEL_PATH", DEFAULT_MODEL)

def download_model_if_missing():
    """
    If the model file is missing, try to download it from a URL provided in MODEL_URL.
    This solves the GitHub 100MB push limit issue.
    """
    model_path = Path(MODEL_PATH)
    model_url = os.getenv("MODEL_URL")
    
    if not model_path.exists() and model_url:
        print(f"DEBUG: Model file not found at {model_path}. Attempting download from {model_url}...")
        try:
            import requests
            model_path.parent.mkdir(parents=True, exist_ok=True)
            response = requests.get(model_url, stream=True, timeout=300)
            response.raise_for_status()
            with open(model_path, "wb") as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            print(f"DEBUG: Model downloaded successfully to {model_path}")
        except Exception as e:
            print(f"ERROR: Failed to download model: {e}")
            print(traceback.format_exc())

# Run download check before startup
download_model_if_missing()

from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="JanSamadhan AI Service", version="1.0.0")

# Enable CORS for browser-based frontend calls
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    ok: bool
    model_path: str
    model_version: str
    status: str
    supabase_ok: Optional[bool] = None
    supabase_reason: Optional[str] = None

class ErrorDetail(BaseModel):
    code: str
    message: str
    timestamp: str

class ErrorResponse(BaseModel):
    error: ErrorDetail

class CameraAnalyzeRequest(BaseModel):
    camera_id: str

def _error_response(code: str, message: str, status_code: int = 400, request_id: Optional[str] = None, stage: Optional[str] = None):
    from datetime import datetime
    payload = {
        "error": {
            "code": code,
            "message": message,
            "timestamp": datetime.utcnow().isoformat()
        }
    }
    if request_id:
        payload["request_id"] = request_id
    if stage:
        payload["stage_reached"] = stage

    return JSONResponse(
        status_code=status_code,
        content=payload
    )


def _error_response_with_hint(code: str, message: str, hint: str, status_code: int = 400, request_id: Optional[str] = None, stage: Optional[str] = None):
    base = _error_response(code, message, status_code=status_code, request_id=request_id, stage=stage)
    content = dict(base.body and __import__("json").loads(base.body.decode("utf-8")) or {})
    content["hint"] = hint
    return JSONResponse(status_code=status_code, content=content)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    request_id = request.headers.get("x-request-id")
    detail = exc.detail if isinstance(exc.detail, str) else str(exc.detail)
    return _error_response("HTTP_EXCEPTION", detail, status_code=exc.status_code, request_id=request_id)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    request_id = request.headers.get("x-request-id")
    print(f"[CCTV_DIAG][{request_id}] UNHANDLED_EXCEPTION {exc}")
    traceback.print_exc()
    return _error_response("UNHANDLED_EXCEPTION", str(exc), status_code=500, request_id=request_id)


@app.on_event("startup")
def startup_checks():
    """Startup diagnostics for required backend config."""
    try:
        from service.supabase_client import has_supabase_config
    except ModuleNotFoundError:
        from supabase_client import has_supabase_config

    ok, reason = has_supabase_config()
    print(f"[STARTUP] Supabase config check: {reason}")
    if not ok:
        print("[STARTUP] WARNING: Supabase config missing. /cctv/analyze_live will fail until env is fixed.")


def _create_service() -> OnnxInferenceService:
    model_path = Path(MODEL_PATH).resolve()
    if not model_path.exists():
        msg = f"CRITICAL: Detector model missing at {model_path}. Please check AI Service installation."
        print(msg)
        return None # Allow app to start so /health can report error

    print(f"INFO: Initializing detector signal from {model_path}")
    return OnnxInferenceService(
        model_path=model_path,
        config=InferenceConfig(conf=0.35, iou=0.7, imgsz=640),
    )


# Lazy init
_service: OnnxInferenceService | None = None


def get_service() -> OnnxInferenceService:
    global _service
    if _service is None:
        _service = _create_service()
    if _service is None:
        raise FileNotFoundError("AI Model not found on server.")
    return _service


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Standard health check for service monitoring."""
    try:
        from service.supabase_client import has_supabase_config
    except ModuleNotFoundError:
        from supabase_client import has_supabase_config

    sb_ok, sb_reason = has_supabase_config()

    try:
        service = get_service()
        return HealthResponse(
            ok=True, 
            model_path=service.model_path, 
            model_version="v2.0-stable",
            status="READY",
            supabase_ok=sb_ok,
            supabase_reason=sb_reason,
        )
    except Exception as e:
        return HealthResponse(
            ok=False,
            model_path=MODEL_PATH,
            model_version="unknown",
            status=f"ERROR: {str(e)}",
            supabase_ok=sb_ok,
            supabase_reason=sb_reason,
        )


@app.post("/infer/image")
async def infer_image(file: UploadFile = File(...)) -> dict:
    if not file.content_type or not file.content_type.startswith("image/"):
        return _error_response("BAD_REQUEST", "Only image uploads are supported")

    image_bytes = await file.read()
    if not image_bytes:
        return _error_response("BAD_REQUEST", "Empty file")

    service = get_service()
    import time
    start = time.time()
    result = service.predict_image_bytes(image_bytes)
    latency = (time.time() - start) * 1000

    return {
        "source_filename": file.filename,
        "model_version": "v2.0-stable",
        "latency_ms": round(latency, 2),
        **result,
    }


# ============================================================================
# SURVEILLANCE & COMMAND CENTER ENDPOINTS
# ============================================================================


@app.get("/geocode")
async def geocode(lat: float, lng: float):
    """Simple mock geocoder for Digipin resolution."""
    # Logic: First 5 digits of coords + '+'
    digipin = f"{str(lat)[:5]}+{str(lng)[:5]}".replace(".", "")
    return {"digipin": digipin[:9]}


@app.post("/cctv/analyze_live")
async def cctv_analyze_live(request: CameraAnalyzeRequest, x_request_id: Optional[str] = Header(default=None, alias="x-request-id")) -> dict:
    """
    Download video from camera's URL, extract burst frames, and run analysis.
    """
    request_id = x_request_id or f"srv_{uuid.uuid4().hex[:12]}"
    stage = "STAGE_0_INIT"
    diagnostics = {
        "request_id": request_id,
        "stage_reached": stage,
        "camera_found": False,
        "video_download_ok": False,
        "frames_extracted": 0,
        "detections_found": 0,
    }

    print(f"[CCTV_DIAG][{request_id}] START camera_id={request.camera_id}")

    try:
        from service.supabase_client import get_camera, BackendConfigError
        from service.cctv_handler import get_cctv_auto_handler
    except ModuleNotFoundError:
        from supabase_client import get_camera, BackendConfigError
        from cctv_handler import get_cctv_auto_handler

    stage = "STAGE_1_CAMERA_FETCH"
    diagnostics["stage_reached"] = stage
    try:
        camera = get_camera(request.camera_id, request_id=request_id)
    except BackendConfigError as e:
        print(f"[CCTV_DIAG][{request_id}] FAIL {stage} backend_config_error={e}")
        return _error_response("BACKEND_CONFIG_ERROR", str(e), status_code=500, request_id=request_id, stage=stage)

    if not camera:
        print(f"[CCTV_DIAG][{request_id}] FAIL {stage} camera not found")
        return _error_response_with_hint(
            "NOT_FOUND",
            "Camera not found",
            "camera_id_not_found_refresh_required",
            status_code=404,
            request_id=request_id,
            stage=stage,
        )
    diagnostics["camera_found"] = True

    stage = "STAGE_2_VIDEO_DOWNLOAD"
    diagnostics["stage_reached"] = stage
    video_url = camera.get("video_url")
    if not video_url:
        print(f"[CCTV_DIAG][{request_id}] FAIL {stage} video_url missing")
        return _error_response("BAD_REQUEST", "Camera has no video URL", request_id=request_id, stage=stage)

    # Download video to temp file
    import requests
    import tempfile
    import cv2
    from PIL import Image

    print(f"[CCTV_DIAG][{request_id}] {stage} downloading video from {video_url}")
    try:
        r = requests.get(video_url, timeout=30)
        r.raise_for_status()
        with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
            tmp.write(r.content)
            tmp_path = tmp.name
    except Exception as e:
        print(f"[CCTV_DIAG][{request_id}] FAIL {stage} download_error={e}")
        return _error_response("DOWNLOAD_FAILED", f"Failed to download video: {str(e)}", request_id=request_id, stage=stage)
    diagnostics["video_download_ok"] = True

    # Extract 10 frames spread across the video
    stage = "STAGE_3_FRAME_EXTRACT"
    diagnostics["stage_reached"] = stage
    burst_data = []
    timestamps = []
    best_frame = None
    max_conf = 0
    
    cap = cv2.VideoCapture(tmp_path)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0: fps = 30.0
    
    # Extract frames based on duration (2 FPS, max 45 frames)
    duration = total_frames / fps
    num_samples = min(int(duration * 2), 45)
    if num_samples < 5: num_samples = 5
    
    indices = [int(i * (total_frames - 1) / (num_samples - 1)) for i in range(num_samples)]
    
    stage = "STAGE_4_MODEL_INFERENCE"
    diagnostics["stage_reached"] = stage
    service = get_service()
    
    from datetime import datetime, timedelta
    base_time = datetime.utcnow()
    
    detections_found = 0
    for idx in indices:
        cap.set(cv2.CAP_PROP_POS_FRAMES, idx)
        ret, frame = cap.read()
        if not ret: continue
        
        # Calculate approximate real timestamp for this frame
        sec_offset = idx / fps
        frame_ts = (base_time + timedelta(seconds=sec_offset)).isoformat()
        timestamps.append(frame_ts)
        
        # Convert to PIL for inference
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        pil_img = Image.fromarray(frame_rgb)
        
        # Run inference
        result = service._predict_common(pil_img)
        burst_data.append(result["detections"])
        detections_found += len(result.get("detections", []))
        
        # Keep track of best frame for visual evidence
        if result["best_confidence"] > max_conf:
            max_conf = result["best_confidence"]
            best_frame = pil_img

    cap.release()
    import os
    try: os.unlink(tmp_path)
    except: pass

    diagnostics["frames_extracted"] = len(burst_data)
    diagnostics["detections_found"] = detections_found
    print(f"[CCTV_DIAG][{request_id}] {stage} frames_extracted={len(burst_data)} detections_found={detections_found}")

    if not burst_data:
        print(f"[CCTV_DIAG][{request_id}] FAIL {stage} no frames extracted")
        return _error_response("INFERENCE_FAILED", "Could not extract any frames from video", request_id=request_id, stage=stage)

    handler = get_cctv_auto_handler()
    # Process the burst with reliability engine
    stage = "STAGE_5_BURST_PROCESS"
    diagnostics["stage_reached"] = stage
    try:
        result = handler.process_burst(request.camera_id, burst_data, timestamps=timestamps, best_frame=best_frame, request_id=request_id)
    except Exception as e:
        print(f"[CCTV_DIAG][{request_id}] FAIL {stage} exception={e}")
        traceback.print_exc()
        return _error_response("BURST_PROCESS_FAILED", f"Burst processing failed: {str(e)}", status_code=500, request_id=request_id, stage=stage)

    stage = "STAGE_6_RESPONSE_RETURN"
    diagnostics["stage_reached"] = stage
    result["diagnostics"] = diagnostics
    print(f"[CCTV_DIAG][{request_id}] END backend_status={result.get('status')} diagnostics={diagnostics}")
    return result


class CameraVerifyRequest(BaseModel):
    camera_id: str
    verification_result: str  # "repaired" or "not_repaired"
    notes: Optional[str] = None


@app.post("/cctv/verify")
async def cctv_verify(request: CameraVerifyRequest) -> dict:
    """
    Verify CCTV camera analysis result after worker completes repair.
    Updates camera and ticket status based on verification result.
    """
    try:
        from service.supabase_client import verify_camera
    except ModuleNotFoundError:
        from supabase_client import verify_camera
    
    if request.verification_result not in ["repaired", "not_repaired"]:
        return _error_response(
            "INVALID_RESULT",
            "verification_result must be 'repaired' or 'not_repaired'",
            status_code=400
        )
    
    try:
        result = verify_camera(request.camera_id, request.verification_result)
        return {
            "status": result["status"],
            "camera_id": result["camera_id"],
            "complaint_id": result["complaint_id"],
            "verification_status": result["verification_status"],
            "ticket_status": result["ticket_status"],
            "verified_at": result["verified_at"]
        }
    except ValueError as e:
        return _error_response("INVALID_INPUT", str(e), status_code=400)
    except Exception as e:
        print(f"ERROR in /cctv/verify: {str(e)}")
        return _error_response("VERIFY_FAILED", f"Verification failed: {str(e)}", status_code=500)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=False)
