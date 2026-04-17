'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { CameraCard, CameraData } from '@/components/admin-surveillance/CameraCard';
import type {
  DashcamBox,
  DashcamOverlayState,
  DashcamPrecomputedArtifact,
} from '@/components/admin-surveillance/dashcam-review-types';

const APPROVED_VIDEOS = ['smooth_vid1.mp4', 'smooth_vid2.mp4', 'video_1.mp4', 'video_2.mp4'];
const EXCLUDED_VIDEO = 'video_3.mp4';

const normalizeName = (name: string): string => name.trim().toLowerCase();

const centroid = (box: DashcamBox): { x: number; y: number } => ({
  x: (box.x1 + box.x2) / 2,
  y: (box.y1 + box.y2) / 2,
});

type PairKeyedBox = {
  key: string;
  box: DashcamBox;
};

const toKeyedBoxes = (boxes: DashcamBox[]): PairKeyedBox[] =>
  boxes.map((box, idx) => ({
    key: box.track_id ? String(box.track_id) : `idx_${idx}`,
    box,
  }));

const pairBoxes = (prev: DashcamBox[], next: DashcamBox[]): Array<[DashcamBox, DashcamBox]> => {
  const prevKeyed = toKeyedBoxes(prev);
  const nextKeyed = toKeyedBoxes(next);
  const nextByKey = new Map(nextKeyed.map((item) => [item.key, item.box]));

  const pairs: Array<[DashcamBox, DashcamBox]> = [];
  for (const item of prevKeyed) {
    const target = nextByKey.get(item.key);
    if (target) {
      pairs.push([item.box, target]);
      nextByKey.delete(item.key);
    }
  }

  if (pairs.length > 0) return pairs;

  const fallbackLength = Math.min(prev.length, next.length);
  for (let i = 0; i < fallbackLength; i += 1) {
    pairs.push([prev[i], next[i]]);
  }

  return pairs;
};

interface QualityMetrics {
  totalFrames: number;
  nonEmptyFrames: number;
  totalBoxes: number;
  maxCentroidJumpPx: number;
  avgCentroidJumpPx: number;
}

interface RuntimeStreamState {
  videoFileName: string;
  videoSizeBytes: number;
  artifact: DashcamPrecomputedArtifact | null;
  mappingStatus: 'resolved' | 'missing' | 'error';
  mappingMessage: string;
  locked: boolean;
  overlayState: DashcamOverlayState | null;
  metrics: QualityMetrics | null;
}

const buildQualityMetrics = (artifact: DashcamPrecomputedArtifact): QualityMetrics => {
  const frames = artifact.frames ?? [];
  const nonEmptyFrames = frames.filter((f) => f.boxes.length > 0).length;
  const totalBoxes = frames.reduce((sum, frame) => sum + frame.boxes.length, 0);

  const centroidDeltas: number[] = [];
  for (let i = 1; i < frames.length; i += 1) {
    const pairs = pairBoxes(frames[i - 1].boxes, frames[i].boxes);
    for (const [prevBox, nextBox] of pairs) {
      const a = centroid(prevBox);
      const b = centroid(nextBox);
      centroidDeltas.push(Math.hypot(a.x - b.x, a.y - b.y));
    }
  }

  return {
    totalFrames: frames.length,
    nonEmptyFrames,
    totalBoxes,
    maxCentroidJumpPx: centroidDeltas.length > 0 ? Math.max(...centroidDeltas) : 0,
    avgCentroidJumpPx: centroidDeltas.length > 0
      ? centroidDeltas.reduce((sum, value) => sum + value, 0) / centroidDeltas.length
      : 0,
  };
};

