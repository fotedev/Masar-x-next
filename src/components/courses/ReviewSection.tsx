import React from "react";
import { Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

interface Review {
  id: string;
  rating: number;
  content?: string;
  student_name?: string;
}

interface ReviewSectionProps {
  reviews: Review[];
}

export function ReviewSection({ reviews }: ReviewSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Star className="w-5 h-5 ml-2 text-yellow-500" />
          التقييمات والآراء
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center py-8">لا توجد تقييمات بعد</p>
        ) : (
          <div className="space-y-6">
            {reviews.map((r) => (
              <div
                key={r.id}
                className="border-b border-gray-100 dark:border-gray-800 last:border-0 pb-6 last:pb-0"
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="font-semibold">{r.student_name}</div>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-4 h-4 ${s <= r.rating ? "text-yellow-500 fill-yellow-500" : "text-gray-300"}`}
                      />
                    ))}
                  </div>
                </div>
                {r.content && (
                  <p className="text-gray-600 dark:text-gray-400 text-sm">
                    {r.content}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
