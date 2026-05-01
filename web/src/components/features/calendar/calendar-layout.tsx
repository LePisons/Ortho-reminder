"use client";

import { useState, useEffect } from "react";
import { CalendarView } from "@/components/features/calendar/calendar-view";
import { NotesPanel } from "@/components/features/dashboard/notes-panel";
import { StickyNote, X } from "lucide-react";

export function CollapsibleCalendarLayout() {
  const [notesOpen, setNotesOpen] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem("calendar-notes-open");
    if (saved === "false") setNotesOpen(false);
  }, []);

  const toggleNotes = () => {
    const next = !notesOpen;
    setNotesOpen(next);
    localStorage.setItem("calendar-notes-open", String(next));
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 relative">
      {/* Calendar */}
      <div className="flex-1 min-w-0 h-full flex flex-col bg-white rounded-xl shadow-md shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <CalendarView onToggleNotes={toggleNotes} notesOpen={notesOpen} />
      </div>

      {/* Notes Panel — collapsible */}
      <div
        className={`h-full bg-white rounded-xl shadow-md shadow-gray-200/50 border border-gray-100 overflow-hidden transition-all duration-300 ease-in-out ${
          notesOpen
            ? "lg:w-[320px] lg:min-w-[300px] opacity-100"
            : "lg:w-0 lg:min-w-0 lg:border-0 lg:shadow-none opacity-0 pointer-events-none lg:p-0"
        }`}
      >
        {notesOpen && (
          <div className="h-full flex flex-col">
            <div className="flex items-center justify-end px-4 pt-4">
              <button
                onClick={toggleNotes}
                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                title="Hide notes"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <NotesPanel />
          </div>
        )}
      </div>
    </div>
  );
}
