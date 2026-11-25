import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PageHeader";
import { RedeemForm } from "@/components/rewards/RedeemForm";
import { isAppAdmin } from "@/lib/tournaments";

export const metadata = { title: "Проверка кода награды", robots: { index: false } };

export default async function AdminRewardsPage() {
  if (!(await isAppAdmin())) notFound();
  return (
    <>
      <PageHeader title="Проверка кода" back="/rewards" />
      <div className="px-5 pt-5 pb-10">
        <RedeemForm />
      </div>
    </>
  );
}
