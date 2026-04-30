'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { RotateCcw, Pencil, Wand2, Filter } from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS } from '@/lib/constants';

interface SessionData {
  id: number; date: string; startTime: string; endTime: string;
  status: string; adminNote: string | null; roundNumber: number; weekNumber: number;
  speaker: { id: string; name: string; grade: string };
  topic: { id: number; topicText: string; weekNumber: number };
  phase: { id: number; name: string; phaseNumber: number };
}
interface UserData { id: string; name: string; grade: string; }
interface TopicData { id: number; topicText: string; weekNumber: number; }

export default function RotationPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSpeaker, setFilterSpeaker] = useState('all');
  const [filterRound, setFilterRound] = useState('all');
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [editForm, setEditForm] = useState({ speakerId:'', topicId:'', startTime:'', endTime:'', status:'', adminNote:'' });
  const [generating, setGenerating] = useState(false);

  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    try {
      const [sr, ur, tr] = await Promise.all([fetch('/api/sessions'), fetch('/api/users'), fetch('/api/topics')]);
      setSessions(await sr.json()); setUsers(await ur.json()); setTopics(await tr.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openEdit(s: SessionData) {
    setEditSession(s);
    setEditForm({ speakerId:s.speaker.id, topicId:String(s.topic.id), startTime:s.startTime, endTime:s.endTime, status:s.status, adminNote:s.adminNote||'' });
  }
  async function saveEdit() {
    if (!editSession) return;
    await fetch('/api/sessions', {
      method:'PUT', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ id:editSession.id, speakerId:editForm.speakerId, topicId:parseInt(editForm.topicId), startTime:editForm.startTime, endTime:editForm.endTime, status:editForm.status, adminNote:editForm.adminNote||null }),
    });
    setEditSession(null); fetchData();
  }
  async function handleGenerate() {
    setGenerating(true);
    try { await fetch('/api/rotation/generate', { method:'POST' }); fetchData(); }
    catch (e) { console.error(e); }
    finally { setGenerating(false); }
  }

  const filtered = sessions.filter(s => {
    if (filterSpeaker !== 'all' && s.speaker.id !== filterSpeaker) return false;
    if (filterRound !== 'all' && s.roundNumber !== parseInt(filterRound)) return false;
    return true;
  });

  const fmtDate = (ds: string) => { const d = new Date(ds); return `${d.getMonth()+1}/${d.getDate()}（${DAY_LABELS[d.getDay()]}）`; };

  const statusStyle: Record<string, string> = {
    scheduled: 'bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5]',
    completed:  'bg-[#ECFDF5] text-[#047857] border-[#A7F3D0]',
    cancelled:  'bg-[#FEE8E8] text-[#C0392B] border-[#FCCACA]',
  };
  const statusLabel: Record<string, string> = { scheduled:'予定', completed:'完了', cancelled:'中止' };

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[1200px] px-4 py-7 sm:px-6 animate-fade-in">

        <div className="flex items-end justify-between mb-6 pb-5 border-b border-[#E0E4EF]">
          <div>
            <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />輪番計画
            </h1>
            <p className="text-sm text-muted-foreground mt-1">発話者・主題のスケジュールを管理します</p>
          </div>
          {isAdmin && (
            <Button onClick={handleGenerate} disabled={generating}
              className="bg-[#00135D] hover:bg-[#1E3A8A] text-white shadow-[0_3px_10px_rgba(0,19,93,0.25)] rounded-lg gap-1.5">
              <Wand2 className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
              {generating ? '生成中...' : '自動生成'}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="bg-white border border-[#E0E4EF] rounded-xl p-4 mb-5 flex flex-wrap items-center gap-3 shadow-[0_2px_8px_rgba(0,19,93,0.05)]">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterSpeaker} onValueChange={v => setFilterSpeaker(v || 'all')}>
            <SelectTrigger className="w-40 border-[#E0E4EF] h-8 text-sm"><SelectValue placeholder="発話者絞込" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全員</SelectItem>
              {users.map(u => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterRound} onValueChange={v => setFilterRound(v || 'all')}>
            <SelectTrigger className="w-28 border-[#E0E4EF] h-8 text-sm"><SelectValue placeholder="巡目" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全巡</SelectItem>
              <SelectItem value="1">1巡目</SelectItem>
              <SelectItem value="2">2巡目</SelectItem>
              <SelectItem value="3">3巡目</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Badge variant="outline" className="border-[#E0E4EF] text-muted-foreground text-xs">{filtered.length}件</Badge>
        </div>

        {/* Table */}
        <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F9FC] border-b border-[#E0E4EF]">
                  {['日付','巡目','発話者','等級','主題','状態', ...(isAdmin?['操作']:[])].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-[#00135D] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} className={`border-b border-[#E0E4EF] ${i%2===0?'bg-white':'bg-[#F8F9FC]'} hover:bg-[#F0F7FF] transition-colors`}>
                    <td className="px-4 py-3 text-sm font-medium text-[#1A1D23] whitespace-nowrap">{fmtDate(s.date)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-[#E8F2FB] text-[#0070CC] border border-[#BDD9F5]">{s.roundNumber}巡目</span>
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#1A1D23]">{s.speaker.name}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{GRADE_LABELS[s.speaker.grade] || s.speaker.grade}</td>
                    <td className="px-4 py-3 text-xs text-[#3D4252] max-w-[200px] overflow-hidden text-ellipsis whitespace-nowrap">{s.topic.topicText}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${statusStyle[s.status] || statusStyle.scheduled}`}>{statusLabel[s.status] || s.status}</span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(s)}
                          className="w-7 h-7 p-0 hover:bg-[#F5F7FA] border border-[#E0E4EF]">
                          <Pencil className="h-3 w-3 text-[#3D4252]" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Edit modal */}
      {editSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setEditSession(null)}>
          <div className="bg-white rounded-[16px] w-full max-w-[440px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-5">
              <p className="text-white font-bold text-[15px]">セッション編集</p>
              <p className="text-white/70 text-xs mt-1">{fmtDate(editSession.date)} のセッション</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">発話者</Label>
                <Select value={editForm.speakerId} onValueChange={v => setEditForm({ ...editForm, speakerId: v||'' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{users.map(u => <SelectItem key={u.id} value={u.id}>{u.name} ({GRADE_LABELS[u.grade]||u.grade})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">主題</Label>
                <Select value={editForm.topicId} onValueChange={v => setEditForm({ ...editForm, topicId: v||'' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>{topics.map(t => <SelectItem key={t.id} value={String(t.id)}>第{t.weekNumber}週: {t.topicText}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[['startTime','開始時刻'],['endTime','終了時刻']].map(([key, label]) => (
                  <div key={key}>
                    <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">{label}</Label>
                    <Input value={(editForm as any)[key]} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })}
                      className="border-[#E0E4EF] h-9 text-sm" />
                  </div>
                ))}
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">状態</Label>
                <Select value={editForm.status} onValueChange={v => setEditForm({ ...editForm, status: v||'' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="scheduled">予定</SelectItem>
                    <SelectItem value="completed">完了</SelectItem>
                    <SelectItem value="cancelled">中止</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">運営メモ</Label>
                <Textarea value={editForm.adminNote} onChange={e => setEditForm({ ...editForm, adminNote: e.target.value })}
                  className="border-[#E0E4EF] text-sm resize-none" rows={3} placeholder="任意のメモ" />
              </div>
              <Button onClick={saveEdit}
                className="w-full bg-[#00135D] hover:bg-[#1E3A8A] text-white rounded-xl h-11 font-bold shadow-[0_4px_12px_rgba(0,19,93,0.25)]">
                保存
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
