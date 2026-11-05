import { drizzle } from 'drizzle-orm/node-postgres';
import Fastify from 'fastify';
import pg from 'pg';
import { registerDeviceRoutes } from './adapters/device/device-routes.js';
import { smtpNotifier, smtpSettingsFrom } from './adapters/email/smtp-notifier.js';
import { registerAuth } from './adapters/http/auth-routes.js';
import { registerLeaveRoutes } from './adapters/http/leave-routes.js';
import { resetPageUrlFrom } from './adapters/http/public-url.js';
import { LiveViewers, registerLiveRoutes } from './adapters/http/live-routes.js';
import { registerReportRecipientRoutes } from './adapters/http/report-recipient-routes.js';
import { registerReportRoutes } from './adapters/http/report-routes.js';
import { registerReviewRoutes } from './adapters/http/review-routes.js';
import { registerStudentRoutes } from './adapters/http/student-routes.js';
import { argon2Passwords, randomSessionTokens } from './adapters/login/passwords.js';
import { PostgresDeviceRegistry } from './adapters/postgres/device-registry.js';
import { PostgresFinalizeRepository } from './adapters/postgres/finalize-repository.js';
import { PostgresLeaveRepository } from './adapters/postgres/leave-repository.js';
import { PostgresOutboxRepository } from './adapters/postgres/outbox-repository.js';
import { PostgresPunchRepository } from './adapters/postgres/punch-repository.js';
import { PostgresRectorRepository } from './adapters/postgres/rector-repository.js';
import { PostgresReportRecipientRepository } from './adapters/postgres/report-recipient-repository.js';
import { PostgresStudentRepository } from './adapters/postgres/student-repository.js';
import { reportCsv } from './adapters/report/report-csv.js';
import { reportFileName } from './adapters/report/report-table.js';
import { reportXlsx } from './adapters/report/report-xlsx.js';
import { ScheduleLoop } from './adapters/scheduler/schedule-loop.js';
import { addStudent } from './use-cases/add-student.js';
import { activateStudent, deactivateStudent } from './use-cases/deactivate-and-activate.js';
import { editStudent } from './use-cases/edit-student.js';
import { getDeviceStatus } from './use-cases/device-status.js';
import { getLiveView } from './use-cases/get-live-view.js';
import { getReport } from './use-cases/get-report.js';
import { finalizeDay, getReview, sendNotifications } from './use-cases/review.js';
import { cancelLeave, editLeave, recordLeave, returnLeave } from './use-cases/leaves.js';
import { recordLeaves, returnLeaves } from './use-cases/leaves-for-many.js';
import { listStudents } from './use-cases/list-students.js';
import { requestPasswordReset, resetPassword } from './use-cases/password-reset.js';
import { changePassword, logIn, logOut, rectorOfSession } from './use-cases/rector-login.js';
import { recordPunches } from './use-cases/record-punches.js';
import type { UploadedPunch } from './use-cases/record-punches.js';
import { sendDueEmails } from './use-cases/send-due-emails.js';
import { queueDailyReport } from './use-cases/daily-report.js';
import { queueMonthlyReport } from './use-cases/monthly-report.js';
import { queueReviewReminder } from './use-cases/review-reminder.js';
import {
  addReportRecipient,
  listReportRecipients,
  removeReportRecipient,
} from './use-cases/report-recipients.js';
import type { Report, ReportRequest } from './use-cases/get-report.js';

const databaseUrl = process.env.DATABASE_URL;
if (databaseUrl === undefined) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env.');
}
const devicePort = Number(process.env.DEVICE_PORT ?? '8081');
const pagePort = Number(process.env.PAGE_PORT ?? '3000');
const secureCookie = process.env.COOKIE_SECURE === 'true';
// Read before anything starts, so a wrong email setting stops the server at once.
const smtp = smtpSettingsFrom(process.env);
const notifier = smtp && smtpNotifier(smtp);
const resetPageUrl = resetPageUrlFrom(process.env);
const ONE_MINUTE_MS = 60 * 1000;

const db = drizzle(new pg.Pool({ connectionString: databaseUrl }));
const punches = new PostgresPunchRepository(db);
const students = new PostgresStudentRepository(db);
const leaves = new PostgresLeaveRepository(db);
const finalized = new PostgresFinalizeRepository(db);
const reportRecipientRepository = new PostgresReportRecipientRepository(db);
const clock = { now: () => Date.now() };
const viewers = new LiveViewers();
const login = {
  rectors: new PostgresRectorRepository(db),
  passwords: argon2Passwords,
  tokens: randomSessionTokens,
  clock,
};

const devices = new PostgresDeviceRegistry(db);
const deviceApp = Fastify({ logger: true });
registerDeviceRoutes(deviceApp, {
  devices,
  clock,
  recordPunches: (deviceSerial: string, uploaded: readonly UploadedPunch[]) =>
    recordPunches(deviceSerial, uploaded, { punches, clock, liveFeed: viewers }),
});

