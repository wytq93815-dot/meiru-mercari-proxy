"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabaseClient";

export default function Home() {
  const router = useRouter();
  const [checkedAuth, setCheckedAuth] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setCheckedAuth(true);
        setIsAuthed(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "proxy") {
        setIsAuthed(true);
        router.replace("/dashboard/orders");
      } else if (profile?.role === "buyer") {
        setIsAuthed(true);
        router.replace("/buyer/orders");
      } else {
        // 有用户但没有角色信息，当作未绑定完成，统一跳去登录页
        setIsAuthed(true);
        router.replace("/auth");
      }

      setCheckedAuth(true);
    };

    void check();
  }, [router]);

  // 未完成鉴权检查或已登录时，什么都不渲染（只做跳转）
  if (!checkedAuth || isAuthed) {
    return null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-3xl rounded-2xl bg-white px-8 py-10 shadow-sm">
        <div className="mb-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-zinc-500">
            Mercari Proxy
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900">
            煤炉代切助手
          </h1>
          <p className="mt-3 text-sm text-zinc-600">
            一个为代切和买家设计的轻量级订单与返图管理面板。
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <a
            href="/auth"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/80 p-5 transition hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 group-hover:text-zinc-300">
                For Proxy
              </p>
              <h2 className="mt-2 text-lg font-semibold">我是代切</h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 group-hover:text-zinc-300">
                管理买家绑定关系、创建煤炉订单、上传返图，全流程可追踪。
              </p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-medium text-zinc-800 group-hover:text-white">
              去登录并进入后台
              <span className="ml-1 text-xs">&rarr;</span>
            </span>
          </a>

          <a
            href="/auth"
            className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-white p-5 transition hover:border-zinc-900 hover:bg-zinc-900 hover:text-white"
          >
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 group-hover:text-zinc-300">
                For Buyer
              </p>
              <h2 className="mt-2 text-lg font-semibold">我是买家</h2>
              <p className="mt-2 text-xs leading-relaxed text-zinc-600 group-hover:text-zinc-300">
                绑定代切 Proxy_ID，查看自己的订单进度与返图，保障隐私安全。
              </p>
            </div>
            <span className="mt-4 inline-flex items-center text-xs font-medium text-zinc-800 group-hover:text-white">
              去登录并查看订单
              <span className="ml-1 text-xs">&rarr;</span>
            </span>
          </a>
        </div>

        <p className="mt-8 text-[11px] text-zinc-400">
          登录后系统会根据你的角色自动跳转到对应界面：代切进入订单管理，买家进入订单列表。
        </p>
      </div>
    </div>
  );
}
