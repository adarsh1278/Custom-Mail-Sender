import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { generateEmailBody, generateSubject } from "@/lib/emailTemplate";

const EMAIL_REGEX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const MAX_FIELD_LENGTH = 200;

function sanitizeField(value: unknown, maxLen = MAX_FIELD_LENGTH): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const cleaned = value.replace(/[\x00-\x1F\x7F]/g, "").trim().slice(0, maxLen);
  return cleaned || undefined;
}

function getTransporter(): nodemailer.Transporter {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawEmail = sanitizeField(body?.email, 320);

    if (!rawEmail || !EMAIL_REGEX.test(rawEmail)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const name = sanitizeField(body?.name);
    const org = sanitizeField(body?.org);
    const role = sanitizeField(body?.role);

    const subject = generateSubject({ role });
    const text = generateEmailBody({ name, org, role });

    const transporter = getTransporter();
    await transporter.sendMail({
      from: `"Adarsh Tiwari" <${process.env.EMAIL_USER}>`,
      to: rawEmail,
      subject,
      text,
    });

    return NextResponse.json({ success: true, message: `Email sent to ${rawEmail}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to send email." },
      { status: 500 }
    );
  }
}
