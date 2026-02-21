"use client";

import { useState, useEffect, useCallback } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay, addMonths, subMonths, isToday, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon, Clock, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { API_URL, cn } from "@/lib/utils";
import { Appointment, Patient } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";

const EVENT_COLORS = [
    "bg-blue-50 text-blue-700 border-l-blue-500 hover:bg-blue-100 ring-1 ring-blue-500/10",
    "bg-purple-50 text-purple-700 border-l-purple-500 hover:bg-purple-100 ring-1 ring-purple-500/10",
    "bg-amber-50 text-amber-700 border-l-amber-500 hover:bg-amber-100 ring-1 ring-amber-500/10",
    "bg-rose-50 text-rose-700 border-l-rose-500 hover:bg-rose-100 ring-1 ring-rose-500/10",
    "bg-emerald-50 text-emerald-700 border-l-emerald-500 hover:bg-emerald-100 ring-1 ring-emerald-500/10",
];

const getEventColor = (id: string) => {
    let hash = 0;
    for (let i = 0; i < Math.min(id.length, 10); i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
};

export function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Event Dialog State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStart, setNewEventStart] = useState(""); // YYYY-MM-DDTHH:mm
  const [newEventEnd, setNewEventEnd] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [patients, setPatients] = useState<Patient[]>([]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(subMonths(currentDate, 1)).toISOString();
      const end = endOfMonth(addMonths(currentDate, 1)).toISOString();
      
      const response = await fetch(`${API_URL}/appointments?start=${start}&end=${end}`, {
         credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch appointments");
      const data = await response.json();
      setAppointments(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  const fetchPatients = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/patients?limit=100`, { credentials: "include" });
      if (response.ok) {
        const data = await response.json();
        setPatients(data.data || []);
      }
    } catch (error) {
       console.error("Failed to fetch patients", error);
       setPatients([]);
    }
  }, []);

  useEffect(() => {
    fetchAppointments();
    fetchPatients();
  }, [fetchAppointments, fetchPatients]);

  const handleCreateAppointment = async () => {
    if (!newEventTitle || !newEventStart || !newEventEnd) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
        const response = await fetch(`${API_URL}/appointments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: newEventTitle,
                start: new Date(newEventStart).toISOString(),
                end: new Date(newEventEnd).toISOString(),
                patientId: selectedPatient || undefined,
            }),
            credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to create event");
        
        toast.success("Event created");
        setIsDialogOpen(false);
        setNewEventTitle("");
        setNewEventStart("");
        setNewEventEnd("");
        setSelectedPatient("");
        fetchAppointments();
    } catch (error) {
        console.error(error);
        toast.error("Failed to create event");
    }
  };

  // Drag and Drop State
  const [draggedAppointment, setDraggedAppointment] = useState<Appointment | null>(null);

  const onDragStart = (e: React.DragEvent, appointment: Appointment) => {
    setDraggedAppointment(appointment);
    e.dataTransfer.setData("text/plain", appointment.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };

  const onDrop = async (e: React.DragEvent, day: Date) => {
    e.preventDefault();
    if (!draggedAppointment) return;

    // Don't update if dropped on same day
    if (isSameDay(parseISO(draggedAppointment.start), day)) return;

    const newStart = new Date(draggedAppointment.start);
    const newEnd = new Date(draggedAppointment.end);
    
    // Calculate duration to keep it same
    const duration = newEnd.getTime() - newStart.getTime();

    // Set new start date but keep time
    const updatedStart = new Date(day);
    updatedStart.setHours(newStart.getHours(), newStart.getMinutes());
    
    const updatedEnd = new Date(updatedStart.getTime() + duration);

    try {
        const response = await fetch(`${API_URL}/appointments/${draggedAppointment.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                start: updatedStart.toISOString(),
                end: updatedEnd.toISOString(),
            }),
            credentials: "include",
        });

        if (!response.ok) throw new Error("Failed to move event");
        
        toast.success("Event moved");
        fetchAppointments();
    } catch (error) {
        console.error(error);
        toast.error("Failed to move event");
    } finally {
        setDraggedAppointment(null);
    }
  };

  // Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "ArrowLeft") prevMonth();
        if (e.key === "ArrowRight") nextMonth();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);


  // Event Details State
  const [selectedEvent, setSelectedEvent] = useState<Appointment | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const handleDeleteEvent = async () => {
      if (!selectedEvent) return;
      try {
          const response = await fetch(`${API_URL}/appointments/${selectedEvent.id}`, {
              method: "DELETE",
              credentials: "include",
          });
          if (!response.ok) throw new Error("Failed to delete event");
          toast.success("Event deleted");
          setIsDetailsOpen(false);
          fetchAppointments();
      } catch {
          toast.error("Failed to delete event");
      }
  };


  // Calendar Navigation & Grid Generation
  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });
  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-6 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-6">
          <h2 className="text-3xl font-bold text-gray-900 capitalize tracking-tight flex items-center gap-3">
            <CalendarIcon className="h-8 w-8 text-emerald-400 drop-shadow-sm" />
            {format(currentDate, "MMMM yyyy")}
          </h2>
          <div className="flex items-center rounded-lg border border-gray-300 bg-white shadow-sm ring-1 ring-gray-950/5">
            <Button variant="ghost" size="icon" onClick={prevMonth} className="h-9 w-9 rounded-md hover:bg-gray-100 text-gray-700">
                <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />
            <Button variant="ghost" size="sm" onClick={goToToday} className="h-9 px-4 text-sm font-semibold hover:bg-gray-100 text-gray-700">
                Today
            </Button>
             <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />
            <div className="w-[1px] h-5 bg-gray-300 mx-0.5" />
            <Button variant="ghost" size="icon" onClick={nextMonth} className="h-9 w-9 rounded-md hover:bg-gray-100 text-gray-700">
                <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="icon" 
                onClick={async () => {
                    const toastId = toast.loading("Syncing with Todoist...");
                    try {
                        const res = await fetch(`${API_URL}/appointments/sync-todoist`, { method: "POST", credentials: "include" });
                        if (!res.ok) throw new Error("Sync failed");
                        toast.success("Synced successfully", { id: toastId });
                        fetchAppointments();
                    } catch {
                        toast.error("Failed to sync", { id: toastId });
                    }
                }}
                className="h-11 w-11 rounded-lg border-gray-200 hover:bg-gray-50 text-gray-600"
                title="Sync with Todoist"
            >
                <RefreshCw className="h-5 w-5" />
            </Button>

            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                    <Button className="gap-2 shadow-sm text-sm font-semibold px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground border-0 transition-all active:scale-95">
                        <Plus className="h-4 w-4" /> New Event
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle className="text-xl">Create Event</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-5 py-5">
                        <div className="grid gap-2">
                            <Label htmlFor="title" className="text-sm font-semibold">Title</Label>
                            <Input id="title" value={newEventTitle} onChange={e => setNewEventTitle(e.target.value)} placeholder="Check-up, Adjustment..." className="text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="start" className="text-sm font-semibold">Start</Label>
                                <Input id="start" type="datetime-local" value={newEventStart} onChange={e => setNewEventStart(e.target.value)} className="text-sm border-gray-200 focus-visible:ring-primary shadow-sm" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="end" className="text-sm font-semibold">End</Label>
                                <Input id="end" type="datetime-local" value={newEventEnd} onChange={e => setNewEventEnd(e.target.value)} className="text-sm border-gray-200 focus-visible:ring-primary shadow-sm" />
                            </div>
                        </div>
                        <div className="grid gap-2">
                             <Label className="text-sm font-semibold">Patient (Optional)</Label>
                             <Select value={selectedPatient} onValueChange={setSelectedPatient}>
                                <SelectTrigger className="text-base">
                                    <SelectValue placeholder="Select patient..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {patients.map(p => (
                                        <SelectItem key={p.id} value={p.id} className="text-base">{p.fullName}</SelectItem>
                                    ))}
                                </SelectContent>
                             </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateAppointment} size="lg" className="w-full text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">Save Event</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      {/* Days Header */}
      <div className="grid grid-cols-7 border-b border-gray-100 bg-white">
        {weekDays.map(day => (
            <div key={day} className="py-3 text-center text-xs font-semibold text-gray-400 uppercase tracking-[0.15em]">
                {day}
            </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 bg-gray-100 gap-px grid grid-cols-7 grid-rows-6 border-b border-gray-100 min-h-0">
        {loading ? (
             Array.from({ length: 42 }).map((_, i) => (
                <div key={i} className="bg-white p-3 min-h-0 h-full">
                    <Skeleton className="h-8 w-8 rounded-full mb-3" />
                    <Skeleton className="h-5 w-full rounded mb-2" />
                    <Skeleton className="h-5 w-3/4 rounded" />
                </div>
             ))
        ) : (
            calendarDays.map((day) => {
                const isCurrentMonth = isSameMonth(day, monthStart);
                const isTodayDate = isToday(day);
                const dayAppointments = appointments.filter(appt => isSameDay(parseISO(appt.start), day));

                return (
                    <div 
                        key={day.toString()} 
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, day)}
                        onClick={(e) => {
                            // Only trigger new event if clicking the empty space of the cell
                            if (e.target === e.currentTarget || (e.target as HTMLElement).tagName.toLowerCase() === 'div') {
                                const formattedDate = format(day, "yyyy-MM-dd'T'12:00");
                                const endFormattedDate = format(day, "yyyy-MM-dd'T'13:00");
                                setNewEventStart(formattedDate);
                                setNewEventEnd(endFormattedDate);
                                setIsDialogOpen(true);
                            }
                        }}
                        className={cn(
                            "min-h-0 h-full bg-white p-2.5 transition-colors flex flex-col gap-1 group relative cursor-crosshair",
                            !isCurrentMonth && "text-gray-300",
                            isCurrentMonth && "hover:bg-primary/5"
                        )}
                    >
                        <div className="flex justify-between items-start mb-1 shrink-0">
                            <span className={cn(
                                "text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full transition-all pointer-events-none",
                                isTodayDate 
                                    ? "bg-primary text-white shadow-sm ring-4 ring-primary/10 font-bold" 
                                    : "text-gray-600 group-hover:text-primary"
                            )}>
                                {format(day, 'd')}
                            </span>
                        </div>
                        
                        {/* Events */}
                        <div className="flex-1 flex flex-col gap-1 overflow-y-auto overflow-x-hidden min-h-0 scrollbar-thin scrollbar-thumb-gray-300">
                            {dayAppointments.map(appt => (
                                <div 
                                    key={appt.id}
                                    draggable
                                    onDragStart={(e) => {
                                        e.stopPropagation();
                                        onDragStart(e, appt);
                                    }}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedEvent(appt);
                                        setIsDetailsOpen(true);
                                    }}
                                    className={cn(
                                        "px-2 py-1.5 text-xs font-semibold rounded-md truncate cursor-pointer shadow-sm transition-all hover:-translate-y-[1px] flex flex-col xl:flex-row items-start xl:items-center gap-1 shrink-0 border-l-[3px]",
                                        getEventColor(appt.id), 
                                    )}
                                    title={`${format(parseISO(appt.start), 'HH:mm')} - ${appt.title}`}
                                >
                                    <Clock className="hidden xl:block h-3 w-3 shrink-0 opacity-50" />
                                    <span className="opacity-80 font-semibold text-[10px] xl:text-xs tracking-tight shrink-0">{format(parseISO(appt.start), 'HH:mm')}</span>
                                    <span className="truncate flex-1 font-semibold">{appt.title}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })
        )}
      </div>

      {/* Useful Info Block */}
      <div className="bg-emerald-50/50 border-t border-emerald-100/50 p-4 shrink-0 flex items-center justify-between">
         <div className="flex items-center gap-4">
             <div className="h-10 w-10 rounded-full bg-emerald-100/80 flex items-center justify-center shadow-sm">
                 <CalendarIcon className="h-5 w-5 text-emerald-600" />
             </div>
             <div>
                 <p className="text-sm font-bold text-emerald-900">Weekly Orthodontic Overview</p>
                 <p className="text-xs text-emerald-700 font-medium">
                     You have {appointments.filter(a => new Date(a.start) >= new Date() && new Date(a.start) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)).length} upcoming events in the next 7 days.
                 </p>
             </div>
         </div>
      </div>

      {/* Event Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
                <DialogTitle className="text-xl">Event Details</DialogTitle>
            </DialogHeader>
            {selectedEvent && (
                <div className="space-y-4 py-4">
                    <div>
                        <Label className="text-gray-500 text-xs uppercase tracking-wider font-bold">Title</Label>
                        <p className="text-lg font-semibold text-gray-900">{selectedEvent.title}</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                             <Label className="text-gray-500 text-xs uppercase tracking-wider font-bold">Start</Label>
                             <p className="font-medium">{format(parseISO(selectedEvent.start), "PP p")}</p>
                        </div>
                        <div>
                             <Label className="text-gray-500 text-xs uppercase tracking-wider font-bold">End</Label>
                             <p className="font-medium">{format(parseISO(selectedEvent.end), "PP p")}</p>
                        </div>
                    </div>
                    {selectedEvent.patient && (
                        <div>
                            <Label className="text-gray-500 text-xs uppercase tracking-wider font-bold">Patient</Label>
                            <p className="font-medium text-primary">{selectedEvent.patient.fullName}</p>
                        </div>
                    )}
                </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="destructive" onClick={handleDeleteEvent}>Delete</Button>
                <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

