"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { API_URL } from "@/lib/utils";
import { Patient } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, ArrowRight, Clock, User, AlertCircle, Box, Upload, ShieldCheck } from "lucide-react";

interface PipelineData {
  REQUIRED_FILES: Patient[];
  IN_PRODUCTION: Patient[];
  READY_FOR_PICKUP: Patient[];
  IN_TREATMENT: Patient[];
  ENDING_SOON: Patient[];
  REEVALUATION: Patient[];
}

export default function PipelinePage() {
  const [data, setData] = useState<PipelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/patients/pipeline`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to fetch pipeline data");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error(error);
      toast.error("Failed to load pipeline data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleBatchAction = async (batchId: string, action: string, payload?: unknown) => {
    setActionLoading(batchId);
    try {
      const response = await fetch(`${API_URL}/aligner-batches/${batchId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload ? JSON.stringify(payload) : undefined,
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || "Failed to update batch status");
      }
      toast.success("Batch status updated");
      fetchData();
    } catch (error: Error | unknown) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReevalAction = async (reevalId: string, action: string) => {
    setActionLoading(reevalId);
    try {
      const response = await fetch(`${API_URL}/reevaluations/${reevalId}/${action}`, {
        method: "POST",
        credentials: "include",
      });
      if (!response.ok) {
        const err = await response.json().catch(() => null);
        throw new Error(err?.message || "Failed to update re-evaluation status");
      }
      toast.success("Re-evaluation updated");
      fetchData();
    } catch (error: Error | unknown) {
      toast.error((error as Error).message);
    } finally {
      setActionLoading(null);
    }
  };

  const getBatchUploadUrl = async (batchId: string) => {
    const response = await fetch(`${API_URL}/aligner-batches/${batchId}/generate-upload-url`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) throw new Error("Failed to secure presigned upload url");
    return response.json();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, batchId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Only .zip files are allowed for .goo prints');
      return;
    }

    setActionLoading(`upload-${batchId}`);
    const toastId = toast.loading('Preparing upload...');
    
    try {
      const { uploadUrl, key } = await getBatchUploadUrl(batchId);
      
      toast.loading('Uploading print files securely...', { id: toastId });

      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/zip',
        },
      });

      if (!uploadRes.ok) throw new Error('Failed to upload file to storage provider');

      toast.loading('Confirming upload...', { id: toastId });
      const publicUrl = `https://storage.orthoreminder.com/${key}`;

      await handleBatchAction(batchId, 'confirm-upload', { fileUrl: publicUrl, key });
      
      toast.success('Files uploaded successfully! Lab order sent.', { id: toastId });
    } catch (error: Error | unknown) {
      console.error('Upload Error:', error);
      toast.error((error as Error).message || 'Error occurred during upload', { id: toastId });
    } finally {
      setActionLoading(null);
      e.target.value = ''; // Reset input
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  const columns = [
    {
      id: "REQUIRED_FILES",
      title: "Required Files",
      icon: <AlertCircle className="w-5 h-5 text-amber-500" />,
      color: "border-amber-200 bg-amber-50/30",
    },
    {
      id: "IN_PRODUCTION",
      title: "In Production",
      icon: <Clock className="w-5 h-5 text-purple-500" />,
      color: "border-purple-200 bg-purple-50/30",
    },
    {
      id: "READY_FOR_PICKUP",
      title: "Ready for Pickup",
      icon: <Box className="w-5 h-5 text-green-500" />,
      color: "border-green-200 bg-green-50/30",
    },
    {
      id: "IN_TREATMENT",
      title: "In Treatment",
      icon: <User className="w-5 h-5 text-blue-500" />,
      color: "border-blue-200 bg-blue-50/30",
    },
    {
      id: "ENDING_SOON",
      title: "Ending Soon / Overdue",
      icon: <AlertCircle className="w-5 h-5 text-red-500" />,
      color: "border-red-200 bg-red-50/30",
    },
    {
      id: "REEVALUATION",
      title: "Re-evaluation",
      icon: <ShieldCheck className="w-5 h-5 text-teal-500" />,
      color: "border-teal-200 bg-teal-50/30",
    },
  ];

  return (
    <div className="space-y-6 h-full flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Lab Pipeline</h1>
        <p className="text-gray-500 text-sm">Track active lab orders and aligner endpoints</p>
      </div>

      <div className="flex gap-6 h-[calc(100vh-180px)] overflow-hidden">
        {/* Main Pipeline Stages (Left Side) */}
        <div className="flex-1 flex gap-6 overflow-x-auto pb-6 h-full">
          {columns.map((col) => {
            const columnData = data?.[col.id as keyof PipelineData] || [];
            
            return (
              <div 
                key={col.id} 
                className={`flex-shrink-0 w-80 rounded-xl border ${col.color} flex flex-col h-full`}
              >
                <div className="p-4 border-b border-gray-200/50 bg-white/50 rounded-t-xl shrink-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {col.icon}
                      <h3 className="font-semibold text-gray-900">{col.title}</h3>
                    </div>
                    <Badge variant="secondary" className="bg-white">
                      {columnData.length}
                    </Badge>
                  </div>
                </div>

                <div className="p-4 flex-1 overflow-y-auto space-y-3">
                  {columnData.map((patient) => {
                    const activeBatch = patient.alignerBatches?.[0];
                    const activeReeval = patient.reevaluations?.[0];

                    return (
                      <Card key={patient.id} className="shadow-sm hover:shadow-md transition-shadow bg-white">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <Link 
                              href={`/patients/${patient.id}`} 
                              className="font-medium text-gray-900 hover:text-primary hover:underline flex items-center gap-1.5"
                            >
                              <User className="w-3.5 h-3.5" />
                              {patient.fullName}
                            </Link>
                          </div>
                          
                          {/* Status Context Indicator */}
                          <div className="text-xs text-gray-500 mb-4 h-8">
                            {col.id === 'ENDING_SOON' && (
                              <span>
                                {patient.urgencyStatus === 'OVERDUE' 
                                  ? <span className="text-red-500 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Overdue</span> 
                                  : <span>Ending treatment soon</span>}
                              </span>
                            )}
                            {activeBatch && col.id !== 'ENDING_SOON' && col.id !== 'REEVALUATION' && (
                              <span>Batch #{activeBatch.batchNumber} ({activeBatch.alignerCount} aligners)</span>
                            )}
                            {activeReeval && col.id === 'REEVALUATION' && (
                              <span className="flex items-center gap-1">
                                Status: {activeReeval.status.replace('_', ' ')}
                              </span>
                            )}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex justify-end gap-2 border-t pt-3 border-gray-100 mt-2">
                            {col.id === 'REQUIRED_FILES' && (
                              <div className="w-full flex gap-2">
                                {activeBatch ? (
                                  <>
                                    <input 
                                      type="file" 
                                      accept=".zip" 
                                      className="hidden" 
                                      id={`upload-${activeBatch.id}`}
                                      onChange={(e) => handleFileUpload(e, activeBatch.id)}
                                      disabled={actionLoading === `upload-${activeBatch.id}`}
                                    />
                                    <Button 
                                      size="sm"
                                      onClick={() => document.getElementById(`upload-${activeBatch.id}`)?.click()}
                                      disabled={actionLoading === `upload-${activeBatch.id}`}
                                      className="w-full text-xs h-8 bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      {actionLoading === `upload-${activeBatch.id}` ? <Loader2 className="w-3 h-3 animate-spin"/> : <><Upload className="w-3 h-3 mr-1" /> Upload Prints (.zip)</>}
                                    </Button>
                                  </>
                                ) : (
                                  <Link href={`/patients/${patient.id}?tab=batch`} className="w-full">
                                    <Button size="sm" className="w-full text-xs h-8" variant="secondary">
                                      Create Batch
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            )}

                            {col.id === 'IN_PRODUCTION' && activeBatch && (
                              <Button 
                                size="sm" 
                                variant="outline"
                                onClick={() => handleBatchAction(activeBatch.id, 'mark-delivered', {
                                  actualDeliveryDate: new Date().toISOString()
                                })}
                                disabled={actionLoading === activeBatch.id}
                                className="w-full text-xs h-8"
                              >
                                {actionLoading === activeBatch.id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Receive at Clinic'}
                              </Button>
                            )}

                            {col.id === 'READY_FOR_PICKUP' && activeBatch && (
                              <Button 
                                size="sm" 
                                onClick={() => handleBatchAction(activeBatch.id, 'hand-to-patient')}
                                disabled={actionLoading === activeBatch.id}
                                className="w-full text-xs h-8"
                              >
                                {actionLoading === activeBatch.id ? <Loader2 className="w-3 h-3 animate-spin"/> : 'Hand to Patient'}
                              </Button>
                            )}

                            {col.id === 'IN_TREATMENT' && (
                              <div className="w-full text-xs text-gray-500 text-center py-1 bg-gray-50 rounded">
                                Actively wearing aligners
                              </div>
                            )}

                            {col.id === 'ENDING_SOON' && (
                              <Link href={`/patients/${patient.id}?tab=batch`} className="w-full">
                                <Button size="sm" className="w-full text-xs h-8" variant="secondary">
                                  Go to Profile <ArrowRight className="w-3 h-3 ml-1" />
                                </Button>
                              </Link>
                            )}

                            {col.id === 'REEVALUATION' && activeReeval && (
                              <>
                                {activeReeval.status === 'NEEDED' && (
                                  <Link href={`/patients/${patient.id}?tab=batch`} className="w-full">
                                    <Button size="sm" className="w-full text-xs h-8" variant="outline">
                                      <Upload className="w-3 h-3 mr-1" /> Upload Scan
                                    </Button>
                                  </Link>
                                )}
                                {activeReeval.status === 'SCAN_UPLOADED' && (
                                  <Button 
                                    size="sm" 
                                    className="w-full text-xs h-8 bg-green-600 hover:bg-green-700 text-white"
                                    onClick={() => handleReevalAction(activeReeval.id, 'approve')}
                                    disabled={actionLoading === activeReeval.id}
                                  >
                                    {actionLoading === activeReeval.id ? <Loader2 className="w-3 h-3 animate-spin"/> : <><ShieldCheck className="w-3 h-3 mr-1"/> Approve Scan</>}
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                  {columnData.length === 0 && (
                    <div className="text-center py-8 text-xs text-gray-400 font-medium border-2 border-dashed border-gray-200 rounded-lg">
                      No patients
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Removing old Unassigned right sidebar which no longer exists */}

      </div>
    </div>
  );
}
