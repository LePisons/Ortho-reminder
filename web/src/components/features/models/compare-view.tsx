"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { format } from "date-fns";
import { ModelSet } from "@/lib/types";
import { API_URL } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Link2, Link2Off } from "lucide-react";
import { createCameraSyncChannel } from "./stl-viewer";

const StlViewer = dynamic(() => import("./stl-viewer"), { ssr: false });

function setLabel(set: ModelSet): string {
  const date = format(new Date(set.takenAt), "dd/MM/yyyy");
  return set.label ? `${date} — ${set.label}` : date;
}

function fileUrl(set: ModelSet, jaw: "upper" | "lower"): string | null {
  const key = jaw === "upper" ? set.upperKey : set.lowerKey;
  return key ? `${API_URL}/model-sets/${set.id}/file?jaw=${jaw}` : null;
}

interface ComparePanelProps {
  sets: ModelSet[];
  selectedId: string;
  onSelect: (id: string) => void;
  sync: ReturnType<typeof createCameraSyncChannel>;
}

function ComparePanel({ sets, selectedId, onSelect, sync }: ComparePanelProps) {
  const set = sets.find((s) => s.id === selectedId);
  return (
    <div className="flex-1 min-w-0 space-y-2">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
      >
        {sets.map((s) => (
          <option key={s.id} value={s.id}>
            {setLabel(s)}
          </option>
        ))}
      </select>
      {set && (
        <StlViewer
          key={set.id}
          upperUrl={fileUrl(set, "upper")}
          lowerUrl={fileUrl(set, "lower")}
          sync={sync}
          compact
        />
      )}
    </div>
  );
}

interface CompareViewProps {
  sets: ModelSet[]; // newest first
}

export function CompareView({ sets }: CompareViewProps) {
  // Default: latest scan on the right, previous one on the left.
  const [leftId, setLeftId] = useState(sets[1]?.id ?? sets[0]?.id);
  const [rightId, setRightId] = useState(sets[0]?.id);
  const [synced, setSynced] = useState(true);

  const channel = useMemo(() => createCameraSyncChannel(), []);
  channel.enabled = synced;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setSynced((s) => !s)}
          className={synced ? "border-[#6469FC] text-[#6469FC]" : ""}
        >
          {synced ? (
            <>
              <Link2 className="w-4 h-4 mr-1.5" /> Cámaras sincronizadas
            </>
          ) : (
            <>
              <Link2Off className="w-4 h-4 mr-1.5" /> Cámaras independientes
            </>
          )}
        </Button>
      </div>
      <div className="flex flex-col md:flex-row gap-4">
        <ComparePanel
          sets={sets}
          selectedId={leftId}
          onSelect={setLeftId}
          sync={channel}
        />
        <ComparePanel
          sets={sets}
          selectedId={rightId}
          onSelect={setRightId}
          sync={channel}
        />
      </div>
    </div>
  );
}
