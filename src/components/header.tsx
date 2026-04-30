'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard, CalendarDays, Users, RotateCcw, BookOpen,
  TrendingUp, FileText, LogOut, Menu, X, Home, Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useState, useEffect } from 'react';
import { NotificationBell } from '@/components/notification-bell';

interface NavItem {
  label: string; href: string;
  icon: React.ReactNode; adminOnly?: boolean;
}

const navItems: NavItem[] = [
  { label:'ダッシュボード', href:'/dashboard', icon:<LayoutDashboard className="h-3.5 w-3.5" />, adminOnly:true },
  { label:'ホーム',         href:'/home',      icon:<Home className="h-3.5 w-3.5" /> },
  { label:'カレンダー',     href:'/calendar',  icon:<CalendarDays className="h-3.5 w-3.5" /> },
  { label:'輪番計画',       href:'/rotation',  icon:<RotateCcw className="h-3.5 w-3.5" />, adminOnly:true },
  { label:'主題一覧',       href:'/topics',    icon:<BookOpen className="h-3.5 w-3.5" /> },
  { label:'フェーズ進捗',   href:'/phase',     icon:<TrendingUp className="h-3.5 w-3.5" /> },
  { label:'参加者管理',     href:'/members',   icon:<Users className="h-3.5 w-3.5" />, adminOnly:true },
  { label:'グランドルール', href:'/grand-rule', icon:<FileText className="h-3.5 w-3.5" /> },
  { label:'会議URL設定',    href:'/settings/meeting-url', icon:<Video className="h-3.5 w-3.5" />, adminOnly:true },
];

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = (session?.user as { role?: string })?.role || 'member';
  const isAdmin = userRole === 'admin';
  const filteredItems = navItems.filter(item => !item.adminOnly || isAdmin);

  // Auto-open hamburger with 30-minute sessionStorage throttle
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1280) return;
    if (!pathname || pathname === '/login') return;

    const lastOpened = sessionStorage.getItem('hamburgerAutoOpenedAt');
    if (lastOpened) {
      const elapsed = Date.now() - parseInt(lastOpened, 10);
      if (elapsed < 30 * 60 * 1000) return;
    }

    const openTimer = setTimeout(() => {
      setMobileOpen(true);
      sessionStorage.setItem('hamburgerAutoOpenedAt', String(Date.now()));
    }, 300);

    const closeTimer = setTimeout(() => {
      setMobileOpen(false);
    }, 2000);

    return () => {
      clearTimeout(openTimer);
      clearTimeout(closeTimer);
    };
  }, [pathname, session]);

  if (!session || pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-[#E0E4EF] shadow-[0_1px_4px_rgba(0,19,93,0.06)]" style={{ height: 60 }}>
      <div className="mx-auto flex h-full max-w-[1360px] items-center justify-between px-4 sm:px-6 gap-5">

        {/* Left: Hamburger + Notification Bell + Logo */}
        <div className="flex items-center gap-2.5 shrink-0">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <button
              onClick={() => setMobileOpen(true)}
              className="xl:hidden inline-flex items-center justify-center w-8 h-8 rounded-lg border border-[#E0E4EF] bg-white text-[#3D4252] hover:bg-[#F5F7FA] transition-colors"
              aria-label="メニューを開く"
            >
              <Menu className="h-4 w-4" />
            </button>
            <SheetContent side="left" className="w-72 p-0 border-r border-[#E0E4EF]" showCloseButton={false}>
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-[#E0E4EF] px-4 py-4">
                  <div>
                    <p className="text-xs font-bold text-[#00135D]">{session.user?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{isAdmin ? '運営担当' : '参加者'}</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setMobileOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <nav className="flex-1 space-y-0.5 p-3 overflow-y-auto">
                  {filteredItems.map(item => (
                    <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-all no-underline ${
                        pathname === item.href
                          ? 'bg-[#00135D] text-white font-semibold'
                          : 'text-[#3D4252] hover:bg-[#F5F7FA]'
                      }`}>
                      {item.icon}{item.label}
                    </Link>
                  ))}
                </nav>
                <div className="border-t border-[#E0E4EF] p-3">
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm text-[#C0392B] hover:bg-[#FEF2F2] transition-all">
                    <LogOut className="h-3.5 w-3.5" />ログアウト
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Notification Bell */}
          <NotificationBell />

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.attax.co.jp/group/wp-content/uploads/group_logo_head.png"
            alt="アタックスグループ" className="h-7 w-auto"
          />
          <div className="w-px h-7 bg-[#E0E4EF] hidden sm:block" />
          <div className="hidden sm:flex flex-col justify-center">
            <span className="text-[11px] font-bold text-[#00135D] leading-tight tracking-tight">仙台事務所</span>
            <span className="text-[10px] font-medium text-muted-foreground leading-tight">
              {isAdmin ? '朝礼運営システム' : '朝礼'}
            </span>
          </div>
        </div>

        {/* Desktop nav */}
        <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center overflow-x-auto">
          {filteredItems.map(item => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs transition-all whitespace-nowrap no-underline ${
                pathname === item.href
                  ? 'bg-[#00135D] text-white font-semibold shadow-sm'
                  : 'text-[#3D4252] hover:bg-[#F5F7FA] hover:text-[#00135D]'
              }`}>
              {item.icon}{item.label}
            </Link>
          ))}
        </nav>

        {/* User */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-xs font-semibold text-[#1A1D23]">{session.user?.name}</span>
            <span className="text-[10px] text-muted-foreground">{isAdmin ? '運営担当' : '参加者'}</span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="w-8 h-8 rounded-lg border border-[#E0E4EF] bg-white flex items-center justify-center text-[#C0392B] hover:bg-[#FEF2F2] transition-colors cursor-pointer">
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
}
