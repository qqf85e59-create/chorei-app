'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Video, Save, CheckCircle2, RotateCcw, ArrowLeft } from 'lucide-react';

interface HistoryItem { url: string; updatedAt: string; }

export default function MeetingUrlPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') { router.push('/login'); return; }
    if ((session?.user as { role?: string })?.role !== 'admin') { router.push('/home'); return; }
    fetchData();
  }, [status, session, router]);

  async function fetchData() {
    try {
      const [urlRes, histRes] = await Promise.all([
        fetch('/api/config/meeting-url'),
        fetch('/api/config/meeting-url/history'),
      ]);
      if (urlRes.ok) { const d = await urlRes.json(); setUrl(d.url || ''); }
      if (histRes.ok) { const h = await histRes.json(); if (Array.isArray(h)) setHistory(h); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    try {
      await fetch('/api/config/meeting-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      fetchData();
    } catch (e) { console.error(e); }
  }

  if (loading) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-[#E0E4EF] border-t-[#00135D]" />
    </div>
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#F5F7FA]">
      <div className="mx-auto max-w-[600px] px-4 py-7 sm:px-6 animate-fade-in">

        <div className="flex items-center gap-3 mb-6 pb-5 border-b border-[#E0E4EF]">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 border border-[#E0E4EF] bg-white">
              <ArrowLeft className="h-4 w-4 text-[#3D4252]" />
            </Button>
          </Link>
          <div>
            <h1 className="text-[22px] font-bold text-[#00135D] tracking-tight flex items-center gap-2">
              <Video className="h-5 w-5" />会議URL設定
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">朝礼で使用するWeb会議のURLを管理します</p>
          </div>
        </div>

        {/* Form */}
        <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl mb-5">
          <div className="px-5 py-4 border-b border-[#E0E4EF]">
            <p className="text-sm font-bold text-[#00135D]">現在のURL</p>
          </div>
          <CardContent className="p-5">
            {saved && (
              <div className="flex items-center gap-2 p-3 bg-[#ECFDF5] border border-[#A7F3D0] rounded-lg text-sm text-[#047857] mb-4">
                <CheckCircle2 className="h-4 w-4 shrink-0" />URLを保存しました
              </div>
            )}
            <form onSubmit={handleSave} className="flex flex-col gap-4">
              <div>
                <Label className="text-xs font-semibold text-[#3D4252] mb-1.5 block">Web会議URL</Label>
                <Input type="url" value={url} onChange={e => setUrl(e.target.value)}
                  placeholder="https://zoom.us/j/..." required
                  className="border-[#E0E4EF] text-sm h-10 focus:border-[#0070CC] focus:ring-[#0070CC]/20" />
                <p className="text-xs text-muted-foreground mt-1">Zoom / Google Meet / Teams など任意のURLが使用できます</p>
              </div>
              {url && (
                <div className="flex items-center justify-between bg-[#E8F2FB] border border-[#BDD9F5] rounded-lg px-4 py-2.5">
                  <div className="flex items-center gap-2 text-sm text-[#0057A0] font-semibold">
                    <Video className="h-4 w-4 text-[#0070CC]" />プレビュー
                  </div>
                  <a href={url} target="_blank" rel="noopener noreferrer"
                    className="text-xs font-bold text-[#0070CC] bg-white px-3 py-1.5 rounded-md border border-[#BDD9F5] no-underline">
                    テスト参加 →
                  </a>
                </div>
              )}
              <Button type="submit"
                className="w-full bg-[#00135D] hover:bg-[#1E3A8A] text-white rounded-xl h-11 font-bold shadow-[0_4px_14px_rgba(0,19,93,0.25)] gap-2">
                <Save className="h-4 w-4" />保存する
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* History */}
        <Card className="border-[#E0E4EF] shadow-[0_2px_12px_rgba(0,19,93,0.07)] rounded-xl">
          <div className="px-5 py-4 border-b border-[#E0E4EF]">
            <p className="text-sm font-bold text-[#00135D]">変更履歴</p>
          </div>
          <div>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground p-5 text-center">履歴なし</p>
            ) : history.map((h, i) => (
              <div key={i} className={`flex items-center justify-between px-5 py-3.5 ${i < history.length-1 ? 'border-b border-[#E0E4EF]' : ''}`}>
                <div className="flex-1 min-w-0 pr-4">
                  <p className="text-xs font-mono text-[#1A1D23] truncate">{h.url}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{new Date(h.updatedAt).toLocaleString('ja-JP')}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setUrl(h.url)}
                  className="shrink-0 border-[#E0E4EF] text-xs h-7 gap-1 hover:bg-[#F5F7FA]">
                  <RotateCcw className="h-3 w-3" />復元
                </Button>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
