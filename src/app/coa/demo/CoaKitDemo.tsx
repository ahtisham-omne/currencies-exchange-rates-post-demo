// The CoA kit demo: every kit piece on realistic sample data, for side-by-side
// review against the Chart of Accounts module. /accounting/coa-kit is a list
// page; /accounting/coa-kit/:code is a detail page.
import { useLocation } from 'react-router-dom'
import { DemoList } from './DemoList'
import { DemoDetail } from './DemoDetail'

export function CoaKitDemo() {
  const { pathname } = useLocation()
  const m = pathname.match(/^\/accounting\/coa-kit\/([^/]+)/)
  return m ? <DemoDetail code={decodeURIComponent(m[1]).toUpperCase()} /> : <DemoList />
}
