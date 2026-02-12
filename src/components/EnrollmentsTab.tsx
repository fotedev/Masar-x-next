import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { supabase } from "../lib/supabase";
import { Card, CardContent, Button, Badge } from "./ui";
import { Users, CheckCircle, XCircle, Clock, Eye, Search } from "lucide-react";
import { toast } from "react-hot-toast";

interface Enrollment {
  id: string;
  status: "pending" | "active" | "rejected";
  payment_screenshot_url?: string;
  created_at: string;
  course_id: string;
  course_title: string;
  student_name: string;
  instructor_id?: string;
}

interface EnrollmentsTabProps {
  instructorId?: string; // If provided, only show enrollments for this instructor's courses
}

export function EnrollmentsTab({ instructorId }: EnrollmentsTabProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const fetchEnrollments = useCallback(async () => {
    try {
      setLoading(true);

      let query = supabase.from("enrollments").select(`
          *,
          courses!inner (
            title,
            instructor_id
          ),
          profiles:student_id (
            display_name
          )
        `);

      if (instructorId) {
        query = query.eq("courses.instructor_id", instructorId);
      }

      const { data, error } = await query.order("created_at", {
        ascending: false,
      });

      if (error) throw error;

      if (data) {
        interface RawEnrollment {
          id: string;
          status: "pending" | "active" | "rejected";
          payment_screenshot_url?: string;
          created_at: string;
          course_id: string;
          student_id: string;
          courses?: {
            title: string;
            instructor_id: string;
          };
          profiles?: {
            display_name: string;
          };
        }

        const formattedData = (data as RawEnrollment[]).map((e) => ({
          ...e,
          course_title: e.courses?.title || "كورس غير محدد",
          student_name: e.profiles?.display_name || "طالب",
          instructor_id: e.courses?.instructor_id,
        }));
        setEnrollments(formattedData);
      }
    } catch {
      // ignore
    } finally {
      toast.error("حدث خطأ في تحميل طلبات التسجيل");
      setLoading(false);
    }
  }, [instructorId]);

  useEffect(() => {
    fetchEnrollments();
  }, [fetchEnrollments]);

  const handleViewImage = async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("payment-proofs")
        .createSignedUrl(path, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        setSelectedImage(data.signedUrl);
      }
    } catch {
      toast.error("حدث خطأ في عرض الصورة");
    }
  };

  const handleAction = async (
    enrollmentId: string,
    action: "approve" | "reject",
  ) => {
    try {
      setProcessing(enrollmentId);
      const newStatus = action === "approve" ? "active" : "rejected";

      const { error } = await supabase
        .from("enrollments")
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", enrollmentId);

      if (error) throw error;

      toast.success(
        action === "approve" ? "تم قبول الطلب بنجاح" : "تم رفض الطلب",
      );
      fetchEnrollments();
    } catch {
      toast.error("حدث خطأ في معالجة الطلب");
    } finally {
      setProcessing(null);
    }
  };

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

  const filteredEnrollments = enrollments.filter((e) => {
    const matchesSearch =
      e.student_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.course_title.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter = activeFilter === "all" || e.status === activeFilter;

    return matchesSearch && matchesFilter;
  });

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">
          جاري تحميل الطلبات...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="بحث باسم الطالب أو الكورس..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pr-10 pl-4 py-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
          {["all", "pending", "active", "rejected"].map((filter) => (
            <Button
              key={filter}
              variant={activeFilter === filter ? "default" : "outline"}
              size="sm"
              onClick={() => setActiveFilter(filter)}
              className="whitespace-nowrap"
            >
              {filter === "all"
                ? "الكل"
                : filter === "pending"
                  ? "في الانتظار"
                  : filter === "active"
                    ? "نشط"
                    : "مرفوض"}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {filteredEnrollments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">
                لا توجد طلبات تسجيل مطابقة
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredEnrollments.map((enrollment) => (
            <Card key={enrollment.id} className="overflow-hidden">
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
                        {new Date(enrollment.created_at).toLocaleDateString(
                          "ar-EG",
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto justify-end">
                    {enrollment.payment_screenshot_url && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleViewImage(enrollment.payment_screenshot_url!)
                        }
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
                          disabled={processing === enrollment.id}
                          onClick={() => handleAction(enrollment.id, "approve")}
                        >
                          <CheckCircle className="w-4 h-4 ml-1" />
                          قبول
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          disabled={processing === enrollment.id}
                          onClick={() => handleAction(enrollment.id, "reject")}
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
          ))
        )}
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="max-w-4xl w-full h-[90vh] relative"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={selectedImage}
              alt="إثبات الدفع"
              fill
              className="object-contain rounded-lg shadow-2xl"
              unoptimized
            />
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            >
              <XCircle className="w-8 h-8" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
