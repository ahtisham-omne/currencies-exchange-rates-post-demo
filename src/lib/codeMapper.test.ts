import { describe, it, expect } from 'vitest'
import {
  detectGluedCodes,
  parseSegments,
  buildSegmentDefs,
  detectFileShape,
  readRows,
  unsupportedReason,
  maxAccountIdx,
  slotQuestions,
  slotValue,
  distinctSlotValues,
  patternFit,
  rowsWithoutDimensions,
  exampleNumber,
  splitNumber,
  slotTally,
  VALUE_MEANS_NOTHING,
} from './codeMapper'
import { accountSegmentValue } from '../types'
import { seedNumberingScheme } from './seed'

// A glued legacy chart: company | account | department, joined by dashes.
const SEPARATED = ['100-2000-200', '100-2010-200', '200-4000-300', '200-6110-100']
// The same meaning without a separator, but with a company block every number
// shares: "100" | four-digit account.
const CONSTANT = ['1001020', '1002010', '1004000', '1006110']
// A plain QuickBooks-style chart. Nothing to rescue.
const FLAT = ['1020', '2010', '4000', '6110']

// Detection is the gate: it decides whether the mapper wakes at all. The two
// glued shapes must be caught, and a flat chart must be left alone.
describe('detectGluedCodes', () => {
  it('splits a separator-joined chart into its three parts', () => {
    const d = detectGluedCodes(SEPARATED)
    expect(d.glued).toBe(true)
    expect(d.kind).toBe('separator')
    expect(d.separator).toBe('-')
    expect(d.segments.map(s => s.length)).toEqual([3, 4, 3])
    expect(d.segments.map(s => s.separator)).toEqual(['-', '-', ''])
  })

  it('splits on a constant leading block when there is no separator', () => {
    const d = detectGluedCodes(CONSTANT)
    expect(d.glued).toBe(true)
    expect(d.kind).toBe('constant')
    expect(d.segments.map(s => s.length)).toEqual([3, 4])
  })

  it('leaves a flat four-digit chart alone', () => {
    const d = detectGluedCodes(FLAT)
    expect(d.glued).toBe(false)
    expect(d.kind).toBe('flat')
    expect(d.segments).toHaveLength(1)
  })

  it('does not cut a digit chart that shares no prefix', () => {
    // Uniform length, pure digits, but no common lead — cutting would guess.
    expect(detectGluedCodes(['1020', '2010', '4000']).glued).toBe(false)
  })

  it('stays flat when a separator chart disagrees on part widths', () => {
    expect(detectGluedCodes(['10-2000', '100-2000']).glued).toBe(false)
  })

  it('is unbothered by empty and blank entries', () => {
    expect(detectGluedCodes(['', '  ', '100-2000-200', '100-2010-200']).glued).toBe(true)
  })
})

describe('parseSegments', () => {
  it('splits a number by a detected split', () => {
    const { segments } = detectGluedCodes(SEPARATED)
    expect(parseSegments(segments, '100-2000-200')).toEqual(['100', '2000', '200'])
  })

  it('returns null for a number that does not fit', () => {
    const { segments } = detectGluedCodes(SEPARATED)
    expect(parseSegments(segments, '10-20')).toBeNull()
  })
})

