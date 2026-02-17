/**
 * MultiplierModal Component
 *
 * Modal dialog for applying multiplier to item amounts.
 */

'use client'

import { Percent } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { NumberInput } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { CheckboxSwitch } from '@/components/ui/Switch'

interface MultiplierModalProps {
  /** Close modal callback */
  onClose: () => void
  /** Apply multiplier callback */
  onApply: () => void
  /** Multiplier value */
  value: number
  /** Set multiplier value callback */
  setValue: (value: number) => void
  /** Whether to apply to amounts */
  applyAmount: boolean
  /** Set apply to amounts callback */
  setApplyAmount: (apply: boolean) => void
  /** Skip items with amount 1 */
  skipOnes: boolean
  /** Set skip ones callback */
  setSkipOnes: (skip: boolean) => void
  /** Scope: current kit or all kits */
  scope: 'current' | 'all'
  /** Set scope callback */
  setScope: (scope: 'current' | 'all') => void
  /** Whether a kit is selected */
  hasSelectedKit: boolean
}

export function MultiplierModal({
  onClose,
  onApply,
  value,
  setValue,
  applyAmount,
  setApplyAmount,
  skipOnes,
  setSkipOnes,
  scope,
  setScope,
  hasSelectedKit,
}: MultiplierModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Multiplier"
      leftIcon={<Percent className="h-5 w-5" />}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Cancel
          </Button>
          <Button variant="primary" onClick={onApply} fullWidth>
            Apply {value}x
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Multiplier Value */}
        <NumberInput
          label="Multiplier Value"
          value={value}
          onChange={setValue}
          min={0.1}
          step={0.1}
          showControls={false}
        />

        {/* Apply To */}
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            Apply To
          </label>
          <CheckboxSwitch
            checked={applyAmount}
            onChange={setApplyAmount}
            label="Amount"
          />
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            Options
          </label>
          <CheckboxSwitch
            checked={skipOnes}
            onChange={setSkipOnes}
            label="Skip items at 1"
          />
        </div>

        {/* Scope */}
        <div>
          <label className="block text-sm text-[var(--text-secondary)] mb-2">
            Scope
          </label>
          <div className="flex gap-2">
            <Button
              variant={scope === 'current' ? 'primary' : 'secondary'}
              onClick={() => setScope('current')}
              disabled={!hasSelectedKit}
              fullWidth
            >
              Current Kit
            </Button>
            <Button
              variant={scope === 'all' ? 'primary' : 'secondary'}
              onClick={() => setScope('all')}
              fullWidth
            >
              All Kits
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default MultiplierModal
