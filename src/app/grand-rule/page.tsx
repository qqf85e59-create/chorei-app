'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { GRAND_RULE_TEXT } from '@/lib/constants';
import { CheckCircle2, BookOpen } from 'lucide-react';

export default function GrandRulePage() {
  const [confirmed, setConfirmed] = useState(false);
  const { data: session } = useSession();
  const router = useRouter();

  useEffect(() => {
    const hasConfirmed = localStorage.getItem('grandRuleConfirmed');
    if (hasConfirmed) {
      setConfirmed(true);
    }
  }, []);

  function handleConfirm() {
    localStorage.setItem('grandRuleConfirmed', 'true');
    setConfirmed(true);

    const userRole = (session?.user as { role?: string })?.role;
    if (userRole === 'admin') {
      router.push('/dashboard');
    } else {
      router.push('/home');
    }
  }

  const paragraphs = GRAND_RULE_TEXT.split('\n\n');

  return (
    <div className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-gradient-to-b from-white to-brand-bg px-4 py-8">
      <div className="w-full max-w-2xl animate-fade-in">
        <Card className="border-brand-border shadow-xl shadow-brand-primary/5 overflow-hidden">
          {/* Header band */}
          <div className="bg-gradient-to-r from-brand-primary to-brand-secondary px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-white/20 p-2">
                <BookOpen className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">
                  グランドルール
                </h1>
                <p className="text-sm text-white/80">
                  朝礼参加にあたっての共通ルール
                </p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 sm:p-8">
            <div className="space-y-5">
              {paragraphs.map((paragraph, index) => {
                if (index === 0) {
                  // Title
                  return (
                    <h2
                      key={index}
                      className="text-lg font-bold text-brand-primary border-b border-brand-border pb-3"
                    >
                      {paragraph}
                    </h2>
                  );
                }

                if (index === 1) {
                  // Description
                  return (
                    <p
                      key={index}
                      className="text-brand-text leading-relaxed"
                    >
                      {paragraph}
                    </p>
                  );
                }

                // Rule items
                const lines = paragraph.split('\n');
                return (
                  <div
                    key={index}
                    className="rounded-lg border border-brand-border bg-brand-bg/50 p-4 transition-all hover:shadow-sm"
                  >
                    {lines.map((line, lineIndex) => (
                      <p
                        key={lineIndex}
                        className="text-brand-text leading-relaxed"
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex justify-center">
              {confirmed ? (
                <div className="flex items-center gap-2 text-brand-success">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">確認済み</span>
                </div>
              ) : (
                <Button
                  onClick={handleConfirm}
                  size="lg"
                  className="bg-brand-primary hover:bg-brand-secondary transition-all duration-300 shadow-lg shadow-brand-primary/20 hover:shadow-xl hover:shadow-brand-primary/30 px-8"
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  確認しました
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
