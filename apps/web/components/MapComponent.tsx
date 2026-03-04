"use client";

import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "react-leaflet-markercluster/styles";
import "leaflet.heat";

import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase";
import type { Tables } from "../src/types/database.types";

type ComplaintRow = Tables<"complaints">;

type MapComplaint = {
  id: string;
  title: string;
  description: string;
  severity: string;
  lat: number;
  lng: number;
};

export default function MapComponent() {
  const [complaints, setComplaints] = useState<MapComplaint[]>([]);
  const [mounted, setMounted] = useState(false);
  const [leaflet, setLeaflet] = useState<any>(null);
  const [showHeatmap, setShowHeatmap] = useState(false);

  // Fetch complaints from Supabase
  async function fetchComplaints() {
    const { data, error } = await supabase
      .from("complaints")
      .select("*");

    if (error) {
      console.error("Supabase error:", error);
      return;
    }

    if (!data) {
      setComplaints([]);
      return;
    }

    // Convert PostGIS location -> lat/lng
    const formatted: MapComplaint[] = data
      .map((c: ComplaintRow) => {
        const location = c.location as any;

        if (!location || !location.coordinates) return null;

        const [lng, lat] = location.coordinates;

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          severity: c.effective_severity || c.severity,
          lat,
          lng,
        };
      })
      .filter(Boolean) as MapComplaint[];

    setComplaints(formatted);
  }

  useEffect(() => {
    setMounted(true);

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
    require("leaflet.heat");

    const heatLayer = (L as any).heatLayer(
      complaints.map((c: any) => [
        c.lat,
        c.lng,
        getIntensity(c.severity),
      ]),
      { radius: 25, blur: 20 }
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