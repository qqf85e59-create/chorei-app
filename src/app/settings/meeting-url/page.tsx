'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Video,
  Save,
  History,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { DAY_LABELS } from '@/lib/constants';

interface HistoryEntry {
  id: number;
  oldValue: string | null;
  newValue: string;
  changedAt: string;
  changedByUser: { id: string; name: string; grade: string };
}

export default function MeetingUrlSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentUrl, setCurrentUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if ((session?.user as { role?: string })?.role !== 'admin') {
      router.push('/home');
      return;
    }
    fetchAll();
  }, [status, session, router]);

  async function fetchAll() {
    try {
      const [urlRes, historyRes] = await Promise.all([
        fetch('/api/config/meeting-url'),
        fetch('/api/config/meeting-url/history'),
      ]);
      const urlData = await urlRes.json();
      const historyData = await historyRes.json();
      setCurrentUrl(urlData.url);
      setInputUrl(urlData.url);
      setHistory(Array.isArray(historyData) ? historyData : []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch('/api/config/meeting-url', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '保存に失敗しました');
      } else {
        setCurrentUrl(data.url);
        setSuccess(true);
        await fetchAll();
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch {
      setError('通信エラーが発生しました');
    } finally {
      setSaving(false);
    }
  }

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const day = DAY_LABELS[d.getDay()];
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}（${day}）${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          <Video className="h-6 w-6" />
          Web会議URL設定
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          全セッションで共通利用するWeb会議URLを管理します（運営のみ編集可）
        </p>
      </div>

      <Card className="border-brand-border shadow-md mb-6">
        <CardHeader>
          <CardTitle className="text-lg text-brand-primary">現在のURL</CardTitle>
          <CardDescription>ホーム・ダッシュボードに表示されるURL</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-brand-text">Web会議URL</Label>
              <Input
                type="url"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://zoom.us/j/xxxxxxxx"
                className="border-brand-border"
                required
              />
              <p className="text-xs text-muted-foreground">
                http:// または https:// で始まる完全なURLを入力してください
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-brand-danger/20 bg-red-50 p-3 text-sm text-brand-danger">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div className="flex items-center gap-2 rounded-lg border border-brand-success/20 bg-green-50 p-3 text-sm text-brand-success">
                <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
                <span>URLを更新しました</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                変更は即時反映され、履歴として記録されます
              </p>
              <Button
                type="submit"
                disabled={saving || inputUrl === currentUrl}
                className="bg-brand-primary hover:bg-brand-secondary"
              >
                <Save className="h-4 w-4 mr-2" />
                {saving ? '保存中...' : '保存する'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="border-brand-border shadow-md">
        <CardHeader>
          <CardTitle className="text-lg text-brand-primary flex items-center gap-2">
            <History className="h-5 w-5" />
            変更履歴
          </CardTitle>
          <CardDescription>直近の変更履歴（最大100件）</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              変更履歴はまだありません
            </p>
          ) : (
            <div className="space-y-3">
              {history.map((h) => (
                <div
                  key={h.id}
                  className="rounded-lg border border-brand-border bg-brand-bg/30 p-4"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-brand-accent/30 text-brand-accent">
                        {h.changedByUser?.name ?? '削除済ユーザー'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTime(h.changedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <div>
                      <span className="text-muted-foreground mr-2">旧：</span>
                      <span className="font-mono text-brand-text break-all">
                        {h.oldValue ?? '（未設定）'}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted-foreground mr-2">新：</span>
                      <span className="font-mono text-brand-primary break-all">
                        {h.newValue}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
