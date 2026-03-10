import os
import json
import uuid
import base64
import hashlib
import re
import asyncio
import urllib.parse
import urllib.request
from pathlib import Path
from io import BytesIO
from datetime import datetime, timezone
from typing import Optional, Dict, List, Any
from math import radians, sin, cos, sqrt, atan2

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from supabase import create_client, Client
from google import genai
from PIL import Image
from dotenv import load_dotenv


# =========================================================
# 1. CONFIGURATION
# =========================================================

ROOT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR / "apps" / "web" / ".env.local", override=False)

GEMINI_API_KEY    = os.getenv("GEMINI_API_KEY")
GEMINI_PRIMARY_MODEL = os.getenv("GEMINI_PRIMARY_MODEL", "gemini-2.5-flash")
GEMINI_FALLBACK_MODEL = os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.0-flash")
MAPPLS_API_KEY = os.getenv("MAPPLS_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
_svc_key = os.getenv("SUPABASE_SERVICE_KEY")
if not _svc_key:
    import warnings
    warnings.warn(
        "SUPABASE_SERVICE_KEY is not set — falling back to NEXT_PUBLIC_SUPABASE_ANON_KEY. "
        "Storage uploads and RLS-bypassed inserts may fail with the anon key.",
        stacklevel=1,
    )
SUPABASE_SERVICE_KEY = _svc_key or os.getenv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set.")

gemini_client = genai.Client(api_key=GEMINI_API_KEY)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
REVERSE_GEOCODE_CACHE: Dict[str, Dict[str, str]] = {}
ALLOWED_STATUSES = {"submitted", "verified", "assigned", "in_progress", "resolved", "closed"}
DUPLICATE_LOOKBACK_HOURS = 24
DUPLICATE_RADIUS_METERS = 50.0

ISSUE_TYPE_AUTHORITY_KEYWORDS = [
    (["street light", "light", "electricity", "power", "wire", "transformer"], "DISCOM"),
    (["garbage", "waste", "sanitation", "sweeping", "toilet", "drain", "sewage"], "MCD"),
    (["pothole", "road", "flyover", "bridge", "infrastructure", "lane"], "PWD"),
    (["water", "pipe", "sewer"], "DJB"),
    (["traffic", "signal", "parking", "accident"], "TRAFFIC_POLICE"),
    (["crime", "safety", "theft", "harassment"], "DELHI_POLICE"),
    (["metro", "station", "escalator", "lift"], "DMRC"),
    (["pollution", "burning", "noise", "industrial"], "DPCC"),
    (["tree", "forest"], "FOREST_DEPT"),
]

NDMC_LOCALITY_HINTS = ["connaught", "cp", "lutyens", "chanakyapuri", "janpath"]


# =========================================================
# 2. FASTAPI INITIALIZATION
# =========================================================

app = FastAPI(
    title="Civic Issue Detection API",
    description="AI powered civic complaint classification system",
)

origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://10.176.53.15:3000",
    "https://jansamadhan.perkkk.dev",
    "https://api.jansamadhan.perkkk.dev",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["POST", "OPTIONS", "GET"],
    allow_headers=["Content-Type", "Authorization"],
)


# =========================================================
# 3. CHILD CATEGORY TAXONOMY (1-42)
# =========================================================