// The style the customer arrives with must survive as a SegmentDef[] so future
// number suggestions copy it, and the account part must be marked so section
// placement reads the right part of the number.
describe('buildSegmentDefs', () => {
  it('marks the widest part as the account part', () => {
    const { segments } = detectGluedCodes(SEPARATED)
    const defs = buildSegmentDefs(segments, ['Company', undefined, 'Department'])
    expect(defs.map(s => s.meaning)).toEqual(['Company', 'Account', 'Department'])
  })

  /* The widest part is only a guess. When the user says a different part is the
     account, the mark has to move, or placement keeps reading the part they
     rejected - and their own name for the part they chose is discarded, because
     "Account" is the reserved meaning placement looks for. */
  it('marks the part the user picked instead, wherever it is', () => {
    const { segments } = detectGluedCodes(SEPARATED)
    const defs = buildSegmentDefs(segments, ['Company', 'Middle', 'Department'], 2)
    expect(defs.map(s => s.meaning)).toEqual(['Company', 'Middle', 'Account'])
  })

  it('ignores an account index that is not one of the parts', () => {
    const { segments } = detectGluedCodes(SEPARATED)
    const defs = buildSegmentDefs(segments, ['Company', undefined, 'Department'], 7)
    expect(defs.map(s => s.meaning)).toEqual(['Company', 'Account', 'Department'])
  })

  /* The account part is what a suggestion counts from, so it has to be readable
     out of a glued number. It decides nothing else: where the account is filed
     comes from the category stated on it, so 100-2000-200 being a liability is
     not something the digits are asked about. */
  it('reads the account part out of a glued number, not the whole code', () => {
    const { segments } = detectGluedCodes(SEPARATED)
    const scheme = {
      ...seedNumberingScheme,
      segments: buildSegmentDefs(segments, ['Company', undefined, 'Department']),
    }
    expect(accountSegmentValue(scheme, '100-2000-200')).toBe(2000)
    expect(accountSegmentValue(scheme, '200-4000-300')).toBe(4000)
    expect(accountSegmentValue(scheme, '200-6110-100')).toBe(6110)
  })
})

// A real export is ragged. The old rectangle reader gave up on such a file and
// fell back to flat, which silently cost the chart every dimension in it; the
// shape reader keeps the file readable and costs the short rows only their own
// values.
describe('detectFileShape', () => {
  // Mostly three parts, one bare account, one two-part row.
  const RAGGED = ['100-2000-200', '2000', '2000-200']

  it('reads a ragged file the rectangle reader refuses to cut', () => {
    expect(detectGluedCodes(RAGGED).glued).toBe(false)

    const shape = detectFileShape(RAGGED)
    expect(shape).toEqual({ separator: '-', partCount: 3, minPartCount: 1, widths: [3, 4, 3] })
  })

  it('takes widths from the full-width rows, which are the only known ones', () => {
    // The short rows cannot vote on width, because which slot they occupy is
    // exactly what is not yet known.
    expect(detectFileShape(['01-71100-40', '01-71100-50', '71100'])?.widths).toEqual([2, 5, 2])
  })

  it('reads a rectangular file as a floor equal to its part count', () => {
    const shape = detectFileShape(SEPARATED)
    expect(shape?.partCount).toBe(3)
    expect(shape?.minPartCount).toBe(3)
  })

  /* Agreed Sept 3: a number with no separator imports whole. Cutting one by
     position is in the backlog (priority 6), so a shared leading block is not
     read as a segment. */
  it('imports a number with no separator whole, even one sharing a leading block', () => {
    expect(detectFileShape(CONSTANT)).toBeNull()
  })

  it('returns nothing for a flat chart, rather than inventing a cut', () => {
    expect(detectFileShape(FLAT)).toBeNull()
    expect(detectFileShape([])).toBeNull()
  })

  /* The part count is what the numbers agree on. Taking the longest instead let
     one number typed with a spare part reshape the file, and every properly
     built row in it then read as short. */
  it('takes its part count from the numbers that agree, not the longest one', () => {
    const shape = detectFileShape([...SEPARATED, '100-2000-200-9'])!
    expect(shape.partCount).toBe(3)
    // The odd row is off the pattern, so it does not get to move the account cap.
    expect(shape.minPartCount).toBe(3)
    expect(maxAccountIdx(shape)).toBe(2)
  })

  it('still reads a ragged tie as the wider split, which is what rescues it', () => {
    // One row of each length, so nothing has a majority. Read as one part, the
    // whole file would lose its meaning.
    expect(detectFileShape(RAGGED)?.partCount).toBe(3)
  })
})

/* Nobody is asked whether their numbers hold dimensions, so the reading has to be
   able to account for itself: how much of the file holds, and exactly which
   numbers do not. Those get flagged and read as they are, never padded. */
