"use client";

import { useRouter } from "@/i18n/routing";
import { type ReactNode } from "react";

interface ClientRouterHandlerProps {
  children: (router: ReturnType<typeof useRouter>) => ReactNode;
}

export function ClientRouterHandler({ children }: ClientRouterHandlerProps) {
  const router = useRouter();
  return <>{children(router)}</>;
}