CHILD_CATEGORIES: Dict[int, Dict] = {
    1:  {"name": "Metro Station Issue",             "parent": 100, "authority": "DMRC"},
    2:  {"name": "Metro Track / Safety",            "parent": 100, "authority": "DMRC"},
    3:  {"name": "Escalator / Lift",                "parent": 100, "authority": "DMRC"},
    4:  {"name": "Metro Parking",                   "parent": 100, "authority": "DMRC"},
    5:  {"name": "Metro Station Hygiene",           "parent": 100, "authority": "DMRC"},
    6:  {"name": "Metro Property Damage",           "parent": 100, "authority": "DMRC"},
    7:  {"name": "National Highway Damage",         "parent": 101, "authority": "NHAI"},
    8:  {"name": "Toll Plaza Issue",                "parent": 101, "authority": "NHAI"},
    9:  {"name": "Expressway Problem",              "parent": 101, "authority": "NHAI"},
    10: {"name": "Highway Bridge Damage",           "parent": 101, "authority": "NHAI"},
    11: {"name": "State Highway / City Road",       "parent": 101, "authority": "PWD"},
    12: {"name": "Flyover / Overbridge",            "parent": 101, "authority": "PWD"},
    13: {"name": "Government Building Issue",       "parent": 109, "authority": "PWD"},
    14: {"name": "Large Drainage System",           "parent": 101, "authority": "PWD"},
    15: {"name": "Colony Road / Lane",              "parent": 101, "authority": "MCD"},
    16: {"name": "Garbage Collection",              "parent": 104, "authority": "MCD"},
    17: {"name": "Street Sweeping",                 "parent": 104, "authority": "MCD"},
    18: {"name": "Park Maintenance",                "parent": 105, "authority": "MCD"},
    19: {"name": "Public Toilet",                   "parent": 104, "authority": "MCD"},
    20: {"name": "Local Drain / Sewage",            "parent": 102, "authority": "MCD"},
    21: {"name": "Stray Animals",                   "parent": 104, "authority": "MCD"},
    22: {"name": "Street Light (MCD zone)",         "parent": 108, "authority": "MCD"},
    23: {"name": "Connaught Place / Lutyens Issue", "parent": 110, "authority": "NDMC"},
    24: {"name": "NDMC Road / Infrastructure",      "parent": 110, "authority": "NDMC"},
    25: {"name": "NDMC Street Light",               "parent": 108, "authority": "NDMC"},
    26: {"name": "Central Govt Residential Zone",   "parent": 109, "authority": "NDMC"},
    27: {"name": "Water Supply Failure",            "parent": 102, "authority": "DJB"},
    28: {"name": "Water Pipe Leakage",              "parent": 102, "authority": "DJB"},
    29: {"name": "Sewer Line Blockage",             "parent": 102, "authority": "DJB"},
    30: {"name": "Contaminated Water",              "parent": 102, "authority": "DJB"},
    31: {"name": "Power Outage",                    "parent": 103, "authority": "DISCOM"},
    32: {"name": "Transformer Issue",               "parent": 103, "authority": "DISCOM"},
    33: {"name": "Exposed / Fallen Wire",           "parent": 103, "authority": "DISCOM"},
    34: {"name": "Electricity Pole Damage",         "parent": 103, "authority": "DISCOM"},
    35: {"name": "Crime / Safety Issue",            "parent": 106, "authority": "DELHI_POLICE"},
    36: {"name": "Traffic Signal Problem",          "parent": 106, "authority": "TRAFFIC_POLICE"},
    37: {"name": "Illegal Parking",                 "parent": 106, "authority": "TRAFFIC_POLICE"},
    38: {"name": "Road Accident Black Spot",        "parent": 106, "authority": "TRAFFIC_POLICE"},
    39: {"name": "Illegal Tree Cutting",            "parent": 107, "authority": "FOREST_DEPT"},
    40: {"name": "Air Pollution / Burning",         "parent": 107, "authority": "DPCC"},
    41: {"name": "Noise Pollution",                 "parent": 107, "authority": "DPCC"},
    42: {"name": "Industrial Waste Dumping",        "parent": 107, "authority": "DPCC"},
}

# Severity mapping: Gemini label -> DB value
SEVERITY_MAP = {
    "Low":      "L1",
    "Medium":   "L2",
    "High":     "L3",
    "Critical": "L4",
}


# =========================================================
# 4. RESPONSE MODELS
# =========================================================

class TicketPreview(BaseModel):
    child_id: int
    issue_name: str
    parent_id: int
    authority: str
    title: str
    description: str
    severity: str          # Human label: Low / Medium / High / Critical
    severity_db: str       # DB label:    L1 / L2 / L3 / L4
    status: str
    ward_name: str
    pincode: str
    digipin: str
    locality: str
    city: str
    district: str
    state: str
    formatted_address: str
    latitude: float
    longitude: float
    accuracy: float
    timestamp: str
    confidence: float
    user_text: str
    confirm_prompt: str    # Instruction shown below ticket preview in chat


