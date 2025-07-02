"use client"; // This must be the very first line

import { useEffect, useState, useCallback } from "react"; // Import React hooks
import { PatientTable } from "@/components/patient-table";
import { AddPatientDialog } from "@/components/add-patient-dialog";
import { StatCard } from "@/components/stat-card";
import { UpcomingChangesList } from "@/components/upcoming-changes-list";
import { PaginationControls } from "@/components/pagination-controls";
// We define a Type for our patient data to make our code safer
export type Patient = {
  id: string;
  rut: string;
  fullName: string;
  phone: string;
  email: string;
  treatmentStartDate: string;
  changeFrequency: number;
  status: "ACTIVE" | "PAUSED" | "FINISHED";
};

export default function HomePage() {
  // Create a state variable to hold our list of patients
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchPatients = useCallback(async (page: number) => {
    try {
      const response = await fetch(
        `http://localhost:3001/patients?page=${page}&limit=10`
      );
      const result = await response.json(); // <--- Corrected line
      setPatients(result.data);
      setTotalPages(result.totalPages);
      setCurrentPage(result.page);
    } catch (error) {
      console.error("Failed to fetch patients:", error);
    }
  }, []);
  useEffect(() => {
    fetchPatients(currentPage);
  }, [currentPage, fetchPatients]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleDataChange = () => {
    // When data changes (add, edit, delete), always go back to page 1
    // and re-fetch the data.
    if (currentPage === 1) {
      fetchPatients(1);
    } else {
      setCurrentPage(1);
    }
  };

  // Calcula fecha y número de los próximos alineadores

  const upcomingChanges = patients
    .filter((p) => p.status === "ACTIVE") // Only consider active patients
    .map((patient) => {
      const startDate = new Date(patient.treatmentStartDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Normalize today's date to the start of the day

      const timeDiff = today.getTime() - startDate.getTime();
      const daysSinceStart = Math.floor(timeDiff / (1000 * 3600 * 24));

      const remainder = daysSinceStart % patient.changeFrequency;
      const daysUntilNextChange = patient.changeFrequency - remainder;

      const nextChangeDate = new Date(today);
      nextChangeDate.setDate(today.getDate() + daysUntilNextChange);

      const currentAligner =
        Math.floor(daysSinceStart / patient.changeFrequency) + 1;

      return {
        ...patient,
        nextChangeDate,
        daysUntilNextChange,
        currentAligner,
      };
    })
    .sort((a, b) => a.daysUntilNextChange - b.daysUntilNextChange) // Sort by closest change
    .slice(0, 5); // Only show the top 5

  const activePatients = patients.filter((p) => p.status === "ACTIVE").length;

  return (
    <div>
      {/* Main Page Header */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        {/* The "Add Patient" button could also live here */}
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard title="Active Patients" value={activePatients} />
        <StatCard
          title="Paused Patients"
          value={patients.filter((p) => p.status === "PAUSED").length}
        />
        <StatCard
          title="Finished Patients"
          value={patients.filter((p) => p.status === "FINISHED").length}
        />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (takes up 2/3 of the space on large screens) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Patient List</h2>
            <AddPatientDialog onPatientAdded={handleDataChange} />
          </div>
          <PatientTable patients={patients} onDataChange={handleDataChange} />
          <PaginationControls
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right Column (takes up 1/3 of the space) */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Upcoming Changes</h2>

            <UpcomingChangesList patients={upcomingChanges} />
          </div>
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold mb-4">Activity Feed</h2>
            <p className="text-gray-500">Feature coming soon...</p>
          </div>
        </div>
      </div>
    </div>
  );
}
