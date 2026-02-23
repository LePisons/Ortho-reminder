'use client';

import React, { useState, useRef } from 'react';
import { Reevaluation, ReevaluationStatus } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Upload, FileCheck, ShieldCheck, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

interface ReevaluationTrackerProps {
  reevaluation?: Reevaluation;
  patientId: string;
  onStatusChange: (reevalId: string, action: string, payload?: unknown) => Promise<void>;
  onCreateReevaluation: () => Promise<void>;
  generateUploadUrl: (reevalId: string) => Promise<{ uploadUrl: string; key: string }>;
}

const STAGES: { status: ReevaluationStatus; label: string; icon: React.ElementType; color: string }[] = [
  { status: 'NEEDED', label: 'Scan Needed', icon: AlertCircle, color: 'text-amber-500' },
  { status: 'SCAN_UPLOADED', label: 'Scan Uploaded', icon: Upload, color: 'text-blue-500' },
  { status: 'APPROVED', label: 'Approved', icon: ShieldCheck, color: 'text-green-500' },
];

export function ReevaluationTracker({
  reevaluation,
  onStatusChange,
  onCreateReevaluation,
  generateUploadUrl,
}: ReevaluationTrackerProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAction = async (action: string, payload?: unknown) => {
    setLoadingAction(action);
    try {
      if (action === 'create' && !reevaluation) {
        await onCreateReevaluation();
      } else if (reevaluation) {
        await onStatusChange(reevaluation.id, action, payload);
      }
    } finally {
      setLoadingAction(null);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !reevaluation) return;

    if (!file.name.toLowerCase().endsWith('.stl')) {
      toast.error('Only .stl files are allowed for 3D scans');
      return;
    }

    setLoadingAction('upload');
    const toastId = toast.loading('Preparing upload...');
    
    try {
      // 1. Get Presigned URL
      const { uploadUrl, key } = await generateUploadUrl(reevaluation.id);
      
      toast.loading('Uploading scan securely...', { id: toastId });

      // 2. Upload directly to R2
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': 'application/vnd.ms-pki.stl',
        },
      });

      if (!uploadRes.ok) {
        throw new Error('Failed to upload file to storage provider');
      }

      toast.loading('Confirming upload...', { id: toastId });

      // 3. Confirm with our API, derive the public URL. 
      // Example: Using process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN in real app.
      // For this implementation, we will pass a placeholder URL that the backend accepts,
      // as the exact public domain is configured on the backend.
      const publicUrl = `https://storage.orthoreminder.com/${key}`;

      await onStatusChange(reevaluation.id, 'scan-url', { scanFileUrl: publicUrl });
      
      toast.success('Scan uploaded successfully!', { id: toastId });
    } catch (error: Error | unknown) {
      console.error('Upload Error:', error);
      toast.error((error as Error).message || 'Error occurred during upload', { id: toastId });
    } finally {
      setLoadingAction(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  if (!reevaluation) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <p className="text-sm text-gray-500">No re-evaluation currently open.</p>
          <Button 
            variant="outline"
            onClick={() => handleAction('create')}
            disabled={loadingAction === 'create'}
          >
            Request Re-evaluation
          </Button>
        </CardContent>
      </Card>
    );
  }

  const currentStageIndex = STAGES.findIndex((s) => s.status === reevaluation.status);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-medium">Re-evaluation Process</CardTitle>
        <Badge variant={reevaluation.status === 'APPROVED' ? 'default' : 'secondary'}>
          {STAGES[currentStageIndex]?.label || reevaluation.status}
        </Badge>
      </CardHeader>
      
      <CardContent>
        {/* Progress Timeline */}
        <div className="relative py-6 w-full">
          <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-100 -translate-y-1/2 rounded-full hidden sm:block" />
          
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 sm:gap-2 px-4">
            {STAGES.map((stage, idx) => {
              const Icon = stage.icon;
              const isCompleted = currentStageIndex > idx || reevaluation.status === 'APPROVED';
              const isCurrent = currentStageIndex === idx;
              
              let colors = 'text-gray-400 bg-gray-50 border-gray-200';
              if (isCompleted) colors = 'text-white bg-green-500 border-green-500';
              if (isCurrent) colors = `bg-white border-2 ${stage.color.replace('text-', 'border-')} ${stage.color}`;

              return (
                <div key={stage.status} className="flex sm:flex-col items-center gap-3 sm:gap-2 z-10 w-full sm:w-auto">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors duration-200 ${colors}`}>
                    <Icon className="w-5 h-5" />
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

        {/* Dynamic Content based on State */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          {reevaluation.status === 'NEEDED' && (
            <>
              <div className="text-sm text-gray-500">
                Please upload the latest patient 3D scan (.stl).
              </div>
              <div>
                <input 
                  type="file" 
                  accept=".stl" 
                  className="hidden" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload}
                  disabled={loadingAction === 'upload'}
                />
                <Button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loadingAction === 'upload'}
                  className="w-full sm:w-auto"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Scan
                </Button>
              </div>
            </>
          )}

          {reevaluation.status === 'SCAN_UPLOADED' && (
            <>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                 <FileCheck className="w-4 h-4 text-blue-500" />
                 Scan processed on {reevaluation.scanDate ? format(new Date(reevaluation.scanDate), 'MMM d, yyyy') : 'Unknown Date'}
              </div>
              <Button 
                onClick={() => handleAction('approve')}
                disabled={loadingAction === 'approve'}
                className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
              >
                <ShieldCheck className="w-4 h-4 mr-2" />
                Approve & Complete
              </Button>
            </>
          )}

          {reevaluation.status === 'APPROVED' && (
             <div className="w-full text-center text-sm font-medium text-green-600 py-2">
               Re-evaluation approved on {reevaluation.approvalDate ? format(new Date(reevaluation.approvalDate), 'MMM d, yyyy') : 'Unknown Date'}.
             </div>
          )}

        </div>
      </CardContent>
    </Card>
  );
}
