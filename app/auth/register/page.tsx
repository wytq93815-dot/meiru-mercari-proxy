"use client";

import { createClient } from "@/lib/supabaseClient";
import { nanoid } from "nanoid";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"proxy" | "buyer">("proxy");
  const [proxyIdInput, setProxyIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error || !data.user) {
      setError(error?.message ?? "注册失败");
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    if (role === "proxy") {
      // 代切：生成唯一 Proxy_ID，写入 profiles
      const generatedProxyId = `PX-${nanoid(8)}`;

      const { error: profileError } = await supabase.from("profiles").insert({
        id: userId,
        role: "proxy",
        proxy_id: generatedProxyId,
      });

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setSuccess(`注册成功，你的 Proxy_ID 是：${generatedProxyId}（请务必保存）`);
    } else {
      // 买家：必须填写有效 Proxy_ID
      if (!proxyIdInput.trim()) {
        setError("请填写代切的 Proxy_ID");
        setLoading(false);
        return;
      }

      // 根据 proxy_id 查找代切用户
      const { data: proxyProfile, error: findProxyError } = await supabase
        .from("profiles")
        .select("id")
        .eq("proxy_id", proxyIdInput.trim())
        .eq("role", "proxy")
        .maybeSingle();

      if (findProxyError) {
        setError(findProxyError.message);
        setLoading(false);
        return;
      }

      if (!proxyProfile) {
        setError("未找到对应的代切 Proxy_ID，请确认后再试");
        setLoading(false);
        return;
      }

      const proxyUserId = proxyProfile.id;

      // 写入买家的 profile
      const { error: buyerProfileError } = await supabase.from("profiles").insert({
        id: userId,
        role: "buyer",
        proxy_id: null,
      });

      if (buyerProfileError) {
        setError(buyerProfileError.message);
        setLoading(false);
        return;
      }

      // 创建一条 pending 的连接
      const { error: connectionError } = await supabase.from("connections").insert({
        proxy_id: proxyUserId,
        buyer_id: userId,
        status: "pending",
      });

      if (connectionError) {
        setError(connectionError.message);
        setLoading(false);
        return;
      }

      setSuccess("注册成功，已向代切发起绑定申请，请等待对方在后台通过。");
    }

    setError(null);
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold">注册</h1>
        <div className="space-y-2">
          <label className="block text-sm font-medium">邮箱</label>
          <input
            type="email"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">密码</label>
          <input
            type="password"
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">角色</label>
          <select
            className="w-full rounded-md border px-3 py-2 text-sm"
            value={role}
            onChange={(e) => setRole(e.target.value as "proxy" | "buyer")}
          >
            <option value="proxy">代切</option>
            <option value="buyer">买家</option>
          </select>
        </div>
        {role === "buyer" && (
          <div className="space-y-2">
            <label className="block text-sm font-medium">代切 Proxy_ID</label>
            <input
              type="text"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={proxyIdInput}
              onChange={(e) => setProxyIdInput(e.target.value)}
              required={role === "buyer"}
            />
          </div>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {loading ? "注册中..." : "注册"}
        </button>
      </form>
    </div>
  );
}
