/* The two value types values.ts reads from radiant-core-fusion
 * src/app/data/categories.ts, restated here so the copied Categories data
 * layer does not pull the whole Categories store into role-zen. Same unions
 * as the source (lines 6-7). */
export type CategoryStatus = "active" | "inactive";
export type LotIdSource = "system" | "vendor";
