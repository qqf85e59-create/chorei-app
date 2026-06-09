'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Users, Plus, Pencil, Trash2, IdCard, Briefcase, Utensils } from 'lucide-react';
import { GRADE_LABELS, GRADE_ORDER, JOB_CODE_ORDER, JOB_LABELS } from '@/lib/constants';
import { toast } from 'sonner';

interface UserData {
  id: string; name: string; grade: string;
  email: string | null; role: string; lunchRole: string; lunchStatus: string; choreiStatus: string; createdAt: string;
  employeeNumber: string | null; kana: string | null; jobCode: string | null; jobTitle: string | null;
  lunchParticipations?: any[];
}

interface FormData {
  name: string; grade: string; email: string; role: string; lunchRole: string; password: string; lunchStatus: string; choreiStatus: string;
  employeeNumber: string; kana: string; jobCode: string; jobTitle: string;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormData>({ name:'', grade:GRADE_ORDER[0], email:'', role:'member', lunchRole:'participant', password:'', lunchStatus:'active', choreiStatus:'active', employeeNumber:'', kana:'', jobCode:'c', jobTitle:'' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // ランチ選定人数（マスター設定）
  const [lunchCount, setLunchCount] = useState<string>('3');
  const [savingCount, setSavingCount] = useState(false);

  useEffect(() => { fetchUsers(); fetchLunchCount(); }, []);

  async function fetchUsers() {
    try { setUsers(await (await fetch('/api/users')).json()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function fetchLunchCount() {
    try {
      const res = await fetch('/api/config/lunch-count');
      if (res.ok) { const d = await res.json(); setLunchCount(String(d.count)); }
    } catch (e) { console.error(e); }
  }

  async function saveLunchCount() {
    setSavingCount(true);
    try {
      const res = await fetch('/api/config/lunch-count', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: parseInt(lunchCount, 10) }),
      });
      if (!res.ok) throw new Error((await res.json()).error || '保存に失敗しました');
      const d = await res.json();
      setLunchCount(String(d.count));
      toast.success(`ランチ選定人数を${d.count}名に設定しました`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSavingCount(false);
    }
  }

  function openCreate() {
    setIsCreating(true); setEditUser(null);
    setForm({ name:'', grade:GRADE_ORDER[0], email:'', role:'member', lunchRole:'participant', password:'chorei2026', lunchStatus:'active', choreiStatus:'active', employeeNumber:'', kana:'', jobCode:'c', jobTitle:'' });
    setModal(true);
  }
  function openEdit(user: UserData) {
    setIsCreating(false); setEditUser(user);
    setForm({ name:user.name, grade:user.grade, email:user.email||'', role:user.role, lunchRole:user.lunchRole||'participant', password:'', lunchStatus:user.lunchStatus||'active', choreiStatus:user.choreiStatus||'active', employeeNumber:user.employeeNumber||'', kana:user.kana||'', jobCode:user.jobCode||'', jobTitle:user.jobTitle||'' });
    setModal(true);
  }
  async function handleSave() {
    setSaving(true);
    try {
      if (isCreating) {
        const res = await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
        if (!res.ok) throw new Error((await res.json()).error || "保存に失敗しました");
      } else if (editUser) {
        const res = await fetch('/api/users', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:editUser.id, ...form }) });
        if (!res.ok) throw new Error((await res.json()).error || "保存に失敗しました");
      }
      toast.success('保存しました');
      setModal(false); setEditUser(null); fetchUsers();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  }
  async function handleDelete(id: string) {
    setDeleteConfirmId(null);
    const promise = fetch(`/api/users?id=${id}`, { method:'DELETE' }).then(res => {
      if (!res.ok) throw new Error();
      fetchUsers();
    });
    toast.promise(promise, {
      loading: '削除中...',
      success: '削除しました',
      error: '削除に失敗しました',
    });
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  const summary = [
    { label:'総参加者', value:users.length, color:'#00135D' },
    { label:'運営', value:users.filter(u=>u.role==='admin').length, color:'#0070CC' },
    { label:'参加者', value:users.filter(u=>u.role==='member').length, color:'#047857' },
    { label:'等級種類', value:[...new Set(users.map(u=>u.grade))].length, color:'#1E3A8A' },
  ];

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[1000px] px-4 py-7 sm:px-6 animate-fade-in">

        <div className="flex items-end justify-between mb-6 pb-5 border-b border-[#E0E4EF]">
          <div>
            <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5" />参加者管理
            </h1>
            <p className="text-sm text-muted-foreground mt-1">朝礼参加者の情報を管理します</p>
          </div>
          <Button onClick={openCreate}
            className="bg-[#00135D] hover:bg-[#1E3A8A] text-white shadow-[0_3px_10px_rgba(0,19,93,0.25)] rounded-lg gap-1.5">
            <Plus className="h-4 w-4" />追加
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5 mb-6">
          {summary.map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-[#E0E4EF] rounded-xl p-4 text-center shadow-[0_2px_8px_rgba(0,19,93,0.05)]">
              <p style={{ color }} className="text-[28px] font-bold leading-none">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ランチ選定人数（マスター設定） */}
        <div className="mb-6 bg-white border border-[#E0E4EF] rounded-xl p-4 shadow-[0_2px_8px_rgba(0,19,93,0.05)] flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 mr-auto">
            <Utensils className="h-4 w-4 text-[#0070CC]" />
            <div>
              <p className="text-sm font-bold text-[#00135D]">ランチ選定人数</p>
              <p className="text-[11px] text-muted-foreground">主催者を除き、毎回ランダム抽選するメンバーの人数</p>
            </div>
          </div>
          <Input
            type="number" min={1} max={20} value={lunchCount}
            onChange={e => setLunchCount(e.target.value)}
            className="w-20 h-9 text-sm text-center border-[#E0E4EF]"
          />
          <span className="text-sm text-muted-foreground">名</span>
          <Button onClick={saveLunchCount} disabled={savingCount}
            className="bg-[#00135D] hover:bg-[#1E3A8A] text-white rounded-lg h-9">
            {savingCount ? '保存中…' : '保存'}
          </Button>
        </div>

        {/* Table */}
        <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">

          {/* Mobile Cards */}
          <div className="sm:hidden divide-y divide-[#E0E4EF]">
            {users.map(user => (
              <div key={user.id} className="p-4 bg-white space-y-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-[#00135D]/10 flex items-center justify-center text-xs font-bold text-[#00135D] shrink-0">
                      {user.name[0]}
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-[#1A1D23]">{user.name}</span>
                      <p className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                        {user.jobCode && <span>{JOB_LABELS[user.jobCode]}</span>}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 items-center">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(user)}
                      className="w-7 h-7 p-0 hover:bg-[#F5F7FA] border border-[#E0E4EF]">
                      <Pencil className="h-3 w-3 text-[#3D4252]" />
                    </Button>
                    {deleteConfirmId === user.id ? (
                      <>
                        <Button size="sm" onClick={() => handleDelete(user.id)}
                          className="bg-[#C0392B] hover:bg-[#A93226] text-white h-7 px-2 text-xs">確認</Button>
                        <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}
                          className="h-7 px-2 text-xs border border-[#E0E4EF]">戻る</Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(user.id)}
                        className="w-7 h-7 p-0 hover:bg-[#FEF2F2] border border-[#FCCACA]">
                        <Trash2 className="h-3 w-3 text-[#C0392B]" />
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-xs">
                    {GRADE_LABELS[user.grade] || user.grade}
                  </Badge>
                  <Badge className={user.role==='admin' ? 'bg-[#00135D]/10 text-[#00135D] border-[#00135D]/20 text-xs' : 'bg-[#F5F7FA] text-muted-foreground border-[#E0E4EF] text-xs'}>
                    {user.role==='admin'?'運営':'参加者'}
                  </Badge>
                  <Badge className={user.choreiStatus==='active'?'bg-blue-100 text-blue-700 border-blue-200 text-xs':'bg-gray-100 text-gray-500 border-gray-200 text-xs'}>
                    朝礼:{user.choreiStatus==='active'?'参加':'不参加'}
                  </Badge>
                  <Badge className={user.lunchStatus==='active'?'bg-green-100 text-green-700 border-green-200 text-xs':'bg-gray-100 text-gray-500 border-gray-200 text-xs'}>
                    ランチ:{user.lunchStatus==='active'?'参加':'不参加'}
                  </Badge>
                  {user.lunchParticipations && (
                    <Badge variant="outline" className="text-xs bg-white border-gray-200 text-gray-600">
                      参加: {user.lunchParticipations.filter((p: any) => !p.isOrganizer).length}回
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop Table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F9FC] border-b border-[#E0E4EF]">
                  {['社員番号','名前','フリガナ','職種','等級','権限/主催','参加状態','ランチ実績','操作'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-[#00135D] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr key={user.id} className={`border-b border-[#E0E4EF] ${i%2===0?'bg-white':'bg-[#F8F9FC]'} hover:bg-[#F0F7FF] transition-colors`}>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{user.employeeNumber || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#00135D]/10 flex items-center justify-center text-xs font-bold text-[#00135D] shrink-0">
                          {user.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-[#1A1D23]">{user.name}</span>
                          <span className="text-xs text-muted-foreground">{user.email || '—'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{user.kana || '—'}</td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {user.jobCode ? `${JOB_LABELS[user.jobCode]}${user.jobTitle ? ` (${user.jobTitle})` : ''}` : '—'}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-xs">
                        {GRADE_LABELS[user.grade] || user.grade}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 flex flex-col gap-1">
                      <Badge className={user.role==='admin'
                        ? 'bg-[#00135D]/10 text-[#00135D] border-[#00135D]/20 text-xs w-max'
                        : 'bg-[#F5F7FA] text-muted-foreground border-[#E0E4EF] text-xs w-max'}>
                        {user.role==='admin'?'運営':'参加者'}
                      </Badge>
                      <Badge className={user.lunchRole==='organizer'
                        ? 'bg-orange-100 text-orange-800 border-orange-200 text-xs w-max'
                        : 'bg-gray-100 text-gray-500 border-gray-200 text-xs w-max'}>
                        {user.lunchRole==='organizer'?'ランチ当番':'ランチ参加'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col gap-1">
                        <Badge className={user.choreiStatus==='active'?'bg-blue-100 text-blue-700 border-blue-200 text-xs w-max':'bg-gray-100 text-gray-500 border-gray-200 text-xs w-max'}>
                          朝礼:{user.choreiStatus==='active'?'○':'×'}
                        </Badge>
                        <Badge className={user.lunchStatus==='active'?'bg-green-100 text-green-700 border-green-200 text-xs w-max':'bg-gray-100 text-gray-500 border-gray-200 text-xs w-max'}>
                          ランチ:{user.lunchStatus==='active'?'○':'×'}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs">
                      {(() => {
                        if (!user.lunchParticipations) return <span className="text-gray-400">—</span>;
                        const parts = user.lunchParticipations.filter((p: any) => !p.isOrganizer && p.event?.status !== 'planning');
                        if (parts.length === 0) return <span className="text-gray-400">0回</span>;
                        
                        // 確定日または作成日でソートして最新を取得
                        const sorted = [...parts].sort((a, b) => {
                          const dateA = new Date(a.event?.confirmedDate || a.event?.createdAt).getTime();
                          const dateB = new Date(b.event?.confirmedDate || b.event?.createdAt).getTime();
                          return dateB - dateA;
                        });
                        const lastDate = sorted[0].event?.confirmedDate;
                        
                        return (
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-[#0070CC]">{parts.length}回</span>
                            {lastDate && <span className="text-gray-500 text-[10px]">最終: {new Date(lastDate).toLocaleDateString('ja-JP')}</span>}
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-1.5 items-center">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(user)}
                          className="w-7 h-7 p-0 hover:bg-[#F5F7FA] border border-[#E0E4EF]">
                          <Pencil className="h-3 w-3 text-[#3D4252]" />
                        </Button>
                        {deleteConfirmId === user.id ? (
                          <>
                            <Button size="sm" onClick={() => handleDelete(user.id)}
                              className="bg-[#C0392B] hover:bg-[#A93226] text-white h-7 px-2 text-xs">
                              確認
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(null)}
                              className="h-7 px-2 text-xs border border-[#E0E4EF]">
                              戻る
                            </Button>
                          </>
                        ) : (
                          <Button variant="ghost" size="sm" onClick={() => setDeleteConfirmId(user.id)}
                            className="w-7 h-7 p-0 hover:bg-[#FEF2F2] border border-[#FCCACA]">
                            <Trash2 className="h-3 w-3 text-[#C0392B]" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={() => setModal(false)}>
          <div className="bg-white rounded-[16px] w-full max-w-[400px] max-h-[90vh] overflow-y-auto shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-5">
              <p className="text-white font-bold text-[15px]">{isCreating ? '参加者を追加' : '参加者を編集'}</p>
              <p className="text-white/70 text-xs mt-1">{isCreating ? '新しい参加者の情報を入力してください' : `${editUser?.name} の情報を編集します`}</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label:'名前', key:'name', type:'text', placeholder:'山田 太郎' },
                { label:'フリガナ', key:'kana', type:'text', placeholder:'ヤマダ タロウ' },
                { label:'メールアドレス', key:'email', type:'email', placeholder:'example@attax.co.jp' },
                { label:'社員番号', key:'employeeNumber', type:'text', placeholder:'1234' },
                { label:'職種名称', key:'jobTitle', type:'text', placeholder:'コンサルタント' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">{label}</Label>
                  <Input type={type} value={(form as any)[key]} placeholder={placeholder}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="border-[#E0E4EF] text-sm h-9 focus:border-[#0070CC] focus:ring-[#0070CC]/20" />
                </div>
              ))}
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">職種区分</Label>
                <Select value={form.jobCode} onValueChange={v => setForm({ ...form, jobCode: v || '' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {JOB_CODE_ORDER.map(c => <SelectItem key={c} value={c}>{JOB_LABELS[c]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">等級</Label>
                <Select value={form.grade} onValueChange={v => setForm({ ...form, grade: v || '' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GRADE_ORDER.map(g => <SelectItem key={g} value={g}>{g} ({GRADE_LABELS[g]})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">朝礼運営権限</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v || '' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">一般メンバー</SelectItem>
                    <SelectItem value="admin">運営</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">ランチ主催者（当番）</Label>
                <Select value={form.lunchRole} onValueChange={v => setForm({ ...form, lunchRole: v || '' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="participant">一般参加者（抽選対象）</SelectItem>
                    <SelectItem value="organizer">主催者（当番専用・抽選除外）</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">朝礼参加</Label>
                <Select value={form.choreiStatus} onValueChange={v => setForm({ ...form, choreiStatus: v || 'active' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">参加</SelectItem>
                    <SelectItem value="inactive">不参加</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">ランチ参加</Label>
                <Select value={form.lunchStatus} onValueChange={v => setForm({ ...form, lunchStatus: v || 'active' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">参加</SelectItem>
                    <SelectItem value="inactive">不参加</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">
                  パスワード{!isCreating && '（変更する場合のみ）'}
                </Label>
                <Input type="password" value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder={isCreating ? 'パスワード' : '変更しない場合は空欄'}
                  className="border-[#E0E4EF] text-sm h-9 focus:border-[#0070CC] focus:ring-[#0070CC]/20" />
              </div>
              <Button onClick={handleSave} disabled={saving}
                className="w-full bg-[#00135D] hover:bg-[#1E3A8A] text-white rounded-xl h-11 font-bold shadow-[0_4px_12px_rgba(0,19,93,0.25)] mt-1 disabled:opacity-50">
                {saving ? '保存中...' : (isCreating ? '追加' : '保存')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
