# Complete UI Component Library - Implementation Guide

## 📦 All Available Components

Your centralized UI library now includes **15 comprehensive component systems** with full theme integration:

### 1. **Accordion** (`Accordion.tsx`)
Collapsible content sections with single or multiple expansion modes.

```tsx
import { Accordion, AccordionItem } from '@/components/ui'

// Multiple items with auto state management
<Accordion
  items={[
    { id: '1', title: 'Section 1', content: <div>Content</div>, icon: <Icon /> },
    { id: '2', title: 'Section 2', content: <div>Content</div>, defaultOpen: true }
  ]}
  allowMultiple
/>

// Single controlled item
<AccordionItem
  title="Section Title"
  icon={<Icon />}
  isOpen={isOpen}
  onToggle={() => setIsOpen(!isOpen)}
>
  <p>Content here</p>
</AccordionItem>
```

### 2. **Alert** (`Alert.tsx`)
Alert messages with variants for different states.

```tsx
import { Alert } from '@/components/ui'

<Alert variant="error" title="Error Occurred" dismissible onDismiss={handleDismiss}>
  There was an error processing your request.
</Alert>

// Variants: info, success, warning, error
```

### 3. **Badge** (`Badge.tsx`)
Status badges, count badges, and pills for labels.

```tsx
import { Badge, StatusBadge, CountBadge } from '@/components/ui'

<Badge variant="success" icon={<Check />} size="md">
  Active
</Badge>

<StatusBadge status="online" showDot text="Online" />

<CountBadge count={42} max={99} variant="primary" />
```

### 4. **Button** (`Button.tsx`)
Comprehensive button system with variants and states.

```tsx
import { Button, IconButton, ButtonGroup } from '@/components/ui'

<Button
  variant="primary"
  size="md"
  loading={isLoading}
  leftIcon={<Plus />}
  onClick={handleClick}
>
  Create New
</Button>

<IconButton icon={<Edit />} label="Edit" />

<ButtonGroup>
  <Button>Option 1</Button>
  <Button>Option 2</Button>
</ButtonGroup>
```

**Variants**: primary, secondary, success, error, warning, ghost, outline
**Sizes**: sm, md, lg

### 5. **Card** (`Card.tsx`)
Card containers with header, body, footer sections, plus specialized StatCard.

```tsx
import { Card, CardHeader, CardBody, CardFooter, StatCard } from '@/components/ui'

<Card variant="glass" padding="md" hoverable>
  <CardHeader icon={<Icon />} action={<Button>Action</Button>}>
    <h3>Card Title</h3>
  </CardHeader>
  <CardBody>
    <p>Card content here</p>
  </CardBody>
  <CardFooter>
    <Button>Cancel</Button>
    <Button variant="primary">Save</Button>
  </CardFooter>
</Card>

<StatCard
  icon={<Users />}
  label="Total Users"
  value="1,234"
  change="+12.5%"
  changeType="positive"
  loading={false}
/>
```

**Variants**: default, glass, gradient
**Padding**: none, sm, md, lg

### 6. **Dropdown** (`Dropdown.tsx`)
Custom dropdown select with search and icons.

```tsx
import { Dropdown } from '@/components/ui'

<Dropdown
  value={selectedValue}
  options={[
    { value: '1', label: 'Option 1', description: 'Description', icon: <Icon /> },
    { value: '2', label: 'Option 2', disabled: true }
  ]}
  onChange={setSelectedValue}
  placeholder="Select option"
  searchable
  clearable
  error={validationError}
/>
```

### 7. **EmptyState** (`EmptyState.tsx`)
No data/empty state displays with optional action.

```tsx
import { EmptyState } from '@/components/ui'

<EmptyState
  icon={<Inbox className="w-8 h-8" />}
  title="No data yet"
  description="Get started by creating your first item"
  action={{
    label: 'Create Item',
    onClick: handleCreate,
    icon: <Plus />
  }}
/>
```

### 8. **Input** (`Input.tsx`)
Text, number, and textarea inputs with validation.

```tsx
import { Input, Textarea, NumberInput } from '@/components/ui'

<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  leftIcon={<Mail />}
  error={errors.email}
  helperText="We'll never share your email"
  required
  size="md"
  variant="default"
/>

<Textarea
  label="Description"
  rows={4}
  resize={false}
  maxLength={500}
/>

<NumberInput
  label="Quantity"
  value={quantity}
  onChange={setQuantity}
  min={1}
  max={100}
  step={1}
  showControls
/>
```

**Sizes**: sm, md, lg
**Variants**: default, filled, outlined

