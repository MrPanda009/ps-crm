"use client"

import { useEffect, useId, useMemo, useState } from "react"
import L from "leaflet"
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet"
import {
  markerColor,
  severityClass,
  type DashboardTask,
} from "@/components/worker-dashboard/dashboard-types"

type WorkerTaskMapPanelProps = {
  tasks: DashboardTask[]
  highlightedTaskId?: string | null
  loading: boolean
  error: string | null
  onSelectTask?: (taskId: string) => void
}

function createMarkerIcon(color: string): L.DivIcon {
  return new L.DivIcon({
    className: "",
    html: `<div style="width:18px;height:18px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 0 6px rgba(0,0,0,0.25);"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function FitMapToMarkers({ points }: { points: Array<{ lat: number; lng: number }> }) {
  const map = useMap()

  useEffect(() => {
    if (points.length === 0) return
    const bounds = L.latLngBounds(points.map((point) => [point.lat, point.lng]))
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 })
  }, [map, points])

  return null
}

export default function WorkerTaskMapPanel({
  tasks,
  highlightedTaskId,
  loading,
  error,
  onSelectTask,
}: WorkerTaskMapPanelProps) {
  const [isClientReady, setIsClientReady] = useState(false)
  // Ensure each component mount gets a fresh Leaflet container identity.
  const mapSessionKey = useId()

  useEffect(() => {
    setIsClientReady(true)
  }, [])

  const mappableTasks = useMemo(
    () => tasks.filter((task) => task.latitude != null && task.longitude != null),
    [tasks],
  )

  const markerIcons = useMemo(() => {
    return new Map(mappableTasks.map((task) => [task.id, createMarkerIcon(markerColor(task.severity))]))
  }, [mappableTasks])

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">Task Map</h2>
        <span className="text-xs text-gray-500 dark:text-gray-400">Live ticket locations</span>
      </div>

      {error ? (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      ) : null}

      {loading ? <p className="mb-3 text-sm text-gray-500 dark:text-gray-400">Loading map...</p> : null}

      <div className="relative h-[360px] overflow-hidden rounded-lg border border-gray-100 dark:border-[#2a2a2a] sm:h-[420px]">
        {isClientReady ? (
          <MapContainer key={mapSessionKey} center={[28.6139, 77.209]} zoom={11} scrollWheelZoom className="h-full w-full">
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              attribution="&copy; OpenStreetMap contributors"
            />

            {mappableTasks.map((task) => (
              <Marker
                key={task.id}
                position={[task.latitude as number, task.longitude as number]}
                icon={markerIcons.get(task.id) ?? createMarkerIcon(markerColor(task.severity))}
              >
                <Popup>
                  <div className="space-y-2 text-sm">
                    <p className="font-semibold">{task.ticketId}</p>
                    <p>{task.description.length > 80 ? `${task.description.slice(0, 77)}...` : task.description}</p>
                    <span className={`inline-block rounded-full border px-2 py-1 text-xs ${severityClass(task.severity)}`}>
                      {task.severity}
                    </span>
                    {onSelectTask ? (
                      <div>
                        <button
                          type="button"
                          className="inline-block rounded border px-2 py-1 text-xs hover:bg-gray-100"
                          onClick={() => onSelectTask(task.id)}
                        >
                          Use this ticket
                        </button>
                      </div>
                    ) : null}
                  </div>
                </Popup>
              </Marker>
            ))}

            <FitMapToMarkers
              points={mappableTasks.map((task) => ({ lat: task.latitude as number, lng: task.longitude as number }))}
            />
          </MapContainer>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            Initializing map...
          </div>
        )}

        {highlightedTaskId ? (
          <div className="pointer-events-none absolute left-3 top-3 z-[500] rounded-md bg-black/70 px-2 py-1 text-xs text-white">
            Focused: {tasks.find((task) => task.id === highlightedTaskId)?.ticketId ?? "Selected"}
          </div>
        ) : null}

        {!loading && mappableTasks.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 z-[500] flex items-center justify-center bg-white/80 text-sm font-medium text-gray-600 dark:bg-[#1e1e1e]/85 dark:text-gray-300">
            No tasks to display on map.
          </div>
        ) : null}
      </div>
    </section>
  )
}