describe('patternFit', () => {
  it('counts a rectangular file as holding throughout', () => {
    const fit = patternFit(SEPARATED, detectFileShape(SEPARATED)!)
    expect(fit).toEqual({ total: 4, conforming: 4, short: [], offPattern: [] })
  })

  it('calls a short row ragged rather than wrong', () => {
    const ragged = ['100-2000-200', '2000', '2000-200']
    const fit = patternFit(ragged, detectFileShape(ragged)!)
    expect(fit.conforming).toBe(1)
    expect(fit.short).toEqual([1, 2])
    expect(fit.offPattern).toEqual([])
  })

  /* A row whose parts are not codes cannot be cut this way at all, and is named by
     its index so a screen can quote the number back. Letters are codes: what makes
     a part unreadable is punctuation or a space inside it. */
  it('names the rows the pattern does not hold for', () => {
    const numbers = ['100-2000-200', '100-20 10-200', '200-4000-300']
    const fit = patternFit(numbers, detectFileShape(numbers)!)
    expect(fit.offPattern).toEqual([1])
    expect(fit.conforming).toBe(2)
  })

  it('counts a lettered part as conforming, because a code can carry letters', () => {
    const numbers = ['AR-2000-200', 'AR-2010-XX0', 'BR-4000-300']
    const fit = patternFit(numbers, detectFileShape(numbers)!)
    expect(fit.offPattern).toEqual([])
    expect(fit.conforming).toBe(3)
  })

  it('does not count a blank number against the split', () => {
    const fit = patternFit([...SEPARATED, '', '  '], detectFileShape(SEPARATED)!)
    expect(fit.total).toBe(4)
    expect(fit.conforming).toBe(4)
  })

})

/* What refuses a "yes, they hold dimensions" answer. Fewer parts than the rest
   is ragged and allowed; no dimensions at all is a different claim about the file
   and is sent back to be fixed in the spreadsheet. */
describe('rowsWithoutDimensions', () => {
  it('finds nothing in a file where every number splits', () => {
    expect(rowsWithoutDimensions(SEPARATED, detectFileShape(SEPARATED)!)).toEqual([])
  })

  it('names the row carrying a number with no dimensions in it', () => {
    const numbers = ['01-71100-40', '2000', '01-11000-00']
    expect(rowsWithoutDimensions(numbers, detectFileShape(numbers)!)).toEqual([1])
  })

  it('leaves a merely short number alone, because it still holds dimensions', () => {
    const numbers = ['01-71100-40', '71100-40', '01-11000-00']
    expect(rowsWithoutDimensions(numbers, detectFileShape(numbers)!)).toEqual([])
  })

  it('does not count a blank number, which the review grid states on its own row', () => {
    const numbers = [...SEPARATED, '', '   ']
    expect(rowsWithoutDimensions(numbers, detectFileShape(SEPARATED)!)).toEqual([])
  })

})

/* The split shown to the customer has to be a whole one. A file whose first row
   is a short heading number would otherwise demonstrate the split on a number
   that does not have all the parts. */
describe('exampleNumber', () => {
  it('skips a short row for one that splits all the way', () => {
    const numbers = ['2000', '01-71100-40', '01-71100-50']
    expect(exampleNumber(numbers, detectFileShape(numbers)!)).toBe('01-71100-40')
  })

  // A stray space is a separator, so it adds a segment and the number is off the file's pattern.
  it('skips a number with more segments than the rest', () => {
    const numbers = ['01-711 0-40', '01-71100-50', '02-71100-40']
    expect(exampleNumber(numbers, detectFileShape(numbers)!)).toBe('01-71100-50')
  })

  it('is happy to show a lettered number, which is a code like any other', () => {
    const numbers = ['01-711X0-40', '01-71100-50']
    expect(exampleNumber(numbers, detectFileShape(numbers)!)).toBe('01-711X0-40')
  })

  it('falls back to the first number when none of them split whole', () => {
    const numbers = ['01-711 0-40', '2000']
    expect(exampleNumber(numbers, detectFileShape(numbers)!)).toBe('01-711 0-40')
  })
})

