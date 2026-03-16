"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

const linkBase =
  "flex items-center justify-between rounded-md px-3 py-2 text-xs font-medium transition-colors";

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={`${linkBase} ${
        active
          ? "bg-zinc-900 text-white"
          : "text-zinc-700 hover:bg-zinc-900 hover:text-white"
      }`}
    >
      <span>{label}</span>
    </Link>
  );
}

type Role = "proxy" | "buyer" | null;

export function Sidebar() {
  const pathname = usePathname();
  const [role, setRole] = useState<Role>(null);
  const [hasUser, setHasUser] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setHasUser(false);
        setRole(null);
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

  const hideOnPath =
    pathname === "/" || pathname.startsWith("/auth");

  // 未登录或在登录/首页时不显示侧边栏
  if (!hasUser || hideOnPath) {
    return null;
  }

  return (
    <aside className="hidden h-[calc(100vh-48px)] w-52 shrink-0 border-r bg-white/80 px-3 py-4 text-xs text-zinc-700 md:block">
      {role === "proxy" && (
        <>
          <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            代切工作台
          </div>
          <nav className="space-y-1">
            <NavLink href="/dashboard/orders" label="管理订单" />
            <NavLink href="/dashboard/orders/new" label="新建订单" />
            <NavLink href="/dashboard/connections" label="管理买家" />
          </nav>
        </>
      )}

      {role === "buyer" && (
        <>
          <div className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-500">
            买家入口
          </div>
          <nav className="space-y-1">
            <NavLink href="/buyer/orders" label="我的订单" />
          </nav>
        </>
      )}
    </aside>
  );
}

