import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function LoadingAdminDashboard() {
  return <PageSkeleton title="Loading dashboard metrics..." rows={8} />;
}
