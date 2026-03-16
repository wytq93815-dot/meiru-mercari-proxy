"use client";

import { createClient } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";

type BuyerOrder = {
  id: string;
  product_name: string;
  product_url: string | null;
  amount: number;
  status: string;
  created_at: string;
  proxy_id: string;
  images?: { id: string; image_path: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  // 新枚举
  ordered: "已下单",
  received_from_mercari: "已收货",
  shipped_to_buyer: "已发往国内",
  buyer_received: "买家已收货",
  // 兼容老数据
  purchased: "已下单",
  shipped: "已发往国内",
  completed: "买家已收货",
  cancelled: "已取消",
};

export default function BuyerOrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<BuyerOrder[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");
  const [editingName, setEditingName] = useState<string>("");
  const [savingName, setSavingName] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>("all");

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
        setError("请先使用买家账号登录。");
        setLoading(false);
        return;
      }

      // 确认角色为 buyer
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "buyer") {
        setError("只有买家账号可以访问此页面。");
        setLoading(false);
        return;
      }

      setDisplayName(profile.display_name ?? "");
      setEditingName(profile.display_name ?? "");

      // 1）先查出当前买家与哪些代切是 active 关系
      const { data: connections, error: connectionsError } = await supabase
        .from("connections")
        .select("proxy_id")
        .eq("buyer_id", user.id)
        .eq("status", "active");

      if (connectionsError) {
        setError(connectionsError.message);
        setLoading(false);
        return;
      }

      const activeProxyIds =
        (connections as { proxy_id: string }[])?.map((c) => c.proxy_id) ?? [];

      if (activeProxyIds.length === 0) {
        setOrders([]);
        setLoading(false);
        return;
      }

      // 2）只查询这些 active 关系下的订单
      const { data: rows, error: ordersError } = await supabase
        .from("orders")
        .select(
          `
          id,
          product_name,
          product_url,
          amount,
          status,
          created_at,
          proxy_id,
          order_images ( id, image_path )
        `
        )
        .eq("buyer_id", user.id)
        .in("proxy_id", activeProxyIds)
        .order("created_at", { ascending: false });

      if (ordersError) {
        setError(ordersError.message);
        setLoading(false);
        return;
      }

      setOrders(
        (rows as any[])?.map((row) => ({
          id: row.id,
          product_name: row.product_name,
          product_url: row.product_url,
          amount: row.amount,
          status: row.status,
          created_at: row.created_at,
          proxy_id: row.proxy_id,
          images: row.order_images ?? [],
        })) ?? []
      );

      setLoading(false);
    };

    load();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleSaveName = async () => {
    setNameMessage(null);
    const trimmed = editingName.trim();
    if (!trimmed) {
      setNameMessage("名字不能为空。");
      return;
    }

    setSavingName(true);
    const supabase = createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      setNameMessage("请先登录。");
      setSavingName(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ display_name: trimmed })
      .eq("id", user.id);

    if (updateError) {
      setNameMessage(updateError.message);
      setSavingName(false);
      return;
    }

    setDisplayName(trimmed);
    setNameMessage("已保存。");
    setSavingName(false);
  };

  const filteredOrders = orders.filter((o) => {
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchStatus;
  });

  const totalAmount = filteredOrders.reduce(
    (sum, o) => sum + (o.amount || 0),
    0
  );

  return (
    <div className="relative mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-3 py-6 md:px-4 md:py-8">
      <header>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 p-4 text-white shadow-sm md:p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold md:text-xl">我的订单</h1>
              <p className="mt-1 text-[11px] md:text-xs text-orange-50/90">
                查看代切为你处理的全部煤炉订单与返图进度。
              </p>
            </div>
            <div className="mt-1 flex flex-col items-start gap-1 text-xs md:mt-0 md:items-end">
              <span className="text-orange-50/90">我的昵称（代切可见）</span>
              <div className="flex w-full max-w-xs items-center gap-2">
                <input
                  type="text"
                  className="flex-1 rounded-full border border-white/60 bg-white/10 px-3 py-1.5 text-xs text-white placeholder:text-orange-100 focus:bg-white/15"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  placeholder="输入你的称呼"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={savingName}
                  className="rounded-full bg-white px-3 py-1.5 text-[11px] font-medium text-orange-600 shadow-sm disabled:opacity-60"
                >
                  {savingName ? "保存中..." : "保存"}
                </button>
              </div>
              {displayName && (
                <div className="text-[11px] text-orange-50/90">
                  当前名称：<span className="font-semibold">{displayName}</span>
                </div>
              )}
              {nameMessage && (
                <div className="text-[11px] text-orange-50/90">{nameMessage}</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">加载中...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : filteredOrders.length === 0 ? (
        <p className="text-sm text-zinc-500">暂无订单。</p>
      ) : (
        <>
          <div className="mb-2 flex flex-col items-start justify-between gap-2 text-xs text-zinc-600 md:flex-row md:items-center">
            <div className="flex items-center gap-1">
              <span>状态筛选</span>
              <select
                className="rounded-md border px-2 py-1"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <option value="all">全部</option>
                <option value="ordered">已下单</option>
                <option value="received_from_mercari">已收货</option>
                <option value="shipped_to_buyer">已发往国内</option>
                <option value="buyer_received">买家已收货</option>
              </select>
            </div>
            <div className="text-right">
              共 {filteredOrders.length} 笔订单，合计金额{" "}
            <span className="font-semibold text-zinc-900">
              ￥{totalAmount.toFixed(2)}
            </span>
            </div>
          </div>
          <ul className="space-y-2">
            {filteredOrders.map((order) => (
              <li
                key={order.id}
                className="rounded-lg border bg-white px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{order.product_name}</p>
                    <p className="text-xs text-zinc-500">
                      代切 ID：{order.proxy_id}
                    </p>
                  </div>
                  <div className="text-right text-sm font-medium">
                    ￥{order.amount.toFixed(2)}
                  </div>
                </div>
                <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                  <span>状态：{STATUS_LABEL[order.status] ?? order.status}</span>
                  <span>{formatDate(order.created_at)}</span>
                </div>
                {order.product_url && (
                  <a
                    href={order.product_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-blue-600 underline underline-offset-4"
                  >
                    查看商品链接
                  </a>
                )}

                {order.images && order.images.length > 0 && (
                  <div className="mt-3 space-y-1 border-t pt-2">
                    <p className="text-xs font-medium text-zinc-700">返图</p>
                    <div className="flex flex-wrap gap-2">
                      {order.images.map((img) => {
                        const publicUrl = createClient()
                          .storage.from("order-images")
                          .getPublicUrl(img.image_path).data.publicUrl;

                        const handleClick = () => {
                          if (publicUrl) {
                            setPreviewUrl(publicUrl);
                          }
                        };

                        return (
                          <button
                            key={img.id}
                            type="button"
                            onClick={handleClick}
                            className="inline-block"
                          >
                            <img
                              src={publicUrl}
                              alt="返图"
                              className="h-16 w-16 rounded-md object-cover"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
      {previewUrl && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewUrl(null)}
        >
          <div
            className="max-h-[90vh] max-w-[90vw]"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={previewUrl}
              alt="返图大图"
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
}

