"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ClinicalRecord } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";
import { format } from "date-fns";
import { Plus } from "lucide-react";

interface ClinicalTabProps {
  patientId: string;
  records: ClinicalRecord[];
  onUpdate: () => void;
}

export function ClinicalTab({ patientId, records, onUpdate }: ClinicalTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [observations, setObservations] = useState("");

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${API_URL}/clinical-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ observations, patientId }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to add clinical record");

      toast.success("Follow-up note added successfully");
      onUpdate();
      setIsOpen(false);
      setObservations("");
    } catch (error) {
      toast.error("Failed to add clinical record");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Follow-up Notes</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Note
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Follow-up Note</DialogTitle>
              <DialogDescription>
                Record observations or updates for this visit.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="observations">Note</Label>
                <Textarea
                  id="observations"
                  value={observations}
                  onChange={(e) => setObservations(e.target.value)}
                  placeholder="Enter follow-up notes..."
                  rows={5}
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit}>Save Note</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {records.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No follow-up notes found.
          </p>
        ) : (
          records.map((record) => (
            <Card key={record.id}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {format(new Date(record.date), "PPP")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {record.observations && (
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {record.observations}
                  </p>
                )}
                {record.diagnosis && (
                  <div className="mt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Diagnosis</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.diagnosis}</p>
                  </div>
                )}
                {record.treatmentPlan && (
                  <div className="mt-2">
                    <h4 className="font-semibold text-xs text-muted-foreground mb-1">Treatment Plan</h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.treatmentPlan}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
