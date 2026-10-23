// ─── Types ────────────────────────────────────────────────────────────────────

export interface GoogleSettings {
  googleConnected?: boolean;
  googleToken?: string;
  googleCalendarId?: string;
  googleBackendUrl?: string;
  googlePlaceId?: string;
  mapsKey?: string;
}

export interface CalendarEvent {
  summary: string;
  description?: string;
  location?: string;
  start: { dateTime: string; timeZone?: string };
  end: { dateTime: string; timeZone?: string };
  colorId?: string;
}

export interface GoogleDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime?: string;
  webViewLink?: string;
}

export interface GoogleContact {
  resourceName: string;
  displayName?: string;
  emailAddresses?: Array<{ value: string }>;
  phoneNumbers?: Array<{ value: string }>;
}

// ─── Mock data (when backend not connected) ───────────────────────────────────

export const MOCK_GOOGLE_DATA = {
  files: [
    { id: "f1", name: "Q2 Revenue Report.xlsx",    mimeType: "application/vnd.ms-excel",     size: 48200,  modifiedTime: "2025-04-15T10:30:00Z", webViewLink: "#" },
    { id: "f2", name: "Supply Inventory.docx",   mimeType: "application/msword",            size: 23100,  modifiedTime: "2025-04-10T08:15:00Z", webViewLink: "#" },
    { id: "f3", name: "Customer Contracts",        mimeType: "application/vnd.google-apps.folder", size: 0, modifiedTime: "2025-03-28T14:00:00Z", webViewLink: "#" },
    { id: "f4", name: "Before & After Photos",     mimeType: "application/vnd.google-apps.folder", size: 0, modifiedTime: "2025-04-01T09:00:00Z", webViewLink: "#" },
    { id: "f5", name: "Insurance Certificate.pdf", mimeType: "application/pdf",               size: 185000, modifiedTime: "2025-01-15T11:00:00Z", webViewLink: "#" },
  ] as GoogleDriveFile[],
  emails: [
    { id: "e1", from: "mike.johnson@example.com",    subject: "Re: Your estimate",        snippet: "Looks good! When can you come out?",       date: "2025-04-16" },
    { id: "e2", from: "sarah.davis@example.com",     subject: "Question about your services",       snippet: "Do you offer maintenance plans? We...",   date: "2025-04-15" },
    { id: "e3", from: "hoa@example.com", subject: "HOA Common Area Quote",      snippet: "We manage 45 homes and need quarterly...",  date: "2025-04-14" },
    { id: "e4", from: "tom.wilson@example.com",      subject: "Thanks for the great service!",       snippet: "Everything looks amazing. Will be...",    date: "2025-04-13" },
  ],
  tasks: [
    { id: "t1", title: "Follow up with Johnson estimate", due: "2025-04-18", status: "needsAction", notes: "", listTitle: "Work" },
    { id: "t2", title: "Order supplies for next week", due: "2025-04-17", status: "needsAction", notes: "Restock consumables", listTitle: "Work" },
    { id: "t3", title: "Send invoice to Davis", due: "2025-04-16", status: "completed", notes: "", listTitle: "Work" },
  ],
  events: [
    { id: "ev1", title: "Service Visit - Johnson", start: "2025-04-18T09:00", end: "2025-04-18T12:00", location: "412 Oak Ridge Ln", description: "", attendees: [], color: "blue" },
    { id: "ev2", title: "Estimate Visit - Davis", start: "2025-04-19T08:00", end: "2025-04-19T11:00", location: "89 Maple Dr", description: "", attendees: [], color: "green" },
  ],
};

// ─── Calendar CRUD ────────────────────────────────────────────────────────────

export const createCalendarEvent = async (
  settings: GoogleSettings,
  event: CalendarEvent
): Promise<string | null> => {
  if (!settings.googleConnected || !settings.googleToken) return null;
  const calId = settings.googleCalendarId || "primary";

  if (settings.googleBackendUrl) {
    const res = await fetch(`${settings.googleBackendUrl}/calendar/events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.googleToken}`,
      },
      body: JSON.stringify({ calendarId: calId, event }),
    });
    if (!res.ok) return null;
    const data = await res.json() as { id?: string };
    return data.id ?? null;
  }
  return null;
};

export const updateCalendarEvent = async (
  settings: GoogleSettings,
  eventId: string,
  patch: Partial<CalendarEvent>
): Promise<boolean> => {
  if (!settings.googleConnected || !settings.googleToken || !eventId) return false;
  const calId = settings.googleCalendarId || "primary";

  if (settings.googleBackendUrl) {
    const res = await fetch(`${settings.googleBackendUrl}/calendar/events/${eventId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${settings.googleToken}`,
      },
      body: JSON.stringify({ calendarId: calId, patch }),
    });
    return res.ok;
  }
  return false;
};

export const deleteCalendarEvent = async (
  settings: GoogleSettings,
  eventId: string
): Promise<boolean> => {
  if (!settings.googleConnected || !settings.googleToken || !eventId) return false;
  const calId = settings.googleCalendarId || "primary";

  if (settings.googleBackendUrl) {
    const res = await fetch(`${settings.googleBackendUrl}/calendar/events/${eventId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${settings.googleToken}` },
      body: JSON.stringify({ calendarId: calId }),
    });
    return res.ok;
  }
  return false;
};

// ─── Drive ────────────────────────────────────────────────────────────────────

export const fetchDriveFiles = async (settings: GoogleSettings): Promise<GoogleDriveFile[]> => {
  if (!settings.googleConnected || !settings.googleToken) return MOCK_GOOGLE_DATA.files;
  if (settings.googleBackendUrl) {
    const res = await fetch(`${settings.googleBackendUrl}/drive/files`, {
      headers: { Authorization: `Bearer ${settings.googleToken}` },
    });
    if (!res.ok) return MOCK_GOOGLE_DATA.files;
    return res.json();
  }
  return MOCK_GOOGLE_DATA.files;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const fmtSize = (bytes: number): string => {
  if (!bytes) return "—";
  if (bytes > 1048576) return (bytes / 1048576).toFixed(1) + " MB";
  if (bytes > 1024) return (bytes / 1024).toFixed(0) + " KB";
  return bytes + " B";
};

export const fmtDate = (iso: string): string => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const fileIcon = (mimeType: string): string => {
  if (mimeType.includes("folder")) return "📁";
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("video")) return "🎬";
  return "📎";
};
