
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Button,
} from "../ui";
import { Upload } from "lucide-react";
import type { Course } from "./types";

interface SubscribeModalProps {
  isOpen: boolean;
  course: Course;
  paymentScreenshot: File | null;
  uploading: boolean;
  onClose: () => void;
  onFileChange: (file: File | null) => void;
  onSubmit: () => void;
}

export default function SubscribeModal({
  isOpen,
  course,
  paymentScreenshot,
  uploading,
  onClose,
  onFileChange,
  onSubmit,
}: SubscribeModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>التسجيل في الكورس</CardTitle>
          <CardDescription>
            يرجى رفع إثبات دفع للكورس ({course.price} جنيه مصري)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              إثبات الدفع (صورة أو لقطة شاشة)
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => onFileChange(e.target.files?.[0] || null)}
              className="w-full p-2 border rounded-lg"
            />
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              طريقة الدفع
            </h4>
            <p className="text-sm text-blue-800 dark:text-blue-200">
              يرجى تحويل المبلغ ثم رفع صورة إثبات الدفع. سيتم مراجعة طلبك خلال
              24-48 ساعة.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={onSubmit}
              disabled={!paymentScreenshot || uploading}
              className="flex-1"
            >
              {uploading ? (
                "جاري الرفع..."
              ) : (
                <>
                  <Upload className="w-4 h-4 ml-2" />
                  إرسال الطلب
                </>
              )}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={uploading}>
              إلغاء
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
