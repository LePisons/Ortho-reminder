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
  const [stats, setStats] = useState({ active: 0, paused: 0, finished: 0 });
  const [upcoming, setUpcoming] = useState([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);

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
  const fetchStats = useCallback(async () => {
    try {
      const response = await fetch("http://localhost:3001/patients/stats");
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    }
  }, []);

  const fetchUpcoming = useCallback(async (page: number) => {
    try {
      // Call the new /patients/upcoming endpoint
      const response = await fetch(
        `http://localhost:3001/patients/upcoming?page=${page}&limit=5`
      );
      const result = await response.json();

      setUpcoming(result.data);
      setUpcomingTotalPages(result.totalPages);
      setUpcomingPage(result.page);
    } catch (error) {
      console.error("Failed to fetch upcoming changes:", error);
    }
  }, []);

  // This useEffect for fetching patients remains separate
  useEffect(() => {
    fetchStats();
    fetchPatients(1);
    fetchUpcoming(1); // Always fetch the first page on initial load
  }, [fetchStats, fetchPatients, fetchUpcoming]); // This runs once because the functions don't

  useEffect(() => {
    if (currentPage > 1) {
      fetchPatients(currentPage);
    }
  }, [currentPage, fetchPatients]);
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleDataChange = () => {
    fetchStats();
    fetchUpcoming(1); // <-- ADD THIS LINE TO REFRESH STATS

    if (currentPage === 1) {
      fetchPatients(1);
    } else {
      setCurrentPage(1);
    }
  };
  const handleUpcomingPageChange = (newPage: number) => {
    // We don't need to set state here because fetchUpcoming does it
    fetchUpcoming(newPage);
  };
  // Calcula fecha y número de los próximos alineadores
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
        <StatCard title="Active Patients" value={stats.active} />
        <StatCard title="Paused Patients" value={stats.paused} />
        <StatCard title="Finished Patients" value={stats.finished} />
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

            <UpcomingChangesList
              patients={upcoming}
              currentPage={upcomingPage}
              totalPages={upcomingTotalPages}
              onPageChange={handleUpcomingPageChange}
            />
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
