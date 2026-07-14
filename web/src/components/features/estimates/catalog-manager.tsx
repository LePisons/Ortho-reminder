"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EstimatesApi, type CatalogItem } from "@/lib/api/estimates.api";
import { formatClp } from "./pdf/build-estimate-pdf";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pencil, Plus, Trash2 } from "lucide-react";

interface FormState {
  id: string | null; // null = creating
  name: string;
  details: string;
  price: string; // digits only; empty = "Consultar"
}

const EMPTY_FORM: FormState = { id: null, name: "", details: "", price: "" };

export function CatalogManager() {
  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [form, setForm] = useState<FormState | null>(null);
  const [toDelete, setToDelete] = useState<CatalogItem | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    EstimatesApi.catalogList()
      .then(setItems)
      .catch(() => toast.error("No se pudo cargar la lista de precios"));
  }, []);

  const openEdit = (item: CatalogItem) => {
    setForm({
      id: item.id,
      name: item.name,
      details: item.details ?? "",
      price: item.price != null ? String(item.price) : "",
    });
  };

  const save = async () => {
    if (!form) return;
    if (!form.name.trim()) {
      toast.error("Ingrese el nombre de la prestación");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      details: form.details.trim() || undefined,
      price: form.price === "" ? null : parseInt(form.price, 10),
    };
    try {
      if (form.id) {
        const updated = await EstimatesApi.catalogUpdate(form.id, payload);
        setItems((list) =>
          list ? list.map((i) => (i.id === updated.id ? updated : i)) : list,
        );
      } else {
        const created = await EstimatesApi.catalogCreate({
          ...payload,
          sortOrder: (items?.length ?? 0),
        });
        setItems((list) => (list ? [...list, created] : [created]));
      }
      toast.success("Lista de precios actualizada");
      setForm(null);
    } catch {
      toast.error("No se pudo guardar la prestación");
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    try {
      await EstimatesApi.catalogDelete(toDelete.id);
      setItems((list) => (list ? list.filter((i) => i.id !== toDelete.id) : list));
      toast.success("Prestación eliminada");
    } catch {
      toast.error("No se pudo eliminar la prestación");
    } finally {
      setToDelete(null);
    }
  };

  if (items === null) {
    return (
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setForm(EMPTY_FORM)}>
          <Plus className="mr-1 h-4 w-4" />
          Nueva prestación
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Prestación</TableHead>
            <TableHead className="hidden sm:table-cell">Detalle</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-20 text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">{item.name}</TableCell>
              <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                {item.details}
              </TableCell>
              <TableCell className="text-right font-medium">
                {item.price != null ? (
                  formatClp(item.price)
                ) : (
                  <span className="text-muted-foreground">Consultar</span>
                )}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    className="text-muted-foreground transition-colors hover:text-brand-blue"
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setToDelete(item)}
                    className="text-muted-foreground transition-colors hover:text-red-500"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{form?.id ? "Editar prestación" : "Nueva prestación"}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ej: Contenciones"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Detalle</Label>
                <Input
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                  placeholder="Ej: Por unidad"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Valor (CLP)</Label>
                <Input
                  inputMode="numeric"
                  value={form.price}
                  onChange={(e) =>
                    setForm({ ...form, price: e.target.value.replace(/\D/g, "") })
                  }
                  placeholder="Dejar vacío para “Consultar”"
                />
                <p className="text-xs text-muted-foreground">
                  Sin valor, la prestación se muestra como “Consultar”.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setForm(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={toDelete !== null} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar prestación?</AlertDialogTitle>
            <AlertDialogDescription>
              “{toDelete?.name}” se quitará de la lista de precios. Los presupuestos ya
              guardados no se ven afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
