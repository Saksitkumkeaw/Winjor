import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { ROLE_HOME, ROLE_LABEL } from "@/lib/auth/roles";
import { getCurrentProfile } from "@/lib/auth/session";

export async function UserMenu() {
  const profile = await getCurrentProfile();

  if (!profile) {
    return (
      <Link href="/login" className={buttonVariants({ variant: "outline" })}>
        เข้าสู่ระบบ
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <Link href={ROLE_HOME[profile.role]} className="text-sm hover:underline">
        {profile.fullName || "บัญชีของฉัน"}
        <span className="ml-1 text-muted-foreground">
          ({ROLE_LABEL[profile.role]})
        </span>
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="ghost">
          ออกจากระบบ
        </Button>
      </form>
    </div>
  );
}
