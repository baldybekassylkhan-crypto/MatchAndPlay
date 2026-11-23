import { notFound, redirect } from "next/navigation";
import { ChallengeForm } from "@/components/crews/ChallengeForm";
import { PageHeader } from "@/components/PageHeader";
import { getMyProfile } from "@/lib/auth";
import { getCaptainCrews, getCrew } from "@/lib/crews";
import { toKzInputs } from "@/lib/time";

export const metadata = { title: "Вызов команде" };

export default async function ChallengePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [target, profile] = await Promise.all([getCrew(id), getMyProfile()]);
  if (!target) notFound();
  if (!profile) redirect("/onboarding");
  if (target.captain_id === profile.id) redirect(`/crews/${target.id}`);

  const myCrews = (await getCaptainCrews(profile.id)).filter((c) => c.id !== target.id);
  if (myCrews.length === 0) redirect(`/crews/${target.id}`);

  return (
    <>
      <PageHeader title={`Вызов: ${target.name}`} back={`/crews/${target.id}`} />
      <div className="px-5 pt-5 pb-10">
        <p className="mb-5 text-muted">Если капитан примет вызов, матч появится как обычная игра, с чатом и QR-отметкой.</p>
        <ChallengeForm target={target} myCrews={myCrews} minDate={toKzInputs(new Date()).date} />
      </div>
    </>
  );
}
