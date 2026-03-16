"use client";

import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type ConnectionRow = {
  id: string;
  status: "pending" | "active" | "deleted";
  buyer_id: string;
  buyer_name?: string | null;
};

export default function ConnectionsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [proxyId, setProxyId] = useState<string | null>(null);
  const [connections, setConnections] = useState<ConnectionRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role, proxy_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "proxy") {
        router.replace("/");
        return;
      }

      setProxyId(profile.proxy_id ?? null);

      const { data: connectionsData, error: connectionsError } =
        await supabase
          .from("connections")
          .select("id, status, buyer_id")
          .eq("proxy_id", user.id)
          .in("status", ["pending", "active"])
          .order("created_at", { ascending: false });

      if (connectionsError) {
        setError(connectionsError.message);
        setLoading(false);
        return;
      }
      const raw = (connectionsData as ConnectionRow[]) ?? [];

      const buyerIds = Array.from(
        new Set(raw.map((row) => row.buyer_id).filter(Boolean))
      );

      let buyerProfiles: { id: string; display_name?: string | null }[] = [];
      if (buyerIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, display_name")
          .in("id", buyerIds);
        buyerProfiles = (profilesData as any[]) ?? [];
      }

      const mapped: ConnectionRow[] =
        raw.map((row) => {
          const profile = buyerProfiles.find((p) => p.id === row.buyer_id);
          return {
            ...row,
            buyer_name: profile?.display_name ?? null,
          };
        }) ?? [];

      setConnections(mapped);
      setLoading(false);
    };

    load();
  }, [router]);

  const handleAction = async (id: string, action: "accept" | "delete") => {
    const supabase = createClient();

    if (action === "accept") {
      await supabase
        .from("connections")
        .update({ status: "active" })
        .eq("id", id);
    } else {
      await supabase.from("connections").delete().eq("id", id);
    }

    // 重新加载列表
    setConnections((prev) =>
      prev.filter((c) => {
        if (c.id !== id) return true;
        // 如果接受，就在本地先改状态；如果删除，就过滤掉
        if (action === "accept") {
          c.status = "active";
          return true;
        }
        return false;
      })
    );
  };

  const pending = connections.filter((c) => c.status === "pending");
  const active = connections.filter((c) => c.status === "active");

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-8 px-4 py-10">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-semibold">买家管理</h1>
        {proxyId && (
          <p className="mt-1 text-sm text-zinc-600">
            你的 Proxy_ID：<span className="font-mono">{proxyId}</span>
          </p>
        )}
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">加载中...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-lg font-medium">待处理申请</h2>
            {pending.length === 0 ? (
              <p className="text-sm text-zinc-500">当前没有新的绑定申请。</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        买家：
                        {item.buyer_name
                          ? `${item.buyer_name}（${item.buyer_id}）`
                          : item.buyer_id}
                      </p>
                      <p className="text-xs text-zinc-500">状态：等待你通过</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleAction(item.id, "accept")}
                        className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white"
                      >
                        接受
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAction(item.id, "delete")}
                        className="rounded-md border px-3 py-1.5 text-xs font-medium text-zinc-700"
                      >
                        删除
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-medium">已绑定买家</h2>
            {active.length === 0 ? (
              <p className="text-sm text-zinc-500">当前还没有已绑定的买家。</p>
            ) : (
              <ul className="space-y-2">
                {active.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border bg-white px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">
                        买家：
                        {item.buyer_name
                          ? `${item.buyer_name}（${item.buyer_id}）`
                          : item.buyer_id}
                      </p>
                      <p className="text-xs text-zinc-500">状态：已绑定</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAction(item.id, "delete")}
                      className="rounded-md border px-3 py-1.5 text-xs font-medium text-red-600"
                    >
                      删除买家
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

