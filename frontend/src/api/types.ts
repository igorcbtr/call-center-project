export type UserRole = 'admin'|'moderator'|'operator'|'stajer'|'uchenik';

export interface ModeratorRef { id:number; fio:string; }

export interface User {
  id:number; username?:string|null; fio:string;
  role:UserRole; status:boolean; created_at?:string;
  moderators?:ModeratorRef[];
  shifts?:ShiftEntry[]; work_logs?:WorkLog[];
  comments?:StaffComment[]; tests?:TestResult[]; audit?:AuditEntry[];
}

export interface ShiftType {
  id:number; name:string; start_time?:string; end_time?:string;
  color:string; is_active:boolean; is_free:boolean;
  allowed_roles?:string[];
  user_overrides?:{user_id:number;type:string;fio:string}[];
}

export interface ShiftEntry {
  id:number; user_id:number; fio?:string; user_role?:string;
  date:string; shift_type_id:number; shift_name?:string;
  start_time?:string; end_time?:string; color?:string;
  custom_start?:string; custom_end?:string;
  is_free?:boolean;
  week_id?:number; comment?:string; status:string;
}

export interface ChangeRequest {
  id:number; user_id:number; user_fio?:string; user_role?:string;
  shift_entry_id?:number; entry_date?:string;
  shift_name?:string; shift_color?:string;
  requested_date?:string; requested_shift_type_id?:number;
  requested_shift_name?:string; requested_shift_color?:string;
  type:string; user_comment?:string; status:string; admin_comment?:string;
  created_at:string; processed_at?:string; processed_by?:number;
}

export interface Notification {
  id:number; user_id:number; title:string; body?:string;
  is_read:boolean; kind:string; ref_id?:number; ref_type?:string;
  created_at:string;
}

export interface ShiftLimit { role:UserRole; min_shifts_per_week:number; max_shifts_per_week:number; }
export interface ShiftLimitException {
  id:number; user_id:number; fio?:string; user_role?:string;
  min_shifts_per_week:number; max_shifts_per_week:number; note?:string;
  extra_shift_types?:{id:number;name:string;color:string}[];
}
export interface ShiftLimitsData { limits:ShiftLimit[]; exceptions:ShiftLimitException[]; }

export interface QrPlace { id:number; place:string; code:string; link:string; created_at:string; qrDataUrl?:string; }
export interface WorkLog { id:number; user_id?:number; fio?:string; user_fio?:string; user_role?:string; place?:string; event_type:string; created_at:string; }
export interface StaffComment { id:number; staff_id:number; author_id:number; author_fio?:string; author_role?:string; body:string; created_at:string; }
export interface TestResult { id:number; user_id:number; added_by:number; added_by_fio?:string; test_name:string; score?:string; comment?:string; created_at:string; }
export interface AuditEntry { id:number; actor_id?:number; actor_fio?:string; target_id?:number; target_fio?:string; action:string; details?:Record<string,unknown>; created_at:string; }
export interface ShiftStatRow { id:number; fio:string; role:string; shift_count:number; }

export interface AllSchedulesResponse { entries:ShiftEntry[]; changeRequests:ChangeRequest[]; }
export interface LoginResponse { token:string; user?:User; role:UserRole; id:number; fio:string; username:string; }
