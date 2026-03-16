"use client";

import { createClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

type Role = "proxy" | "buyer" | null;

export function TopBar() {
  const [role, setRole] = useState<Role>(null);
  const [hasUser, setHasUser] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setRole(null);
        setHasUser(false);
        return;
      }
      setHasUser(true);
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      setRole(profile?.role ?? null);
    };
    void load();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <header className="relative z-30 flex items-center justify-between border-b border-orange-100 bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-3 text-sm text-white shadow-sm">
      <Link href="/" className="flex flex-col">
        <span className="text-xs uppercase tracking-[0.18em] text-orange-100">
          Mercari Proxy
        </span>
        <span className="text-base font-semibold">煤炉代切助手</span>
      </Link>
      <div className="flex items-center gap-3">
        {/* 在 /auth 和 /auth/reset 页面，不显示任何后台导航或按钮 */}
        {pathname.startsWith("/auth") ? null : (
          <>
            {/* 在有左侧导航的后台页面，仅保留退出登录按钮 */}
            {hasUser && (
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-full border border-white/60 bg-white/10 px-3 py-1 text-xs font-medium text-white backdrop-blur hover:bg-white/20"
              >
                退出
              </button>
            )}
            {!hasUser && (
              <Link
                href="/auth"
                className="rounded-full border border-white/70 bg-white px-3 py-1 text-xs font-medium text-orange-600 shadow-sm"
              >
                登录
              </Link>
            )}
          </>
        )}
      </div>
    </header>
  );
}

