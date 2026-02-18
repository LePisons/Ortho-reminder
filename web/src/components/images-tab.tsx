"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientImage } from "@/lib/types";
import { useState, useMemo, ComponentType } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";
import { format } from "date-fns";
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Camera,
} from "lucide-react";
import {
  RightProfileSvg,
  FrontalFaceSvg,
  SmileFaceSvg,
  UpperOcclusalSvg,
  LowerOcclusalSvg,
  IntraoralRightSvg,
  IntraoralFrontalSvg,
  IntraoralLeftSvg,
  PanoramicXraySvg,
  LateralXraySvg,
} from "@/components/dental-illustrations";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";

// ─── Slot definitions ──────────────────────────────────────────────────────

interface SlotDef {
  category: string;
  label: string;
  Illustration: ComponentType<{ className?: string }>;
  placeholder?: string;
}

// 3×3 orthodontic photo grid (center cell = patient info)
const PHOTO_GRID: (SlotDef | "info")[][] = [
  // Row 1: Extraoral faces
  [
    {
      category: "Right Profile",
      label: "Right Profile",
      Illustration: RightProfileSvg,
      placeholder: "/Photos_layout/Lateral.png",
    },
    {
      category: "Frontal",
      label: "Frontal",
      Illustration: FrontalFaceSvg,
      placeholder: "/Photos_layout/Frontal2.png",
    },
    {
      category: "Smile",
      label: "Smile",
      Illustration: SmileFaceSvg,
      placeholder: "/Photos_layout/FrontalSonrisa.png",
    },
  ],
  // Row 2: Occlusal arches + patient info center
  [
    {
      category: "Upper Occlusal",
      label: "Upper Occlusal",
      Illustration: UpperOcclusalSvg,
      placeholder: "/Photos_layout/Intraoral_oclusal1.png",
    },
    "info",
    {
      category: "Lower Occlusal",
      label: "Lower Occlusal",
      Illustration: LowerOcclusalSvg,
      placeholder: "/Photos_layout/Intraoral_oclusal2.png",
    },
  ],
  // Row 3: Intraoral views
  [
    {
      category: "Intraoral Right",
      label: "Intraoral Right",
      Illustration: IntraoralRightSvg,
      placeholder: "/Photos_layout/Intraoral_Lateral_Derecha.png",
    },
    {
      category: "Intraoral Frontal",
      label: "Intraoral Frontal",
      Illustration: IntraoralFrontalSvg,
      placeholder: "/Photos_layout/Intraoral_Frontal.png",
    },
    {
      category: "Intraoral Left",
      label: "Intraoral Left",
      Illustration: IntraoralLeftSvg,
      placeholder: "/Photos_layout/Intraoral_Lateral_izquierda.png",
    },
  ],
];

// Flat list of photo categories (for counting)
const PHOTO_SLOTS: SlotDef[] = PHOTO_GRID.flat().filter(
  (s): s is SlotDef => s !== "info"
);

const XRAY_SLOTS: SlotDef[] = [
  {
    category: "Panoramic",
    label: "Panoramic",
    Illustration: PanoramicXraySvg,
    placeholder: "/Photos_layout/Panoramic.png",
  },
  {
    category: "Lateral",
    label: "Lateral",
    Illustration: LateralXraySvg,
    placeholder: "/Photos_layout/LateralCeph.png",
  },
];

// ─── Component ─────────────────────────────────────────────────────────────

interface ImagesTabProps {
  patientId: string;
  images: PatientImage[];
  type: "PHOTO" | "XRAY";
  onUpdate: () => void;
}

