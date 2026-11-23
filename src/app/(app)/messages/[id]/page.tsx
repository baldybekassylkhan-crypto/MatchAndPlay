import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ConversationChat, type ConversationMessage } from "@/components/crews/ConversationChat";
import { PageHeader } from "@/components/PageHeader";
import { getUser } from "@/lib/auth";
import { isUuid } from "@/lib/crews";
import type { SportId } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import { plural } from "@/lib/time";
import type { MiniProfile } from "@/lib/types";

export const metadata = { title: "Чат" };

const PROFILE_FIELDS = "id, username, full_name, avatar_url";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const user = await getUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  // RLS отдаёт чат только его участникам
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, kind, crew:crews(id, name, sport, member_count)")
    .eq("id", id)
    .maybeSingle();
  if (!conversation) notFound();

  const crew = conversation.crew as unknown as { id: string; name: string; sport: SportId; member_count: number } | null;
  const [{ data: memberRows }, { data: messageRows }] = await Promise.all([
    supabase.from("conversation_members").select("user_id").eq("conversation_id", id).limit(100),
    supabase
      .from("chat_messages")
      .select("id, conversation_id, user_id, text, created_at")
      .eq("conversation_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);
  const messages = ((messageRows as ConversationMessage[] | null) ?? []).reverse();

  // Профили и нынешних участников, и тех, кто писал раньше, но уже вышел
  const profileIds = [...new Set([...(memberRows ?? []).map((m) => m.user_id as string), ...messages.map((m) => m.user_id)])];
  const { data: profiles } = await supabase.from("profiles").select(PROFILE_FIELDS).in("id", profileIds);
  const members: Record<string, MiniProfile> = {};
  for (const p of (profiles as MiniProfile[] | null) ?? []) members[p.id] = p;

  await supabase.rpc("mark_conversation_read", { p_conversation_id: id });

  const other = conversation.kind === "direct" ? Object.values(members).find((p) => p.id !== user.id) : null;
  const title =
    conversation.kind === "crew" && crew ? (
      <Link href={`/crews/${crew.id}`} className="flex flex-col leading-tight">
        <span className="truncate">
          {crew.name}
        </span>
        <span className="text-xs font-normal text-muted">
          {crew.member_count} {plural(crew.member_count, ["участник", "участника", "участников"])}
        </span>
      </Link>
    ) : other ? (
      <Link href={`/u/${other.username}`}>@{other.username}</Link>
    ) : (
      "Чат"
    );

  return (
    <>
      <PageHeader title={title} back="/crews?tab=chats" />
      <ConversationChat
        conversationId={id}
        myId={user.id}
        initialMessages={messages}
        members={members}
        isGroup={conversation.kind === "crew"}
        emptyText={conversation.kind === "crew" ? "Напишите команде первым: когда играем?" : "Напишите первое сообщение"}
      />
    </>
  );
}
