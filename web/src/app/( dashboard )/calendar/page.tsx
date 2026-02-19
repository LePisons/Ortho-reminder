import { CalendarView } from "@/components/features/calendar/calendar-view";

export default function CalendarPage() {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 p-6 overflow-hidden">
         <CalendarView />
      </div>
    </div>
  );
}
