"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientImage } from "@/lib/types";
import { useState } from "react";
import { toast } from "sonner";
import { API_URL } from "@/lib/utils";
import { format } from "date-fns";
import { Plus, Trash2 } from "lucide-react";

interface ImagesTabProps {
  patientId: string;
  images: PatientImage[];
  type: "PHOTO" | "XRAY";
  onUpdate: () => void;
}

export function ImagesTab({ patientId, images, type, onUpdate }: ImagesTabProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [newImageUrl, setNewImageUrl] = useState("");
  const [description, setDescription] = useState("");

  const filteredImages = images.filter((img) => img.type === type);

  const handleSubmit = async () => {
    try {
      const response = await fetch(`${API_URL}/patient-images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newImageUrl,
          description,
          type,
          patientId,
        }),
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to add image");

      toast.success("Image added successfully");
      onUpdate();
      setIsOpen(false);
      setNewImageUrl("");
      setDescription("");
    } catch (error) {
      toast.error("Failed to add image");
      console.error(error);
    }
  };

  const handleDelete = async (imageId: string) => {
    if (!confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch(`${API_URL}/patient-images/${imageId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) throw new Error("Failed to delete image");
      toast.success("Image deleted");
      onUpdate();
    } catch (error) {
      toast.error("Failed to delete image");
      console.error(error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">{type === "PHOTO" ? "Photos" : "X-Rays"}</h2>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Add {type === "PHOTO" ? "Photo" : "X-Ray"}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New {type === "PHOTO" ? "Photo" : "X-Ray"}</DialogTitle>
              <DialogDescription>
                Enter the URL of the new image.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="url">Image URL</Label>
                <Input
                  id="url"
                  value={newImageUrl}
                  onChange={(e) => setNewImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Initial state"
                />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleSubmit}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filteredImages.length === 0 ? (
          <p className="col-span-full text-muted-foreground text-center py-8">
            No images found.
          </p>
        ) : (
          filteredImages.map((img) => (
            <Card key={img.id} className="overflow-hidden group relative">
              <div className="aspect-square relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.description || "Patient Image"}
                  className="object-cover w-full h-full"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(img.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-2">
                <p className="text-sm font-medium truncate">{img.description || "No description"}</p>
                <p className="text-xs text-muted-foreground">{format(new Date(img.date), "PPP")}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
