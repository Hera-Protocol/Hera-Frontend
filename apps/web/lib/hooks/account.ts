"use client";

import type { Role } from "@hera/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useMe } from "@/lib/queries";

/* ─── Roles ──────────────────────────────────────────── */

const RANK: Record<Role, number> = { viewer: 0, analyst: 1, admin: 2, owner: 3 };

/** The signed-in user's role in the current org, with the checks pages need. */
export function useRole() {
  const { data: me } = useMe();
  const role = me?.role;
  return {
    role,
    atLeast: (min: Role) => (role ? RANK[role] >= RANK[min] : false),
    isAdmin: role === "owner" || role === "admin",
    isOwner: role === "owner",
  };
}

/* ─── Notification preferences ───────────────────────── */

/**
 * `PATCH /v1/me/notifications` exists in the API but not in @hera/core, and
 * there is no GET. We remember the last value this browser saved so the
 * switch doesn't reset on reload; the API default is `true`.
 */
export interface NotificationPrefs {
  alertEmails: boolean;
}

const prefsKey = (userId: string) => ["me", "notifications", userId] as const;
const storageKey = (userId: string) => `hera:notifications:${userId}`;

function readStoredPrefs(userId: string): NotificationPrefs {
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
      if (typeof parsed.alertEmails === "boolean") return { alertEmails: parsed.alertEmails };
    }
  } catch {
    // Storage blocked or corrupt: fall back to the API default.
  }
  return { alertEmails: true };
}

function writeStoredPrefs(userId: string, prefs: NotificationPrefs) {
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch {
    // Not fatal: the server has the real value.
  }
}

export function useNotificationPrefs() {
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  return useQuery({
    queryKey: prefsKey(userId),
    queryFn: () => readStoredPrefs(userId),
    enabled: Boolean(userId),
    staleTime: Infinity,
  });
}

export function useUpdateNotifications() {
  const qc = useQueryClient();
  const { data: me } = useMe();
  const userId = me?.user.id ?? "";
  return useMutation({
    mutationFn: (input: NotificationPrefs) => api.patch<NotificationPrefs>("/me/notifications", input),
    onMutate: async (input) => {
      const previous = qc.getQueryData<NotificationPrefs>(prefsKey(userId));
      qc.setQueryData(prefsKey(userId), input);
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) qc.setQueryData(prefsKey(userId), context.previous);
    },
    onSuccess: (prefs) => {
      qc.setQueryData(prefsKey(userId), prefs);
      writeStoredPrefs(userId, prefs);
    },
  });
}

/* ─── "Show Argus" preference (per browser) ──────────── */

const ARGUS_KEY = "hera:show-argus";
/** Fired on window when the preference changes, so any mounted Argus can react. */
export const ARGUS_EVENT = "hera:show-argus-change";

function readShowArgus(): boolean {
  try {
    return window.localStorage.getItem(ARGUS_KEY) !== "false";
  } catch {
    return true;
  }
}

export function useShowArgus(): [boolean, (value: boolean) => void] {
  const [show, setShow] = useState(true);

  useEffect(() => {
    setShow(readShowArgus());
    const sync = () => setShow(readShowArgus());
    window.addEventListener(ARGUS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(ARGUS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((value: boolean) => {
    setShow(value);
    try {
      window.localStorage.setItem(ARGUS_KEY, String(value));
    } catch {
      // Storage blocked: the choice lasts for this page view only.
    }
    window.dispatchEvent(new Event(ARGUS_EVENT));
  }, []);

  return [show, update];
}
