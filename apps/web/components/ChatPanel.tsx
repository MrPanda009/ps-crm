"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { Send, Loader2, Plus, ChevronDown, ChevronUp, Mic, MicOff } from "lucide-react";
import gsap from "gsap";
import { sendToGemini } from "@/lib/gemini";
import type { ChatMessage, ExtractedComplaint, GeminiResponse } from "@/lib/gemini";
import { supabase } from "@/src/lib/supabase";
import dynamic from "next/dynamic";

const LocationPinPicker = dynamic(() => import("@/components/LocationPinPicker"), {
  ssr: false,
  loading: () => (
    <div className="h-40 w-full rounded-lg border border-gray-200 dark:border-[#2a2a2a] bg-gray-100 dark:bg-[#1e1e1e] flex items-center justify-center text-xs text-gray-400">
      Loading map…
    </div>
  ),
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.jansamadhan.perkkk.dev";

function toUserFacingError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
  if (/failed to fetch|networkerror|network request failed/i.test(message)) {
    return `Could not reach complaint API at ${API_URL}. If you are running locally, start FastAPI on port 8000 or set NEXT_PUBLIC_API_URL.`;
  }
  return message;
}

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface DisplayMessage {
  id: string;
  role: "user" | "bot";
  text: string;
  /** Optional image data-url shown in the bubble */
  imageUrl?: string;
  /** If the bot message carries a complaint extraction */
  extracted?: ExtractedComplaint | null;
  /** Image-based ticket preview from FastAPI /analyze */
  imagePreview?: ImageTicketPreview | null;
  /** Reverse-geocoded details for text-based complaints */
  geoDetails?: GeoDetails | null;
}

interface GeoDetails {
  pincode: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  formatted_address: string;
  digipin: string;
}

/** Shape of the /analyze response from FastAPI */
interface ImageTicketPreview {
  child_id: number;
  issue_name: string;
  parent_id: number;
  authority: string;
  title: string;
  description: string;
  severity: string;
  severity_db: string;
  status: string;
  ward_name: string;
  pincode: string;
  digipin: string;
  locality: string;
  city: string;
  district: string;
  state: string;
  formatted_address: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  confidence: number;
  user_text: string;
  confirm_prompt: string;
}

interface DuplicateMatch {
  id: string;
  ticket_id: string;
  title: string;
  status: string;
  created_at: string;
  distance_m: number;
}

interface DuplicateContext {
  mode: "image" | "text";
  duplicate: DuplicateMatch;
}

interface DeviceLocation {
  lat: number;
  lng: number;
  accuracy: number;
  timestamp: string;
}

const ISSUE_TYPE_CATEGORY_MAP: Array<{ keywords: string[]; categoryId: number }> = [
  { keywords: ["metro", "station", "escalator", "lift"], categoryId: 1 },
  { keywords: ["highway", "expressway", "toll", "bridge", "road", "pothole", "flyover"], categoryId: 11 },
  { keywords: ["garbage", "waste", "trash", "sweeping", "toilet"], categoryId: 16 },
  { keywords: ["drain", "sewage", "sewer", "water", "leak", "pipeline"], categoryId: 27 },
  { keywords: ["street light", "light", "electricity", "power", "wire", "transformer"], categoryId: 25 },
  { keywords: ["traffic", "signal", "parking", "accident"], categoryId: 36 },
  { keywords: ["crime", "safety", "theft", "harassment"], categoryId: 35 },
  { keywords: ["air", "noise", "pollution", "burning"], categoryId: 40 },
];

function categoryFromIssueType(issueType: string): number {
  const normalized = issueType.toLowerCase();
  const match = ISSUE_TYPE_CATEGORY_MAP.find(({ keywords }) =>
    keywords.some((keyword) => normalized.includes(keyword)),
  );
  return match?.categoryId ?? 15;
}

function severityToLevel(severity: string): "L1" | "L2" | "L3" | "L4" {
  const normalized = severity.trim().toLowerCase();
  if (normalized === "critical" || normalized === "l4") return "L4";
  if (normalized === "high" || normalized === "l3") return "L3";
  if (normalized === "medium" || normalized === "l2") return "L2";
  return "L1";
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function ChatPanel({ onClose: _onClose }: { onClose?: () => void }) {
  /* ----- state ----- */
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [pendingComplaint, setPendingComplaint] = useState<ExtractedComplaint | null>(null);
  const [pendingImagePreview, setPendingImagePreview] = useState<ImageTicketPreview | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImageDataUrl, setPendingImageDataUrl] = useState<string | null>(null);
  const [pendingLocation, setPendingLocation] = useState<DeviceLocation | null>(null);
  const [duplicateContext, setDuplicateContext] = useState<DuplicateContext | null>(null);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [isMapExpanded, setIsMapExpanded] = useState(false);
  const [expandedImagePreview, setExpandedImagePreview] = useState<Record<string, boolean>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  /* ----- refs ----- */
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micBtnRef = useRef<HTMLButtonElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const micPulseRef = useRef<gsap.core.Tween | null>(null);

  /* ----- conversation history for Gemini (role: user | model) ----- */
  const historyRef = useRef<ChatMessage[]>([]);

  /* ----- helpers ----- */
  const uid = () => Math.random().toString(36).slice(2, 10);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    });
  }, []);

  const toggleImagePreviewDetails = useCallback((messageId: string) => {
    setExpandedImagePreview((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  }, []);

  /** Get browser geolocation and keep strict location metadata with fallback. */
  const getLocation = (): Promise<DeviceLocation> =>
    new Promise((resolve) => {
      const now = new Date().toISOString();
      if (!navigator.geolocation) {
        resolve({ lat: 28.6139, lng: 77.209, accuracy: 10000, timestamp: now });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : 9999,
            timestamp: new Date(pos.timestamp).toISOString(),
          }),
        () => resolve({ lat: 28.6139, lng: 77.209, accuracy: 10000, timestamp: now }),
        { timeout: 8000 },
      );
    });

  /** Get Supabase auth token — works for both email/password and Google OAuth */
  const getAuthToken = async (): Promise<string | null> => {
    // Try getSession first (works immediately for email/password)
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.access_token) return session.access_token;

    // Force a session refresh — required for Google OAuth PKCE flow
    // where the session may not be hydrated yet after redirect
    const { data: refreshData } = await supabase.auth.refreshSession();
    if (refreshData.session?.access_token) return refreshData.session.access_token;

    // Confirm user actually exists before giving up
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Session exists but is still hydrating (common after Google OAuth redirect)
    // Wait briefly and retry once
    await new Promise((res) => setTimeout(res, 500));
    const { data: { session: retrySession } } = await supabase.auth.getSession();
    return retrySession?.access_token ?? null;
  };

  /* ----- initialize with greeting ----- */
  useEffect(() => {
    if (!initialized && messages.length === 0) {
      addBotMessage(
        "Namaste! 🙏 I'm **JanSamadhan AI**.\nTell me about a civic issue you'd like to report — or tap the **+** button to upload a photo of the problem!",
      );
      setInitialized(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- message helpers ----- */
  const addBotMessage = useCallback(
    (text: string, extra?: { extracted?: ExtractedComplaint | null; imagePreview?: ImageTicketPreview | null; geoDetails?: GeoDetails | null }) => {
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: "bot", text, extracted: extra?.extracted, imagePreview: extra?.imagePreview, geoDetails: extra?.geoDetails },
      ]);
      setTimeout(scrollToBottom, 80);
    },
    [scrollToBottom],
  );

  /* ----- IMAGE UPLOAD: + button handler ----- */
  const handleImageSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || isLoading) return;
      // Reset file input so same file can be re-selected
      e.target.value = "";

      // Create a data URL preview
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        setPendingImageDataUrl(dataUrl);

        // Show user message with image thumbnail
        setMessages((prev) => [
          ...prev,
          { id: uid(), role: "user", text: "📷 Uploaded a photo for analysis", imageUrl: dataUrl },
        ]);
        scrollToBottom();

        setIsLoading(true);
        try {
          const token = await getAuthToken();
          if (!token) {
            addBotMessage("⚠️ You must be logged in to upload photos. Please log in and try again.");
            setIsLoading(false);
            return;
          }

          const { lat, lng, accuracy, timestamp } = await getLocation();

          // Build FormData for FastAPI /analyze
          const formData = new FormData();
          formData.append("image", file);
          formData.append("user_text", input.trim() || "Please analyze this civic issue");
          formData.append("latitude", lat.toString());
          formData.append("longitude", lng.toString());
          formData.append("accuracy", accuracy.toString());
          formData.append("timestamp", timestamp);

          const res = await fetch(`${API_URL}/analyze`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          });

          if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Analysis failed" }));
            throw new Error(err.detail || "Failed to analyze image");
          }

          const preview: ImageTicketPreview = await res.json();

          if (preview.confidence < 0.6) {
            setPendingImagePreview(null);
            setPendingImageFile(null);
            setPendingLocation(null);
            setLocationConfirmed(false);
            setDuplicateContext(null);
            addBotMessage(
              "⚠️ I am not confident enough about this image analysis (confidence below 0.6). Please describe the issue manually so I can file it accurately.",
            );
            return;
          }

          // Store for confirmation
          setPendingImagePreview(preview);
          setPendingImageFile(file);
          setPendingComplaint(null); // clear any text-based pending
          setDuplicateContext(null);
          setPendingLocation({
            lat: preview.latitude,
            lng: preview.longitude,
            accuracy: preview.accuracy,
            timestamp: preview.timestamp,
          });
          setLocationConfirmed(false);

          addBotMessage(preview.confirm_prompt, { imagePreview: preview });
        } catch (err) {
          const msg = toUserFacingError(err);
          addBotMessage(`⚠️ ${msg}`);
        } finally {
          setIsLoading(false);
          setInput("");
        }
      };
      reader.readAsDataURL(file);
    },
    [isLoading, input, scrollToBottom, addBotMessage], // eslint-disable-line react-hooks/exhaustive-deps
  );

  /* ----- send a user message ----- */
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setInput("");

    if (duplicateContext && /^(upvote|support|same)$/i.test(trimmed)) {
      setMessages((prev) => [...prev, { id: uid(), role: "user", text: trimmed }]);
      scrollToBottom();
      await upvoteDuplicate();
      return;
    }

    if (duplicateContext && /^(yes again|upload anyway|force|submit anyway)$/i.test(trimmed)) {
      setMessages((prev) => [...prev, { id: uid(), role: "user", text: trimmed }]);
      scrollToBottom();
      if (duplicateContext.mode === "image") {
        await confirmImageTicket(true);
      } else {
        await submitComplaint(true);
      }
      return;
    }

    // If the user typed YES and we have a pending image preview → confirm via FastAPI
    if (pendingImagePreview && /^(yes|confirm|submit|haan|ha|हां)$/i.test(trimmed)) {
      if (!locationConfirmed || !pendingLocation) {
        addBotMessage("📍 Please confirm your location first. You can move the pin and then tap **Confirm location**.");
        return;
      }
      setMessages((prev) => [...prev, { id: uid(), role: "user", text: trimmed }]);
      scrollToBottom();
      await confirmImageTicket(false);
      return;
    }

    // If the user typed YES and we have a pending text-based complaint
    if (pendingComplaint && /^(yes|confirm|submit|haan|ha|हां)$/i.test(trimmed)) {
      if (!locationConfirmed || !pendingLocation) {
        addBotMessage("📍 Please confirm your location first. You can move the pin and then tap **Confirm location**.");
        return;
      }
      setMessages((prev) => [...prev, { id: uid(), role: "user", text: trimmed }]);
      scrollToBottom();
      await submitComplaint(false);
      return;
    }

    // Regular message
    setMessages((prev) => [...prev, { id: uid(), role: "user", text: trimmed }]);
    scrollToBottom();
    historyRef.current.push({ role: "user", text: trimmed });

    setIsLoading(true);
    try {
      const res: GeminiResponse = await sendToGemini(historyRef.current);
      historyRef.current.push({ role: "model", text: res.reply });

      if (res.extracted) {
        if (res.extracted.confidence < 0.6) {
          setPendingComplaint(null);
          setPendingImagePreview(null);
          setPendingImageDataUrl(null);
          setPendingLocation(null);
          setLocationConfirmed(false);
          setDuplicateContext(null);
          addBotMessage(
            "⚠️ I am not confident enough in the issue extraction (confidence below 0.6). Please describe the issue manually with key details (what, where, urgency).",
          );
          return;
        }

        setPendingComplaint(res.extracted);
        setPendingImagePreview(null);
        setPendingImageDataUrl(null);
        setDuplicateContext(null);
        const currentLocation = await getLocation();
        setPendingLocation(currentLocation);
        setLocationConfirmed(false);

        let geoDetails: GeoDetails | null = null;
        try {
          const geoRes = await fetch(`${API_URL}/geocode?lat=${currentLocation.lat}&lng=${currentLocation.lng}`);
          if (geoRes.ok) geoDetails = await geoRes.json();
        } catch { /* non-fatal */ }

        addBotMessage(res.reply, { extracted: res.extracted, geoDetails });
      } else {
        addBotMessage(res.reply);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      addBotMessage(`⚠️ ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, pendingComplaint, pendingImagePreview, duplicateContext, scrollToBottom, addBotMessage]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ----- confirm image ticket via FastAPI /confirm ----- */
  const confirmImageTicket = useCallback(async (forceSubmit = false) => {
    if (!pendingImagePreview || !pendingImageFile) return;
    setSubmitting(true);

    try {
      const token = await getAuthToken();
      if (!token) {
        addBotMessage("⚠️ You must be logged in to submit a complaint. Please log in and try again.");
        setSubmitting(false);
        return;
      }

      const formData = new FormData();
      const submitLocation = pendingLocation ?? {
        lat: pendingImagePreview.latitude,
        lng: pendingImagePreview.longitude,
        accuracy: pendingImagePreview.accuracy,
        timestamp: pendingImagePreview.timestamp,
      };
      formData.append("image", pendingImageFile);
      formData.append("user_text", "Confirmed by user");
      formData.append("latitude", submitLocation.lat.toString());
      formData.append("longitude", submitLocation.lng.toString());
      formData.append("accuracy", submitLocation.accuracy.toString());
      formData.append("timestamp", submitLocation.timestamp);
      formData.append("child_id", pendingImagePreview.child_id.toString());
      formData.append("title", pendingImagePreview.title);
      formData.append("description", pendingImagePreview.description);
      formData.append("severity_db", pendingImagePreview.severity_db);
      formData.append("force_submit", String(forceSubmit));

      const res = await fetch(`${API_URL}/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Submission failed" }));
        const detail = err?.detail;
        if (res.status === 409 && detail?.code === "DUPLICATE_DETECTED" && detail?.duplicate) {
          setDuplicateContext({ mode: "image", duplicate: detail.duplicate as DuplicateMatch });
          addBotMessage(
            `⚠️ Similar complaint already exists (Ticket **${detail.duplicate.ticket_id}**, ${detail.duplicate.distance_m}m away, status: **${detail.duplicate.status}**). Type **UPVOTE** to support it, or type **YES AGAIN** to upload anyway.`,
          );
          return;
        }
        throw new Error(detail?.message || detail || "Failed to submit complaint");
      }

      const created = await res.json();

      setSubmitted(true);
      setPendingImagePreview(null);
      setPendingImageFile(null);
      setPendingImageDataUrl(null);
      setPendingLocation(null);
      setDuplicateContext(null);
      setLocationConfirmed(false);
      addBotMessage(
        `✅ **Complaint submitted successfully!**\n\n🎫 Ticket ID: **${created.ticket_id}**\n📋 Issue: **${created.issue_name}**\n🏢 Department: **${created.authority}**\nStatus: **Submitted**\n\nYou can track your complaint from the "Your Tickets" section. Is there anything else I can help you with?`,
      );
    } catch (err) {
      const msg = toUserFacingError(err);
      addBotMessage(`❌ ${msg}. Please try again or contact support.`);
    } finally {
      setSubmitting(false);
    }
  }, [pendingImagePreview, pendingImageFile, pendingLocation, addBotMessage]);

  /* ----- submit text-based complaint to Supabase ----- */
  const submitComplaint = useCallback(async (forceSubmit = false) => {
    if (!pendingComplaint) return;
    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        addBotMessage("⚠️ You must be logged in to submit a complaint. Please log in and try again.");
        setSubmitting(false);
        return;
      }

      const submitLocation = pendingLocation ?? (await getLocation());
      const categoryId = categoryFromIssueType(pendingComplaint.issue_type);
      const severityLevel = severityToLevel(pendingComplaint.severity);

      const res = await fetch("/api/complaints", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          citizen_id: user.id,
          category_id: categoryId,
          issue_type: pendingComplaint.issue_type,
          title: pendingComplaint.title,
          description: pendingComplaint.description,
          severity: severityLevel,
          latitude: submitLocation.lat,
          longitude: submitLocation.lng,
          accuracy: submitLocation.accuracy,
          timestamp: submitLocation.timestamp,
          city: "Delhi",
          force_submit: forceSubmit,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409 && data?.code === "DUPLICATE_DETECTED" && data?.duplicate) {
          setDuplicateContext({ mode: "text", duplicate: data.duplicate as DuplicateMatch });
          addBotMessage(
            `⚠️ Similar complaint already exists (Ticket **${data.duplicate.ticket_id}**, ${data.duplicate.distance_m}m away, status: **${data.duplicate.status}**). Type **UPVOTE** to support it, or type **YES AGAIN** to upload anyway.`,
          );
          setSubmitting(false);
          return;
        }
        throw new Error(data.error || "Failed to submit complaint");
      }

      setSubmitted(true);
      setPendingComplaint(null);
      setPendingLocation(null);
      setDuplicateContext(null);
      setLocationConfirmed(false);
      addBotMessage(
        `✅ **Complaint submitted successfully!**\n\n🎫 Ticket ID: **${data.complaint?.ticket_id ?? data.complaint?.id}**\nStatus: **Submitted**\n\nYou can track your complaint from the "Your Tickets" section. Is there anything else I can help you with?`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Submission failed";
      addBotMessage(`❌ ${msg}. Please try again or contact support.`);
    } finally {
      setSubmitting(false);
    }
  }, [pendingComplaint, pendingLocation, addBotMessage]);

  const upvoteDuplicate = useCallback(async () => {
    if (!duplicateContext?.duplicate?.id) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/complaints", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint_id: duplicateContext.duplicate.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upvote complaint");

      setDuplicateContext(null);
      setPendingComplaint(null);
      setPendingImagePreview(null);
      setPendingImageFile(null);
      setPendingImageDataUrl(null);
      setPendingLocation(null);
      setLocationConfirmed(false);
      addBotMessage(
        `✅ Upvoted ticket **${data.complaint?.ticket_id ?? duplicateContext.duplicate.ticket_id}**. Current status: **${data.complaint?.status ?? duplicateContext.duplicate.status}**. Thank you for supporting status transparency.`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Upvote failed";
      addBotMessage(`❌ ${msg}.`);
    } finally {
      setSubmitting(false);
    }
  }, [duplicateContext, addBotMessage]);

  /* ----- auto-scroll on new messages ----- */
  useEffect(() => scrollToBottom(), [messages, scrollToBottom]);

  /* ----- cleanup MediaRecorder on unmount ----- */
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (recordingTimerRef.current) clearTimeout(recordingTimerRef.current);
      if (micPulseRef.current) micPulseRef.current.kill();
      mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  /* ----- voice recording helpers ----- */
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType || "audio/webm" });
        audioChunksRef.current = [];

        // Stop GSAP pulse
        if (micPulseRef.current) { micPulseRef.current.kill(); micPulseRef.current = null; }
        if (micBtnRef.current) gsap.to(micBtnRef.current, { scale: 1, boxShadow: "none", duration: 0.25, ease: "power2.out" });

        if (blob.size < 500) {
          addBotMessage("⚠️ Recording was too short. Please hold the mic button and speak clearly.");
          setIsRecording(false);
          return;
        }

        setIsRecording(false);
        setIsTranscribing(true);

        // Animate mic button to "transcribing" state
        if (micBtnRef.current) gsap.to(micBtnRef.current, { scale: 0.9, opacity: 0.6, duration: 0.2, ease: "power2.out" });

        try {
          const formData = new FormData();
          formData.append("file", blob, "recording.webm");

          const res = await fetch("/api/stt", { method: "POST", body: formData });
          if (!res.ok) {
            const err = await res.json().catch(() => ({ error: "STT failed" }));
            throw new Error(err.error || "Speech-to-text failed");
          }

          const { transcript } = await res.json();
          if (!transcript || !transcript.trim()) {
            addBotMessage("⚠️ Could not recognize any speech. Please try again.");
            return;
          }

          // Auto-fill and send
          setInput(transcript.trim());
          // We need a small delay so React processes the setInput before handleSend reads it
          setTimeout(() => {
            // Manually push the message through since handleSend reads from state
            const text = transcript.trim();
            setMessages((prev) => [...prev, { id: Math.random().toString(36).slice(2, 10), role: "user", text: `🎤 ${text}` }]);
            scrollToBottom();
            historyRef.current.push({ role: "user", text });
            setInput("");
            setIsLoading(true);

            sendToGemini(historyRef.current)
              .then((geminiRes) => {
                historyRef.current.push({ role: "model", text: geminiRes.reply });
                if (geminiRes.extracted) {
                  if (geminiRes.extracted.confidence < 0.6) {
                    setPendingComplaint(null);
                    setPendingImagePreview(null);
                    setPendingImageDataUrl(null);
                    setPendingLocation(null);
                    setLocationConfirmed(false);
                    setDuplicateContext(null);
                    addBotMessage("⚠️ I am not confident enough in the issue extraction (confidence below 0.6). Please describe the issue manually with key details (what, where, urgency).");
                    return;
                  }
                  setPendingComplaint(geminiRes.extracted);
                  setPendingImagePreview(null);
                  setPendingImageDataUrl(null);
                  setDuplicateContext(null);
                  getLocation().then((currentLocation) => {
                    setPendingLocation(currentLocation);
                    setLocationConfirmed(false);
                    fetch(`${API_URL}/geocode?lat=${currentLocation.lat}&lng=${currentLocation.lng}`)
                      .then((r) => r.ok ? r.json() : null)
                      .catch(() => null)
                      .then((geoDetails) => addBotMessage(geminiRes.reply, { extracted: geminiRes.extracted, geoDetails }));
                  });
                } else {
                  addBotMessage(geminiRes.reply);
                }
              })
              .catch((err) => {
                const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
                addBotMessage(`⚠️ ${msg}`);
              })
              .finally(() => setIsLoading(false));
          }, 50);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Speech recognition failed";
          addBotMessage(`⚠️ ${msg}`);
        } finally {
          setIsTranscribing(false);
          if (micBtnRef.current) gsap.to(micBtnRef.current, { scale: 1, opacity: 1, duration: 0.25, ease: "power2.out" });
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);

      // GSAP pulse animation on the mic button
      if (micBtnRef.current) {
        gsap.fromTo(micBtnRef.current, { scale: 1 }, { scale: 1.1, duration: 0.15, ease: "power2.out" });
        micPulseRef.current = gsap.to(micBtnRef.current, {
          boxShadow: "0 0 0 8px rgba(239,68,68,0.25)",
          duration: 0.8,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
          delay: 0.15,
        });
      }

      // 30-second safety timeout
      recordingTimerRef.current = setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
          mediaRecorderRef.current.stop();
        }
      }, 30000);
    } catch (err) {
      console.error("Microphone access error:", err);
      addBotMessage("⚠️ Microphone access denied. Please allow microphone permission in your browser and try again.");
    }
  }, [addBotMessage, scrollToBottom]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) {
      clearTimeout(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  /* ----- keyboard enter ----- */
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  /* ------------------------------------------------------------------ */
  /*  Render                                                             */
  /* ------------------------------------------------------------------ */

  const hasPending = !!(pendingComplaint || pendingImagePreview);

  return (
    <div
      ref={panelRef}
      className="flex flex-col h-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-[#2a2a2a] dark:bg-[#161616]"
    >
      {/* -- Messages -- */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col justify-end space-y-3 min-h-full">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === "user"
                  ? "rounded-br-sm bg-[#b4725a] text-white dark:bg-[#C9A84C] dark:text-black"
                  : "rounded-bl-sm bg-gray-100 text-gray-800 dark:bg-[#252525] dark:text-gray-100"
              }`}
            >
              {/* User-uploaded image thumbnail */}
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Uploaded issue"
                  className="mb-2 rounded-lg max-h-40 w-full object-cover"
                />
              )}

              {!msg.imagePreview && renderMarkdown(msg.text)}

              {/* Text-based extracted complaint summary table */}
              {msg.extracted && (
                <div className="mt-3 rounded-lg border border-gray-300 bg-white p-3 text-xs dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
                  <p className="mb-2 font-semibold text-gray-700 dark:text-gray-200">📋 Confirm Your Complaint</p>
                  <table className="w-full text-left">
                    <tbody>
                      {(
                        [
                          ["Title", msg.extracted.title],
                          ["Issue Type", msg.extracted.issue_type],
                          ["Severity", msg.extracted.severity],
                          ["Location", msg.geoDetails?.formatted_address || "Detecting\u2026"],
                          ["Description", msg.extracted.description],
                          ["DIGIPIN", msg.geoDetails?.digipin || "Detecting\u2026"],
                        ] as [string, string][]
                      ).map(([label, value]) => (
                        <tr key={label} className="border-b border-gray-100 last:border-0 dark:border-[#2a2a2a]">
                          <td className="py-1 pr-2 font-medium text-gray-500 dark:text-gray-400">{label}</td>
                          <td className="py-1 text-gray-800 dark:text-gray-200">{value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-center font-semibold text-amber-600 dark:text-amber-400">
                    Type <strong>YES</strong> to confirm submission
                  </p>
                </div>
              )}

              {/* Image-based ticket preview from FastAPI /analyze */}
              {msg.imagePreview && (
                <div className="mt-3 w-full max-w-[34rem] rounded-lg border border-gray-300 bg-white p-3 text-xs dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
                  <p className="mb-2 font-semibold text-gray-700 dark:text-gray-200">Confirm Your Complaint</p>
                  <div className={`grid gap-3 ${pendingImageDataUrl ? "grid-cols-[96px_minmax(0,1fr)]" : "grid-cols-1"}`}>
                    {pendingImageDataUrl && (
                      <div className="h-24 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-[#2a2a2a] dark:bg-[#252525]">
                        <img
                          src={pendingImageDataUrl}
                          alt="Issue photo"
                          className="h-full w-full object-contain"
                        />
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-left">
                        {[
                          ["Title", msg.imagePreview.title],
                          ["Issue Type", msg.imagePreview.issue_name],
                          ["Severity", `${msg.imagePreview.severity} (${msg.imagePreview.severity_db})`],
                          ["Location", msg.imagePreview.formatted_address],
                          ["Description", msg.imagePreview.description],
                          ["DIGIPIN", msg.imagePreview.digipin],
                        ].map(([label, value]) => {
                          const shouldTrimLongText =
                            !expandedImagePreview[msg.id] &&
                            (label === "Location" || label === "Description") &&
                            value.length > 110;
                          const displayValue = shouldTrimLongText ? `${value.slice(0, 110)}...` : value;

                          return (
                            <React.Fragment key={label}>
                              <p className="py-0.5 font-medium text-gray-500 dark:text-gray-400">{label}</p>
                              <p className="py-0.5 break-words text-gray-800 dark:text-gray-200">{displayValue}</p>
                            </React.Fragment>
                          );
                        })}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggleImagePreviewDetails(msg.id)}
                        className="mt-2 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors dark:text-gray-400 dark:hover:bg-[#2a2a2a] dark:hover:text-gray-100"
                      >
                        {expandedImagePreview[msg.id] ? (
                          <>
                            <ChevronUp size={13} /> Show less
                          </>
                        ) : (
                          <>
                            <ChevronDown size={13} /> Show full details
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <p className="mt-2 text-center font-semibold text-amber-600 dark:text-amber-400">
                    Type <strong>YES</strong> to confirm submission
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 dark:bg-[#252525]">
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
              <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
            </div>
          </div>
        )}

        {/* Submitting state */}
        {submitting && (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-gray-100 px-4 py-2 text-sm text-gray-600 dark:bg-[#252525] dark:text-gray-300">
              <Loader2 size={16} className="animate-spin" /> Submitting your complaint…
            </div>
          </div>
        )}
        </div>
      </div>

      {/* -- Input bar -- */}
      <div className="border-t border-gray-200 bg-white px-3 py-2 dark:border-[#2a2a2a] dark:bg-[#161616]">
        {hasPending && pendingLocation && (
          <div className="mb-2 rounded-lg border border-gray-200 bg-gray-50 p-2 dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
            <div className="mb-2">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-200">Detected location</p>
            </div>
            <div
              className="overflow-hidden transition-all duration-300 ease-in-out"
              style={{
                maxHeight: isMapExpanded ? '400px' : '0px',
                opacity: isMapExpanded ? 1 : 0,
              }}
            >
              {isMapExpanded && (
                <LocationPinPicker
                  key={pendingLocation.timestamp}
                  lat={pendingLocation.lat}
                  lng={pendingLocation.lng}
                  onPinMove={(lat, lng) => {
                    setPendingLocation((prev) => ({
                      lat,
                      lng,
                      accuracy: prev?.accuracy ?? 9999,
                      timestamp: new Date().toISOString(),
                    }));
                    setLocationConfirmed(false);
                  }}
                />
              )}
            </div>
            <div className="mt-2 flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setLocationConfirmed(true)}
                  className="rounded-md bg-[#4f392e] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#b4725a] transition-all duration-200 hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#b4725a] focus:ring-offset-2 dark:bg-[#C9A84C] dark:text-black dark:hover:bg-[#d4b45c] dark:focus:ring-[#C9A84C] dark:focus:ring-offset-[#161616]"
                >
                  Confirm location
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const loc = await getLocation();
                    setPendingLocation(loc);
                    setLocationConfirmed(false);
                  }}
                  className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2 dark:border-[#2a2a2a] dark:text-gray-200 dark:hover:bg-[#2a2a2a] dark:focus:ring-[#2a2a2a] dark:focus:ring-offset-[#161616]"
                >
                  Move pin to GPS
                </button>
                <span className={`text-[11px] transition-colors duration-200 ${locationConfirmed ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {locationConfirmed ? "Location confirmed" : "Move pin if needed, then confirm"}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsMapExpanded(!isMapExpanded)}
                className="flex shrink-0 items-center gap-1 px-2 py-1 rounded text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-[#2a2a2a]"
              >
                {isMapExpanded ? (
                  <>
                    <ChevronDown size={14} />
                    Hide Map
                  </>
                ) : (
                  <>
                    <ChevronUp size={14} />
                    Show Map
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        {/* Transcribing indicator */}
        {isTranscribing && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-1.5 text-xs text-purple-700 dark:border-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            <Loader2 size={14} className="animate-spin" />
            Transcribing your voice…
          </div>
        )}
        <div className="flex items-center gap-2">
          {/* + button for image upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isLoading || submitting || isRecording || isTranscribing}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-500 transition-all duration-200 hover:bg-[#b4725a] hover:text-white hover:border-[#b4725a] hover:shadow-md disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#b4725a] focus:ring-offset-2 dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-400 dark:hover:bg-[#C9A84C] dark:hover:text-black dark:hover:border-[#C9A84C] dark:focus:ring-[#C9A84C] dark:focus:ring-offset-[#161616]"
            aria-label="Upload photo"
            title="Upload a photo of the issue"
          >
            <Plus size={18} />
          </button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* 🎤 Mic button for voice input */}
          <button
            ref={micBtnRef}
            onClick={handleMicClick}
            disabled={isLoading || submitting || isTranscribing}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-40 ${
              isRecording
                ? "border-red-400 bg-red-500 text-white hover:bg-red-600 dark:border-red-500 dark:bg-red-600 dark:hover:bg-red-700 focus:ring-red-400 dark:focus:ring-red-500 dark:focus:ring-offset-[#161616]"
                : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-[#b4725a] hover:text-white hover:border-[#b4725a] hover:shadow-md dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-400 dark:hover:bg-[#C9A84C] dark:hover:text-black dark:hover:border-[#C9A84C] focus:ring-[#b4725a] dark:focus:ring-[#C9A84C] dark:focus:ring-offset-[#161616]"
            }`}
            aria-label={isRecording ? "Stop recording" : "Start voice input"}
            title={isRecording ? "Tap to stop recording" : "Tap to speak your complaint"}
          >
            {isRecording ? <MicOff size={18} /> : <Mic size={18} />}
          </button>

          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={duplicateContext ? "Type UPVOTE or YES AGAIN..." : hasPending ? "Confirm location, then type YES to submit..." : "Describe your issue..."}
            disabled={submitting}
            className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-800 outline-none transition-all duration-200 placeholder:text-gray-400 focus:border-[#b4725a] focus:ring-2 focus:ring-[#b4725a]/20 focus:bg-white dark:border-[#2a2a2a] dark:bg-[#1e1e1e] dark:text-gray-100 dark:placeholder:text-gray-500 dark:focus:border-[#C9A84C] dark:focus:ring-[#C9A84C]/20 dark:focus:bg-[#252525]"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || submitting || !input.trim()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4f392e] text-white transition-all duration-200 hover:bg-[#b4725a] hover:shadow-md disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-[#b4725a] focus:ring-offset-2 dark:bg-[#C9A84C] dark:text-black dark:hover:bg-[#d4b45c] dark:focus:ring-[#C9A84C] dark:focus:ring-offset-[#161616]"
            aria-label="Send message"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Very lightweight Markdown renderer (bold only)                     */
/* ------------------------------------------------------------------ */

function renderMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}
