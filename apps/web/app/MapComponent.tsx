"use client";

import dynamic from "next/dynamic";

const MapComponent = dynamic(() => import("@/components/MapComponent"), {
  ssr: false,
});

export default function MapPage({
  selectedComplaintId,
  recenterTrigger,
}: {
  selectedComplaintId?: string | null;
  recenterTrigger?: number;
}) {
  return (
    <MapComponent
      selectedComplaintId={selectedComplaintId}
      recenterTrigger={recenterTrigger}
      highQuality
    />
  );
}

