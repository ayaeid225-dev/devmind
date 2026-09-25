import type { ContributorIdentity } from "./types";

const GENERIC_NOREPLY_EMAILS = new Set([
  "noreply@github.com",
  "actions@github.com",
  "git@localhost",
  "root@localhost",
  "none@none.com",
  "support@github.com",
]);

export function normalizeEmail(email?: string | null): string | null {
  if (!email) return null;
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || !trimmed.includes("@")) {
    return null;
  }
  return trimmed;
}

export function normalizeName(name?: string | null): string {
  if (!name) return "Unknown Contributor";
  const cleaned = name.trim().replace(/\s+/g, " ");
  return cleaned || "Unknown Contributor";
}

export function getContributorIdentityKey(
  name?: string | null,
  email?: string | null
): ContributorIdentity {
  const normEmail = normalizeEmail(email);
  const normName = normalizeName(name);

  // Case 1: Both name and email are empty / unknown
  if (!normEmail && normName === "Unknown Contributor") {
    return {
      identityKey: "unknown:anonymous",
      normalizedName: "Unknown Contributor",
      normalizedEmail: null,
    };
  }

  // Case 2: Email is provided
  if (normEmail) {
    // If it's a generic noreply or bot email, qualify with name to avoid merging unrelated people
    if (GENERIC_NOREPLY_EMAILS.has(normEmail)) {
      return {
        identityKey: `email:${normEmail}:${normName.toLowerCase()}`,
        normalizedName: normName,
        normalizedEmail: normEmail,
      };
    }

    return {
      identityKey: `email:${normEmail}`,
      normalizedName: normName,
      normalizedEmail: normEmail,
    };
  }

  // Case 3: Email is missing or invalid, identify by name
  return {
    identityKey: `name:${normName.toLowerCase()}`,
    normalizedName: normName,
    normalizedEmail: null,
  };
}

export function selectBetterName(
  currentName: string,
  candidateName: string
): string {
  if (currentName === "Unknown Contributor") return candidateName;
  if (candidateName === "Unknown Contributor") return currentName;

  // Prefer names with spaces (likely First Last) over single usernames
  const currentHasSpace = currentName.includes(" ");
  const candidateHasSpace = candidateName.includes(" ");
  if (!currentHasSpace && candidateHasSpace) return candidateName;
  if (currentHasSpace && !candidateHasSpace) return currentName;

  // Prefer names with uppercase letters over all-lowercase
  const currentHasUpper = /[A-Z]/.test(currentName);
  const candidateHasUpper = /[A-Z]/.test(candidateName);
  if (!currentHasUpper && candidateHasUpper) return candidateName;

  // Prefer longer name if both similar
  if (candidateName.length > currentName.length) return candidateName;

  return currentName;
}
