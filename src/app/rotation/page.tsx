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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  RotateCcw,
  Edit,
  Wand2,
  Filter,
  Mic,
  BookOpen,
} from 'lucide-react';
import { DAY_LABELS, GRADE_LABELS } from '@/lib/constants';

interface SessionData {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  adminNote: string | null;
  roundNumber: number;
  weekNumber: number;
  speaker: { id: string; name: string; grade: string };
  topic: { id: number; topicText: string; weekNumber: number };
  phase: { id: number; name: string; phaseNumber: number };
}

interface UserData {
  id: string;
  name: string;
  grade: string;
}

interface TopicData {
  id: number;
  topicText: string;
  weekNumber: number;
}

export default function RotationPage() {
  const { data: session } = useSession();
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [users, setUsers] = useState<UserData[]>([]);
  const [topics, setTopics] = useState<TopicData[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSpeaker, setFilterSpeaker] = useState<string>('all');
  const [filterRound, setFilterRound] = useState<string>('all');
  const [editSession, setEditSession] = useState<SessionData | null>(null);
  const [editForm, setEditForm] = useState({
    speakerId: '',
    topicId: '',
    startTime: '',
    endTime: '',
    status: '',
    adminNote: '',
  });

  const userRole = (session?.user as { role?: string })?.role || 'member';

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [sessionsRes, usersRes, topicsRes] = await Promise.all([
        fetch('/api/sessions'),
        fetch('/api/users'),
        fetch('/api/topics'),
      ]);
      setSessions(await sessionsRes.json());
      setUsers(await usersRes.json());
      setTopics(await topicsRes.json());
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }

  function openEdit(s: SessionData) {
    setEditSession(s);
    setEditForm({
      speakerId: s.speaker.id,
      topicId: String(s.topic.id),
      startTime: s.startTime,
      endTime: s.endTime,
      status: s.status,
      adminNote: s.adminNote || '',
    });
  }

  async function saveEdit() {
    if (!editSession) return;

    try {
      await fetch('/api/sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editSession.id,
          speakerId: editForm.speakerId,
          topicId: parseInt(editForm.topicId),
          startTime: editForm.startTime,
          endTime: editForm.endTime,
          status: editForm.status,
          adminNote: editForm.adminNote || null,
        }),
      });
      setEditSession(null);
      fetchData();
    } catch (error) {
      console.error('Failed to save:', error);
    }
  }

  const filteredSessions = sessions.filter((s) => {
    if (filterSpeaker !== 'all' && s.speaker.id !== filterSpeaker) return false;
    if (filterRound !== 'all' && s.roundNumber !== parseInt(filterRound))
      return false;
    return true;
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}（${DAY_LABELS[date.getDay()]}）`;
  };

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-brand-border border-t-brand-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 animate-fade-in">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-primary flex items-center gap-2">
            <RotateCcw className="h-6 w-6" />
            輪番計画
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            発話者・主題のスケジュールを管理します
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-brand-border shadow-sm mb-6">
        <CardContent className="flex flex-wrap items-center gap-4 p-4">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterSpeaker} onValueChange={setFilterSpeaker}>
            <SelectTrigger className="w-40 border-brand-border">
              <SelectValue placeholder="発話者絞込" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全員</SelectItem>
              {users.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRound} onValueChange={setFilterRound}>
            <SelectTrigger className="w-32 border-brand-border">
              <SelectValue placeholder="巡目" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全巡</SelectItem>
              <SelectItem value="1">1巡目</SelectItem>
              <SelectItem value="2">2巡目</SelectItem>
              <SelectItem value="3">3巡目</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1" />
          <Badge
            variant="outline"
            className="border-brand-border text-muted-foreground"
          >
            {filteredSessions.length}件
          </Badge>
        </CardContent>
      </Card>

      {/* Sessions Table */}
      <Card className="border-brand-border shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-brand-bg hover:bg-brand-bg">
                  <TableHead className="text-brand-primary font-semibold">
                    日付
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    巡目
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    <Mic className="inline h-3.5 w-3.5 mr-1" />
                    発話者
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    等級
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    <BookOpen className="inline h-3.5 w-3.5 mr-1" />
                    主題
                  </TableHead>
                  <TableHead className="text-brand-primary font-semibold">
                    状態
                  </TableHead>
                  {userRole === 'admin' && (
                    <TableHead className="text-brand-primary font-semibold w-20">
                      操作
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSessions.map((s) => (
                  <TableRow
                    key={s.id}
                    className="hover:bg-brand-bg/50 transition-colors"
                  >
                    <TableCell className="font-medium text-brand-text">
                      {formatDate(s.date)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="border-brand-accent/30 text-brand-accent"
                      >
                        {s.roundNumber}巡目
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {s.speaker.name}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {GRADE_LABELS[s.speaker.grade] || s.speaker.grade}
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.topic.topicText}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          s.status === 'completed'
                            ? 'bg-brand-success/10 text-brand-success border-brand-success/20'
                            : s.status === 'cancelled'
                            ? 'bg-brand-danger/10 text-brand-danger border-brand-danger/20'
                            : 'bg-brand-accent/10 text-brand-accent border-brand-accent/20'
                        }
                      >
                        {s.status === 'scheduled'
                          ? '予定'
                          : s.status === 'completed'
                          ? '完了'
                          : 'キャンセル'}
                      </Badge>
                    </TableCell>
                    {userRole === 'admin' && (
                      <TableCell>
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEdit(s)}
                              className="hover:bg-brand-bg"
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle className="text-brand-primary">
                                セッション編集
                              </DialogTitle>
                              <DialogDescription>
                                {formatDate(s.date)} のセッションを編集します
                              </DialogDescription>
                            </DialogHeader>
                            {editSession?.id === s.id && (
                              <div className="space-y-4">
                                <div>
                                  <Label>発話者</Label>
                                  <Select
                                    value={editForm.speakerId}
                                    onValueChange={(v) =>
                                      setEditForm({ ...editForm, speakerId: v })
                                    }
                                  >
                                    <SelectTrigger className="border-brand-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {users.map((u) => (
                                        <SelectItem key={u.id} value={u.id}>
                                          {u.name} ({u.grade})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>主題</Label>
                                  <Select
                                    value={editForm.topicId}
                                    onValueChange={(v) =>
                                      setEditForm({ ...editForm, topicId: v })
                                    }
                                  >
                                    <SelectTrigger className="border-brand-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {topics.map((t) => (
                                        <SelectItem
                                          key={t.id}
                                          value={String(t.id)}
                                        >
                                          第{t.weekNumber}週: {t.topicText}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <Label>開始時刻</Label>
                                    <Input
                                      value={editForm.startTime}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          startTime: e.target.value,
                                        })
                                      }
                                      className="border-brand-border"
                                    />
                                  </div>
                                  <div>
                                    <Label>終了時刻</Label>
                                    <Input
                                      value={editForm.endTime}
                                      onChange={(e) =>
                                        setEditForm({
                                          ...editForm,
                                          endTime: e.target.value,
                                        })
                                      }
                                      className="border-brand-border"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <Label>状態</Label>
                                  <Select
                                    value={editForm.status}
                                    onValueChange={(v) =>
                                      setEditForm({ ...editForm, status: v })
                                    }
                                  >
                                    <SelectTrigger className="border-brand-border">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="scheduled">
                                        予定
                                      </SelectItem>
                                      <SelectItem value="completed">
                                        完了
                                      </SelectItem>
                                      <SelectItem value="cancelled">
                                        キャンセル
                                      </SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label>運営メモ</Label>
                                  <Textarea
                                    value={editForm.adminNote}
                                    onChange={(e) =>
                                      setEditForm({
                                        ...editForm,
                                        adminNote: e.target.value,
                                      })
                                    }
                                    className="border-brand-border"
                                    placeholder="任意のメモ"
                                  />
                                </div>
                                <Button
                                  onClick={saveEdit}
                                  className="w-full bg-brand-primary hover:bg-brand-secondary"
                                >
                                  保存
                                </Button>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    )}
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
