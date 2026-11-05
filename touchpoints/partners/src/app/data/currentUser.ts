export interface CreatedByPerson {
  name: string;
  initials: string;
  photoUrl?: string;
}

/** The signed-in user. Single source of truth for "Created by" / "Updated
 *  by" surfaces — keep names like Ahtisham Ahmad in one place so demo
 *  records the user creates appear under their own name everywhere. */
export const CURRENT_USER: CreatedByPerson = {
  name: "Ahtisham Ahmad",
  initials: "AA",
  photoUrl: "/avatars/ahtisham-ahmad.jpg",
};
