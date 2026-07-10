import { useEffect, useState } from "react";
import { api } from "../../../lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: string;
}

export function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    api.get("/employee/notifications").then((res) => setNotifications(res.data.data));
  }, []);

  async function markRead(id: string) {
    await api.patch(`/employee/notifications/${id}/read`);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
  }

  return (
    <div>
      <h1 className="text-lg font-semibold text-slate-900 mb-4">Notifications</h1>
      <div className="card divide-y divide-slate-100">
        {notifications.length === 0 && <div className="p-4 text-sm text-slate-400">No notifications.</div>}
        {notifications.map((n) => (
          <div key={n.id} className={`p-4 flex items-start justify-between ${n.isRead ? "" : "bg-brand-50"}`}>
            <div>
              <div className="text-sm font-medium text-slate-800">{n.title}</div>
              <div className="text-sm text-slate-500">{n.message}</div>
              <div className="text-xs text-slate-400 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
            </div>
            {!n.isRead && (
              <button onClick={() => markRead(n.id)} className="btn-secondary text-xs">
                Mark read
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
