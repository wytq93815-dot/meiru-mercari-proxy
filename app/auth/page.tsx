"use client";

import { createClient } from "@/lib/supabaseClient";
import { nanoid } from "nanoid";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Mode = "login" | "register";
type Role = "proxy" | "buyer";

export default function AuthPage() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("login");
  const [role, setRole] = useState<Role>("proxy");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [proxyIdInput, setProxyIdInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // 已登录用户自动跳转
  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.role === "proxy") {
        router.replace("/dashboard/orders");
      } else if (profile?.role === "buyer") {
        router.replace("/buyer/orders");
      }
    };
    void check();
  }, [router]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const supabase = createClient();

    if (mode === "login") {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      const user = data.user;
      if (!user) {
        setError("登录失败，请重试。");
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.role === "proxy") {
        router.replace("/dashboard/orders");
      } else if (profile?.role === "buyer") {
        router.replace("/buyer/orders");
      } else {
        router.replace("/");
      }

      setLoading(false);
      return;
    }

    // 注册流程：先尝试创建 Auth 用户
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });

    // signUp 失败（例如邮箱格式、已存在等）
    if (error || !data.user) {
      // 已存在用户的情况，给出更友好的提示
      if (error?.message?.toLowerCase().includes("user already registered")) {
        setError("该邮箱已注册，请直接使用登录。如无法登录，可先通过“忘记密码”重置。");
      } else {
        setError(error?.message ?? "注册失败");
      }
      setLoading(false);
      return;
    }

    const userId = data.user.id;

    if (role === "proxy") {
      const generatedProxyId = `PX-${nanoid(8)}`;
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "proxy",
          proxy_id: generatedProxyId,
        });
      if (profileError) {
        // 如果 profile 已存在，说明之前注册流程部分成功，提示改为登录
        if (
          profileError.message
            .toLowerCase()
            .includes("duplicate key value violates unique constraint \"profiles_pkey\"")
        ) {
          setError(
            "该邮箱的账户资料已存在，请直接使用登录。如无法登录，可先通过“忘记密码”重置密码。"
          );
        } else {
          setError(profileError.message);
        }
        setLoading(false);
        return;
      }
      setSuccess(`注册成功，你的 Proxy_ID 是：${generatedProxyId}（请务必保存）`);
    } else {
      if (!proxyIdInput.trim()) {
        setError("请填写代切的 Proxy_ID");
        setLoading(false);
        return;
      }

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

      const { error: buyerProfileError } = await supabase
        .from("profiles")
        .insert({
          id: userId,
          role: "buyer",
          proxy_id: null,
        });
      if (buyerProfileError) {
        if (
          buyerProfileError.message
            .toLowerCase()
            .includes("duplicate key value violates unique constraint \"profiles_pkey\"")
        ) {
          setError(
            "该邮箱的账户资料已存在，请直接使用登录。如无法登录，可先通过“忘记密码”重置密码。"
          );
        } else {
          setError(buyerProfileError.message);
        }
        setLoading(false);
        return;
      }

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

    setLoading(false);
  };

  const handleResetPassword = async () => {
    setError(null);
    setSuccess(null);

    if (!email) {
      setError("请先在上方输入要重置的邮箱地址。");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess("重置密码邮件已发送，请前往邮箱查收并按提示完成修改。");
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-900">
              煤炉代切助手账户
            </h1>
            <p className="mt-1 text-xs text-zinc-500">
              使用同一账户可在不同设备上管理订单与返图。
            </p>
          </div>
        </div>

        {/* 模式切换 */}
        <div className="mb-4 inline-flex rounded-full border bg-zinc-50 p-1 text-xs font-medium text-zinc-600">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError(null);
              setSuccess(null);
            }}
            className={`w-20 rounded-full px-3 py-1 ${
              mode === "login" ? "bg-zinc-900 text-white" : ""
            }`}
          >
            登录
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("register");
              setError(null);
              setSuccess(null);
            }}
            className={`w-20 rounded-full px-3 py-1 ${
              mode === "register" ? "bg-zinc-900 text-white" : ""
            }`}
          >
            注册
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700">
              邮箱
            </label>
            <input
              type="email"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-zinc-700">
              密码
            </label>
            <input
              type="password"
              className="w-full rounded-md border px-3 py-2 text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {mode === "login" && (
            <button
              type="button"
              onClick={handleResetPassword}
              className="text-[11px] text-zinc-500 underline underline-offset-4"
              disabled={loading}
            >
              忘记密码？
            </button>
          )}

          {/* 角色选择仅在注册时可改 */}
          {mode === "register" && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                角色
              </label>
              <div className="flex gap-3 text-xs">
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    value="proxy"
                    checked={role === "proxy"}
                    onChange={() => setRole("proxy")}
                  />
                  <span>代切</span>
                </label>
                <label className="inline-flex items-center gap-1">
                  <input
                    type="radio"
                    value="buyer"
                    checked={role === "buyer"}
                    onChange={() => setRole("buyer")}
                  />
                  <span>买家</span>
                </label>
              </div>
            </div>
          )}

          {mode === "register" && role === "buyer" && (
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                代切 Proxy_ID
              </label>
              <input
                type="text"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={proxyIdInput}
                onChange={(e) => setProxyIdInput(e.target.value)}
                required
              />
              <p className="text-[11px] text-zinc-500">
                请向你的代切索取 Proxy_ID，并准确填写。
              </p>
            </div>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {success && <p className="text-xs text-green-600">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 flex w-full items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading
              ? mode === "login"
                ? "登录中..."
                : "注册中..."
              : mode === "login"
              ? "登录"
              : "注册"}
          </button>
        </form>
      </div>
    </div>
  );
}

