import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import * as webpush from "web-push";
import { renderNotification, type AppNotification } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Вызывается базой данных (pg_net) на каждое новое уведомление:
 * POST { id } с заголовком x-push-secret. Отправляет Web Push на все устройства адресата.
 */
export const runtime = "nodejs";

const SECRET = process.env.PUSH_WEBHOOK_SECRET ?? "";
const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

function secretOk(given: string | null) {
  if (!SECRET || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(SECRET);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  if (!secretOk(request.headers.get("x-push-secret"))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "vapid_not_configured" }, { status: 503 });
  }
  const admin = createAdminClient();
  if (!admin) return NextResponse.json({ error: "service_role_not_configured" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = Number(body?.id);
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "bad_request" }, { status: 400 });

  const { data: notification } = await admin.from("notifications").select("*").eq("id", id).maybeSingle();
  if (!notification) return NextResponse.json({ sent: 0 });

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", (notification as AppNotification).user_id);
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const r = renderNotification(notification as AppNotification);
  const payload = JSON.stringify({
    title: `${r.emoji} ${r.title}`,
    body: r.body,
    url: r.href,
    tag: `n-${notification.type}-${(notification as AppNotification).payload.lobby_id ?? (notification as AppNotification).payload.post_id ?? id}`,
  });

  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let sent = 0;
  const expired: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60 * 6,
          urgency: notification.type.startsWith("reminder") || notification.type.startsWith("application") ? "high" : "normal",
        });
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 — подписка больше не действует (приложение удалили или отозвали разрешение)
        if (status === 404 || status === 410) expired.push(s.id);
      }
    }),
  );
  if (expired.length) await admin.from("push_subscriptions").delete().in("id", expired);

  return NextResponse.json({ sent, expired: expired.length });
}
