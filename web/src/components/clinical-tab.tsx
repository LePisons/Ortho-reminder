"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
  const [formData, setFormData] = useState({
    diagnosis: "",
    treatmentPlan: "",
    observations: "",
  });

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${API_URL}/clinical-records`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...formData, patientId }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to add clinical record");

      toast.success("Clinical record added successfully");
      onUpdate();
      setIsOpen(false);
      setFormData({ diagnosis: "", treatmentPlan: "", observations: "" });
    } catch (error) {
      toast.error("Failed to add clinical record");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Clinical History</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add Record
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add Clinical Record</DialogTitle>
              <DialogDescription>
                Add a new diagnosis, treatment plan, or observation.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="diagnosis">Diagnosis</Label>
                <Textarea
                  id="diagnosis"
                  value={formData.diagnosis}
                  onChange={(e) =>
                    setFormData({ ...formData, diagnosis: e.target.value })
                  }
                  placeholder="Enter diagnosis..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="treatmentPlan">Treatment Plan</Label>
                <Textarea
                  id="treatmentPlan"
                  value={formData.treatmentPlan}
                  onChange={(e) =>
                    setFormData({ ...formData, treatmentPlan: e.target.value })
                  }
                  placeholder="Enter treatment plan..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="observations">Observations</Label>
                <Textarea
                  id="observations"
                  value={formData.observations}
                  onChange={(e) =>
                    setFormData({ ...formData, observations: e.target.value })
                  }
                  placeholder="Any additional observations..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit}>Save Record</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {records.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No clinical records found.
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
                <div className="grid gap-4 md:grid-cols-3">
                  {record.diagnosis && (
                    <div>
                      <h4 className="font-semibold mb-1">Diagnosis</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.diagnosis}</p>
                    </div>
                  )}
                  {record.treatmentPlan && (
                    <div>
                      <h4 className="font-semibold mb-1">Treatment Plan</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.treatmentPlan}</p>
                    </div>
                  )}
                  {record.observations && (
                    <div>
                      <h4 className="font-semibold mb-1">Observations</h4>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{record.observations}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
