import { CalendarView } from "@/components/features/calendar/calendar-view";
import { NotesPanel } from "@/components/features/dashboard/notes-panel";

export default function CalendarPage() {
  return (
    <div className="h-full flex flex-col lg:flex-row gap-6">
      {/* Middle column: Calendar */}
      <div className="flex-1 lg:flex-[3] min-w-0 h-full flex flex-col bg-white rounded-xl shadow-md shadow-gray-200/50 border border-gray-100 overflow-hidden">
         <CalendarView />
      </div>

      {/* Right Column: Global Notes */}
      <div className="flex-1 lg:flex-[1] min-w-[300px] h-full bg-white rounded-xl shadow-md shadow-gray-200/50 border border-gray-100 overflow-hidden">
        <NotesPanel />
      </div>
    </div>
  );
}
