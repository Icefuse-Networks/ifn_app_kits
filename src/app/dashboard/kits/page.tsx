'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import Link from 'next/link'
import {
  Package,
  Plus,
  ArrowLeft,
  Save,
  Trash2,
  Copy,
  Edit3,
  Percent,
  Undo2,
  Redo2,
  Download,
  Upload,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  AlertCircle,
  Check,
  Paintbrush,
  Zap,
  Tags,
} from 'lucide-react'

import { useUndoRedo, useSkinImages } from '@/hooks'
import {
  RustInventory,
  ItemBrowser,
  ItemEditor,
  ItemEditorEmpty,
  CategorySelector,
  VisibilityDropdown,
  CategoryDropdown,
  type ItemSlot,
  type CategorySummary,
} from '@/components/kit-manager'
import {
  NewKitModal,
  SaveModal,
  RenameModal,
  MultiplierModal,
  CategoryRenameModal,
  UnsavedChangesModal,
} from '@/components/kit-manager/modals'
import type { Kit, KitItem, KitsData } from '@/types/kit'
import {
  createEmptyKit,
  createEmptyItem,
  parseKitData,
  stringifyKitData,
} from '@/lib/utils/kit'
import { id as idGen } from '@/lib/id'

// =============================================================================
// Types
// =============================================================================

interface SavedConfig {
  id: string
  name: string
  description: string | null
  kitData: KitsData
  updatedAt: string
}

interface Selection {
  slot: ItemSlot
  index: number
}

type ModalType = 'new' | 'save' | 'rename' | 'multiplier' | 'categoryRename' | 'unsavedChanges' | null

// =============================================================================
// Page Component
// =============================================================================

