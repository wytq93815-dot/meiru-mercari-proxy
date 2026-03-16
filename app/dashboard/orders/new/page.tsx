"use client";

import { createClient } from "@/lib/supabaseClient";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

type BuyerOption = {
  id: string;
  name?: string | null;
};

const ORDER_STATUS_OPTIONS = [
  { value: "ordered", label: "已下单" },
  { value: "received_from_mercari", label: "已收货" },
  { value: "shipped_to_buyer", label: "已发往国内" },
  { value: "buyer_received", label: "买家已收货" },
];

export default function NewOrderPage() {
  const router = useRouter();
  const [buyers, setBuyers] = useState<BuyerOption[]>([]);
  const [selectedBuyer, setSelectedBuyer] = useState<string>("");
  const [productUrl, setProductUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<string>("ordered");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const load = async () => {
      setLoading(true);
      setError(null);

      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error || !user) {
        setError("请先登录为代切账号。");
        setLoading(false);
        return;
      }

      const { data: connections, error: connectionsError } = await supabase
        .from("connections")
        .select("buyer_id")
        .eq("proxy_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (connectionsError) {
        setError(connectionsError.message);
        setLoading(false);
        return;
      }
      const buyerIds =
        (connections as { buyer_id: string }[])?.map((c) => c.buyer_id) ?? [];

      if (buyerIds.length === 0) {
        setBuyers([]);
        setLoading(false);
        return;
      }

      const { data: buyerProfiles, error: buyerProfilesError } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", buyerIds);

      if (buyerProfilesError) {
        setError(buyerProfilesError.message);
        setLoading(false);
        return;
      }

      const buyerOptions: BuyerOption[] = buyerIds.map((id) => {
        const profile = (buyerProfiles as { id: string; display_name?: string | null }[]).find(
          (p) => p.id === id
        );
        return {
          id,
          name: profile?.display_name ?? null,
        };
      });

      setBuyers(buyerOptions);
      if (buyerOptions.length > 0) {
        setSelectedBuyer(buyerOptions[0].id);
      }

      setLoading(false);
    };

    void load();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!selectedBuyer) {
      setError("请先选择一个买家。");
      setSubmitting(false);
      return;
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setError("请输入正确的金额。");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("请先登录。");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from("orders").insert({
      proxy_id: user.id,
      buyer_id: selectedBuyer,
      product_url: productUrl || null,
      product_name: productName,
      amount: numericAmount,
      status,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    setSuccess("订单已创建。正在返回订单列表...");
    setSubmitting(false);
    setTimeout(() => {
      router.push("/dashboard/orders");
    }, 800);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <header className="flex items-center justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-semibold">新建订单</h1>
          <p className="mt-1 text-sm text-zinc-600">
            为已绑定买家创建一条新的煤炉订单，所有字段均为手动录入。
          </p>
        </div>
        <Link
          href="/dashboard/orders"
          className="text-xs text-zinc-600 underline underline-offset-4"
        >
          返回订单列表
        </Link>
      </header>

      {loading ? (
        <p className="text-sm text-zinc-500">加载中...</p>
      ) : buyers.length === 0 ? (
        <p className="text-sm text-zinc-500">
          你当前还没有已绑定买家，请先在「管理买家」中接受绑定申请。
        </p>
      ) : (
        <section className="space-y-4 rounded-xl border bg-white p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium">
                选择买家（按名字）
              </label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={selectedBuyer}
                onChange={(e) => setSelectedBuyer(e.target.value)}
              >
                {buyers.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name ? `${b.name}` : b.id}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                煤炉商品 URL（可选）
              </label>
              <input
                type="url"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">
                商品名称（手动输入）
              </label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">金额</label>
              <input
                type="number"
                min={0}
                step="0.01"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">状态</label>
              <select
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ORDER_STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            {success && <p className="text-sm text-green-600">{success}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "创建中..." : "创建订单"}
            </button>
          </form>
        </section>
      )}
    </div>
  );
}

