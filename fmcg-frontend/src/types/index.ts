// PATH: src/types/index.ts
// UPDATED: OrderStatus enum expanded to 5 values, ORDER_STATUS_LABELS/BADGE updated,
//          RoutePackingStatusDto added, OrderDetailDto gets approvedAt,
//          OrderDto gets approvedAt field

// ── Route Execution (Salesman daily flow) ─────────────────────────────────────
export type VisitStatus = 'Pending' | 'OrderPlaced' | 'Skipped' | 'NoOrder';
export type ExecutionStatus = 'InProgress' | 'Completed' | 'Cancelled';

export interface CustomerVisitDto {
  visitId:         string;
  id:              string;
  customerId:      string;
  customerName:    string;
  customerNameMalayalam?: string;
  customerNameMl?: string;
  phoneNumber?:    string;
  address?:        string;
  sequenceOrder:   number;
  visitStatus:     VisitStatus;
  orderId?:        string;
  skipReason?:     string;
  visitedAt?:      string;
}

export interface CurrentRouteExecutionDto {
  hasActiveExecution?: boolean;
  executionId?:     string;
  routeId?:         string;
  routeName?:       string;
  executionDate?:   string;
  status?:          string;
  totalCustomers?:  number;
  completedCount?:  number;
  pendingCount?:    number;
  customers?:       CustomerVisitDto[];
}

export interface StartRouteExecutionResponse {
  executionId:    string;
  routeId:        string;
  routeName:      string;
  executionDate:  string;
  totalCustomers: number;
  customers:      CustomerVisitDto[];
}

export interface RecordVisitBody {
  executionId?:     string;
  customerVisitId?: string;
  customerId:       string;
  visitStatus?:     VisitStatus;
  status?:          VisitStatus;
  orderId?:         string;
  skipReason?:      string;
}

export interface RecordCustomerVisitResponse {
  customerVisitId: string;
  customerId:      string;
  visitStatus:     VisitStatus;
  updatedAt:       string;
}

export interface CompleteRouteExecutionResponse {
  executionId:     string;
  status:          ExecutionStatus;
  completedAt:     string;
  totalCustomers:  number;
  ordersPlaced:    number;
  skipped:         number;
  noOrder:         number;
}

// ── RBAC Roles ────────────────────────────────────────────────────────────────
export type UserRole = 'SuperAdmin' | 'Admin' | 'Salesman' | 'Accounts' | 'Warehouse';

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface AuthUser {
  id:    string;
  email: string;
  name:  string;
  role:  UserRole;
  token: string;
}

export interface UserDto {
  id:       string;
  email:    string;
  fullName: string;
  role:     string;
  isActive: boolean;
}

export interface LoginResponse {
  token:        string;
  refreshToken: string;
  userId:       string;
  email:        string;
  fullName:     string;
  role:         string;
}

// ── API Envelope ──────────────────────────────────────────────────────────────
export interface ApiResult<T> {
  isSuccess: boolean;
  data?:     T;
  value?:    T;
  error?:    string;
  message?:  string;
}

// ── Route ─────────────────────────────────────────────────────────────────────
export interface RouteDto {
    id:                    string;
    name:                  string;
    description?:          string;
    isActive:              boolean;
    assignedSalesmanId?:   string | null;
    assignedSalesmanName?: string | null;
    salesmanName?:         string | null;
    salesman?:             string | null;
    customerCount?:        number;
    createdAt:             string;
    isTodayOverride?:      boolean;
    overrideNotes?:        string | null;
    hasOverrideToday?:     boolean;
}

export interface RouteDetailDto extends RouteDto {
  customers: CustomerDto[];
}

export interface CreateRouteCommand {
  name:                string;
  description?:        string;
  assignedSalesmanId?: string;
}

export interface UpdateRouteCommand extends CreateRouteCommand {
  id: string;
}

