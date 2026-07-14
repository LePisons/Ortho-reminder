"use client";

import { useEffect, useRef, useState } from "react";
import { API_URL } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Link2, User, X } from "lucide-react";

export interface LinkedPatient {
  id: string;
  fullName: string;
  rut?: string;
  phone?: string;
  email?: string;
}

interface SearchResult {
  id: string;
  fullName: string;
  avatarUrl?: string;
}

/**
 * Free-text patient name input with optional linking to an existing patient.
 * Typing always updates `name`; picking a suggestion additionally links the
 * patient (and prefills contact data via the full patient record).
 */
export function PatientAutocomplete({
  name,
  onNameChange,
  linked,
  onLink,
  onUnlink,
}: {
  name: string;
  onNameChange: (name: string) => void;
  linked: LinkedPatient | null;
  onLink: (patient: LinkedPatient) => void;
  onUnlink: () => void;
}) {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (linked || !name.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${API_URL}/patients/search?q=${encodeURIComponent(name)}`,
          { credentials: "include" },
        );
        if (res.ok) {
          setResults(await res.json());
          setOpen(true);
        }
      } catch {
        // search is best-effort; free text still works
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name, linked]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectPatient = async (result: SearchResult) => {
    setOpen(false);
    setResults([]);
    let patient: LinkedPatient = { id: result.id, fullName: result.fullName };
    try {
      const res = await fetch(`${API_URL}/patients/${result.id}`, {
        credentials: "include",
      });
      if (res.ok) {
        const full = await res.json();
        patient = {
          id: full.id,
          fullName: full.fullName,
          rut: full.rut,
          phone: full.phone,
          email: full.email,
        };
      }
    } catch {
      // fall back to name-only link
    }
    onLink(patient);
  };

  if (linked) {
    return (
      <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-brand-purple/5 px-3">
        <Link2 className="h-3.5 w-3.5 shrink-0 text-brand-blue" />
        <span className="flex-1 truncate text-sm font-medium">{linked.fullName}</span>
        <Badge variant="outline" className="border-brand-blue/30 text-[10px] text-brand-blue">
          Vinculado
        </Badge>
        <button
          type="button"
          onClick={onUnlink}
          className="text-muted-foreground transition-colors hover:text-foreground"
          title="Desvincular paciente"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative" ref={containerRef}>
      <Input
        value={name}
        onChange={(e) => onNameChange(e.target.value)}
        onFocus={() => results.length > 0 && setOpen(true)}
        placeholder="Nombre completo del paciente"
      />
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-gray-100 bg-white shadow-lg">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Vincular paciente existente
          </div>
          {results.slice(0, 6).map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => selectPatient(r)}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-primary/5"
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gray-100">
                {r.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <User className="h-3 w-3 text-gray-400" />
                )}
              </div>
              <span className="truncate text-sm font-medium text-gray-800">{r.fullName}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
