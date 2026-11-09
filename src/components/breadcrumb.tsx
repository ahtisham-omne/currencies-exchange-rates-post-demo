import * as React from 'react'
import { ChevronRight, MoreHorizontal } from 'lucide-react'
import { cn } from '../lib/utils'

// CoA-native breadcrumb, modelled on the Partner Management reference
// (read-only: Partner Management - Vendors/src/app/components/ui/breadcrumb.tsx
// and the top-nav bars in VendorsListPage / VendorDetailsPage). Same semantic
// structure (nav > ol > li), gaps, sizes, and states - rebuilt on CoA's
// Tailwind tokens (text-fg, text-fg-muted) with a plain polymorphic `as` prop
// instead of Radix Slot, so router Links compose without shadcn machinery.

function Breadcrumb({ ...props }: React.ComponentProps<'nav'>) {
  return <nav aria-label="breadcrumb" {...props} />
}

function BreadcrumbList({ className, ...props }: React.ComponentProps<'ol'>) {
  return (
    <ol
      className={cn('text-fg-muted flex flex-wrap items-center gap-1.5 text-sm break-words sm:gap-2.5', className)}
      {...props}
    />
  )
}

function BreadcrumbItem({ className, ...props }: React.ComponentProps<'li'>) {
  return <li className={cn('inline-flex items-center gap-1.5', className)} {...props} />
}

// Parent-crumb link. Renders an <a> by default; pass `as={Link}` (or any
// element type) to compose with the router without changing the styling.
type BreadcrumbLinkProps<C extends React.ElementType> = { as?: C } & Omit<React.ComponentPropsWithoutRef<C>, 'as'>
function BreadcrumbLink<C extends React.ElementType = 'a'>({ as, className, ...props }: BreadcrumbLinkProps<C>) {
  const Comp: React.ElementType = as ?? 'a'
  return <Comp className={cn('hover:text-fg transition-colors cursor-pointer', className)} {...props} />
}

// Current-page crumb: foreground colour, normal weight, not a link.
function BreadcrumbPage({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span
      role="link"
      aria-disabled="true"
      aria-current="page"
      className={cn('text-fg font-normal', className)}
      {...props}
    />
  )
}

// Separator: chevron by default; the top bar passes "/" like the Partner
// top-nav bars do.
function BreadcrumbSeparator({ children, className, ...props }: React.ComponentProps<'li'>) {
  return (
    <li role="presentation" aria-hidden="true" className={cn('[&>svg]:size-3.5', className)} {...props}>
      {children ?? <ChevronRight />}
    </li>
  )
}

function BreadcrumbEllipsis({ className, ...props }: React.ComponentProps<'span'>) {
  return (
    <span role="presentation" aria-hidden="true" className={cn('flex size-9 items-center justify-center', className)} {...props}>
      <MoreHorizontal className="size-4" />
      <span className="sr-only">More</span>
    </span>
  )
}

export {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
}
