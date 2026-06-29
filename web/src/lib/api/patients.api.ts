import { API_URL } from "@/lib/utils";

export interface PatientFieldSuggestions {
  clinics: string[];
  doctors: string[];
}

export const PatientsApi = {
  // Distinct clinic/doctor values already used, for autocomplete in the
  // add/edit patient forms.
  getFieldSuggestions: async (): Promise<PatientFieldSuggestions> => {
    const res = await fetch(`${API_URL}/patients/field-suggestions`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to fetch field suggestions");
    return res.json();
  },
};
