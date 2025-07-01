// We'll define a more specific type for the data this component needs
type UpcomingPatient = {
  id: string;
  fullName: string;
  nextChangeDate: Date;
  daysUntilNextChange: number;
  currentAligner: number;
};

interface UpcomingChangesListProps {
  patients: UpcomingPatient[];
}

export function UpcomingChangesList({ patients }: UpcomingChangesListProps) {
  if (patients.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No upcoming changes for active patients.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {patients.map((patient) => (
        <li key={patient.id} className="flex items-center justify-between">
          <div>
            <p className="font-semibold">{patient.fullName}</p>
            <p className="text-xs text-gray-500">
              Now on Aligner #{patient.currentAligner}
            </p>
          </div>
          <div className="text-right">
            <p className="font-medium">
              {patient.daysUntilNextChange} day
              {patient.daysUntilNextChange !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-gray-400">
              {patient.nextChangeDate.toLocaleDateString()}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
