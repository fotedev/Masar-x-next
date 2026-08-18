import { useCallback } from "react";
import { supabase } from "../lib/supabase";
import { Appeal } from "../types/database";
import { useNotifications } from "./useNotifications";
import { useAuth } from "../contexts/AuthContext";
import { confirmToast } from "../lib/confirmToast";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAppeals() {
  const queryClient = useQueryClient();
  const { notifyUser } = useNotifications();
  const { user } = useAuth();

  const { data: appeals = [], isLoading: loading, refetch: fetchAppeals } = useQuery({
    queryKey: ["appeals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appeals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);

      if (error) throw error;
      return (data as Appeal[]) || [];
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const addAppealMutation = useMutation({
    mutationFn: async (appealData: Partial<Appeal>) => {
      const { error } = await supabase.from("appeals").insert(appealData);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      toast.success("تم إرسال طعنك بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء إرسال الطعن");
    },
  });

  const deleteAppealMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appeals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      toast.success("تم حذف الطعن بنجاح");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الطعن");
    },
  });

  const updateAppealStatusMutation = useMutation({
    mutationFn: async ({
      id,
      status,
      userId,
      contentTitle,
    }: {
      id: string;
      status: "accepted" | "rejected";
      userId: string;
      contentTitle: string;
    }) => {
      const { error } = await supabase
        .from("appeals")
        .update({ status, reviewed_by: user?.id })
        .eq("id", id);

      if (error) throw error;

      return { id, status, userId, contentTitle };
    },
    onSuccess: ({ id, status, userId, contentTitle }) => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      
      const title = status === "accepted" ? "تم قبول طعنك!" : "تم رفض طعنك.";
      const message = status === "accepted" 
        ? `تم قبول طعنك على ${contentTitle}. شكرا لمساهمتك. `
        : `تم رفض طعنك على ${contentTitle}. يمكنك مراجعة السبب إذا تم توفيره. `;

      notifyUser(
        userId,
        title,
        message,
        "appeal_status_update",
        id,
        "appeal"
      );
    },
    onError: (_, { status }) => {
      toast.error(`حدث خطأ أثناء ${status === "accepted" ? "قبول" : "رفض"} الطعن`);
    },
  });

  const deleteAppeal = useCallback(async (id: string) => {
    const confirmed = await confirmToast("هل أنت متأكد أنك تريد حذف هذا الطعن؟", {
      confirmLabel: "حذف",
      cancelLabel: "إلغاء",
    });
    if (confirmed) {
      await deleteAppealMutation.mutateAsync(id);
    }
  }, [deleteAppealMutation]);

  const acceptAppeal = useCallback(async (id: string, userId: string, contentTitle: string) => {
    const confirmed = await confirmToast("هل أنت متأكد أنك تريد قبول هذا الطعن؟", {
      confirmLabel: "قبول",
      cancelLabel: "إلغاء",
    });
    if (confirmed) {
      await updateAppealStatusMutation.mutateAsync({ id, status: "accepted", userId, contentTitle });
    }
  }, [updateAppealStatusMutation]);

  const rejectAppeal = useCallback(async (id: string, userId: string, contentTitle: string) => {
    const confirmed = await confirmToast("هل أنت متأكد أنك تريد رفض هذا الطعن؟", {
      confirmLabel: "رفض",
      cancelLabel: "إلغاء",
    });
    if (confirmed) {
      await updateAppealStatusMutation.mutateAsync({ id, status: "rejected", userId, contentTitle });
    }
  }, [updateAppealStatusMutation]);

  return {
    appeals,
    loading,
    fetchAppeals: () => fetchAppeals(),
    addAppeal: (data: Partial<Appeal>) => addAppealMutation.mutateAsync(data),
    deleteAppeal,
    acceptAppeal,
    rejectAppeal,
  };
}