### 9. **Loading** (`Loading.tsx`)
Loading indicators: spinners, skeletons, progress bars, dots.

```tsx
import {
  Spinner,
  BorderSpinner,
  Loading,
  Skeleton,
  ProgressBar,
  DotsLoader
} from '@/components/ui'

<Spinner size="md" color="primary" />
<BorderSpinner size="lg" color="success" />
<Loading text="Loading data..." fullScreen overlay />
<Skeleton width="100%" height="20px" variant="rectangular" />
<ProgressBar value={75} max={100} showLabel color="primary" />
<DotsLoader size="md" color="primary" />
```

### 10. **Modal** (`Modal.tsx`)
Modal dialogs with customizable size and footer.

```tsx
import { Modal, ConfirmModal } from '@/components/ui'

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  description="Optional description"
  icon={<Icon />}
  size="md"
  footer={
    <>
      <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
      <Button variant="primary" onClick={handleSave}>Save</Button>
    </>
  }
>
  <p>Modal content</p>
</Modal>

<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Delete Item"
  description="Are you sure? This cannot be undone."
  confirmText="Delete"
  variant="error"
  loading={isDeleting}
/>
```

**Sizes**: sm, md, lg, xl, full

### 11. **MultiSelect** (`MultiSelect.tsx`)
Multi-select dropdown with checkboxes.

```tsx
import { MultiSelect } from '@/components/ui'

<MultiSelect
  value={selectedItems}
  options={[
    { value: '1', label: 'Item 1', icon: <Icon />, description: 'Description' },
    { value: '2', label: 'Item 2', disabled: true }
  ]}
  onChange={setSelectedItems}
  placeholder="Select multiple"
  searchable
  showSelectAll
  maxHeight="240px"
/>
```

### 12. **Pagination** (`Pagination.tsx`)
Page navigation with numbers or simple prev/next.

```tsx
import { Pagination, SimplePagination } from '@/components/ui'

<Pagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  siblingCount={1}
  showFirstLast
/>

<SimplePagination
  currentPage={currentPage}
  totalPages={totalPages}
  onPageChange={setCurrentPage}
  showPageInfo
/>
```

### 13. **SearchInput** (`SearchInput.tsx`)
Search input with icon and clear button.

```tsx
import { SearchInput } from '@/components/ui'

<SearchInput
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  onClear={() => setSearchQuery('')}
  placeholder="Search..."
  size="md"
  variant="default"
  showClearButton
/>
```

### 14. **Switch** (`Switch.tsx`)
Toggle switches replacing all checkboxes.

```tsx
import { Switch, CheckboxSwitch } from '@/components/ui'

<Switch
  checked={isEnabled}
  onChange={setIsEnabled}
  label="Enable feature"
  description="This will activate the feature"
  size="md"
  icon={<Icon />}
/>

<CheckboxSwitch
  checked={agreed}
  onChange={setAgreed}
  label="I agree to the terms"
  error={errors.agreed}
/>
```

**Sizes**: sm, md, lg

### 15. **Tabs** (`Tabs.tsx`)
Tab navigation with variants.

```tsx
import { Tabs } from '@/components/ui'

<Tabs
  tabs={[
    { id: 'tab1', label: 'Tab 1', icon: <Icon />, badge: 5 },
    { id: 'tab2', label: 'Tab 2', disabled: true },
    { id: 'tab3', label: 'Tab 3' }
  ]}
  activeTab={activeTab}
  onChange={setActiveTab}
  variant="pills"
  size="md"
  fullWidth
/>
```

**Variants**: default, pills, underline
**Sizes**: sm, md, lg

---

## 🎨 Theme Variables Reference

All components use these CSS variables from your global theme:

```css
/* Primary Colors */
--accent-primary          /* Main accent color */
--accent-primary-rgb      /* RGB values for alpha */

/* Text Colors */
--text-primary           /* Primary text */
--text-secondary         /* Secondary text */
--text-muted             /* Muted/placeholder text */
--text-tertiary          /* Tertiary text */

/* Background Colors */
--bg-primary             /* Primary background */
--bg-card                /* Card background */
--bg-input               /* Input background */
--bg-card-hover          /* Hover state background */

/* Glass Morphism */
--glass-bg               /* Glass background */
--glass-border           /* Glass border */
--glass-bg-subtle        /* Subtle glass */
--glass-bg-prominent     /* Prominent glass */

/* Borders */
--border-secondary       /* Secondary border */

/* Status Colors */
--status-success         /* Success state */
--status-success-rgb     /* Success RGB */
--status-error           /* Error state */
--status-error-rgb       /* Error RGB */
--status-warning         /* Warning state */
--status-warning-rgb     /* Warning RGB */
```

