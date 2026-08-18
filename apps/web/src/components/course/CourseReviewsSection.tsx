
import { Card, CardContent, CardHeader, CardTitle, Button } from "../ui";
import { Star } from "lucide-react";
import type { Review, EnrollmentStatus } from "./types";
import { useTranslations, useLocale } from "next-intl";

interface CourseReviewsSectionProps {
  reviews: Review[];
  enrollmentStatus: EnrollmentStatus;
  onAddReview: () => void;
}

export default function CourseReviewsSection({
  reviews,
  enrollmentStatus,
  onAddReview,
}: CourseReviewsSectionProps) {
  const t = useTranslations("courseDetail.reviews");
  const locale = useLocale();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{t("title")}</span>
          {enrollmentStatus === "active" && (
            <Button variant="outline" size="sm" onClick={onAddReview}>
              <Star className="w-4 h-4 ml-1" />
              {t("addReview")}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {reviews.length === 0 ? (
          <p className="text-gray-500 text-center py-8">{t("empty")}</p>
        ) : (
          <div className="space-y-4">
            {reviews.map((review) => (
              <div
                key={review.id}
                className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-b-0"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center">
                    <div className="flex">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${
                            i < review.rating
                              ? "text-yellow-400 fill-current"
                              : "text-gray-300"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400 mr-2">
                      {review.student_name || t("anonymous")}
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(review.created_at).toLocaleDateString(
                      locale === "ar" ? "ar-EG" : "en-US",
                    )}
                  </span>
                </div>
                {review.content && (
                  <p className="text-gray-700 dark:text-gray-300">
                    {review.content}
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
