"use client";

import React from "react";
import { motion, Variants } from "framer-motion";
import { Zap, Shield, FileText, Bot } from "lucide-react";
import { Card } from "@/components/ui/Card";

const features = [
  {
    icon: <Bot className="h-6 w-6" />,
    title: "AI-Powered Context",
    description: "Our LPU engine resolves ambiguous phrases like 'kal' or 'next week' based on conversation context.",
  },
  {
    icon: <FileText className="h-6 w-6" />,
    title: "Event Deduplication",
    description: "No more spam. Multiple messages discussing the same deadline are automatically merged into a single event.",
  },
  {
    icon: <Zap className="h-6 w-6" />,
    title: "Instant Export",
    description: "Generate standard .ics files instantly. One click to populate your calendar.",
  },
  {
    icon: <Shield className="h-6 w-6" />,
    title: "Privacy First",
    description: "Your chat remains completely private. Processing is local and stateless. No logs kept.",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.15,
    },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 100 } },
};

export const FeaturesSection: React.FC = () => {
  return (
    <section id="features" className="py-12">
      <div className="mb-10 text-center">
        <motion.h2 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          className="text-2xl font-bold tracking-[-0.015em] text-white md:text-3xl"
        >
          Minimal effort, <span className="gradient-text">maximum clarity</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ delay: 0.1 }}
          className="mt-3 text-sm text-neutral-400"
        >
          Everything you need to regain control over your group chats.
        </motion.p>
      </div>

      <motion.div 
        variants={container}
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, margin: "-50px" }}
        className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
      >
        {features.map((feature, i) => (
          <motion.div key={i} variants={item} className="h-full">
            <Card glow className="hover-lift h-full border-neutral-800 bg-neutral-900/50 p-6 transition-colors hover:border-neutral-700">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-800 text-neutral-200">
                {feature.icon}
              </div>
              <h3 className="mb-2 text-base font-semibold text-neutral-100">{feature.title}</h3>
              <p className="text-sm leading-relaxed text-neutral-400">
                {feature.description}
              </p>
            </Card>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
};
