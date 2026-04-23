"use client";

export const ADMIN_UIDS = ["X4kOwvUI62NCseuMpqgrqvsFgdm2"];

export function isAdminUid(uid?: string | null) {
  return !!uid && ADMIN_UIDS.includes(uid);
}
