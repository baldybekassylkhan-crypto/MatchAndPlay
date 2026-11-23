import { renderAppIcon } from "@/lib/icon";

export const dynamic = "force-static";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }, { size: "ios" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  if (size === "maskable") return renderAppIcon(512, { padded: true });
  // Значок iOS-приложения: без скруглений, система скругляет его сама
  if (size === "ios") return renderAppIcon(1024, { padded: true });
  if (size === "192") return renderAppIcon(192);
  return renderAppIcon(512);
}
