'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AddPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/quizzes');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-dvh-safe">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">جاري التوجيه...</p>
      </div>
    </div>
  );
}