// ── Customer ──────────────────────────────────────────────────────────────────
export interface CustomerDto {
  id:            string;
  nameEnglish:   string;
  nameMalayalam: string;
  phoneNumber:   string;
  address?:      string;
  routeId:       string;
  routeName?:    string;
  isActive:      boolean;
  sequenceOrder: number;
  createdAt:     string;
}

export interface CustomerDetailDto extends CustomerDto {
  routeDescription?: string;
  totalOrdersCount?: number;
}

export interface CreateCustomerCommand {
  nameEnglish:    string;
  nameMalayalam?: string;
  phoneNumber?:   string;
  address?:       string;
  routeId:        string;
}

export interface UpdateCustomerCommand extends CreateCustomerCommand {
  id: string;
}

export interface ReorderCustomersRequest {
  routeId: string;
  customerId: string;
  newSequenceOrder: number;
}

// ── Product Group ─────────────────────────────────────────────────────────────
export interface ProductGroupDto {
  id:           string;
  name:         string;
  nameMl?:      string;
  description?: string;
  isActive:     boolean;
  productCount?: number;
  createdDate:  string;
}

// ── Product ───────────────────────────────────────────────────────────────────
export interface ProductDto {
    id: string;
    nameEnglish: string;
    nameMalayalam: string;
    productGroupId: string;
    productGroupName?: string;
    productUnitId?: string;
    productUnitName?: string;
    productUnitSymbol?: string;
    basePrice: number;
    isActive: boolean;
    createdAt: string;
    
    // ── NEW fields ──────────────────────────────────────────────────────────
    itemCode?: string;
    hsnCode?: string;
    supplier?: string;
    closingStock?: number;
    minOrderQty?: number;
    maxOrderQty?: number;
    defaultUnitId?: string;
}

export interface ProductDetailDto extends ProductDto {
  productGroupDescription?: string;
}

export interface ProductSearchDto {
  id:               string;
  nameEnglish:      string;
  nameMalayalam:    string;
  productGroupId:   string;
  productGroupName: string;
  productUnitId?:   string;
  unitName:         string;
  unitSymbol:       string;
  basePrice:        number;
  isActive:         boolean;
}

// Add to existing types in src/types/index.ts

// ── Product Unit Price Types ────────────────────────────────────────────────
export interface ProductUnitPriceDto {
    id: string;
    productId: string;
    productUnitId: string;
    unitName: string;
    unitSymbol: string;
    unitSize: number;
    unitSizeLabel?: string;
    salePrice: number;
    salePrice2: number;
    salePrice3: number;
    salePrice4: number;
    purchaseRate: number;
    landingCost: number;
    mrp: number;
    mop: number;
    discount1: number;
    discount2: number;
    discount3: number;
    discount4: number;
    vat: number;
    floodCost: number;
    isDefault: boolean;
    isActive: boolean;
}

export interface CreateProductUnitPriceDto {
    productId: string;
    productUnitId: string;
    unitSize: number;
    unitSizeLabel?: string;
    salePrice: number;
    salePrice2?: number;
    salePrice3?: number;
    salePrice4?: number;
    purchaseRate: number;
    landingCost: number;
    mrp: number;
    mop?: number;
    discount1?: number;
    discount2?: number;
    discount3?: number;
    discount4?: number;
    vat?: number;
    floodCost?: number;
    isDefault: boolean;
}

export interface UpdateProductUnitPriceDto extends CreateProductUnitPriceDto {
    id: string;
    isActive: boolean;
}

export interface CreateProductCommand {
  nameEnglish:    string;
  nameMalayalam?: string;
  sku?:           string;
  productGroupId: string;
  productUnitId?: string;
  basePrice:      number;
  defaultPackSize?: number;
}

export interface UpdateProductCommand extends CreateProductCommand {
  id:       string;
  isActive: boolean;
}

// ── Unit ──────────────────────────────────────────────────────────────────────
export interface UnitDto {
  id:             string;
  name:           string;
  abbreviation?:  string;
  createdDate:    string;
  loadingPriority?: number;
  measurementType?: 'weight' | 'volume' | 'count';
  baseUnitValue?: number;
  baseUnitName?: string;
}

