"use client";

import React from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import dynamic from "next/dynamic";
const MarkerClusterGroup = dynamic(
  () => import("react-leaflet-markercluster").then((mod) => mod.default ?? mod),
  { ssr: false }
) as React.ComponentType<{ children: React.ReactNode }>;

import { useEffect, useState } from "react";
import { supabase } from "@/src/lib/supabase";
import type { Tables } from "@/src/types/database.types";

type ComplaintRow = Tables<"complaints">;

type MapComplaint = {
  id: string;
  title: string;
  description: string;
  severity: string;
  lat: number;
  lng: number;
};

function parseEwkbHexPoint(hex: string): { lat: number; lng: number } | null {
  const normalized = hex.trim();
  if (!/^[0-9a-fA-F]+$/.test(normalized) || normalized.length < 42) {
    return null;
  }

  try {
    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
      bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
    }

    const view = new DataView(bytes.buffer);
    const littleEndian = view.getUint8(0) === 1;
    const typeWithFlags = view.getUint32(1, littleEndian);
    const hasSrid = (typeWithFlags & 0x20000000) !== 0;
    const geomType = typeWithFlags & 0x000000ff;

    if (geomType !== 1) {
      return null;
    }

    const coordOffset = hasSrid ? 9 : 5;
    if (bytes.byteLength < coordOffset + 16) {
      return null;
    }

    const lng = view.getFloat64(coordOffset, littleEndian);
    const lat = view.getFloat64(coordOffset + 8, littleEndian);

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }

    return { lat, lng };
  } catch {
    return null;
  }
}

