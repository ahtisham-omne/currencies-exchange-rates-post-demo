/**
 * Utility functions for the user-detail edit form:
 * building initial state, equality checks, and change counting.
 */
import type { UserDetail } from "../data/user-detail-data";
import type { UserEditFormData } from "../components/user-detail/edit-types";

/** Build a deep-cloned form data object from a UserDetail record. */
export function buildFormData(user: UserDetail): UserEditFormData {
  return {
    firstName: user.firstName,
    middleName: user.middleName,
    lastName: user.lastName,
    username: user.username,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth,
    nickname: user.nickname,
    pronouns: user.pronouns,
    jobTitle: user.jobTitle,
    timezone: user.timezone,
    primaryEmail: user.email,
    additionalEmails: user.additionalEmails.map((e) =>
      typeof e === "string"
        ? { email: e, type: "Work" as const }
        : { email: (e as any).email ?? "", type: (e as any).type ?? "Work" }
    ),
    phones: user.phones.map((p) => ({ ...p })),
    addresses: user.addresses.map((a) => ({ ...a })),
    emergencyContacts: user.emergencyContacts.map((ec) => ({ ...ec })),
    languages: user.languages.map((l) => ({ ...l })),
    citizenships: user.citizenships.map((c) => ({ ...c })),
  };
}

/** Deep-equal check via JSON serialization. */
export function formDataEquals(
  a: UserEditFormData,
  b: UserEditFormData,
): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Count the number of changed field groups between original and current. */
export function countChanges(
  original: UserEditFormData,
  current: UserEditFormData,
): number {
  let count = 0;

  const simpleKeys: (keyof UserEditFormData)[] = [
    "firstName",
    "middleName",
    "lastName",
    "username",
    "gender",
    "dateOfBirth",
    "nickname",
    "pronouns",
    "jobTitle",
    "timezone",
    "primaryEmail",
  ];

  for (const key of simpleKeys) {
    if (original[key] !== current[key]) count++;
  }

  const arrayKeys: (keyof UserEditFormData)[] = [
    "additionalEmails",
    "phones",
    "addresses",
    "emergencyContacts",
    "languages",
    "citizenships",
  ];

  for (const key of arrayKeys) {
    if (JSON.stringify(original[key]) !== JSON.stringify(current[key])) count++;
  }

  return count;
}

/** Check whether the "overview" tab fields have changes. */
export function hasOverviewChanges(
  formData: UserEditFormData,
  original: UserEditFormData,
): boolean {
  const keys: (keyof UserEditFormData)[] = [
    "firstName",
    "middleName",
    "lastName",
    "username",
    "gender",
    "dateOfBirth",
    "nickname",
    "pronouns",
    "jobTitle",
    "timezone",
  ];
  return (
    keys.some((k) => formData[k] !== original[k]) ||
    JSON.stringify(formData.languages) !==
      JSON.stringify(original.languages) ||
    JSON.stringify(formData.citizenships) !==
      JSON.stringify(original.citizenships)
  );
}

/** Check whether the "contact" tab fields have changes. */
export function hasContactChanges(
  formData: UserEditFormData,
  original: UserEditFormData,
): boolean {
  return (
    formData.primaryEmail !== original.primaryEmail ||
    JSON.stringify(formData.additionalEmails) !==
      JSON.stringify(original.additionalEmails) ||
    JSON.stringify(formData.phones) !== JSON.stringify(original.phones) ||
    JSON.stringify(formData.addresses) !==
      JSON.stringify(original.addresses) ||
    JSON.stringify(formData.emergencyContacts) !==
      JSON.stringify(original.emergencyContacts)
  );
}
