import type { AdminSection } from '../types/admin';

export interface AdminActionPayload {
  section: AdminSection;
  action: string;
  values: Record<string, string | boolean>;
  requestedAt: string;
}

export interface AdminActionResult {
  requestId: string;
  status: 'queued';
}

export const adminApi = {
  submitAction: (payload: AdminActionPayload): Promise<AdminActionResult> =>
    new Promise((resolve) => {
      console.info('Admin action request', payload);
      window.setTimeout(() => {
        resolve({
          requestId: `admin-${Date.now()}`,
          status: 'queued',
        });
      }, 360);
    }),
};
