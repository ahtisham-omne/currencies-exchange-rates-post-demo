import { Navigate } from 'react-router-dom'

/* The numbering page used to build segmented numbers ("Holds dimensions,
   3-5-2") and said no number is reserved - both retired: dimensions replaced
   segments (decision 75) and summaries reserve numbers (decisions 64, 86, 91).
   Outline 09, Where the prototype differs: *"Remove or align."* Its settings now
   live in the chart's Actions menu, under Account numbers
   (components/NumberSettingsModal), so an old link lands on the chart. */
export default function NumberingPage() {
  return <Navigate to="/chart-of-accounts" replace />
}