class TicketCreated(BaseModel):
    ticket_id: str         # e.g. DL-2026-00042 (from DB trigger)
    complaint_id: str      # uuid of the inserted row
    child_id: int
    issue_name: str
    authority: str
    title: str
    severity_db: str
    status: str
    ward_name: str
    pincode: str
    digipin: str
    formatted_address: str
    photo_urls: List[str]
    latitude: float
    longitude: float
    accuracy: float
    timestamp: str
    image_metadata: Optional[Dict[str, str]] = None


# =========================================================
# 5. HELPERS
# =========================================================

def get_citizen_id_from_token(authorization: Optional[str]) -> str:
    """
    Decode the Supabase JWT passed as 'Bearer <token>' and extract the user uuid.
    We do NOT verify signature here — Supabase service key insert already trusts the caller.
    For production, verify the JWT using Supabase JWT secret.
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header.")

    token = authorization.split(" ", 1)[1]
    try:
        # JWT payload is the middle segment, base64url encoded
        payload_b64 = token.split(".")[1]
        # Add padding
        payload_b64 += "=" * (4 - len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        citizen_id = payload.get("sub")
        if not citizen_id:
            raise HTTPException(status_code=401, detail="JWT does not contain user id (sub).")
        return citizen_id
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Failed to decode JWT: {str(e)}")


def upload_image_to_supabase(image_data: bytes, filename: str) -> str:
    """
    Upload image to Supabase Storage bucket 'complaint-photos'.
    Returns the public URL of the uploaded file.
    """
    bucket = "complaint-photos"
    path   = f"complaints/{filename}"

    result = supabase.storage.from_(bucket).upload(
        path=path,
        file=image_data,
        file_options={"content-type": "image/jpeg", "upsert": "true"},
    )

    # Check if upload actually succeeded
    if hasattr(result, 'json') and isinstance(result.json(), dict) and result.json().get('error'):
        raise Exception(f"Storage upload error: {result.json()['error']}")

    public_url = supabase.storage.from_(bucket).get_public_url(path)
    return public_url


def _coord_cache_key(latitude: float, longitude: float) -> str:
    # Rounded key keeps cache stable for repeated location reads in the same area.
    return f"{latitude:.5f},{longitude:.5f}"


def _pick_first(data: Dict, keys: List[str]) -> str:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def _fallback_digipin(latitude: float, longitude: float) -> str:
    lat = str(abs(latitude)).replace(".", "")[:8]
    lng = str(abs(longitude)).replace(".", "")[:8]
    return f"DG-{lat}-{lng}"


def _haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000.0
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)
    a = sin(d_lat / 2) ** 2 + cos(radians(lat1)) * cos(radians(lat2)) * sin(d_lng / 2) ** 2
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def _parse_coords_from_location(location_value: Any) -> Optional[Dict[str, float]]:
    if isinstance(location_value, str):
        match = re.search(r"POINT\(([-0-9.]+)\s+([-0-9.]+)\)", location_value)
        if match:
            return {"lng": float(match.group(1)), "lat": float(match.group(2))}
    return None


def _find_recent_duplicate(
    *,
    category_id: int,
    latitude: float,
    longitude: float,
    lookback_hours: int = DUPLICATE_LOOKBACK_HOURS,
) -> Optional[Dict[str, Any]]:
    since_iso = datetime.now(timezone.utc).timestamp() - lookback_hours * 3600
    since = datetime.fromtimestamp(since_iso, tz=timezone.utc).isoformat()

    try:
        rows = (
            supabase.table("complaints")
            .select("id, ticket_id, title, status, created_at, location")
            .eq("category_id", category_id)
            .gte("created_at", since)
            .limit(100)
            .execute()
        )
    except Exception:
        return None

    for row in rows.data or []:
        coords = _parse_coords_from_location(row.get("location"))
        if not coords:
            continue
        distance_m = _haversine_meters(latitude, longitude, coords["lat"], coords["lng"])
        if distance_m <= DUPLICATE_RADIUS_METERS:
            return {
                "id": row.get("id"),
                "ticket_id": row.get("ticket_id") or row.get("id"),
                "title": row.get("title") or "Existing complaint",
                "status": row.get("status") if row.get("status") in ALLOWED_STATUSES else "submitted",
                "created_at": row.get("created_at") or "",
                "distance_m": round(distance_m, 1),
            }
    return None


def reverse_geocode_from_coordinates(latitude: float, longitude: float) -> Dict[str, str]:
    key = _coord_cache_key(latitude, longitude)
    if key in REVERSE_GEOCODE_CACHE:
        return REVERSE_GEOCODE_CACHE[key]

    location = {
        "pincode": "",
        "locality": "",
        "city": "",
        "district": "",
        "state": "",
        "formatted_address": "",
        "digipin": "",
    }

    if MAPPLS_API_KEY:
        try:
            query = urllib.parse.urlencode({"lat": latitude, "lng": longitude})
            url = f"https://apis.mappls.com/advancedmaps/v1/{MAPPLS_API_KEY}/rev_geocode?{query}"
            with urllib.request.urlopen(url, timeout=8) as res:
                payload = json.loads(res.read().decode("utf-8"))

            results = payload.get("results") if isinstance(payload, dict) else None
            result = results[0] if isinstance(results, list) and results else {}
            if isinstance(result, dict):
                location["pincode"] = _pick_first(result, ["pincode", "pin", "postalCode"])
                location["locality"] = _pick_first(result, ["locality", "subLocality", "subDistrict"])
                location["city"] = _pick_first(result, ["city", "district", "county"])
                location["district"] = _pick_first(result, ["district", "city_district", "county"])
                location["state"] = _pick_first(result, ["state", "stateName"])
                location["formatted_address"] = _pick_first(
                    result,
                    ["formatted_address", "formattedAddress", "placeAddress", "address"],
                )
                location["digipin"] = _pick_first(result, ["digipin", "DIGIPIN", "digitalPin", "digital_pin"])
        except Exception:
            pass

    # Fallback to OSM reverse geocoder if Mappls data is unavailable.
    if not location["pincode"] or not location["formatted_address"]:
        try:
            query = urllib.parse.urlencode({
                "lat": latitude,
                "lon": longitude,
                "format": "jsonv2",
                "addressdetails": 1,
            })
            req = urllib.request.Request(
                f"https://nominatim.openstreetmap.org/reverse?{query}",
                headers={"User-Agent": "JanSamadhan/1.0"},
            )
            with urllib.request.urlopen(req, timeout=8) as res:
                payload = json.loads(res.read().decode("utf-8"))

            address = payload.get("address", {}) if isinstance(payload, dict) else {}
            if isinstance(address, dict):
                location["pincode"] = location["pincode"] or _pick_first(address, ["postcode"])
                location["locality"] = location["locality"] or _pick_first(
                    address,
                    ["suburb", "neighbourhood", "city_district", "village", "town"],
                )
                location["city"] = location["city"] or _pick_first(address, ["city", "town", "village"])
                location["district"] = location["district"] or _pick_first(address, ["state_district", "county"])
                location["state"] = location["state"] or _pick_first(address, ["state"])

            if not location["formatted_address"] and isinstance(payload, dict):
                display_name = payload.get("display_name")
                if isinstance(display_name, str):
                    location["formatted_address"] = display_name.strip()
        except Exception:
            pass

    if not location["city"]:
        location["city"] = "Delhi"
    if not location["state"]:
        location["state"] = "Delhi"
    if not location["pincode"]:
        location["pincode"] = "000000"
    if not location["formatted_address"]:
        location["formatted_address"] = f"Lat {latitude:.6f}, Lng {longitude:.6f}"
    if not location["digipin"]:
        location["digipin"] = _fallback_digipin(latitude, longitude)

    if len(REVERSE_GEOCODE_CACHE) >= 500:
        first_key = next(iter(REVERSE_GEOCODE_CACHE))
        REVERSE_GEOCODE_CACHE.pop(first_key, None)
    REVERSE_GEOCODE_CACHE[key] = location
    return location


def build_complaint_record(
    *,
    user_id: str,
    issue_type: str,
    severity: str,
    description: str,
    image_url: str,
    lat: float,
    lng: float,
    address: str,
    pincode: str,
    city: str,
    district: str,
    authority: str,
    status: str,
    digipin: str,
) -> Dict[str, Any]:
    """
    Canonical complaint model (coordinates-first) used as source before DB mapping.
    """
    return {
        "id": "",
        "user_id": user_id,
        "issue_type": issue_type,
        "severity": severity,
        "description": description,
        "image_url": image_url,
        "lat": lat,
        "lng": lng,
        "address": address,
        "pincode": pincode,
        "city": city,
        "district": district,
        "authority": authority,
        "status": status,
        "created_at": "",
        "digipin": digipin,
    }


def _in_ndmc_zone(latitude: float, longitude: float) -> bool:
    return 28.62 <= latitude <= 28.64 and 77.19 <= longitude <= 77.23


def _infer_authority_from_issue_type(issue_type: str) -> Optional[str]:
    value = issue_type.lower()
    for keywords, authority in ISSUE_TYPE_AUTHORITY_KEYWORDS:
        if any(k in value for k in keywords):
            return authority
    return None


def route_authority(
    *,
    issue_type: str,
    latitude: float,
    longitude: float,
    location: Dict[str, str],
    default_authority: str,
) -> str:
    inferred = _infer_authority_from_issue_type(issue_type)
    routed = inferred or default_authority

    locality = (location.get("locality") or "").lower()
    pincode = (location.get("pincode") or "").strip()
    is_ndmc = _in_ndmc_zone(latitude, longitude) or any(h in locality for h in NDMC_LOCALITY_HINTS) or pincode in {"110001", "110011", "110003"}

    if is_ndmc and routed in {"MCD", "PWD", "DISCOM"}:
        return "NDMC"

    return routed


# =========================================================
# 6. GEMINI ANALYSIS FUNCTION
# =========================================================

def analyze_issue_with_gemini(
    image: Image.Image,
    text: str,
    latitude: float,
    longitude: float,
) -> dict:

    def _is_quota_error(err: Exception) -> bool:
        msg = str(err)
        return "RESOURCE_EXHAUSTED" in msg or "quota" in msg.lower() or "429" in msg

    def _is_model_not_found(err: Exception) -> bool:
        msg = str(err)
        return "NOT_FOUND" in msg or "not found" in msg.lower() or "404" in msg

    def _retry_hint(err: Exception) -> str:
        msg = str(err)
        m = re.search(r"retry in\s+([0-9.]+s)", msg, flags=re.IGNORECASE)
        return m.group(1) if m else "a few seconds"

    def _call_gemini_json(local_prompt: str) -> dict:
        models = [GEMINI_PRIMARY_MODEL]
        if GEMINI_FALLBACK_MODEL and GEMINI_FALLBACK_MODEL != GEMINI_PRIMARY_MODEL:
            models.append(GEMINI_FALLBACK_MODEL)

        last_quota_error: Optional[Exception] = None

        for model_name in models:
            try:
                response = gemini_client.models.generate_content(
                    model=model_name,
                    contents=[local_prompt, image],
                    config={"temperature": 0},
                )
                break
            except Exception as e:
                if _is_quota_error(e):
                    last_quota_error = e
                    continue
                if _is_model_not_found(e):
                    # Skip retired/unsupported model IDs and try next configured model.
                    continue
                raise HTTPException(status_code=500, detail=f"Gemini request failed: {str(e)}")
        else:
            hint = _retry_hint(last_quota_error) if last_quota_error else "a few seconds"
            raise HTTPException(
                status_code=429,
                detail=(
                    f"Gemini quota exhausted for configured models ({', '.join(models)}). "
                    f"Please retry in {hint} or switch to a billed Gemini project."
                ),
            )

        raw = response.text.strip()

        # Strip markdown fences if model adds them despite instructions
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            raise HTTPException(
                status_code=500,
                detail=f"Gemini returned non-JSON response: {raw[:300]}"
            )

    prompt = f"""
