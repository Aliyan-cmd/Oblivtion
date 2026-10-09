"use client";

import React from "react";
import { motion } from "framer-motion";
import {
  Upload,
  Sparkles,
  FileText,
  Key,
  Trash2,
  RefreshCw,
  SlidersHorizontal,
  Lock,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Toggle } from "@/components/ui/Toggle";
import { MODELS, ModelOption, type ApiKeyInfo } from "@/hooks/useChatAnalyzer";

interface ChatInputSectionProps {
  chat: string;
  setChat: (v: string) => void;
  lineCount: number;
  model: string;
  setModel: (v: string) => void;
  redact: boolean;
  setRedact: (v: boolean) => void;
  sources: boolean;
  setSources: (v: boolean) => void;
  apiKeys: ApiKeyInfo[];
  selectedApiKeyId: string;
  setSelectedApiKeyId: (v: string) => void;
  addApiKey: (name: string, key: string) => void;
  removeApiKey: (key: string) => void;
  showKey: boolean;
  setShowKey: (fn: (v: boolean) => boolean) => void;
  loading: boolean;
  fileRef: React.RefObject<HTMLInputElement | null>;
  loadSample: () => void;
  handleFileUpload: (file: File | undefined) => void;
  analyze: () => void;
  clearChat: () => void;
}

export const ChatInputSection: React.FC<ChatInputSectionProps> = ({
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
  fileRef,
  loadSample,
  handleFileUpload,
  analyze,
  clearChat,
}) => {
  return (
    <section id="chat-analyzer-input" className="h-fit">
      <Card glow className="border-neutral-500/20 bg-neutral-900/90 shadow-2xl">
        {/* Header toolbar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-neutral-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-neutral-200">
              WhatsApp Export Input
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadSample}
              icon={<RefreshCw className="h-3.5 w-3.5" />}
            >
              Load Sample
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileRef.current?.click()}
              icon={<Upload className="h-3.5 w-3.5" />}
            >
              Upload .txt
            </Button>
            {chat.trim() && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearChat}
                icon={<Trash2 className="h-3.5 w-3.5 text-neutral-400" />}
              >
                Clear
              </Button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => handleFileUpload(e.target.files?.[0])}
            />
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={chat}
            onChange={(e) => setChat(e.target.value)}
            spellCheck={false}
            placeholder={`[3] Aditi: DBMS assignment 2 ka deadline Thursday hai, 1 Oct\n[22] Aditi: Update: deadline postpone ho gaya, ab Friday 2 Oct tak hai\n[35] Aditi: kal 2 baje PM tak submit karna hai portal pe`}
            className="h-64 w-full resize-y rounded-xl border border-white/10 bg-neutral-950/80 p-4 font-mono text-xs leading-relaxed text-neutral-100 outline-none transition focus:border-neutral-500 focus:ring-2 focus:ring-neutral-500/20 placeholder:text-neutral-600 shadow-inner"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-neutral-400">
            <span className="flex items-center gap-1 text-neutral-500">
              <Lock className="h-3 w-3 text-neutral-300" />
              Client-side buffer · Processed in memory
            </span>
            <span className="font-mono font-semibold text-neutral-300">
              {lineCount} line{lineCount === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {/* Options & Configuration Controls */}
        <div className="mt-5 space-y-4 rounded-xl border border-white/10 bg-black/30 p-4">
          {/* Model Selector */}
          <div>
            <label className="block text-xs font-semibold text-neutral-300 mb-1.5">
              LLM Extraction Model
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2.5 text-xs font-medium text-neutral-200 outline-none focus:border-neutral-500 focus:ring-1 focus:ring-neutral-500"
            >
              {MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-neutral-900 py-1">
                  {m.label} {m.badge ? `(${m.badge})` : ""} — {m.description}
                </option>
              ))}
            </select>
          </div>

          {/* Privacy Toggles */}
          <div className="flex flex-wrap items-center gap-6 pt-1">
            <Toggle
              checked={redact}
              onChange={setRedact}
              label="Redact Names / PII"
              description="Anonymize names in final card views & exports"
            />
            <Toggle
              checked={sources}
              onChange={setSources}
              label="Include Message Quotes"
              description="Attach source WhatsApp lines in markdown"
            />
          </div>

          {/* Custom API Key Drawer */}
          <div id="api-settings" className="border-t border-white/5 pt-3">
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="flex items-center gap-1.5 text-xs font-medium text-neutral-400 hover:text-neutral-300 transition-colors"
            >
              <Key className="h-3.5 w-3.5" />
              <span>{showKey ? "Hide Custom API Keys" : "Manage Groq API Keys"}</span>
            </button>
            {showKey && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="mt-3 space-y-3"
              >
                {apiKeys.length > 0 && (
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedApiKeyId}
                      onChange={(e) => setSelectedApiKeyId(e.target.value)}
                      className="flex-1 rounded-xl border border-white/10 bg-neutral-950 px-3.5 py-2 text-xs font-medium text-neutral-200 outline-none focus:border-neutral-500"
                    >
                      <option value="">Default Server Key</option>
                      {apiKeys.map((k) => (
                        <option key={k.key} value={k.key}>
                          {k.name} ({k.key.substring(0, 8)}...)
                        </option>
                      ))}
                    </select>
                    {selectedApiKeyId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeApiKey(selectedApiKeyId)}
                        className="!px-3 !py-2 shrink-0 border-neutral-500/20 hover:bg-neutral-500/10 hover:text-neutral-400"
                      >
                        <Trash2 className="h-3.5 w-3.5 text-neutral-400" />
                      </Button>
                    )}
                  </div>
                )}
                <div className="rounded-xl border border-white/5 bg-neutral-900/50 p-3 space-y-2">
                  <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Add New Key</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      id="new-key-name"
                      placeholder="Name (e.g. Personal)"
                      className="w-1/3 rounded-lg border border-white/10 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-200 outline-none focus:border-neutral-500"
                    />
                    <input
                      type="password"
                      id="new-key-val"
                      placeholder="gsk_..."
                      className="flex-1 rounded-lg border border-white/10 bg-neutral-950 px-3 py-1.5 font-mono text-xs text-neutral-200 outline-none focus:border-neutral-500"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const nameEl = document.getElementById("new-key-name") as HTMLInputElement;
                        const valEl = document.getElementById("new-key-val") as HTMLInputElement;
                        if (nameEl && valEl && nameEl.value && valEl.value) {
                          addApiKey(nameEl.value, valEl.value);
                          nameEl.value = "";
                          valEl.value = "";
                        }
                      }}
                      className="!px-3 shrink-0"
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Keys are stored locally in your browser. Select a custom key to override the server default.
                </p>
              </motion.div>
            )}
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-5">
          <Button
            variant="primary"
            size="lg"
            className="w-full font-bold uppercase tracking-wider"
            isLoading={loading}
            disabled={!chat.trim()}
            icon={<Sparkles className="h-4 w-4 text-neutral-400 animate-pulse" />}
            onClick={analyze}
          >
            {loading ? "Parsing Group Chat..." : "Summarize Chat & Resolve Deadlines"}
          </Button>
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            Powered by Groq LPUs · High-throughput streaming parsing
          </p>
        </div>
      </Card>
    </section>
  );
};
