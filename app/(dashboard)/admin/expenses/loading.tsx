import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function LoadingExpensesPage() {
  return <PageSkeleton title="Loading expenses..." rows={10} />;
}
