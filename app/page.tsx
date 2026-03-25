import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  if (session.user.role === "ADMIN") {
    redirect("/admin");
  }
  redirect("/reception");
}
