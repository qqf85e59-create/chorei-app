'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import {
  LayoutDashboard,
  CalendarDays,
  Users,
  RotateCcw,
  BookOpen,
  TrendingUp,
  FileText,
  LogOut,
  Menu,
  X,
  Home,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    label: 'ダッシュボード',
    href: '/dashboard',
    icon: <LayoutDashboard className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'ホーム',
    href: '/home',
    icon: <Home className="h-4 w-4" />,
  },
  {
    label: 'カレンダー',
    href: '/calendar',
    icon: <CalendarDays className="h-4 w-4" />,
  },
  {
    label: '輪番計画',
    href: '/rotation',
    icon: <RotateCcw className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: '主題一覧',
    href: '/topics',
    icon: <BookOpen className="h-4 w-4" />,
  },
  {
    label: 'フェーズ進捗',
    href: '/phase',
    icon: <TrendingUp className="h-4 w-4" />,
  },
  {
    label: '参加者管理',
    href: '/members',
    icon: <Users className="h-4 w-4" />,
    adminOnly: true,
  },
  {
    label: 'グランドルール',
    href: '/grand-rule',
    icon: <FileText className="h-4 w-4" />,
  },
];

export function Header() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const userRole = (session?.user as { role?: string })?.role || 'member';
  const filteredItems = navItems.filter(
    (item) => !item.adminOnly || userRole === 'admin'
  );

  if (!session || pathname === '/login') return null;

  return (
    <header className="sticky top-0 z-50 border-b border-brand-border bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo + Title */}
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://www.attax.co.jp/group/wp-content/uploads/group_logo_head.png"
            alt="アタックスグループ"
            className="h-8 w-auto"
          />
          <div className="hidden sm:block">
            <span className="text-sm font-semibold text-brand-primary">
              仙台事務所
            </span>
            <span className="ml-1 text-sm text-brand-secondary">
              {userRole === 'admin' ? '朝礼運営' : '朝礼'}
            </span>
          </div>
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-1">
          {filteredItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
                pathname === item.href
                  ? 'bg-brand-primary text-white shadow-sm'
                  : 'text-brand-text hover:bg-brand-bg hover:text-brand-primary'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* User area */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end">
            <span className="text-sm font-medium text-brand-text">
              {session.user?.name}
            </span>
            <span className="text-xs text-muted-foreground">
              {userRole === 'admin' ? '運営' : '参加者'}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="hidden sm:flex text-muted-foreground hover:text-brand-danger"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          {/* Mobile Menu */}
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <button
              onClick={() => setMobileOpen(true)}
              className="lg:hidden inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-transparent p-2 text-brand-text hover:bg-brand-bg transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
            <SheetContent side="right" className="w-72 p-0">
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-brand-border px-4 py-4">
                  <div>
                    <p className="text-sm font-semibold text-brand-primary">
                      {session.user?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {userRole === 'admin' ? '運営' : '参加者'}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setMobileOpen(false)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <nav className="flex-1 space-y-1 p-3">
                  {filteredItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all ${
                        pathname === item.href
                          ? 'bg-brand-primary text-white'
                          : 'text-brand-text hover:bg-brand-bg'
                      }`}
                    >
                      {item.icon}
                      <span>{item.label}</span>
                    </Link>
                  ))}
                </nav>
                <div className="border-t border-brand-border p-3">
                  <button
                    onClick={() => signOut({ callbackUrl: '/login' })}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-brand-danger hover:bg-red-50 transition-all"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>ログアウト</span>
                  </button>
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
