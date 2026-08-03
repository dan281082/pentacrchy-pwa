import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useModuleAuth } from "@/src/modules/shared/use-module-auth";

import { notificationApi } from "./api";
import { notificationKeys } from "./query-keys";
import { useNotificationStore } from "./store";
import type { DeviceRegistration, NotificationPreferences } from "./types";

export function useNotifications() {
  const { isAuthenticated } = useModuleAuth();
  return useQuery({
    queryKey: notificationKeys.inbox(),
    queryFn: () => notificationApi.getInbox(),
    enabled: isAuthenticated,
  });
}

export function useNotificationPreferences() {
  const { isAuthenticated } = useModuleAuth();
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationApi.getPreferences(),
    enabled: isAuthenticated,
  });
}

export function useUpdatePreferences() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (prefs: NotificationPreferences) => notificationApi.updatePreferences(prefs),
    onSuccess: (data) => qc.setQueryData(notificationKeys.preferences(), data),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  const markReadLocal = useNotificationStore((s) => s.markReadLocal);
  return useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onMutate: (id) => markReadLocal(id), // optimistic, safely reversible
    onSuccess: () => qc.invalidateQueries({ queryKey: notificationKeys.inbox() }),
  });
}

export function useRegisterDevice() {
  return useMutation({
    mutationFn: (reg: DeviceRegistration) => notificationApi.registerDevice(reg),
  });
}
