import clsx from "clsx";
import { Bell } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { MarkRead } from "@/components/notifications/MarkRead";
import { PushToggle } from "@/components/notifications/PushToggle";
import { PageHeader } from "@/components/PageHeader";
import { getUser } from "@/lib/auth";
import { renderNotification, type AppNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/time";

export const metadata = { title: "Уведомления" };

export default async function NotificationsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const items = (data as AppNotification[] | null) ?? [];
  const fresh = items.filter((n) => !n.read);
  const old = items.filter((n) => n.read);

  return (
    <>
      <PageHeader title="Уведомления" back="/" />
      <MarkRead hasUnread={fresh.length > 0} />
      <PushToggle />

      {items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="Уведомлений пока нет"
          text="Здесь появятся заявки на ваши игры, решения организаторов, напоминания, лайки и комментарии."
        />
      ) : (
        <div className="pt-2 pb-8">
          {fresh.length > 0 && <Group title="Новые" items={fresh} />}
          {old.length > 0 && <Group title="Ранее" items={old} />}
        </div>
      )}
    </>
  );
}

function Group({ title, items }: { title: string; items: AppNotification[] }) {
  return (
    <section className="mt-4">
      <h2 className="px-4 pb-1 text-sm font-bold tracking-wide text-muted uppercase">{title}</h2>
      <ul>
        {items.map((n) => {
          const r = renderNotification(n);
          return (
            <li key={n.id}>
              <Link href={r.href} className={clsx("flex items-start gap-3 px-4 py-3", !n.read && "bg-accent/10")}>
                {n.payload.actor ? (
                  <Avatar src={n.payload.actor_avatar} name={n.payload.actor} size={44} />
                ) : (
                  <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-xl">{r.emoji}</span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-[15px]">
                    <span className="font-semibold">{r.title}.</span> {r.body}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">{timeAgo(n.created_at)}</p>
                </div>
                {!n.read && <span className="mt-2 size-2.5 shrink-0 rounded-full bg-danger" aria-label="Новое" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
