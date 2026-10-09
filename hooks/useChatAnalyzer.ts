"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import type { AnalyzePayload } from "@/lib/serialize";
import { useConfetti } from "./useConfetti";

export type ApiKeyInfo = { name: string; key: string };

export type ModelOption = {
  id: string;
  label: string;
  description: string;
  badge?: string;
};

export const MODELS: ModelOption[] = [
  {
    id: "llama-3.3-70b-versatile",
    label: "Llama 3.3 70B Versatile",
    description: "Highest accuracy for complex Hinglish group chats",
    badge: "Recommended",
  },
  {
    id: "llama-3.1-8b-instant",
    label: "Llama 3.1 8B Instant",
    description: "Ultra-fast extraction for long chat exports",
    badge: "Fastest",
  },
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    description: "Deep reasoning engine for ambiguous deadlines",
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    description: "Lightweight & balanced model",
  },
  {
    id: "meta-llama/llama-4-scout-17b-16e-instruct",
    label: "Llama 4 Scout 17B",
    description: "Next-gen instruction follower",
  },
];

export type ProgressState = {
  phase: string;
  window: number;
  totalWindows: number;
  itemCount?: number;
  from?: number;
  to?: number;
};

export function useChatAnalyzer() {
  const [chat, setChat] = useState("");
  const [model, setModel] = useState(MODELS[0].id);
  const [redact, setRedact] = useState(false);
  const [sources, setSources] = useState(false);
  const [apiKeys, setApiKeys] = useState<ApiKeyInfo[]>([]);
  const [selectedApiKeyId, setSelectedApiKeyId] = useState<string>("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("tldr_api_keys");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setApiKeys(parsed);
        if (parsed.length > 0) {
          setSelectedApiKeyId(parsed[0].key);
        }
      } catch (e) {}
    }
  }, []);

  const addApiKey = useCallback((name: string, key: string) => {
    if (!name.trim() || !key.trim()) return;
    const newKeys = [...apiKeys.filter(k => k.key !== key.trim()), { name: name.trim(), key: key.trim() }];
    setApiKeys(newKeys);
    setSelectedApiKeyId(key.trim());
    localStorage.setItem("tldr_api_keys", JSON.stringify(newKeys));
  }, [apiKeys]);

  const removeApiKey = useCallback((keyToRemove: string) => {
    const newKeys = apiKeys.filter(k => k.key !== keyToRemove);
    setApiKeys(newKeys);
    if (selectedApiKeyId === keyToRemove) {
      setSelectedApiKeyId(newKeys.length > 0 ? newKeys[0].key : "");
    }
    localStorage.setItem("tldr_api_keys", JSON.stringify(newKeys));
  }, [apiKeys, selectedApiKeyId]);

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalyzePayload | null>(null);

  const { fireConfetti } = useConfetti();
  const fileRef = useRef<HTMLInputElement>(null);

  const lineCount = useMemo(
    () => chat.split(/\r?\n/).filter((l) => l.trim()).length,
    [chat]
  );

  const loadSample = useCallback(async () => {
    try {
      const res = await fetch("/sample_chat.txt");
      if (!res.ok) throw new Error("Failed to load sample chat");
      const text = await res.text();
      setChat(text);
      setError(null);
    } catch {
      setError("Could not load the sample chat file.");
    }
  }, []);

  const loadPreset = useCallback((presetText: string) => {
    setChat(presetText);
    setError(null);
  }, []);

  const handleFileUpload = useCallback(async (file: File | undefined) => {
    if (!file) return;
    try {
      const text = await file.text();
      setChat(text);
      setError(null);
    } catch {
      setError("Failed to read the uploaded file.");
    }
  }, []);

  const analyze = useCallback(async () => {
    if (!chat.trim() || loading) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setProgress({ phase: "parse", window: 0, totalWindows: 0 });

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(selectedApiKeyId.trim() ? { "x-groq-key": selectedApiKeyId.trim() } : {}),
        },
        body: JSON.stringify({ chat, model, redact, sources }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || `Request failed with status ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "progress") {
            setProgress(event);
          } else if (event.type === "result") {
            setResult(event.payload);
            fireConfetti();
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred during processing.");
    } finally {
      setLoading(false);
      setProgress(null);
    }
  }, [chat, model, redact, sources, selectedApiKeyId, loading, fireConfetti]);

  const clearChat = useCallback(() => {
    setChat("");
    setResult(null);
    setError(null);
  }, []);

  return {
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
  };
}
