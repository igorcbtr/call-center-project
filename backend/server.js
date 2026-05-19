require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const auth    = require('./logRegController');
const admin   = require('./adminService');
const grafic  = require('./graficController');
const docs    = require('./documentsController');
const tasks   = require('./tasksController');
const notifications = require('./notificationHub');
const authMw  = require('./middleware');
const { requireRole } = authMw;

const app  = express();
const PORT = Number(process.env.PORT || 3002);
const allowedOrigins = new Set([
  process.env.CORS_ORIGIN || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json());
app.use('/docs', express.static(path.join(__dirname, '../docs')));
// Serve uploaded files (protected via API, not directly)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const api = express.Router();

// Auth
api.get ('/users',    auth.getUsers);
api.post('/login',    auth.login);
api.post('/register', auth.register);
api.get ('/auth/me',  authMw, auth.me);

// Employees
api.get   ('/admin/employees',                    authMw, requireRole('admin','moderator'), admin.getAllEmployees);
api.get   ('/admin/employees/:id',                authMw, requireRole('admin','moderator'), admin.getEmployeeById);
api.post  ('/admin/employees',                    authMw, requireRole('admin','moderator'), admin.createEmployee);
api.put   ('/admin/employees/:id',                authMw, requireRole('admin','moderator'), admin.updateEmployee);
api.post  ('/admin/employees/:id/reset-password', authMw, requireRole('admin'),             admin.resetEmployeePassword);
api.delete('/admin/employees/:id',                authMw, requireRole('admin'),             admin.deleteEmployee);
api.put   ('/admin/employees/:id/moderators',     authMw, requireRole('admin'),             admin.setModeratorStaff);
api.post  ('/admin/employees/:id/comments',       authMw, requireRole('admin','moderator'), admin.addComment);
api.delete('/admin/comments/:id',                 authMw, requireRole('admin','moderator'), admin.deleteComment);
api.post  ('/admin/employees/:id/tests',          authMw, requireRole('admin','moderator'), admin.addTestResult);
api.delete('/admin/tests/:id',                    authMw, requireRole('admin','moderator'), admin.deleteTestResult);
api.get   ('/admin/audit',                        authMw, requireRole('admin'),             admin.getAuditLog);
api.get   ('/moderator/my-staff',                 authMw, requireRole('moderator'),         admin.getMyStaff);

// Shift types (only admin can create/edit)
api.get   ('/admin/shift-types',     authMw, admin.getShiftTypes);
api.post  ('/admin/shift-types',     authMw, requireRole('admin'), admin.createShiftType);
api.put   ('/admin/shift-types/:id', authMw, requireRole('admin'), admin.updateShiftType);
api.delete('/admin/shift-types/:id', authMw, requireRole('admin'), admin.deleteShiftType);

// Limits (admin: global; moderator: exceptions only)
api.get   ('/admin/shift-limits',                authMw, admin.getShiftLimits);
api.put   ('/admin/shift-limits',                authMw, requireRole('admin'),             admin.putShiftLimits);
api.post  ('/admin/shift-limits/exception',      authMw, requireRole('admin','moderator'), admin.upsertLimitException);
api.delete('/admin/shift-limits/exception/:id',  authMw, requireRole('admin','moderator'), admin.deleteLimitException);

// QR
api.post  ('/admin/qr',     authMw, requireRole('admin'), admin.createQrPlace);
api.get   ('/admin/qr',     authMw, requireRole('admin'), admin.getQrPlaces);
api.delete('/admin/qr/:id', authMw, requireRole('admin'), admin.deleteQrPlace);

// Stats & logs
api.get('/admin/stats/shifts-by-user', authMw, requireRole('admin','moderator'), admin.getShiftStatsByUser);
api.get('/admin/work-logs',            authMw, admin.getWorkLogs);

// Schedule
api.get ('/schedule/shift-types',          authMw, grafic.getShiftTypes);
api.post('/schedule/available-shifts',     authMw, grafic.getAvailableShifts);
api.post('/schedule/entries',              authMw, grafic.createShiftEntry);
api.put ('/schedule/entries/:id',          authMw, requireRole('admin','moderator'), grafic.updateShiftEntry);
api.post('/schedule/user-schedule',        authMw, grafic.getUserSchedule);
api.post('/schedule/all-schedules',        authMw, grafic.getAllSchedules);
api.post('/schedule/delete-entry',         authMw, requireRole('admin','moderator'), grafic.deleteShiftEntry);
api.post('/schedule/entries/:id/respond',  authMw, grafic.respondShiftEntry);
api.post('/schedule/approve-week',         authMw, requireRole('admin'), grafic.approveWeek);
api.post('/schedule/change-requests',      authMw, grafic.createChangeRequest);
api.get ('/schedule/change-requests',      authMw, requireRole('admin','moderator'), grafic.getChangeRequests);
api.post('/schedule/process-request',      authMw, requireRole('admin','moderator'), grafic.processChangeRequest);
api.get ('/schedule/shift-limits',         authMw, grafic.getShiftLimits);
api.put ('/schedule/shift-limits',         authMw, requireRole('admin'), grafic.putShiftLimits);

// Scan
api.post('/scan/action', authMw, admin.scanAction);
api.post('/schedule/public-schedule', authMw, grafic.getPublicSchedule);
api.get ('/scan/logs',   authMw, requireRole('admin','moderator'), admin.getWorkLogs);

// Notifications
api.get ('/notifications/stream', notifications.stream);
api.get ('/notifications',      authMw, grafic.getNotifications);
api.post('/notifications/read', authMw, grafic.markNotificationsRead);

// Documents
api.get   ('/documents/categories',         authMw, docs.listCategories);
api.post  ('/documents/categories',         authMw, requireRole('admin','moderator'), docs.createCategory);
api.get   ('/documents',                    authMw, docs.listDocuments);
api.get   ('/documents/admin/:userId',      authMw, requireRole('admin','moderator'), docs.listDocumentsAdmin);
api.post  ('/documents/upload',             authMw, docs.upload.single('file'), docs.uploadDocument);
api.get   ('/documents/:id/download',       authMw, docs.downloadDocument);
api.delete('/documents/:id',                authMw, docs.deleteDocument);

// Tasks
api.get   ('/tasks',                                  authMw, tasks.getTasks);
api.post  ('/tasks',                                  authMw, tasks.createTask);
api.post  ('/tasks/:id/attachments',                  authMw, tasks.upload.array('files', 5), tasks.uploadTaskAttachments);
api.get   ('/tasks/attachments/:attachmentId/download', authMw, tasks.downloadTaskAttachment);
api.delete('/tasks/attachments/:attachmentId',        authMw, tasks.deleteTaskAttachment);
api.put   ('/tasks/:id',                              authMw, tasks.updateTask);
api.delete('/tasks/:id',                              authMw, requireRole('admin','moderator'), tasks.deleteTask);

app.use('/api', api);
app.listen(PORT, () => {
  console.log(`MVP backend listening on http://localhost:${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  console.log(`Docs: http://localhost:${PORT}/docs`);
});