/* The account has to exist in every row, so it cannot sit further right than
   the shortest row reaches. A bare 2000 in a location-first file pins the
   account to the first part; it is never read as a location. */
describe('unsupportedReason', () => {
  const RAGGED = ['100-2000-200', '2000', '2000-200']
  const shape = detectFileShape(RAGGED)!

  it('refuses an account position the shortest row cannot reach', () => {
    expect(unsupportedReason(shape, 1)).toEqual({
      kind: 'accountBeyondShortestRow', accountIdx: 1, minPartCount: 1, partCount: 3,
    })
    expect(unsupportedReason(shape, 2)).not.toBeNull()
  })

  it('allows the leftmost position, which every row reaches', () => {
    expect(unsupportedReason(shape, 0)).toBeNull()
    expect(maxAccountIdx(shape)).toBe(0)
  })

  it('allows any position in a rectangular file', () => {
    const rect = detectFileShape(SEPARATED)!
    expect([0, 1, 2].map(i => unsupportedReason(rect, i))).toEqual([null, null, null])
    expect(maxAccountIdx(rect)).toBe(2)
  })
})

describe('readRows', () => {
  const shape = detectFileShape(['100-2000-200', '2000', '2000-200'])!

  /* The account's own slot is left out of the values: it is the account number,
     not a dimension value, and a caller that had to remember to skip it would
     eventually forget. */
  it('reads a full-width row straight onto its slots', () => {
    const [r] = readRows(['100-2000-200'], detectFileShape(SEPARATED)!, 1)
    expect(r.accountPart).toBe('2000')
    expect([...r.valuesBySlot]).toEqual([[0, '100'], [2, '200']])
    expect(r.ambiguous).toBe(false)
    expect(r.unfit).toBeUndefined()
  })

  /* A bare 2000 in a three-part file is account 2000 and nothing else. Absence
     is absence: it carries no location and no department, and certainly not a
     padded stand-in for one. */
  it('reads a one-of-three row as a bare account with no values', () => {
    const [, short] = readRows(['100-2000-200', '2000'], shape, 0)
    expect(short.accountPart).toBe('2000')
    expect([...short.valuesBySlot]).toEqual([])
    expect(short.ambiguous).toBe(false)
  })

  it('keeps the arrival string verbatim, and stays index-aligned to its input', () => {
    const readings = readRows(['100-2000-200', '', '2000'], shape, 0)
    expect(readings.map(r => r.row)).toEqual([0, 1, 2])
    expect(readings.map(r => r.raw)).toEqual(['100-2000-200', '', '2000'])
    expect(readings[1].unfit).toBe('unreadable')
  })

  /* Which slot, not which end. With the account anchored leftmost there is one
     part left over and two slots it could sit in, so the reader looks for
     evidence before it asks. */
  describe('placing the leftover part of a short row', () => {
    // Three equal widths, so width alone cannot decide - only the values can.
    const EVEN = ['100-200-300', '100-200-400']
    const even = detectFileShape(EVEN)!

    it('places it by value when only one slot has ever held that code', () => {
      const [, , row] = readRows([...EVEN, '100-400'], even, 0)
      expect(row.valuesBySlot.get(2)).toBe('400')
      expect(row.valuesBySlot.has(1)).toBe(false)
      expect(row.ambiguous).toBe(false)
    })

    it('places it by width when the slots are different widths', () => {
      const shaped = detectFileShape(['100-2000-200', '100-2010-300'])!
      const [, , row] = readRows(['100-2000-200', '100-2010-300', '100-200'], shaped, 0)
      // '200' is three wide, and only the last slot is.
      expect(row.valuesBySlot.get(2)).toBe('200')
      expect(row.ambiguous).toBe(false)
    })

    it('gives up and asks when no evidence separates the slots', () => {
      const [, , row] = readRows([...EVEN, '100-999'], even, 0)
      expect(row.ambiguous).toBe(true)
      // The question is asked in the customer's own code, not as a row number.
      expect(row.unplaced).toEqual([{ code: '999', slots: [1, 2] }])
    })

    /* A guess is still made, so a file nobody answers imports rather than
       stalling. The leftmost candidate is the guess. */
    it('guesses anyway while it waits to be told', () => {
      const [, , row] = readRows([...EVEN, '100-999'], even, 0)
      expect(row.valuesBySlot.get(1)).toBe('999')
    })

    it('places the code where the customer says, and stops asking', () => {
      const [, , row] = readRows([...EVEN, '100-999'], even, 0, { '999': 2 })
      expect(row.valuesBySlot.get(2)).toBe('999')
      expect(row.valuesBySlot.has(1)).toBe(false)
      expect(row.ambiguous).toBe(false)
    })

    /* One code, however many rows carry it, is one question - a file with two
       hundred short rows must not put two hundred pickers on the screen. */
    it('folds the rows asking the same thing into one question', () => {
      const questions = slotQuestions(readRows([...EVEN, '100-999', '100-999', '100-888'], even, 0))
      expect(questions).toEqual([
        { code: '999', slots: [1, 2], rows: [2, 3] },
        { code: '888', slots: [1, 2], rows: [4] },
      ])
    })

    it('has nothing to ask once every code is answered', () => {
      const readings = readRows([...EVEN, '100-999'], even, 0, { '999': 1 })
      expect(slotQuestions(readings)).toEqual([])
    })

    it('needs no evidence when the leftover parts fill the leftover slots', () => {
      const [, row] = readRows(['100-200-300', '100-200'], even, 1)
      expect(row.accountPart).toBe('200')
      expect(row.ambiguous).toBe(false)
      expect(row.valuesBySlot.has(2)).toBe(false)
    })
  })

  it('marks a row that cannot reach the account position unfit', () => {
    const [, short] = readRows(['100-2000-200', '2000'], shape, 1)
    expect(short.unfit).toBe('parts')
    expect(short.accountPart).toBeNull()
  })

  /* Every character that is not a letter or digit separates, so a space inside a
     part splits it: the row then has more segments than the file and cannot say
     which is its account. The known cost of the rule. */
  it('reads a stray space as a separator, leaving the row unfit for the file', () => {
    const [row] = readRows(['100-A C-200'], detectFileShape(SEPARATED)!, 1)
    expect(row.unfit).toBe('parts')
  })

  /* An account number can carry letters, so a lettered part is read like any
     other rather than refused. ABC is the account here. */
  it('reads a lettered part', () => {
    const [row] = readRows(['100-ABC-200'], detectFileShape(SEPARATED)!, 1)
    expect(row.unfit).toBeUndefined()
    expect(row.accountPart).toBe('ABC')
  })

})