export function ImagesTab({ patientId, images, type, onUpdate }: ImagesTabProps) {
  const slots = type === "PHOTO" ? PHOTO_SLOTS : XRAY_SLOTS;
  const filteredImages = images.filter((img) => img.type === type);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, PatientImage[]> = {};
    filteredImages.forEach((img) => {
      const key = format(new Date(img.date), "yyyy-MM-dd");
      if (!groups[key]) groups[key] = [];
      groups[key].push(img);
    });
    return groups;
  }, [filteredImages]);

  const sortedDates = useMemo(
    () => Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a)),
    [groupedByDate]
  );

  // State
  const [expandedDates, setExpandedDates] = useState<Set<string>>(() => {
    return new Set(sortedDates.length > 0 ? [sortedDates[0]] : []);
  });
  const [newSessionDate, setNewSessionDate] = useState("");
  const [showNewSession, setShowNewSession] = useState(false);

  // Upload dialog state
  const [uploadDialog, setUploadDialog] = useState<{
    open: boolean;
    category: string;
    dateKey: string;
  }>({ open: false, category: "", dateKey: "" });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [deleteSessionTarget, setDeleteSessionTarget] = useState<{
    dateKey: string;
    displayDate: string;
  } | null>(null);

  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateKey)) next.delete(dateKey);
      else next.add(dateKey);
      return next;
    });
  };

  const handleCreateSession = () => {
    if (!newSessionDate) {
      toast.error("Please select a date");
      return;
    }
    setExpandedDates((prev) => new Set(prev).add(newSessionDate));
    setShowNewSession(false);
    setNewSessionDate("");
  };

  const openUploadDialog = (category: string, dateKey: string) => {
    setUploadDialog({ open: true, category, dateKey });
    setSelectedFile(null);
    setFilePreview(null);
    setDescription("");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setFilePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error("Please select an image");
      return;
    }
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("type", type);
      formData.append("patientId", patientId);
      formData.append("category", uploadDialog.category);
      formData.append(
        "date",
        new Date(uploadDialog.dateKey + "T12:00:00").toISOString()
      );
      if (description.trim()) formData.append("description", description);

      const response = await fetch(`${API_URL}/patient-images/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to upload image");
      toast.success("Image uploaded");
      onUpdate();
      setUploadDialog({ open: false, category: "", dateKey: "" });
    } catch (error) {
      toast.error("Failed to upload image");
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    try {
      const response = await fetch(`${API_URL}/patient-images/${imageId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete");
      toast.success("Image deleted");
      setDeleteTarget(null);
      onUpdate();
    } catch (error) {
      toast.error("Failed to delete image");
      console.error(error);
    }
  };

  const handleDeleteSession = async () => {
    if (!deleteSessionTarget) return;

    try {
      const response = await fetch(
        `${API_URL}/patient-images/session?patientId=${patientId}&date=${deleteSessionTarget.dateKey}`,
        {
          method: "DELETE",
          credentials: "include",
        }
      );
      if (!response.ok) throw new Error("Failed to delete session");
      toast.success("Session deleted");
      setDeleteSessionTarget(null);
      // Remove from expanded if present
      setExpandedDates((prev) => {
        const next = new Set(prev);
        next.delete(deleteSessionTarget.dateKey);
        return next;
      });
      onUpdate();
    } catch (error) {
      toast.error("Failed to delete session");
      console.error(error);
    }
  };

  const findImage = (
    dateKey: string,
    category: string
  ): PatientImage | undefined => {
    return groupedByDate[dateKey]?.find((img) => img.category === category);
  };

  const allDates = useMemo(() => {
    const dates = new Set(sortedDates);
    expandedDates.forEach((d) => dates.add(d));
    return Array.from(dates).sort((a, b) => b.localeCompare(a));
  }, [sortedDates, expandedDates]);

  // ── Render helper: single slot cell ────────────────────────────────────

  function SlotCell({
    slot,
    dateKey,
  }: {
    slot: SlotDef;
    dateKey: string;
  }) {
    const existing = findImage(dateKey, slot.category);
    return (
      <div className="flex flex-col items-center">
        {existing ? (
          <div className="relative group w-full aspect-square border rounded-lg overflow-hidden bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={existing.url}
              alt={slot.label}
              className="object-cover w-full h-full"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button
                variant="destructive"
                size="icon"
                className="h-8 w-8"
                onClick={() => setDeleteTarget(existing.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => openUploadDialog(slot.category, dateKey)}
            className={`w-full aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center gap-1 hover:border-blue-400 transition-all cursor-pointer group relative overflow-hidden ${type === "PHOTO" ? "bg-white" : "bg-gray-100"}`}
          >
            {slot.placeholder ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={slot.placeholder}
                alt={slot.label}
                className="absolute inset-0 w-full h-full object-contain opacity-40 grayscale group-hover:opacity-60 group-hover:grayscale-0 transition-all"
              />
            ) : (
              <>
                <slot.Illustration className="w-2/3 h-2/3 max-w-[80px] max-h-[80px]" />
                <span className="text-[10px] text-blue-500 font-medium flex items-center gap-0.5 mt-1">
                  <Camera className="h-2.5 w-2.5" /> Add
                </span>
              </>
            )}
          </button>
        )}
        <span className="text-[10px] text-gray-500 mt-1 text-center leading-tight">
          {slot.label}
        </span>
      </div>
    );
  }

  // ── Render helper: patient info center cell ────────────────────────────

  function InfoCell({ dateKey }: { dateKey: string }) {
    const dateImages = groupedByDate[dateKey] || [];
    const filledCount = slots.filter((s) =>
      dateImages.some((img) => img.category === s.category)
    ).length;
    const displayDate = format(new Date(dateKey + "T12:00:00"), "PPP");
    return (
      <div className="w-full aspect-square border rounded-lg flex flex-col items-center justify-center bg-white p-3">
        <p className="text-xs text-muted-foreground font-medium mb-1">
          Session
        </p>
        <p className="text-sm font-semibold text-center">{displayDate}</p>
        <p className="text-xs text-muted-foreground mt-2">
          {filledCount} / {slots.length} photos
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">
          {type === "PHOTO" ? "Photos" : "X-Rays"}
        </h2>
        {showNewSession ? (
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={newSessionDate}
              onChange={(e) => setNewSessionDate(e.target.value)}
              className="w-auto"
            />
            <Button size="sm" onClick={handleCreateSession}>
              Create
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNewSession(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <Button onClick={() => setShowNewSession(true)}>
            <Plus className="mr-2 h-4 w-4" /> New Session
          </Button>
        )}
      </div>

      {/* Sessions */}
      {allDates.length === 0 && !showNewSession ? (
        <div className="text-center py-12 text-muted-foreground">
          <Camera className="mx-auto h-12 w-12 mb-3 opacity-40" />
          <p>
            No {type === "PHOTO" ? "photo" : "x-ray"} sessions yet.
          </p>
          <p className="text-sm">
            Click &quot;New Session&quot; to start adding images.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allDates.map((dateKey) => {
            const isExpanded = expandedDates.has(dateKey);
            const dateImages = groupedByDate[dateKey] || [];
            const filledCount = slots.filter((s) =>
              dateImages.some((img) => img.category === s.category)
            ).length;
            const displayDate = format(
              new Date(dateKey + "T12:00:00"),
              "PPP"
            );

            return (
              <div
                key={dateKey}
                className="border rounded-lg overflow-hidden"
              >
                {/* Folder header */}
                <div className="flex items-center justify-between bg-gray-50 px-4 py-3 hover:bg-gray-100 transition-colors">
                  <button
                    onClick={() => toggleDate(dateKey)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-gray-500 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-500 shrink-0" />
                    )}
                    <FolderOpen className="h-4 w-4 text-amber-500 shrink-0" />
                    <span className="font-medium text-sm">{displayDate}</span>
                    <span className="text-xs text-muted-foreground">
                      {filledCount}/{slots.length}
                    </span>
                  </button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-gray-200">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteSessionTarget({ dateKey, displayDate });
                        }}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Grid content */}
                {isExpanded && (
                  <div className="p-4 bg-slate-50/50">
                    {type === "PHOTO" ? (
                      /* ── 3×3 Orthodontic Photo Grid ────────── */
                      <div className="grid grid-cols-3 gap-3 max-w-3xl mx-auto">
                        {PHOTO_GRID.map((row, ri) =>
                          row.map((cell, ci) =>
                            cell === "info" ? (
                              <InfoCell key={`info-${ri}-${ci}`} dateKey={dateKey} />
                            ) : (
                              <SlotCell
                                key={cell.category}
                                slot={cell}
                                dateKey={dateKey}
                              />
                            )
                          )
                        )}
                      </div>
                    ) : (
                      /* ── X-Ray Grid (2 columns) ────────────── */
                      <div className="grid grid-cols-2 gap-6 max-w-3xl mx-auto">
                        {XRAY_SLOTS.map((slot) => (
                          <SlotCell
                            key={slot.category}
                            slot={slot}
                            dateKey={dateKey}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Upload dialog */}
      <Dialog
        open={uploadDialog.open}
        onOpenChange={(open) => {
          if (!open)
            setUploadDialog({ open: false, category: "", dateKey: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {uploadDialog.category}</DialogTitle>
            <DialogDescription>
              Select a photo from your computer.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="img-file">Photo</Label>
              <Input
                id="img-file"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
            </div>
            {filePreview && (
              <div className="relative w-full rounded-lg overflow-hidden border bg-gray-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={filePreview}
                  alt="Preview"
                  className="w-full h-48 object-contain"
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="img-desc">Description (Optional)</Label>
              <Input
                id="img-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Initial state"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || isUploading}
            >
              {isUploading ? "Uploading..." : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Image</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this image? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Session confirmation dialog */}
      <AlertDialog
        open={!!deleteSessionTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteSessionTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the session for{" "}
              <span className="font-medium">
                {deleteSessionTarget?.displayDate}
              </span>
              ? All images in this session will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteSessionTarget(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSession}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Session
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
