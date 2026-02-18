// We'll define a more specific type for the data this component needs
import { PaginationControls } from "./pagination-controls";

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
      <ul className="space-y-4">
        {patients.map((patient) => (
          <li key={patient.id} className="flex items-center justify-between p-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors">
            <div>
              <p className="font-semibold text-gray-900">{patient.fullName}</p>
              <p className="text-xs text-gray-500 mt-0.5 font-medium uppercase tracking-wide">
                Now on Aligner #{patient.currentAligner}
              </p>
            </div>
            <div className="text-right">
              <p className="font-medium text-[#254F22]">
                {patient.daysUntilNextChange} day
                {patient.daysUntilNextChange !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(patient.nextChangeDate).toLocaleDateString()}
              </p>
            </div>
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
