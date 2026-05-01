"use client";

import Link from "next/link";
import { User, AlertCircle, Clock, Box, ShieldCheck } from "lucide-react";

interface PipelinePatient {
  id: string;
  fullName: string;
  currentAligner?: number;
  totalAligners?: number;
  urgencyStatus?: string;
}

interface PipelineData {
  REQUIRED_FILES: PipelinePatient[];
  IN_PRODUCTION: PipelinePatient[];
  READY_FOR_PICKUP: PipelinePatient[];
  IN_TREATMENT: PipelinePatient[];
  ENDING_SOON: PipelinePatient[];
  REEVALUATION: PipelinePatient[];
}

const stages = [
  {
    id: "REQUIRED_FILES",
    title: "Pending Files",
    icon: AlertCircle,
    gradient: "from-amber-500 to-orange-500",
    bg: "bg-amber-50",
    ring: "ring-amber-200",
    textColor: "text-amber-700",
    dotColor: "bg-amber-400",
  },
  {
    id: "IN_PRODUCTION",
    title: "In Production",
    icon: Clock,
    gradient: "from-violet-500 to-purple-600",
    bg: "bg-violet-50",
    ring: "ring-violet-200",
    textColor: "text-violet-700",
    dotColor: "bg-violet-400",
  },
  {
    id: "READY_FOR_PICKUP",
    title: "Ready",
    icon: Box,
    gradient: "from-emerald-500 to-green-600",
    bg: "bg-emerald-50",
    ring: "ring-emerald-200",
    textColor: "text-emerald-700",
    dotColor: "bg-emerald-400",
  },
  {
    id: "IN_TREATMENT",
    title: "In Treatment",
    icon: User,
    gradient: "from-blue-500 to-cyan-600",
    bg: "bg-blue-50",
    ring: "ring-blue-200",
    textColor: "text-blue-700",
    dotColor: "bg-blue-400",
  },
  {
    id: "ENDING_SOON",
    title: "Ending Soon",
    icon: AlertCircle,
    gradient: "from-rose-500 to-red-600",
    bg: "bg-rose-50",
    ring: "ring-rose-200",
    textColor: "text-rose-700",
    dotColor: "bg-rose-400",
  },
  {
    id: "REEVALUATION",
    title: "Re-eval",
    icon: ShieldCheck,
    gradient: "from-teal-500 to-cyan-600",
    bg: "bg-teal-50",
    ring: "ring-teal-200",
    textColor: "text-teal-700",
    dotColor: "bg-teal-400",
  },
];

export function PipelineOverview({ data }: { data: PipelineData | null }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {stages.map((stage) => {
        const patients = data[stage.id as keyof PipelineData] || [];
        const Icon = stage.icon;
        const count = patients.length;

        return (
          <Link
            key={stage.id}
            href="/pipeline"
            className={`group relative rounded-2xl border ${stage.bg} ring-1 ${stage.ring} p-4 transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer overflow-hidden`}
          >
            {/* Decorative gradient bar */}
            <div
              className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stage.gradient} opacity-80`}
            />

            {/* Header with icon + count */}
            <div className="flex items-center justify-between mb-3 mt-1">
              <div
                className={`w-8 h-8 rounded-xl bg-gradient-to-br ${stage.gradient} flex items-center justify-center shadow-sm`}
              >
                <Icon className="w-4 h-4 text-white" />
              </div>
              <span
                className={`text-2xl font-black ${stage.textColor} tracking-tight`}
              >
                {count}
              </span>
            </div>

            {/* Stage name */}
            <p
              className={`text-xs font-bold ${stage.textColor} mb-2.5 tracking-wide uppercase`}
            >
              {stage.title}
            </p>

            {/* Top 3 patient names */}
            <div className="space-y-1">
              {patients.slice(0, 3).map((patient) => (
                <div
                  key={patient.id}
                  className="flex items-center gap-1.5"
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${stage.dotColor} shrink-0`}
                  />
                  <span className="text-[11px] text-gray-600 truncate font-medium">
                    {patient.fullName.split(" ")[0]}{" "}
                    {patient.fullName.split(" ")[1]?.[0]
                      ? patient.fullName.split(" ")[1][0] + "."
                      : ""}
                  </span>
                </div>
              ))}
              {count > 3 && (
                <p className="text-[10px] text-gray-400 font-medium pl-3">
                  +{count - 3} more
                </p>
              )}
              {count === 0 && (
                <p className="text-[10px] text-gray-400 italic">
                  No patients
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