---

## 📋 Migration Checklist

### Phase 1: Replace Component Imports

- [ ] Update all `CategoryDropdown` to `Dropdown`
- [ ] Update all `SelectDropdown` to `Dropdown`
- [ ] Update all `VisibilityDropdown` to `MultiSelect`
- [ ] Replace all checkbox inputs with `Switch` or `CheckboxSwitch`
- [ ] Replace all text inputs with `Input` component
- [ ] Replace all textareas with `Textarea` component
- [ ] Replace all buttons with `Button` component
- [ ] Replace all modals with `Modal` component
- [ ] Replace all loading spinners with `Loading` components
- [ ] Replace all search inputs with `SearchInput`

### Phase 2: Update Page Files

#### `/dashboard/page.tsx`
- [ ] Replace stat cards with `StatCard` component
- [ ] Update navigation buttons with `Button` component

#### `/dashboard/admin/page.tsx`
- [ ] Replace stat cards with `StatCard` component
- [ ] Update loading spinners with `Spinner` component

#### `/announcements/page.tsx`
- [ ] Replace announcement modal with `Modal` component
- [ ] Update server multi-select with `MultiSelect` component
- [ ] Replace custom toggles with `Switch` component
- [ ] Update form inputs with `Input` and `Textarea`
- [ ] Replace empty state with `EmptyState` component

#### `/clans/page.tsx`
- [ ] Replace create clan modal with `Modal` component
- [ ] Update search input with `SearchInput` component
- [ ] Replace all text inputs with `Input` component
- [ ] Update pagination with `Pagination` component
- [ ] Replace empty state with `EmptyState` component
- [ ] Update badges with `Badge` component

#### `/clans/banned-names/page.tsx`
- [ ] Replace pattern modal with `Modal` component
- [ ] Update custom toggles with `Switch` component
- [ ] Replace search/test input with `SearchInput` and `Button`
- [ ] Update empty state with `EmptyState` component

#### `/clans/perks/page.tsx`
- [ ] Replace perk modals with `Modal` component
- [ ] Update native selects with `Dropdown` component
- [ ] Replace all inputs with `Input` and `Textarea`
- [ ] Update custom toggles with `Switch` component
- [ ] Replace empty state with `EmptyState` component
- [ ] Update badges with `Badge` component

#### `/bases/page.tsx`
- [ ] Update tab buttons with `Tabs` component
- [ ] Replace checkboxes with `Switch` component
- [ ] Update all number inputs with `NumberInput` component
- [ ] Replace native selects with `Dropdown` component

#### `/bases-analytics/page.tsx`
- [ ] Update tab buttons with `Tabs` component
- [ ] Replace native selects with `Dropdown` component
- [ ] Update raid accordion with `Accordion` component
- [ ] Replace stat cards with `StatCard` component
- [ ] Update badges with `Badge` component
- [ ] Replace loading spinners with `Loading` component
- [ ] Update pagination with `Pagination` component

#### `/event-analytics/page.tsx`
- [ ] Same as bases-analytics (similar structure)

#### `/feedback/page.tsx`
- [ ] Replace feedback accordion with `Accordion` component
- [ ] Update custom toast with `Alert` component
- [ ] Replace server dropdown with `Dropdown` component
- [ ] Update badges with `Badge` component

#### `/giveaways/page.tsx`
- [ ] Replace modals with `Modal` component
- [ ] Update tab state with `Tabs` component
- [ ] Replace empty state with `EmptyState` component
- [ ] Update badges with `Badge` component

#### `/kits/page.tsx`
- [ ] Update all existing modals with centralized `Modal`
- [ ] Ensure search uses `SearchInput`
- [ ] Verify all buttons use `Button` component

#### `/lootmanager/page.tsx`
- [ ] Update tab state with `Tabs` component
- [ ] Ensure all inputs use centralized components
- [ ] Update card layout with `Card` component

#### `/servers/page.tsx`
- [ ] Update category accordion with `Accordion` component
- [ ] Replace search with `SearchInput` component
- [ ] Update empty state with `EmptyState` component
- [ ] Replace loading with `Spinner` component

#### `/shop-purchases/page.tsx`
- [ ] Update tab state with `Tabs` component
- [ ] Replace search with `SearchInput` component
- [ ] Update modals with `Modal` component
- [ ] Replace stat cards with `StatCard` component
- [ ] Update pagination with `Pagination` component

