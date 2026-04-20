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
  Trash2,
  Info,
} from 'lucide-react';
import { DAY_LABELS } from '@/lib/constants';

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  speaker: { id: string; name: string } | null;
  topic: { id: number; topicText: string };
}

interface AbsenceRequestItem {
  id: number;
  type: string;
  note: string | null;
  requestedAt: string;
  session: {
    id: number;
    date: string;
    topic: { topicText: string };
  };
}

export default function AbsencePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [myRequests, setMyRequests] = useState<AbsenceRequestItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [absenceType, setAbsenceType] = useState<string>('absent');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [sessionsRes, requestsRes] = await Promise.all([
        fetch('/api/sessions?status=scheduled'),
        fetch('/api/absence'),
      ]);
      const sessionsData = await sessionsRes.json();
      const requestsData = await requestsRes.json();
      const futureSessions = sessionsData.filter(
        (s: SessionData) => new Date(s.date) >= new Date(new Date().toDateString())
      );
      setSessions(futureSessions);
      setMyRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (err) {
      console.error('Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setAdjustmentMessage(null);

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

      if (!res.ok) throw new Error('Failed to submit');
      const data = await res.json();

      const adj = data.adjustment as
        | {
            speakerCascaded?: boolean;
            commentatorReassigned?: boolean;
            sessionCancelled?: boolean;
            reasons?: string[];
          }
        | undefined;

      if (adj && adj.reasons && adj.reasons.length > 0) {
        setAdjustmentMessage(adj.reasons.join(' / '));
      }

      setSubmitted(true);
      fetchAll();
    } catch {
      setError('申告の送信に失敗しました。もう一度お試しください。');
    }
  }

  async function handleCancel(id: number) {
    if (!confirm('この欠席申請を取消しますか？')) return;
    try {
      const res = await fetch(`/api/absence?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || '取消しに失敗しました');
        return;
      }
      if (data.note) alert(data.note);
      fetchAll();
    } catch {
      alert('通信エラーが発生しました');
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日（${DAY_LABELS[date.getDay()]}）`;
  };

  const typeLabel = (t: string) =>
    t === 'absent' ? '欠席' : t === 'unspoken' ? '聴講のみ' : '途中退出';

  const isWithinCutoff = (dateStr: string) => {
    const cutoff = new Date(dateStr);
    cutoff.setHours(0, 0, 0, 0);
    cutoff.setMinutes(cutoff.getMinutes() - 1);
    return new Date() <= cutoff;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  const myActiveRequests = myRequests.filter(
    (r) => r.session && new Date(r.session.date) >= new Date(new Date().toDateString())
  );

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
        <Card className="border-brand-success/30 shadow-md animate-fade-in mb-6">
          <CardContent className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-14 w-14 text-brand-success mb-4" />
            <h2 className="text-lg font-bold text-brand-primary mb-2">
              申告を受け付けました
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              運営に通知され、輪番の自動調整が行われました。
            </p>
            {adjustmentMessage && (
              <div className="mx-auto max-w-sm flex items-start gap-2 rounded-lg border border-brand-accent/30 bg-blue-50 p-3 text-left text-xs text-brand-primary mb-5">
                <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{adjustmentMessage}</span>
              </div>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                variant="outline"
                onClick={() => {
                  setSubmitted(false);
                  setSelectedSessionId('');
                  setNote('');
                  setAdjustmentMessage(null);
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
        <Card className="border-brand-border shadow-md mb-6">
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
                <select
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  className="flex h-10 w-full items-center justify-between rounded-md border border-brand-border bg-white px-3 py-2 text-sm ring-offset-white placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-accent focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 appearance-none"
                  required
                >
                  <option value="" disabled>日付を選択してください</option>
                  {sessions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {formatDate(s.date)} {s.startTime}〜{s.endTime}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label className="text-brand-text">区分</Label>
                <Select value={absenceType} onValueChange={(v) => setAbsenceType(v || '')}>
                  <SelectTrigger className="border-brand-border">
                    <SelectValue>
                      {absenceType === 'absent' ? '欠席' : absenceType === 'unspoken' ? '聴講のみ（無言）' : absenceType === 'leave_early' ? '途中退出' : ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absent">欠席</SelectItem>
                    <SelectItem value="unspoken">聴講のみ（無言）</SelectItem>
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

              <div className="rounded-lg border border-brand-border bg-brand-bg/40 p-3 text-xs text-muted-foreground space-y-1">
                <p>・申告は即時反映。発話者欠席時は後続が自動繰上げされます。</p>
                <p>・Phase1は参加3名未満、Phase2/3は応答者4名未満で自動中止となります。</p>
                <p>・本人による取消しは<span className="font-semibold text-brand-primary">前日23:59まで</span>可能です。</p>
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

      {myActiveRequests.length > 0 && (
        <Card className="border-brand-border shadow-md">
          <CardHeader>
            <CardTitle className="text-lg text-brand-primary">
              申告中の予定
            </CardTitle>
            <CardDescription>
              前日23:59まで本人による取消しが可能
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myActiveRequests.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-bg/30 p-3"
                >
                  <div className="text-sm">
                    <div className="font-semibold text-brand-primary">
                      {formatDate(r.session.date)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      区分：{typeLabel(r.type)}
                      {r.note && `（${r.note}）`}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!isWithinCutoff(r.session.date)}
                    onClick={() => handleCancel(r.id)}
                    className="border-brand-danger/40 text-brand-danger hover:bg-red-50 disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    {isWithinCutoff(r.session.date) ? '取消し' : '期限超過'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