export interface UnitPriorityDto {
  id:              string;
  name:            string;
  symbol?:         string;
  loadingPriority: number;
}

export interface LoadingSheetItemDto {
  productName:        string;
  productNameMalayalam?: string;
  unitSymbol:         string;
  totalQuantity:      number;
  loadingPriority:    number;
  unitTypeLabel:      string;
  quantityBags?:      number;
  quantityBoxes?:     number;
  quantityTins?:      number;
}

export interface LoadingSheetStopDto {
  customerId:         string;
  customerName:       string;
  customerNameMalayalam?: string;
  sequenceOrder:      number;
  loadingPosition:    number;
  isFirstDelivery:    boolean;
  isLastDelivery:     boolean;
  visitStatus:        string;
  items:              LoadingSheetItemDto[];
  stopTotalQuantity:  number;
}

// ── Order ─────────────────────────────────────────────────────────────────────
// UPDATED: 5 values matching backend OrderStatus enum
export enum OrderStatus {
  Draft           = 1,
  PendingApproval = 2,
  Approved        = 3,
  Packed          = 4,
  Closed          = 5,
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.Draft]:           'Draft',
  [OrderStatus.PendingApproval]: 'Pending Approval',
  [OrderStatus.Approved]:        'Approved',
  [OrderStatus.Packed]:          'Packed',
  [OrderStatus.Closed]:          'Closed',
};

export const ORDER_STATUS_BADGE: Record<OrderStatus, string> = {
  [OrderStatus.Draft]:           'badge-muted',
  [OrderStatus.PendingApproval]: 'badge-amber',
  [OrderStatus.Approved]:        'badge-blue',
  [OrderStatus.Packed]:          'badge-blue',
  [OrderStatus.Closed]:          'badge-green',
};

export interface OrderItemDto {
  id?:            string | number;
  productId:      string | number;
  productName?:   string;
  productNameMl?: string;
  productNameMalayalam?: string;
  unitId?:        string | number;
  unitName?:      string;
  unitSymbol?:    string;
  quantity:       number;
  basePrice?:     number;
  sellingPrice:   number;
  variance?:      number;
  variancePct?:   number;
  lineTotal?:     number;
  remarks?:       string;
  quantityBags?:  number;
  quantityBoxes?: number;
  quantityTins?:  number;
}

export interface OrderDto {
  id:             string | number;
  customerId:     string | number;
  customerName?:  string;
  customerNameMalayalam?: string;
  routeId:        string | number;
  routeName?:     string;
  salesmanId?:    string | number;
  salesmanName?:  string;
  status:         OrderStatus;
  orderDate:      string;
  totalAmount:    number;
  totalVariance?: number;
  totalQuantity?: number;
  itemCount?:     number;
  items?:         OrderItemDto[];
  createdDate?:   string;
  remarks?:       string;
  approvedAt?:    string;   // ← NEW
}

export interface OrderDetailDto extends OrderDto {
  items:           OrderItemDto[];
  totalBasePrice:  number;
  totalSelling:    number;
  totalVariance:   number;
  variancePct:     number;
  approvedAt?:     string;  // ← NEW
}

export interface CreateOrderItemDto {
  productId:    string | number;
  quantity:     number;
  sellingPrice: number;
  unitId?:      string | number;
  remarks?:     string;
}

export interface CreateOrderCommand {
  customerId:      string | number;
  routeId:         string | number;
  orderDate:       string;
  items:           CreateOrderItemDto[];
  executionId?:    string;
  customerVisitId?: string;
  remarks?:        string;
}

export interface CustomerOrderHistoryDto {
  orderId:     string;
  orderNumber: string;
  orderDate:   string;
  status:      string;
  totalAmount: number;
  itemCount:   number;
  remarks?:    string;
  items: {
    productId:            string;
    productName:          string;
    productNameMalayalam?: string;
    quantity:             number;
    unitSymbol:           string;
    sellingPrice:         number;
    quantityBags?:        number;
    quantityBoxes?:       number;
    quantityTins?:        number;
  }[];
}

