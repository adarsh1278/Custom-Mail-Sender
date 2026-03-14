require("dotenv").config();
const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const { randomUUID } = require("crypto");
const { generateEmailBody, generateSubject } = require("./emailTemplate");
const {
  initJobStore,
  insertJob,
  updateJob,
  getJob,
  listJobs,
  listRunnableJobs,
  getStoreMode,
} = require("./jobStore");

const app = express();
const PORT = Number(process.env.BACKEND_PORT || 4000);
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const MAX_FIELD_LENGTH = 200;
const activeTimers = new Map();

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

function sanitizeField(value, maxLen = MAX_FIELD_LENGTH) {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, maxLen);
  return cleaned || undefined;
}

function sanitizeRecipient(input) {
  const email = sanitizeField(input?.email, 320);
  if (!email || !EMAIL_REGEX.test(email)) {
    throw new Error("A valid email address is required.");
  }

  return {
    name: sanitizeField(input?.name),
    email,
    org: sanitizeField(input?.org),
    role: sanitizeField(input?.role),
  };
}

function parseScheduleTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error("A valid schedule time is required.");
  }
  return date;
}

function createTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

async function sendEmail(recipient) {
  const transporter = createTransporter();
  const subject = generateSubject({ role: recipient.role });
  const text = generateEmailBody(recipient);

  await transporter.sendMail({
    from: `"Adarsh Tiwari" <${process.env.EMAIL_USER}>`,
    to: recipient.email,
    subject,
    text,
  });

  return { email: recipient.email, subject };
}

function clearJobTimer(jobId) {
  const timer = activeTimers.get(jobId);
  if (timer) {
    clearTimeout(timer);
    activeTimers.delete(jobId);
  }
}

function getRunTime(job) {
  const value = job.nextRunAt || job.scheduledAt || job.createdAt;
  return new Date(value);
}

function serializeJob(job) {
  return {
    id: job.id,
    type: job.type,
    status: job.status,
    scheduledAt: job.scheduledAt,
    nextRunAt: job.nextRunAt,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    intervalSeconds: job.intervalSeconds,
    total: job.total,
    processed: job.processed,
    recipient: job.recipient,
    results: job.results,
    error: job.error,
  };
}

