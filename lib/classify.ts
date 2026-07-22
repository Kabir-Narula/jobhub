import type { RoleCategory, Seniority } from "@prisma/client";

const NEW_GRAD_RE =
  /\b(new[- ]?grad(uate)?|entry[- ]?level|junior|jr\.?|associate|early[- ]?career|university grad|campus|graduate program|rotational)\b/i;
const SENIOR_RE =
  /\b(senior|sr\.?|staff|principal|lead|manager|director|head of|distinguished|architect)\b/i;

export function classifySeniority(title: string, description = ""): Seniority {
  if (/\b(intern(ship)?s?|co-?op)\b/i.test(title)) return "NEW_GRAD"; // interns are excluded upstream; keep as fallback
  if (NEW_GRAD_RE.test(title)) return "NEW_GRAD";
  if (SENIOR_RE.test(title)) return "SENIOR";
  const head = description.slice(0, 400);
  if (NEW_GRAD_RE.test(head) && !SENIOR_RE.test(title)) return "NEW_GRAD";
  return "MID";
}

// Aligned to the user's background: software development degree with ML/HPC/
// systems/cloud coursework, plus tech-consulting interest.
const CONSULTING_RE =
  /\b(consultant|consulting|implementation (engineer|consultant|specialist|manager)|solutions? (analyst|engineer|consultant|architect)|business (systems? )?analyst|technical account manager|professional services|pre-?sales|customer (engineer|success engineer)|deployment specialist|onboarding engineer|it consultant)\b/i;
const DATA_ML_RE =
  /\b(data (engineer|scientist|analyst|engineering|science|platform)|machine learning|ml (engineer|ops)|ai (engineer|developer)|computer vision|nlp|analytics engineer|business intelligence|bi (developer|analyst)|data ops|mlops|applied scientist)\b/i;
const INFRA_RE =
  /\b(devops|sre|site reliability|platform (engineer|engineering)|infrastructure (engineer|engineering)|cloud (engineer|architect|ops)|systems (engineer|administrator)|network (engineer|administrator)|database administrator|dba|release engineer|build engineer|it (support|specialist|technician)|help ?desk|systems analyst)\b/i;
const SWE_RE =
  /\b(software|full[- ]?stack|front[- ]?end|back[- ]?end|web|mobile|android|ios|qa|quality assurance|test|security|embedded|firmware|game|graphics)\b.{0,40}\b(engineer|developer|scientist|architect)\b|\b(software developer|software engineer|swe|sde|programmer|developer|full stack developer)\b/i;

export function classifyCategory(title: string): RoleCategory {
  if (CONSULTING_RE.test(title)) return "CONSULTING_TECH";
  if (DATA_ML_RE.test(title)) return "DATA_ML";
  if (INFRA_RE.test(title)) return "INFRA";
  if (SWE_RE.test(title)) return "SWE";
  return "OTHER";
}