#### `/stats/page.tsx`
- [ ] Replace search with `SearchInput` component
- [ ] Update dropdowns with `Dropdown` component
- [ ] Replace modals with `ConfirmModal` component
- [ ] Update pagination with `Pagination` component
- [ ] Replace loading with `Spinner` component

#### `/tokens/page.tsx`
- [ ] Update modals with `Modal` component
- [ ] Ensure all inputs use centralized components
- [ ] Update badges with `Badge` component

#### `/leaderboards/page.tsx`
- [ ] Replace dropdown with `Dropdown` component
- [ ] Replace loading with `Loading` component
- [ ] Update badges with `Badge` component

### Phase 3: Update Component Files

#### `/components/kit-manager/`
- [ ] Update `CategoryDropdown.tsx` - Replace with `Dropdown` usage
- [ ] Update `SelectDropdown.tsx` - Replace with `Dropdown` usage
- [ ] Update `VisibilityDropdown.tsx` - Replace with `MultiSelect` usage
- [ ] Update `ItemBrowser.tsx` - Use `SearchInput`, `Accordion`
- [ ] Update `ItemEditor.tsx` - Use `Input`, `NumberInput`
- [ ] Update all modals - Use centralized `Modal`

#### `/components/loot-shared/`
- [ ] Update `LootItemBrowser.tsx` - Use `SearchInput`, `Dropdown`
- [ ] Update `LootTableEditor.tsx` - Use `Input`, `SearchInput`, `Switch`, `Tabs`
- [ ] Update `ServerMappingEditor.tsx` - Use `Dropdown`, `Switch`, `Modal`
- [ ] Update `ConfigManager.tsx` - Use `Modal`, `Input`, `Button`
- [ ] Update `Modal.tsx` - Replace with centralized `Modal`

### Phase 4: Cleanup

- [ ] Remove old `CategoryDropdown.tsx`
- [ ] Remove old `SelectDropdown.tsx`
- [ ] Remove old `VisibilityDropdown.tsx`
- [ ] Remove old modal implementations if fully replaced
- [ ] Remove any inline UI implementations
- [ ] Update all imports to use `@/components/ui`

### Phase 5: Testing & Verification

- [ ] Test all pages for visual consistency
- [ ] Verify all interactions work correctly
- [ ] Check keyboard navigation (Tab, Enter, Escape)
- [ ] Verify mobile responsiveness
- [ ] Test loading states
- [ ] Verify error states display correctly
- [ ] Check accessibility with screen readers
- [ ] Verify theme consistency across all pages

---

## 🚀 Quick Start Examples

### Replace an Inline Select
```tsx
// OLD
<select value={value} onChange={(e) => setValue(e.target.value)}>
  <option value="1">Option 1</option>
  <option value="2">Option 2</option>
</select>

// NEW
import { Dropdown } from '@/components/ui'

<Dropdown
  value={value}
  options={[
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' }
  ]}
  onChange={setValue}
/>
```

### Replace an Inline Checkbox
```tsx
// OLD
<input
  type="checkbox"
  checked={checked}
  onChange={(e) => setChecked(e.target.checked)}
/>

// NEW
import { Switch } from '@/components/ui'

<Switch
  checked={checked}
  onChange={setChecked}
  label="Enable feature"
/>
```

### Replace an Inline Modal
```tsx
// OLD
{isOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
    <div className="bg-white p-6 rounded-lg">
      <h2>Modal Title</h2>
      <p>Content</p>
      <button onClick={onClose}>Close</button>
    </div>
  </div>
)}

// NEW
import { Modal } from '@/components/ui'

<Modal
  isOpen={isOpen}
  onClose={onClose}
  title="Modal Title"
  footer={<Button onClick={onClose}>Close</Button>}
>
  <p>Content</p>
</Modal>
```

---

## 📚 Additional Resources

- Full component documentation: `/src/components/ui/README.md`
- Component source files: `/src/components/ui/`
- TypeScript definitions: Included in each component file
- Theme variables: See global CSS in your app

---

## ✅ Benefits

1. **Consistency**: All UI elements match the theme perfectly
2. **Maintainability**: Single source of truth for all components
3. **Scalability**: Easy to add features or variants
4. **Accessibility**: Built-in keyboard navigation and ARIA support
5. **Performance**: No code duplication, optimized bundle size
6. **Developer Experience**: TypeScript support, clear props, sensible defaults
7. **Theme Integration**: All components use CSS variables for easy theming

---

**Status**: ✅ All 15 component systems are complete and ready to use!
