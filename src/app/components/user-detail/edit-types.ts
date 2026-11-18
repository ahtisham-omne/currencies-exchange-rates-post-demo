import type {
  PhoneEntry,
  AddressEntry,
  EmergencyContact,
  LanguageEntry,
  CitizenshipEntry,
} from "../../types/shared";
import type { AdditionalEmailEntry } from "../create-user/types";

export interface UserEditFormData {
  /* ── Personal ── */
  firstName: string;
  middleName: string;
  lastName: string;
  username: string;
  gender: string;
  dateOfBirth: string;
  nickname: string;
  pronouns: string;

  /* ── Work ── */
  jobTitle: string;
  timezone: string;

  /* ── Contact ── */
  primaryEmail: string;
  additionalEmails: AdditionalEmailEntry[];
  phones: PhoneEntry[];
  addresses: AddressEntry[];
  emergencyContacts: EmergencyContact[];

  /* ── Other ── */
  languages: LanguageEntry[];
  citizenships: CitizenshipEntry[];
}
