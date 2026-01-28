/**
 * Kit Editor Layout
 *
 * Fills the remaining viewport height below the portal header.
 * Parent dashboard layout provides pt-20 (5rem) for the fixed header.
 * Auth check still runs from the parent dashboard layout.
 */

export default function KitsEditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="relative z-[100] flex flex-col overflow-hidden"
      style={{
        background: '#141c28',
        height: 'calc(100vh - 5rem)',
      }}
    >
      {children}
    </div>
  )
}
