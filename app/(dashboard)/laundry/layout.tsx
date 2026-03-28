import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LaundryHeader } from "@/components/laundry/laundry-header";

export default async function LaundryLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "LAUNDRY") {
    redirect("/login");
  }
  return (
    <>
      <LaundryHeader />
      {children}
    </>
  );
}
