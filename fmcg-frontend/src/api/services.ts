// PATH: src/api/services.ts
// UPDATED: imports from '../types/index' (matches actual file path src/types/index.ts),
//          RoutePackingStatusDto now imported from types (added there),
//          ordersApi.approve / getPendingApproval / getPendingApprovalCount added,
//          warehouseApi.getPackingStatus added.
//          ADDED: productsApi.getUnitPrices, addUnitPrice, updateUnitPrice, deleteUnitPrice

import apiClient from './client';
import type {
  ApiResult,
  LoginResponse,
  RouteDto, RouteDetailDto, CreateRouteCommand, UpdateRouteCommand,
  CustomerDto, CustomerDetailDto, CreateCustomerCommand, UpdateCustomerCommand,
  ProductGroupDto,
  ProductDto, ProductDetailDto, ProductSearchDto, PriceHistoryDto,
  CreateProductCommand, UpdateProductCommand,
  UnitDto, UnitPriorityDto,
  OrderDto, OrderDetailDto, CreateOrderCommand, CustomerOrderHistoryDto,
  ExpectedCashDto, OutstandingSummaryDto, OutstandingCustomerDto, SettlementSummaryDto,
  DailyClosureStatusDto,
  DailyClosureResultDto,
  DashboardKpisDto, ProductProfitabilityDto, RouteProfitabilityDto,
  TopProductDto, RoutePerformanceResponseDto, ProductPerformanceResponseDto,
  PeriodComparisonResponseDto, OrderMarginDto, PricingAuditLogDto,
  ProductIncentiveDto, SalesmanIncentiveSummaryDto,
  StartRouteExecutionResponse, CurrentRouteExecutionDto, RecordVisitBody,
  RecordCustomerVisitResponse, CompleteRouteExecutionResponse,
  WarehouseOrderDto, WarehouseSummaryDto,
  RouteAssignmentDto, TodayRouteDto,
  UserDto,
  RoutePackingStatusDto,
  ProductUnitPriceDto, CreateProductUnitPriceDto, UpdateProductUnitPriceDto,
} from '../types/index';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function get<T>(url: string, params?: object): Promise<T> {
  const res = await apiClient.get(url, { params });
  const body = res.data;
  if (body && typeof body === 'object' && 'isSuccess' in body) {
    if (!body.isSuccess) throw new Error(body.error ?? body.message ?? 'Request failed');
    return (body.data ?? body.value) as T;
  }
  return body as T;
}

async function post<T>(url: string, body?: object): Promise<T> {
  const res = await apiClient.post<ApiResult<T>>(url, body);
  if (!res.data.isSuccess) throw new Error(res.data.error ?? 'Request failed');
  return (res.data.data ?? res.data.value) as T;
}

async function put<T>(url: string, body?: object): Promise<T> {
  const res = await apiClient.put<ApiResult<T>>(url, body);
  if (!res.data.isSuccess) throw new Error(res.data.error ?? 'Request failed');
  return (res.data.data ?? res.data.value) as T;
}

async function patch<T>(url: string, body?: object): Promise<T> {
  const res = await apiClient.patch<ApiResult<T>>(url, body ?? {});
  if (!res.data.isSuccess) throw new Error(res.data.error ?? 'Request failed');
  return (res.data.data ?? res.data.value) as T;
}

async function del<T>(url: string): Promise<T> {
  const res = await apiClient.delete<ApiResult<T>>(url);
  if (!res.data.isSuccess) throw new Error(res.data.error ?? 'Request failed');
  return (res.data.data ?? res.data.value) as T;
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    post<LoginResponse>('/api/v1/auth/login', { email, password }),
  register: (email: string, password: string, fullName: string, role: string) =>
    post('/api/v1/auth/register', { email, password, fullName, role }),
  pinLogin: (email: string, pin: string) =>
    post<LoginResponse>('/api/v1/auth/pin-login', { email, pin }),
  setPin: (pin: string, userId?: string) =>
    post<boolean>('/api/v1/auth/set-pin', { pin, ...(userId ? { userId } : {}) }),
};

// ── Users (Admin) ─────────────────────────────────────────────────────────────
export const usersApi = {
  getAll: (role?: string) =>
    get<UserDto[]>('/api/v1/users', role ? { role } : undefined),
  getAllWithInactive: (role?: string) =>
    get<UserDto[]>('/api/v1/users/all', role ? { role } : undefined),
  toggleActive: (id: string) =>
    patch<boolean>(`/api/v1/users/${id}/toggle-active`),
};

