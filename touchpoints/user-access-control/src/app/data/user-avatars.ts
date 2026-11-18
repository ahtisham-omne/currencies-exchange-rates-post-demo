import avatar1 from "@/assets/avatars/avatar-1.jpg";
import avatar2 from "@/assets/avatars/avatar-2.jpg";
import avatar3 from "@/assets/avatars/avatar-3.jpg";
import avatar4 from "@/assets/avatars/avatar-4.jpg";
import avatar5 from "@/assets/avatars/avatar-5.jpg";
import avatar6 from "@/assets/avatars/avatar-6.jpg";
import avatar7 from "@/assets/avatars/avatar-7.jpg";
import avatar8 from "@/assets/avatars/avatar-8.jpg";
import { WORKFORCE_AVATARS } from "./workforce-users";

/** Map user IDs to avatar imports. Users not in this map use initials. */
export const USER_AVATAR_MAP: Record<number, string> = {
  1: avatar1,   // Ahtisham Ahmad
  2: avatar2,   // Faizan Khan
  4: avatar3,   // Eli Rosenbloom
  9: avatar4,   // Nataly Carrillo
  5: avatar5,   // Nophil Anwer
  10: avatar6,  // Kassandra Gillespie
  14: avatar7,  // Heather Rowland
  8: avatar8,   // Aden Erickson
  60: "https://randomuser.me/api/portraits/women/44.jpg", // Fatima Masood
  /* The plant workforce's stock portraits (workforce-users.ts). */
  ...WORKFORCE_AVATARS,
};