async function executeSingleJob(jobId) {
  clearJobTimer(jobId);
  const job = await getJob(jobId);
  if (!job || ["completed", "failed"].includes(job.status)) {
    return;
  }

  await updateJob(jobId, {
    status: "running",
    nextRunAt: null,
    startedAt: new Date().toISOString(),
    error: null,
  });

  try {
    await sendEmail(job.recipient);
    await updateJob(jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    await updateJob(jobId, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function executeBulkJob(jobId) {
  clearJobTimer(jobId);
  const job = await getJob(jobId);
  if (!job || ["completed", "completed_with_errors", "failed"].includes(job.status)) {
    return;
  }

  const processed = Number(job.processed || 0);
  const total = Number(job.total || 0);
  if (processed >= total) {
    await updateJob(jobId, {
      status: (job.results || []).some((item) => item.status === "failed") ? "completed_with_errors" : "completed",
      completedAt: new Date().toISOString(),
      nextRunAt: null,
    });
    return;
  }

  const recipient = job.recipients[processed];
  const results = Array.isArray(job.results) ? [...job.results] : [];

  await updateJob(jobId, {
    status: "running",
    nextRunAt: null,
    startedAt: job.startedAt || new Date().toISOString(),
    error: null,
  });

  try {
    await sendEmail(recipient);
    results.push({ email: recipient.email, status: "sent" });
  } catch (error) {
    results.push({
      email: recipient.email,
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  const nextProcessed = processed + 1;
  if (nextProcessed >= total) {
    await updateJob(jobId, {
      processed: nextProcessed,
      results,
      status: results.some((item) => item.status === "failed") ? "completed_with_errors" : "completed",
      completedAt: new Date().toISOString(),
      nextRunAt: null,
    });
    return;
  }

  const nextRunAt = new Date(Date.now() + Number(job.intervalSeconds || 1) * 1000).toISOString();
  await updateJob(jobId, {
    processed: nextProcessed,
    results,
    status: "scheduled",
    nextRunAt,
  });

  scheduleJob(jobId, new Date(nextRunAt), "bulk");
}

function scheduleJob(jobId, runAt, type) {
  clearJobTimer(jobId);
  const delay = Math.max(0, runAt.getTime() - Date.now());
  const timer = setTimeout(() => {
    if (type === "single") {
      void executeSingleJob(jobId);
      return;
    }

    void executeBulkJob(jobId);
  }, delay);

  activeTimers.set(jobId, timer);
}

async function restorePendingJobs() {
  const jobs = await listRunnableJobs();
  for (const job of jobs) {
    if (job.type === "single") {
      scheduleJob(job.id, getRunTime(job), "single");
      continue;
    }

    if (job.type === "bulk") {
      scheduleJob(job.id, getRunTime(job), "bulk");
    }
  }
}

async function createImmediateSingleJob(recipient) {
  const now = new Date().toISOString();
  const job = {
    id: randomUUID(),
    type: "single",
    status: "running",
    scheduledAt: now,
    nextRunAt: null,
    createdAt: now,
    recipient,
  };

  await insertJob(job);
  try {
    await sendEmail(recipient);
    return updateJob(job.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      error: null,
    });
  } catch (error) {
    return updateJob(job.id, {
      status: "failed",
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}

async function createScheduledSingleJob(recipient, scheduledAt) {
  const job = {
    id: randomUUID(),
    type: "single",
    status: "scheduled",
    scheduledAt: scheduledAt.toISOString(),
    nextRunAt: scheduledAt.toISOString(),
    createdAt: new Date().toISOString(),
    recipient,
  };

  await insertJob(job);
  scheduleJob(job.id, scheduledAt, "single");
  return job;
}

async function createScheduledBulkJob(recipients, startAt, intervalSeconds) {
  const job = {
    id: randomUUID(),
    type: "bulk",
    status: "scheduled",
    scheduledAt: startAt.toISOString(),
    nextRunAt: startAt.toISOString(),
    createdAt: new Date().toISOString(),
    intervalSeconds: Math.max(1, Number(intervalSeconds)),
    total: recipients.length,
    processed: 0,
    recipients,
    results: [],
  };

  await insertJob(job);
  scheduleJob(job.id, startAt, "bulk");
  return job;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, storeMode: getStoreMode() });
});

app.get("/api/keep-alive", (_req, res) => {
  res.json({
    ok: true,
    message: "Service is awake",
    storeMode: getStoreMode(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/jobs", async (_req, res) => {
  const jobs = await listJobs();
  res.json({ jobs: jobs.map(serializeJob), storeMode: getStoreMode() });
});

app.post("/api/send-now", async (req, res) => {
  try {
    const recipient = sanitizeRecipient(req.body || {});
    const job = await createImmediateSingleJob(recipient);
    if (job.status === "failed") {
      res.status(500).json({ error: job.error || "Failed to send email.", job: serializeJob(job) });
      return;
    }

    res.json({
      success: true,
      message: `Email sent to ${recipient.email}`,
      subject: generateSubject({ role: recipient.role }),
      job: serializeJob(job),
    });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to send email." });
  }
});

app.post("/api/schedule-single", async (req, res) => {
  try {
    const recipient = sanitizeRecipient(req.body || {});
    const scheduledAt = parseScheduleTime(req.body?.scheduledAt);
    const job = await createScheduledSingleJob(recipient, scheduledAt);
    res.json({ success: true, job: serializeJob(job) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to schedule email." });
  }
});

app.post("/api/schedule-bulk", async (req, res) => {
  try {
    const recipients = Array.isArray(req.body?.recipients)
      ? req.body.recipients.map((recipient) => sanitizeRecipient(recipient))
      : [];
    if (!recipients.length) {
      throw new Error("At least one valid recipient is required.");
    }

    const startAt = parseScheduleTime(req.body?.startAt);
    const intervalSeconds = Number(req.body?.intervalSeconds);
    if (!Number.isFinite(intervalSeconds) || intervalSeconds < 1) {
      throw new Error("Interval must be at least 1 second.");
    }

    const job = await createScheduledBulkJob(recipients, startAt, intervalSeconds);
    res.json({ success: true, job: serializeJob(job) });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : "Failed to schedule bulk email." });
  }
});

async function start() {
  await initJobStore();
  await restorePendingJobs();
  app.listen(PORT, () => {
    console.log(`Scheduler backend running on http://localhost:${PORT} using ${getStoreMode()} store`);
  });
}

start().catch((error) => {
  console.error("Failed to start scheduler backend", error);
  process.exit(1);
});
