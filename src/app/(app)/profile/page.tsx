import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/auth";

export default async function MyProfileRedirect() {
  const profile = await getMyProfile();
  redirect(profile ? `/u/${profile.username}` : "/onboarding");
}