describe('turning read rows into dimension values', () => {
  const NUMBERS = ['01-71100-40', '01-71100-50', '01-11000-00']
  const shape = detectFileShape(NUMBERS)!
  const readings = readRows(NUMBERS, shape, 1)

  it('lists a slot\'s distinct values in first-seen order', () => {
    expect(distinctSlotValues(readings, 2)).toEqual(['40', '50', '00'])
    expect(distinctSlotValues(readings, 0)).toEqual(['01'])
  })

  it('renames values through the customer labels', () => {
    expect(distinctSlotValues(readings, 2, { '40': 'Sales', '50': 'Marketing' }))
      .toEqual(['Sales', 'Marketing', '00'])
  })

  it('falls back to the digits for a name typed and then cleared', () => {
    expect(distinctSlotValues(readings, 0, { '01': '  ' })).toEqual(['01'])
  })

  /* Decision 6: a present code the customer says means nothing stores nothing,
     exactly like an absent part. It must not reach the value list either, or a
     report grows a column for a meaning nobody claimed. */
  it('never offers a code the customer marked as meaning nothing', () => {
    const labels = { '00': VALUE_MEANS_NOTHING, '40': 'Sales' }
    expect(distinctSlotValues(readings, 2, labels)).toEqual(['Sales', '50'])
    // And the row carrying that code stores nothing for the slot either.
    expect(slotValue(readings[2].valuesBySlot.get(2), labels)).toBeNull()
  })

  it('reads a row\'s value for a slot under the customer name', () => {
    expect(slotValue(readings[0].valuesBySlot.get(0), { '01': 'London' })).toBe('London')
    expect(slotValue(readings[0].valuesBySlot.get(2), { '40': 'Sales' })).toBe('Sales')
  })

  /* Decision 6 again, from the other side: an absent part is absence, so there is
     no value to store rather than a blank one. */
  it('has no value for a slot the row does not reach', () => {
    const ragged = detectFileShape(['100-2000-200', '2000'])!
    const [, short] = readRows(['100-2000-200', '2000'], ragged, 0)
    expect(slotValue(short.valuesBySlot.get(2))).toBeNull()
  })
})

