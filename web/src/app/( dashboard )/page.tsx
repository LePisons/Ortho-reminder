"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { PatientTable } from "@/components/features/patients/patient-table";
import { AddPatientDialog } from "@/components/features/patients/add-patient-dialog";
import { StatCard } from "@/components/features/dashboard/stat-card";
import { UpcomingChangesList } from "@/components/features/dashboard/upcoming-changes-list";
import { PipelineOverview } from "@/components/features/dashboard/pipeline-overview";
import { PaginationControls } from "@/components/features/patients/pagination-controls";
import { API_URL } from "@/lib/utils";
import { Patient } from "@/lib/types";
import { Users, PauseCircle, CheckCircle2, AlertTriangle, Activity } from "lucide-react";

export default function HomePage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ active: 0, paused: 0, finished: 0 });
  const [upcoming, setUpcoming] = useState([]);
  const [upcomingPage, setUpcomingPage] = useState(1);
  const [upcomingTotalPages, setUpcomingTotalPages] = useState(1);
  const [pipelineData, setPipelineData] = useState(null);

  const isInitialMount = useRef(true);

  const fetchPatients = useCallback(async (page: number) => {
    try {
      const response = await fetch(`${API_URL}/patients?page=${page}&limit=10`);
      const result = await response.json();
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

  const fetchPipeline = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/patients/pipeline`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = await response.json();
        setPipelineData(data);
      }
    } catch (error) {
      console.error("Failed to fetch pipeline:", error);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchPatients(1);
    fetchUpcoming(1);
    fetchPipeline();
  }, [fetchStats, fetchPatients, fetchUpcoming, fetchPipeline]);

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    fetchPatients(currentPage);
  }, [currentPage, fetchPatients]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
  };

  const handleDataChange = () => {
    fetchStats();
    fetchUpcoming(1);
    fetchPipeline();
    if (currentPage === 1) {
      fetchPatients(1);
    } else {
      setCurrentPage(1);
    }
  };

  const handleUpcomingPageChange = (newPage: number) => {
    fetchUpcoming(newPage);
  };

  // Calculate urgent count from pipeline data
  const urgentCount = pipelineData
    ? (pipelineData as Record<string, unknown[]>)["ENDING_SOON"]?.length +
      (pipelineData as Record<string, unknown[]>)["REQUIRED_FILES"]?.length +
      (pipelineData as Record<string, unknown[]>)["REEVALUATION"]?.length
    : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Dashboard
          </h1>
          <p className="text-gray-500 mt-1">
            Your practice at a glance
          </p>
        </div>
        <AddPatientDialog onPatientAdded={handleDataChange} />
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Active Patients"
          value={stats.active}
          icon={<Users className="w-5 h-5" />}
          variant="primary"
        />
        <StatCard
          title="Needs Attention"
          value={urgentCount}
          icon={<AlertTriangle className="w-5 h-5" />}
          variant="danger"
        />
        <StatCard
          title="Paused"
          value={stats.paused}
          icon={<PauseCircle className="w-5 h-5" />}
          variant="warning"
        />
        <StatCard
          title="Completed"
          value={stats.finished}
          icon={<CheckCircle2 className="w-5 h-5" />}
          variant="success"
        />
      </div>

      {/* Pipeline Overview */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-gray-400" />
          <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider">
            Patient Pipeline
          </h2>
        </div>
        <PipelineOverview data={pipelineData} />
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Patient List */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
          <div className="flex justify-between items-center p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold">Patient List</h2>
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

        {/* Upcoming Changes */}
        <div className="space-y-6 bg-gray-50/50 rounded-2xl p-6 border border-gray-100/50 h-fit">
          <div>
            <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
              Upcoming Changes
            </h2>
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
