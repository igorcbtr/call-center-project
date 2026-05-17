import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { AuthState } from '../features/auth/authSlice';
import type {
  AllSchedulesResponse, ChangeRequest, CreateChangeRequestBody, CreateEmployeeInput,
  CreateFreeTimeBody, CreateShiftBody, DeleteShiftBody, FreeTime, LoginRequest, LoginResponse,
  Notification, ProcessChangeRequestBody, PutShiftLimitsBody, RespondShiftBody, ScheduleRangeBody,
  ShiftEntry, ShiftLimit, ShiftStatRow, ShiftType, ShiftTypeRoleRow, UpdateEmployeeInput,
  UpdateShiftBody, User, UserScheduleBody,
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
  tagTypes: ['Employee', 'Schedule', 'ShiftTypes', 'Limits', 'FreeTime', 'Stats', 'Me', 'ShiftRoles', 'Notifications', 'ChangeRequests'],
  endpoints: (builder) => ({
    login: builder.mutation<LoginResponse, LoginRequest>({
      query: (body) => ({ url: '/login', method: 'POST', body }),
    }),
    me: builder.query<User, void>({
      query: () => '/auth/me',
      providesTags: ['Me'],
    }),
    employees: builder.query<User[], void>({
      query: () => '/admin/employees',
      providesTags: ['Employee'],
    }),
    createEmployee: builder.mutation<{ employee: User }, CreateEmployeeInput>({
      query: (body) => ({ url: '/admin/employees', method: 'POST', body }),
      invalidatesTags: ['Employee'],
    }),
    updateEmployee: builder.mutation<{ employee: User }, { id: number; body: UpdateEmployeeInput }>({
      query: ({ id, body }) => ({ url: `/admin/employees/${id}`, method: 'PUT', body }),
      invalidatesTags: ['Employee'],
    }),
    deleteEmployee: builder.mutation<void, number>({
      query: (id) => ({ url: `/admin/employees/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Employee', 'Schedule'],
    }),
    shiftTypes: builder.query<ShiftType[], void>({
      query: () => '/schedule/shift-types',
      providesTags: ['ShiftTypes'],
    }),
    shiftTypeRoles: builder.query<ShiftTypeRoleRow[], void>({
      query: () => '/schedule/shift-type-roles',
      providesTags: ['ShiftRoles'],
    }),
    userSchedule: builder.mutation<ShiftEntry[], UserScheduleBody>({
      query: (body) => ({ url: '/schedule/user-schedule', method: 'POST', body }),
    }),
    allSchedules: builder.mutation<AllSchedulesResponse, ScheduleRangeBody>({
      query: (body) => ({ url: '/schedule/all-schedules', method: 'POST', body }),
    }),
    createShift: builder.mutation<{ entry: ShiftEntry }, CreateShiftBody>({
      query: (body) => ({ url: '/schedule/entries', method: 'POST', body }),
      invalidatesTags: ['Schedule', 'Stats'],
    }),
    updateShift: builder.mutation<{ entry: ShiftEntry }, UpdateShiftBody>({
      query: ({ entry_id, ...body }) => ({ url: `/schedule/entries/${entry_id}`, method: 'PUT', body: { entry_id, ...body } }),
      invalidatesTags: ['Schedule', 'Stats'],
    }),
    deleteShift: builder.mutation<void, DeleteShiftBody>({
      query: (body) => ({ url: '/schedule/delete-entry', method: 'POST', body }),
      invalidatesTags: ['Schedule', 'Stats'],
    }),
    respondShift: builder.mutation<{ entry: ShiftEntry }, { id: number; body: RespondShiftBody }>({
      query: ({ id, body }) => ({ url: `/schedule/entries/${id}/respond`, method: 'POST', body }),
      invalidatesTags: ['Schedule', 'Stats'],
    }),
    freeTimeList: builder.query<FreeTime[], number>({
      query: (userId) => `/schedule/free-time?user_id=${userId}`,
      providesTags: (_r, _e, id) => [{ type: 'FreeTime', id }],
    }),
    createFreeTime: builder.mutation<{ free_time: FreeTime }, CreateFreeTimeBody>({
      query: (body) => ({ url: '/schedule/free-time', method: 'POST', body }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'FreeTime', id: arg.user_id }],
    }),
    deleteFreeTime: builder.mutation<void, { id: number; userId: number }>({
      query: ({ id }) => ({ url: `/schedule/free-time/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, arg) => [{ type: 'FreeTime', id: arg.userId }],
    }),
    shiftLimits: builder.query<ShiftLimit[], void>({
      query: () => '/schedule/shift-limits',
      providesTags: ['Limits'],
    }),
    putShiftLimits: builder.mutation<ShiftLimit[], PutShiftLimitsBody>({
      query: (body) => ({ url: '/schedule/shift-limits', method: 'PUT', body }),
      invalidatesTags: ['Limits'],
    }),
    shiftStats: builder.query<ShiftStatRow[], { year: number; month: number }>({
      query: ({ year, month }) => `/admin/stats/shifts-by-user?year=${year}&month=${month}`,
      providesTags: ['Stats'],
    }),
    availableShifts: builder.mutation<ShiftType[], { user_id: number }>({
      query: (body) => ({ url: '/schedule/available-shifts', method: 'POST', body }),
    }),
    createChangeRequest: builder.mutation<{ request: ChangeRequest }, CreateChangeRequestBody>({
      query: (body) => ({ url: '/schedule/change-requests', method: 'POST', body }),
      invalidatesTags: ['ChangeRequests'],
    }),
    changeRequests: builder.query<ChangeRequest[], { status?: string } | void>({
      query: (params) => `/schedule/change-requests${params?.status ? `?status=${params.status}` : ''}`,
      providesTags: ['ChangeRequests'],
    }),
    processChangeRequest: builder.mutation<{ request: ChangeRequest }, ProcessChangeRequestBody>({
      query: (body) => ({ url: '/schedule/process-request', method: 'POST', body }),
      invalidatesTags: ['ChangeRequests', 'Schedule', 'Notifications'],
    }),
    notifications: builder.query<{ notifications: Notification[]; unread_count: number }, void>({
      query: () => '/notifications',
      providesTags: ['Notifications'],
    }),
    markNotificationsRead: builder.mutation<void, { ids?: number[] }>({
      query: (body) => ({ url: '/notifications/read', method: 'POST', body }),
      invalidatesTags: ['Notifications'],
    }),
  }),
});

export const {
  useLoginMutation,
  useMeQuery,
  useEmployeesQuery,
  useCreateEmployeeMutation,
  useUpdateEmployeeMutation,
  useDeleteEmployeeMutation,
  useShiftTypesQuery,
  useShiftTypeRolesQuery,
  useUserScheduleMutation,
  useAllSchedulesMutation,
  useCreateShiftMutation,
  useUpdateShiftMutation,
  useDeleteShiftMutation,
  useRespondShiftMutation,
  useFreeTimeListQuery,
  useCreateFreeTimeMutation,
  useDeleteFreeTimeMutation,
  useShiftLimitsQuery,
  usePutShiftLimitsMutation,
  useShiftStatsQuery,
  useAvailableShiftsMutation,
  useCreateChangeRequestMutation,
  useChangeRequestsQuery,
  useProcessChangeRequestMutation,
  useNotificationsQuery,
  useMarkNotificationsReadMutation,
} = api;