/* Naming a part's codes is the job that gets abandoned, and the counts are what
   make it decidable: twenty codes where two of them cover most of the file is a
   different task from twenty evenly spread. */
describe('slotTally', () => {
  const NUMBERS = ['01-71100-40', '01-71100-50', '02-71100-40', '02-11000-40']
  const shape = detectFileShape(NUMBERS)!
  const readings = readRows(NUMBERS, shape, 1)

  it('counts the rows each code appears on', () => {
    expect(slotTally(readings, 2)).toEqual([{ code: '40', rows: 3 }, { code: '50', rows: 1 }])
  })

  /* Code order rather than commonest first, because this same list is what a
     pasted column of names is read against, and a spreadsheet holds those names
     in the order the codes sort in. */
  it('orders by code, not by how common the code is', () => {
    expect(slotTally(readings, 0).map(t => t.code)).toEqual(['01', '02'])
  })

  it('says nothing about a row that does not reach the part', () => {
    const ragged = ['100-2000-200', '2000']
    const readShort = readRows(ragged, detectFileShape(ragged)!, 0)
    expect(slotTally(readShort, 2)).toEqual([{ code: '200', rows: 1 }])
  })

  it('gives nothing back for a part nothing reaches', () => {
    expect(slotTally([], 0)).toEqual([])
  })
})

/* Any character that is not a letter or digit separates segments (agreed Sept 3,
   2026). The first reader knew only hyphens, and real exports use periods,
   spaces, slashes and separators their users picked. */
describe('what separates segments', () => {
  const parts = (numbers: string[]) => {
    const shape = detectFileShape(numbers)!
    return numbers.map(n => splitNumber(n, shape))
  }

  it('splits on periods, spaces, slashes and anything else that is not a letter or digit', () => {
    for (const sep of ['.', ' ', '/', '_', ':', '|', '#', '~']) {
      const numbers = ['1000', '01', '500'].join(sep)
      expect(parts([numbers, numbers.replace('500', '510')])[0], JSON.stringify(sep)).toEqual(['1000', '01', '500'])
    }
  })

  it('splits a file that mixes separators, and a number that mixes them', () => {
    expect(parts(['1000-01-500', '1000.01.510', '1000-01.520'])).toEqual([
      ['1000', '01', '500'], ['1000', '01', '510'], ['1000', '01', '520'],
    ])
  })

  it('counts a run of separators once, and one at either end as nothing', () => {
    expect(parts(['1000 - 01 - 500', '(1000-01-510)'])).toEqual([['1000', '01', '500'], ['1000', '01', '510']])
  })

  // The rule's known cost: a note typed into a number becomes a segment.
  it('makes a note in brackets a segment of its own', () => {
    const numbers = ['1000-01-500', '1000-01-510', '1000-01-520 (old)']
    const shape = detectFileShape(numbers)!
    expect(splitNumber(numbers[2], shape)).toEqual(['1000', '01', '520', 'old'])
    expect(patternFit(numbers, shape).offPattern).toEqual([2])
  })

  it('keeps leading zeros, because numbers are read as text', () => {
    expect(parts(['001-0100-05', '002-0100-05'])[0]).toEqual(['001', '0100', '05'])
  })

  it('names the separators the file uses', () => {
    expect(detectFileShape(['1000-01.500', '1000-01.510'])!.separator).toBe('-.')
  })
})