// ── Routes ────────────────────────────────────────────────────────────────────
export const routesApi = {
  list: () => get<RouteDto[]>('/api/v1/routes'),
  getAll: () => get<RouteDto[]>('/api/v1/routes'),
  getById: (id: number | string) => get<RouteDetailDto>(`/api/v1/routes/${id}`),
  create: (cmd: CreateRouteCommand) => post<{ id: string }>('/api/v1/routes', cmd),
  update: (id: number | string, cmd: UpdateRouteCommand) => put<{ id: string }>(`/api/v1/routes/${id}`, cmd),
  delete: (id: number | string) => del<boolean>(`/api/v1/routes/${id}`),
  startExecution: (routeId: string, executionDate?: string) =>
    post<StartRouteExecutionResponse>(
      `/api/v1/routes/${routeId}/start-execution${executionDate ? `?executionDate=${executionDate}` : ''}`
    ),
  startOrderTaking: (routeId: string, executionDate?: string) =>
    post<StartRouteExecutionResponse>(
      `/api/v1/routes/${routeId}/start-order-taking${executionDate ? `?executionDate=${executionDate}` : ''}`
    ),
  getCurrentExecution: (routeId: string) =>
    get<CurrentRouteExecutionDto>(`/api/v1/routes/${routeId}/current-execution`),
  recordVisit: (body: RecordVisitBody) => {
    const { visitStatus, ...rest } = body;
    return post<RecordCustomerVisitResponse>('/api/v1/routes/record-visit', {
      ...rest,
      status: visitStatus,
    });
  },
  completeExecution: (executionId: string) =>
    post<CompleteRouteExecutionResponse>(`/api/v1/routes/${executionId}/complete-execution`),
};

// ── Customers ─────────────────────────────────────────────────────────────────
export const customersApi = {
  list: (routeId?: string | number) => get<CustomerDto[]>('/api/v1/customers', routeId ? { routeId } : undefined),
  getAll: (routeId?: string | number) => get<CustomerDto[]>('/api/v1/customers', routeId ? { routeId } : undefined),
  getById: (id: number | string) => get<CustomerDetailDto>(`/api/v1/customers/${id}`),
  create: (cmd: CreateCustomerCommand) => post<{ id: string }>('/api/v1/customers', cmd),
  update: (id: number | string, cmd: UpdateCustomerCommand) => put<{ id: string }>(`/api/v1/customers/${id}`, cmd),
  delete: (id: number | string) => del<boolean>(`/api/v1/customers/${id}`),
  reorder: (routeId: string, customerId: string, newSequenceOrder: number) =>
    post<boolean>('/api/v1/customers/reorder', { routeId, customerId, newSequenceOrder }),
};

// ── Product Groups ────────────────────────────────────────────────────────────
export const productGroupsApi = {
  getAll: () => get<ProductGroupDto[]>('/api/v1/productgroups'),
  create: (name: string, nameMl?: string) => post<{ id: string }>('/api/v1/productgroups', { name, nameMl }),
  update: (id: string, name: string, nameMl?: string) => put<{ id: string }>(`/api/v1/productgroups/${id}`, { id, name, nameMl }),
  delete: (id: string) => del<boolean>(`/api/v1/productgroups/${id}`),
};

