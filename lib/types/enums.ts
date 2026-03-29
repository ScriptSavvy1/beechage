export enum Role {
  OWNER = "OWNER",
  ADMIN = "ADMIN",
  RECEPTION = "RECEPTION",
  LAUNDRY = "LAUNDRY",
}

/** Roles that have admin-level access within a tenant */
export const ADMIN_ROLES = [Role.OWNER, Role.ADMIN] as const;

export enum OrderStatus {
  IN_PROGRESS = "IN_PROGRESS",
  READY = "READY",
  PICKED_UP = "PICKED_UP",
}

export enum PaymentStatus {
  UNPAID = "UNPAID",
  PARTIALLY_PAID = "PARTIALLY_PAID",
  PAID = "PAID",
}

export enum PricingType {
  FIXED = "FIXED",
  PER_KG = "PER_KG",
}

export enum Plan {
  FREE = "free",
  STARTER = "starter",
  PRO = "pro",
  ENTERPRISE = "enterprise",
}
