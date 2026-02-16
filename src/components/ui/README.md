# UI Component Library

Centralized, modular, and customizable UI components for the IFN App Kits application. All components are built with theme consistency, accessibility, and flexibility in mind.

## Components

### 🔘 Button
Versatile button component with multiple variants and states.

**Variants:** `primary`, `secondary`, `success`, `error`, `warning`, `ghost`, `outline`
**Sizes:** `sm`, `md`, `lg`

```tsx
import { Button, IconButton, ButtonGroup } from '@/components/ui'

// Primary button with loading state
<Button variant="primary" loading={isLoading}>
  Save Changes
</Button>

// Button with icons
<Button leftIcon={<Plus />} rightIcon={<ChevronRight />}>
  Create New
</Button>

// Icon button
<IconButton icon={<Edit />} label="Edit" />

// Button group
<ButtonGroup>
  <Button>Option 1</Button>
  <Button>Option 2</Button>
</ButtonGroup>
```

---

### 📋 Dropdown
Custom dropdown component with search and clearable options.

```tsx
import { Dropdown } from '@/components/ui'

<Dropdown
  value={selectedValue}
  options={[
    { value: '1', label: 'Option 1', description: 'Description text', icon: <Icon /> },
    { value: '2', label: 'Option 2', disabled: true },
  ]}
  onChange={(value) => setSelectedValue(value)}
  placeholder="Select an option"
  searchable
  clearable
  error={validationError}
/>
```

---

### 📝 Input
Text, number, and textarea input components with validation and icons.

```tsx
import { Input, Textarea, NumberInput } from '@/components/ui'

// Text input with icons
<Input
  label="Email Address"
  type="email"
  placeholder="you@example.com"
  leftIcon={<Mail />}
  error={errors.email}
  required
/>

// Textarea
<Textarea
  label="Description"
  rows={4}
  resize={false}
  helperText="Max 500 characters"
/>

// Number input with controls
<NumberInput
  label="Quantity"
  value={quantity}
  onChange={setQuantity}
  min={1}
  max={100}
  showControls
/>
```

---

### 🔄 Switch
Toggle switch components (replaces checkboxes).

```tsx
import { Switch, CheckboxSwitch } from '@/components/ui'

// Toggle switch
<Switch
  checked={isEnabled}
  onChange={setIsEnabled}
  label="Enable feature"
  description="This will activate the feature"
  size="md"
  icon={<Icon />}
/>

// Checkbox-style switch
<CheckboxSwitch
  checked={agreed}
  onChange={setAgreed}
  label="I agree to the terms"
  error={errors.agreed}
/>
```

---

### 🔍 SearchInput
Search input with clear button and icon.

```tsx
import { SearchInput } from '@/components/ui'

<SearchInput
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  onClear={() => setSearchQuery('')}
  placeholder="Search items..."
  size="md"
/>
```

---

### ☑️ MultiSelect
Multi-select dropdown with checkboxes and search.

```tsx
import { MultiSelect } from '@/components/ui'

<MultiSelect
  value={selectedItems}
  options={[
    { value: '1', label: 'Item 1', icon: <Icon /> },
    { value: '2', label: 'Item 2', description: 'Description' },
  ]}
  onChange={setSelectedItems}
  placeholder="Select multiple items"
  searchable
  showSelectAll
/>
```

---

### 🪟 Modal
Modal dialog component with customizable size and footer.

```tsx
import { Modal, ConfirmModal } from '@/components/ui'

// Standard modal
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
  <p>Modal content here</p>
</Modal>

// Confirm dialog
<ConfirmModal
  isOpen={showConfirm}
  onClose={() => setShowConfirm(false)}
  onConfirm={handleDelete}
  title="Delete Item"
  description="Are you sure? This action cannot be undone."
  confirmText="Delete"
  variant="error"
  loading={isDeleting}
/>
```

---

### ⏳ Loading
Loading indicators, spinners, skeletons, and progress bars.

```tsx
import {
  Spinner,
  BorderSpinner,
  Loading,
  Skeleton,
  ProgressBar,
  DotsLoader
} from '@/components/ui'

// Icon spinner
<Spinner size="md" color="primary" />

// Border spinner
<BorderSpinner size="lg" color="success" />

// Loading with text
<Loading text="Loading data..." size="md" />

// Full screen loading overlay
<Loading fullScreen overlay text="Processing..." />

// Skeleton loader
<Skeleton width="100%" height="20px" variant="rectangular" />

// Progress bar
<ProgressBar value={75} max={100} showLabel color="primary" />

// Dots loader
<DotsLoader size="md" color="primary" />
```

---

## Theme Integration

All components use CSS variables from the global theme:

### Color Variables
- `--accent-primary` - Primary accent color
- `--text-primary` - Primary text color
- `--text-secondary` - Secondary text color
- `--text-muted` - Muted/placeholder text
- `--bg-primary` - Primary background
- `--bg-card` - Card background
- `--bg-input` - Input background
- `--border-secondary` - Border color
- `--glass-bg` - Glass morphism background
- `--glass-border` - Glass morphism border
- `--status-success` - Success state color
- `--status-error` - Error state color
- `--status-warning` - Warning state color

### Using Custom Colors
Components support theme variables through the `style` prop:

```tsx
<Button
  style={{
    background: 'var(--custom-color)',
    border: '1px solid var(--custom-border)',
  }}
>
  Custom Styled Button
</Button>
```

---

## Accessibility

All components include:
- Keyboard navigation support (Tab, Enter, Escape)
- Focus indicators with `focus:ring-2`
- ARIA labels where appropriate
- Screen reader support with `sr-only` class
- Disabled state handling
- Semantic HTML elements

---

## Props Reference

### Common Props (shared across components)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | `''` | Additional CSS classes |
| `disabled` | `boolean` | `false` | Disable the component |
| `error` | `string` | - | Error message to display |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Component size |

---

## Best Practices

1. **Always use these centralized components** instead of creating inline UI elements
2. **Leverage variants** for different use cases (primary, secondary, error, etc.)
3. **Provide labels and descriptions** for better UX
4. **Handle loading states** with the `loading` prop
5. **Use error prop** for validation feedback
6. **Maintain theme consistency** by using theme variables
7. **Prefer Switch over Checkbox** for toggle actions
8. **Use SearchInput** for all search functionality
9. **Use MultiSelect** for multiple selections instead of multiple checkboxes

---

## Migration Guide

### From Old Components to New

```tsx
// OLD: Inline select element
<select value={value} onChange={onChange}>
  <option value="1">Option 1</option>
</select>

// NEW: Dropdown component
<Dropdown
  value={value}
  options={[{ value: '1', label: 'Option 1' }]}
  onChange={onChange}
/>

// OLD: Inline checkbox
<input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />

// NEW: Switch component
<Switch checked={checked} onChange={setChecked} label="Option" />

// OLD: Custom loading div
<div className="spinner">Loading...</div>

// NEW: Loading component
<Loading text="Loading..." />
```

---

## Examples

See the existing implementations in:
- `/src/components/kit-manager/` - Original implementations
- `/src/components/loot-shared/` - Loot table implementations

Replace these with the centralized components from `/src/components/ui/`.
