import { useCallback } from "react";
import { useTranslations } from "next-intl";
import { supabase } from "../lib/supabase";
import { Appeal } from "../types/database";
import { useNotifications } from "./useNotifications";
import { useAuth } from "../contexts/AuthContext";
import { confirmToast } from "../lib/confirmToast";
import { toast } from "sonner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAppeals() {
  const t = useTranslations("appeals");
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
      toast.success(t("manage.addSuccess"));
    },
    onError: () => {
      toast.error(t("manage.addError"));
    },
  });

  const deleteAppealMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appeals").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appeals"] });
      toast.success(t("manage.deleteSuccess"));
    },
    onError: () => {
      toast.error(t("manage.deleteError"));
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
      
      const title = status === "accepted" ? t("manage.acceptedTitle") : t("manage.rejectedTitle");
      const message = status === "accepted"
        ? t("manage.acceptedMessage", { title: contentTitle })
        : t("manage.rejectedMessage", { title: contentTitle });

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
      toast.error(t("manage.statusUpdateError", { action: status === "accepted" ? t("manage.actionAccepted") : t("manage.actionRejected") }));
    },
  });

  const deleteAppeal = useCallback(async (id: string) => {
    const confirmed = await confirmToast(t("manage.confirmDelete"), {
      confirmLabel: t("card.delete"),
      cancelLabel: t("cancel"),
    });
    if (confirmed) {
      await deleteAppealMutation.mutateAsync(id);
    }
  }, [deleteAppealMutation, t]);

  const acceptAppeal = useCallback(async (id: string, userId: string, contentTitle: string) => {
    const confirmed = await confirmToast(t("manage.confirmAccept"), {
      confirmLabel: t("card.accept"),
      cancelLabel: t("cancel"),
    });
    if (confirmed) {
      await updateAppealStatusMutation.mutateAsync({ id, status: "accepted", userId, contentTitle });
    }
  }, [updateAppealStatusMutation, t]);

  const rejectAppeal = useCallback(async (id: string, userId: string, contentTitle: string) => {
    const confirmed = await confirmToast(t("manage.confirmReject"), {
      confirmLabel: t("card.reject"),
      cancelLabel: t("cancel"),
    });
    if (confirmed) {
      await updateAppealStatusMutation.mutateAsync({ id, status: "rejected", userId, contentTitle });
    }
  }, [updateAppealStatusMutation, t]);

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
