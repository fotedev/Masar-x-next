import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Card, CardContent } from "./ui";
import { Users } from "lucide-react";
import { toast } from "react-hot-toast";
import { useEnrollments } from "@/hooks/useEnrollments";
import { EnrollmentFilters } from "./enrollments/EnrollmentFilters";
import { EnrollmentCard } from "./enrollments/EnrollmentCard";
import { ProofImageModal } from "./enrollments/ProofImageModal";

interface EnrollmentsTabProps {
  instructorId?: string;
}

export function EnrollmentsTab({ instructorId }: EnrollmentsTabProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const { enrollments, loading, processing, handleAction } = useEnrollments({
    instructorId,
  });

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
      <EnrollmentFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
      />

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
            <EnrollmentCard
              key={enrollment.id}
              enrollment={enrollment}
              onViewImage={handleViewImage}
              onAction={handleAction}
              processingId={processing}
            />
          ))
        )}
      </div>

      <ProofImageModal
        imageUrl={selectedImage}
        onClose={() => setSelectedImage(null)}
      />
    </div>
  );
}
