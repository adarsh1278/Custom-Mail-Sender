"use client";

import { useState } from "react";
import { generateEmailBody, generateSubject } from "@/lib/emailTemplate";

export default function Home() {
  const [form, setForm] = useState({ name: "", email: "", org: "", role: "" });
  const [showPreview, setShowPreview] = useState(false);
  const [sending, setSending] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const previewBody = generateEmailBody({
    name: form.name || undefined,
    org: form.org || undefined,
    role: form.role || undefined,
  });

  const previewSubject = generateSubject({ role: form.role || undefined });

  const handleSendNow = async () => {
    if (!form.email) {
      setAlert({ type: "error", msg: "Email is required." });
      return;
    }

    setSending(true);
    setAlert(null);

    try {
      const response = await fetch("/api/send-single", {
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

      setAlert({ type: "success", msg: `Email sent to ${form.email}` });
      setForm({ name: "", email: "", org: "", role: "" });
      setShowPreview(false);
    } catch (error) {
      setAlert({
        type: "error",
        msg: error instanceof Error ? error.message : "Failed to send email.",
      });
    } finally {
      setSending(false);
    }
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
            <p className="text-slate-400 text-xs mt-0.5">Adarsh Tiwari - Next.js mail API</p>
          </div>
          <div className="hidden sm:flex gap-2 text-xs flex-wrap justify-end">
            {["600+ LeetCode", "Knight @ LeetCode", "Opernova LLP", "Mouse and Cheese", "Agile Growth Tech"].map(
              (tag) => (
                <span
                  key={tag}
                  className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
            <h2 className="text-white font-semibold text-lg mb-5">Compose and Send Email</h2>

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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
              <button
                onClick={() => setShowPreview((current) => !current)}
                className="px-4 py-2.5 bg-white/10 text-slate-200 rounded-lg text-sm font-medium hover:bg-white/15 transition-colors border border-white/10"
              >
                {showPreview ? "Hide Preview" : "Preview"}
              </button>
              <button
                onClick={handleSendNow}
                disabled={!form.email || sending}
                className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {sending ? "Sending..." : "Send Now"}
              </button>
            </div>

            {alert && <div className={`mt-4 p-3 rounded-lg text-sm ${alertCls(alert.type)}`}>{alert.msg}</div>}
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
      </div>
    </main>
  );
}