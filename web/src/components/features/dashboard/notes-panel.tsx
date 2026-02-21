"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, StickyNote, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";
import { Note } from "@/lib/types";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface NotesPanelProps {
  patientId?: string;
}

const COLORS = [
  { name: "green", value: "bg-emerald-50/70 border-emerald-100/80", flagColor: "text-emerald-500", label: "Low Priority" },
  { name: "yellow", value: "bg-amber-50/70 border-amber-100/80", flagColor: "text-amber-500", label: "Medium Priority" },
  { name: "red", value: "bg-rose-50/70 border-rose-100/80", flagColor: "text-rose-500", label: "High Priority" },
];

export function NotesPanel({ patientId }: NotesPanelProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newNoteContent, setNewNoteContent] = useState("");
  const [newNoteColor, setNewNoteColor] = useState("yellow");

  const fetchNotes = useCallback(async () => {
    try {
      const url = patientId ? `${API_URL}/notes?patientId=${patientId}` : `${API_URL}/notes`;
      const response = await fetch(url, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch notes");
      const data = await response.json();
      setNotes(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const handleAddNote = async () => {
    if (!newNoteContent.trim()) return;

    try {
      const response = await fetch(`${API_URL}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newNoteContent,
          color: newNoteColor,
          ...(patientId ? { patientId } : {}),
        }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to create note");

      toast.success("Note added");
      setNewNoteContent("");
      setIsAddOpen(false);
      fetchNotes();
    } catch (error) {
      console.error(error);
      toast.error("Failed to add note");
    }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/notes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to delete note");

      toast.success("Note deleted");
      setNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete note");
    }
  };

  return (
    <div className="h-full flex flex-col bg-white p-5 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <StickyNote className="w-5 h-5 text-amber-500" />
          Notes
        </h3>
        <Button size="sm" onClick={() => setIsAddOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 pr-2">
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Loading notes...
          </p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 italic">
            No notes yet. Add one!
          </p>
        ) : (
          notes.map((note) => (
              <div
                key={note.id}
                className={`p-4 rounded-xl border shadow-sm shadow-black/5 relative group transition-all hover:-translate-y-0.5 hover:shadow-md ${COLORS.find((c) => c.name === note.color)?.value || COLORS[0].value}`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center gap-1">
                    <Flag className={`w-3.5 h-3.5 fill-current ${COLORS.find((c) => c.name === note.color)?.flagColor || COLORS[0].flagColor}`} />
                  </div>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-black/10 rounded-full text-gray-600 -mt-1 -mr-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed text-gray-800">
                  {note.content}
                </p>
                <p className="text-[10px] text-gray-500 mt-3 text-right">
                  {format(new Date(note.createdAt), "MMM d, yyyy")}
                </p>
              </div>
          ))
        )}
      </div>

      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Note</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              value={newNoteContent}
              onChange={(e) => setNewNoteContent(e.target.value)}
              placeholder="Type your note here..."
              className="resize-none h-32"
            />
            <div className="flex gap-4">
              {COLORS.map((c) => (
                <button
                  key={c.name}
                  onClick={() => setNewNoteColor(c.name)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full border-2 transition-transform hover:scale-105 ${
                    newNoteColor === c.name
                      ? "border-gray-800 bg-gray-50"
                      : "border-transparent hover:bg-gray-50"
                  }`}
                >
                   <Flag className={`w-4 h-4 fill-current ${c.flagColor}`} />
                   <span className="text-xs font-medium text-gray-700">{c.label}</span>
                </button>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddNote}>Save Note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
