"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/utils";
import { Patient, AlignerBatch } from "@/lib/types";
import { PatientInfoCard } from "@/components/features/patients/patient-info-card";
import { PatientSummaryCard } from "@/components/features/patients/patient-summary-card";
import { AlignerProgress } from "@/components/features/patients/aligner-progress";
import { ClinicalTab } from "@/components/features/clinical/clinical-tab";
import { ImagesTab } from "@/components/features/clinical/images-tab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs-simple";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { NotesPanel } from "@/components/features/dashboard/notes-panel";
import { BatchLifecycleTracker } from "@/components/features/patients/batch-lifecycle-tracker";
import { ReevaluationTracker } from "@/components/features/patients/reevaluation-tracker";

export default function PatientDetailsPage() {
  const params = useParams();
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const defaultTab = searchParams?.get("tab") || "clinical";
  
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPatient = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/patients/${id}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch patient");
      const data = await response.json();
      setPatient(data);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load patient data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchPatient();
    }
  }, [id, fetchPatient]);

  const handleStatusChange = async (batchId: string, action: string, payload?: unknown) => {
    try {
      const response = await fetch(`${API_URL}/aligner-batches/${batchId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        credentials: "include",
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.message || "Failed to transition batch status");
      }
      toast.success("Batch status updated");
      fetchPatient(); // Reload patient data including their batches
    } catch (error: Error | unknown) {
      console.error(error);
      toast.error((error as Error).message);
    }
  };

  const handleCreateBatch = async () => {
    try {
      const response = await fetch(`${API_URL}/aligner-batches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: id, alignerCount: patient?.totalAligners || 0 }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to create batch");
      toast.success("New batch started");
      fetchPatient();
    } catch (error: Error | unknown) {
      console.error(error);
      toast.error((error as Error).message);
    }
  };

  const handleReevalStatusChange = async (reevalId: string, action: string, payload?: unknown) => {
    try {
      const url = action === 'approve' 
        ? `${API_URL}/reevaluations/${reevalId}/approve`
        : `${API_URL}/reevaluations/${reevalId}/${action}`;

      const response = await fetch(url, {
        method: action === 'approve' ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to update re-evaluation");
      toast.success("Re-evaluation updated");
      fetchPatient();
    } catch (error: Error | unknown) {
      console.error(error);
      toast.error((error as Error).message);
    }
  };

  const handleCreateReeval = async () => {
    try {
      const response = await fetch(`${API_URL}/reevaluations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId: id }),
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to request re-evaluation");
      toast.success("Re-evaluation requested");
      fetchPatient();
    } catch (error: Error | unknown) {
      console.error(error);
      toast.error((error as Error).message);
    }
  };

  const getUploadUrl = async (reevalId: string) => {
    const response = await fetch(`${API_URL}/reevaluations/${reevalId}/upload-url`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to secure presigned upload url");
    return response.json();
  };

  const getBatchUploadUrl = async (batchId: string) => {
    const response = await fetch(`${API_URL}/aligner-batches/${batchId}/generate-upload-url`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to secure presigned upload url");
    return response.json();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-full">Loading...</div>;
  }

  if (!patient) {
    return <div className="text-center py-10">Patient not found</div>;
  }

  return (
    <div className="w-full max-w-none space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        {/* Main Content */}
        <div className="xl:col-span-3 space-y-6">
          <PatientInfoCard patient={patient} onUpdate={fetchPatient} />

          {/* Aligner Tracking Progress */}
          <AlignerProgress patient={patient} onUpdate={fetchPatient} />

          {/* Clinical Summary — editable, always visible at the top */}
          <PatientSummaryCard patient={patient} onUpdate={fetchPatient} />

          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="clinical">Clinical History</TabsTrigger>
              <TabsTrigger value="batch">Lab Pipeline</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="xrays">X-Rays</TabsTrigger>
            </TabsList>
            <TabsContent value="clinical">
              <ClinicalTab
                patientId={patient.id}
                records={patient.clinicalRecords || []}
                onUpdate={fetchPatient}
              />
            </TabsContent>
            <TabsContent value="batch" className="space-y-6 mt-6">
              <BatchLifecycleTracker 
                patientId={patient.id}
                batch={(patient.alignerBatches || []).find((b: AlignerBatch) => !['DELIVERED_TO_CLINIC', 'HANDED_TO_PATIENT', 'CANCELLED'].includes(b.status))}
                onStatusChange={handleStatusChange}
                onCreateBatch={handleCreateBatch}
                generateUploadUrl={getBatchUploadUrl}
              />
              {patient.reevaluations && patient.reevaluations.length > 0 && (
                <ReevaluationTracker
                  patientId={patient.id}
                  reevaluation={patient.reevaluations[0]} // most recent
                  onStatusChange={handleReevalStatusChange}
                  onCreateReevaluation={handleCreateReeval}
                  generateUploadUrl={getUploadUrl}
                />
              )}
              {(!patient.reevaluations || patient.reevaluations.length === 0) && patient.alignerBatches && patient.alignerBatches.some(b => b.status === 'HANDED_TO_PATIENT') && (
                 <ReevaluationTracker
                   patientId={patient.id}
                   onStatusChange={handleReevalStatusChange}
                   onCreateReevaluation={handleCreateReeval}
                   generateUploadUrl={getUploadUrl}
                 />
              )}

              {/* Batch History */}
              {patient.alignerBatches && patient.alignerBatches.some(b => ['HANDED_TO_PATIENT', 'CANCELLED'].includes(b.status)) && (
                <div className="pt-8">
                  <h3 className="text-lg font-bold mb-4">Batch History</h3>
                  <div className="space-y-4">
                    {patient.alignerBatches
                      .filter(b => ['HANDED_TO_PATIENT', 'CANCELLED'].includes(b.status))
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((historicalBatch) => (
                        <Card key={historicalBatch.id} className="bg-gray-50/50">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div>
                              <p className="font-semibold">Batch #{historicalBatch.batchNumber}</p>
                              <p className="text-sm text-gray-500">
                                {historicalBatch.alignerCount} Aligners • Delivered {historicalBatch.actualDeliveryDate ? new Date(historicalBatch.actualDeliveryDate).toLocaleDateString() : 'Unknown Data'}
                              </p>
                            </div>
                            <Badge variant={historicalBatch.status === 'HANDED_TO_PATIENT' ? 'default' : 'destructive'}>
                               {historicalBatch.status === 'HANDED_TO_PATIENT' ? 'Completed' : 'Cancelled'}
                            </Badge>
                          </CardContent>
                        </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>
            <TabsContent value="photos">
              <ImagesTab
                patientId={patient.id}
                images={patient.patientImages || []}
                type="PHOTO"
                onUpdate={fetchPatient}
              />
            </TabsContent>
            <TabsContent value="xrays">
              <ImagesTab
                patientId={patient.id}
                images={patient.patientImages || []}
                type="XRAY"
                onUpdate={fetchPatient}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Notes Panel - Side Column */}
        <div className="xl:col-span-1">
          <div className="sticky top-6 bg-white rounded-xl shadow-sm border overflow-hidden h-[calc(100vh-120px)]">
            <NotesPanel patientId={patient.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
