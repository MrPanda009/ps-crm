"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
});

export default function MapPage({
  selectedComplaintId,
}: {
  selectedComplaintId?: string | null;
}) {
  return <MapComponent selectedComplaintId={selectedComplaintId} />;
}