You are a strict civic issue analyst for a Delhi government complaint platform.

Analyze the provided image step by step and return a single JSON object.
No explanation, no markdown, no code fences — ONLY raw JSON.

=== STEP 1: IMAGE ANALYSIS ===
Carefully examine the image. Identify:
- What physical object or infrastructure is visible?
- What is wrong with it? (damaged, broken, missing, overflowing, dirty, etc.)
- How severe does the damage appear visually?

=== STEP 2: USER DESCRIPTION ===
User description (supporting context only, image is primary):
{text}

=== STEP 3: CLASSIFICATION ===
Using STEPS 1 + 2 together, select the single best Child ID:

1=Metro Station Issue | 2=Metro Track/Safety | 3=Escalator/Lift | 4=Metro Parking
5=Metro Station Hygiene | 6=Metro Property Damage | 7=National Highway Damage
8=Toll Plaza Issue | 9=Expressway Problem | 10=Highway Bridge Damage
11=State Highway/City Road | 12=Flyover/Overbridge | 13=Government Building Issue
14=Large Drainage System | 15=Colony Road/Lane | 16=Garbage Collection
17=Street Sweeping | 18=Park Maintenance | 19=Public Toilet | 20=Local Drain/Sewage
21=Stray Animals | 22=Street Light (MCD zone) | 23=Connaught Place/Lutyens Issue
24=NDMC Road/Infrastructure | 25=NDMC Street Light | 26=Central Govt Residential Zone
27=Water Supply Failure | 28=Water Pipe Leakage | 29=Sewer Line Blockage
30=Contaminated Water | 31=Power Outage | 32=Transformer Issue
33=Exposed/Fallen Wire | 34=Electricity Pole Damage | 35=Crime/Safety Issue
36=Traffic Signal Problem | 37=Illegal Parking | 38=Road Accident Black Spot
39=Illegal Tree Cutting | 40=Air Pollution/Burning | 41=Noise Pollution
42=Industrial Waste Dumping