// ── Products ──────────────────────────────────────────────────────────────────
export const productsApi = {
  list: (params?: { productGroupId?: string; isActive?: boolean }) =>
    get<ProductDto[]>('/api/v1/products', params),
  getAll: (params?: { productGroupId?: string; isActive?: boolean }) =>
    get<ProductDto[]>('/api/v1/products', params),
  getById: (id: string) => get<ProductDetailDto>(`/api/v1/products/${id}`),
  search: (searchTerm?: string, productGroupId?: string, limit = 50) =>
    get<ProductSearchDto[]>('/api/v1/products/search', { searchTerm, productGroupId, limit }),
  create: (cmd: CreateProductCommand) => {
    const payload = {
      nameEnglish: cmd.nameEnglish,
      nameMalayalam: cmd.nameMalayalam || '',
      sku: cmd.sku || '',
      productGroupId: cmd.productGroupId,
      productUnitId: cmd.productUnitId,
      basePrice: cmd.basePrice,
    };
    return post<{ id: string }>('/api/v1/products', payload);
  },
  update: (id: string, cmd: UpdateProductCommand) => {
    const payload = {
      id,
      nameEnglish: cmd.nameEnglish,
      nameMalayalam: cmd.nameMalayalam || '',
      sku: cmd.sku || '',
      productGroupId: cmd.productGroupId,
      productUnitId: cmd.productUnitId,
      basePrice: cmd.basePrice,
      isActive: cmd.isActive,
    };
    return put<{ id: string }>(`/api/v1/products/${id}`, payload);
  },
  delete: (id: string) => del<boolean>(`/api/v1/products/${id}`),
  updateBasePrice: (id: string, newPrice: number, reason?: string) =>
    put<{ id: string }>(`/api/v1/products/${id}/base-price`, { productId: id, newPrice, reason }),
  getPriceHistory: (id: string, limit?: number) =>
    get<PriceHistoryDto[]>(`/api/v1/products/${id}/price-history`, limit ? { limit } : undefined),

  // ── NEW: Per-Unit Pricing endpoints ──────────────────────────────────────
  getUnitPrices: (productId: string) =>
    get<ProductUnitPriceDto[]>(`/api/v1/products/${productId}/unit-prices`),

  addUnitPrice: (data: CreateProductUnitPriceDto) =>
    post<ProductUnitPriceDto>('/api/v1/products/unit-price', data),

  updateUnitPrice: (id: string, data: UpdateProductUnitPriceDto) =>
    put<ProductUnitPriceDto>(`/api/v1/products/unit-price/${id}`, { ...data }),

  deleteUnitPrice: (id: string) =>
    del<boolean>(`/api/v1/products/unit-price/${id}`),
};

// ── Units ─────────────────────────────────────────────────────────────────────
export const unitsApi = {
  getAll: () => get<UnitDto[]>('/api/v1/productunits'),
  create: (name: string, abbreviation?: string) => post<{ id: string }>('/api/v1/productunits', { name, abbreviation }),
  update: (id: string, name: string, abbreviation?: string) => put<{ id: string }>(`/api/v1/productunits/${id}`, { id, name, abbreviation }),
  delete: (id: string) => del<boolean>(`/api/v1/productunits/${id}`),
  getPriorities: () => get<UnitPriorityDto[]>('/api/v1/productunits/priorities'),
  updatePriority: (id: string, priority: number) => put<boolean>(`/api/v1/productunits/${id}/priority`, { priority }),
};

// ── Orders ────────────────────────────────────────────────────────────────────
export const ordersApi = {
  listByRoute: (routeId: string | number, status?: number) =>
    get<OrderDto[]>(`/api/v1/orders/route/${routeId}`, status !== undefined ? { status } : undefined),
  getByRoute: (routeId: string | number, status?: number) =>
    get<OrderDto[]>(`/api/v1/orders/route/${routeId}`, status !== undefined ? { status } : undefined),
  getById: (id: number | string) => get<OrderDetailDto>(`/api/v1/orders/${id}`),
  getCustomerHistory: (customerId: string, limit = 10) =>
    get<CustomerOrderHistoryDto[]>(`/api/v1/orders/customer/${customerId}/history`, { limit }),
  create: (cmd: CreateOrderCommand) => post<OrderDetailDto>('/api/v1/orders', cmd),
  update: (id: number | string, cmd: Partial<CreateOrderCommand> & { id?: number | string }) =>
    put<OrderDetailDto>(`/api/v1/orders/${id}`, cmd),

  /** Salesman submits Draft → PendingApproval */
  submit: (id: number | string) => post<OrderDetailDto>(`/api/v1/orders/${id}/submit`),

  /** Admin approves PendingApproval → Approved */
  approve: (id: number | string) => post<OrderDetailDto>(`/api/v1/orders/${id}/approve`),

  /** Admin: list orders awaiting approval */
  getPendingApproval: (routeId?: string, date?: string) =>
    get<OrderDto[]>('/api/v1/orders/admin/pending-approval', {
      ...(routeId ? { routeId } : {}),
      ...(date    ? { date }    : {}),
    }),

  /** Admin: badge count — cheap endpoint */
  getPendingApprovalCount: () =>
    get<number>('/api/v1/orders/admin/pending-approval/count'),

  close: (id: number | string) => post<OrderDetailDto>(`/api/v1/orders/${id}/close`),
  delete: (id: number | string) => del<boolean>(`/api/v1/orders/${id}`),
};

