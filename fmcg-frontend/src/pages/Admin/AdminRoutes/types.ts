// Shared types for AdminRoutes components

export interface RouteFormData {
  name: string;
  description: string;
  assignedSalesmanId: string;
}

export interface AssignFormData {
  routeId: string;
  routeName: string;
  salesmanId: string;
  date: string;
  notes: string;
}

export interface OverrideFormData {
  routeId: string;
  routeName: string;
  salesmanId: string;
  date: string;
  notes: string;
}

export interface ActionBtnProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  color?: 'default' | 'blue' | 'amber' | 'red';
  title?: string;
  disabled?: boolean;
}