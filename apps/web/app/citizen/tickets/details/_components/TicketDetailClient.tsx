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
import { getTwitterHandleForDepartment } from "@/src/lib/twitter-handles";

type Complaint = Database["public"]["Tables"]["complaints"]["Row"];

export default function TicketDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const ticketId = searchParams.get("id");
  
  const [ticket, setTicket] = useState<Complaint | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [upvoteCount, setUpvoteCount] = useState(0);

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
  }, [ticketId]);

  // Entry animations
  useEffect(() => {
    if (!loading && ticket) {
      gsap.fromTo(".animate-fade-in", 
        { opacity: 0, y: 20 }, 
        { opacity: 1, y: 0, duration: 0.6, stagger: 0.1, ease: "power2.out" }
      );
    }
  }, [loading, ticket]);

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
        await supabase.from("upvotes").delete().eq("citizen_id", user.id).eq("complaint_id", ticketId);
        await supabase.from("complaints").update({ upvote_count: Math.max(0, upvoteCount - 1) }).eq("id", ticketId);
      } else {
        await supabase.from("upvotes").insert({ citizen_id: user.id, complaint_id: ticketId });
        await supabase.rpc('increment_upvote_count', { p_complaint_id: ticketId });
      }
    } catch (err) {
      console.error("Upvote failed:", err);
      // Rollback
      setHasUpvoted(wasUpvoted);
      setUpvoteCount(upvoteCount);
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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#161616]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-[#161616] text-white">
        <h2 className="text-xl font-bold">Ticket not found</h2>
        <Link href="/citizen/tickets" className="mt-4 text-orange-500 hover:underline">
          Go back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#161616] text-gray-200">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-[#2a2a2a] bg-[#1e1e1e] px-6 py-4">
        <button 
          onClick={() => router.back()}
          className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={20} />
          <span className="text-sm font-medium uppercase tracking-wider">Back to list</span>
        </button>
        <div className="flex items-center gap-3">
          <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-tight shadow-sm ring-1 ring-inset ${
            ticket.status === 'resolved' ? 'bg-green-900/40 text-green-400 ring-green-900' : 
            ticket.status === 'pending_closure' ? 'bg-orange-900/40 text-orange-400 ring-orange-900' :
            'bg-amber-900/40 text-amber-400 ring-amber-900'
          }`}>
            {ticket.status?.replace('_', ' ') || 'Submitted'}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-6xl p-6">
        <div className="grid grid-cols-1 overflow-hidden rounded-3xl border border-[#2a2a2a] bg-[#1e1e1e] shadow-2xl lg:grid-cols-12">
          
          {/* Image Section */}
          <div className="relative h-[400px] lg:col-span-12 xl:col-span-5 lg:h-auto">
            {ticket.photo_urls?.[0] ? (
              <img 
                src={ticket.photo_urls[0]} 
                alt="Ticket issue" 
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[#2a2a2a]">
                <Tag size={48} className="text-gray-600" />
              </div>
            )}
            
            {/* DIGIPIN Badge */}
            <div className="absolute bottom-6 left-6 animate-fade-in">
              <div className="flex items-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-orange-900/40">
                <MapPin size={14} className="fill-white" />
                <span>DIGIPIN: {ticket.digipin || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Content Section */}
          <div className="flex flex-col p-8 lg:col-span-12 xl:col-span-7">
            <div className="animate-fade-in">
              <h1 className="text-2xl font-black leading-tight text-white lg:text-3xl">
                {ticket.title}
              </h1>
              <p className="mt-2 text-sm font-medium tracking-wide text-gray-500">
                Ref: {ticket.ticket_id}
              </p>
            </div>

            {/* Quick Metadata */}
            <div className="mt-8 grid grid-cols-2 gap-8 border-y border-[#2a2a2a] py-8 animate-fade-in">
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <ShieldCheck size={14} className="text-orange-500" />
                  DEPARTMENT
                </div>
                <div className="text-lg font-bold text-gray-200">
                  {ticket.assigned_department || "UNASSIGNED"}
                </div>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                  <Clock size={14} className="text-orange-500" />
                  REPORTED
                </div>
                <div className="text-lg font-bold text-gray-200">
                  {new Date(ticket.created_at).toLocaleDateString('en-US', { 
                    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>

            {/* Full Address */}
            <div className="mt-8 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <MapPin size={14} className="text-orange-500" />
                FULL ADDRESS
              </div>
              <p className="text-base leading-relaxed text-gray-400">
                {ticket.address_text?.split('|')[0] || "Address unavailable"}
              </p>
            </div>

            {/* Description */}
            <div className="mt-8 space-y-3 animate-fade-in">
              <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-500">
                <Tag size={14} className="text-orange-500" />
                ISSUE DESCRIPTION
              </div>
              <p className="text-base leading-relaxed text-gray-400">
                {ticket.description || "No description provided."}
              </p>
            </div>

            {/* Bottom Actions */}
            <div className="mt-auto pt-10 animate-fade-in flex flex-wrap gap-4 items-center">
              <button className="flex-1 rounded-2xl bg-orange-600 py-4 text-base font-black text-white shadow-lg shadow-orange-900/30 transition-all hover:bg-orange-700 hover:scale-[1.02] active:scale-[0.98]">
                Track Lifecycle
              </button>
              
              <button 
                onClick={handleUpvote}
                className={`flex h-[56px] items-center gap-2 rounded-2xl border px-6 transition-all ${
                  hasUpvoted 
                    ? 'border-orange-500 bg-orange-500/10 text-orange-500' 
                    : 'border-[#333] bg-[#2a2a2a] text-gray-400 hover:border-[#444]'
                }`}
              >
                <ArrowUp size={20} className={hasUpvoted ? "fill-current" : ""} />
                <span className="font-bold">{upvoteCount}</span>
              </button>

              <button 
                onClick={handleShareToX}
                className="flex h-[56px] w-[56px] items-center justify-center rounded-2xl bg-[#2a2a2a] text-gray-400 hover:bg-[#333] hover:text-white transition-all"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
