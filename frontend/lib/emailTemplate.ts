export interface RecipientData {
  name?: string;
  email: string;
  org?: string;
  role?: string;
}

export function generateEmailBody({
  name,
  org,
  role,
}: Omit<RecipientData, "email">): string {
  const greeting = name ? `Dear ${name},` : "Dear Hiring Team,";

  const orgLine = org
    ? `I recently came across opportunities at ${org} and would love to explore potential openings.`
    : `I would love to explore any relevant software engineering opportunities with your team.`;

  const roleLine = role
    ? `I am particularly interested in the ${role} role.\n`
    : "I would be grateful if you could let me know whether there are openings for SDE, Full Stack, Frontend, or Backend roles.\n";

  return `${greeting}

I hope you are doing well.

My name is Adarsh Tiwari. I am a Computer Science student from KIET Group of Institutions with strong experience in full-stack development and data structures. I have experience building scalable applications using Node.js, React, Next.js, MongoDB, WebSockets, and Redis.

I have solved over 600 problems on LeetCode and GeeksforGeeks, and I currently hold the Knight badge on LeetCode, which has strengthened my problem-solving and algorithmic skills.

I have worked as an intern at Opernova LLP, Mouse and Cheese Design Studio, and Agile Growth Tech, where I contributed to modern web applications, product development, and real-world engineering workflows.

${orgLine}
${roleLine}
Some of my work and projects can be viewed at my portfolio:
Portfolio: https://adarsh1278.vercel.app/

I would really appreciate the opportunity to connect or be considered for any relevant roles or internships.

Thank you for your time and consideration.

Best regards,
Adarsh Tiwari
Phone: 7986543966`;
}

export function generateSubject({ role }: { role?: string }): string {
  if (role) {
    return `Application for ${role} - Adarsh Tiwari`;
  }
  return "Application for SDE / Full Stack / Frontend / Backend Roles - Adarsh Tiwari";
}
