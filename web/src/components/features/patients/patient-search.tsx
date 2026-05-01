"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/utils";
import { Search, User, X, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SearchResult {
  id: string;
  fullName: string;
  currentAligner: number;
  totalAligners: number;
  status: "ACTIVE" | "PAUSED" | "FINISHED";
  avatarUrl?: string;
  pipelineStage?: string;
}

interface RecentPatient {
  id: string;
  fullName: string;
  visitedAt: number;
}

const RECENT_KEY = "ortho-recent-patients";
const MAX_RECENT = 5;

function getRecentPatients(): RecentPatient[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

export function addRecentPatient(id: string, fullName: string) {
  const recent = getRecentPatients().filter((p) => p.id !== id);
  recent.unshift({ id, fullName, visitedAt: Date.now() });
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

const statusColors: Record<string, string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PAUSED: "bg-amber-100 text-amber-700 border-amber-200",
  FINISHED: "bg-slate-100 text-slate-600 border-slate-200",
};

export function PatientSearch({ collapsed }: { collapsed: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [recentPatients, setRecentPatients] = useState<RecentPatient[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Load recent patients on mount
  useEffect(() => {
    setRecentPatients(getRecentPatients());
  }, []);

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/patients/search?q=${encodeURIComponent(q)}`,
        { credentials: "include" }
      );
      if (res.ok) {
        const data = await res.json();
        setResults(data);
      }
    } catch (err) {
      console.error("Search failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(() => search(query), 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, search]);

  // Global Ctrl+K / Cmd+K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setIsOpen(true);
        setRecentPatients(getRecentPatients());
      }
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (id: string, name: string) => {
    addRecentPatient(id, name);
    setIsOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/patients/${id}`);
  };

  // Keyboard navigation
  const items = query.trim() ? results : recentPatients;
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedIndex >= 0 && items[selectedIndex]) {
      e.preventDefault();
      const item = items[selectedIndex];
      handleSelect(item.id, item.fullName);
    }
  };

  // Collapsed sidebar: show icon that opens a command-palette style modal
  if (collapsed) {
    return (
      <>
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            setRecentPatients(getRecentPatients());
          }}
          className={`flex items-center justify-center w-full py-3 rounded-2xl transition-all ${
            isOpen
              ? "text-white bg-white/20"
              : "text-white/60 hover:text-white hover:bg-white/10"
          }`}
          title="Search patients (Ctrl+K)"
        >
          <Search className="w-5 h-5" />
        </button>

        {/* Portal: full-screen overlay with search panel */}
        {isOpen &&
          typeof document !== "undefined" &&
          createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]"
              onClick={(e) => {
                if (e.target === e.currentTarget) setIsOpen(false);
              }}
            >
              {/* Backdrop */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150" />

              {/* Search panel */}
              <div
                ref={containerRef}
                className="relative w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 slide-in-from-top-4 duration-200"
              >
                {/* Search input */}
                <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100">
                  <Search className="w-5 h-5 text-gray-400 shrink-0" />
                  <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setSelectedIndex(-1);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search patients..."
                    autoFocus
                    className="flex-1 text-base text-gray-900 placeholder:text-gray-400 focus:outline-none min-w-0"
                  />
                  {query ? (
                    <button
                      onClick={() => {
                        setQuery("");
                        setResults([]);
                        inputRef.current?.focus();
                      }}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : (
                    <kbd className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-400 font-mono">
                      ESC
                    </kbd>
                  )}
                </div>

                {/* Results */}
                <div className="max-h-[360px] overflow-y-auto">
                  {query.trim() ? (
                    loading ? (
                      <div className="flex items-center justify-center py-10">
                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
                      </div>
                    ) : results.length > 0 ? (
                      <div className="py-1.5">
                        {results.map((patient, i) => (
                          <button
                            key={patient.id}
                            onClick={() =>
                              handleSelect(patient.id, patient.fullName)
                            }
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 rounded-lg mx-1 ${
                              i === selectedIndex
                                ? "bg-primary/10 border-l-[3px] border-primary shadow-sm"
                                : "hover:bg-primary/5 hover:border-l-[3px] hover:border-primary/50 hover:shadow-sm hover:scale-[1.01] border-l-[3px] border-transparent"
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 overflow-hidden">
                              {patient.avatarUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={patient.avatarUrl}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <User className="w-3.5 h-3.5 text-gray-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">
                                {patient.fullName}
                              </p>
                              <p className="text-xs text-gray-500">
                                Aligner #{patient.currentAligner || 0}
                                {patient.totalAligners
                                  ? ` / ${patient.totalAligners}`
                                  : ""}
                              </p>
                            </div>
                            <Badge
                              variant="outline"
                              className={`text-[10px] shrink-0 ${
                                statusColors[patient.status] || ""
                              }`}
                            >
                              {patient.status}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="py-10 text-center text-sm text-gray-400">
                        No patients found
                      </div>
                    )
                  ) : recentPatients.length > 0 ? (
                    <div>
                      <div className="px-4 py-2.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Clock className="w-3 h-3" />
                        Recent Patients
                      </div>
                      {recentPatients.map((patient, i) => (
                        <button
                          key={patient.id}
                          onClick={() =>
                            handleSelect(patient.id, patient.fullName)
                          }
                          className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 rounded-lg mx-1 ${
                            i === selectedIndex
                              ? "bg-primary/10 border-l-[3px] border-primary shadow-sm"
                              : "hover:bg-primary/5 hover:border-l-[3px] hover:border-primary/50 hover:shadow-sm hover:scale-[1.01] border-l-[3px] border-transparent"
                          }`}
                        >
                          <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-gray-400" />
                          </div>
                          <span className="text-sm text-gray-700 font-medium truncate">
                            {patient.fullName}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 text-center text-xs text-gray-400">
                      Start typing to search patients
                    </div>
                  )}
                </div>
              </div>
            </div>,
            document.body
          )}
      </>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      {/* Search input */}
      <div
        className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 transition-all duration-200 ${
          isOpen
            ? "bg-white/20 ring-2 ring-white/30 shadow-lg"
            : "bg-white/10 hover:bg-white/15"
        }`}
      >
        <Search className="w-4 h-4 text-white/50 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            setIsOpen(true);
            setRecentPatients(getRecentPatients());
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search patients..."
          className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 focus:outline-none min-w-0"
        />
        {query ? (
          <button
            onClick={() => {
              setQuery("");
              setResults([]);
              inputRef.current?.focus();
            }}
            className="text-white/40 hover:text-white/70 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : (
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/40 font-mono">
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl border border-gray-100 shadow-2xl overflow-hidden z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          {/* Search results */}
          {query.trim() ? (
            <div className="max-h-[320px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-200 border-t-primary" />
                </div>
              ) : results.length > 0 ? (
                <div className="py-1.5">
                  {results.map((patient, i) => (
                    <button
                      key={patient.id}
                      onClick={() =>
                        handleSelect(patient.id, patient.fullName)
                      }
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 rounded-lg mx-1 ${
                        i === selectedIndex
                          ? "bg-primary/10 border-l-[3px] border-primary shadow-sm"
                          : "hover:bg-primary/5 hover:border-l-[3px] hover:border-primary/50 hover:shadow-sm hover:scale-[1.01] border-l-[3px] border-transparent"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500 shrink-0 overflow-hidden">
                        {patient.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={patient.avatarUrl}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <User className="w-3.5 h-3.5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {patient.fullName}
                        </p>
                        <p className="text-xs text-gray-500">
                          Aligner #{patient.currentAligner || 0}
                          {patient.totalAligners
                            ? ` / ${patient.totalAligners}`
                            : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${
                          statusColors[patient.status] || ""
                        }`}
                      >
                        {patient.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-sm text-gray-400">
                  No patients found
                </div>
              )}
            </div>
          ) : recentPatients.length > 0 ? (
            /* Recent patients */
            <div>
              <div className="px-4 py-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3 h-3" />
                Recent
              </div>
              {recentPatients.map((patient, i) => (
                <button
                  key={patient.id}
                  onClick={() =>
                    handleSelect(patient.id, patient.fullName)
                  }
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 rounded-lg mx-1 ${
                    i === selectedIndex ? "bg-primary/10 border-l-[3px] border-primary shadow-sm" : "hover:bg-primary/5 hover:border-l-[3px] hover:border-primary/50 hover:shadow-sm hover:scale-[1.01] border-l-[3px] border-transparent"
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 text-gray-400" />
                  </div>
                  <span className="text-sm text-gray-700 font-medium truncate">
                    {patient.fullName}
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-gray-400">
              Type to search patients
            </div>
          )}
        </div>
      )}
    </div>
  );
}
