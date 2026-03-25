import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function LoadingReceptionOrders() {
  return <PageSkeleton title="Loading your orders..." rows={8} />;
}