function parseLocationToLatLng(location: unknown): { lat: number; lng: number } | null {
  if (!location) return null;

  if (typeof location === "object") {
    const maybeObj = location as Record<string, unknown>;

    const coordinates = maybeObj.coordinates;
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      const lng = Number(coordinates[0]);
      const lat = Number(coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    const latVal = maybeObj.lat ?? maybeObj.latitude;
    const lngVal = maybeObj.lng ?? maybeObj.lon ?? maybeObj.longitude;
    if (latVal !== undefined && lngVal !== undefined) {
      const lat = Number(latVal);
      const lng = Number(lngVal);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    const xVal = maybeObj.x;
    const yVal = maybeObj.y;
    if (xVal !== undefined && yVal !== undefined) {
      const lng = Number(xVal);
      const lat = Number(yVal);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }
  }

  if (typeof location === "string") {
    const ewkb = parseEwkbHexPoint(location);
    if (ewkb) {
      return ewkb;
    }

    const pointMatch = location.match(/POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (pointMatch) {
      const lng = Number(pointMatch[1]);
      const lat = Number(pointMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    const sridPointMatch = location.match(/SRID=\d+;\s*POINT\s*\(\s*([-\d.]+)\s+([-\d.]+)\s*\)/i);
    if (sridPointMatch) {
      const lng = Number(sridPointMatch[1]);
      const lat = Number(sridPointMatch[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng };
      }
    }

    const tupleMatch = location.match(/^\s*\(?\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)?\s*$/);
    if (tupleMatch) {
      const first = Number(tupleMatch[1]);
      const second = Number(tupleMatch[2]);
      if (Number.isFinite(first) && Number.isFinite(second)) {
        const looksLikeLatLng = Math.abs(first) <= 90 && Math.abs(second) <= 180;
        const lat = looksLikeLatLng ? first : second;
        const lng = looksLikeLatLng ? second : first;
        return { lat, lng };
      }
    }

    try {
      const parsed = JSON.parse(location);
      return parseLocationToLatLng(parsed);
    } catch {
      return null;
    }
  }

  return null;
}

export default function MapComponent({
  selectedComplaintId,
}: {
  selectedComplaintId?: string | null;
}) {
  const [complaints, setComplaints] = useState<MapComplaint[]>([]);
  const [mounted, setMounted] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rawCount, setRawCount] = useState(0);

  // Fetch complaints from Supabase
  async function fetchComplaints() {
    try {
      const { data, error } = await supabase
        .from("complaints")
        .select("*");

      if (error) {
        setFetchError(error.message || "Unable to fetch complaints.");
        setComplaints([]);
        return;
      }

      if (!data) {
        setFetchError(null);
        setComplaints([]);
        setRawCount(0);
        return;
      }

      setRawCount(data.length);

      const formatted: MapComplaint[] = data
        .map((c: ComplaintRow) => {
          const parsed = parseLocationToLatLng(c.location);
          if (!parsed) return null;

          return {
            id: c.id,
            title: c.title,
            description: c.description,
            severity: c.effective_severity || c.severity,
            lat: parsed.lat,
            lng: parsed.lng,
          };
        })
        .filter(Boolean) as MapComplaint[];

      setFetchError(null);
      setComplaints(formatted);
    } catch {
      setFetchError("Unable to fetch complaints.");
      setComplaints([]);
      setRawCount(0);
    }
  }

  useEffect(() => {
    setMounted(true);
    import("react-leaflet-markercluster/styles");

    import("leaflet").then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl;

      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      setLeaflet(L);
    });

    fetchComplaints();

    // Auto refresh every 5 sec
    const interval = setInterval(fetchComplaints, 5000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return null;

  const getSeverityIcon = (severity: string, L: any) => {
    const colors: Record<string, string> = {
      low: "green",
      medium: "gold",
      high: "orange",
      critical: "red",
    };

    return new L.DivIcon({
      html: `
        <div style="
          background-color: ${colors[severity] || "blue"};
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 6px rgba(0,0,0,0.4);
        "></div>
      `,
      className: "",
    });
  };

  return (
    <div style={{ position: "relative", height: "500px", width: "100%" }}>
      {/* Toggle Button */}
      <button
        onClick={() => setShowHeatmap(!showHeatmap)}
        style={{
          position: "absolute",
          zIndex: 1000,
          right: 20,
          top: 20,
          padding: "8px 12px",
          background: "#111",
          color: "white",
          borderRadius: "6px",
          cursor: "pointer",
        }}
      >
        {showHeatmap ? "Show Markers" : "Show Heatmap"}
      </button>

      <MapContainer
        center={[28.6139, 77.209]}
        zoom={12}
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution="© OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
<ZoomToComplaint
  complaints={complaints}
  selectedComplaintId={selectedComplaintId}
/>
        {!showHeatmap && (
          <MarkerClusterGroup>
            {complaints.map((c) => (
              <Marker
                key={c.id}
                position={[c.lat, c.lng]}
                icon={
                  leaflet
                    ? getSeverityIcon(c.severity, leaflet)
                    : undefined
                }
              >
                <Popup>
                  <strong>{c.title}</strong>
                  <br />
                  {c.description}
                  <br />
                  <b>Severity:</b> {c.severity}
                </Popup>
              </Marker>
            ))}
          </MarkerClusterGroup>
        )}

        {showHeatmap && <HeatmapLayer complaints={complaints} />}
      </MapContainer>

      {fetchError && (
        <div
          style={{
            position: "absolute",
            zIndex: 2100,
            left: 20,
            top: 20,
            background: "#111",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            maxWidth: 380,
            fontSize: "13px",
          }}
        >
          Failed to load complaints: {fetchError}
        </div>
      )}

      {!fetchError && rawCount > 0 && complaints.length === 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 2100,
            left: 20,
            top: 20,
            background: "#111",
            color: "#fff",
            padding: "8px 12px",
            borderRadius: "6px",
            maxWidth: 420,
            fontSize: "13px",
          }}
        >
          Loaded {rawCount} complaints, but none had valid map coordinates.
        </div>
      )}

      {/* Legend */}
      <div
        style={{
          position: "absolute",
          bottom: "20px",
          right: "20px",
          background: "white",
          padding: "12px 16px",
          borderRadius: "8px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          fontSize: "14px",
          lineHeight: "1.6",
          zIndex: 2000,
        }}
      >
        <strong>Severity</strong>
        <LegendDot color="green" label="Low" />
        <LegendDot color="gold" label="Medium" />
        <LegendDot color="orange" label="High" />
        <LegendDot color="red" label="Critical" />
      </div>
    </div>
  );
}

function HeatmapLayer({ complaints }: { complaints: any[] }) {
  const map = useMap();

  useEffect(() => {
    const L = require("leaflet");
    if (typeof window !== "undefined" && !(window as any).L) {
      (window as any).L = L;
    }
    require("leaflet.heat");

    const heatLayer = (L as any).heatLayer(
      complaints.map((c: any) => [
        c.lat,
        c.lng,
        getIntensity(c.severity),
      ]),
      {
        radius: 25,
        blur: 20,
        minOpacity: 0.35,
        gradient: {
          0.2: "#22c55e",
          0.45: "#eab308",
          0.7: "#f97316",
          1.0: "#ef4444",
        },
      }
    );

    heatLayer.addTo(map);

    return () => {
      map.removeLayer(heatLayer);
    };
  }, [complaints, map]);

  return null;
}

function getIntensity(severity: string) {
  switch (severity) {
    case "critical":
      return 1.0;
    case "high":
      return 0.75;
    case "medium":
      return 0.5;
    case "low":
      return 0.25;
    default:
      return 0.3;
  }
}
function ZoomToComplaint({
  complaints,
  selectedComplaintId,
}: {
  complaints: MapComplaint[];
  selectedComplaintId?: string | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!selectedComplaintId) return;

    const complaint = complaints.find(
      (c) => c.id === selectedComplaintId
    );

    if (complaint) {
      map.setView([complaint.lat, complaint.lng], 15, {
        animate: true,
      });
    }
  }, [selectedComplaintId, complaints, map]);

  return null;
}
function LegendDot({ color, label }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span
        style={{
          background: color,
          width: 12,
          height: 12,
          borderRadius: "50%",
        }}
      />
      {label}
    </div>
  );
}