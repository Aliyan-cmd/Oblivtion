"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Calendar, Clock, MapPin, ChevronDown, MessageSquare, CheckCircle2 } from "lucide-react";
import type { EventCard } from "@/lib/serialize";

interface EventCardViewProps {
  item: EventCard;
}

export const EventCardView: React.FC<EventCardViewProps> = ({ item }) => {
  const [quotesOpen, setQuotesOpen] = useState(false);
  const isDeadline = item.kind === "deadline";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-4 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:shadow-xl hover:shadow-neutral-500/5"
    >
      <div className="flex items-start gap-3.5">
        {/* Category Icon Badge */}
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${
            isDeadline
              ? "bg-neutral-500/15 text-neutral-300 border border-neutral-500/30"
              : "bg-neutral-200/15 text-neutral-400 border border-neutral-200/30"
          }`}
        >
          {isDeadline ? <Flame className="h-5 w-5" /> : <Calendar className="h-5 w-5" />}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-white tracking-tight text-base group-hover:text-neutral-200 transition-colors">
              {item.title}
            </h3>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider ${
                isDeadline
                  ? "bg-neutral-500/20 text-neutral-300 border border-neutral-500/30"
                  : "bg-neutral-200/20 text-neutral-400 border border-neutral-200/30"
              }`}
            >
              {isDeadline ? "Deadline" : "Event"}
            </span>
          </div>

          {/* Time & Meta Info */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-neutral-400">
            <div className="inline-flex items-center gap-1.5 font-medium text-neutral-300">
              <Clock className="h-3.5 w-3.5 text-neutral-400" />
              <span>{item.whenTime || "All Day"}</span>
            </div>

            {item.location && (
              <div className="inline-flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-neutral-300">
                <MapPin className="h-3 w-3 text-neutral-300" />
                <span>{item.location}</span>
              </div>
            )}

            <button
              type="button"
              onClick={() => setQuotesOpen((v) => !v)}
              className="inline-flex items-center gap-1.5 text-neutral-400 hover:text-white transition-colors focus:outline-none"
            >
              <MessageSquare className="h-3.5 w-3.5 text-neutral-400" />
              <span>
                {item.source_msg_ids.length} quote{item.source_msg_ids.length === 1 ? "" : "s"}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform duration-200 ${
                  quotesOpen ? "rotate-180 text-neutral-400" : ""
                }`}
              />
            </button>
          </div>

          {/* Expandable Source Quotes */}
          <AnimatePresence>
            {quotesOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden border-l-2 border-neutral-500/40 pl-3.5 space-y-2 bg-black/20 py-2 rounded-r-xl"
              >
                {item.quotes.map((q) => (
                  <div key={q.id} className="text-xs leading-relaxed text-neutral-300">
                    <span className="font-mono text-[11px] text-neutral-500">#{q.id}</span>{" "}
                    <span className="font-semibold text-neutral-300">{q.sender}:</span>{" "}
                    <span className="text-neutral-300 whitespace-pre-wrap">{q.text}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};
