"use client";

import { useRouter } from '@/navigation';
import { type ReactNode } from "react";

interface ClientRouterHandlerProps {
  children: (router: ReturnType<typeof useRouter>) => ReactNode;
}

export function ClientRouterHandler({ children }: ClientRouterHandlerProps) {
  const router = useRouter();
  return <>{children(router)}</>;
}
