'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GRAND_RULE_TEXT } from '@/lib/constants';
import { CheckCircle2, BookOpen, Mic, Headphones, Shield, Calendar } from 'lucide-react';

const RULE_ICONS = [BookOpen, Mic, Headphones, Shield, Calendar];

export default function GrandRulePage() {
  const [confirmed, setConfirmed] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (localStorage.getItem('grandRuleConfirmed')) setConfirmed(true);
  }, []);

  function handleConfirm() {
    localStorage.setItem('grandRuleConfirmed', 'true');
    setConfirmed(true);
    const role = (session?.user as { role?: string })?.role;
    router.push(role === 'admin' ? '/dashboard' : '/home');
  }

  const paragraphs = GRAND_RULE_TEXT.split('\n\n').filter(Boolean);
  const title = paragraphs[0];
  const description = paragraphs[1];
  const rules = paragraphs.slice(2);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white to-[#F5F7FA] px-4 py-8">
      <div className="w-full max-w-[640px] animate-fade-in">
        <Card className="border-[#E0E4EF] shadow-[0_12px_48px_rgba(0,19,93,0.12)] rounded-[20px] overflow-hidden">

          {/* Header */}
          <div className="bg-gradient-to-r from-[#00135D] to-[#1E3A8A] px-8 py-6 relative overflow-hidden">
            <div className="absolute top-[-30px] right-[-30px] w-[120px] h-[120px] rounded-full bg-white/[0.06]" />
            <div className="absolute bottom-[-20px] right-[60px] w-[80px] h-[80px] rounded-full bg-white/[0.04]" />
            <div className="flex items-center gap-4 relative">
              <div className="bg-white/[0.15] rounded-xl p-3 backdrop-blur-sm">
                <BookOpen className="h-[22px] w-[22px] text-white" />
              </div>
              <div>
                <h1 className="text-[20px] font-bold text-white tracking-tight">グランドルール</h1>
                <p className="text-sm text-white/70 mt-0.5">朝礼参加にあたっての共通ルール</p>
              </div>
            </div>
          </div>

          <CardContent className="p-7 sm:p-8">
            {/* Title + description */}
            <div className="mb-5 pb-5 border-b border-[#E0E4EF]">
              <h2 className="text-base font-bold text-[#00135D] mb-2">{title}</h2>
              <p className="text-sm text-[#3D4252] leading-relaxed">{description}</p>
            </div>

            {/* Rules */}
            <div className="flex flex-col gap-3">
              {rules.map((rule, i) => {
                const IconComponent = RULE_ICONS[i] || BookOpen;
                const lines = rule.split('\n').filter(Boolean);
                return (
                  <div key={i}
                    className="flex gap-3.5 items-start p-4 rounded-xl border border-[#E0E4EF] bg-[#F8F9FC] hover:shadow-sm transition-shadow">
                    <div className="w-8 h-8 rounded-lg bg-[#00135D] flex items-center justify-center shrink-0">
                      <IconComponent className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      {lines.map((line, li) => (
                        <p key={li} className="text-sm text-[#3D4252] leading-relaxed">{line}</p>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-7 flex justify-center">
              {confirmed ? (
                <div className="flex items-center gap-2 text-[#047857]">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-semibold text-sm">確認済み</span>
                </div>
              ) : (
                <Button
                  onClick={handleConfirm}
                  size="lg"
                  className="bg-[#00135D] hover:bg-[#1E3A8A] text-white shadow-[0_6px_20px_rgba(0,19,93,0.3)] hover:shadow-[0_8px_24px_rgba(0,19,93,0.35)] px-10 rounded-xl transition-all"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  確認しました
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
        <p className="mt-5 text-center text-xs text-muted-foreground">
          © アタックス・ビジネス・コンサルティング 仙台事務所
        </p>
      </div>
    </div>
  );
}