export default function KitsPage() {
  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------

  const {
    current: kitsData,
    setState: setKitsData,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useUndoRedo<KitsData>({ _kits: {} })

  // UI state
  const [selectedKitId, setSelectedKitId] = useState<string | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [kitSearch, setKitSearch] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [itemBrowserCollapsed, setItemBrowserCollapsed] = useState(true)
  const [activeModal, setActiveModal] = useState<ModalType>(null)
  const [loading, setLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)
  const [showSkins, setShowSkins] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authError, setAuthError] = useState<{
    status: number
    message: string
  } | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // API state
  const [savedConfigs, setSavedConfigs] = useState<SavedConfig[]>([])
  const [loadedConfigId, setLoadedConfigId] = useState<string | null>(null)
  const initialLoadDone = useRef(false)

  // Category switching state
  const [pendingSwitchId, setPendingSwitchId] = useState<string | null>(null)
  const [saveModalMode, setSaveModalMode] = useState<'save' | 'newCategory'>('save')

  // Modal form state
  const [newKitName, setNewKitName] = useState('')
  const [newKitDescription, setNewKitDescription] = useState('')
  const [saveName, setSaveName] = useState('')
  const [saveDescription, setSaveDescription] = useState('')
  const [renameValue, setRenameValue] = useState('')

  // Multiplier state
  const [multiplierValue, setMultiplierValue] = useState(2)
  const [multiplierApplyAmount, setMultiplierApplyAmount] = useState(true)
  const [multiplierSkipOnes, setMultiplierSkipOnes] = useState(false)
  const [multiplierScope, setMultiplierScope] = useState<'current' | 'all'>(
    'current'
  )

  // Kit ID copy state
  const [copiedKitId, setCopiedKitId] = useState(false)

  // Kit drag state for reordering
  const [draggedKitId, setDraggedKitId] = useState<string | null>(null)
  const [dragOverKitId, setDragOverKitId] = useState<string | null>(null)
  // Category drop target: "cat:categoryId" or "sub:categoryId:subcategoryId" or "uncategorized"
  const [dragOverCategoryTarget, setDragOverCategoryTarget] = useState<string | null>(null)

  // Kit view tab state (Default Kits vs Auto Kits)
  const [kitViewTab, setKitViewTab] = useState<'default' | 'auto'>('default')

  // Subcategory collapse state (collapsed by default)
  const [collapsedSubcategories, setCollapsedSubcategories] = useState<Set<string>>(new Set())
  const [subcategoryCollapsedInitialized, setSubcategoryCollapsedInitialized] = useState(false)

  // ---------------------------------------------------------------------------
  // Derived State
  // ---------------------------------------------------------------------------

  const kitList = useMemo(
    () =>
      Object.entries(kitsData._kits || {})
        .map(([id, kit]) => ({ id, kit }))
        .sort((a, b) => (a.kit.Order ?? 0) - (b.kit.Order ?? 0)),
    [kitsData]
  )

  const filteredKitList = useMemo(() => {
    // First filter by tab (default vs auto)
    const tabFiltered = kitList.filter(({ kit }) => {
      const isAutoKit = kit.IsAutoKit ?? false
      return kitViewTab === 'auto' ? isAutoKit : !isAutoKit
    })

    // Then filter by search
    if (!kitSearch.trim()) return tabFiltered
    const q = kitSearch.toLowerCase()
    return tabFiltered.filter(
      ({ id, kit }) =>
        id.toLowerCase().includes(q) ||
        kit.Name.toLowerCase().includes(q) ||
        kit.Description.toLowerCase().includes(q)
    )
  }, [kitList, kitSearch, kitViewTab])

  const selectedKit = useMemo(() => {
    if (!selectedKitId) return null
    return kitsData._kits[selectedKitId] || null
  }, [kitsData, selectedKitId])

  const selectedItem = useMemo(() => {
    if (!selectedKit || !selection) return null
    const items = selectedKit[selection.slot] as KitItem[]
    return items[selection.index] || null
  }, [selectedKit, selection])

  // Category-related derived state
  const activeCategory = useMemo(() => {
    if (!loadedConfigId) return null
    return savedConfigs.find((c) => c.id === loadedConfigId) ?? null
  }, [savedConfigs, loadedConfigId])

  const categorySummaries = useMemo<CategorySummary[]>(
    () =>
      savedConfigs.map((c) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        kitCount: Object.keys(c.kitData?._kits || {}).length,
        updatedAt: c.updatedAt,
      })),
    [savedConfigs]
  )

  // Skin image resolution
  const skinImages = useSkinImages(selectedKit, showSkins)

  // Categories from kitsData
  const categories = useMemo(() => kitsData._categories || {}, [kitsData])

  // Sorted category list
  const sortedCategories = useMemo(() => {
    return Object.entries(categories)
      .map(([id, cat]) => ({ id, ...cat }))
      .sort((a, b) => a.order - b.order)
  }, [categories])

  // Group filtered kits by category/subcategory
  const kitsByCategory = useMemo(() => {
    const grouped: Record<string, Record<string, { id: string; kit: Kit }[]>> = {}
    const uncategorized: { id: string; kit: Kit }[] = []

    filteredKitList.forEach(({ id, kit }) => {
      const catId = kit.Category
      const subId = kit.Subcategory

      if (!catId) {
        uncategorized.push({ id, kit })
      } else {
        if (!grouped[catId]) grouped[catId] = {}
        const subKey = subId || '_root'
        if (!grouped[catId][subKey]) grouped[catId][subKey] = []
        grouped[catId][subKey].push({ id, kit })
      }
    })

    return { grouped, uncategorized }
  }, [filteredKitList])

  // Initialize categories and subcategories as collapsed by default
  useEffect(() => {
    if (!subcategoryCollapsedInitialized && sortedCategories.length > 0) {
      const allIds = new Set<string>()
      sortedCategories.forEach((cat) => {
        allIds.add(cat.id)
        Object.keys(cat.subcategories || {}).forEach((subId) => {
          allIds.add(`${cat.id}:${subId}`)
        })
      })
      setCollapsedSubcategories(allIds)
      setSubcategoryCollapsedInitialized(true)
    }
  }, [sortedCategories, subcategoryCollapsedInitialized])

  // Toggle category/subcategory collapse
  const toggleCollapse = useCallback((id: string) => {
    setCollapsedSubcategories((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------

  const fetchConfigs = useCallback(async () => {
    try {
      setInitialLoading(true)
      setAuthError(null)
      const res = await fetch('/api/v1/kits?full=true')

      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: 'Unknown error' }))

        if (res.status === 401) {
          setAuthError({
            status: 401,
            message: data.error || 'Authentication required',
          })
          return
        }
        if (res.status === 403) {
          setAuthError({
            status: 403,
            message: data.error || 'Admin access required',
          })
          return
        }
        if (res.status === 404) {
          setSavedConfigs([])
          return
        }

        console.warn(
          'Kit configs API unavailable:',
          data.error || res.status,
          data.details || ''
        )
        setSavedConfigs([])
        return
      }

      const data = await res.json()
      const configs: SavedConfig[] = data.map(
        (config: {
          id: string
          name: string
          description: string | null
          kitData: string | object
          updatedAt: string
        }) => ({
          ...config,
          kitData: typeof config.kitData === 'string'
            ? parseKitData(config.kitData)
            : config.kitData,
        })
      )
      setSavedConfigs(configs)

      // Auto-load the most recently updated config on initial load
      if (configs.length > 0 && !initialLoadDone.current) {
        initialLoadDone.current = true
        const mostRecent = [...configs].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )[0]
        resetHistory(mostRecent.kitData)
        setLoadedConfigId(mostRecent.id)
      }
    } catch (err) {
      console.warn(
        'Kit configs fetch failed (API may not be deployed yet):',
        err
      )
      setSavedConfigs([])
    } finally {
      setInitialLoading(false)
    }
  }, [resetHistory])

  const loadConfig = useCallback(
    async (id: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/kits/${id}`)
        if (!res.ok) throw new Error('Failed to load configuration')
        const data = await res.json()
        const parsed = parseKitData(data.kitData)
        resetHistory(parsed)
        setLoadedConfigId(id)
        setSelectedKitId(null)
        setSelection(null)
        setSuccess(`Loaded "${data.name}"`)
        setActiveModal(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoading(false)
      }
    },
    [resetHistory]
  )

  const saveConfig = useCallback(
    async (name: string, description: string) => {
      setLoading(true)
      setError(null)
      try {
        const method = loadedConfigId ? 'PUT' : 'POST'
        const url = loadedConfigId
          ? `/api/v1/kits/${loadedConfigId}`
          : '/api/v1/kits'
        const res = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: description || null,
            kitData: stringifyKitData(kitsData),
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to save')
        }
        const data = await res.json()
        setLoadedConfigId(data.id)
        setSuccess(`Saved "${name}"`)
        setActiveModal(null)
        fetchConfigs()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save')
      } finally {
        setLoading(false)
      }
    },
    [kitsData, loadedConfigId, fetchConfigs]
  )

  // ---------------------------------------------------------------------------
  // Category Management
  // ---------------------------------------------------------------------------

  const switchCategory = useCallback(
    (targetId: string) => {
      if (targetId === loadedConfigId) return

      // Check for unsaved changes
      if (canUndo && loadedConfigId && activeCategory) {
        setPendingSwitchId(targetId)
        setActiveModal('unsavedChanges')
        return
      }

      loadConfig(targetId)
    },
    [loadedConfigId, canUndo, activeCategory, loadConfig]
  )

  const handleUnsavedDiscard = useCallback(() => {
    if (pendingSwitchId) {
      loadConfig(pendingSwitchId)
      setPendingSwitchId(null)
      setActiveModal(null)
    }
  }, [pendingSwitchId, loadConfig])

  const handleUnsavedSave = useCallback(async () => {
    if (loadedConfigId && activeCategory) {
      await saveConfig(activeCategory.name, activeCategory.description || '')
      if (pendingSwitchId) {
        loadConfig(pendingSwitchId)
        setPendingSwitchId(null)
      }
      setActiveModal(null)
    }
  }, [loadedConfigId, activeCategory, saveConfig, pendingSwitchId, loadConfig])

  const renameCategory = useCallback(
    async (newName: string, newDescription: string) => {
      if (!loadedConfigId) return
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/v1/kits/${loadedConfigId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName, description: newDescription || null }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to update category')
        }
        setSuccess(`Category updated`)
        setActiveModal(null)
        fetchConfigs()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update')
      } finally {
        setLoading(false)
      }
    },
    [loadedConfigId, fetchConfigs]
  )

  const duplicateCategory = useCallback(async () => {
    if (!loadedConfigId || !activeCategory) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/kits/${loadedConfigId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${activeCategory.name} (Copy)`,
          description: activeCategory.description,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to duplicate category')
      }
      const data = await res.json()
      setSuccess(`Duplicated as "${data.name}"`)
      await fetchConfigs()
      resetHistory(data.kitData)
      setLoadedConfigId(data.id)
      setSelectedKitId(null)
      setSelection(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to duplicate')
    } finally {
      setLoading(false)
    }
  }, [loadedConfigId, activeCategory, fetchConfigs, resetHistory])

  const createCategory = useCallback(
    async (name: string, description: string) => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/v1/kits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            description: description || null,
            kitData: JSON.stringify({ _kits: {} }),
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create category')
        }
        const data = await res.json()
        setSuccess(`Created category "${name}"`)
        setActiveModal(null)
        setSaveName('')
        setSaveDescription('')
        await fetchConfigs()
        resetHistory(data.kitData)
        setLoadedConfigId(data.id)
        setSelectedKitId(null)
        setSelection(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create')
      } finally {
        setLoading(false)
      }
    },
    [fetchConfigs, resetHistory]
  )

  const deleteCategoryHandler = useCallback(async () => {
    if (!loadedConfigId) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/kits/${loadedConfigId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete category')
      setLoadedConfigId(null)
      setSelectedKitId(null)
      setSelection(null)
      resetHistory({ _kits: {} })
      setSuccess('Category deleted')
      fetchConfigs()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setLoading(false)
    }
  }, [loadedConfigId, fetchConfigs, resetHistory])

  // ---------------------------------------------------------------------------
  // Kit CRUD
  // ---------------------------------------------------------------------------

  // Calculate the next available order number
  const getNextOrder = useCallback(() => {
    const kits = Object.values(kitsData._kits || {})
    if (kits.length === 0) return 0
    return Math.max(...kits.map((k) => k.Order ?? 0)) + 1
  }, [kitsData])

  const createKit = useCallback(
    (name: string, description: string) => {
      const nextOrder = getNextOrder()
      const kit = createEmptyKit(name, description, nextOrder)
      // Set IsAutoKit based on current tab view
      kit.IsAutoKit = kitViewTab === 'auto'
      const kitId = idGen.kit()
      setKitsData({
        ...kitsData,
        _kits: { ...kitsData._kits, [kitId]: kit },
      })
      setSelectedKitId(kitId)
      setActiveModal(null)
      setNewKitName('')
      setNewKitDescription('')
    },
    [kitsData, setKitsData, getNextOrder, kitViewTab]
  )

  const deleteKit = useCallback(
    (id: string) => {
      const newKits = { ...kitsData._kits }
      delete newKits[id]
      setKitsData({ ...kitsData, _kits: newKits })
      if (selectedKitId === id) {
        setSelectedKitId(null)
        setSelection(null)
      }
    },
    [kitsData, setKitsData, selectedKitId]
  )

  const duplicateKit = useCallback(
    (id: string) => {
      const original = kitsData._kits[id]
      if (!original) return
      const newId = idGen.kit()
      const nextOrder = getNextOrder()
      const newKit = {
        ...JSON.parse(JSON.stringify(original)),
        Name: `${original.Name} (Copy)`,
        Order: nextOrder,
      }
      setKitsData({
        ...kitsData,
        _kits: { ...kitsData._kits, [newId]: newKit },
      })
      setSelectedKitId(newId)
    },
    [kitsData, setKitsData, getNextOrder]
  )

  // Drag and drop reordering
  const handleKitDragStart = useCallback(
    (e: React.DragEvent, kitId: string) => {
      setDraggedKitId(kitId)
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', kitId)
    },
    []
  )

  const handleKitDragOver = useCallback(
    (e: React.DragEvent, kitId: string) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (kitId !== draggedKitId) {
        setDragOverKitId(kitId)
      }
    },
    [draggedKitId]
  )

  const handleKitDragLeave = useCallback(() => {
    setDragOverKitId(null)
  }, [])

  const handleKitDrop = useCallback(
    (e: React.DragEvent, targetKitId: string) => {
      e.preventDefault()
      setDragOverKitId(null)

      if (!draggedKitId || draggedKitId === targetKitId) {
        setDraggedKitId(null)
        return
      }

      const sortedKits = Object.entries(kitsData._kits || {})
        .map(([id, kit]) => ({ id, kit }))
        .sort((a, b) => (a.kit.Order ?? 0) - (b.kit.Order ?? 0))

      const draggedIndex = sortedKits.findIndex((k) => k.id === draggedKitId)
      const targetIndex = sortedKits.findIndex((k) => k.id === targetKitId)

      if (draggedIndex < 0 || targetIndex < 0) {
        setDraggedKitId(null)
        return
      }

      // Reorder: remove dragged item and insert at target position
      const newOrder = [...sortedKits]
      const [draggedItem] = newOrder.splice(draggedIndex, 1)
      newOrder.splice(targetIndex, 0, draggedItem)

      // Reassign order values based on new positions
      const newKits = { ...kitsData._kits }
      newOrder.forEach((item, idx) => {
        newKits[item.id] = { ...item.kit, Order: idx }
      })

      setKitsData({ ...kitsData, _kits: newKits })
      setDraggedKitId(null)
    },
    [draggedKitId, kitsData, setKitsData]
  )

  const handleKitDragEnd = useCallback(() => {
    setDraggedKitId(null)
    setDragOverKitId(null)
    setDragOverCategoryTarget(null)
  }, [])

  // Category drag over/leave handlers (drop handler below after assignKitToCategory)
  const handleCategoryDragOver = useCallback(
    (e: React.DragEvent, target: string) => {
      if (!draggedKitId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDragOverCategoryTarget(target)
    },
    [draggedKitId]
  )

  const handleCategoryDragLeave = useCallback(() => {
    setDragOverCategoryTarget(null)
  }, [])

  const renameKit = useCallback(
    (kitId: string, newName: string) => {
      const kit = kitsData._kits[kitId]
      if (!kit) return
      // Keep the same ID, just update the Name property
      setKitsData({
        ...kitsData,
        _kits: {
          ...kitsData._kits,
          [kitId]: { ...kit, Name: newName },
        },
      })
      setActiveModal(null)
      setRenameValue('')
    },
    [kitsData, setKitsData]
  )

  const moveKitToCategory = useCallback(
    async (kitId: string, targetCategoryId: string, newName?: string) => {
      if (!loadedConfigId) return
      const kit = kitsData._kits[kitId]
      if (!kit) return

      setLoading(true)
      setError(null)
      try {
        // Fetch target category data
        const targetRes = await fetch(`/api/v1/kits/${targetCategoryId}`)
        if (!targetRes.ok) throw new Error('Failed to load target category')
        const targetData = await targetRes.json()
        const targetKitData = parseKitData(targetData.kitData)

        // Generate a new kit ID for the target category
        const targetKitId = idGen.kit()

        // Deep copy kit, optionally with new name
        const movedKit = JSON.parse(JSON.stringify(kit))
        if (newName) {
          movedKit.Name = newName
        }

        // Add kit to target category
        targetKitData._kits[targetKitId] = movedKit

        // Remove kit from current category
        const updatedKits = { ...kitsData._kits }
        delete updatedKits[kitId]
        const updatedCurrentData = { ...kitsData, _kits: updatedKits }

        // PERF: Parallel queries — save both categories simultaneously
        const [sourceRes, destRes] = await Promise.all([
          fetch(`/api/v1/kits/${loadedConfigId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kitData: stringifyKitData(updatedCurrentData) }),
          }),
          fetch(`/api/v1/kits/${targetCategoryId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ kitData: stringifyKitData(targetKitData) }),
          }),
        ])

        if (!sourceRes.ok || !destRes.ok) {
          throw new Error('Failed to move kit between categories')
        }

        // Update local state
        setKitsData(updatedCurrentData)
        resetHistory(updatedCurrentData)
        if (selectedKitId === kitId) {
          setSelectedKitId(null)
          setSelection(null)
        }
        setSuccess(`Moved "${newName || kit.Name}" to "${targetData.name}"`)
        setActiveModal(null)
        setRenameValue('')
        fetchConfigs()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to move kit')
      } finally {
        setLoading(false)
      }
    },
    [kitsData, loadedConfigId, setKitsData, resetHistory, selectedKitId, fetchConfigs]
  )

  const updateKit = useCallback(
    (id: string, updates: Partial<Kit>) => {
      const kit = kitsData._kits[id]
      if (!kit) return
      setKitsData({
        ...kitsData,
        _kits: { ...kitsData._kits, [id]: { ...kit, ...updates } },
      })
    },
    [kitsData, setKitsData]
  )

  // ---------------------------------------------------------------------------
  // Kit Category Management (UI categories within the kit data)
  // ---------------------------------------------------------------------------

  const createKitCategory = useCallback(
    (name: string) => {
      const categoryId = idGen.uiCategory()
      const order = sortedCategories.length
      setKitsData({
        ...kitsData,
        _categories: {
          ...(kitsData._categories || {}),
          [categoryId]: { name, order, subcategories: {} },
        },
      })
      return categoryId
    },
    [kitsData, setKitsData, sortedCategories.length]
  )

  const renameKitCategory = useCallback(
    (categoryId: string, name: string) => {
      const cat = kitsData._categories?.[categoryId]
      if (!cat) return
      setKitsData({
        ...kitsData,
        _categories: {
          ...kitsData._categories,
          [categoryId]: { ...cat, name },
        },
      })
    },
    [kitsData, setKitsData]
  )

  const deleteKitCategory = useCallback(
    (categoryId: string) => {
      const newCategories = { ...(kitsData._categories || {}) }
      delete newCategories[categoryId]

      // Also remove category assignment from kits
      const newKits = { ...kitsData._kits }
      Object.entries(newKits).forEach(([id, kit]) => {
        if (kit.Category === categoryId) {
          newKits[id] = { ...kit, Category: undefined, Subcategory: undefined }
        }
      })

      setKitsData({
        ...kitsData,
        _categories: newCategories,
        _kits: newKits,
      })
    },
    [kitsData, setKitsData]
  )

  const createKitSubcategory = useCallback(
    (categoryId: string, name: string) => {
      const cat = kitsData._categories?.[categoryId]
      if (!cat) return
      const subcategoryId = idGen.uiSubcategory()
      const order = Object.keys(cat.subcategories || {}).length
      setKitsData({
        ...kitsData,
        _categories: {
          ...kitsData._categories,
          [categoryId]: {
            ...cat,
            subcategories: {
              ...(cat.subcategories || {}),
              [subcategoryId]: { name, order },
            },
          },
        },
      })
      return subcategoryId
    },
    [kitsData, setKitsData]
  )

  const renameKitSubcategory = useCallback(
    (categoryId: string, subcategoryId: string, name: string) => {
      const cat = kitsData._categories?.[categoryId]
      const sub = cat?.subcategories?.[subcategoryId]
      if (!cat || !sub) return
      setKitsData({
        ...kitsData,
        _categories: {
          ...kitsData._categories,
          [categoryId]: {
            ...cat,
            subcategories: {
              ...cat.subcategories,
              [subcategoryId]: { ...sub, name },
            },
          },
        },
      })
    },
    [kitsData, setKitsData]
  )

  const deleteKitSubcategory = useCallback(
    (categoryId: string, subcategoryId: string) => {
      const cat = kitsData._categories?.[categoryId]
      if (!cat) return
      const newSubcategories = { ...(cat.subcategories || {}) }
      delete newSubcategories[subcategoryId]

      // Also remove subcategory assignment from kits
      const newKits = { ...kitsData._kits }
      Object.entries(newKits).forEach(([id, kit]) => {
        if (kit.Category === categoryId && kit.Subcategory === subcategoryId) {
          newKits[id] = { ...kit, Subcategory: undefined }
        }
      })

      setKitsData({
        ...kitsData,
        _categories: {
          ...kitsData._categories,
          [categoryId]: { ...cat, subcategories: newSubcategories },
        },
        _kits: newKits,
      })
    },
    [kitsData, setKitsData]
  )

  const assignKitToCategory = useCallback(
    (kitId: string, categoryId: string | undefined, subcategoryId: string | undefined) => {
      const kit = kitsData._kits[kitId]
      if (!kit) return
      setKitsData({
        ...kitsData,
        _kits: {
          ...kitsData._kits,
          [kitId]: { ...kit, Category: categoryId, Subcategory: subcategoryId },
        },
      })
    },
    [kitsData, setKitsData]
  )

  // Category drop handler (uses assignKitToCategory)
  const handleCategoryDrop = useCallback(
    (e: React.DragEvent, target: string) => {
      e.preventDefault()
      setDragOverCategoryTarget(null)

      if (!draggedKitId) return

      // Parse target: "uncategorized", "cat:categoryId", or "sub:categoryId:subcategoryId"
      let categoryId: string | undefined
      let subcategoryId: string | undefined

      if (target === 'uncategorized') {
        categoryId = undefined
        subcategoryId = undefined
      } else if (target.startsWith('cat:')) {
        categoryId = target.slice(4)
        subcategoryId = undefined
      } else if (target.startsWith('sub:')) {
        const parts = target.slice(4).split(':')
        categoryId = parts[0]
        subcategoryId = parts[1]
      }

      assignKitToCategory(draggedKitId, categoryId, subcategoryId)
      setDraggedKitId(null)
    },
    [draggedKitId, assignKitToCategory]
  )

  // ---------------------------------------------------------------------------
  // Item Management
  // ---------------------------------------------------------------------------

  const addItemToKit = useCallback(
    (shortname: string) => {
      if (!selectedKitId || !selectedKit) return

      const mainItems = [...selectedKit.MainItems]
      const usedPositions = new Set(mainItems.map((item) => item.Position))
      let position = 0
      for (let i = 0; i < 24; i++) {
        if (!usedPositions.has(i)) {
          position = i
          break
        }
      }

      const newItem = createEmptyItem(shortname, position)
      mainItems.push(newItem)
      updateKit(selectedKitId, { MainItems: mainItems })
      setSelection({ slot: 'MainItems', index: mainItems.length - 1 })
    },
    [selectedKitId, selectedKit, updateKit]
  )

  const updateSelectedItem = useCallback(
    (updates: Partial<KitItem>) => {
      if (!selectedKitId || !selectedKit || !selection) return
      const items = [...(selectedKit[selection.slot] as KitItem[])]
      const item = items[selection.index]
      if (!item) return
      items[selection.index] = { ...item, ...updates }
      updateKit(selectedKitId, { [selection.slot]: items })
    },
    [selectedKitId, selectedKit, selection, updateKit]
  )

  const deleteSelectedItem = useCallback(() => {
    if (!selectedKitId || !selectedKit || !selection) return
    const items = [...(selectedKit[selection.slot] as KitItem[])]
    items.splice(selection.index, 1)
    updateKit(selectedKitId, { [selection.slot]: items })
    setSelection(null)
  }, [selectedKitId, selectedKit, selection, updateKit])

  const handleItemDrop = useCallback(
    (
      fromSlot: ItemSlot,
      fromIndex: number,
      toSlot: ItemSlot,
      toPosition: number
    ) => {
      if (!selectedKitId || !selectedKit) return

      const fromItems = [...(selectedKit[fromSlot] as KitItem[])]
      const toItems =
        fromSlot === toSlot
          ? fromItems
          : [...(selectedKit[toSlot] as KitItem[])]

      const item = fromItems[fromIndex]
      if (!item) return

      fromItems.splice(fromIndex, 1)
      const updatedItem = { ...item, Position: toPosition }

      const existingIndex = toItems.findIndex(
        (i) => i.Position === toPosition
      )
      if (existingIndex !== -1) {
        toItems[existingIndex] = {
          ...toItems[existingIndex],
          Position: item.Position,
        }
      }

      if (fromSlot === toSlot) {
        fromItems.push(updatedItem)
        updateKit(selectedKitId, { [fromSlot]: fromItems })
      } else {
        toItems.push(updatedItem)
        updateKit(selectedKitId, {
          [fromSlot]: fromItems,
          [toSlot]: toItems,
        })
      }
    },
    [selectedKitId, selectedKit, updateKit]
  )

  // ---------------------------------------------------------------------------
  // External Drop (from ItemBrowser drag)
  // ---------------------------------------------------------------------------

  const handleExternalDrop = useCallback(
    (shortname: string, slot: ItemSlot, position: number) => {
      if (!selectedKitId || !selectedKit) return
      const items = [...(selectedKit[slot] as KitItem[])]
      const newItem = createEmptyItem(shortname, position)

      // Replace item at same position if one exists
      const existingIdx = items.findIndex((i) => i.Position === position)
      if (existingIdx !== -1) {
        items[existingIdx] = newItem
      } else {
        items.push(newItem)
      }

      updateKit(selectedKitId, { [slot]: items })
      // Don't change selection — keep ItemBrowser open
    },
    [selectedKitId, selectedKit, updateKit]
  )

  // ---------------------------------------------------------------------------
  // Context Menu
  // ---------------------------------------------------------------------------

  const [contextMenu, setContextMenu] = useState<{
    slot: ItemSlot
    index: number
    x: number
    y: number
  } | null>(null)

  const handleContextMenu = useCallback(
    (slot: ItemSlot, index: number, x: number, y: number) => {
      setContextMenu({ slot, index, x, y })
    },
    []
  )

  const handleContextMenuDelete = useCallback(() => {
    if (!selectedKitId || !selectedKit || !contextMenu) return
    const items = [...(selectedKit[contextMenu.slot] as KitItem[])]
    items.splice(contextMenu.index, 1)
    updateKit(selectedKitId, { [contextMenu.slot]: items })
    if (
      selection?.slot === contextMenu.slot &&
      selection?.index === contextMenu.index
    ) {
      setSelection(null)
    }
    setContextMenu(null)
  }, [selectedKitId, selectedKit, contextMenu, selection, updateKit])

  const copyKitIdToClipboard = useCallback(async () => {
    if (!selectedKitId) return
    try {
      await navigator.clipboard.writeText(selectedKitId)
      setCopiedKitId(true)
      setTimeout(() => setCopiedKitId(false), 2000)
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea')
      textArea.value = selectedKitId
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopiedKitId(true)
      setTimeout(() => setCopiedKitId(false), 2000)
    }
  }, [selectedKitId])

  // Close context menu on click anywhere or Escape
  useEffect(() => {
    if (!contextMenu) return
    const close = () => setContextMenu(null)
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', handleKey)
    return () => {
      window.removeEventListener('click', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', handleKey)
    }
  }, [contextMenu])

  // ---------------------------------------------------------------------------
  // Multiplier
  // ---------------------------------------------------------------------------

  const applyMultiplier = useCallback(() => {
    const applyToKit = (kit: Kit): Kit => {
      const multiplyItems = (items: KitItem[]): KitItem[] =>
        items.map((item) => {
          if (multiplierSkipOnes && item.Amount === 1) return item
          return {
            ...item,
            Amount: multiplierApplyAmount
              ? Math.round(item.Amount * multiplierValue)
              : item.Amount,
          }
        })

      return {
        ...kit,
        MainItems: multiplyItems(kit.MainItems),
        WearItems: multiplyItems(kit.WearItems),
        BeltItems: multiplyItems(kit.BeltItems),
      }
    }

    if (multiplierScope === 'current' && selectedKitId) {
      const kit = kitsData._kits[selectedKitId]
      if (kit) updateKit(selectedKitId, applyToKit(kit))
    } else {
      const newKits = { ...kitsData._kits }
      Object.keys(newKits).forEach((id) => {
        newKits[id] = applyToKit(newKits[id])
      })
      setKitsData({ ...kitsData, _kits: newKits })
    }

    setActiveModal(null)
    setSuccess(`Applied ${multiplierValue}x multiplier`)
  }, [
    kitsData,
    setKitsData,
    selectedKitId,
    updateKit,
    multiplierValue,
    multiplierApplyAmount,
    multiplierSkipOnes,
    multiplierScope,
  ])

  // ---------------------------------------------------------------------------
  // Import / Export
  // ---------------------------------------------------------------------------

  const exportToFile = useCallback(() => {
    const json = stringifyKitData(kitsData)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'Kits.json'
    a.click()
    URL.revokeObjectURL(url)
    setSuccess('Exported Kits.json')
  }, [kitsData])

  const importFromFile = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = parseKitData(text)
        resetHistory(data)
        setSelectedKitId(null)
        setSelection(null)
        setLoadedConfigId(null)
        setSuccess(
          `Imported ${Object.keys(data._kits || {}).length} kits`
        )
      } catch {
        setError('Invalid kit file format')
      }
    }
    input.click()
  }, [resetHistory])

  // ---------------------------------------------------------------------------
  // Effects
  // ---------------------------------------------------------------------------

  useEffect(() => {
    fetchConfigs()
  }, [fetchConfigs])

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [success])

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  // Auto-load first available category when current one is deleted
  useEffect(() => {
    if (initialLoading) return
    if (!loadedConfigId && savedConfigs.length > 0) {
      const mostRecent = [...savedConfigs].sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0]
      loadConfig(mostRecent.id)
    }
  }, [loadedConfigId, savedConfigs, initialLoading, loadConfig])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey && canUndo) {
          e.preventDefault()
          undo()
        }
        if ((e.key === 'y' || (e.key === 'z' && e.shiftKey)) && canRedo) {
          e.preventDefault()
          redo()
        }
        if (e.key === 's') {
          e.preventDefault()
          if (loadedConfigId) {
            const config = savedConfigs.find(
              (c) => c.id === loadedConfigId
            )
            if (config) {
              saveConfig(config.name, config.description || '')
              return
            }
          }
          setSaveName('')
          setSaveDescription('')
          setSaveModalMode('save')
          setActiveModal('save')
        }
      }
      if (e.key === 'Delete' && selection) {
        deleteSelectedItem()
      }
      if (e.key === 'Escape') {
        setSelection(null)
        setActiveModal(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, undo, redo, selection, deleteSelectedItem, loadedConfigId, savedConfigs, saveConfig])

  // ---------------------------------------------------------------------------
  // Render: Header
  // ---------------------------------------------------------------------------

  const renderHeader = () => (
    <header
      className="h-14 flex items-center justify-between px-4 shrink-0"
      style={{
        background: 'rgba(255, 255, 255, 0.04)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      {/* Left: Back + Title */}
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard"
          className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <ArrowLeft className="w-4 h-4 text-[var(--text-secondary)]" />
        </Link>
        <div>
          <h1 className="text-base font-bold text-[var(--text-primary)]">
            Kit Manager
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {activeCategory ? activeCategory.name : 'No category'}
            {' \u00B7 '}
            {kitList.length} kit{kitList.length !== 1 ? 's' : ''}
            {loadedConfigId && canUndo && ' \u00B7 Unsaved'}
          </p>
        </div>
      </div>

      {/* Right: Toolbar */}
      <div className="flex items-center gap-2">
        {/* Undo / Redo */}
        <div className="flex items-center gap-1 mr-2">
          <ToolbarButton
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4" />
          </ToolbarButton>
          <ToolbarButton
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="w-4 h-4" />
          </ToolbarButton>
        </div>

        {/* Import / Export */}
        <ToolbarButton onClick={importFromFile} title="Import from file">
          <Upload className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={exportToFile} title="Export to file">
          <Download className="w-4 h-4" />
        </ToolbarButton>

        {/* Multiplier */}
        <ToolbarButton
          onClick={() => setActiveModal('multiplier')}
          title="Apply multiplier"
        >
          <Percent className="w-4 h-4" />
        </ToolbarButton>

        {/* Save As */}
        <button
          onClick={() => {
            setSaveName('')
            setSaveDescription('')
            setSaveModalMode('save')
            setActiveModal('save')
          }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--glass-border)',
          }}
        >
          <span className="text-sm text-[var(--text-primary)]">Save As</span>
        </button>

        {/* Save */}
        <button
          onClick={() => {
            if (loadedConfigId) {
              const config = savedConfigs.find(
                (c) => c.id === loadedConfigId
              )
              if (config) {
                saveConfig(config.name, config.description || '')
                return
              }
            }
            setSaveName('')
            setSaveDescription('')
            setActiveModal('save')
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-white"
          style={{ background: 'var(--accent-primary)' }}
        >
          <Save className="w-4 h-4" />
          <span className="text-sm">Save</span>
        </button>
      </div>
    </header>
  )

  // ---------------------------------------------------------------------------
  // Render: Messages
  // ---------------------------------------------------------------------------

  const renderMessages = () => {
    if (!error && !success) return null

    return (
      <div className="px-4 py-2 shrink-0">
        {error && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'rgba(var(--status-error-rgb), 0.15)',
              border: '1px solid var(--status-error)',
              color: 'var(--status-error)',
            }}
          >
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
        {success && (
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm"
            style={{
              background: 'rgba(var(--status-success-rgb), 0.15)',
              border: '1px solid var(--status-success)',
              color: 'var(--status-success)',
            }}
          >
            <Check className="w-4 h-4 shrink-0" />
            {success}
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Auth Error
  // ---------------------------------------------------------------------------

  const renderAuthError = () => (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className="max-w-md w-full p-8 rounded-xl text-center"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--glass-border)',
        }}
      >
        <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[var(--status-error)]" />
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-2">
          {authError?.status === 401
            ? 'Authentication Required'
            : 'Access Denied'}
        </h2>
        <p className="text-[var(--text-secondary)] mb-4">
          {authError?.status === 401
            ? 'You need to be logged in to access the Kit Manager.'
            : 'You need admin privileges to access the Kit Manager.'}
        </p>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          {authError?.message}
        </p>
        {authError?.status === 401 ? (
          <Link
            href="/api/auth/signin"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-white transition-colors"
            style={{ background: 'var(--accent-primary)' }}
          >
            Sign In
          </Link>
        ) : (
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium text-[var(--text-primary)] transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--glass-border)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
        )}
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render: Loading
  // ---------------------------------------------------------------------------

  const renderLoading = () => (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-[var(--text-secondary)]">
          Loading Kit Manager...
        </p>
      </div>
    </div>
  )

  // ---------------------------------------------------------------------------
  // Render: Left Sidebar (Kit List)
  // ---------------------------------------------------------------------------

  const renderKitSidebar = () => (
    <aside
      className={`${sidebarCollapsed ? 'w-12' : 'w-64'} shrink-0 flex flex-col transition-all duration-200`}
      style={{
        background: 'rgba(255, 255, 255, 0.03)',
        borderRight: '1px solid rgba(255, 255, 255, 0.10)',
      }}
    >
      {sidebarCollapsed ? (
        <div className="flex flex-col items-center py-3 gap-3">
          <button
            onClick={() => setSidebarCollapsed(false)}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
            title="Expand sidebar"
          >
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
          <Package className="w-5 h-5 text-[var(--accent-primary)]" />
        </div>
      ) : (
        <>
          {/* Category Selector */}
          <CategorySelector
            categories={categorySummaries}
            activeCategoryId={loadedConfigId}
            onSwitch={switchCategory}
            onCreateNew={() => {
              setSaveName('')
              setSaveDescription('')
              setSaveModalMode('newCategory')
              setActiveModal('save')
            }}
            onRename={() => setActiveModal('categoryRename')}
            onDuplicate={duplicateCategory}
            onDelete={deleteCategoryHandler}
            loading={loading}
          />

          {/* Sidebar Header */}
          <div
            className="h-12 px-3 flex items-center justify-between shrink-0"
            style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.10)' }}
          >
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <Package className="w-4 h-4 text-[var(--accent-primary)]" />
              Kits
            </h3>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setActiveModal('new')}
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--accent-primary)]/20"
                title="New Kit"
              >
                <Plus className="w-4 h-4 text-[var(--accent-primary)]" />
              </button>
              <button
                onClick={() => setSidebarCollapsed(true)}
                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-card-hover)]"
                title="Collapse sidebar"
              >
                <ChevronLeft className="w-4 h-4 text-[var(--text-muted)]" />
              </button>
            </div>
          </div>

          {/* Kit Type Tabs */}
          <div className="px-2 pt-2 shrink-0">
            <div
              className="flex rounded-lg p-0.5"
              style={{
                background: 'var(--bg-input)',
                border: '1px solid var(--border-secondary)',
              }}
            >
              <button
                onClick={() => setKitViewTab('default')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  kitViewTab === 'default'
                    ? 'text-[var(--text-primary)] bg-[var(--accent-primary)]/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                style={
                  kitViewTab === 'default'
                    ? { boxShadow: 'inset 0 0 0 1px var(--accent-primary)' }
                    : {}
                }
              >
                Default
              </button>
              <button
                onClick={() => setKitViewTab('auto')}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  kitViewTab === 'auto'
                    ? 'text-[var(--text-primary)] bg-[var(--accent-primary)]/20'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'
                }`}
                style={
                  kitViewTab === 'auto'
                    ? { boxShadow: 'inset 0 0 0 1px var(--accent-primary)' }
                    : {}
                }
              >
                Auto Kits
              </button>
            </div>
          </div>

          {/* Search */}
          <div className="p-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-muted)]" />
              <input
                type="text"
                value={kitSearch}
                onChange={(e) => setKitSearch(e.target.value)}
                placeholder="Search kits..."
                className="w-full rounded-lg pl-8 pr-3 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]"
                style={{
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-secondary)',
                }}
              />
            </div>
          </div>

          {/* Category Tree */}
          <div className="flex-1 overflow-y-auto p-2 min-h-0">
            {/* Add Category Button */}
            <button
              onClick={() => {
                const name = prompt('Enter category name:')
                if (name?.trim()) createKitCategory(name.trim())
              }}
              className="w-full flex items-center gap-2 px-2 py-1.5 mb-2 rounded-lg text-left transition-colors hover:bg-[var(--bg-card-hover)] text-[var(--accent-primary)]"
              style={{
                background: 'var(--glass-bg)',
                border: '1px dashed var(--accent-primary)',
              }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-xs font-medium">Add Category</span>
            </button>

            {filteredKitList.length === 0 && sortedCategories.length === 0 ? (
              <div className="text-center py-8">
                <Package className="w-8 h-8 mx-auto mb-2 text-[var(--text-muted)] opacity-50" />
                <p className="text-xs text-[var(--text-muted)]">
                  {kitSearch ? 'No kits match search' : 'No kits yet'}
                </p>
                {!kitSearch && (
                  <button
                    onClick={() => setActiveModal('new')}
                    className="mt-3 text-xs text-[var(--accent-primary)] hover:underline"
                  >
                    Create your first kit
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Category groups */}
                {sortedCategories.map((category) => {
                  const catKits = kitsByCategory.grouped[category.id] || {}
                  const isCatCollapsed = collapsedSubcategories.has(category.id)
                  const sortedSubs = Object.entries(category.subcategories || {})
                    .map(([id, sub]) => ({ id, ...sub }))
                    .sort((a, b) => a.order - b.order)
                  const rootKits = catKits['_root'] || []
                  const totalKits = Object.values(catKits).flat().length

                  const catDropTarget = `cat:${category.id}`
                  const isCatDropOver = dragOverCategoryTarget === catDropTarget

                  return (
                    <div key={category.id}>
                      {/* Category header */}
                      <div className="group flex items-center">
                        <button
                          onClick={() => toggleCollapse(category.id)}
                          onDragOver={(e) => handleCategoryDragOver(e, catDropTarget)}
                          onDragLeave={handleCategoryDragLeave}
                          onDrop={(e) => handleCategoryDrop(e, catDropTarget)}
                          className={`flex-1 flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors hover:bg-[var(--bg-card-hover)] ${
                            isCatDropOver ? 'ring-2 ring-[var(--accent-primary)] ring-inset' : ''
                          }`}
                          style={{
                            background: isCatDropOver ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'var(--glass-bg-subtle)',
                            border: '1px solid var(--glass-border)',
                          }}
                        >
                          <ChevronDown
                            className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${
                              isCatCollapsed ? '-rotate-90' : ''
                            }`}
                          />
                          <Tags className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
                          <span className="flex-1 text-xs font-medium text-[var(--text-primary)] truncate">
                            {category.name}
                          </span>
                          <span className="text-[10px] text-[var(--text-muted)]">
                            {totalKits}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                          <button
                            onClick={() => {
                              const name = prompt('Add subcategory:', '')
                              if (name?.trim()) createKitSubcategory(category.id, name.trim())
                            }}
                            className="p-1 rounded hover:bg-[var(--accent-primary)]/20"
                            title="Add Subcategory"
                          >
                            <Plus className="w-3 h-3 text-[var(--accent-primary)]" />
                          </button>
                          <button
                            onClick={() => {
                              const name = prompt('Rename category:', category.name)
                              if (name?.trim()) renameKitCategory(category.id, name.trim())
                            }}
                            className="p-1 rounded hover:bg-[var(--bg-card)]"
                            title="Rename"
                          >
                            <Edit3 className="w-3 h-3 text-[var(--text-muted)]" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Delete category "${category.name}" and unassign all kits?`)) {
                                deleteKitCategory(category.id)
                              }
                            }}
                            className="p-1 rounded hover:bg-[var(--status-error)]/20"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3 text-[var(--status-error)]" />
                          </button>
                        </div>
                      </div>

                      {/* Category contents */}
                      {!isCatCollapsed && (
                        <div className="mt-1 ml-2 pl-2 space-y-1 border-l border-[var(--glass-border)]">
                          {/* Root kits (in category but no subcategory) */}
                          {rootKits.map(({ id, kit }) => (
                            <KitListItem
                              key={id}
                              id={id}
                              kit={kit}
                              selectedKitId={selectedKitId}
                              draggedKitId={draggedKitId}
                              dragOverKitId={dragOverKitId}
                              kitSearch={kitSearch}
                              onSelect={() => {
                                setSelectedKitId(id)
                                setSelection(null)
                              }}
                              onDragStart={handleKitDragStart}
                              onDragOver={handleKitDragOver}
                              onDragLeave={handleKitDragLeave}
                              onDrop={handleKitDrop}
                              onDragEnd={handleKitDragEnd}
                              onRename={() => {
                                setRenameValue(kit.Name)
                                setSelectedKitId(id)
                                setActiveModal('rename')
                              }}
                              onDuplicate={() => duplicateKit(id)}
                              onDelete={() => {
                                if (confirm(`Delete kit "${kit.Name}"?`)) deleteKit(id)
                              }}
                            />
                          ))}

                          {/* Subcategories */}
                          {sortedSubs.map((sub) => {
                            const subKits = catKits[sub.id] || []
                            const isSubCollapsed = collapsedSubcategories.has(`${category.id}:${sub.id}`)
                            const subDropTarget = `sub:${category.id}:${sub.id}`
                            const isSubDropOver = dragOverCategoryTarget === subDropTarget
                            return (
                              <div key={sub.id}>
                                <div className="group flex items-center">
                                  <button
                                    onClick={() => toggleCollapse(`${category.id}:${sub.id}`)}
                                    onDragOver={(e) => handleCategoryDragOver(e, subDropTarget)}
                                    onDragLeave={handleCategoryDragLeave}
                                    onDrop={(e) => handleCategoryDrop(e, subDropTarget)}
                                    className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-md text-left transition-colors hover:bg-[var(--bg-card-hover)] ${
                                      isSubDropOver ? 'ring-2 ring-[var(--accent-primary)] ring-inset' : ''
                                    }`}
                                    style={{
                                      background: isSubDropOver ? 'rgba(var(--accent-primary-rgb), 0.1)' : 'var(--glass-bg)',
                                      border: '1px solid var(--glass-border)',
                                    }}
                                  >
                                    <ChevronDown
                                      className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${
                                        isSubCollapsed ? '-rotate-90' : ''
                                      }`}
                                    />
                                    <span className="flex-1 text-xs text-[var(--text-secondary)] truncate">
                                      {sub.name}
                                    </span>
                                    <span className="text-[10px] text-[var(--text-muted)]">
                                      {subKits.length}
                                    </span>
                                  </button>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                    <button
                                      onClick={() => {
                                        const name = prompt('Rename subcategory:', sub.name)
                                        if (name?.trim()) renameKitSubcategory(category.id, sub.id, name.trim())
                                      }}
                                      className="p-0.5 rounded hover:bg-[var(--bg-card)]"
                                      title="Rename"
                                    >
                                      <Edit3 className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Delete subcategory "${sub.name}"?`)) {
                                          deleteKitSubcategory(category.id, sub.id)
                                        }
                                      }}
                                      className="p-0.5 rounded hover:bg-[var(--status-error)]/20"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-2.5 h-2.5 text-[var(--status-error)]" />
                                    </button>
                                  </div>
                                </div>
                                {!isSubCollapsed && subKits.length > 0 && (
                                  <div className="mt-1 ml-3 pl-2 space-y-1 border-l border-[var(--glass-border)]">
                                    {subKits.map(({ id, kit }) => (
                                      <KitListItem
                                        key={id}
                                        id={id}
                                        kit={kit}
                                        selectedKitId={selectedKitId}
                                        draggedKitId={draggedKitId}
                                        dragOverKitId={dragOverKitId}
                                        kitSearch={kitSearch}
                                        onSelect={() => {
                                          setSelectedKitId(id)
                                          setSelection(null)
                                        }}
                                        onDragStart={handleKitDragStart}
                                        onDragOver={handleKitDragOver}
                                        onDragLeave={handleKitDragLeave}
                                        onDrop={handleKitDrop}
                                        onDragEnd={handleKitDragEnd}
                                        onRename={() => {
                                          setRenameValue(kit.Name)
                                          setSelectedKitId(id)
                                          setActiveModal('rename')
                                        }}
                                        onDuplicate={() => duplicateKit(id)}
                                        onDelete={() => {
                                          if (confirm(`Delete kit "${kit.Name}"?`)) deleteKit(id)
                                        }}
                                      />
                                    ))}
                                  </div>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Uncategorized kits */}
                {(kitsByCategory.uncategorized.length > 0 || sortedCategories.length > 0) && (
                  <div>
                    {sortedCategories.length > 0 && (
                      <div
                        onDragOver={(e) => handleCategoryDragOver(e, 'uncategorized')}
                        onDragLeave={handleCategoryDragLeave}
                        onDrop={(e) => handleCategoryDrop(e, 'uncategorized')}
                        className={`flex items-center gap-2 px-2 py-1.5 mb-1 rounded-md transition-colors ${
                          dragOverCategoryTarget === 'uncategorized' ? 'ring-2 ring-[var(--accent-primary)] ring-inset bg-[rgba(var(--accent-primary-rgb),0.1)]' : ''
                        }`}
                      >
                        <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
                          Uncategorized
                        </span>
                        <div className="flex-1 h-px bg-[var(--glass-border)]" />
                      </div>
                    )}
                    <div className="space-y-1">
                      {kitsByCategory.uncategorized.map(({ id, kit }) => (
                        <KitListItem
                          key={id}
                          id={id}
                          kit={kit}
                          selectedKitId={selectedKitId}
                          draggedKitId={draggedKitId}
                          dragOverKitId={dragOverKitId}
                          kitSearch={kitSearch}
                          onSelect={() => {
                            setSelectedKitId(id)
                            setSelection(null)
                          }}
                          onDragStart={handleKitDragStart}
                          onDragOver={handleKitDragOver}
                          onDragLeave={handleKitDragLeave}
                          onDrop={handleKitDrop}
                          onDragEnd={handleKitDragEnd}
                          onRename={() => {
                            setRenameValue(kit.Name)
                            setSelectedKitId(id)
                            setActiveModal('rename')
                          }}
                          onDuplicate={() => duplicateKit(id)}
                          onDelete={() => {
                            if (confirm(`Delete kit "${kit.Name}"?`)) deleteKit(id)
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )

  // ---------------------------------------------------------------------------
  // Render: Center Content
  // ---------------------------------------------------------------------------

  const renderCenter = () => {
    if (!selectedKit) {
      return (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-sm">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{
                background: 'rgba(var(--accent-primary-rgb), 0.1)',
              }}
            >
              <Package className="w-8 h-8 text-[var(--accent-primary)]" />
            </div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
              {kitList.length === 0 ? 'No Kits Yet' : 'Select a Kit'}
            </h3>
            <p className="text-sm text-[var(--text-muted)] mb-4">
              {kitList.length === 0
                ? 'Create your first kit to start building loadouts for your server.'
                : 'Select a kit from the sidebar to edit its contents.'}
            </p>
            {kitList.length === 0 && (
              <button
                onClick={() => setActiveModal('new')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors text-white"
                style={{ background: 'var(--accent-primary)' }}
              >
                <Plus className="w-4 h-4" />
                Create Kit
              </button>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Kit Properties Bar */}
        <div
          className="h-12 px-4 flex items-center gap-4 shrink-0 overflow-x-auto"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.10)',
          }}
        >
          <PropField
            label="Permission"
            value={selectedKit.RequiredPermission}
            onChange={(v) =>
              updateKit(selectedKitId!, { RequiredPermission: v })
            }
            width="w-28"
          />
          <PropField
            label="Cooldown"
            type="number"
            value={selectedKit.Cooldown}
            onChange={(v) =>
              updateKit(selectedKitId!, {
                Cooldown: parseInt(v) || 0,
              })
            }
            width="w-16"
            suffix="sec"
          />
          <PropField
            label="Max Uses"
            type="number"
            value={selectedKit.MaximumUses}
            onChange={(v) =>
              updateKit(selectedKitId!, {
                MaximumUses: parseInt(v) || 0,
              })
            }
            width="w-14"
          />
          <PropField
            label="Cost"
            type="number"
            value={selectedKit.Cost}
            onChange={(v) =>
              updateKit(selectedKitId!, {
                Cost: parseInt(v) || 0,
              })
            }
            width="w-14"
          />

          {/* Visibility dropdown */}
          <VisibilityDropdown
            isHidden={selectedKit.IsHidden}
            hideWithoutPermission={selectedKit.HideWithoutPermission ?? false}
            onChange={({ isHidden, hideWithoutPermission }) =>
              updateKit(selectedKitId!, {
                IsHidden: isHidden,
                HideWithoutPermission: hideWithoutPermission,
              })
            }
          />

          {/* Category assignment */}
          <CategoryDropdown
            categoryId={selectedKit.Category}
            subcategoryId={selectedKit.Subcategory}
            categories={kitsData._categories || {}}
            onChange={(catId, subId) =>
              assignKitToCategory(selectedKitId!, catId, subId)
            }
          />

          {/* Auto Kit toggle */}
          <button
            onClick={() => {
              const newIsAutoKit = !(selectedKit.IsAutoKit ?? false)
              updateKit(selectedKitId!, { IsAutoKit: newIsAutoKit })
              // Switch tab to match so kit stays visible
              setKitViewTab(newIsAutoKit ? 'auto' : 'default')
            }}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition cursor-pointer shrink-0 ${
              selectedKit.IsAutoKit
                ? 'text-[var(--status-info)]'
                : 'text-[var(--text-muted)]'
            }`}
            style={{
              background: selectedKit.IsAutoKit
                ? 'rgba(var(--status-info-rgb), 0.15)'
                : 'var(--glass-bg)',
              border: selectedKit.IsAutoKit
                ? '1px solid var(--status-info)'
                : '1px solid var(--glass-border)',
            }}
            title={selectedKit.IsAutoKit ? 'Auto kit (given on spawn)' : 'Not an auto kit'}
          >
            <Zap className="w-3 h-3" />
            <span>Auto Kit</span>
          </button>

          {/* Kit ID with copy */}
          <button
            onClick={copyKitIdToClipboard}
            className="flex items-center gap-2 px-2 py-1 rounded-md text-xs transition-colors hover:bg-[var(--bg-card-hover)] group shrink-0"
            title="Click to copy kit ID"
          >
            <span className="text-[var(--text-muted)] font-medium">ID:</span>
            <code className="text-[var(--text-secondary)] font-mono text-[10px] max-w-[140px] truncate">
              {selectedKitId}
            </code>
            {copiedKitId ? (
              <Check className="w-3 h-3 text-[var(--status-success)]" />
            ) : (
              <Copy className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 transition-opacity" />
            )}
          </button>

          {/* Spacer to push skins toggle right */}
          <div className="flex-1" />

          {/* Skins toggle */}
          <label
            className={`cursor-pointer select-none rounded-full px-3 py-1 text-xs font-medium transition shrink-0 flex items-center gap-1.5 ${
              showSkins
                ? 'text-[var(--accent-primary)]'
                : 'text-[var(--text-muted)]'
            }`}
            style={{
              background: showSkins
                ? 'rgba(var(--accent-primary-rgb), 0.15)'
                : 'var(--glass-bg)',
              border: showSkins
                ? '1px solid var(--accent-primary)'
                : '1px solid var(--glass-border)',
            }}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={showSkins}
              onChange={() => setShowSkins(!showSkins)}
            />
            <Paintbrush className="w-3 h-3" />
            Skins
          </label>
        </div>

        {/* Inventory Grid */}
        <div
          className="flex-1 overflow-auto p-6"
          style={{ background: 'rgba(255, 255, 255, 0.02)' }}
        >
          <div className="flex justify-center">
            <RustInventory
              kit={selectedKit}
              selectedSlot={selection?.slot}
              selectedIndex={selection?.index}
              skinImages={showSkins ? skinImages : undefined}
              onSelect={(slot, index) => setSelection({ slot, index })}
              onEmptySlotClick={() => {
                setSelection(null)
                setItemBrowserCollapsed(false)
              }}
              onDrop={handleItemDrop}
              onExternalDrop={handleExternalDrop}
              onContextMenu={handleContextMenu}
            />
          </div>
        </div>
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render: Right Panel
  // ---------------------------------------------------------------------------

  const renderRightPanel = () => {
    if (selectedItem && selection) {
      return (
        <ItemEditor
          item={selectedItem}
          onUpdate={updateSelectedItem}
          onDelete={deleteSelectedItem}
          onClose={() => setSelection(null)}
        />
      )
    }

    if (selectedKit) {
      return (
        <ItemBrowser
          onItemSelect={addItemToKit}
          collapsed={itemBrowserCollapsed}
          onToggle={() => setItemBrowserCollapsed(!itemBrowserCollapsed)}
        />
      )
    }

    return <ItemEditorEmpty />
  }

  // ---------------------------------------------------------------------------
  // Main Render
  // ---------------------------------------------------------------------------

  return (
    <>
      {/* Header */}
      {renderHeader()}

      {/* Messages */}
      {renderMessages()}

      {/* Main Content: 3-column layout */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {authError ? (
          renderAuthError()
        ) : initialLoading ? (
          renderLoading()
        ) : (
          <>
            {renderKitSidebar()}
            {renderCenter()}
            {renderRightPanel()}
          </>
        )}
      </div>

      {/* Modals */}
      {activeModal === 'new' && (
        <NewKitModal
          onClose={() => {
            setActiveModal(null)
            setNewKitName('')
            setNewKitDescription('')
          }}
          onCreate={() => createKit(newKitName, newKitDescription)}
          name={newKitName}
          setName={setNewKitName}
          description={newKitDescription}
          setDescription={setNewKitDescription}
        />
      )}

      {activeModal === 'save' && (
        <SaveModal
          onClose={() => setActiveModal(null)}
          onSave={() =>
            saveModalMode === 'newCategory'
              ? createCategory(saveName, saveDescription)
              : saveConfig(saveName, saveDescription)
          }
          name={saveName}
          setName={setSaveName}
          description={saveDescription}
          setDescription={setSaveDescription}
          isSaving={loading}
        />
      )}

      {activeModal === 'categoryRename' && activeCategory && (
        <CategoryRenameModal
          onClose={() => setActiveModal(null)}
          onRename={renameCategory}
          currentName={activeCategory.name}
          currentDescription={activeCategory.description || ''}
          isRenaming={loading}
        />
      )}

      {activeModal === 'unsavedChanges' && activeCategory && (
        <UnsavedChangesModal
          onClose={() => {
            setActiveModal(null)
            setPendingSwitchId(null)
          }}
          onDiscard={handleUnsavedDiscard}
          onSave={handleUnsavedSave}
          categoryName={activeCategory.name}
          isSaving={loading}
        />
      )}

      {activeModal === 'rename' && selectedKitId && selectedKit && (
        <RenameModal
          onClose={() => {
            setActiveModal(null)
            setRenameValue('')
          }}
          onRename={() => renameKit(selectedKitId, renameValue)}
          onMoveToCategory={(targetId, newName) => moveKitToCategory(selectedKitId, targetId, newName)}
          name={renameValue}
          setName={setRenameValue}
          originalName={selectedKit.Name}
          categories={savedConfigs.map((c) => ({ id: c.id, name: c.name }))}
          currentCategoryId={loadedConfigId}
          isMoving={loading}
        />
      )}

      {activeModal === 'multiplier' && (
        <MultiplierModal
          onClose={() => setActiveModal(null)}
          onApply={applyMultiplier}
          value={multiplierValue}
          setValue={setMultiplierValue}
          applyAmount={multiplierApplyAmount}
          setApplyAmount={setMultiplierApplyAmount}
          skipOnes={multiplierSkipOnes}
          setSkipOnes={setMultiplierSkipOnes}
          scope={multiplierScope}
          setScope={setMultiplierScope}
          hasSelectedKit={!!selectedKitId}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <div
          className="fixed z-[9999] min-w-[140px] rounded-lg py-1 shadow-lg"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            background: 'rgba(30, 41, 59, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.12)',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleContextMenuDelete}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[var(--status-error)] hover:bg-[var(--status-error)]/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            Remove Item
          </button>
        </div>
      )}
    </>
  )
}

// =============================================================================
// Local UI Helpers
// =============================================================================

function ToolbarButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="p-2 rounded-lg transition-colors disabled:opacity-30 text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--glass-border)',
      }}
      title={title}
    >
      {children}
    </button>
  )
}

function PropField({
  label,
  type = 'text',
  value,
  onChange,
  width,
  suffix,
}: {
  label: string
  type?: string
  value: string | number
  onChange: (v: string) => void
  width: string
  suffix?: string
}) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <label className="text-xs text-[var(--text-muted)]">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${width} rounded px-2 py-1 text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--accent-primary)]`}
        style={{
          background: 'var(--bg-input)',
          border: '1px solid var(--border-secondary)',
        }}
      />
      {suffix && (
        <span className="text-xs text-[var(--text-muted)]">{suffix}</span>
      )}
    </div>
  )
}

function KitListItem({
  id,
  kit,
  selectedKitId,
  draggedKitId,
  dragOverKitId,
  kitSearch,
  onSelect,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
  onRename,
  onDuplicate,
  onDelete,
}: {
  id: string
  kit: Kit
  selectedKitId: string | null
  draggedKitId: string | null
  dragOverKitId: string | null
  kitSearch: string
  onSelect: () => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDragOver: (e: React.DragEvent, id: string) => void
  onDragLeave: () => void
  onDrop: (e: React.DragEvent, id: string) => void
  onDragEnd: () => void
  onRename: () => void
  onDuplicate: () => void
  onDelete: () => void
}) {
  return (
    <div
      draggable={!kitSearch.trim()}
      onDragStart={(e) => onDragStart(e, id)}
      onDragOver={(e) => onDragOver(e, id)}
      onDragLeave={onDragLeave}
      onDrop={(e) => onDrop(e, id)}
      onDragEnd={onDragEnd}
      onClick={onSelect}
      className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
        selectedKitId === id
          ? 'bg-[var(--accent-primary)]/15'
          : dragOverKitId === id
            ? 'bg-[var(--accent-primary)]/10'
            : 'hover:bg-[var(--bg-card-hover)]'
      } ${draggedKitId === id ? 'opacity-50' : ''}`}
      style={{
        border:
          dragOverKitId === id
            ? '1px solid var(--accent-primary)'
            : selectedKitId === id
              ? '1px solid var(--accent-primary)'
              : '1px solid transparent',
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-[var(--text-primary)] truncate">
          {kit.Name}
        </div>
        <div className="text-xs text-[var(--text-muted)]">
          {kit.MainItems.length + kit.WearItems.length + kit.BeltItems.length}{' '}
          items
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation()
            onRename()
          }}
          className="p-1 rounded hover:bg-[var(--bg-card)]"
          title="Rename"
        >
          <Edit3 className="w-3 h-3 text-[var(--text-muted)]" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate()
          }}
          className="p-1 rounded hover:bg-[var(--bg-card)]"
          title="Duplicate"
        >
          <Copy className="w-3 h-3 text-[var(--text-muted)]" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          className="p-1 rounded hover:bg-[var(--status-error)]/20"
          title="Delete"
        >
          <Trash2 className="w-3 h-3 text-[var(--status-error)]" />
        </button>
      </div>
    </div>
  )
}
