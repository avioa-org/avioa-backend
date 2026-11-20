export type PortalUser = {
  userId: string;
  email: string;
  role: string;
  modulePermissions?: {
    module: string;
    canAccess: boolean;
    actions?: string[];
  }[];
};
