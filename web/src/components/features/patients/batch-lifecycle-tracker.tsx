'use client';

import React, { useState, useRef } from 'react';
import { AlignerBatch, BatchStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Clock, Box, UserCheck, XCircle, AlertCircle, Upload } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface BatchLifecycleTrackerProps {
  batch?: AlignerBatch;
  patientId: string;
  onStatusChange: (batchId: string, action: string, payload?: unknown) => Promise<void>;
  onCreateBatch: () => Promise<void>;
  generateUploadUrl?: (batchId: string) => Promise<{ uploadUrl: string; key: string }>;
}

const STAGES: { status: BatchStatus; label: string; icon: React.ElementType }[] = [
  { status: 'NEEDED', label: 'Required Files', icon: AlertCircle },
  { status: 'IN_PRODUCTION', label: 'In Production', icon: Clock },
  { status: 'DELIVERED_TO_CLINIC', label: 'Ready for Pickup', icon: Box },
  { status: 'HANDED_TO_PATIENT', label: 'In Treatment', icon: UserCheck },
];

export function BatchLifecycleTracker({
  batch,
  onStatusChange,
  onCreateBatch,
  generateUploadUrl
}: BatchLifecycleTrackerProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAction = async (action: string, payload?: unknown) => {
    setLoadingAction(action);
    try {
      if (action === 'create' && !batch) {
        await onCreateBatch();
      } else if (batch) {
        await onStatusChange(batch.id, action, payload);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !batch || !generateUploadUrl) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      toast.error('Only .zip files are allowed for .goo prints');
      return;
    }

    setLoadingAction('upload');
    const toastId = toast.loading('Preparing upload...');
    
    try {
      const { uploadUrl, key } = await generateUploadUrl(batch.id);
      
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

      await onStatusChange(batch.id, 'confirm-upload', { fileUrl: publicUrl, key });
      
      toast.success('Files uploaded successfully! Lab order sent.', { id: toastId });
    } catch (error: Error | unknown) {
      console.error('Upload Error:', error);
      toast.error((error as Error).message || 'Error occurred during upload', { id: toastId });
    } finally {
      setLoadingAction(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (!batch) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Batch Lifecycle</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <p className="text-sm text-gray-500">No active aligner batch found for this patient.</p>
          <Button 
            onClick={() => handleAction('create')}
            disabled={loadingAction === 'create'}
          >
            Start New Batch
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentStageIndex = STAGES.findIndex((s) => s.status === batch.status);
  const isCancelled = batch.status === 'CANCELLED';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Batch #{batch.batchNumber} Lifecycle</CardTitle>
        {isCancelled ? (
          <Badge variant="destructive" className="flex items-center gap-1">
            <XCircle className="w-3 h-3" /> Cancelled
          </Badge>
        ) : (
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {batch.alignerCount} Aligners
          </Badge>
        )}
      </CardHeader>
      
      <CardContent>
        {/* Progress Timeline */}
        <div className="relative py-6 w-full">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full hidden sm:block" />
          
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-2">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isCompleted = currentStageIndex > idx || batch.status === 'HANDED_TO_PATIENT';
              const isCurrent = currentStageIndex === idx;
              
              let colors = 'text-gray-400 bg-gray-50 border-gray-200';
              if (isCompleted) colors = 'text-white bg-green-500 border-green-500';
              if (isCurrent && !isCancelled) colors = 'text-primary bg-primary/10 border-primary';
              if (isCancelled && isCurrent) colors = 'text-red-500 bg-red-50 border-red-500';

              return (
                <div key={stage.status} className="flex sm:flex-col items-center gap-3 sm:gap-2 z-10 w-full sm:w-auto">
                  <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center bg-white transition-colors duration-200 ${colors}`}>
                    {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
                  </div>
                  <div className="text-left sm:text-center">
                    <p className={`text-xs font-medium ${isCurrent ? 'text-gray-900' : 'text-gray-500'}`}>
                      {stage.label}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Buttons based on state */}
        {!isCancelled && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2 justify-end">
            {batch.status === 'NEEDED' && (
               <div className="flex gap-2">
                <input 
                  type="file" 
                  accept=".zip" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  disabled={loadingAction === 'upload'}
                />
                <Button 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loadingAction === 'upload' || batch.alignerCount <= 0}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Print Files (.zip)
                </Button>
               </div>
            )}
            
            {batch.status === 'ORDER_SENT' && (
              <Button 
                size="sm" 
                onClick={() => handleAction('mark-in-production')}
                disabled={loadingAction === 'mark-in-production'}
              >
                Mark In Production
              </Button>
            )}

            {batch.status === 'IN_PRODUCTION' && (
              <Button 
                size="sm" 
                onClick={() => handleAction('mark-delivered', {
                  actualDeliveryDate: new Date().toISOString()
                })}
                disabled={loadingAction === 'mark-delivered'}
              >
                Receive at Clinic
              </Button>
            )}

            {batch.status === 'DELIVERED_TO_CLINIC' && (
              <Button 
                size="sm" 
                onClick={() => handleAction('hand-to-patient')}
                disabled={loadingAction === 'hand-to-patient'}
              >
                Hand to Patient
              </Button>
            )}

            {batch.status !== 'HANDED_TO_PATIENT' && (
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => handleAction('cancel')}
                disabled={loadingAction === 'cancel'}
              >
                Cancel Batch
              </Button>
            )}
          </div>
        )}

        {/* Audit Log Hint */}
        {batch.batchEvents && batch.batchEvents.length > 0 && (
           <div className="mt-4 text-xs text-gray-400">
             Last updated {format(new Date(batch.batchEvents[0].createdAt), 'MMM d, yyyy HH:mm')}
           </div>
        )}
      </CardContent>
    </Card>
  );
}
