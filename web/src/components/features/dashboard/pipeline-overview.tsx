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
    subtitle: "Awaiting scan",
    icon: Clock,
    topBorder: "#C2810A",
    iconBg: "#FBF1DC",
    color: "#C2810A",
    dotColor: "bg-[#C2810A]",
  },
  {
    id: "IN_PRODUCTION",
    title: "In Production",
    subtitle: "Being made",
    icon: Box,
    topBorder: "#A066F8",
    iconBg: "#F3EAFE",
    color: "#8a44e8",
    dotColor: "bg-[#8a44e8]",
  },
  {
    id: "READY_FOR_PICKUP",
    title: "Ready",
    subtitle: "To deliver",
    icon: ShieldCheck,
    topBorder: "#1F9254",
    iconBg: "#E6F4EC",
    color: "#1F9254",
    dotColor: "bg-[#1F9254]",
  },
  {
    id: "IN_TREATMENT",
    title: "In Treatment",
    subtitle: "Wearing now",
    icon: User,
    topBorder: "#6469FC",
    iconBg: "#ECECFE",
    color: "#5a5ff2",
    dotColor: "bg-[#5a5ff2]",
  },
  {
    id: "ENDING_SOON",
    title: "Ending Soon",
    subtitle: "Final stage",
    icon: AlertCircle,
    topBorder: "#D6443B",
    iconBg: "#FBE9E9",
    color: "#D6443B",
    dotColor: "bg-[#D6443B]",
  },
  {
    id: "REEVALUATION",
    title: "Re-Eval",
    subtitle: "Needs review",
    icon: ShieldCheck,
    topBorder: "#0E9AA0",
    iconBg: "#E2F4F4",
    color: "#0E9AA0",
    dotColor: "bg-[#0E9AA0]",
  },
];

export function PipelineOverview({ data }: { data: PipelineData | null }) {
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
      {stages.map((stage) => {
        const patients = data[stage.id as keyof PipelineData] || [];
        const Icon = stage.icon;
        const count = patients.length;

        return (
          <Link
            key={stage.id}
            href="/pipeline"
            style={{ borderTopColor: stage.topBorder }}
            className="group bg-white border border-[#EBE7DE] border-t-[3px] rounded-2xl p-4 flex flex-col gap-3.5 shadow-[0_1px_2px_rgba(27,27,27,0.04)] transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5"
          >
            {/* Header with icon + count */}
            <div className="flex items-center justify-between">
              <div
                className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center"
                style={{ backgroundColor: stage.iconBg, color: stage.color }}
              >
                <Icon className="w-[17px] h-[17px]" />
              </div>
              <span
                className="text-[28px] font-extrabold leading-none tracking-tight"
                style={{ color: stage.color }}
              >
                {count}
              </span>
            </div>

            {/* Stage name + subtitle */}
            <div>
              <p className="text-[13px] font-bold text-[#1B1B1B]">{stage.title}</p>
              <p className="text-[11.5px] text-[#9a9aa2] mt-0.5">{stage.subtitle}</p>
            </div>

            {/* Top patient names */}
            {count > 0 && (
              <div className="space-y-1 pt-1 border-t border-[#F4F1EA]">
                {patients.slice(0, 3).map((patient) => (
                  <div key={patient.id} className="flex items-center gap-1.5">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${stage.dotColor} shrink-0`}
                    />
                    <span className="text-[11px] text-[#6b6b73] truncate font-medium">
                      {patient.fullName.split(" ")[0]}{" "}
                      {patient.fullName.split(" ")[1]?.[0]
                        ? patient.fullName.split(" ")[1][0] + "."
                        : ""}
                    </span>
                  </div>
                ))}
                {count > 3 && (
                  <p className="text-[10px] text-[#9a9aa2] font-medium pl-3">
                    +{count - 3} more
                  </p>
                )}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
