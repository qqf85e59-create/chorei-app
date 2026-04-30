'use client';

import { useEffect, useState, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useSession } from 'next-auth/react';

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unreadCount: number;
}

export function NotificationBell() {
  const { data: session } = useSession();
  const [data, setData] = useState<NotificationsResponse | null>(null);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(intervalId);
  }, [session]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  async function fetchNotifications() {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  }

  async function markAllRead() {
    if (!data || data.unreadCount === 0) return;
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'markAllRead' }),
      });
      if (res.ok) {
        await fetchNotifications();
      }
    } catch (err) {
      console.error('Failed to mark notifications read:', err);
    }
  }

  if (!session) return null;

  const unreadCount = data?.unreadCount ?? 0;

  function formatTime(dateStr: string) {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'たった今';
    if (diffMin < 60) return `${diffMin}分前`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}時間前`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}日前`;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) {
            markAllRead();
          }
        }}
        className="relative inline-flex items-center justify-center rounded-md p-2 text-brand-text hover:bg-brand-bg transition-colors"
        aria-label="通知"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
            style={{ backgroundColor: '#C0392B' }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 w-80 rounded-lg border border-brand-border bg-white shadow-lg z-50 animate-fade-in">
          <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
            <span className="text-sm font-semibold text-brand-primary">通知</span>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-brand-accent hover:underline"
              >
                すべて既読
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto">
            {!data || data.notifications.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                通知はありません
              </div>
            ) : (
              data.notifications.map((n) => (
                <div
                  key={n.id}
                  className={`px-4 py-3 border-b border-brand-border last:border-b-0 transition-colors ${
                    !n.readAt ? 'bg-[#E8F2FB]/60' : ''
                  }`}
                >
                  <p className="text-sm text-brand-text">{n.message}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatTime(n.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
