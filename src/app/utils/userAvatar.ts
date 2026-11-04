import ahtishamPhoto from '@/assets/ahtisham-ahmad.jpg';
import mahreenPhoto from '@/assets/mahreen-ghafoor.jpg';
import eliPhoto from '@/assets/eli-rosenbloom.jpg';
import irtazaPhoto from '@/assets/irtaza-abid.png';
import ridaPhoto from '@/assets/rida-iftikhar.jpg';

// Real headshots for known people (feedback 7/22/26): wherever a name
// with a photo here is rendered as an avatar, the photo is used instead
// of the initials chip. Keyed by lowercased full name, listed in the
// PINNED_CREATORS priority order (Ahtisham, Eli, Mahreen, Irtaza, Rida).
const USER_PHOTOS: Record<string, string> = {
  'ahtisham ahmad': ahtishamPhoto,
  // Eli Rosenbloom, CEO of Omne (8/7/26).
  'eli rosenbloom': eliPhoto,
  'mahreen ghafoor': mahreenPhoto,
  // Irtaza Abid (8/12/26).
  'irtaza abid': irtazaPhoto,
  // Rida Iftikhar (8/12/26).
  'rida iftikhar': ridaPhoto,
};

/** The headshot URL for a person by name, or undefined to fall back to
 *  initials / the deterministic portrait. */
export function userPhotoFor(name?: string | null): string | undefined {
  if (!name) return undefined;
  return USER_PHOTOS[name.trim().toLowerCase()];
}
