import React from "react";
import { Card, CardContent, Button, Badge } from "../ui";
import { CheckCircle, XCircle, Clock, Eye } from "lucide-react";

type Enrollment = {
  id: string;
  student_name: string;
  course_title: string;
  created_at: string;
  status: string;
  payment_screenshot_url?: string | null;
};

interface EnrollmentCardProps {
  enrollment: Enrollment;
  onViewImage: (path: string) => void;
  onAction: (id: string, action: "approve" | "reject") => void;
  processingId: string | null;
}

export function EnrollmentCard({
  enrollment,
  onViewImage,
  onAction,
  processingId,
}: EnrollmentCardProps) {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="w-3 h-3 ml-1" />
            نشط
          </Badge>
        );
      case "pending":
        return (
          <Badge className="bg-yellow-100 text-yellow-800">
            <Clock className="w-3 h-3 ml-1" />
            في الانتظار
          </Badge>
        );
      case "rejected":
        return (
          <Badge className="bg-red-100 text-red-800">
            <XCircle className="w-3 h-3 ml-1" />
            مرفوض
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col md:flex-row items-center p-4 gap-4">
          <div className="flex-1 min-w-0 w-full">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">
                  {enrollment.student_name}
                </h3>
              </div>
              {getStatusBadge(enrollment.status)}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-blue-600 dark:text-blue-400">
                {enrollment.course_title}
              </span>
              <span>•</span>
              <span>
                {new Date(enrollment.created_at).toLocaleDateString("ar-EG")}
              </span>
            </div>
          </div>

          <div className="flex gap-2 w-full md:w-auto justify-end">
            {enrollment.payment_screenshot_url && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewImage(enrollment.payment_screenshot_url!)}
              >
                <Eye className="w-4 h-4 ml-1" />
                عرض الإثبات
              </Button>
            )}

            {enrollment.status === "pending" && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700"
                  disabled={processingId === enrollment.id}
                  onClick={() => onAction(enrollment.id, "approve")}
                >
                  <CheckCircle className="w-4 h-4 ml-1" />
                  قبول
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={processingId === enrollment.id}
                  onClick={() => onAction(enrollment.id, "reject")}
                >
                  <XCircle className="w-4 h-4 ml-1" />
                  رفض
                </Button>
              </>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
