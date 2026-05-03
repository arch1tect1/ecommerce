import { Badge } from "@/components/ui/badge";
import type { OrderStatus, PaymentStatus } from "@prisma/client";

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  switch (status) {
    case "PENDING":
      return <Badge variant="warning">Pending</Badge>;
    case "COMPLETED":
      return <Badge variant="success">Completed</Badge>;
    case "CANCELLED":
      return <Badge variant="destructive">Cancelled</Badge>;
  }
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  switch (status) {
    case "UNPAID":
      return <Badge variant="destructive">Unpaid</Badge>;
    case "PARTIAL":
      return <Badge variant="warning">Partial</Badge>;
    case "PAID":
      return <Badge variant="success">Paid</Badge>;
  }
}
