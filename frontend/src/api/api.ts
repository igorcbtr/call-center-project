import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AuthState } from '../features/auth/authSlice';
import type {
  AllSchedulesResponse, ChangeRequest, Notification, QrPlace,
  ShiftEntry, ShiftLimitsData, ShiftType, ShiftStatRow,
  User, WorkLog, LoginResponse, StaffComment, TestResult, AuditEntry,
} from './types';

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3002/api';

export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as { auth: AuthState }).auth.token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Employee','Schedule','ShiftTypes','Limits','Stats','Me','Notifications','ChangeRequests','QR','Logs'],
  endpoints: (b) => ({
    login: b.mutation<LoginResponse, { username: string; password: string }>({
      query: ({ username, password }) => ({ url:'/login', method:'POST', body:{ login:username, username, password } }),
    }),
    register: b.mutation<{ message: string }, { login: string; password: string }>({
      query: (body) => ({ url:'/register', method:'POST', body }),
    }),
    me: b.query<User, void>({ query: () => '/auth/me', providesTags: ['Me'] }),

    employees: b.query<User[], { status?: string } | void>({
      query: (p) => `/admin/employees${p?.status ? `?status=${p.status}` : ''}`,
      providesTags: ['Employee'],
    }),
    employeeById: b.query<User, number>({
      query: (id) => `/admin/employees/${id}`,
      providesTags: (_,__,id) => [{ type:'Employee', id }],
    }),
    createEmployee: b.mutation<{ employee: User }, Partial<User> & { password?: string }>({
      query: (body) => ({ url:'/admin/employees', method:'POST', body }),
      invalidatesTags: ['Employee'],
    }),
    updateEmployee: b.mutation<{ employee: User }, { id: number; body: Partial<User> }>({
      query: ({ id, body }) => ({ url:`/admin/employees/${id}`, method:'PUT', body }),
      invalidatesTags: ['Employee'],
    }),
    deleteEmployee: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/employees/${id}`, method:'DELETE' }),
      invalidatesTags: ['Employee'],
    }),
    resetPassword: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/employees/${id}/reset-password`, method:'POST' }),
    }),
    setModeratorStaff: b.mutation<void, { staffId: number; moderator_ids: number[] }>({
      query: ({ staffId, moderator_ids }) => ({ url:`/admin/employees/${staffId}/moderators`, method:'PUT', body:{ moderator_ids } }),
      invalidatesTags: ['Employee'],
    }),
    addComment: b.mutation<{ comment: StaffComment }, { staffId: number; body: string }>({
      query: ({ staffId, body }) => ({ url:`/admin/employees/${staffId}/comments`, method:'POST', body:{ body } }),
      invalidatesTags: ['Employee'],
    }),
    deleteComment: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/comments/${id}`, method:'DELETE' }),
      invalidatesTags: ['Employee'],
    }),
    addTestResult: b.mutation<{ result: TestResult }, { userId: number; test_name: string; score?: string; comment?: string }>({
      query: ({ userId, ...body }) => ({ url:`/admin/employees/${userId}/tests`, method:'POST', body }),
      invalidatesTags: ['Employee'],
    }),
    deleteTestResult: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/tests/${id}`, method:'DELETE' }),
      invalidatesTags: ['Employee'],
    }),
    auditLog: b.query<AuditEntry[], { target_id?: number } | void>({
      query: (p) => `/admin/audit${p?.target_id ? `?target_id=${p.target_id}` : ''}`,
    }),

    shiftTypes: b.query<ShiftType[], void>({ query: () => '/admin/shift-types', providesTags: ['ShiftTypes'] }),
    createShiftType: b.mutation<void, Partial<ShiftType> & { allowed_roles?: string[] }>({
      query: (body) => ({ url:'/admin/shift-types', method:'POST', body }),
      invalidatesTags: ['ShiftTypes'],
    }),
    updateShiftType: b.mutation<void, { id: number } & Partial<ShiftType> & { allowed_roles?: string[] }>({
      query: ({ id, ...body }) => ({ url:`/admin/shift-types/${id}`, method:'PUT', body }),
      invalidatesTags: ['ShiftTypes'],
    }),
    deleteShiftType: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/shift-types/${id}`, method:'DELETE' }),
      invalidatesTags: ['ShiftTypes'],
    }),

    shiftLimitsData: b.query<ShiftLimitsData, void>({ query: () => '/admin/shift-limits', providesTags: ['Limits'] }),
    putShiftLimits: b.mutation<void, { limits: { role: string; min_shifts_per_week: number; max_shifts_per_week: number }[] }>({
      query: (body) => ({ url:'/admin/shift-limits', method:'PUT', body }),
      invalidatesTags: ['Limits'],
    }),
    upsertLimitException: b.mutation<void, { user_id: number; min_shifts_per_week: number; max_shifts_per_week: number; note?: string; extra_shift_type_ids?: number[] }>({
      query: (body) => ({ url:'/admin/shift-limits/exception', method:'POST', body }),
      invalidatesTags: ['Limits'],
    }),
    deleteLimitException: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/shift-limits/exception/${id}`, method:'DELETE' }),
      invalidatesTags: ['Limits'],
    }),

    userSchedule: b.mutation<ShiftEntry[], { user_id: number; start_date: string; end_date: string }>({
      query: (body) => ({ url:'/schedule/user-schedule', method:'POST', body }),
    }),
    allSchedules: b.mutation<AllSchedulesResponse, { start_date: string; end_date: string }>({
      query: (body) => ({ url:'/schedule/all-schedules', method:'POST', body }),
    }),
    createShift: b.mutation<{ entry: ShiftEntry }, { user_id: number; date: string; shift_type_id: number; comment?: string; custom_start?: string; custom_end?: string }>({
      query: (body) => ({ url:'/schedule/entries', method:'POST', body }),
      invalidatesTags: ['Schedule','Stats'],
    }),
    updateShift: b.mutation<{ entry: ShiftEntry }, { entry_id: number; shift_type_id: number; comment?: string; custom_start?: string; custom_end?: string }>({
      query: ({ entry_id, ...body }) => ({ url:`/schedule/entries/${entry_id}`, method:'PUT', body:{ entry_id, ...body } }),
      invalidatesTags: ['Schedule'],
    }),
    deleteShift: b.mutation<void, { entry_id: number }>({
      query: (body) => ({ url:'/schedule/delete-entry', method:'POST', body }),
      invalidatesTags: ['Schedule','Stats'],
    }),

    createChangeRequest: b.mutation<{ request: ChangeRequest }, { user_id: number; shift_entry_id?: number; requested_date?: string; requested_shift_type_id?: number; type: string; user_comment?: string }>({
      query: (body) => ({ url:'/schedule/change-requests', method:'POST', body }),
      invalidatesTags: ['ChangeRequests','Notifications'],
    }),
    changeRequests: b.query<ChangeRequest[], { status?: string; date_from?: string; date_to?: string } | void>({
      query: (p) => {
        const params = new URLSearchParams();
        if (p?.status) params.set('status', p.status);
        if (p?.date_from) params.set('date_from', p.date_from);
        if (p?.date_to) params.set('date_to', p.date_to);
        const qs = params.toString();
        return `/schedule/change-requests${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['ChangeRequests'],
    }),
    processChangeRequest: b.mutation<void, { request_id: number; status: string; admin_comment?: string; admin_id: number; new_shift_type_id?: number }>({
      query: (body) => ({ url:'/schedule/process-request', method:'POST', body }),
      invalidatesTags: ['ChangeRequests','Schedule','Notifications'],
    }),

    shiftStats: b.query<ShiftStatRow[], { year: number; month: number }>({
      query: ({ year, month }) => `/admin/stats/shifts-by-user?year=${year}&month=${month}`,
      providesTags: ['Stats'],
    }),

    qrPlaces: b.query<QrPlace[], void>({ query: () => '/admin/qr', providesTags: ['QR'] }),
    createQr: b.mutation<QrPlace, { place: string }>({
      query: (body) => ({ url:'/admin/qr', method:'POST', body }),
      invalidatesTags: ['QR'],
    }),
    deleteQr: b.mutation<void, number>({
      query: (id) => ({ url:`/admin/qr/${id}`, method:'DELETE' }),
      invalidatesTags: ['QR'],
    }),
    scanAction: b.mutation<{ message: string }, { place: string; code?: string; action: 'in'|'out' }>({
      query: (body) => ({ url:'/scan/action', method:'POST', body }),
    }),
    workLogs: b.query<WorkLog[], { date?: string; user_id?: number } | void>({
      query: (p) => {
        const params = new URLSearchParams();
        if (p?.date) params.set('date', p.date);
        if (p?.user_id) params.set('user_id', String(p.user_id));
        const qs = params.toString();
        return `/admin/work-logs${qs ? `?${qs}` : ''}`;
      },
      providesTags: ['Logs'],
    }),

    notifications: b.query<{ notifications: Notification[]; unread_count: number }, void>({
      query: () => '/notifications',
      providesTags: ['Notifications'],
    }),
    markNotificationsRead: b.mutation<void, { ids?: number[] }>({
      query: (body) => ({ url:'/notifications/read', method:'POST', body }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useLoginMutation, useRegisterMutation, useMeQuery,
  useEmployeesQuery, useEmployeeByIdQuery, useCreateEmployeeMutation, useUpdateEmployeeMutation,
  useDeleteEmployeeMutation, useResetPasswordMutation, useSetModeratorStaffMutation,
  useAddCommentMutation, useDeleteCommentMutation,
  useAddTestResultMutation, useDeleteTestResultMutation, useAuditLogQuery,
  useShiftTypesQuery, useCreateShiftTypeMutation, useUpdateShiftTypeMutation, useDeleteShiftTypeMutation,
  useShiftLimitsDataQuery, usePutShiftLimitsMutation, useUpsertLimitExceptionMutation, useDeleteLimitExceptionMutation,
  useUserScheduleMutation, useAllSchedulesMutation,
  useCreateShiftMutation, useUpdateShiftMutation, useDeleteShiftMutation,
  useCreateChangeRequestMutation, useChangeRequestsQuery, useProcessChangeRequestMutation,
  useShiftStatsQuery,
  useQrPlacesQuery, useCreateQrMutation, useDeleteQrMutation, useScanActionMutation, useWorkLogsQuery,
  useNotificationsQuery, useMarkNotificationsReadMutation,
} = api;
