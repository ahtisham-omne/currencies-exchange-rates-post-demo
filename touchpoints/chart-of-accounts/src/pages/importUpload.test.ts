import { describe, it, expect } from 'vitest'
import { isSpreadsheetName, fileSizeLabel, descriptionFromFileName } from './ImportAccounts'

// The upload step turns a file away, or takes it and describes it. Both answers
// are given before anything is parsed, so they are worth pinning down on their
// own: a file wrongly refused never reaches the parser the rest of the suite
// covers.

describe('what the dropzone will take', () => {
  it('takes the two formats the template comes in, whatever the casing', () => {
    expect(isSpreadsheetName('accounts.xlsx')).toBe(true)
    expect(isSpreadsheetName('ACCOUNTS.XLSX')).toBe(true)
    expect(isSpreadsheetName('accounts.csv')).toBe(true)
    expect(isSpreadsheetName('chart-of-accounts-import-template.CSv')).toBe(true)
  })

  it('turns away the formats a chart is often mistakenly kept in', () => {
    expect(isSpreadsheetName('accounts.xls')).toBe(false)
    expect(isSpreadsheetName('accounts.numbers')).toBe(false)
    expect(isSpreadsheetName('accounts.pdf')).toBe(false)
    expect(isSpreadsheetName('accounts')).toBe(false)
  })

  it('reads the last extension, not one buried in the name', () => {
    expect(isSpreadsheetName('accounts.csv.pdf')).toBe(false)
    expect(isSpreadsheetName('q1.xlsx.csv')).toBe(true)
  })
})

describe('the size on the attachment card', () => {
  it('rounds to whole kilobytes, and never to nothing', () => {
    expect(fileSizeLabel(0)).toBe('1 KB')
    expect(fileSizeLabel(120)).toBe('1 KB')
    expect(fileSizeLabel(4096)).toBe('4 KB')
  })

  it('turns over to megabytes at a megabyte, with one decimal', () => {
    expect(fileSizeLabel(1024 * 1024)).toBe('1.0 MB')
    expect(fileSizeLabel(1024 * 1024 * 2.75)).toBe('2.8 MB')
    expect(fileSizeLabel(1024 * 1023)).toBe('1023 KB')
  })
})

describe('the description a blank field falls back to', () => {
  it('takes the file name without its extension', () => {
    expect(descriptionFromFileName('Q1 chart.xlsx')).toBe('Q1 chart')
    expect(descriptionFromFileName('accounts.csv')).toBe('accounts')
  })

  it('drops only the last extension, so a dotted name survives', () => {
    expect(descriptionFromFileName('accounts.v2.final.csv')).toBe('accounts.v2.final')
  })
})
