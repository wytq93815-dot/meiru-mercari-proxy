"use client";

import { createClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { useEffect, useState } from "react";

type OrderRow = {
  id: string;
  buyer_id: string;
  buyer_name?: string | null;
  product_name: string;
  product_url: string | null;
  amount: number;
  status: string;
  created_at: string;
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

const STATUS_OPTIONS = [
  { value: "ordered", label: "已下单" },
  { value: "received_from_mercari", label: "已收货" },
  { value: "shipped_to_buyer", label: "已发往国内" },
  { value: "buyer_received", label: "买家已收货" },
];

export default function OrdersPage() {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [savingStatusId, setSavingStatusId] = useState<string | null>(null);
  const [filterBuyerId, setFilterBuyerId] = useState<string>("all");
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
        setError("请先登录为代切账号。");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || profile.role !== "proxy") {
        setError("只有代切账号可以访问此页面。");
        setLoading(false);
        return;
      }

      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(
          "id, buyer_id, product_name, product_url, amount, status, created_at, order_images ( id, image_path )"
        )
        .eq("proxy_id", user.id)
        .order("created_at", { ascending: false });

      if (ordersError) {
        setError(ordersError.message);
        setLoading(false);
        return;
      }

      const raw = (ordersData as any[]) ?? [];

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

      const mapped: OrderRow[] =
        raw.map((row) => {
          const profile = buyerProfiles.find((p) => p.id === row.buyer_id);
          return {
            id: row.id,
            buyer_id: row.buyer_id,
            buyer_name: profile?.display_name ?? null,
            product_name: row.product_name,
            product_url: row.product_url,
            amount: row.amount,
            status: row.status,
            created_at: row.created_at,
            images: row.order_images ?? [],
          };
        }) ?? [];

      setOrders(mapped);
      setLoading(false);
    };

    void load();
  }, []);

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString(undefined, {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  const handleUpload = async (orderId: string, file: File | null) => {
    if (!file) return;
    setUploadingId(orderId);

    const supabase = createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("请先登录。");
      setUploadingId(null);
      return;
    }

    const ext = file.name.split(".").pop() || "jpg";
    const filePath = `${user.id}/${orderId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("order-images")
      .upload(filePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setUploadingId(null);
      return;
    }

    const { error: insertError } = await supabase
      .from("order_images")
      .insert({ order_id: orderId, image_path: filePath });

    if (insertError) {
      setError(insertError.message);
      setUploadingId(null);
      return;
    }

    setUploadingId(null);

    const { data: refreshed, error: refreshError } = await supabase
      .from("orders")
      .select(
        "id, buyer_id, product_name, product_url, amount, status, created_at, order_images ( id, image_path )"
      )
      .eq("proxy_id", user.id)
      .order("created_at", { ascending: false });

    if (!refreshError && refreshed) {
      const raw = (refreshed as any[]) ?? [];

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

      const mapped: OrderRow[] =
        raw.map((row) => {
          const profile = buyerProfiles.find((p) => p.id === row.buyer_id);
          return {
            id: row.id,
            buyer_id: row.buyer_id,
            buyer_name: profile?.display_name ?? null,
            product_name: row.product_name,
            product_url: row.product_url,
            amount: row.amount,
            status: row.status,
            created_at: row.created_at,
            images: row.order_images ?? [],
          };
        }) ?? [];

      setOrders(mapped);
    }
  };

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    setSavingStatusId(orderId);
    const supabase = createClient();

    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId);

    if (error) {
      setError(error.message);
      setSavingStatusId(null);
      return;
    }

    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              status: nextStatus,
            }
          : o
      )
    );

    setSavingStatusId(null);
  };

  const handleDeleteImage = async (orderId: string, imageId: string, imagePath: string) => {
    setDeletingImageId(imageId);
    const supabase = createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("请先登录。");
      setDeletingImageId(null);
      return;
    }

    // 先删存储里的文件（忽略不存在的错误）
    await supabase.storage.from("order-images").remove([imagePath]);

    // 再删数据库记录
    const { error: deleteError } = await supabase
      .from("order_images")
      .delete()
      .eq("id", imageId)
      .eq("order_id", orderId);

    if (deleteError) {
      setError(deleteError.message);
      setDeletingImageId(null);
      return;
    }

    // 本地状态里移除这张图，避免整页重载
    setOrders((prev) =>
      prev.map((o) =>
        o.id === orderId
          ? {
              ...o,
              images: o.images?.filter((img) => img.id !== imageId),
            }
          : o
      )
    );

    setDeletingImageId(null);
  };

  const filteredOrders = orders.filter((o) => {
    const matchBuyer = filterBuyerId === "all" || o.buyer_id === filterBuyerId;
    const matchStatus = filterStatus === "all" || o.status === filterStatus;
    return matchBuyer && matchStatus;
  });

  const uniqueBuyers = Array.from(
    new Map(
      orders.map((o) => [
        o.buyer_id,
        {
          id: o.buyer_id,
          name: o.buyer_name ?? "",
        },
      ])
    ).values()
  );

  return (
    <div className="relative mx-auto flex max-w-4xl flex-col gap-6 px-2 py-5 md:px-4 md:py-8">
      <header>
        <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-orange-500 to-orange-400 p-4 text-white shadow-sm md:p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-lg font-semibold md:text-xl">订单管理 · 代切</h1>
              <p className="mt-1 text-[11px] md:text-xs text-orange-50/90">
                统一查看和维护你名下的全部煤炉订单，支持状态流转与返图上传。
              </p>
            </div>
          </div>
        </div>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">加载中...</p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : (
        <section className="space-y-3 rounded-xl border bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <h2 className="text-lg font-medium">订单列表</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">买家</span>
                <select
                  className="rounded-md border px-2 py-1"
                  value={filterBuyerId}
                  onChange={(e) => setFilterBuyerId(e.target.value)}
                >
                  <option value="all">全部</option>
                  {uniqueBuyers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name ? `${b.name}（${b.id}）` : b.id}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-zinc-500">状态</span>
                <select
                  className="rounded-md border px-2 py-1"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                >
                  <option value="all">全部</option>
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          {filteredOrders.length === 0 ? (
            <p className="text-sm text-zinc-500">当前还没有订单。</p>
          ) : (
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
                        买家：
                        {order.buyer_name
                          ? `${order.buyer_name}（${order.buyer_id}）`
                          : order.buyer_id}
                      </p>
                    </div>
                    <div className="text-right text-sm font-medium">
                      ￥{order.amount.toFixed(2)}
                    </div>
                  </div>
                  <div className="mt-1 flex flex-col justify-between gap-1 text-xs text-zinc-500 md:flex-row md:items-center">
                    <div className="flex items-center gap-2">
                      <span>状态：</span>
                      <select
                        className="rounded-md border px-2 py-1 text-xs text-zinc-800"
                        value={order.status}
                        onChange={(e) =>
                          handleStatusChange(order.id, e.target.value)
                        }
                        disabled={savingStatusId === order.id}
                      >
                        {STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <span className="text-zinc-400">
                        （当前：{STATUS_LABEL[order.status] ?? order.status}）
                      </span>
                    </div>
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
                      <div className="text-xs font-medium text-zinc-700">
                        已上传返图
                      </div>
                      <div className="flex flex-wrap gap-3">
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
                            <div
                              key={img.id}
                              className="flex flex-col items-center gap-1"
                            >
                              <button
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
                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteImage(
                                    order.id,
                                    img.id,
                                    img.image_path
                                  )
                                }
                                disabled={deletingImageId === img.id}
                                className="rounded-full border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                              >
                                {deletingImageId === img.id ? "删除中..." : "删除返图"}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  <div className="mt-2 border-t pt-2">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="text-xs text-zinc-500">
                        上传返图（仅代切可见，买家会在自己的页面看到缩略图）
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) =>
                            handleUpload(
                              order.id,
                              e.target.files?.[0] ?? null
                            )
                          }
                          className="text-xs text-transparent file:mr-2 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-2 file:py-1 file:text-xs file:text-zinc-700 hover:file:bg-zinc-50 hover:file:text-zinc-900"
                        />
                        {uploadingId === order.id && (
                          <span className="text-xs text-zinc-500">
                            上传中...
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
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

