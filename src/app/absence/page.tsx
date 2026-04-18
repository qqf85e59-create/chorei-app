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
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  UserMinus,
  Send,
  CheckCircle2,
  CalendarDays,
  AlertCircle,
} from 'lucide-react';
import { DAY_LABELS } from '@/lib/constants';

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  speaker: { id: string; name: string };
  topic: { id: number; topicText: string };
}

export default function AbsencePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [absenceType, setAbsenceType] = useState<string>('absent');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    try {
      const res = await fetch('/api/sessions?status=scheduled');
      const data = await res.json();
      // Only show future sessions
      const futureSessions = data.filter(
        (s: SessionData) => new Date(s.date) >= new Date(new Date().toDateString())
      );
      setSessions(futureSessions);
    } catch (err) {
      console.error('Failed to fetch sessions:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!selectedSessionId) {
      setError('申告対象日を選択してください');
      return;
    }

    try {
      const res = await fetch('/api/absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: parseInt(selectedSessionId),
          type: absenceType,
          note: note || null,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to submit');
      }

      setSubmitted(true);
    } catch {
      setError('申告の送信に失敗しました。もう一度お試しください。');
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日（${DAY_LABELS[date.getDay()]}）`;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
          <UserMinus className="h-6 w-6" />
          欠席・途中退出の申告
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          朝礼に参加できない場合にお知らせください
        </p>
      </div>

      {submitted ? (
        <Card className="border-brand-success/30 shadow-md animate-fade-in">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-16 w-16 text-brand-success mb-4" />
            <h2 className="text-lg font-bold text-brand-primary mb-2">
              申告を受け付けました
            </h2>
            <p className="text-sm text-muted-foreground mb-6">
              運営に通知されました。ご連絡ありがとうございます。
            </p>
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setSelectedSessionId('');
                  setNote('');
                }}
                className="border-brand-border"
              >
                別の日も申告する
              </Button>
              <Button
                onClick={() => router.push('/home')}
                className="bg-brand-primary hover:bg-brand-secondary"
              >
                ホームに戻る
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-brand-border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg text-brand-primary">
              申告フォーム
            </CardTitle>
            <CardDescription>
              理由の入力は必須ではありません（グランドルール準拠）
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-brand-danger/20 bg-red-50 p-3 text-sm text-brand-danger animate-fade-in">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-brand-text">
                  <CalendarDays className="inline h-4 w-4 mr-1" />
                  申告対象日
                </Label>
                <Select
                  value={selectedSessionId}
                  onValueChange={setSelectedSessionId}
                >
                  <SelectTrigger className="border-brand-border">
                    <SelectValue placeholder="日付を選択してください" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={String(s.id)}>
                        {formatDate(s.date)} {s.startTime}〜{s.endTime}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-brand-text">区分</Label>
                <Select value={absenceType} onValueChange={setAbsenceType}>
                  <SelectTrigger className="border-brand-border">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absent">欠席</SelectItem>
                    <SelectItem value="leave_early">途中退出</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-brand-text">
                  メモ（任意）
                </Label>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="任意。理由の入力は不要です。"
                  className="border-brand-border resize-none"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  ※ 理由は問いません（グランドルール第4条）
                </p>
              </div>

              <Button
                type="submit"
                className="w-full bg-brand-primary hover:bg-brand-secondary transition-all shadow-md hover:shadow-lg"
              >
                <Send className="h-4 w-4 mr-2" />
                申告する
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
