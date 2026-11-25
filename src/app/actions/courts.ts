"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { COURT_ISSUE_IDS, type CourtIssue, type CourtReportStatus } from "@/lib/courts";
import { getAuthUserId } from "@/lib/supabase/auth-user";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  too_many_reports: "Слишком много обращений за сутки. Попробуйте завтра.",
  report_closed: "Эта проблема уже закрыта.",
  not_admin: "Только для модераторов.",
  bad_photo: "Не удалось прикрепить фото.",
};
const errorText = (m?: string) => ERRORS[Object.keys(ERRORS).find((k) => m?.includes(k)) ?? ""] ?? "Что-то пошло не так. Попробуйте ещё раз.";

async function requireUser() {
  const supabase = await createClient();
  const uid = await getAuthUserId(supabase);
  if (!uid) redirect("/login");
  return { supabase, uid };
}

export async function reportCourtIssue(input: {
  venueId: string;
  cityId: number;
  venueName: string;
  lat: number;
  lng: number;
  kind: CourtIssue;
  comment: string;
  photoPath: string | null;
}) {
  if (!/^[a-z]\d{3,30}$/i.test(input.venueId) || !COURT_ISSUE_IDS.includes(input.kind)) return { ok: false as const, error: "Площадка не найдена" };
  if (![input.lat, input.lng].every(Number.isFinite) || Math.abs(input.lat) > 90 || Math.abs(input.lng) > 180) {
    return { ok: false as const, error: "Площадка не найдена" };
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("report_court_issue", {
    p_venue_id: input.venueId,
    p_city_id: input.cityId,
    p_venue_name: input.venueName.trim().slice(0, 120) || "Площадка",
    p_lat: input.lat,
    p_lng: input.lng,
    p_kind: input.kind,
    p_comment: input.comment.trim().slice(0, 300),
    p_photo_path: input.photoPath,
  });
  if (error || !data) return { ok: false as const, error: errorText(error?.message) };
  revalidatePath("/courts");
  return { ok: true as const, existing: Boolean((data as { existing: boolean }).existing) };
}

export async function voteCourtReport(reportId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("vote_court_report", { p_report_id: reportId });
  if (error) return { ok: false as const, error: errorText(error.message) };
  revalidatePath("/courts");
  return { ok: true as const, votes: Number(data) };
}

export async function setCourtReportStatus(reportId: string, status: CourtReportStatus, note: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_court_report_status", { p_report_id: reportId, p_status: status, p_note: note.slice(0, 300) });
  if (error) return { ok: false as const, error: errorText(error.message) };
  revalidatePath("/courts");
  revalidatePath("/admin/courts");
  return { ok: true as const };
}
