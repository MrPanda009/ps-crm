"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { 
  ChevronLeft, 
  MapPin, 
  Clock, 
  Tag, 
  Share2, 
  ArrowUp,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";
import { supabase } from "@/src/lib/supabase";
import type { Database } from "@/src/types/database.types";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { getTwitterHandleForDepartment } from "@/src/lib/twitter-handles";

type Complaint = Database["public"]["Tables"]["complaints"]["Row"];

export default function TicketDetailClient({
  ticketIdParam,
  onClose,
  isModal = false
}: {
  ticketIdParam?: string;
  onClose?: () => void;
  isModal?: boolean;
} = {}) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = ticketIdParam || searchParams.get("id");
  
  const [ticket, setTicket] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ticketId) return;

    const fetchTicket = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("complaints")
        .select("*")
        .eq("id", ticketId)
        .single();

      if (error) {
        console.error("Error fetching ticket details:", error.message, error.details);
      } else {
        setTicket(data);
        setUpvoteCount(data.upvote_count ?? 0);
        
        // Check if user has upvoted
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: upvoteData } = await supabase
            .from("upvotes")
            .select("id")
            .eq("citizen_id", user.id)
            .eq("complaint_id", ticketId)
            .maybeSingle();
          
          setHasUpvoted(!!upvoteData);
        }
      }
      setLoading(false);
    };

    fetchTicket();

    // ─── Realtime Subscription for Live Upvote Updates ───────────────────────
    const channel = supabase
      .channel(`ticket-detail-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "complaints",
          filter: `id=eq.${ticketId}`,
        },
        (payload) => {
          const newData = payload.new as Complaint;
          if (newData && newData.upvote_count !== undefined) {
            setUpvoteCount(newData.upvote_count);
            setTicket(newData);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId]);

  // Entry animations optimally managed with useGSAP to prevent lag
  useGSAP(() => {
    if (isModal) {
      gsap.fromTo(".modal-overlay", 
        { opacity: 0 }, 
        { opacity: 1, duration: 0.4, ease: "power2.out", clearProps: "all" }
      );
      gsap.fromTo(".modal-box",
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }
      );
    } else {
      gsap.fromTo(".modal-box",
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: "power3.out", clearProps: "all" }
      );
    }

    if (!loading && ticket) {
      // Content fade in
      gsap.fromTo(".animate-fade-in", 
        { opacity: 0, y: 15 }, 
        { opacity: 1, y: 0, duration: 0.4, stagger: 0.05, ease: "power2.out", clearProps: "all" }
      );
      
      // Image scale in
      gsap.fromTo(".animate-image-in",
        { opacity: 0, scale: 1.05, transformOrigin: "center center" },
        { opacity: 1, scale: 1, duration: 0.6, ease: "power3.out", clearProps: "all" }
      );
    }
  }, { scope: containerRef, dependencies: [loading, ticket, isModal] });

  const handleUpvote = async () => {
    if (!ticket || !ticketId) return;
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const wasUpvoted = hasUpvoted;
    
    // Optimistic UI
    setHasUpvoted(!wasUpvoted);
    setUpvoteCount(prev => wasUpvoted ? Math.max(0, prev - 1) : prev + 1);

    try {
      if (wasUpvoted) {
        const { error: delError } = await supabase.from("upvotes").delete().eq("citizen_id", user.id).eq("complaint_id", ticketId);
        // If it's already deleted, we don't treat it as a fatal error
        if (delError && delError.code !== 'PGRST116') throw delError;
        
        const { error: rpcError } = await supabase.rpc('decrement_upvote_count', { p_complaint_id: ticketId });
        if (rpcError) throw rpcError;
      } else {
        const { error: insError } = await supabase.from("upvotes").insert({ citizen_id: user.id, complaint_id: ticketId });
        
        // Error code 23505 is 'unique_violation' (duplicate key).
        // If it already exists, we ignore and proceed to the RPC to ensure the count is synced.
        if (insError && insError.code !== '23505') throw insError;
        
        const { error: rpcError } = await supabase.rpc('increment_upvote_count', { p_complaint_id: ticketId });
        if (rpcError) throw rpcError;
      }
      
      // Verification: re-fetch from DB to ensure local state is synced after non-optimistic action
      // (The realtime subscription will also handle this, but explicit fetch is safer)
    } catch (err: any) {
      console.error("Upvote persistence failed:", err);
      // Rollback optimistic UI
      setHasUpvoted(wasUpvoted);
      setUpvoteCount(wasUpvoted ? upvoteCount + 1 : upvoteCount - 1);
      
      // Inform the user why it failed
      const msg = err?.message || "Check your internet or permissions.";
      alert(`Upvote failed: ${msg}`);
    }
  };

  const handleShareToX = async () => {
    if (!ticket) return;
    
    const handle = getTwitterHandleForDepartment(ticket.assigned_department);
    const shareUrl = window.location.href;
    const shareTitle = `🚨 Urgent Civic Issue: ${ticket.title}`;
    const shareText = `${shareTitle}\n📍 Locality: ${ticket.ward_name || 'Delhi'}\n🎫 Ref: ${ticket.ticket_id}\n\nPlease take action! ${handle} #JanSamadhan #CivicIssue`;
    
    // 1. Try Web Share API (Mobile Premium Flow)
    // This attaches the ACTUAL file to the tweet
    if (navigator.share && navigator.canShare && ticket.photo_urls?.[0]) {
      try {
        const imageUrl = ticket.photo_urls[0];
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        const file = new File([blob], "issue.jpg", { type: "image/jpeg" });

        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: shareTitle,
            text: shareText,
          });
          return; // Success
        }
      } catch (err) {
        console.warn("Web Share failed, falling back to Intent:", err);
      }
    }

    // 2. Fallback to Twitter Intent (Desktop / Legacy Flow)
    // This relies on the 'summary_large_image' metadata we fixed
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, "_blank");
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex h-full w-full items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#b48470] shadow-sm"></div>
        </div>
      );
    }

    if (!ticket) {
      return (
        <div className="flex flex-col items-center justify-center text-gray-800 dark:text-white bg-white dark:bg-[#161616] p-12 rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-[#2a2a2a] m-4">
          <h2 className="text-xl font-bold">Ticket not found</h2>
          {isModal ? (
            <button onClick={onClose} className="mt-4 text-[#b48470] hover:underline font-bold">Close details</button>
          ) : (
            <Link href="/citizen/tickets" className="mt-4 text-[#b48470] hover:underline font-bold">Go back to tickets</Link>
          )}
        </div>
      );
    }

    return (
      <div className="modal-box relative z-10 flex h-[85vh] min-h-[600px] max-h-[800px] w-[95%] max-w-[1024px] overflow-hidden rounded-[2.5rem] border border-gray-200 bg-white shadow-xl dark:border-[#2a2a2a] dark:bg-[#161616] will-change-[transform,opacity]">
        <div className="flex h-full w-full flex-col lg:flex-row">
          {/* Image Section */}
          <div className="relative h-64 lg:h-full lg:w-[45%] shrink-0 bg-gray-100 dark:bg-[#111] overflow-hidden">
            {ticket.photo_urls?.[0] ? (
              <img 
                src={ticket.photo_urls[0]} 
                alt="Ticket issue" 
                className="animate-image-in h-full w-full object-cover border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-[#2a2a2a]"
              />
            ) : (
              <div className="animate-image-in flex h-full w-full items-center justify-center border-b lg:border-b-0 lg:border-r border-gray-200 dark:border-[#2a2a2a]">
                <Tag size={48} className="text-gray-400 dark:text-gray-600" />
              </div>
            )}
            
            {/* DIGIPIN Badge */}
            <div className="absolute bottom-6 left-6 animate-fade-in z-10">
              <div className="flex items-center gap-2 rounded-xl bg-[#b48470] px-4 py-2.5 text-xs font-bold text-white shadow-lg">
                <MapPin size={14} className="fill-white" />
                <span>DIGIPIN: {ticket.digipin || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="relative flex flex-1 flex-col p-6 lg:p-10">
            {/* Close Button X */}
            <button 
              onClick={() => onClose ? onClose() : router.back()}
              className="absolute top-6 right-6 flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-900 dark:bg-[#2a2a2a] dark:text-gray-400 dark:hover:bg-[#333] dark:hover:text-white z-20"
              aria-label="Close"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>

            <div className="animate-fade-in pr-12">
              <h1 className="text-2xl font-black leading-tight text-gray-900 dark:text-white lg:text-[28px] text-balance">
                {ticket.title}
              </h1>
              <p className="mt-3 text-sm font-medium tracking-wide text-gray-500 dark:text-[#888]">
                Ref: {ticket.ticket_id}
              </p>
            </div>

            {/* Quick Metadata */}
            <div className="mt-8 grid grid-cols-2 gap-4 animate-fade-in">
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#b48470] dark:text-gray-500">
                  <ShieldCheck size={14} className="text-[#b48470] dark:text-gray-500" />
                  DEPARTMENT
                </div>
                <div className="text-base font-bold text-gray-900 dark:text-white">
                  {ticket.assigned_department || "UNASSIGNED"}
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#b48470] dark:text-gray-500">
                  <Clock size={14} className="text-[#b48470] dark:text-gray-500" />
                  REPORTED
                </div>
                <div className="text-base font-bold text-gray-900 dark:text-white">
                  {new Date(ticket.created_at).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Full Address */}
            <div className="mt-8 space-y-1.5 animate-fade-in">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#b48470] dark:text-gray-500">
                <MapPin size={14} className="text-[#b48470] dark:text-gray-500" />
                FULL ADDRESS
              </div>
              <p className="text-sm font-bold leading-relaxed text-gray-700 dark:text-gray-200">
                {ticket.address_text?.split('|')[0] || "Address unavailable"}
              </p>
            </div>

            {/* Description (Flex-1 shrinks but scrolls if needed gracefully, avoiding full page overflow) */}
            <div className="mt-8 space-y-1.5 animate-fade-in flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-[#b48470] dark:text-gray-500">
                <Tag size={14} className="text-[#b48470] dark:text-gray-500" />
                ISSUE DESCRIPTION
              </div>
              <p className="text-sm font-medium leading-relaxed text-gray-600 dark:text-[#a1a1aa] whitespace-pre-wrap">
                {ticket.description || "No description provided."}
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="mt-6 pt-6 animate-fade-in flex flex-wrap gap-3 items-center w-full shrink-0 border-t border-gray-100 dark:border-[#2a2a2a]">
              <button className="flex-1 min-w-[160px] h-[52px] rounded-xl bg-[#b48470] hover:bg-[#a37562] text-[15px] font-bold text-white shadow-md shadow-[#b48470]/20 transition-all hover:scale-[1.02] active:scale-[0.98]">
                Track Lifecycle
              </button>
              
              <button 
                onClick={handleUpvote}
                className={`flex h-[52px] min-w-[80px] justify-center items-center gap-2 rounded-xl border px-4 transition-all font-bold text-base ${
                  hasUpvoted 
                    ? 'border-[#b48470] bg-[#b48470] text-white shadow-md shadow-[#b48470]/40 hover:bg-[#a37562]' 
                    : 'border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 dark:border-[#333] dark:bg-[#2a2a2a] dark:text-gray-300 dark:hover:bg-[#444]'
                }`}
              >
                <ArrowUp size={20} className={hasUpvoted ? "stroke-[3px]" : "stroke-[2.5px]"} />
                <span>{upvoteCount}</span>
              </button>

              <button 
                onClick={handleShareToX}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-700 shadow-sm hover:border-gray-300 hover:bg-gray-50 hover:text-black dark:border-[#333] dark:bg-[#2a2a2a] dark:text-gray-300 dark:hover:bg-[#444] dark:hover:text-white transition-all shrink-0"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isModal) {
    return (
      <div ref={containerRef} className="modal-overlay fixed inset-0 z-[3000] flex items-center justify-center bg-black/80 p-4 sm:p-6 lg:p-8 will-change-[opacity]">
        {renderContent()}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex h-[calc(100vh-73px)] w-full flex-col items-center justify-center p-4 sm:p-6 lg:p-8">
      {renderContent()}
    </div>
  );
}
