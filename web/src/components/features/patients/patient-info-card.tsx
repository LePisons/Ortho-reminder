"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Patient } from "@/lib/types";
import { Calendar, Mail, Phone, User, Edit } from "lucide-react";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";

interface PatientInfoCardProps {
  patient: Patient;
  onUpdate: () => void;
}

export function PatientInfoCard({ patient, onUpdate }: PatientInfoCardProps) {
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Optional: Check file size/type before uploading
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large (max 5MB)");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("Uploading profile picture...");

    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}/avatar`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to upload avatar");

      toast.success("Profile picture updated", { id: toastId });
      onUpdate();
    } catch (error) {
      toast.error("Failed to upload profile picture", { id: toastId });
      console.error(error);
    } finally {
      // Reset the input value so the same file can be selected again if needed
      e.target.value = "";
    }
  };

  const statusColor: Record<string, string> = {
    ACTIVE: "bg-green-500",
    PAUSED: "bg-yellow-500",
    FINISHED: "bg-blue-500",
  };

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
          <div className="relative group">
            <Avatar className="w-32 h-32 border-4 border-white shadow-lg">
              <AvatarImage src={patient.avatarUrl || undefined} alt={patient.fullName} />
              <AvatarFallback className="text-4xl">
                {patient.fullName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            
            {/* Hidden File Input */}
            <input
              type="file"
              id="avatar-upload"
              className="hidden"
              accept="image/*"
              onChange={handleFileChange}
            />
            
            {/* Label acts as the trigger button */}
            <label
              htmlFor="avatar-upload"
              className="absolute bottom-0 right-0 rounded-full bg-secondary text-secondary-foreground p-2 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-secondary/80 shadow-sm"
              title="Change Profile Picture"
            >
              <Edit className="h-4 w-4" />
            </label>
          </div>

          <div className="flex-1 text-center md:text-left space-y-4">
            <div>
              <div className="flex items-center justify-center md:justify-start gap-3 mb-2">
                <h1 className="text-3xl font-bold">{patient.fullName}</h1>
                <Badge className={statusColor[patient.status] || "bg-gray-500"}>
                  {patient.status}
                </Badge>
              </div>
              <p className="text-muted-foreground flex items-center justify-center md:justify-start gap-2">
                <User className="h-4 w-4" />
                RUT: {patient.rut}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{patient.email}</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{patient.phone}</span>
              </div>
              <div className="flex items-center justify-center md:justify-start gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span>
                  Started: {new Date(patient.treatmentStartDate).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