=== STEP 4: SEVERITY ===
Based on visual damage and safety risk:
- Low      = Minor issue, no immediate risk (dim light, small pothole)
- Medium   = Inconvenient but not dangerous (garbage pile, broken footpath)
- High     = Potential safety risk (exposed wire, large pothole, sewage overflow)
- Critical = Immediate danger to life or property (live wire on ground, collapsed structure)

=== OUTPUT ===
Return ONLY this exact JSON:
{{
  "child_id": <integer 1-42>,
        "title": "<5-10 word title describing issue>",
        "description": "<2-3 sentences: what is visible and what is wrong>",
        "severity": "<Low | Medium | High | Critical>",
        "confidence": <float between 0 and 1>
}}

If image is NOT a civic infrastructure issue return exactly: {{"error": "INVALID"}}
"""

    result = _call_gemini_json(prompt)

    if result.get("error") == "INVALID":
        # Fallback pass: force a best-effort civic classification instead of rejecting outright.
        fallback_prompt = f"""
You are a Delhi civic issue classifier.

The previous classifier marked the image as INVALID, but for this workflow you MUST return
the closest civic infrastructure category with a best-effort assessment.
Never return INVALID.

Device coordinates:
Latitude : {latitude}
Longitude: {longitude}

User description:
{text}