// ── Settlement ────────────────────────────────────────────────────────────────
export interface SettlementSummaryDto {
  totalBilled:        number;
  totalCollected:     number;
  totalOutstanding:   number;
  customersWithDues:  number;
  date?:              string;
}

export interface ExpectedCashDto {
  routeId?:           string;
  routeName?:         string;
  totalOrderValue:    number;
  paidAmount:         number;
  outstandingAmount:  number;
  orderCount:         number;
  settledOrderCount:  number;
  pendingOrderCount:  number;
  asOfDate:           string;
}

export interface OutstandingCustomerDto {
  customerId:       number | string;
  customerName:     string;
  routeName?:       string;
  totalBilled:      number;
  totalPaid:        number;
  outstanding:      number;
  lastOrderDate?:   string;
  lastPaymentDate?: string;
}

export interface OutstandingSummaryDto {
  totalOutstanding:  number;
  customerCount:     number;
  customers:         OutstandingCustomerDto[];
}

export interface DailyClosureStatusDto {
  date:             string;
  isClosed:         boolean;
  closedAt?:        string;
  closedBy?:        string;
  notes?:           string;
  totalOrders:      number;
  closedOrders:     number;
  submittedOrders:  number;
  totalRevenue:     number;
}

export interface DailyClosureResultDto {
  closureDate:   string;
  ordersLocked:  number;
  totalRevenue:  number;
  message:       string;
}

// ── Analytics ─────────────────────────────────────────────────────────────────
export interface DashboardKpisDto {
  todayRevenue:       number;
  todayOrders:        number;
  todayVariance:      number;
  activeRoutes:       number;
  activeCustomers:    number;
  pendingSettlement:  number;
  topRouteRevenue:    number;
  topRouteName?:      string;
  mtdRevenue:         number;
  mtdOrders:          number;
}

export interface ProductProfitabilityDto {
  productId:             string;
  productName:           string;
  productNameMalayalam?: string;
  productGroupId:        string;
  productGroupName:      string;
  totalQuantity:         number;
  totalSales:            number;
  totalVariance:         number;
  marginPercentage:      number;
  orderCount:            number;
  isProfitable:          boolean;
}

export interface RouteProfitabilityDto {
  routeId:          string;
  routeName:        string;
  totalSales:       number;
  totalVariance:    number;
  marginPercentage: number;
  orderCount:       number;
  customerCount:    number;
  isProfitable:     boolean;
}

export interface TopProductDto {
  productId:             string;
  productName:           string;
  productNameMalayalam?: string;
  totalQuantity:         number;
  totalSales:            number;
  totalVariance:         number;
  orderCount:            number;
}

export interface PriceHistoryDto {
  id:             string;
  price:          number;
  previousPrice?: number;
  effectiveDate:  string;
  isActive:       boolean;
  reason?:        string;
  createdAt:      string;
}

export interface WarehouseOrderDto {
  id:            string;
  orderNumber:   string;
  orderDate:     string;
  customerName:  string;
  salesmanName:  string;
  routeName:     string;
  routeId:       string;
  itemCount:     number;
  totalQty:      number;
  packingStatus: number;
  packedAt?:     string;
  items: {
    productId:     string;
    productName:   string;
    quantity:      number;
    unitName:      string;
    quantityBags?:  number;
    quantityBoxes?: number;
    quantityTins?:  number;
  }[];
}

export interface WarehouseSummaryDto {
  date?:         string;
  totalOrders:   number;
  pendingPack?:  number;
  packed?:       number;
  partialPacked?: number;
  // New fields from updated WarehouseController
  packedCount?:   number;
  pendingCount?:  number;
  partialCount?:  number;
}

// ── NEW: Packing status for delivery button gate ──────────────────────────────
export interface RoutePackingStatusDto {
  totalOrders:  number;
  packedCount:  number;
  pendingCount: number;
  allPacked:    boolean;
  orders: {
    id:            string;
    orderNumber:   string;
    packingStatus: number;
  }[];
}

