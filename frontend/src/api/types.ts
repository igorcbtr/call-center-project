export type UserRole = 'admin' | 'moderator' | 'operator' | 'stajer' | 'uchenik';

export interface User {
  id: number;
  username?: string | null;
  fio: string;
  role: UserRole;
  status: boolean;
  created_at?: string;
}

export interface ShiftType {
  id: number;
  name: string;
  start_time: string;
  end_time: string;
  color: string;
  is_active: boolean;
}

export interface ShiftEntry {
  id: number;
  user_id: number;
  fio?: string;
  user_role?: string;
  date: string;
  shift_type_id: number;
  shift_name?: string;
  start_time?: string;
  end_time?: string;
  color?: string;
  week_id?: number;
  comment?: string;
  is_uncertain?: boolean;
  status: string;
  created_by_admin?: boolean;
}

export interface ChangeRequest {
  id: number;
  user_id: number;
  user_fio?: string;
  user_role?: string;
  shift_entry_id?: number;
  entry_date?: string;
  entry_shift_type_id?: number;
  shift_name?: string;
  shift_color?: string;
  requested_date?: string;
  requested_shift_type_id?: number;
  requested_shift_name?: string;
  requested_shift_color?: string;
  type: string;
  new_data?: Record<string, unknown>;
  user_comment?: string;
  status: string;
  admin_comment?: string;
  created_at: string;
  processed_at?: string;
  processed_by?: number;
}

export interface Notification {
  id: number;
  user_id: number;
  title: string;
  body?: string;
  is_read: boolean;
  kind: string;
  ref_id?: number;
  ref_type?: string;
  created_at: string;
}

export interface FreeTime {
  id: number;
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  kind: string;
  created_at: string;
}

export interface ShiftLimit {
  role: UserRole;
  max_shifts_per_week: number;
}

export interface ShiftStatRow {
  id: number;
  fio: string;
  shift_count: number;
}

export interface ShiftTypeRoleRow {
  id: number;
  shift_type_id: number;
  role: string;
  shift_name: string;
}

export interface LoginRequest { username: string; password: string; }
export interface LoginResponse { token: string; user: User; }

export interface CreateEmployeeInput {
  fio: string;
  role: UserRole;
  status?: boolean;
  username?: string;
  password?: string;
}

export interface UpdateEmployeeInput {
  fio: string;
  role: UserRole;
  status: boolean;
  username?: string | null;
}

export interface CreateShiftBody {
  user_id: number;
  date: string;
  shift_type_id: number;
  comment?: string;
  is_uncertain?: boolean;
}

export interface UpdateShiftBody {
  entry_id: number;
  shift_type_id: number;
  comment?: string;
  is_uncertain?: boolean;
}

export interface DeleteShiftBody { entry_id: number; }
export interface RespondShiftBody { action: 'confirm' | 'decline'; }

export interface ScheduleRangeBody { start_date: string; end_date: string; }
export interface UserScheduleBody { user_id: number; start_date: string; end_date: string; }

export interface AllSchedulesResponse {
  entries: ShiftEntry[];
  changeRequests: ChangeRequest[];
}

export interface CreateFreeTimeBody {
  user_id: number;
  date: string;
  start_time: string;
  end_time: string;
  kind?: string;
}

export interface PutShiftLimitsBody { limits: { role: UserRole; max_shifts_per_week: number }[]; }

export interface CreateChangeRequestBody {
  user_id: number;
  shift_entry_id?: number;
  requested_date?: string;
  requested_shift_type_id?: number;
  type: 'edit' | 'delete' | 'custom' | 'new';
  new_data?: Record<string, unknown>;
  user_comment?: string;
}

export interface ProcessChangeRequestBody {
  request_id: number;
  status: 'approved' | 'rejected';
  admin_comment?: string;
  admin_id: number;
  new_shift_type_id?: number;
}
