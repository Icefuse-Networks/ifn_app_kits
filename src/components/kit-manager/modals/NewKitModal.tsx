/**
 * NewKitModal Component
 *
 * Modal dialog for creating a new kit.
 */

'use client'

import { Plus } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'

interface NewKitModalProps {
  /** Whether modal is open */
  isOpen: boolean
  /** Close modal callback */
  onClose: () => void
  /** Create kit callback */
  onCreate: () => void
  /** Kit name value */
  name: string
  /** Set kit name callback */
  setName: (name: string) => void
  /** Kit description value */
  description: string
  /** Set kit description callback */
  setDescription: (description: string) => void
}

export function NewKitModal({
  isOpen,
  onClose,
  onCreate,
  name,
  setName,
  description,
  setDescription,
}: NewKitModalProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && name.trim()) {
      onCreate()
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="New Kit"
      leftIcon={<Plus className="w-5 h-5" />}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={onCreate}
            disabled={!name.trim()}
          >
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Input
          label="Kit Name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="e.g., Daily"
          required
          autoFocus
        />
        <Input
          label="Description (optional)"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="A brief description of this kit"
        />
      </div>
    </Modal>
  )
}

export default NewKitModal