Choose one child_id from 1-42. If the issue appears to involve lighting/poles/wires,
prefer 22, 25, 33, or 34.

Return ONLY JSON in this exact shape:
{{
  "child_id": <integer 1-42>,
  "title": "<5-10 word title>",
  "description": "<2-3 sentence best-effort assessment>",
        "severity": "<Low | Medium | High | Critical>",
        "confidence": <float between 0 and 1>
}}
"""
        result = _call_gemini_json(fallback_prompt)

    child_id = result.get("child_id")
    if not isinstance(child_id, int) or child_id not in CHILD_CATEGORIES:
        raise HTTPException(status_code=500, detail=f"Gemini returned invalid child_id: {child_id}")

    if result.get("severity") not in {"Low", "Medium", "High", "Critical"}:
        raise HTTPException(status_code=500, detail=f"Gemini returned invalid severity: {result.get('severity')}")

    confidence = result.get("confidence")
    if not isinstance(confidence, (int, float)):
        result["confidence"] = 0.5
    else:
        result["confidence"] = max(0.0, min(1.0, float(confidence)))

    for field in ["title", "description"]:
        if not result.get(field):
            raise HTTPException(status_code=500, detail=f"Gemini did not return required field: {field}")

    return result


# =========================================================
# 6b. REVERSE GEOCODE ENDPOINT
# =========================================================

@app.get("/geocode")
async def geocode(lat: float, lng: float):
    """Return reverse-geocoded details (pincode, digipin, address, etc.)."""
    location = await asyncio.to_thread(reverse_geocode_from_coordinates, lat, lng)
    return location


# =========================================================
# 7. ANALYZE ENDPOINT  (preview only — does NOT write to DB)
# =========================================================

@app.options("/analyze")
async def analyze_options() -> Response:
    return Response(status_code=204)

@app.post("/analyze", response_model=TicketPreview)
async def analyze(
    image: UploadFile = File(...),
    user_text: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy: float = Form(...),
    timestamp: str = Form(...),
    authorization: Optional[str] = Header(None),
):
    # Auth check — must be logged in
    get_citizen_id_from_token(authorization)

    image_data = await image.read()
    img = Image.open(BytesIO(image_data))

    # Run AI classification and reverse geocoding in parallel to reduce latency.
    result, location = await asyncio.gather(
        asyncio.to_thread(analyze_issue_with_gemini, img, user_text, latitude, longitude),
        asyncio.to_thread(reverse_geocode_from_coordinates, latitude, longitude),
    )

    child_id = result["child_id"]
    category = CHILD_CATEGORIES[child_id]
    severity_db = SEVERITY_MAP[result["severity"]]
    ward_name = location["locality"] or "Unknown locality"
    routed_authority = route_authority(
        issue_type=category["name"],
        latitude=latitude,
        longitude=longitude,
        location=location,
        default_authority=category["authority"],
    )

    return TicketPreview(
        child_id=child_id,
        issue_name=category["name"],
        parent_id=category["parent"],
        authority=routed_authority,
        title=result["title"],
        description=result["description"],
        severity=result["severity"],
        severity_db=severity_db,
        status="submitted",
        ward_name=ward_name,
        pincode=location["pincode"],
        digipin=location["digipin"],
        locality=location["locality"],
        city=location["city"],
        district=location["district"],
        state=location["state"],
        formatted_address=location["formatted_address"],
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        timestamp=timestamp,
        confidence=result["confidence"],
        user_text=user_text,
        confirm_prompt="✅ Ticket preview ready. Type \"confirm\" or \"submit\" to raise this ticket, or describe the issue differently to re-analyse.",
    )


# =========================================================
# 8. CONFIRM ENDPOINT  (user confirms preview -> writes to DB)
# =========================================================

@app.options("/confirm")
async def confirm_options() -> Response:
    return Response(status_code=204)

@app.post("/confirm", response_model=TicketCreated)
async def confirm(
    image: UploadFile = File(...),
    user_text: str = Form(...),
    latitude: float = Form(...),
    longitude: float = Form(...),
    accuracy: float = Form(...),
    timestamp: str = Form(...),
    child_id: int = Form(...),
    title: str = Form(...),
    description: str = Form(...),
    severity_db: str = Form(...),     # L1 / L2 / L3 / L4
    ward_name: Optional[str] = Form(None),
    pincode: Optional[str] = Form(None),
    force_submit: bool = Form(False),
    authorization: Optional[str] = Header(None),
    user_agent: Optional[str] = Header(None),
):
    # 1. Extract citizen_id from JWT
    citizen_id = get_citizen_id_from_token(authorization)

    if child_id not in CHILD_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid child_id: {child_id}")

    if severity_db not in {"L1", "L2", "L3", "L4"}:
        raise HTTPException(status_code=400, detail=f"Invalid severity_db: {severity_db}")

    category = CHILD_CATEGORIES[child_id]

    duplicate = _find_recent_duplicate(category_id=child_id, latitude=latitude, longitude=longitude)
    if duplicate and not force_submit:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "DUPLICATE_DETECTED",
                "message": "A similar complaint exists within 50 meters in the last 24 hours.",
                "duplicate": duplicate,
                "options": ["upload_anyway", "upvote_existing"],
            },
        )

    location = reverse_geocode_from_coordinates(latitude, longitude)
    derived_ward_name = location["locality"] or (ward_name or "Unknown locality")
    derived_pincode = location["pincode"] or (pincode or "000000")
    formatted_address = location["formatted_address"]
    digipin = location["digipin"]
    routed_authority = route_authority(
        issue_type=category["name"],
        latitude=latitude,
        longitude=longitude,
        location=location,
        default_authority=category["authority"],
    )

    # 2. Upload image to Supabase Storage
    image_data = await image.read()
    image_hash = hashlib.sha256(image_data).hexdigest()
    upload_time = datetime.now(timezone.utc).isoformat()
    device_type = (user_agent or "unknown")[:120]
    img_metadata = {
        "upload_time": upload_time,
        "image_hash": image_hash,
        "device_type": device_type,
    }
    filename = f"{uuid.uuid4()}.jpg"
    try:
        photo_url = upload_image_to_supabase(image_data, filename)
        photo_urls = [photo_url]
    except Exception as upload_err:
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=502,
            detail=f"Image upload to storage failed: {upload_err}. "
                   f"Bucket=complaint-photos, path=complaints/{filename}",
        )

    # 3. Build PostGIS geography point string
    location_wkt = f"POINT({longitude} {latitude})"
    address_text = formatted_address
    complaint_record = build_complaint_record(
        user_id=citizen_id,
        issue_type=category["name"],
        severity=severity_db,
        description=description,
        image_url=photo_urls[0] if photo_urls else "",
        lat=latitude,
        lng=longitude,
        address=formatted_address,
        pincode=derived_pincode,
        city=location["city"] or "Delhi",
        district=location["district"],
        authority=routed_authority,
        status="submitted",
        digipin=digipin,
    )

    # 4. Insert complaint into Supabase
    # ticket_id is auto-generated by a DB trigger (e.g. DL-2026-XXXXX)
    try:
        response = supabase.table("complaints").insert({
            "citizen_id":          complaint_record["user_id"],
            "category_id":         child_id,
            "title":               title,
            "description":         complaint_record["description"],
            "severity":            complaint_record["severity"],
            "effective_severity":  complaint_record["severity"],
            "status":              complaint_record["status"],
            "location":            location_wkt,
            "ward_name":           derived_ward_name,
            "pincode":             complaint_record["pincode"],
            "digipin":             complaint_record["digipin"],
            "address_text":        address_text,
            "photo_urls":          photo_urls,
            "photo_count":         len(photo_urls),
            "assigned_department": complaint_record["authority"],
            "city":                complaint_record["city"],
            "upvote_count":        0,
            "is_spam":             False,
            "possible_duplicate":  bool(duplicate),
            "sla_breached":        False,
            "escalation_level":    0,
            "upvote_boost":        0,
        }).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database insert failed: {str(e)}")

    if not response.data:
        raise HTTPException(status_code=500, detail="Database insert returned no data.")

    inserted = response.data[0]
    complaint_record["id"] = inserted["id"]
    complaint_record["created_at"] = inserted.get("created_at") or datetime.now(timezone.utc).isoformat()

    return TicketCreated(
        ticket_id=inserted.get("ticket_id", "PENDING"),
        complaint_id=inserted["id"],
        child_id=child_id,
        issue_name=category["name"],
        authority=routed_authority,
        title=title,
        severity_db=severity_db,
        status="submitted",
        ward_name=derived_ward_name,
        pincode=derived_pincode,
        digipin=digipin,
        formatted_address=formatted_address,
        photo_urls=photo_urls,
        latitude=latitude,
        longitude=longitude,
        accuracy=accuracy,
        timestamp=timestamp,
        image_metadata=img_metadata,
    )


# =========================================================
# 9. ROOT MESSAGE
# =========================================================

@app.get("/")
def home():
    return {
        "message":
        "Welcome to the Civic Issue Reporting Assistant. "
        "POST /analyze to preview a ticket. POST /confirm to submit it."
    }