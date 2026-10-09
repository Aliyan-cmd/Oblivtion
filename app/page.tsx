"use client";

import React, { Suspense } from "react";
import dynamic from "next/dynamic";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { Header } from "@/components/sections/Header";
import { NavigationHubSection } from "@/components/sections/NavigationHubSection";
import { ChatInputSection } from "@/components/sections/ChatInputSection";
import { ResultsSection } from "@/components/sections/ResultsSection";
import { Footer } from "@/components/sections/Footer";
import { HeroSection } from "@/components/sections/HeroSection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { useChatAnalyzer } from "@/hooks/useChatAnalyzer";
import { motion } from "framer-motion";

// SSR-safe dynamic imports for all WebGL / canvas components
const ThreeBackground = dynamic(
  () => import("@/components/3d/ThreeBackground").then((m) => ({ default: m.ThreeBackground })),
  { ssr: false, loading: () => null }
);

export default function Home() {
  const {
    chat,
    setChat,
    lineCount,
    model,
    setModel,
    redact,
    setRedact,
    sources,
    setSources,
    apiKeys,
    selectedApiKeyId,
    setSelectedApiKeyId,
    addApiKey,
    removeApiKey,
    showKey,
    setShowKey,
    loading,
    progress,
    error,
    result,
    fileRef,
    loadSample,
    loadPreset,
    handleFileUpload,
    analyze,
    clearChat,
  } = useChatAnalyzer();

  const handleJumpToSection = (sectionId: string) => {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <ErrorBoundary>
      <div className="relative min-h-screen bg-neutral-950 text-neutral-100 selection:bg-neutral-500 selection:text-white font-sans antialiased overflow-x-hidden">

        {/* Three.js Particle Background — client-only */}
        <Suspense fallback={null}>
          <ThreeBackground />
        </Suspense>

        {/* Header */}
        <Header
          showKey={showKey}
          setShowKey={setShowKey}
          hasCustomKey={apiKeys.length > 0}
        />

        {/* Main Content */}
        <motion.main 
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative z-10 mx-auto max-w-7xl px-5 py-6 space-y-8"
        >

          {/* Hero with 3D Spline — already SSR-safe via dynamic inside */}
          <HeroSection
            onStartAnalyzing={() => handleJumpToSection("chat-analyzer-input")}
            onExploreHub={() => handleJumpToSection("navigation-hub")}
          />

          {/* Features Section */}
          <FeaturesSection />

          {/* Navigation & Resources Hub */}
          <NavigationHubSection
            onSelectPreset={loadPreset}
            onJumpToSection={handleJumpToSection}
          />

          {/* Main Dual Grid */}
          <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            {/* Input Panel */}
            <div className="lg:sticky lg:top-24">
              <ChatInputSection
                chat={chat}
                setChat={setChat}
                lineCount={lineCount}
                model={model}
                setModel={setModel}
                redact={redact}
                setRedact={setRedact}
                sources={sources}
                setSources={setSources}
                apiKeys={apiKeys}
                selectedApiKeyId={selectedApiKeyId}
                setSelectedApiKeyId={setSelectedApiKeyId}
                addApiKey={addApiKey}
                removeApiKey={removeApiKey}
                showKey={showKey}
                setShowKey={setShowKey}
                loading={loading}
                fileRef={fileRef}
                loadSample={loadSample}
                handleFileUpload={handleFileUpload}
                analyze={analyze}
                clearChat={clearChat}
              />
            </div>

            {/* Results Panel */}
            <div>
              <ResultsSection
                loading={loading}
                progress={progress}
                error={error}
                result={result}
              />
            </div>
          </div>
        </motion.main>

        <Footer />
      </div>
    </ErrorBoundary>
  );
}
