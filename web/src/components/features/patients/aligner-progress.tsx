"use client";

import { Patient } from "@/lib/types";
import { format, addDays } from "date-fns";
import { Calendar, Clock, AlertCircle, CheckCircle2 } from "lucide-react";

interface AlignerProgressProps {
  patient: Patient;
}

export function AlignerProgress({ patient }: AlignerProgressProps) {
  const { totalAligners = 0, currentAligner = 1, wearDaysPerAligner = 14, urgencyStatus } = patient;

  if (totalAligners === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border p-6 flex items-center justify-center text-center h-32">
        <div className="text-gray-400 font-medium flex flex-col items-center gap-2">
          <AlertCircle className="w-6 h-6" />
          Treatment plan not configured
        </div>
      </div>
    );
  }

  const today = new Date();

  // The remaining tracking should dynamically reflect exactly where they are currently
  // We add +1 because they still need to complete the *current* aligner
  const alignersRemaining = Math.max(0, totalAligners - currentAligner + 1);
  const daysRemaining = alignersRemaining * wearDaysPerAligner;
  
  const predictedEnd = addDays(today, daysRemaining);

  const getUrgencyBadge = () => {
    switch (urgencyStatus) {
      case "ENDING_SOON":
        return <span className="bg-amber-100 text-amber-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">ENDING SOON</span>;
      case "OVERDUE":
        return <span className="bg-rose-100 text-rose-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">OVERDUE</span>;
      case "AWAITING_REEVALUATION":
        return <span className="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">AWAITING REEVALUATION</span>;
      case "ON_TRACK":
      default:
        return <span className="bg-emerald-100 text-emerald-800 px-3 py-1 rounded-full text-xs font-bold tracking-wide">ON TRACK</span>;
    }
  };

  const currentPercent = Math.min(100, Math.round((currentAligner / totalAligners) * 100));

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-primary" />
          Aligner Progress
        </h3>
        {getUrgencyBadge()}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4">
          <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Current Step</p>
              <p className="text-xl font-bold text-gray-900">{currentAligner} <span className="text-sm font-medium text-gray-500">of {totalAligners}</span></p>
          </div>
          <div>
              <p className="text-xs text-gray-500 uppercase font-semibold">Wear Time</p>
              <p className="text-xl font-bold text-gray-900">{wearDaysPerAligner} <span className="text-sm font-medium text-gray-500">days/pair</span></p>
          </div>
          <div>
              <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Predicted End</p>
              <p className="text-xl font-bold text-gray-900">{format(predictedEnd, "MMM d, yyyy")}</p>
          </div>
          <div>
              <p className="text-xs text-gray-500 uppercase font-semibold flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> Time Remaining</p>
              <p className="text-xl font-bold text-gray-900">{daysRemaining} <span className="text-sm font-medium text-gray-500">days</span></p>
          </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-xs font-bold text-gray-400">
            <span>Start</span>
            <span>{currentPercent}% Complete</span>
            <span>Finish</span>
        </div>
        <div className="h-4 bg-gray-100 rounded-full overflow-hidden flex">
             <div 
                className="h-full bg-primary transition-all duration-1000 ease-out"
                style={{ width: `${currentPercent}%` }}
             />
        </div>
      </div>
    </div>
  );
}
