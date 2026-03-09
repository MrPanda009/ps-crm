"use client";

import { useState } from "react";
import ChatContainer from "@/components/dashboard/ChatContainer";
import RecentTickets from "@/components/dashboard/RecentTickets";

export default function CitizenDashboardPage() {
  const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

  return (
    <div className="w-full h-full">
      {/* Add padding here for content, not in layout */}
      <div className="px-4 sm:px-6 py-6">
        {/* Mobile chat button */}
        <div className="sm:hidden mb-6">
          <button
            type="button"
            onClick={() => setIsMobileChatOpen(true)}
            className="w-full rounded-xl border border-[#b4725a]/30 bg-white px-4 py-4 text-left shadow-sm transition-colors hover:border-[#b4725a] dark:border-[#C9A84C]/30 dark:bg-[#1e1e1e]"
          >
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Open AI Assistant
            </p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
              Start or continue your complaint conversation.
            </p>
          </button>
        </div>

        {/* Desktop chat container */}
        <div className="hidden sm:block">
          <ChatContainer className="w-full max-h-[calc(100vh-24rem)] h-[28rem] lg:max-h-[calc(100vh-22rem)] lg:h-[30rem]" />
        </div>

        {/* Recent Tickets Section */}
        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
              Recent Tickets
            </h2>
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Latest activity
            </span>
          </div>

          <RecentTickets />
        </section>
      </div>

      {isMobileChatOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-gray-950/40 backdrop-blur-[1px]"
            onClick={() => setIsMobileChatOpen(false)}
          />
          <div className="absolute inset-0 flex flex-col bg-gray-50 p-3 dark:bg-[#161616]">
            <div className="mb-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2 dark:border-[#2a2a2a] dark:bg-[#1e1e1e]">
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  JanSamadhan AI Assistant
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Mobile full-screen chat</p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileChatOpen(false)}
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-[#2a2a2a] dark:text-gray-200 dark:hover:bg-[#2a2a2a]"
              >
                Close
              </button>
            </div>
            <div className="min-h-0 flex-1">
              <ChatContainer />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}