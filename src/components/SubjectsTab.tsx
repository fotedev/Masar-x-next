import { useState, useMemo, useCallback } from "react";
import { GraduationCap } from "lucide-react";
import { Subject } from "../types/database";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { confirmToast } from "../lib/confirmToast";
import { useTranslations } from "next-intl";
import { SubjectFilters } from "./subjects-admin/SubjectFilters";
import { SubjectCard } from "./subjects-admin/SubjectCard";
import { logger } from "../lib/logger";

interface SubjectsTabProps {
  subjects: Subject[];
  onRefresh: () => void;
  onEdit: (subject: Subject) => void;
  onAdd: () => void;
  onManageLectures: (subject: Subject) => void;
}

export function SubjectsTab({
  subjects,
  onRefresh,
  onEdit,
  onAdd,
  onManageLectures,
}: SubjectsTabProps) {
  const tSubjectsTab = useTranslations("subjectsTab");
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("all");

  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchesSearch =
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.professor || "").toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [subjects, searchTerm, statusFilter]);

  const handleUpdateStatus = useCallback(
    async (id: string, status: "approved" | "rejected") => {
      try {
        const { error } = await supabase
          .from("subjects")
          .update({ status })
          .eq("id", id);
        if (error) throw error;
        onRefresh();
      } catch (error) {
        logger.error("Error updating subject status", error, { id, status });
        toast.error(tSubjectsTab("updateStatusError"));
      }
    },
    [onRefresh, tSubjectsTab],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      const confirmed = await confirmToast(tSubjectsTab("confirmDelete"), {
        confirmLabel: tSubjectsTab("delete"),
        cancelLabel: tSubjectsTab("cancel"),
      });
      if (!confirmed) return;
      try {
        const { error } = await supabase.from("subjects").delete().eq("id", id);
        if (error) throw error;
        onRefresh();
      } catch (error) {
        logger.error("Error deleting subject", error, { id });
        toast.error(tSubjectsTab("deleteError"));
      }
    },
    [onRefresh, tSubjectsTab],
  );

  return (
    <div className="space-y-6">
      <SubjectFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        onAdd={onAdd}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSubjects.map((subject) => (
          <SubjectCard
            key={subject.id}
            subject={subject}
            t={tSubjectsTab}
            onEdit={onEdit}
            onDelete={handleDelete}
            onManageLectures={onManageLectures}
            onUpdateStatus={handleUpdateStatus}
          />
        ))}
      </div>

      {filteredSubjects.length === 0 && (
        <div className="text-center py-20 bg-gray-50 dark:bg-gray-800/50 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700">
          <GraduationCap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-bold text-gray-900 dark:text-white">
            {tSubjectsTab("emptyTitle")}
          </h3>
          <p className="text-gray-50 dark:text-gray-400">
            {tSubjectsTab("emptyDescription")}
          </p>
        </div>
      )}
    </div>
  );
}
