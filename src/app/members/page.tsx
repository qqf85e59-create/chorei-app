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
import { Users, Plus, Pencil, Trash2 } from 'lucide-react';
import { GRADE_LABELS, GRADE_ORDER } from '@/lib/constants';

interface UserData {
  id: string; name: string; grade: string;
  email: string | null; role: string; createdAt: string;
}

interface FormData {
  name: string; grade: string; email: string; role: string; password: string;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<FormData>({ name:'', grade:'E3a', email:'', role:'member', password:'' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => { fetchUsers(); }, []);

  async function fetchUsers() {
    try { setUsers(await (await fetch('/api/users')).json()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function openCreate() {
    setIsCreating(true); setEditUser(null);
    setForm({ name:'', grade:GRADE_ORDER[0], email:'', role:'member', password:'chorei2026' });
    setModal(true);
  }
  function openEdit(user: UserData) {
    setIsCreating(false); setEditUser(user);
    setForm({ name:user.name, grade:user.grade, email:user.email||'', role:user.role, password:'' });
    setModal(true);
  }
  async function handleSave() {
    try {
      if (isCreating) {
        await fetch('/api/users', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(form) });
      } else if (editUser) {
        await fetch('/api/users', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:editUser.id, ...form }) });
      }
      setModal(false); setEditUser(null); fetchUsers();
    } catch (e) { console.error(e); }
  }
  async function handleDelete(id: string) {
    setDeleteConfirmId(null);
    try { await fetch(`/api/users?id=${id}`, { method:'DELETE' }); fetchUsers(); }
    catch (e) { console.error(e); }
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
        <div className="grid grid-cols-4 gap-3.5 mb-6">
          {summary.map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-[#E0E4EF] rounded-xl p-4 text-center shadow-[0_2px_8px_rgba(0,19,93,0.05)]">
              <p style={{ color }} className="text-[28px] font-bold leading-none">{value}</p>
              <p className="text-[11px] text-muted-foreground mt-1.5">{label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#F8F9FC] border-b border-[#E0E4EF]">
                  {['名前','等級','メールアドレス','権限','操作'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-xs font-bold text-[#00135D] whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, i) => (
                  <tr key={user.id} className={`border-b border-[#E0E4EF] ${i%2===0?'bg-white':'bg-[#F8F9FC]'} hover:bg-[#F0F7FF] transition-colors`}>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#00135D]/10 flex items-center justify-center text-xs font-bold text-[#00135D] shrink-0">
                          {user.name[0]}
                        </div>
                        <span className="text-sm font-semibold text-[#1A1D23]">{user.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge className="bg-[#E8F2FB] text-[#0070CC] border-[#BDD9F5] text-xs">
                        {GRADE_LABELS[user.grade] || user.grade}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{user.email || '—'}</td>
                    <td className="px-5 py-3">
                      <Badge className={user.role==='admin'
                        ? 'bg-[#00135D]/10 text-[#00135D] border-[#00135D]/20 text-xs'
                        : 'bg-[#F5F7FA] text-muted-foreground border-[#E0E4EF] text-xs'}>
                        {user.role==='admin'?'運営':'参加者'}
                      </Badge>
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
          <div className="bg-white rounded-[16px] w-full max-w-[400px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.2)]"
            onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-6 py-5">
              <p className="text-white font-bold text-[15px]">{isCreating ? '参加者を追加' : '参加者を編集'}</p>
              <p className="text-white/70 text-xs mt-1">{isCreating ? '新しい参加者の情報を入力してください' : `${editUser?.name} の情報を編集します`}</p>
            </div>
            <div className="p-6 flex flex-col gap-4">
              {[
                { label:'名前', key:'name', type:'text', placeholder:'山田 太郎' },
                { label:'メールアドレス', key:'email', type:'email', placeholder:'example@attax.co.jp' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">{label}</Label>
                  <Input type={type} value={(form as any)[key]} placeholder={placeholder}
                    onChange={e => setForm({ ...form, [key]: e.target.value })}
                    className="border-[#E0E4EF] text-sm h-9 focus:border-[#0070CC] focus:ring-[#0070CC]/20" />
                </div>
              ))}
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
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">権限</Label>
                <Select value={form.role} onValueChange={v => setForm({ ...form, role: v || '' })}>
                  <SelectTrigger className="border-[#E0E4EF] h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">参加者</SelectItem>
                    <SelectItem value="admin">運営</SelectItem>
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
              <Button onClick={handleSave}
                className="w-full bg-[#00135D] hover:bg-[#1E3A8A] text-white rounded-xl h-11 font-bold shadow-[0_4px_12px_rgba(0,19,93,0.25)] mt-1">
                {isCreating ? '追加' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
