/**
 * Legacy words this import understands but does not store.
 *
 * A file that says "Medium" means Standard, and one that says "Cleared" means
 * Released. The value is not in the module's list, so the cell is
 * flagged, but the row is perfectly importable: it lands as the mapped value.
 * That makes it a warning, never an error, which is the rule this whole flow
 * follows. The materializer reads the same table, so what the warning promises
 * is what actually gets stored.
 */
export const SET_ALIASES: Record<string, Record<string, string>> = {
  orderStatus: {
    "cleared": "Released",
    "release": "Released",
    "open": "Draft",
    "new": "Draft",
    "in review": "Pending Review",
    "awaiting review": "Pending Review",
  },
  priority: {
    "medium": "Standard",
    "normal": "Standard",
    "critical": "High",
    "urgent": "High",
    "none": "Low",
  },
};
