/* =====================================================================================
   Naming the codes inside a number that holds dimensions.

   A part of a number is a list of codes: 01, 02, 03. Nobody reads a report
   filtered by 03, so a name makes the dimension worth more - but naming is
   optional, and a code with no name imports as the code, which is exactly what
   the old system stored. Deferring loses nothing that was not already lost.

   This used to also read a paste of code/name pairs and lift names out of a
   column the file already carried, so twenty codes did not have to be typed. Both
   are gone with the controls that reached them: they were machinery for finishing
   a job nobody has to finish.
   ===================================================================================== */
import { VALUE_MEANS_NOTHING } from './codeMapper'

export interface LabelProgress {
  /** Codes given a name. */
  named: number
  /** Codes the customer said stand for nothing, which store no value. */
  meansNothing: number
  /** Codes that will import as the digits, because nobody named them. */
  asCode: number
}

/**
 * How much naming is done, and what the rest will import as.
 *
 * Stated before the import commits, because "17 of your 20 codes will import as
 * digits" is the difference between a dimension somebody can report by and one
 * they cannot, and it is invisible once the accounts exist.
 */
export function labelProgress(codes: string[], labels: Record<string, string>): LabelProgress {
  const p: LabelProgress = { named: 0, meansNothing: 0, asCode: 0 }
  for (const code of codes) {
    const label = labels[code]
    if (label === VALUE_MEANS_NOTHING) p.meansNothing++
    else if (label?.trim()) p.named++
    else p.asCode++
  }
  return p
}
