"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 兼容旧链接：直接重定向到新的统一登录/注册页面 /auth
export default function LegacyLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth");
  }, [router]);

  return null;
}
