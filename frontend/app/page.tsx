"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { generateEmailBody, generateSubject } from "@/lib/emailTemplate";

interface Recipient {
  name?: string;
  email: string;
  org?: string;
  role?: string;
}

interface SendResult {
  email: string;
  status: "sent" | "failed";
  error?: string;
}

interface Job {
  id: string;
  type: "single" | "bulk";
  status: string;
  scheduledAt?: string;
  createdAt: string;
  completedAt?: string;
  intervalSeconds?: number;
  total?: number;
  processed?: number;
  recipient?: Recipient;
  results?: SendResult[];
  error?: string;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

function toLocalDateTimeValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function Home() {
  const [tab, setTab] = useState<"single" | "bulk">("single");
  const [form, setForm] = useState({ name: "", email: "", org: "", role: "" });
  const [singleScheduleAt, setSingleScheduleAt] = useState("");
  const [bulkScheduleAt, setBulkScheduleAt] = useState("");
  const [bulkIntervalSeconds, setBulkIntervalSeconds] = useState("60");
  const [singleLoading, setSingleLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [singleAlert, setSingleAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [bulkAlert, setBulkAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSingleScheduleAt(toLocalDateTimeValue(new Date(Date.now() + 10 * 60 * 1000)));
    setBulkScheduleAt(toLocalDateTimeValue(new Date(Date.now() + 15 * 60 * 1000)));
  }, []);

  const previewBody = generateEmailBody({
    name: form.name || undefined,
    org: form.org || undefined,
    role: form.role || undefined,
  });

  const previewSubject = generateSubject({ role: form.role || undefined });

  const sentCount = useMemo(
    () => jobs.flatMap((job) => job.results || []).filter((result) => result.status === "sent").length,
    [jobs]
  );

  const failedCount = useMemo(
    () => jobs.flatMap((job) => job.results || []).filter((result) => result.status === "failed").length,
    [jobs]
  );

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/jobs`);
      const data = await response.json();
      if (response.ok) {
        setJobs(data.jobs || []);
      }
    } catch {
      // Keep latest client state if the backend is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const parseCSV = useCallback((file: File) => {
    Papa.parse<Recipient>(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (header) => header.trim().toLowerCase(),
      transform: (value) => value.trim(),
      complete: (result) => {
        setRecipients(result.data.filter((recipient) => !!recipient.email));
        setBulkAlert(null);
      },
    });
  }, []);

  const handleSingleNow = async () => {
    if (!form.email) {
      return;
    }

    setSingleLoading(true);
    setSingleAlert(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/send-now`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          email: form.email,
          org: form.org || undefined,
          role: form.role || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to send email.");
      }

      setSingleAlert({ type: "success", msg: `Email sent to ${form.email}` });
      setForm({ name: "", email: "", org: "", role: "" });
      setShowPreview(false);
      await fetchJobs();
    } catch (error) {
      setSingleAlert({
        type: "error",
        msg: error instanceof Error ? error.message : "Failed to send email.",
      });
    } finally {
      setSingleLoading(false);
    }
  };

  const handleSingleSchedule = async () => {
    if (!form.email) {
      return;
    }

    setSingleLoading(true);
    setSingleAlert(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule-single`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          email: form.email,
          org: form.org || undefined,
          role: form.role || undefined,
          scheduledAt: singleScheduleAt ? new Date(singleScheduleAt).toISOString() : new Date().toISOString(),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule email.");
      }

      setSingleAlert({
        type: "success",
        msg: singleScheduleAt
          ? `Email scheduled for ${new Date(singleScheduleAt).toLocaleString()}`
          : "Email scheduled to run immediately.",
      });
      setForm({ name: "", email: "", org: "", role: "" });
      setShowPreview(false);
      await fetchJobs();
    } catch (error) {
      setSingleAlert({
        type: "error",
        msg: error instanceof Error ? error.message : "Failed to schedule email.",
      });
    } finally {
      setSingleLoading(false);
    }
  };

  const handleBulkSchedule = async () => {
    if (!recipients.length) {
      return;
    }

    setBulkLoading(true);
    setBulkAlert(null);
    try {
      const response = await fetch(`${API_BASE_URL}/api/schedule-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          startAt: bulkScheduleAt ? new Date(bulkScheduleAt).toISOString() : new Date().toISOString(),
          intervalSeconds: Number(bulkIntervalSeconds),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to schedule bulk email.");
      }

      setBulkAlert({
        type: "success",
        msg: bulkScheduleAt
          ? `Bulk campaign scheduled for ${new Date(bulkScheduleAt).toLocaleString()} with ${bulkIntervalSeconds}s interval.`
          : `Bulk campaign scheduled to start now with ${bulkIntervalSeconds}s interval.`,
      });
      await fetchJobs();
    } catch (error) {
      setBulkAlert({
        type: "error",
        msg: error instanceof Error ? error.message : "Failed to schedule bulk email.",
      });
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadSample = () => {
    const csv = [
      "name,email,org,role",
      "Sneha Maam,sneha@example.com,MyCGL,SDE Intern",
      "Rahul,rahul@startup.com,StartupX,",
      "Hiring Team,hr@company.com,,",
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "sample_recipients.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const inputCls =
    "w-full bg-white/10 border border-white/20 rounded-lg px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent transition-colors";
  const labelCls = "block text-slate-300 text-sm mb-1.5";
  const alertCls = (type: "success" | "error") =>
    type === "success"
      ? "bg-green-500/20 text-green-300 border border-green-500/30"
      : "bg-red-500/20 text-red-300 border border-red-500/30";

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-950 via-cyan-950 to-emerald-950">
      <header className="border-b border-white/10 bg-white/5 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Email Outreach Tool</h1>
            <p className="text-slate-400 text-xs mt-0.5">Adarsh Tiwari · Backend scheduler + recruiter outreach</p>
          </div>
          <div className="hidden sm:flex gap-2 text-xs flex-wrap justify-end">
            {[
              "600+ LeetCode",
              "Knight @ LeetCode",
              "Opernova LLP",
              "Mouse and Cheese",
              "Agile Growth Tech",
            ].map((tag) => (
              <span
                key={tag}
                className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        <section className="bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-slate-300">
          <div>
            Backend scheduler URL: <span className="text-cyan-300">{API_BASE_URL}</span>
          </div>
          <div className="text-slate-400 mt-1">
            Keep the backend running. Scheduled jobs are managed on the Node backend, not in the browser.
          </div>
        </section>

        <div className="flex gap-2">
          {(["single", "bulk"] as const).map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`px-5 py-2.5 rounded-xl font-medium text-sm transition-all ${
                tab === item
                  ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/30"
                  : "bg-white/10 text-slate-300 hover:bg-white/15"
              }`}
            >
              {item === "single" ? "Single Email" : "Bulk CSV"}
            </button>
          ))}
        </div>

        {tab === "single" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <h2 className="text-white font-semibold text-lg mb-5">Compose or Schedule Single Email</h2>

              <div className="space-y-4">
                <div>
                  <label className={labelCls}>Name</label>
                  <input
                    type="text"
                    placeholder="Sneha Ma'am"
                    value={form.name}
                    onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Email</label>
                  <input
                    type="email"
                    placeholder="recruiter@company.com"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Organization</label>
                  <input
                    type="text"
                    placeholder="MyCGL, StartupX"
                    value={form.org}
                    onChange={(event) => setForm((current) => ({ ...current, org: event.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Position / Role (optional)</label>
                  <input
                    type="text"
                    placeholder="SDE Intern, Frontend Developer"
                    value={form.role}
                    onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Schedule Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={singleScheduleAt}
                    onChange={(event) => setSingleScheduleAt(event.target.value)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-slate-400">Leave empty to schedule immediately.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
                <button
                  onClick={() => setShowPreview((current) => !current)}
                  className="px-4 py-2.5 bg-white/10 text-slate-200 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors border border-white/10"
                >
                  {showPreview ? "Hide Preview" : "Preview"}
                </button>
                <button
                  onClick={handleSingleNow}
                  disabled={!form.email || singleLoading}
                  className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {singleLoading ? "Working..." : "Send Now"}
                </button>
                <button
                  onClick={handleSingleSchedule}
                  disabled={!form.email || singleLoading}
                  className="px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {singleLoading ? "Working..." : "Schedule"}
                </button>
              </div>

              {singleAlert && <div className={`mt-4 p-3 rounded-lg text-sm ${alertCls(singleAlert.type)}`}>{singleAlert.msg}</div>}
            </div>

            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 flex flex-col">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-white font-semibold">Email Preview</h3>
                <span className="text-xs text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded-full">
                  Dynamic subject
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                <span className="font-medium text-slate-300">Subject: </span>
                {previewSubject}
              </p>
              <pre className="flex-1 bg-slate-900/60 rounded-xl p-4 text-slate-300 text-xs whitespace-pre-wrap font-mono leading-relaxed overflow-y-auto max-h-[32rem] border border-white/5">
                {showPreview ? previewBody : "Click Preview to inspect the final message."}
              </pre>
            </div>
          </div>
        )}

        {tab === "bulk" && (
          <div className="space-y-6">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files[0];
                if (file?.name.endsWith(".csv")) {
                  parseCSV(file);
                }
              }}
              className={`rounded-2xl p-10 border-2 border-dashed text-center cursor-pointer transition-all ${
                dragOver
                  ? "border-cyan-400 bg-cyan-500/10"
                  : "border-white/20 bg-white/5 hover:border-cyan-500/50 hover:bg-white/[0.08]"
              }`}
            >
              <div className="text-5xl mb-3 select-none">CSV</div>
              <p className="text-white font-medium text-lg">Drop your CSV file here</p>
              <p className="text-slate-400 text-sm mt-1 mb-4">or click to browse</p>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  downloadSample();
                }}
                className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                Download sample CSV
              </button>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.[0]) {
                    parseCSV(event.target.files[0]);
                  }
                }}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 p-6 space-y-4">
                <h3 className="text-white font-semibold">Bulk Schedule Settings</h3>
                <div>
                  <label className={labelCls}>Start Time (optional)</label>
                  <input
                    type="datetime-local"
                    value={bulkScheduleAt}
                    onChange={(event) => setBulkScheduleAt(event.target.value)}
                    className={inputCls}
                  />
                  <p className="mt-1 text-xs text-slate-400">Leave empty to start bulk sending now.</p>
                </div>
                <div>
                  <label className={labelCls}>Interval Between Emails (seconds)</label>
                  <input
                    type="number"
                    min="1"
                    value={bulkIntervalSeconds}
                    onChange={(event) => setBulkIntervalSeconds(event.target.value)}
                    className={inputCls}
                  />
                </div>
                <div className="text-sm text-slate-400">
                  The backend sends one email at a time and waits the chosen interval before the next send.
                </div>
                <button
                  onClick={handleBulkSchedule}
                  disabled={!recipients.length || bulkLoading}
                  className="w-full px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm font-medium hover:bg-cyan-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {bulkLoading ? "Scheduling..." : `Schedule Bulk Campaign (${recipients.length})`}
                </button>
                {bulkAlert && <div className={`p-3 rounded-lg text-sm ${alertCls(bulkAlert.type)}`}>{bulkAlert.msg}</div>}
              </div>

              <div className="bg-slate-800/50 rounded-2xl px-5 py-4 border border-white/10 text-sm text-slate-300">
                <div className="font-semibold text-white mb-2">CSV format</div>
                <div className="font-mono text-xs text-slate-400">name,email,org,role</div>
                <div className="font-mono text-xs text-slate-400">Sneha Maam,sneha@example.com,MyCGL,SDE Intern</div>
                <div className="font-mono text-xs text-slate-400">Rahul,rahul@startup.com,StartupX,</div>
                <div className="font-mono text-xs text-slate-400">Hiring Team,hr@company.com,,</div>
              </div>
            </div>

            {recipients.length > 0 && (
              <div className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
                  <h3 className="text-white font-semibold">{recipients.length} recipients loaded</h3>
                  <button
                    onClick={() => setRecipients([])}
                    className="text-slate-400 hover:text-red-400 text-sm transition-colors"
                  >
                    Clear List
                  </button>
                </div>
                <div className="overflow-x-auto max-h-80 overflow-y-auto">
                  <table className="w-full text-sm min-w-[600px]">
                    <thead className="bg-white/5 sticky top-0">
                      <tr>
                        {["#", "Name", "Email", "Organization", "Role"].map((header) => (
                          <th
                            key={header}
                            className="text-left text-slate-400 font-medium px-4 py-3 text-xs uppercase tracking-wide whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recipients.map((recipient, index) => (
                        <tr key={`${recipient.email}-${index}`} className="border-t border-white/5 hover:bg-white/[0.04] transition-colors">
                          <td className="px-4 py-3 text-slate-500 text-xs">{index + 1}</td>
                          <td className="px-4 py-3 text-slate-300">{recipient.name || "-"}</td>
                          <td className="px-4 py-3 text-slate-300">{recipient.email}</td>
                          <td className="px-4 py-3 text-slate-300">{recipient.org || "-"}</td>
                          <td className="px-4 py-3 text-slate-300">{recipient.role || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        <section className="bg-white/10 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-white font-semibold">Scheduler Jobs</h3>
              <p className="text-slate-400 text-sm">Sent: {sentCount} · Failed: {failedCount}</p>
            </div>
            <button
              onClick={() => void fetchJobs()}
              className="px-4 py-2 bg-white/10 text-slate-200 rounded-lg text-sm hover:bg-white/15 transition-colors"
            >
              Refresh
            </button>
          </div>

          <div className="divide-y divide-white/5">
            {jobs.length === 0 && <div className="px-6 py-8 text-slate-400 text-sm">No jobs yet. Schedule or send an email to populate this list.</div>}
            {jobs.map((job) => (
              <div key={job.id} className="px-6 py-4 flex flex-col gap-2">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                  <div className="text-sm text-white">{job.type === "single" ? "Single job" : "Bulk job"} · {job.status}</div>
                  <div className="text-xs text-slate-400">Scheduled: {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString() : "n/a"}</div>
                </div>
                <div className="text-xs text-slate-400">
                  Job ID: {job.id}
                  {job.type === "bulk" && typeof job.processed === "number" && typeof job.total === "number"
                    ? ` · Progress: ${job.processed}/${job.total} · Interval: ${job.intervalSeconds}s`
                    : ""}
                </div>
                {job.recipient && <div className="text-sm text-slate-300">Recipient: {job.recipient.email}</div>}
                {job.results && job.results.length > 0 && (
                  <div className="text-sm text-slate-300">
                    Latest results: {job.results.slice(-3).map((result) => `${result.email} (${result.status})`).join(", ")}
                  </div>
                )}
                {job.error && <div className="text-sm text-red-400">Error: {job.error}</div>}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