export default function DashcamLivePage() {
  const [dashcamStreams, setDashcamStreams] = useState<CameraData[]>([]);
  const [runtimeByStreamId, setRuntimeByStreamId] = useState<Record<string, RuntimeStreamState>>({});
  const [artifactCache, setArtifactCache] = useState<Record<string, DashcamPrecomputedArtifact>>({});
  const [selectedVideo, setSelectedVideo] = useState<File | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('Choose an approved clip and add it to the stream.');
  const [isResolving, setIsResolving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const handleUpdateStream = (id: string, updates: Partial<CameraData>) => {
    setDashcamStreams((prev) =>
      prev.map((stream) => (stream.camera_id === id ? { ...stream, ...updates } : stream)),
    );
  };

  const handleDeleteStream = (id: string) => {
    setDashcamStreams((prev) => {
      const target = prev.find((stream) => stream.camera_id === id);
      if (target?.video_url?.startsWith('blob:')) {
        URL.revokeObjectURL(target.video_url);
      }
      return prev.filter((stream) => stream.camera_id !== id);
    });

    setRuntimeByStreamId((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const handleVideoPick = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;

    const normalized = normalizeName(file.name);
    if (normalized === normalizeName(EXCLUDED_VIDEO)) {
      setStatusMessage('This clip is excluded from the approved demo set.');
      setSelectedVideo(null);
      return;
    }

    if (!APPROVED_VIDEOS.map(normalizeName).includes(normalized)) {
      setStatusMessage('Please choose one of the approved demo clips.');
      setSelectedVideo(null);
      return;
    }

    const exists = Object.values(runtimeByStreamId).some(
      (runtime) => normalizeName(runtime.videoFileName) === normalized,
    );

    if (exists) {
      setStatusMessage('This clip is already loaded on the page.');
      setSelectedVideo(null);
      return;
    }

    setSelectedVideo(file);
    setStatusMessage(`Selected: ${file.name}. Click Add Stream.`);
  };

  const resolveArtifact = async (videoFile: File): Promise<{ artifact: DashcamPrecomputedArtifact | null; locked: boolean; message: string }> => {
    const cacheKey = `${normalizeName(videoFile.name)}:${videoFile.size}`;
    const cached = artifactCache[cacheKey];
    if (cached) {
      return { artifact: cached, locked: true, message: 'Ready to play.' };
    }

    const response = await fetch(`${apiUrl}/dashcam/precomputed/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        filename: videoFile.name,
        size_bytes: videoFile.size,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { artifact: null, locked: false, message: 'This clip is not mapped for playback yet.' };
    }

    const artifact = payload?.artifact as DashcamPrecomputedArtifact | undefined;
    if (!artifact || !Array.isArray(artifact.frames)) {
      return { artifact: null, locked: false, message: 'Clip data could not be prepared for playback.' };
    }

    setArtifactCache((prev) => ({
      ...prev,
      [cacheKey]: artifact,
    }));

    return {
      artifact,
      locked: Boolean(payload?.resolved?.locked),
      message: 'Ready to play.',
    };
  };

  const handleAddStream = async () => {
    if (!selectedVideo) {
      setStatusMessage('Select an approved clip first.');
      return;
    }

    setIsResolving(true);
    const resolved = await resolveArtifact(selectedVideo);

    const streamId = `dashcam_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const videoUrl = URL.createObjectURL(selectedVideo);

    const newStream: CameraData = {
      camera_id: streamId,
      camera_name: `DASHCAM_${selectedVideo.name.replace(/\.[^.]+$/, '')}`,
      road_type: 'City Road',
      latitude: 0,
      longitude: 0,
      digipin: '',
      video_url: videoUrl,
      status: 'Idle',
    };

    setDashcamStreams((prev) => [...prev, newStream]);

    setRuntimeByStreamId((prev) => ({
      ...prev,
      [streamId]: {
        videoFileName: selectedVideo.name,
        videoSizeBytes: selectedVideo.size,
        artifact: resolved.artifact,
        mappingStatus: resolved.artifact ? 'resolved' : 'missing',
        mappingMessage: resolved.message,
        locked: resolved.locked,
        overlayState: null,
        metrics: resolved.artifact ? buildQualityMetrics(resolved.artifact) : null,
      },
    }));

    if (resolved.artifact) {
      setStatusMessage(`${selectedVideo.name} added and ready.`);
    } else {
      setStatusMessage(`${selectedVideo.name} added. Playback overlay unavailable for this clip.`);
    }
    setSelectedVideo(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsResolving(false);
  };

  const setOverlayState = (streamId: string, state: DashcamOverlayState | null) => {
    setRuntimeByStreamId((prev) => {
      const runtime = prev[streamId];
      if (!runtime) return prev;

      return {
        ...prev,
        [streamId]: {
          ...runtime,
          overlayState: state,
        },
      };
    });
  };

  const resolvedCount = useMemo(
    () => Object.values(runtimeByStreamId).filter((runtime) => runtime.mappingStatus === 'resolved').length,
    [runtimeByStreamId],
  );

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50 p-4 dark:bg-[#161616] md:p-6">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="flex-1 space-y-2">
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Approved Dashcam Video</div>
              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoPick}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#0f766e]/35 bg-[#0f766e]/10 px-4 py-2 text-xs font-bold uppercase tracking-wide text-[#0f766e] transition hover:bg-[#0f766e]/15"
                >
                  <Upload size={14} />
                  Choose Clip
                </button>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {selectedVideo ? selectedVideo.name : 'No clip selected'}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={isResolving}
              onClick={handleAddStream}
              className="inline-flex items-center justify-center rounded-xl bg-[#0f766e] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white shadow-sm transition hover:bg-[#0d5f59] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isResolving ? 'Resolving...' : 'Add Stream'}
            </button>
          </div>

          <div className="mt-3 text-sm font-medium text-gray-700 dark:text-gray-200">
            {statusMessage}
          </div>

        </div>

        <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-4 sm:grid-cols-2">
          {dashcamStreams.map((stream) => {
            const streamId = stream.camera_id ?? '';
            const runtime = runtimeByStreamId[streamId];
            if (!runtime) return null;

            return (
              <div key={streamId} className="space-y-3">
                <CameraCard
                  data={stream}
                  localOnly
                  reviewMode
                  videoOnlyMode
                  reviewArtifact={runtime.artifact}
                  onOverlayStateChange={(state) => setOverlayState(streamId, state)}
                  onUpdate={handleUpdateStream}
                  onDelete={handleDeleteStream}
                />

                {runtime.mappingStatus !== 'resolved' && (
                  <div className="rounded-xl border border-orange-200 bg-orange-50 p-3 text-[12px] font-medium text-orange-800 dark:border-orange-800 dark:bg-orange-950/30 dark:text-orange-300">
                    {runtime.mappingMessage}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
