'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  UserMinus, Send, CheckCircle2, CalendarDays, AlertCircle, Trash2, Info,
} from 'lucide-react';
import { DAY_LABELS } from '@/lib/constants';

interface SessionData {
  id: number; date: string; startTime: string; endTime: string;
  status: string; speaker: { id: string; name: string } | null;
  topic: { id: number; topicText: string };
}
interface AbsenceItem {
  id: number; type: string; note: string | null; requestedAt: string;
  session: { id: number; date: string; topic: { topicText: string } };
}

export default function AbsencePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [myRequests, setMyRequests] = useState<AbsenceItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [absenceType, setAbsenceType] = useState('absent');
  const [note, setNote] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [cancelMessage, setCancelMessage] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.push('/login'); return; }
    fetchAll();
  }, [status, router]);

  async function fetchAll() {
    try {
      const [sr, rr] = await Promise.all([fetch('/api/sessions?status=scheduled'), fetch('/api/absence')]);
      const sd: SessionData[] = await sr.json();
      const rd = await rr.json();
      setSessions(sd.filter(s => new Date(s.date) >= new Date(new Date().toDateString())));
      setMyRequests(Array.isArray(rd) ? rd : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setAdjustmentMessage(null);
    if (!selectedSessionId) { setError('申告対象日を選択してください'); return; }
    try {
      const res = await fetch('/api/absence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: parseInt(selectedSessionId), type: absenceType, note: note || null }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      if (data.adjustment?.reasons?.length > 0) setAdjustmentMessage(data.adjustment.reasons.join(' / '));
      setSubmitted(true); fetchAll();
    } catch { setError('申告の送信に失敗しました。もう一度お試しください。'); }
  }

  async function handleCancel(id: number) {
    setCancelConfirmId(null);
    setCancelMessage(null);
    try {
      const res = await fetch(`/api/absence?id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) { setCancelMessage(data.error || '取消しに失敗しました'); return; }
      if (data.note) setCancelMessage(data.note);
      fetchAll();
    } catch { setCancelMessage('通信エラーが発生しました'); }
  }

  const typeLabel = (t: string) => ({ absent:'欠席', unspoken:'聴講のみ', leave_early:'途中退出' }[t] || t);
  const isWithinCutoff = (ds: string) => { const c = new Date(ds); c.setHours(0,0,0,0); c.setMinutes(c.getMinutes()-1); return new Date() <= c; };
  const fmtDate = (ds: string) => { const d = new Date(ds); return `${d.getMonth()+1}月${d.getDate()}日（${DAY_LABELS[d.getDay()]}）`; };

  const activeRequests = myRequests.filter(r => r.session && new Date(r.session.date) >= new Date(new Date().toDateString()));

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[520px] px-4 py-7 sm:px-6 animate-fade-in">

        <div className="mb-6 pb-5 border-b border-[#E0E4EF]">
          <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
            <UserMinus className="h-5 w-5" />欠席・途中退出の申告
          </h1>
          <p className="text-sm text-muted-foreground mt-1">朝礼に参加できない場合にお知らせください</p>
        </div>

        {submitted ? (
          <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl mb-5">
            <CardContent className="py-10 text-center">
              <div className="w-16 h-16 rounded-full bg-[#ECFDF5] flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="h-8 w-8 text-[#047857]" />
              </div>
              <h2 className="text-lg font-bold text-[#00135D] mb-2">申告を受け付けました</h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                運営に通知され、輪番の自動調整が行われました。
              </p>
              {adjustmentMessage && (
                <div className="flex items-start gap-2 bg-[#E8F2FB] border border-[#BDD9F5] rounded-lg p-3 text-left text-xs text-[#00135D] mb-5 max-w-xs mx-auto">
                  <Info className="h-4 w-4 shrink-0 mt-0.5" />{adjustmentMessage}
                </div>
              )}
              <div className="flex gap-3 justify-center">
                <Button variant="outline" className="border-[#E0E4EF]"
                  onClick={() => { setSubmitted(false); setSelectedSessionId(''); setNote(''); setAdjustmentMessage(null); }}>
                  別の日も申告する
                </Button>
                <Button onClick={() => router.push('/home')}
                  className="bg-[#00135D] hover:bg-[#1E3A8A] text-white">
                  ホームに戻る
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl mb-5">
            <div className="px-5 py-4 border-b border-[#E0E4EF]">
              <p className="text-sm font-bold text-[#00135D]">申告フォーム</p>
              <p className="text-xs text-muted-foreground mt-1">理由の入力は必須ではありません（グランドルール準拠）</p>
            </div>
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                {error && (
                  <div className="flex items-center gap-2 p-3 bg-[#FEF2F2] border border-[#FCCACA] rounded-lg text-sm text-[#C0392B]">
                    <AlertCircle className="h-4 w-4 shrink-0" />{error}
                  </div>
                )}
                <div>
                  <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5" />申告対象日
                  </Label>
                  <Select value={selectedSessionId} onValueChange={v => setSelectedSessionId(v || '')}>
                    <SelectTrigger className="border-[#E0E4EF] h-9 text-sm">
                      <SelectValue placeholder="日付を選択してください" />
                    </SelectTrigger>
                    <SelectContent>
                      {sessions.map(s => (
                        <SelectItem key={s.id} value={String(s.id)}>
                          {fmtDate(s.date)} {s.startTime}〜{s.endTime}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">区分</Label>
                  <Select value={absenceType} onValueChange={v => setAbsenceType(v || 'absent')}>
                    <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="absent">欠席</SelectItem>
                      <SelectItem value="unspoken">聴講のみ（無言）</SelectItem>
                      <SelectItem value="leave_early">途中退出</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">メモ（任意）</Label>
                  <Textarea value={note} onChange={e => setNote(e.target.value)}
                    placeholder="任意。理由の入力は不要です。"
                    className="border-[#E0E4EF] text-sm resize-none" rows={3} />
                  <p className="text-xs text-muted-foreground mt-1">※ 理由は問いません（グランドルール第4条）</p>
                </div>
                <div className="bg-[#F8F9FC] border border-[#E0E4EF] rounded-lg p-3 text-xs text-muted-foreground space-y-1 leading-relaxed">
                  <p>・申告は即時反映。発話者欠席時は後続が自動繰上げされます。</p>
                  <p>・Phase1は参加3名未満、Phase2/3は応答者4名未満で自動中止となります。</p>
                  <p>・本人による取消しは<strong className="text-[#00135D]">前日23:59まで</strong>可能です。</p>
                </div>
                <Button type="submit"
                  className="w-full bg-[#00135D] hover:bg-[#1E3A8A] text-white rounded-xl h-11 font-bold shadow-[0_4px_14px_rgba(0,19,93,0.25)] gap-2">
                  <Send className="h-4 w-4" />申告する
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {cancelMessage && (
          <div className={`flex items-start gap-2 p-3 rounded-lg border text-sm mb-1 ${
            cancelMessage.includes('失敗') || cancelMessage.includes('エラー')
              ? 'bg-[#FEF2F2] border-[#FCCACA] text-[#C0392B]'
              : 'bg-[#E8F2FB] border-[#BDD9F5] text-[#00135D]'
          }`}>
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{cancelMessage}</span>
          </div>
        )}

        {activeRequests.length > 0 && (
          <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl">
            <div className="px-5 py-4 border-b border-[#E0E4EF]">
              <p className="text-sm font-bold text-[#00135D]">申告中の予定</p>
              <p className="text-xs text-muted-foreground mt-1">前日23:59まで本人による取消しが可能</p>
            </div>
            <div className="p-4 flex flex-col gap-2.5">
              {activeRequests.map(r => (
                <div key={r.id} className="flex items-center justify-between p-3 border border-[#E0E4EF] rounded-xl bg-[#F8F9FC]">
                  <div>
                    <p className="text-sm font-semibold text-[#00135D]">{fmtDate(r.session.date)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">区分：{typeLabel(r.type)}{r.note && `（${r.note}）`}</p>
                  </div>
                  {cancelConfirmId === r.id ? (
                    <div className="flex gap-1.5 shrink-0">
                      <Button size="sm" onClick={() => handleCancel(r.id)}
                        className="bg-[#C0392B] hover:bg-[#A93226] text-white h-7 px-2 text-xs gap-1">
                        <Trash2 className="h-3 w-3" />確認
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setCancelConfirmId(null)}
                        className="h-7 px-2 text-xs border border-[#E0E4EF]">
                        戻る
                      </Button>
                    </div>
                  ) : (
                    <Button variant="outline" size="sm"
                      disabled={!isWithinCutoff(r.session.date)}
                      onClick={() => { setCancelMessage(null); setCancelConfirmId(r.id); }}
                      className="border-[#FCCACA] text-[#C0392B] hover:bg-[#FEF2F2] gap-1 disabled:opacity-50 shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                      {isWithinCutoff(r.session.date) ? '取消し' : '期限超過'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
