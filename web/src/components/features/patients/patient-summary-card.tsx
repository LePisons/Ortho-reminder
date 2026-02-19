"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Patient } from "@/lib/types";
import { Pencil, Stethoscope, ClipboardList, FileText } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";

interface PatientSummaryCardProps {
  patient: Patient;
  onUpdate: () => void;
}

export function PatientSummaryCard({
  patient,
  onUpdate,
}: PatientSummaryCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    diagnosis: patient.diagnosis || "",
    treatmentPlan: patient.treatmentPlan || "",
    observations: patient.observations || "",
  });

  const handleSave = async () => {
    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to update");

      toast.success("Clinical summary updated");
      onUpdate();
      setIsOpen(false);
    } catch (error) {
      toast.error("Failed to update clinical summary");
      console.error(error);
    }
  };

  // Sync form when dialog opens (in case patient data refreshed)
  const handleOpenChange = (open: boolean) => {
    if (open) {
      setFormData({
        diagnosis: patient.diagnosis || "",
        treatmentPlan: patient.treatmentPlan || "",
        observations: patient.observations || "",
      });
    }
    setIsOpen(open);
  };

  const fields = [
    {
      icon: Stethoscope,
      label: "Diagnosis",
      value: patient.diagnosis,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      icon: ClipboardList,
      label: "Treatment Plan",
      value: patient.treatmentPlan,
      color: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
    {
      icon: FileText,
      label: "Observations",
      value: patient.observations,
      color: "text-amber-600",
      bgColor: "bg-amber-50",
    },
  ];

  return (
    <Card className="border-l-4 border-l-blue-500">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-semibold">
          Clinical Summary
        </CardTitle>
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Pencil className="mr-2 h-4 w-4" /> Edit
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Clinical Summary</DialogTitle>
              <DialogDescription>
                Update the diagnosis, treatment plan, and observations for this
                patient.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-diagnosis">Diagnosis</Label>
                <Textarea
                  id="edit-diagnosis"
                  value={formData.diagnosis}
                  onChange={(e) =>
                    setFormData({ ...formData, diagnosis: e.target.value })
                  }
                  placeholder="Enter diagnosis..."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-treatmentPlan">Treatment Plan</Label>
                <Textarea
                  id="edit-treatmentPlan"
                  value={formData.treatmentPlan}
                  onChange={(e) =>
                    setFormData({ ...formData, treatmentPlan: e.target.value })
                  }
                  placeholder="Enter treatment plan..."
                  rows={3}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-observations">Observations</Label>
                <Textarea
                  id="edit-observations"
                  value={formData.observations}
                  onChange={(e) =>
                    setFormData({ ...formData, observations: e.target.value })
                  }
                  placeholder="Any additional observations..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save Changes</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {fields.map((field) => (
            <div key={field.label} className={`rounded-lg p-4 ${field.bgColor}`}>
              <div className="flex items-center gap-2 mb-2">
                <field.icon className={`h-4 w-4 ${field.color}`} />
                <h4 className={`font-semibold text-sm ${field.color}`}>
                  {field.label}
                </h4>
              </div>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">
                {field.value || (
                  <span className="text-gray-400 italic">Not set</span>
                )}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
