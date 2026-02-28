import { API_URL } from '@/lib/utils';

export interface Setting {
  id: string;
  key: string;
  value: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  type: string;
  channel: string;
  content: string;
  language: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const SettingsApi = {
  getSettings: async (): Promise<Setting[]> => {
    const response = await fetch(`${API_URL}/settings`);
    if (!response.ok) throw new Error('Failed to fetch settings');
    return response.json();
  },

  updateSettings: async (settings: { key: string; value: string }[]) => {
    const response = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) throw new Error('Failed to update settings');
    return response.json();
  },

  getTemplates: async (): Promise<MessageTemplate[]> => {
    const response = await fetch(`${API_URL}/message-templates`);
    if (!response.ok) throw new Error('Failed to fetch templates');
    return response.json();
  },

  updateTemplate: async (id: string, content: string) => {
    const response = await fetch(`${API_URL}/message-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content }),
    });
    if (!response.ok) throw new Error('Failed to update template');
    return response.json();
  },
};
