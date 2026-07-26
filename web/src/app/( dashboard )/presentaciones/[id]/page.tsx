"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { API_URL } from "@/lib/utils";
import { ModelSet, Patient, PatientImage } from "@/lib/types";
import {
  Presentation,
  PresentationAsset,
  PresentationsApi,
} from "@/lib/api/presentations.api";
import { DeckEditor } from "@/components/features/presentations/deck-editor";

/**
 * The deck editor on its own page. A patient's deck also opens inside the
 * patient tab; an external case has no chart to live in, so this is the only
 * way in for it — and the link the intake flow lands on.
 */
export default function PresentationEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [deck, setDeck] = useState<Presentation | null>(null);
  const [subject, setSubject] = useState("");
  const [images, setImages] = useState<PatientImage[]>([]);
  const [modelSets, setModelSets] = useState<ModelSet[]>([]);
  const [assets, setAssets] = useState<PresentationAsset[] | undefined>();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const loaded = await PresentationsApi.get(id);
      setDeck(loaded);

      if (loaded.patientId) {
        // A patient's deck reads the chart, exactly as the patient tab does.
        const [patientRes, imagesRes, setsRes] = await Promise.all([
          fetch(`${API_URL}/patients/${loaded.patientId}`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/patient-images?patientId=${loaded.patientId}`, {
            credentials: "include",
          }),
          fetch(`${API_URL}/model-sets?patientId=${loaded.patientId}`, {
            credentials: "include",
          }),
        ]);
        if (patientRes.ok) setSubject(((await patientRes.json()) as Patient).fullName);
        if (imagesRes.ok) setImages(await imagesRes.json());
        if (setsRes.ok) setModelSets(await setsRes.json());
      } else {
        setSubject(loaded.subjectName ?? "Caso externo");
        setAssets(await PresentationsApi.listAssets(loaded.id));
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-20 text-sm text-gray-500">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => router.push("/presentaciones")}
          className="rounded-lg border px-4 py-2 hover:bg-gray-50"
        >
          Volver a presentaciones
        </button>
      </div>
    );
  }

  if (!deck) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[#6469FC]" />
      </div>
    );
  }

  return (
    <DeckEditor
      deck={deck}
      patientName={subject}
      images={images}
      modelSets={modelSets}
      assets={assets}
      onBack={() =>
        deck.patientId
          ? router.push(`/patients/${deck.patientId}?tab=presentacion`)
          : router.push("/presentaciones")
      }
      onDeckChange={setDeck}
    />
  );
}
