"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/auth");
  }, [router]);

  // 首页只负责重定向到 /auth
  return null;
}
