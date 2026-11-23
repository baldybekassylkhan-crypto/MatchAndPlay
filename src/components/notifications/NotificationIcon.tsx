import {
  Ban,
  Bell,
  CalendarClock,
  Check,
  Crown,
  Flag,
  Heart,
  LogOut,
  Mail,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Swords,
  Trophy,
  UserPlus,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { NotificationIconName } from "@/lib/notifications";

const ICONS: Record<NotificationIconName, LucideIcon> = {
  ban: Ban,
  bell: Bell,
  check: Check,
  clock: CalendarClock,
  crown: Crown,
  flag: Flag,
  heart: Heart,
  leave: LogOut,
  mail: Mail,
  message: MessageCircle,
  pencil: Pencil,
  shield: ShieldCheck,
  swords: Swords,
  trophy: Trophy,
  userPlus: UserPlus,
  users: Users,
  x: X,
};

export function NotificationIcon({ name }: { name: NotificationIconName }) {
  const Icon = ICONS[name];
  return (
    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink">
      <Icon className="size-5" strokeWidth={1.8} aria-hidden />
    </span>
  );
}
