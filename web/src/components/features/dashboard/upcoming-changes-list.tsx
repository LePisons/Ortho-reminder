// We'll define a more specific type for the data this component needs
import { PaginationControls } from "@/components/features/patients/pagination-controls";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

type UpcomingPatient = {
  id: string;
  fullName: string;
  nextChangeDate: Date;
  daysUntilNextChange: number;
  currentAligner: number;
};

interface UpcomingChangesListProps {
  patients: UpcomingPatient[];
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function UpcomingChangesList({
  patients,
  currentPage,
  totalPages,
  onPageChange,
}: UpcomingChangesListProps) {
  if (patients.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No upcoming changes for active patients.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-3">
        {patients.map((patient) => (
          <li key={patient.id}>
            <Link 
              href={`/patients/${patient.id}`}
              className="group flex flex-col md:flex-row md:items-center justify-between p-4 -mx-4 rounded-xl hover:bg-white transition-all border border-transparent hover:border-gray-100 hover:shadow-sm"
            >
              <div className="flex-1">
                <p className="font-bold text-gray-900 group-hover:text-[#254F22] transition-colors">{patient.fullName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="inline-flex items-center rounded-md bg-gray-50 px-2 py-1 text-xs font-semibold text-gray-600 ring-1 ring-inset ring-gray-500/10 uppercase tracking-wide">
                    Aligner #{patient.currentAligner}
                  </span>
                  <span className="text-sm font-medium text-amber-600/90 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                    Change in {patient.daysUntilNextChange} day{patient.daysUntilNextChange !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
              <div className="text-right mt-3 md:mt-0 flex items-center justify-end gap-4">
                <div className="flex flex-col items-end justify-center">
                  <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-0.5">Change Date</p>
                  <p className="text-xl font-black text-gray-900 tracking-tight">
                    {new Date(patient.nextChangeDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-gray-50 group-hover:bg-[#254F22]/10 flex items-center justify-center transition-colors">
                   <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-[#254F22]" />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
      {totalPages > 1 && (
        <div className="flex justify-center mt-4">
          {" "}
          {/* Centering wrapper */}
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={onPageChange}
          />
        </div>
      )}
    </>
  );
}
