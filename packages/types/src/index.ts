export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  COMPANY_ADMIN = 'COMPANY_ADMIN',
  MANAGER = 'MANAGER',
  EMPLOYEE = 'EMPLOYEE',
}

export enum SubscriptionPlan {
  FREE = 'FREE',
  PRO = 'PRO',
  ENTERPRISE = 'ENTERPRISE',
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
  };
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
  companyName?: string;
}

export interface CompanySetupRequest {
  name: string;
  industry?: string;
  country?: string;
  timezone?: string;
  employeeCount?: number;
  insuranceProvider?: string;
  healthcareBudget?: number;
  workingDays?: string[];
  businessHoursStart?: string;
  businessHoursEnd?: string;
}

export interface EmployeeProfileRequest {
  firstName?: string;
  lastName?: string;
  gender?: string;
  age?: number;
  height?: number;
  weight?: number;
  departmentId?: string;
  position?: string;
  managerId?: string;
  bloodGroup?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  allergies?: string[];
  existingConditions?: string[];
  smokingStatus?: string;
  alcoholConsumption?: string;
  exerciseFrequency?: string;
}

export interface HealthCheckinRequest {
  sleepHours?: number;
  mood?: string;
  energy?: string;
  stress?: string;
  exerciseMinutes?: number;
  waterIntake?: number;
  mealsCount?: number;
  painLevel?: number;
  symptoms?: string[];
  medicineTaken?: boolean;
  medicineNotes?: string;
  weight?: number;
  notes?: string;
}

export interface ChatMessageRequest {
  sessionId?: string;
  message: string;
}

export interface ExpenseRequest {
  category: string;
  amount: number;
  description?: string;
  department?: string;
  employeeId?: string;
  date: string;
}

export interface WellnessScoreBreakdown {
  overallScore: number;
  sleepScore?: number;
  exerciseScore?: number;
  stressScore?: number;
  nutritionScore?: number;
  hydrationScore?: number;
}

export interface DashboardStats {
  todayScore?: number;
  mood?: string;
  waterIntake?: number;
  exerciseMinutes?: number;
  weight?: number;
  sleepHours?: number;
  medicationTaken?: boolean;
  activeGoals?: number;
  recentInsights?: string[];
}

export interface EmployerDashboardStats {
  employeeCount: number;
  activeUsers: number;
  dailyCheckins: number;
  averageWellness: number;
  highRiskEmployees: number;
  pendingReports: number;
  insuranceSpending: number;
  healthcareSpending: number;
  averageSickDays: number;
}
