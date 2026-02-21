"use client"; // This must be the very first line

import { useEffect, useState, useCallback, useRef } from "react"; // Import React hooks
import { PatientTable } from "@/components/features/patients/patient-table";
import { AddPatientDialog } from "@/components/features/patients/add-patient-dialog";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { UpcomingChangesList } from "@/components/features/dashboard/upcoming-changes-list";
import { PaginationControls } from "@/components/features/patients/pagination-controls";
import { API_URL } from "@/lib/utils";
import { Patient } from "@/lib/types";
import { Users, PauseCircle, CheckCircle2 } from "lucide-react";

export default function HomePage() {
  // Create a state variable to hold our list of patients
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ active: 0, paused: 0, finished: 0 });
  const [upcoming, setUpcoming] = useState([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);

  const isInitialMount = useRef(true);

  const fetchPatients = useCallback(async (page: number) => {
    try {
      const response = await fetch(
        `${API_URL}/patients?page=${page}&limit=10`
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
      const response = await fetch(`${API_URL}/patients/stats`);
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
        `${API_URL}/patients/upcoming?page=${page}&limit=5`
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
    // If it's the first render, do nothing, because the other useEffect handled it.
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // On all subsequent renders where currentPage changes, fetch the new page.
    fetchPatients(currentPage);
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
  return (
    <div>
      {/* Main Page Header */}
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dashboard</h1>
        {/* The "Add Patient" button could also live here */}
      </div>

      {/* Stat Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <StatCard 
          title="Active Patients" 
          value={stats.active} 
          icon={<Users className="w-6 h-6" />} 
          trend={{ value: 2, label: "this month", isPositive: true }}
        />
        <StatCard 
          title="Paused Patients" 
          value={stats.paused} 
          icon={<PauseCircle className="w-6 h-6" />} 
          trend={{ value: 0, label: "this month", isPositive: false }}
        />
        <StatCard 
          title="Finished Patients" 
          value={stats.finished} 
          icon={<CheckCircle2 className="w-6 h-6" />} 
          trend={{ value: 1, label: "this month", isPositive: true }}
        />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (takes up 2/3 of the space on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold">Patient List</h2>
            <div className="mr-2">
              <AddPatientDialog onPatientAdded={handleDataChange} />
            </div>
          </div>
          <div className="p-0 overflow-x-auto">
            <PatientTable patients={patients} onDataChange={handleDataChange} />
          </div>
          {totalPages > 1 && (
            <div className="p-4 border-t border-gray-100 bg-gray-50/30">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
        </div>

        {/* Right Column (takes up 1/3 of the space) */}
        <div className="space-y-6 bg-gray-50/50 rounded-2xl p-6 border border-gray-100/50 h-fit">
          <div>
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">Upcoming Changes</h2>
            <UpcomingChangesList
              patients={upcoming}
              currentPage={upcomingPage}
              totalPages={upcomingTotalPages}
              onPageChange={handleUpcomingPageChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