const pageApp = Fastify({ logger: true });
// First, so every page route after it needs a login (FR-13).
await registerAuth(pageApp, {
  logIn: (email, password) => logIn(email, password, login),
  logOut: (token) => logOut(token, login),
  rectorOfSession: (token) => rectorOfSession(token, login),
  changePassword: (rector, token, currentPassword, newPassword) =>
    changePassword(rector, token, currentPassword, newPassword, login),
  // The page never learns the outcome (see auth-routes); only the server log does.
  requestPasswordReset: async (email) => {
    if (notifier === null) {
      pageApp.log.warn('SMTP_HOST is not set, so no password reset link was sent.');
      return;
    }
    const result = await requestPasswordReset(email, { ...login, notifier, resetPageUrl });
    if (result === 'no-public-url') {
      pageApp.log.warn('PUBLIC_URL is not set, so no password reset link was sent.');
    }
  },
  resetPassword: (token, newPassword) => resetPassword(token, newPassword, login),
  secureCookie,
});
registerLiveRoutes(pageApp, {
  viewers,
  getLiveView: () => getLiveView({ punches, students, clock }),
  getDeviceStatus: () => getDeviceStatus({ devices, clock }),
});
registerReportRoutes(pageApp, {
  getReport: (request) => getReport(request, { students, leaves, punches, finalized, clock }),
});
const reviewDeps = { students, leaves, punches, finalized, clock };
registerReviewRoutes(pageApp, {
  getReview: (day) => getReview(day, reviewDeps),
  finalizeDay: (day, doneBy) => finalizeDay(day, doneBy, reviewDeps),
  sendNotifications: (day, excluded, doneBy) =>
    sendNotifications(day, excluded, doneBy, reviewDeps),
});
registerStudentRoutes(pageApp, {
  addStudent: (form) => addStudent(form, { students, clock }),
  listStudents: () => listStudents({ students, leaves, clock }),
  editStudent: (studentId, details) => editStudent(studentId, details, { students }),
  deactivateStudent: (studentId, doneBy) =>
    deactivateStudent(studentId, doneBy, { students, clock }),
  activateStudent: (studentId, doneBy) => activateStudent(studentId, doneBy, { students, clock }),
});

const reportRecipientDeps = { reportRecipients: reportRecipientRepository, clock };
registerReportRecipientRoutes(pageApp, {
  listReportRecipients: () => listReportRecipients(reportRecipientDeps),
  addReportRecipient: (email, doneBy) => addReportRecipient(email, doneBy, reportRecipientDeps),
  removeReportRecipient: (email, doneBy) =>
    removeReportRecipient(email, doneBy, reportRecipientDeps),
});

const leaveDeps = { students, leaves, clock };
registerLeaveRoutes(pageApp, {
  recordLeave: (studentId, form, doneBy) => recordLeave(studentId, form, doneBy, leaveDeps),
  editLeave: (studentId, form, doneBy) => editLeave(studentId, form, doneBy, leaveDeps),
  cancelLeave: (studentId, doneBy) => cancelLeave(studentId, doneBy, leaveDeps),
  returnLeave: (studentId, form, doneBy) => returnLeave(studentId, form, doneBy, leaveDeps),
  recordLeaves: (rows, doneBy) => recordLeaves(rows, doneBy, leaveDeps),
  returnLeaves: (rows, doneBy) => returnLeaves(rows, doneBy, leaveDeps),
});

// 0.0.0.0 so the Device on the same network can reach this machine.
await deviceApp.listen({ port: devicePort, host: '0.0.0.0' });
// 127.0.0.1 only until deployment, where Caddy adds HTTPS in front of it.
await pageApp.listen({ port: pagePort, host: '127.0.0.1' });

if (smtp === null) {
  pageApp.log.warn('SMTP_HOST is not set, so emails stay queued. See .env.example.');
}
if (resetPageUrl === null) {
  pageApp.log.warn('PUBLIC_URL is not set, so a forgotten password cannot be reset by email.');
}
if ((await listReportRecipients(reportRecipientDeps)).length === 0) {
  pageApp.log.warn(
    'No Report Recipients yet, so no Report emails are queued. Add one in Settings.',
  );
}
const outbox = new PostgresOutboxRepository(db);
const emailDeps = notifier && { outbox, notifier, clock };
const reportEmailDeps = {
  students,
  leaves,
  punches,
  finalized,
  clock,
  outbox,
  // The full Report, as the coloured Excel file first, then the plain CSV.
  attachmentsOf: async (request: ReportRequest, report: Report) => [
    { filename: reportFileName(request, 'xlsx', null), content: await reportXlsx(report) },
    { filename: reportFileName(request, 'csv', null), content: Buffer.from(reportCsv(report)) },
  ],
};

// Every minute: queue the scheduled emails that fell due, then send the due emails (FR-9).
new ScheduleLoop({
  clock,
  queue: async (email) => {
    // Read when each email falls due, so a change on the Settings page needs no restart.
    const deps = {
      ...reportEmailDeps,
      reportRecipients: await listReportRecipients(reportRecipientDeps),
    };
    switch (email.kind) {
      case 'Review Reminder':
        await queueReviewReminder(email.day, deps);
        break;
      case 'Daily Report':
        await queueDailyReport(email.day, deps);
        break;
      case 'Monthly Report':
        await queueMonthlyReport(email.month, deps);
        break;
    }
  },
  sendEmails: async () => {
    if (emailDeps === null) return;
    const summary = await sendDueEmails(emailDeps);
    if (summary.sent + summary.notSent > 0) pageApp.log.info(summary, 'Emails sent');
  },
  onError: (error) => {
    pageApp.log.error(error, 'Schedule run failed');
  },
}).start(ONE_MINUTE_MS);
