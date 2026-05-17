require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const controller = require('./logRegController');
const adminService = require('./adminService');
const scanController = require('./ScanController');
const graficController = require('./graficController');
const authMiddleware = require('./middleware');
const requireRole = authMiddleware.requireRole;

const app = express();
const PORT = Number(process.env.PORT || 3002);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

const api = express.Router();

// Auth
api.get('/users', controller.getUsers);
api.post('/login', controller.login);
api.post('/register', controller.register);
api.get('/auth/me', authMiddleware, controller.me);

// Admin - employees
api.post('/admin/create-qr', authMiddleware, requireRole('admin'), adminService.createQrPlace);
api.get('/admin/employees', authMiddleware, requireRole('admin'), adminService.getAllEmployees);
api.get('/admin/employees/:id', authMiddleware, requireRole('admin'), adminService.getEmployeeById);
api.put('/admin/employees/:id', authMiddleware, requireRole('admin'), adminService.updateEmployee);
api.post('/admin/employees', authMiddleware, requireRole('admin'), adminService.createEmployee);
api.post('/admin/employees/:id/reset-password', authMiddleware, requireRole('admin'), adminService.resetEmployeePassword);
api.delete('/admin/employees/:id', authMiddleware, requireRole('admin'), adminService.deleteEmployee);
api.get('/admin/stats/shifts-by-user', authMiddleware, requireRole('admin'), adminService.getShiftStatsByUser);

// QR scan
api.post('/scan/status', authMiddleware, scanController.getStatus);
api.post('/scan/check-in', authMiddleware, scanController.checkIn);
api.post('/scan/check-out', authMiddleware, scanController.checkOut);
api.post('/scan/mark-open', authMiddleware, scanController.markQrOpen);

// Schedule
api.get('/schedule/shift-types', authMiddleware, graficController.getShiftTypes);
api.get('/schedule/shift-type-roles', authMiddleware, graficController.getShiftTypeRoles);
api.post('/schedule/shift-types', authMiddleware, requireRole('admin'), graficController.createShiftType);
api.delete('/schedule/shift-types/:id', authMiddleware, requireRole('admin'), graficController.deleteShiftType);
api.post('/schedule/shift-roles', authMiddleware, requireRole('admin'), graficController.setShiftRoleAccess);
api.post('/schedule/user-override', authMiddleware, requireRole('admin'), graficController.setUserShiftOverride);
api.post('/schedule/available-shifts', authMiddleware, graficController.getAvailableShifts);
api.post('/schedule/entries', authMiddleware, graficController.createShiftEntry);
api.put('/schedule/entries/:id', authMiddleware, requireRole('admin'), graficController.updateShiftEntry);
api.post('/schedule/user-schedule', authMiddleware, graficController.getUserSchedule);
api.post('/schedule/all-schedules', authMiddleware, requireRole('admin'), graficController.getAllSchedules);
api.post('/schedule/delete-entry', authMiddleware, requireRole('admin'), graficController.deleteShiftEntry);
api.post('/schedule/entries/:id/respond', authMiddleware, graficController.respondShiftEntry);
api.post('/schedule/approve-week', authMiddleware, requireRole('admin'), graficController.approveWeek);
api.post('/schedule/change-requests', authMiddleware, graficController.createChangeRequest);
api.get('/schedule/change-requests', authMiddleware, requireRole('admin'), graficController.getChangeRequests);
api.post('/schedule/process-request', authMiddleware, requireRole('admin'), graficController.processChangeRequest);
api.post('/schedule/rules', authMiddleware, requireRole('admin'), graficController.setScheduleRule);
api.get('/schedule/shift-limits', authMiddleware, graficController.getShiftLimits);
api.put('/schedule/shift-limits', authMiddleware, requireRole('admin'), graficController.putShiftLimits);
api.get('/schedule/free-time', authMiddleware, graficController.getFreeTime);
api.post('/schedule/free-time', authMiddleware, graficController.createFreeTime);
api.delete('/schedule/free-time/:id', authMiddleware, graficController.deleteFreeTime);

// Notifications
api.get('/notifications', authMiddleware, graficController.getNotifications);
api.post('/notifications/read', authMiddleware, graficController.markNotificationsRead);

api.get('/profile', authMiddleware, (req, res) => res.json({ message: 'OK', user: req.user }));

app.use('/api', api);

// Static docs
app.use('/docs', express.static(path.join(__dirname, '../docs')));

app.listen(PORT, () => {
  console.log(`MVP backend listening on http://localhost:${PORT}`);
  console.log(`API base: http://localhost:${PORT}/api`);
  console.log(`Docs: http://localhost:${PORT}/docs`);
});
