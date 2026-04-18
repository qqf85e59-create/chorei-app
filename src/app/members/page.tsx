'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Users,
  Plus,
  Edit,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { GRADE_LABELS, GRADE_ORDER } from '@/lib/constants';

interface UserData {
  id: string;
  name: string;
  grade: string;
  email: string | null;
  role: string;
  createdAt: string;
}

export default function MembersPage() {
  const { data: session } = useSession();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState<UserData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    grade: 'E3a',
    email: '',
    role: 'member',
    password: '',
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/users');
      setUsers(await res.json());
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setIsCreating(true);
    setEditUser(null);
    setFormData({
      name: '',
      grade: 'E3a',
      email: '',
      role: 'member',
      password: 'chorei2026',
    });
  }

  function openEdit(user: UserData) {
    setEditUser(user);
    setIsCreating(false);
    setFormData({
      name: user.name,
      grade: user.grade,
      email: user.email || '',
      role: user.role,
      password: '',
    });
  }

  async function handleSave() {
    try {
      if (isCreating) {
        await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else if (editUser) {
        await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: editUser.id,
            ...formData,
          }),
        });
      }
      setEditUser(null);
      setIsCreating(false);
      fetchUsers();
    } catch (error) {
      console.error('Failed to save user:', error);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('この参加者を削除しますか？')) return;

    try {
      await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
            <Users className="h-6 w-6" />
            参加者管理
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            朝礼参加者の情報を管理します
          </p>
        </div>

        <Dialog open={isCreating} onOpenChange={setIsCreating}>
          <DialogTrigger asChild>
            <Button
              onClick={openCreate}
              className="bg-brand-primary hover:bg-brand-secondary"
            >
              <Plus className="h-4 w-4 mr-2" />
              追加
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-brand-primary">
                参加者を追加
              </DialogTitle>
              <DialogDescription>
                新しい参加者の情報を入力してください
              </DialogDescription>
            </DialogHeader>
            <UserForm
              formData={formData}
              setFormData={setFormData}
              onSave={handleSave}
              isNew={true}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card className="border-brand-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-brand-primary">
              {users.length}
            </p>
            <p className="text-xs text-muted-foreground">総参加者</p>
          </CardContent>
        </Card>
        <Card className="border-brand-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-brand-accent">
              {users.filter((u) => u.role === 'admin').length}
            </p>
            <p className="text-xs text-muted-foreground">運営</p>
          </CardContent>
        </Card>
        <Card className="border-brand-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-brand-success">
              {users.filter((u) => u.role === 'member').length}
            </p>
            <p className="text-xs text-muted-foreground">参加者</p>
          </CardContent>
        </Card>
        <Card className="border-brand-border">
          <CardContent className="py-4 text-center">
            <p className="text-2xl font-bold text-brand-secondary">
              {new Set(users.map((u) => u.grade)).size}
            </p>
            <p className="text-xs text-muted-foreground">等級種類</p>
          </CardContent>
        </Card>
      </div>

      {/* Users Table */}
      <Card className="border-brand-border shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-bg hover:bg-brand-bg">
                  <TableHead className="text-brand-primary font-semibold">
                    名前
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    等級
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    メール
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    権限
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold w-24">
                    操作
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow
                    key={user.id}
                    className="hover:bg-brand-bg/50 transition-colors"
                  >
                    <TableCell className="font-medium text-brand-text flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-brand-accent" />
                      {user.name}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-brand-accent/30 text-brand-accent"
                      >
                        {GRADE_LABELS[user.grade] || user.grade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {user.email || '—'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          user.role === 'admin'
                            ? 'bg-brand-primary/10 text-brand-primary border-brand-primary/20'
                            : 'bg-brand-bg text-muted-foreground border-brand-border'
                        }
                      >
                        {user.role === 'admin' ? '運営' : '参加者'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(user)}
                              className="hover:bg-brand-bg"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle className="text-brand-primary">
                                参加者を編集
                              </DialogTitle>
                              <DialogDescription>
                                {user.name} の情報を編集します
                              </DialogDescription>
                            </DialogHeader>
                            {editUser?.id === user.id && (
                              <UserForm
                                formData={formData}
                                setFormData={setFormData}
                                onSave={handleSave}
                                isNew={false}
                              />
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(user.id)}
                          className="hover:bg-red-50 text-muted-foreground hover:text-brand-danger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function UserForm({
  formData,
  setFormData,
  onSave,
  isNew,
}: {
  formData: {
    name: string;
    grade: string;
    email: string;
    role: string;
    password: string;
  };
  setFormData: (data: typeof formData) => void;
  onSave: () => void;
  isNew: boolean;
}) {
  return (
    <div className="space-y-4">
      <div>
        <Label>名前</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="border-brand-border"
          placeholder="山田 太郎"
        />
      </div>
      <div>
        <Label>等級</Label>
        <Select
          value={formData.grade}
          onValueChange={(v) => setFormData({ ...formData, grade: v })}
        >
          <SelectTrigger className="border-brand-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GRADE_ORDER.map((g) => (
              <SelectItem key={g} value={g}>
                {g} ({GRADE_LABELS[g]})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>メールアドレス</Label>
        <Input
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          className="border-brand-border"
          placeholder="example@attax.co.jp"
        />
      </div>
      <div>
        <Label>権限</Label>
        <Select
          value={formData.role}
          onValueChange={(v) => setFormData({ ...formData, role: v })}
        >
          <SelectTrigger className="border-brand-border">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="member">参加者</SelectItem>
            <SelectItem value="admin">運営</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>
          パスワード{!isNew && '（変更する場合のみ入力）'}
        </Label>
        <Input
          type="password"
          value={formData.password}
          onChange={(e) =>
            setFormData({ ...formData, password: e.target.value })
          }
          className="border-brand-border"
          placeholder={isNew ? 'パスワード' : '変更しない場合は空欄'}
        />
      </div>
      <Button
        onClick={onSave}
        className="w-full bg-brand-primary hover:bg-brand-secondary"
      >
        {isNew ? '追加' : '保存'}
      </Button>
    </div>
  );
}
