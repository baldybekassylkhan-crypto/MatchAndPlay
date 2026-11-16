import { ChevronRight, ImagePlus, Users } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";

export const metadata = { title: "Создать" };

export default function CreatePage() {
  return (
    <>
      <PageHeader title="Создать" />
      <div className="space-y-3 p-5">
        <Link href="/create/lobby" className="flex items-center gap-4 rounded-3xl bg-accent p-5 text-accent-ink">
          <Users className="size-8 shrink-0" />
          <div className="flex-1">
            <p className="text-lg font-bold">Найти игроков</p>
            <p className="text-sm opacity-75">Создайте лобби: вид спорта, время, место и сколько людей нужно</p>
          </div>
          <ChevronRight className="size-5" />
        </Link>
        <Link href="/create/post" className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-5">
          <ImagePlus className="size-8 shrink-0" />
          <div className="flex-1">
            <p className="text-lg font-bold">Пост</p>
            <p className="text-sm text-muted">Фото, видео и хайлайты с ваших игр</p>
          </div>
          <ChevronRight className="size-5 text-muted" />
        </Link>
      </div>
    </>
  );
}
