"use client";

import { createClient } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hasSession, setHasSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const check = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        setHasSession(true);
      }
      setLoading(false);
    };
    void check();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!password || password.length < 6) {
      setError("新密码长度至少 6 位。");
      setSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致。");
      setSubmitting(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    // 重置完成后立即登出，强制回到登录页
    await supabase.auth.signOut();

    setSuccess("密码已重置，请使用新密码重新登录。");
    setSubmitting(false);
    setTimeout(() => {
      router.replace("/auth");
    }, 800);
  };

  return (
    <div className="flex min-h-[calc(100vh-48px)] items-center justify-center bg-zinc-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">重置密码</h1>
        <p className="mt-1 text-xs text-zinc-500">
          通过邮箱中的链接进入本页面后，设置你的新密码。
        </p>

        {loading ? (
          <p className="mt-4 text-sm text-zinc-500">加载中...</p>
        ) : !hasSession ? (
          <p className="mt-4 text-sm text-red-600">
            链接无效或已过期，请在登录页面重新点击“忘记密码”获取新的邮件。
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                新密码
              </label>
              <input
                type="password"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-700">
                确认新密码
              </label>
              <input
                type="password"
                className="w-full rounded-md border px-3 py-2 text-sm"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && <p className="text-xs text-red-600">{error}</p>}
            {success && <p className="text-xs text-green-600">{success}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 flex w-full items-center justify-center rounded-md bg-black px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
            >
              {submitting ? "提交中..." : "确认修改密码"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

