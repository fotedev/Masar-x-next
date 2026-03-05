'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/privacy-policy');
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto mb-4"></div>
        <p className="text-slate-600 dark:text-slate-400">جاري التحويل إلى سياسة الخصوصية...</p>
      </div>
    </div>
  );
}