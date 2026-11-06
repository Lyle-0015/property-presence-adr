export type PresenceMember = { id: string; name: string };

export type WorkspaceSnapshot = {
  workspace: string;
  online: PresenceMember[];
  maintenanceDue: string[];
};

export function chooseInspectionReminders(
  requests: Array<{ title: string; inspectionDate?: string }>,
  today: string,
): string[] {
  return requests
    .filter((request) => request.inspectionDate !== undefined && request.inspectionDate <= today)
    .map((request) => request.title);
}

export function summarizeWorkspace(
  workspace: string,
  members: PresenceMember[],
  requests: Array<{ title: string; inspectionDate?: string }>,
  today: string,
): WorkspaceSnapshot {
  return {
    workspace,
    online: members,
    maintenanceDue: chooseInspectionReminders(requests, today),
  };
}