export interface RouteAssignmentDto {
  id:             string;
  routeId:        string;
  routeName:      string;
  salesmanId:     string;
  salesmanName:   string;
  assignmentDate: string;
  notes?:         string;
  isPermanent:    boolean;
}

export interface TodayRouteDto {
    routeId:       string;
    routeName:     string;
    isOverride:    boolean;
    notes?:        string;
    permanentSalesmanName?: string;
}

export interface RoutePerformanceResponseDto {
  routes:   RoutePerformanceItemDto[];
  fromDate: string;
  toDate:   string;
}

export interface RoutePerformanceItemDto {
  routeId:            string;
  routeName:          string;
  salesmanName?:      string;
  orderCount:         number;
  customerCount:      number;
  totalRevenue:       number;
  averageOrderValue:  number;
  variance:           number;
}

export interface ProductPerformanceResponseDto {
  products:   ProductPerformanceItemDto[];
  totalCount: number;
}

export interface ProductPerformanceItemDto {
  productId:   string;
  productName: string;
  groupName?:  string;
  quantity:    number;
  revenue:     number;
  variance:    number;
  orderCount:  number;
}

export interface PeriodComparisonResponseDto {
  currentPeriod:  PeriodDataDto;
  previousPeriod: PeriodDataDto;
  revenueGrowth:  number;
  orderGrowth:    number;
}

export interface PeriodDataDto {
  fromDate:       string;
  toDate:         string;
  totalRevenue:   number;
  totalOrders:    number;
  avgOrderValue:  number;
}

export interface OrderMarginDto {
  orderId:         string;
  totalBasePrice:  number;
  totalSelling:    number;
  totalVariance:   number;
  variancePct:     number;
  isNegative:      boolean;
}

export interface PricingAuditLogDto {
  id:             string;
  productId:      string;
  productName?:   string;
  action:         string;
  oldPrice?:      number;
  newPrice:       number;
  changedByName?: string;
  reason?:        string;
  createdDate:    string;
}

// ── Incentives ────────────────────────────────────────────────────────────────
export interface ProductIncentiveDto {
  id:             string;
  productId:      string;
  productName?:   string;
  incentiveType:  number;
  incentiveValue: number;
  minQuantity?:   number;
  isActive:       boolean;
  validFrom?:     string;
  validTo?:       string;
  description?:   string;
  createdDate:    string;
}

export interface SalesmanIncentiveSummaryDto {
  salesmanId:            string;
  salesmanName?:         string;
  fromDate?:             string;
  toDate?:               string;
  periodStart?:          string;
  periodEnd?:            string;
  totalIncentive?:       number;
  totalIncentiveEarned?: number;
  pendingPayout?:        number;
  qualifiedOrders?:      number;          // ← ADD THIS
  breakdown?:            IncentiveBreakdownDto[];
  productBreakdown?:     ProductIncentiveBreakdownDto[];
}

export interface ProductIncentiveBreakdownDto {
  productId?:      string;
  productName:     string;
  unitsSold?:      number;
  incentiveType?:  string;
  incentiveRate?:  number;
  earned?:         number;
}

export interface IncentiveBreakdownDto {
  productId:   string;
  productName: string;
  quantity:    number;
  incentive:   number;
}

// ── Currency Formatter ────────────────────────────────────────────────────────
export function fmt(n: number): string {
  if (isNaN(n)) return '0.00';
  // Returns formatted number WITHOUT ₹ symbol — call sites write ₹{fmt(x)} themselves
  return new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

export function fmtNum(n: number): string {
  if (isNaN(n)) return '0';
  return new Intl.NumberFormat('en-IN').format(n);
}

export function fmtPct(n: number): string {
  if (isNaN(n)) return '0.00%';
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`;
}

export function fmtDate(d: string | Date): string {
  if (!d) return '-';
  const date = new Date(d);
  if (isNaN(date.getTime())) return 'Invalid Date';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}