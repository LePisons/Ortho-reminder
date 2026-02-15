"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Patient } from "@/lib/types";
import { Calendar, Mail, Phone, User, Edit } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";

interface PatientInfoCardProps {
  patient: Patient;
  onUpdate: () => void;
}

export function PatientInfoCard({ patient, onUpdate }: PatientInfoCardProps) {
  const [isAvatarDialogOpen, setIsAvatarDialogOpen] = useState(false);
  const [newAvatarUrl, setNewAvatarUrl] = useState(patient.avatarUrl || "");

  const handleAvatarUpdate = async () => {
    try {
      const response = await fetch(`${API_URL}/patients/${patient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: newAvatarUrl }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to update avatar");

      toast.success("Avatar updated successfully");
      onUpdate();
      setIsAvatarDialogOpen(false);
    } catch (error) {
      toast.error("Failed to update avatar");
      console.error(error);
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
              <AvatarImage src={patient.avatarUrl} alt={patient.fullName} />
              <AvatarFallback className="text-4xl">
                {patient.fullName
                  .split(" ")
                  .map((n: string) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Dialog open={isAvatarDialogOpen} onOpenChange={setIsAvatarDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute bottom-0 right-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Update Profile Picture</DialogTitle>
                  <DialogDescription>
                    Enter the URL of the new profile picture.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="avatar-url" className="text-right">
                      Image URL
                    </Label>
                    <Input
                      id="avatar-url"
                      value={newAvatarUrl}
                      onChange={(e) => setNewAvatarUrl(e.target.value)}
                      className="col-span-3"
                      placeholder="https://example.com/avatar.jpg"
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleAvatarUpdate}>Save changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
