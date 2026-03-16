"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabaseClient";

type Role = "proxy" | "buyer" | null;

type Tab = {
  href: string;
  label: string;
};

function TabLink({ tab }: { tab: Tab }) {
  const pathname = usePathname();
  const active = pathname === tab.href;

  return (
    <Link
      href={tab.href}
      className={`flex flex-1 flex-col items-center justify-center text-[11px] ${
        active ? "text-orange-500" : "text-zinc-500"
      }`}
    >
      <span
        className={`rounded-full px-3 py-1 ${
          active ? "bg-orange-50 font-medium" : ""
        }`}
      >
        {tab.label}
      </span>
    </Link>
  );
}

export function MobileTabBar() {
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

  const hide =
    pathname === "/" || pathname.startsWith("/auth") || !hasUser;

  if (hide) return null;

  let tabs: Tab[] = [];

  if (role === "proxy") {
    tabs = [
      { href: "/dashboard/orders", label: "订单" },
      { href: "/dashboard/orders/new", label: "新建" },
      { href: "/dashboard/connections", label: "买家" },
    ];
  } else if (role === "buyer") {
    tabs = [{ href: "/buyer/orders", label: "我的订单" }];
  }

  if (tabs.length === 0) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t bg-white/95 px-4 py-2 shadow-[0_-2px_6px_rgba(15,23,42,0.08)] md:hidden">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
        {tabs.map((tab) => (
          <TabLink key={tab.href} tab={tab} />
        ))}
      </div>
    </nav>
  );
}

