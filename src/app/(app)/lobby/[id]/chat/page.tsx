import { notFound, redirect } from "next/navigation";
import { LobbyChat, type ChatMessage } from "@/components/chat/LobbyChat";
import { PageHeader } from "@/components/PageHeader";
import { getUser } from "@/lib/auth";
import { getLobby, getLobbyApplications } from "@/lib/lobbies";
import { SPORTS } from "@/lib/sports";
import { createClient } from "@/lib/supabase/server";
import { formatShortDayTime } from "@/lib/time";
import type { MiniProfile } from "@/lib/types";

export const metadata = { title: "Чат игры" };

export default async function LobbyChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [lobby, user] = await Promise.all([getLobby(id), getUser()]);
  if (!lobby) notFound();
  if (!user) redirect("/login");

  const apps = await getLobbyApplications(lobby.id);
  const accepted = apps.filter((a) => a.status === "accepted");
  const isMember = lobby.organizer_id === user.id || accepted.some((a) => a.user_id === user.id);
  if (!isMember) redirect(`/lobby/${lobby.id}`);

  const members: Record<string, MiniProfile> = {};
  if (lobby.organizer) members[lobby.organizer.id] = lobby.organizer;
  for (const a of accepted) if (a.user) members[a.user.id] = a.user;

  const supabase = await createClient();
  const { data } = await supabase
    .from("lobby_messages")
    .select("id, lobby_id, user_id, text, created_at")
    .eq("lobby_id", lobby.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const messages = ((data as ChatMessage[] | null) ?? []).reverse();

  // Чат открыт — уведомления о его сообщениях прочитаны, и следующие снова смогут прийти
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", user.id)
    .eq("type", "chat_message")
    .eq("read", false)
    .eq("payload->>lobby_id", lobby.id);

  const sport = SPORTS[lobby.sport];

  return (
    <>
      <PageHeader
        title={
          <span className="flex flex-col leading-tight">
            <span>
              Чат · {sport?.label}
            </span>
            <span className="text-xs font-normal text-muted">
              {formatShortDayTime(lobby.start_time)} · {Object.keys(members).length} участников
            </span>
          </span>
        }
        back={`/lobby/${lobby.id}`}
      />
      <LobbyChat
        lobbyId={lobby.id}
        myId={user.id}
        initialMessages={messages}
        members={members}
        readOnly={lobby.status === "cancelled"}
      />
    </>
  );
}
