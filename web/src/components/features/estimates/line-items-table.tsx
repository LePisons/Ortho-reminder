"use client";

import { useState } from "react";
import type { CatalogItem, EstimateLineItem } from "@/lib/api/estimates.api";
import { formatClp } from "./pdf/build-estimate-pdf";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";

export function LineItemsTable({
  items,
  onChange,
  catalog,
}: {
  items: EstimateLineItem[];
  onChange: (items: EstimateLineItem[]) => void;
  catalog: CatalogItem[];
}) {
  const [selectedId, setSelectedId] = useState<string>("");

  const addSelected = () => {
    const item = catalog.find((c) => c.id === selectedId);
    if (!item) return;
    onChange([
      ...items,
      {
        name: item.name,
        details: item.details ?? undefined,
        price: item.price ?? "Consultar",
        catalogItemId: item.id,
      },
    ]);
    setSelectedId("");
  };

  const updatePrice = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    const next = [...items];
    next[index] = {
      ...next[index],
      price: digits === "" ? "Consultar" : parseInt(digits, 10),
    };
    onChange(next);
  };

  const removeItem = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Seleccione una prestación..." />
          </SelectTrigger>
          <SelectContent>
            {catalog.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name} — {c.price != null ? formatClp(c.price) : "Consultar"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" onClick={addSelected} disabled={!selectedId}>
          <Plus className="mr-1 h-4 w-4" />
          Agregar
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 py-6 text-center text-sm text-muted-foreground">
          Agregue prestaciones para armar el presupuesto
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Prestación</TableHead>
              <TableHead className="hidden sm:table-cell">Detalle</TableHead>
              <TableHead className="w-36 text-right">Valor (CLP)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item, i) => (
              <TableRow key={`${item.catalogItemId ?? item.name}-${i}`}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">
                  {item.details}
                </TableCell>
                <TableCell className="text-right">
                  <input
                    inputMode="numeric"
                    value={typeof item.price === "number" ? item.price.toLocaleString("es-CL") : ""}
                    onChange={(e) => updatePrice(i, e.target.value)}
                    placeholder="Consultar"
                    className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </TableCell>
                <TableCell>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    className="text-muted-foreground transition-colors hover:text-red-500"
                    title="Quitar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