// ── Settlement ────────────────────────────────────────────────────────────────
export const settlementApi = {
  getSummary: (routeId?: string, asOfDate?: string) =>
    get<ExpectedCashDto>('/api/v1/settlement/summary', { routeId, asOfDate }),
  summary: () =>
    get<SettlementSummaryDto>('/api/v1/settlement/summary'),
  getOutstanding: (routeId?: string, customerId?: string) =>
    get<OutstandingSummaryDto>('/api/v1/settlement/outstanding', { routeId, customerId }),
  outstanding: async (): Promise<OutstandingCustomerDto[]> => {
    const data = await get<OutstandingSummaryDto>('/api/v1/settlement/outstanding');
    return data.customers ?? [];
  },
  getStatus: (date?: string) =>
    get<DailyClosureStatusDto>('/api/v1/settlement/status', date ? { date } : undefined),
  closeDay: (closureDate: string, notes?: string) =>
    post<DailyClosureResultDto>('/api/v1/settlement/close-day', { closureDate, notes }),
  recordPayment: (body: {
    customerId: number | string; amount: number; paymentDate: string; note?: string;
    paymentReference?: string; paymentMode?: string; remarks?: string;
  }) => post('/api/v1/settlement/record-payment', body),
};

// ── Reports (PDF) ─────────────────────────────────────────────────────────────
export const reportsApi = {
  // FIXED: routeId accepts string (GUID) or undefined
  loadingSheet: async (date: string, routeId?: string) => {
    const params: Record<string, string> = { date };
    if (routeId) params.routeId = routeId;
    const res = await apiClient.get('/api/v1/reports/loading-sheet', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  billingSheet: async (date: string, routeId?: string) => {
    const params: Record<string, string> = { date };
    if (routeId) params.routeId = routeId;
    const res = await apiClient.get('/api/v1/reports/billing-sheet', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  routeSummary: async (fromDate: string, toDate: string, routeId?: string) => {
    const params: Record<string, string> = { fromDate, toDate };
    if (routeId) params.routeId = routeId;
    const res = await apiClient.get('/api/v1/reports/route-summary', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  productSummary: async (fromDate: string, toDate: string, productGroupId?: string) => {
    const params: Record<string, string> = { fromDate, toDate };
    if (productGroupId) params.productGroupId = productGroupId;
    const res = await apiClient.get('/api/v1/reports/product-summary', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  dailySummary: async (date: string) => {
    const res = await apiClient.get('/api/v1/reports/daily-summary', {
      params: { date },
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  downloadLoadingSheet: async (routeId?: string, date?: string) => {
    const params: Record<string, string> = {};
    if (routeId) params.routeId = routeId;
    if (date) params.date = date;
    const res = await apiClient.get('/api/v1/reports/loading-sheet', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  downloadBillingSheet: async (routeId?: string, date?: string) => {
    const params: Record<string, string> = {};
    if (routeId) params.routeId = routeId;
    if (date) params.date = date;
    const res = await apiClient.get('/api/v1/reports/billing-sheet', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  downloadRouteSummary: async (routeId?: string, fromDate?: string, toDate?: string) => {
    const params: Record<string, string> = {};
    if (routeId) params.routeId = routeId;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const res = await apiClient.get('/api/v1/reports/route-summary', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  downloadProductSummary: async (productGroupId?: string, fromDate?: string, toDate?: string) => {
    const params: Record<string, string> = {};
    if (productGroupId) params.productGroupId = productGroupId;
    if (fromDate) params.fromDate = fromDate;
    if (toDate) params.toDate = toDate;
    const res = await apiClient.get('/api/v1/reports/product-summary', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
  downloadDailySummary: async (date?: string) => {
    const params: Record<string, string> = {};
    if (date) params.date = date;
    const res = await apiClient.get('/api/v1/reports/daily-summary', {
      params,
      responseType: 'blob',
    });
    return res.data as Blob;
  },
};

// ── Analytics ─────────────────────────────────────────────────────────────────
export const analyticsApi = {
  getDashboardKpis: (date?: string) =>
    get<DashboardKpisDto>('/api/v1/analytics/dashboard/kpis', date ? { date } : undefined),
  getProductProfitability: (params?: {
    productGroupId?: string; showOnlyNegativeMargin?: boolean;
    fromDate?: string; toDate?: string;
  }) => get<ProductProfitabilityDto[]>('/api/v1/analytics/product-profitability', params),
  getRouteProfitability: (params?: {
    routeId?: string; showOnlyNegativeMargin?: boolean;
    fromDate?: string; toDate?: string;
  }) => get<RouteProfitabilityDto[]>('/api/v1/analytics/route-profitability', params),
  getTopProducts: (params?: {
    fromDate?: string; toDate?: string;
    productGroupId?: string; limit?: number; sortBy?: string;
  }) => get<TopProductDto[]>('/api/v1/analytics/top-products', params),
  getRoutePerformance: (params?: { routeId?: string; fromDate?: string; toDate?: string }) =>
    get<RoutePerformanceResponseDto>('/api/v1/analytics/route-performance', params),
  getProductPerformance: (params?: {
    productGroupId?: string; fromDate?: string; toDate?: string; limit?: number; sortBy?: string;
  }) => get<ProductPerformanceResponseDto>('/api/v1/analytics/product-performance', params),
  getPeriodComparison: (fromDate: string, toDate: string, routeId?: string) =>
    get<PeriodComparisonResponseDto>('/api/v1/analytics/period-comparison', {
      fromDate, toDate, routeId, compareWithPrevious: true,
    }),
  getOrderMargin: (orderId: string) =>
    get<OrderMarginDto>(`/api/v1/analytics/order/${orderId}/margin`),
  getPricingAudit: (params?: {
    productId?: string; action?: string; fromDate?: string; toDate?: string; limit?: number;
  }) => get<PricingAuditLogDto[]>('/api/v1/analytics/pricing-audit', params),
};

// ── Incentives ────────────────────────────────────────────────────────────────
export const incentivesApi = {
  getProductIncentives: (productId?: string, isActive?: boolean) =>
    get<ProductIncentiveDto[]>('/api/v1/incentives/product', { productId, isActive }),
  createProductIncentive: (body: {
    productId: string; incentiveType: number; incentiveValue: number;
    minQuantity?: number; validFrom?: string; validTo?: string; description?: string;
  }) => post('/api/v1/incentives/product', body),
  updateProductIncentive: (id: string, body: object) =>
    put(`/api/v1/incentives/product/${id}`, { id, ...body }),
  deleteProductIncentive: (id: string) =>
    del(`/api/v1/incentives/product/${id}`),
  getSalesmanIncentiveSummary: (salesmanId?: string, fromDate?: string, toDate?: string) =>
    get<SalesmanIncentiveSummaryDto>('/api/v1/incentives/salesman-summary', {
      salesmanId, fromDate, toDate,
    }),
  salesmanSummary: () =>
    get<SalesmanIncentiveSummaryDto>('/api/v1/incentives/salesman-summary'),
};

// ── PDF download helper ───────────────────────────────────────────────────────
export function triggerPdfDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Warehouse ─────────────────────────────────────────────────────────────────
export const warehouseApi = {
  /** Approved orders waiting to be packed */
  getPendingOrders: (params?: {
    fromDate?: string;
    toDate?: string;
    routeId?: string;
    packingStatus?: number;
    search?: string;
  }) => get<WarehouseOrderDto[]>('/api/v1/warehouse/orders/pending', params),

  /** Closed orders — answers "where did yesterday's orders go?" */
  getClosedOrders: (params?: {
    fromDate?: string;
    toDate?: string;
    routeId?: string;
    search?: string;
  }) => get<WarehouseOrderDto[]>('/api/v1/warehouse/orders/closed', params),

  /** Salesman: check if all approved orders for a route are packed */
  getPackingStatus: (routeId: string) =>
    get<RoutePackingStatusDto>(`/api/v1/warehouse/orders/packing-status/${routeId}`),

  packOrder: (orderId: string, isPartial = false) =>
    post<boolean>(`/api/v1/warehouse/orders/${orderId}/pack`, { isPartial }),

  bulkPack: (orderIds: string[]) =>
    post<number>('/api/v1/warehouse/orders/bulk-pack', { orderIds }),

  getSummary: (date?: string) =>
    get<WarehouseSummaryDto>('/api/v1/warehouse/summary', date ? { date } : undefined),
};

// ── Route Assignments ─────────────────────────────────────────────────────────
export const routeAssignmentsApi = {
  getByDateRange: (fromDate: string, toDate: string) =>
    get<RouteAssignmentDto[]>('/api/v1/route-assignments', { fromDate, toDate }),

  getByDate: (date: string) =>
    get<RouteAssignmentDto[]>('/api/v1/route-assignments', { date }),

  upsert: (body: {
    routeId: string;
    salesmanId: string;
    assignmentDate: string;
    notes?: string;
  }) => post<RouteAssignmentDto>('/api/v1/route-assignments', body),

  delete: (id: string) => del<boolean>(`/api/v1/route-assignments/${id}`),

  getMyRoutesToday: (date?: string) =>
    get<TodayRouteDto[]>('/api/v1/route-assignments/my-routes', date ? { date } : undefined),
};