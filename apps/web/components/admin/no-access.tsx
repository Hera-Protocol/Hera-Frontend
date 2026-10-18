import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/misc";

/** What people see instead of an admin-only page. */
export function NoAccess({ title, body, action }: { title: string; body: ReactNode; action?: ReactNode }) {
  return (
    <Card>
      <EmptyState title={title} body={body} action={action} />
    </Card>
  );
}
