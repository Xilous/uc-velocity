import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { SearchableSelect, SearchableSelectOption } from "@/components/ui/searchable-select"
import { api } from "@/api/client"
import type {
  Quote, QuoteLineItem, QuoteLineItemCreate, QuoteLineItemUpdate,
  LineItemType, Part, Labor, Miscellaneous, DiscountCode, QuoteStatus,
  StagedFulfillment, InvoiceCreate
} from "@/types"
import { Plus, Trash2, Wrench, Package, FileText, Pencil, Tag, ClipboardCheck, Receipt, Percent, Info, Copy, Car, MapPin, X } from "lucide-react"
import { QuoteAuditTrail } from "./QuoteAuditTrail"
import { PartForm } from "@/components/forms/PartForm"
import { LaborForm } from "@/components/forms/LaborForm"
import { MiscForm } from "@/components/forms/MiscForm"
import { DiscountCodeForm } from "@/components/forms/DiscountCodeForm"

interface QuoteEditorProps {
  quoteId: number
  onUpdate?: () => void
  onSelectQuote?: (quoteId: number) => void
}

export function QuoteEditor({ quoteId, onUpdate, onSelectQuote }: QuoteEditorProps) {
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Add dialog states
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [addDialogType, setAddDialogType] = useState<LineItemType>("part")

  // Edit dialog states
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingLineItem, setEditingLineItem] = useState<QuoteLineItem | null>(null)

  // Auto-add labor dialog
  const [autoAddLaborDialogOpen, setAutoAddLaborDialogOpen] = useState(false)
  const [pendingPart, setPendingPart] = useState<Part | null>(null)
  const [linkedLaborToAdd, setLinkedLaborToAdd] = useState<Labor[]>([])

  // Available items for selection
  const [parts, setParts] = useState<Part[]>([])
  const [laborItems, setLaborItems] = useState<Labor[]>([])
  const [miscItems, setMiscItems] = useState<Miscellaneous[]>([])
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([])

  // Add form fields
  const [selectedPartId, setSelectedPartId] = useState<string>("")
  const [selectedLaborId, setSelectedLaborId] = useState<string>("")
  const [selectedMiscId, setSelectedMiscId] = useState<string>("")
  const [quantity, setQuantity] = useState("1")

  // Edit form fields
  const [editQuantity, setEditQuantity] = useState("1")
  const [editDiscountCodeId, setEditDiscountCodeId] = useState<string>("")

  // Staged fulfillments (session only - not persisted until invoice created)
  const [stagedFulfillments, setStagedFulfillments] = useState<Map<number, number>>(new Map())

  // Inline editing state for staging
  const [editingLineItemId, setEditingLineItemId] = useState<number | null>(null)
  const [editingValue, setEditingValue] = useState<string>("")

  // Bulk stage by percentage dialog
  const [bulkStageDialogOpen, setBulkStageDialogOpen] = useState(false)
  const [bulkStageSection, setBulkStageSection] = useState<LineItemType | null>(null)
  const [bulkStagePercent, setBulkStagePercent] = useState<string>("50")

  // Invoice preview modal
  const [previewModalOpen, setPreviewModalOpen] = useState(false)

  // Confirmation dialog before invoice creation
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)

  // Creating invoice
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)

  // Client PO Number editing
  const [clientPoNumber, setClientPoNumber] = useState("")
  const [isEditingClientPo, setIsEditingClientPo] = useState(false)
  const [savingClientPo, setSavingClientPo] = useState(false)

  // Work Description editing
  const [workDescription, setWorkDescription] = useState("")
  const [isEditingWorkDescription, setIsEditingWorkDescription] = useState(false)
  const [savingWorkDescription, setSavingWorkDescription] = useState(false)

  // PMS (Project Management Services) dialog states
  const [pmsDialogOpen, setPmsDialogOpen] = useState(false)
  const [pmsType, setPmsType] = useState<"percent" | "dollar">("dollar")
  const [pmsValue, setPmsValue] = useState("")

  // Markup Discount Control states
  const [markupControlDialogOpen, setMarkupControlDialogOpen] = useState(false)
  const [pendingMarkupPercent, setPendingMarkupPercent] = useState("")
  const [togglingMarkupControl, setTogglingMarkupControl] = useState(false)

  // Edit Markup states (for modifying markup while enabled)
  const [editMarkupDialogOpen, setEditMarkupDialogOpen] = useState(false)
  const [editingMarkupPercent, setEditingMarkupPercent] = useState("")
  const [updatingMarkupPercent, setUpdatingMarkupPercent] = useState(false)

  // Discount All dialog state
  const [discountAllDialogOpen, setDiscountAllDialogOpen] = useState(false)
  const [discountAllSection, setDiscountAllSection] = useState<LineItemType | null>(null)
  const [selectedBulkDiscountCodeId, setSelectedBulkDiscountCodeId] = useState<string>("")
  const [applyingDiscount, setApplyingDiscount] = useState(false)

  // Clone quote state
  const [isCloning, setIsCloning] = useState(false)

  // Parking and Travel Distance dialog states
  const [travelDistanceDialogOpen, setTravelDistanceDialogOpen] = useState(false)
  const [travelDistanceItems, setTravelDistanceItems] = useState<Miscellaneous[]>([])
  const [selectedTravelDistanceId, setSelectedTravelDistanceId] = useState<string>("")
  const [addingParking, setAddingParking] = useState(false)
  const [addingTravelDistance, setAddingTravelDistance] = useState(false)

  const fetchQuote = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.quotes.get(quoteId)
      setQuote(data)
      setClientPoNumber(data.client_po_number || "")
      setWorkDescription(data.work_description || "")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quote")
    } finally {
      setLoading(false)
    }
  }

  const fetchResources = async () => {
    try {
      const [partsData, laborData, miscData, discountCodesData] = await Promise.all([
        api.parts.getAll(),
        api.labor.getAll(),
        api.misc.getAll(),
        api.discountCodes.getAll(false), // Only active codes
      ])
      setParts(partsData)
      setLaborItems(laborData)
      setMiscItems(miscData)
      setDiscountCodes(discountCodesData)
    } catch (err) {
      console.error("Failed to fetch resources", err)
    }
  }

  useEffect(() => {
    fetchQuote()
    fetchResources()
  }, [quoteId])

  const openAddDialog = (type: LineItemType) => {
    setAddDialogType(type)
    setSelectedPartId("")
    setSelectedLaborId("")
    setSelectedMiscId("")
    setQuantity("1")
    setAddDialogOpen(true)
  }

  const openEditDialog = (item: QuoteLineItem) => {
    setEditingLineItem(item)
    setEditQuantity(item.quantity.toString())
    setEditDiscountCodeId(item.discount_code_id?.toString() || "none")
    setEditDialogOpen(true)
  }

  const handleAddLineItem = async () => {
    const lineItem: QuoteLineItemCreate = {
      item_type: addDialogType,
      quantity: parseFloat(quantity) || 1,
    }

    if (addDialogType === "part") {
      if (!selectedPartId) return
      lineItem.part_id = parseInt(selectedPartId)
      const part = parts.find((p) => p.id === lineItem.part_id)
      if (part) {
        lineItem.unit_price = part.cost * (1 + (part.markup_percent ?? 0) / 100)

        // Check if part has linked labor items
        if (part.labor_items && part.labor_items.length > 0) {
          setPendingPart(part)
          setLinkedLaborToAdd(part.labor_items)
          setAddDialogOpen(false)
          setAutoAddLaborDialogOpen(true)
          return
        }
      }
    } else if (addDialogType === "labor") {
      if (!selectedLaborId) return
      lineItem.labor_id = parseInt(selectedLaborId)
      const labor = laborItems.find((l) => l.id === lineItem.labor_id)
      if (labor) {
        lineItem.unit_price = labor.rate * labor.hours * (1 + labor.markup_percent / 100)
      }
    } else if (addDialogType === "misc") {
      if (!selectedMiscId) return
      lineItem.misc_id = parseInt(selectedMiscId)
      const misc = miscItems.find((m) => m.id === lineItem.misc_id)
      if (misc) {
        lineItem.unit_price = misc.unit_price * (1 + misc.markup_percent / 100)
      }
    }

    try {
      await api.quotes.addLine(quoteId, lineItem)
      setAddDialogOpen(false)
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add line item")
    }
  }

  const handleConfirmAutoAddLabor = async () => {
    if (!pendingPart) return

    try {
      // First add the part
      const partLineItem: QuoteLineItemCreate = {
        item_type: "part",
        part_id: pendingPart.id,
        quantity: parseFloat(quantity) || 1,
        unit_price: pendingPart.cost * (1 + (pendingPart.markup_percent ?? 0) / 100),
      }
      await api.quotes.addLine(quoteId, partLineItem)

      // Then add all linked labor items with same quantity as the part
      const partQuantity = parseFloat(quantity) || 1
      for (const labor of linkedLaborToAdd) {
        const laborLineItem: QuoteLineItemCreate = {
          item_type: "labor",
          labor_id: labor.id,
          quantity: partQuantity,
          unit_price: labor.rate * labor.hours * (1 + labor.markup_percent / 100),
        }
        await api.quotes.addLine(quoteId, laborLineItem)
      }

      setAutoAddLaborDialogOpen(false)
      setPendingPart(null)
      setLinkedLaborToAdd([])
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add items")
    }
  }

  const handleSkipAutoAddLabor = async () => {
    if (!pendingPart) return

    try {
      // Just add the part without labor
      const partLineItem: QuoteLineItemCreate = {
        item_type: "part",
        part_id: pendingPart.id,
        quantity: parseFloat(quantity) || 1,
        unit_price: pendingPart.cost * (1 + (pendingPart.markup_percent ?? 0) / 100),
      }
      await api.quotes.addLine(quoteId, partLineItem)

      setAutoAddLaborDialogOpen(false)
      setPendingPart(null)
      setLinkedLaborToAdd([])
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add part")
    }
  }

  const handleUpdateLineItem = async () => {
    if (!editingLineItem) return

    const updateData: QuoteLineItemUpdate = {
      quantity: parseFloat(editQuantity) || 1,
      discount_code_id: editDiscountCodeId && editDiscountCodeId !== "none" ? parseInt(editDiscountCodeId) : 0, // 0 to remove
    }

    try {
      await api.quotes.updateLine(quoteId, editingLineItem.id, updateData)
      setEditDialogOpen(false)
      setEditingLineItem(null)
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update line item")
    }
  }

  const handleDeleteLine = async (lineId: number) => {
    if (!confirm("Delete this line item?")) return
    try {
      await api.quotes.deleteLine(quoteId, lineId)
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete line item")
    }
  }

  const handleStatusChange = async (newStatus: QuoteStatus) => {
    try {
      await api.quotes.update(quoteId, { status: newStatus })
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update status")
    }
  }

  const handleSaveClientPoNumber = async () => {
    setSavingClientPo(true)
    try {
      await api.quotes.update(quoteId, { client_po_number: clientPoNumber.trim() || null })
      setIsEditingClientPo(false)
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update Client PO Number")
    } finally {
      setSavingClientPo(false)
    }
  }

  const handleSaveWorkDescription = async () => {
    setSavingWorkDescription(true)
    try {
      await api.quotes.update(quoteId, { work_description: workDescription.trim() || null })
      setIsEditingWorkDescription(false)
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update Work Description")
    } finally {
      setSavingWorkDescription(false)
    }
  }

  // Markup Discount Control handlers
  const handleToggleMarkupControl = () => {
    if (!quote) return

    if (!quote.markup_control_enabled) {
      // Enabling - check for discount codes first
      const hasDiscounts = quote.line_items.some(item => item.discount_code_id)
      if (hasDiscounts) {
        alert("Remove discount codes first to enable this feature")
        return
      }
      // Open dialog to get global markup percent
      setPendingMarkupPercent("")
      setMarkupControlDialogOpen(true)
    } else {
      // Disabling - confirm and call API
      if (!confirm("Disable Markup Discount Control? This will restore individual markups.")) {
        return
      }
      handleDisableMarkupControl()
    }
  }

  const handleDisableMarkupControl = async () => {
    setTogglingMarkupControl(true)
    try {
      await api.quotes.toggleMarkupControl(quoteId, { enabled: false })
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to disable markup control")
    } finally {
      setTogglingMarkupControl(false)
    }
  }

  const handleConfirmEnableMarkupControl = async () => {
    const percent = parseFloat(pendingMarkupPercent)
    if (isNaN(percent) || percent < 0) {
      alert("Please enter a valid markup percentage (0 or greater)")
      return
    }

    setTogglingMarkupControl(true)
    try {
      await api.quotes.toggleMarkupControl(quoteId, {
        enabled: true,
        global_markup_percent: percent
      })
      setMarkupControlDialogOpen(false)
      setPendingMarkupPercent("")
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to enable markup control")
    } finally {
      setTogglingMarkupControl(false)
    }
  }

  // Edit Markup handlers (for modifying markup while enabled)
  const handleOpenEditMarkup = () => {
    if (!quote || !quote.markup_control_enabled) return
    setEditingMarkupPercent(quote.global_markup_percent?.toString() || "")
    setEditMarkupDialogOpen(true)
  }

  const handleConfirmUpdateMarkup = async () => {
    const percent = parseFloat(editingMarkupPercent)
    if (isNaN(percent) || percent < 0) {
      alert("Please enter a valid markup percentage (0 or greater)")
      return
    }
    setUpdatingMarkupPercent(true)
    try {
      await api.quotes.toggleMarkupControl(quoteId, {
        enabled: true,
        global_markup_percent: percent
      })
      setEditMarkupDialogOpen(false)
      setEditingMarkupPercent("")
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update markup")
    } finally {
      setUpdatingMarkupPercent(false)
    }
  }

  // PMS dialog handlers
  const openPmsDialog = (type: "percent" | "dollar") => {
    setPmsType(type)
    setPmsValue("")
    setPmsDialogOpen(true)
  }

  const handleAddPmsItem = async () => {
    const value = parseFloat(pmsValue)
    if (isNaN(value) || value <= 0) {
      alert("Please enter a valid positive number")
      return
    }

    const lineItem: QuoteLineItemCreate = {
      item_type: "labor",
      description: "Project Management Services",
      quantity: 1,
      is_pms: true,
    }

    if (pmsType === "percent") {
      lineItem.pms_percent = value
      // Set initial unit_price (will be recalculated dynamically on display)
      lineItem.unit_price = calculateNonPmsTotal() * value / 100
    } else {
      lineItem.unit_price = value
    }

    try {
      await api.quotes.addLine(quoteId, lineItem)
      setPmsDialogOpen(false)
      setPmsValue("")
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add PMS item")
    }
  }

  const getLineItemDescription = (item: QuoteLineItem): string => {
    if (item.item_type === "labor") {
      if (item.labor) {
        return item.labor.description
      }
      // PMS or custom labor item without inventory reference
      return item.description || ""
    }
    if (item.item_type === "part" && item.part) {
      return item.part.part_number
    }
    if (item.item_type === "misc" && item.miscellaneous) {
      return item.miscellaneous.description
    }
    return item.description || ""
  }

  const getDescriptionLabel = (item: QuoteLineItem): string => {
    if (item.item_type === "labor") return "Labour Description"
    if (item.item_type === "part") return "Part Number"
    return "Misc Description"
  }

  const getLineItemUnitPrice = (item: QuoteLineItem): number => {
    if (item.unit_price) return item.unit_price
    if (item.labor) {
      return item.labor.hours * item.labor.rate * (1 + item.labor.markup_percent / 100)
    }
    if (item.part) {
      return item.part.cost * (1 + (item.part.markup_percent ?? 0) / 100)
    }
    if (item.miscellaneous) {
      return item.miscellaneous.unit_price * (1 + item.miscellaneous.markup_percent / 100)
    }
    return 0
  }

  const getLineItemSubtotal = (item: QuoteLineItem): number => {
    return getLineItemUnitPrice(item) * item.quantity
  }

  const getLineItemTotal = (item: QuoteLineItem): number => {
    const subtotal = getLineItemSubtotal(item)
    if (item.discount_code) {
      return subtotal * (1 - item.discount_code.discount_percent / 100)
    }
    return subtotal
  }

  // Calculate total of non-PMS items (the base for PMS % calculations)
  const calculateNonPmsTotal = (): number => {
    if (!quote) return 0
    return quote.line_items
      .filter(item => !item.is_pms)
      .reduce((sum, item) => sum + getLineItemTotal(item), 0)
  }

  // Get the effective unit price for a line item (handles PMS % dynamic calculation)
  const getEffectiveUnitPrice = (item: QuoteLineItem): number => {
    if (item.is_pms && item.pms_percent != null) {
      // PMS % item: calculate dynamically based on non-PMS total
      return calculateNonPmsTotal() * item.pms_percent / 100
    }
    return getLineItemUnitPrice(item)
  }

  // Get effective total for a line item (uses effective unit price for PMS % items)
  const getEffectiveLineItemTotal = (item: QuoteLineItem): number => {
    const unitPrice = getEffectiveUnitPrice(item)
    const subtotal = unitPrice * item.quantity
    if (item.discount_code) {
      return subtotal * (1 - item.discount_code.discount_percent / 100)
    }
    return subtotal
  }

  const calculateTotal = (): number => {
    if (!quote) return 0
    const nonPmsTotal = calculateNonPmsTotal()
    const pmsTotal = quote.line_items
      .filter(item => item.is_pms)
      .reduce((sum, item) => {
        if (item.pms_percent != null) {
          // PMS % item: calculate from non-PMS total
          const unitPrice = nonPmsTotal * item.pms_percent / 100
          let subtotal = unitPrice * item.quantity
          if (item.discount_code) {
            subtotal = subtotal * (1 - item.discount_code.discount_percent / 100)
          }
          return sum + subtotal
        }
        // PMS $ item: use the stored unit_price
        return sum + getLineItemTotal(item)
      }, 0)
    return nonPmsTotal + pmsTotal
  }

  // Calculate weighted average markup percentage
  // Formula: Σ(Markup% × Base Cost × Qty) / Σ(Base Cost × Qty)
  const calculateAverageMarkup = (): number => {
    if (!quote || quote.line_items.length === 0) return 0

    let totalWeightedMarkup = 0
    let totalBaseCost = 0

    for (const item of quote.line_items) {
      let baseCost = 0
      let markupPercent = 0

      if (item.part) {
        baseCost = item.part.cost
        markupPercent = item.part.markup_percent ?? 0
      } else if (item.labor) {
        baseCost = item.labor.hours * item.labor.rate
        markupPercent = item.labor.markup_percent
      } else if (item.miscellaneous) {
        baseCost = item.miscellaneous.unit_price
        markupPercent = item.miscellaneous.markup_percent
      }

      // PMS items have 0 markup by definition
      if (item.is_pms) {
        markupPercent = 0
      }

      const weightedCost = baseCost * item.quantity
      totalWeightedMarkup += markupPercent * weightedCost
      totalBaseCost += weightedCost
    }

    return totalBaseCost > 0 ? totalWeightedMarkup / totalBaseCost : 0
  }

  // Calculate total margin percentage
  // Margin = (Selling Price - Manufacturing Cost) / Selling Price × 100
  // Manufacturing cost = Parts cost only (Labor/Misc have 0 mfg cost)
  const calculateTotalMargin = (): number => {
    if (!quote) return 0

    const totalSellingPrice = calculateTotal()
    if (totalSellingPrice === 0) return 0

    let totalManufacturingCost = 0

    for (const item of quote.line_items) {
      // Only Parts have manufacturing cost
      if (item.part) {
        totalManufacturingCost += item.part.cost * item.quantity
      }
      // Labor and Misc have 0 manufacturing cost
      // PMS items also have 0 manufacturing cost
    }

    return ((totalSellingPrice - totalManufacturingCost) / totalSellingPrice) * 100
  }

  // Calculate total labor hours (excluding PMS items)
  const calculateTotalLaborHours = (): number => {
    if (!quote) return 0
    return quote.line_items
      .filter(item => item.item_type === "labor" && !item.is_pms && item.labor)
      .reduce((sum, item) => {
        const laborHours = item.labor?.hours || 0
        return sum + (laborHours * item.quantity)
      }, 0)
  }

  // Calculate section totals for display
  const calculateSectionTotals = (items: QuoteLineItem[], useEffectiveTotal = false) => {
    return {
      qtyOrdered: items.reduce((sum, item) => sum + item.quantity, 0),
      qtyPending: items.reduce((sum, item) => sum + item.qty_pending, 0),
      qtyFulfilled: items.reduce((sum, item) => sum + item.qty_fulfilled, 0),
      total: items.reduce((sum, item) => sum + (useEffectiveTotal ? getEffectiveLineItemTotal(item) : getLineItemTotal(item)), 0),
      fulfilledValue: items.reduce((sum, item) => sum + getFulfilledLineItemValue(item), 0),
    }
  }

  // Calculate staged total for a single line item
  const getStagedLineItemTotal = (item: QuoteLineItem): number => {
    const stagedQty = stagedFulfillments.get(item.id) || 0
    if (stagedQty === 0) return 0
    const unitPrice = getEffectiveUnitPrice(item)
    let total = unitPrice * stagedQty
    if (item.discount_code) {
      total = total * (1 - item.discount_code.discount_percent / 100)
    }
    return total
  }

  // Calculate fulfilled value for a single line item
  const getFulfilledLineItemValue = (item: QuoteLineItem): number => {
    if (item.qty_fulfilled === 0) return 0
    const unitPrice = getEffectiveUnitPrice(item)
    let total = unitPrice * item.qty_fulfilled
    if (item.discount_code) {
      total = total * (1 - item.discount_code.discount_percent / 100)
    }
    return total
  }

  // Calculate staged totals for a section
  const calculateStagedSectionTotals = (items: QuoteLineItem[]) => {
    return {
      stagedQty: items.reduce((sum, item) => sum + (stagedFulfillments.get(item.id) || 0), 0),
      stagedTotal: items.reduce((sum, item) => sum + getStagedLineItemTotal(item), 0),
      itemCount: items.filter(item => stagedFulfillments.has(item.id)).length
    }
  }

  // Calculate quote-wide staged totals
  const calculateStagedGrandTotal = () => {
    if (!quote) return { stagedQty: 0, stagedTotal: 0, itemCount: 0 }
    return calculateStagedSectionTotals(quote.line_items)
  }

  // Calculate already invoiced totals
  const calculateInvoicedTotals = () => {
    if (!quote) return { invoicedQty: 0, invoicedTotal: 0 }
    return {
      invoicedQty: quote.line_items.reduce((sum, item) => sum + item.qty_fulfilled, 0),
      invoicedTotal: quote.line_items.reduce((sum, item) => {
        const unitPrice = getEffectiveUnitPrice(item)
        let total = unitPrice * item.qty_fulfilled
        if (item.discount_code) {
          total = total * (1 - item.discount_code.discount_percent / 100)
        }
        return sum + total
      }, 0)
    }
  }

  // Round up to nearest 8
  const roundUpToNearest8 = (value: number): number => {
    return Math.ceil(value / 8) * 8
  }

  // Fetch travel distance items for dialog
  const fetchTravelDistanceItems = async () => {
    try {
      const items = await api.misc.getTravelDistanceItems()
      setTravelDistanceItems(items)
    } catch (err) {
      console.error("Failed to fetch travel distance items", err)
    }
  }

  // Handler for "Calculate & Add Parking" button
  const handleCalculateAndAddParking = async () => {
    if (!quote) return

    setAddingParking(true)
    try {
      // Get the parking system item
      const parkingItem = await api.misc.getParkingItem()

      // Calculate total labor hours (excluding PMS)
      const totalLaborHours = calculateTotalLaborHours()

      // Round up to nearest 8
      const parkingQty = roundUpToNearest8(totalLaborHours)

      if (parkingQty === 0) {
        alert("No labor hours to calculate parking from. Add labor items first.")
        return
      }

      // Check if parking line item already exists in quote
      const existingParkingLine = quote.line_items.find(
        item => item.item_type === "misc" &&
                item.misc_id === parkingItem.id
      )

      if (existingParkingLine) {
        // Update existing line item quantity
        await api.quotes.updateLine(quoteId, existingParkingLine.id, {
          quantity: parkingQty
        })
      } else {
        // Add new line item
        const lineItem: QuoteLineItemCreate = {
          item_type: "misc",
          misc_id: parkingItem.id,
          quantity: parkingQty,
          unit_price: parkingItem.unit_price * (1 + parkingItem.markup_percent / 100)
        }
        await api.quotes.addLine(quoteId, lineItem)
      }

      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add parking")
    } finally {
      setAddingParking(false)
    }
  }

  // Handler for "Calculate & Add Travel Distance" button - opens dialog
  const handleOpenTravelDistanceDialog = async () => {
    await fetchTravelDistanceItems()
    setSelectedTravelDistanceId("")
    setTravelDistanceDialogOpen(true)
  }

  // Handler for confirming travel distance selection
  const handleConfirmTravelDistance = async () => {
    if (!quote || !selectedTravelDistanceId) return

    setAddingTravelDistance(true)
    try {
      const selectedItem = travelDistanceItems.find(
        item => item.id.toString() === selectedTravelDistanceId
      )

      if (!selectedItem) {
        alert("Please select a travel distance option")
        return
      }

      // Calculate days = total labor hours / 8, rounded up
      const totalLaborHours = calculateTotalLaborHours()
      const days = Math.ceil(totalLaborHours / 8)

      if (days === 0) {
        alert("No labor hours to calculate travel distance from. Add labor items first.")
        return
      }

      // Check if this travel distance item already exists in quote
      const existingLine = quote.line_items.find(
        item => item.item_type === "misc" &&
                item.misc_id === selectedItem.id
      )

      if (existingLine) {
        // Update existing line item quantity
        await api.quotes.updateLine(quoteId, existingLine.id, {
          quantity: days
        })
      } else {
        // Add new line item
        const lineItem: QuoteLineItemCreate = {
          item_type: "misc",
          misc_id: selectedItem.id,
          quantity: days,
          unit_price: selectedItem.unit_price * (1 + selectedItem.markup_percent / 100)
        }
        await api.quotes.addLine(quoteId, lineItem)
      }

      setTravelDistanceDialogOpen(false)
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add travel distance")
    } finally {
      setAddingTravelDistance(false)
    }
  }

  const getTypeIcon = (type: LineItemType) => {
    switch (type) {
      case "labor":
        return <Wrench className="h-4 w-4" />
      case "part":
        return <Package className="h-4 w-4" />
      case "misc":
        return <FileText className="h-4 w-4" />
    }
  }

  const getTypeBadgeVariant = (type: LineItemType) => {
    switch (type) {
      case "labor":
        return "default"
      case "part":
        return "secondary"
      case "misc":
        return "outline"
    }
  }

  // Filter line items by type
  const partItems = quote?.line_items.filter(item => item.item_type === "part") || []
  const laborItems2 = quote?.line_items.filter(item => item.item_type === "labor") || []
  const miscItems2 = quote?.line_items.filter(item => item.item_type === "misc") || []

  // Stacked progress bar component for fulfillment visualization
  const StackedProgress = ({ items }: { items: QuoteLineItem[] }) => {
    const totals = calculateSectionTotals(items)
    const stagedTotals = calculateStagedSectionTotals(items)

    if (totals.qtyOrdered === 0) return null

    const fulfilledPercent = (totals.qtyFulfilled / totals.qtyOrdered) * 100
    const stagedPercent = (stagedTotals.stagedQty / totals.qtyOrdered) * 100

    return (
      <div className="h-2 w-32 bg-muted rounded-full overflow-hidden flex" title={`Fulfilled: ${totals.qtyFulfilled}, Staged: ${stagedTotals.stagedQty}, Remaining: ${totals.qtyPending - stagedTotals.stagedQty}`}>
        {/* Fulfilled portion - solid green */}
        <div
          className="h-full bg-green-600 dark:bg-green-500"
          style={{ width: `${fulfilledPercent}%` }}
        />
        {/* Staged portion - lighter green */}
        <div
          className="h-full bg-green-300 dark:bg-green-700"
          style={{ width: `${stagedPercent}%` }}
        />
      </div>
    )
  }

  // Inline editing handlers for staging
  const startEditing = (item: QuoteLineItem) => {
    if (item.qty_pending === 0) return // Can't edit fully fulfilled items
    setEditingLineItemId(item.id)
    // Pre-fill with staged value if exists, otherwise empty
    const staged = stagedFulfillments.get(item.id)
    setEditingValue(staged?.toString() || "")
  }

  const handleInlineEditComplete = (item: QuoteLineItem) => {
    const qty = parseFloat(editingValue)
    const newStaged = new Map(stagedFulfillments)

    if (isNaN(qty) || qty <= 0) {
      // Remove staged fulfillment if invalid or zero
      newStaged.delete(item.id)
    } else if (qty > item.qty_pending) {
      // Cap at max pending
      newStaged.set(item.id, item.qty_pending)
    } else {
      newStaged.set(item.id, qty)
    }

    setStagedFulfillments(newStaged)
    setEditingLineItemId(null)
    setEditingValue("")
  }

  const handleInlineEditCancel = () => {
    setEditingLineItemId(null)
    setEditingValue("")
  }

  const handleInlineEditKeyDown = (e: React.KeyboardEvent, item: QuoteLineItem) => {
    if (e.key === "Enter") {
      e.preventDefault()
      handleInlineEditComplete(item)
    } else if (e.key === "Escape") {
      e.preventDefault()
      handleInlineEditCancel()
    }
  }

  const clearStagedFulfillment = (itemId: number) => {
    const newStaged = new Map(stagedFulfillments)
    newStaged.delete(itemId)
    setStagedFulfillments(newStaged)
  }

  // Get total staged items count
  const stagedCount = stagedFulfillments.size

  // Create invoice from staged fulfillments
  const handleCreateInvoice = async () => {
    if (stagedFulfillments.size === 0) return

    setIsCreatingInvoice(true)
    setConfirmDialogOpen(false) // Close confirmation dialog
    try {
      const fulfillments = Array.from(stagedFulfillments.entries()).map(([lineItemId, qty]) => ({
        line_item_id: lineItemId,
        quantity: qty
      }))

      const invoiceData: InvoiceCreate = {
        fulfillments,
        notes: undefined
      }

      await api.quotes.createInvoice(quoteId, invoiceData)

      // Clear staged fulfillments and refresh
      setStagedFulfillments(new Map())
      fetchQuote()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create invoice")
    } finally {
      setIsCreatingInvoice(false)
    }
  }

  // Fulfill All handler - stages all items in section for fulfillment
  const handleFulfillAll = (itemType: LineItemType) => {
    if (!quote) return

    const itemsToFulfill = quote.line_items.filter(
      item => item.item_type === itemType && item.qty_pending > 0
    )

    if (itemsToFulfill.length === 0) return

    const newStagedFulfillments = new Map(stagedFulfillments)
    itemsToFulfill.forEach(item => {
      newStagedFulfillments.set(item.id, item.qty_pending)
    })

    setStagedFulfillments(newStagedFulfillments)
  }

  // Clear All Staged handler - clears all staged items in section
  const handleClearAllStaged = (itemType: LineItemType) => {
    if (!quote) return

    const newStaged = new Map(stagedFulfillments)
    quote.line_items
      .filter(item => item.item_type === itemType)
      .forEach(item => newStaged.delete(item.id))

    setStagedFulfillments(newStaged)
  }

  // Get button state for a section (fulfill, clear, or disabled)
  const getSectionButtonState = (items: QuoteLineItem[]): 'fulfill' | 'clear' | 'disabled' => {
    const pendingItems = items.filter(item => item.qty_pending > 0)
    if (pendingItems.length === 0) return 'disabled' // Nothing to stage

    const allFullyStaged = pendingItems.every(item => {
      const staged = stagedFulfillments.get(item.id)
      return staged === item.qty_pending
    })

    return allFullyStaged ? 'clear' : 'fulfill'
  }

  // Open bulk stage dialog for a section
  const handleOpenBulkStageDialog = (itemType: LineItemType) => {
    setBulkStageSection(itemType)
    setBulkStagePercent("50")
    setBulkStageDialogOpen(true)
  }

  // Apply bulk stage by percentage
  const handleBulkStageByPercent = () => {
    if (!quote || !bulkStageSection) return

    const percent = parseFloat(bulkStagePercent) / 100
    if (isNaN(percent) || percent <= 0 || percent > 1) return

    const newStaged = new Map(stagedFulfillments)

    quote.line_items
      .filter(item => item.item_type === bulkStageSection && item.qty_pending > 0)
      .forEach(item => {
        const stageQty = Math.round(item.qty_pending * percent * 100) / 100 // 2 decimal places
        if (stageQty > 0) {
          newStaged.set(item.id, stageQty)
        }
      })

    setStagedFulfillments(newStaged)
    setBulkStageDialogOpen(false)
  }

  // Discount All handlers
  const handleOpenDiscountAll = (itemType: LineItemType) => {
    setDiscountAllSection(itemType)
    setSelectedBulkDiscountCodeId("")
    setDiscountAllDialogOpen(true)
  }

  const handleApplyDiscountAll = async () => {
    if (!quote || !discountAllSection || !selectedBulkDiscountCodeId) return

    setApplyingDiscount(true)

    const itemsToUpdate = quote.line_items.filter(
      item => item.item_type === discountAllSection
    )

    try {
      for (const item of itemsToUpdate) {
        await api.quotes.updateLine(quote.id, item.id, {
          discount_code_id: selectedBulkDiscountCodeId === "none"
            ? 0  // 0 to remove discount
            : parseInt(selectedBulkDiscountCodeId)
        })
      }

      await fetchQuote()
      setDiscountAllDialogOpen(false)
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to apply discounts")
    } finally {
      setApplyingDiscount(false)
    }
  }

  // Clone quote handler
  const handleCloneQuote = async () => {
    if (!quote) return

    setIsCloning(true)
    try {
      const clonedQuote = await api.quotes.clone(quote.id)
      onUpdate?.()
      if (onSelectQuote) {
        onSelectQuote(clonedQuote.id)
      } else {
        alert(`Quote cloned successfully! New Quote #${clonedQuote.id}`)
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to clone quote")
    } finally {
      setIsCloning(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  }

  if (error || !quote) {
    return (
      <div className="p-8">
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
          {error || "Quote not found"}
        </div>
      </div>
    )
  }

  // Render a section with table for a specific item type
  const renderLineItemSection = (
    title: string,
    items: QuoteLineItem[],
    type: LineItemType,
    icon: React.ReactNode,
    addButtonLabel: string,
    extraButtons?: React.ReactNode
  ) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base flex items-center gap-2">
              {icon}
              {title}
            </CardTitle>
            {items.length > 0 && <StackedProgress items={items} />}
          </div>
          <div className="flex gap-2">
            {getSectionButtonState(items) === 'clear' ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleClearAllStaged(type)}
                className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950"
              >
                <X className="h-4 w-4 mr-1" />
                Clear All Staged
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFulfillAll(type)}
                disabled={getSectionButtonState(items) === 'disabled'}
              >
                <ClipboardCheck className="h-4 w-4 mr-1" />
                Fulfill All
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenBulkStageDialog(type)}
              disabled={!items.some(item => item.qty_pending > 0)}
              title="Stage percentage of pending quantities"
            >
              <Percent className="h-4 w-4 mr-1" />
              Stage %
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenDiscountAll(type)}
              disabled={quote?.markup_control_enabled || items.length === 0}
            >
              <Tag className="h-4 w-4 mr-1" />
              Discount All
            </Button>
            {extraButtons}
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddDialog(type)}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {addButtonLabel}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No {title.toLowerCase()} items yet.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Qty Ordered</TableHead>
                <TableHead className="text-right">Qty Pending</TableHead>
                <TableHead className="text-right">Qty Fulfilled</TableHead>
                <TableHead className="text-right">Fulfilled Price</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead className="text-center">Discount</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => {
                const staged = stagedFulfillments.get(item.id)
                return (
                  <TableRow key={item.id} className={`${staged ? "border-l-4 border-l-green-500 dark:border-l-green-400" : ""} ${item.qty_pending === 0 ? "opacity-50" : ""}`}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{getLineItemDescription(item)}</span>
                        {item.item_type === "part" && item.part && (
                          <span className="text-muted-foreground ml-2">- {item.part.description}</span>
                        )}
                        {staged && (
                          <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                            Staged: {staged}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      {editingLineItemId === item.id ? (
                        <Input
                          type="number"
                          step="1"
                          min="0"
                          max={item.qty_pending}
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={() => handleInlineEditComplete(item)}
                          onKeyDown={(e) => handleInlineEditKeyDown(e, item)}
                          className="w-20 h-8 text-right"
                          autoFocus
                        />
                      ) : (
                        <button
                          onClick={() => startEditing(item)}
                          disabled={item.qty_pending === 0}
                          className={`px-2 py-1 rounded transition-colors ${
                            item.qty_pending === 0
                              ? "text-muted-foreground cursor-not-allowed"
                              : staged
                              ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
                              : "hover:bg-muted cursor-pointer"
                          }`}
                          title={item.qty_pending > 0 ? "Click to stage for fulfillment" : "Fully fulfilled"}
                        >
                          {item.qty_pending}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={item.qty_fulfilled > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                        {item.qty_fulfilled}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      {item.qty_fulfilled > 0 ? (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          ${getFulfilledLineItemValue(item).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      ${getLineItemUnitPrice(item).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      {item.discount_code ? (
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {item.discount_code.code} (-{item.discount_code.discount_percent}%)
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {item.discount_code ? (
                        <div>
                          <span className="line-through text-muted-foreground text-sm">
                            ${getLineItemSubtotal(item).toFixed(2)}
                          </span>
                          <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                            ${getLineItemTotal(item).toFixed(2)}
                          </span>
                        </div>
                      ) : (
                        <span className="font-medium">${getLineItemTotal(item).toFixed(2)}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(item)}
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {staged && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => clearStagedFulfillment(item.id)}
                          title="Clear staged"
                          className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLine(item.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
            {items.length > 0 && (
              <TableFooter>
                <TableRow className="bg-muted/50">
                  <TableCell className="font-semibold">Section Total</TableCell>
                  <TableCell className="text-right font-semibold">{calculateSectionTotals(items).qtyOrdered}</TableCell>
                  <TableCell className="text-right font-semibold">{calculateSectionTotals(items).qtyPending}</TableCell>
                  <TableCell className="text-right font-semibold">{calculateSectionTotals(items).qtyFulfilled}</TableCell>
                  <TableCell className="text-right font-semibold">
                    {calculateSectionTotals(items).qtyFulfilled > 0 ? (
                      <span className="text-green-600 dark:text-green-400">
                        ${calculateSectionTotals(items).fulfilledValue.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell></TableCell>
                  <TableCell></TableCell>
                  <TableCell className="text-right font-bold">${calculateSectionTotals(items).total.toFixed(2)}</TableCell>
                  <TableCell></TableCell>
                </TableRow>
                {calculateStagedSectionTotals(items).itemCount > 0 && (
                  <TableRow className="bg-green-50/50 dark:bg-green-950/50 border-t-2 border-green-200 dark:border-green-800">
                    <TableCell className="font-semibold text-green-700 dark:text-green-300">
                      Staging for Invoice
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-semibold text-green-700 dark:text-green-300">
                      {calculateStagedSectionTotals(items).stagedQty}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold text-green-700 dark:text-green-300">
                      ${calculateStagedSectionTotals(items).stagedTotal.toFixed(2)}
                    </TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                )}
              </TableFooter>
            )}
          </Table>
        )}
      </CardContent>
    </Card>
  )

  return (
    <div className="p-6 space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Quote #{quote.id}</h2>
          <p className="text-sm text-muted-foreground">
            Created: {new Date(quote.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloneQuote}
            disabled={isCloning}
            className="gap-2"
          >
            <Copy className="h-4 w-4" />
            {isCloning ? "Cloning..." : "Clone Quote"}
          </Button>
          <Select value={quote.status} onValueChange={(v) => handleStatusChange(v as QuoteStatus)}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Active">Active</SelectItem>
              <SelectItem value="Invoiced">Invoiced</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Client PO Number */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Client PO Number
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditingClientPo ? (
            <div className="flex items-center gap-2">
              <Input
                value={clientPoNumber}
                onChange={(e) => setClientPoNumber(e.target.value)}
                placeholder="Enter client PO number"
                className="max-w-xs"
              />
              <Button
                size="sm"
                onClick={handleSaveClientPoNumber}
                disabled={savingClientPo}
              >
                {savingClientPo ? "Saving..." : "Save"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setClientPoNumber(quote.client_po_number || "")
                  setIsEditingClientPo(false)
                }}
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {quote.client_po_number ? (
                <span className="font-medium">{quote.client_po_number}</span>
              ) : (
                <span className="text-muted-foreground italic">Not set</span>
              )}
              <Button size="sm" variant="ghost" onClick={() => setIsEditingClientPo(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          {!quote.client_po_number && (
            <p className="text-sm text-amber-600 mt-2">
              A Client PO Number is required before you can create an invoice.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Work Description */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Work Description
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isEditingWorkDescription ? (
            <div className="space-y-2">
              <Textarea
                value={workDescription}
                onChange={(e) => setWorkDescription(e.target.value)}
                placeholder="Describe the work covered by this quote..."
                rows={4}
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleSaveWorkDescription}
                  disabled={savingWorkDescription}
                >
                  {savingWorkDescription ? "Saving..." : "Save"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setWorkDescription(quote.work_description || "")
                    setIsEditingWorkDescription(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              {quote.work_description ? (
                <p className="whitespace-pre-wrap">{quote.work_description}</p>
              ) : (
                <span className="text-muted-foreground italic">Not set</span>
              )}
              <Button size="sm" variant="ghost" onClick={() => setIsEditingWorkDescription(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Markup Discount Control */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <CardTitle className="text-base flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Markup Discount Control
            </CardTitle>
            <div className="flex items-center gap-3">
              {quote.markup_control_enabled && quote.global_markup_percent !== null && (
                <button
                  onClick={handleOpenEditMarkup}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-100 dark:hover:bg-blue-900 transition-colors cursor-pointer"
                  title="Click to edit global markup"
                >
                  Global Markup: {quote.global_markup_percent}%
                  <Pencil className="h-3 w-3" />
                </button>
              )}
              <Button
                size="sm"
                variant={quote.markup_control_enabled ? "default" : "outline"}
                onClick={handleToggleMarkupControl}
                disabled={togglingMarkupControl}
              >
                {togglingMarkupControl ? "..." : (quote.markup_control_enabled ? "Enabled" : "Disabled")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {quote.markup_control_enabled
              ? "Global markup is applied to all items. Discount codes are disabled."
              : "Enable to apply a global markup percentage to all line items (excluding PMS items)."}
          </p>
        </CardContent>
      </Card>

      {/* Parts Section */}
      {renderLineItemSection("Parts", partItems, "part", <Package className="h-4 w-4" />, "Add Part")}

      {/* Labor Section - Custom render with PMS buttons */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="h-4 w-4" />
                Labour
              </CardTitle>
              {laborItems2.length > 0 && <StackedProgress items={laborItems2} />}
            </div>
            <div className="flex gap-2">
              {getSectionButtonState(laborItems2) === 'clear' ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleClearAllStaged("labor")}
                  className="text-green-600 dark:text-green-400 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                >
                  <X className="h-4 w-4 mr-1" />
                  Clear All Staged
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFulfillAll("labor")}
                  disabled={getSectionButtonState(laborItems2) === 'disabled'}
                >
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                  Fulfill All
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenBulkStageDialog("labor")}
                disabled={!laborItems2.some(item => item.qty_pending > 0)}
                title="Stage percentage of pending quantities"
              >
                <Percent className="h-4 w-4 mr-1" />
                Stage %
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleOpenDiscountAll("labor")}
                disabled={quote?.markup_control_enabled || laborItems2.length === 0}
              >
                <Tag className="h-4 w-4 mr-1" />
                Discount All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openPmsDialog("dollar")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add PMS $
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openPmsDialog("percent")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add PMS %
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openAddDialog("labor")}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Labour
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {laborItems2.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No labour items yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty Ordered</TableHead>
                  <TableHead className="text-right">Qty Pending</TableHead>
                  <TableHead className="text-right">Qty Fulfilled</TableHead>
                  <TableHead className="text-right">Fulfilled Price</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-center">Discount</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laborItems2.map((item) => {
                  const staged = stagedFulfillments.get(item.id)
                  const effectivePrice = getEffectiveUnitPrice(item)
                  const effectiveSubtotal = effectivePrice * item.quantity
                  const effectiveTotal = item.discount_code
                    ? effectiveSubtotal * (1 - item.discount_code.discount_percent / 100)
                    : effectiveSubtotal
                  return (
                    <TableRow key={item.id} className={`${staged ? "border-l-4 border-l-green-500 dark:border-l-green-400" : ""} ${item.qty_pending === 0 ? "opacity-50" : ""}`}>
                      <TableCell>
                        <div>
                          <span className="font-medium">{getLineItemDescription(item)}</span>
                          {item.is_pms && item.pms_percent != null && (
                            <span className="text-xs text-muted-foreground ml-1">({item.pms_percent}%)</span>
                          )}
                          {staged && (
                            <Badge variant="outline" className="ml-2 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700">
                              Staged: {staged}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">
                        {editingLineItemId === item.id ? (
                          <Input
                            type="number"
                            step="1"
                            min="0"
                            max={item.qty_pending}
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleInlineEditComplete(item)}
                            onKeyDown={(e) => handleInlineEditKeyDown(e, item)}
                            className="w-20 h-8 text-right"
                            autoFocus
                          />
                        ) : (
                          <button
                            onClick={() => startEditing(item)}
                            disabled={item.qty_pending === 0}
                            className={`px-2 py-1 rounded transition-colors ${
                              item.qty_pending === 0
                                ? "text-muted-foreground cursor-not-allowed"
                                : staged
                                ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
                                : "hover:bg-muted cursor-pointer"
                            }`}
                            title={item.qty_pending > 0 ? "Click to stage for fulfillment" : "Fully fulfilled"}
                          >
                            {item.qty_pending}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={item.qty_fulfilled > 0 ? "text-green-600 dark:text-green-400 font-medium" : "text-muted-foreground"}>
                          {item.qty_fulfilled}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        {item.qty_fulfilled > 0 ? (
                          <span className="text-green-600 dark:text-green-400 font-medium">
                            ${getFulfilledLineItemValue(item).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        ${effectivePrice.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {item.discount_code ? (
                          <Badge variant="outline" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {item.discount_code.code} (-{item.discount_code.discount_percent}%)
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {item.discount_code ? (
                          <div>
                            <span className="line-through text-muted-foreground text-sm">
                              ${effectiveSubtotal.toFixed(2)}
                            </span>
                            <span className="ml-2 font-medium text-green-600 dark:text-green-400">
                              ${effectiveTotal.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span className="font-medium">${effectiveTotal.toFixed(2)}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {staged && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => clearStagedFulfillment(item.id)}
                            title="Clear staged"
                            className="text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteLine(item.id)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
              {laborItems2.length > 0 && (
                <TableFooter>
                  <TableRow className="bg-muted/50">
                    <TableCell className="font-semibold">Section Total</TableCell>
                    <TableCell className="text-right font-semibold">{calculateSectionTotals(laborItems2, true).qtyOrdered}</TableCell>
                    <TableCell className="text-right font-semibold">{calculateSectionTotals(laborItems2, true).qtyPending}</TableCell>
                    <TableCell className="text-right font-semibold">{calculateSectionTotals(laborItems2, true).qtyFulfilled}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {calculateSectionTotals(laborItems2, true).qtyFulfilled > 0 ? (
                        <span className="text-green-600 dark:text-green-400">
                          ${calculateSectionTotals(laborItems2, true).fulfilledValue.toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell></TableCell>
                    <TableCell></TableCell>
                    <TableCell className="text-right font-bold">${calculateSectionTotals(laborItems2, true).total.toFixed(2)}</TableCell>
                    <TableCell></TableCell>
                  </TableRow>
                  {calculateStagedSectionTotals(laborItems2).itemCount > 0 && (
                    <TableRow className="bg-green-50/50 dark:bg-green-950/50 border-t-2 border-green-200 dark:border-green-800">
                      <TableCell className="font-semibold text-green-700 dark:text-green-300">
                        Staging for Invoice
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-semibold text-green-700 dark:text-green-300">
                        {calculateStagedSectionTotals(laborItems2).stagedQty}
                      </TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right font-bold text-green-700 dark:text-green-300">
                        ${calculateStagedSectionTotals(laborItems2).stagedTotal.toFixed(2)}
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  )}
                </TableFooter>
              )}
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Misc Section */}
      {renderLineItemSection("Miscellaneous", miscItems2, "misc", <FileText className="h-4 w-4" />, "Add Misc", (
        <>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCalculateAndAddParking}
            disabled={addingParking}
            className="gap-2"
          >
            <Car className="h-4 w-4" />
            {addingParking ? "Adding..." : "Parking"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenTravelDistanceDialog}
            className="gap-2"
          >
            <MapPin className="h-4 w-4" />
            Travel
          </Button>
        </>
      ))}

      {/* Total Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Average Markup with formula tooltip */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Average Markup:</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Weighted Average = Σ(Markup% × Base Cost × Qty) / Σ(Base Cost × Qty)
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        Parts: Base Cost = Part Cost | Labor: Hours × Rate | Misc: Unit Price
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-lg font-semibold">{calculateAverageMarkup().toFixed(2)}%</span>
            </div>

            {/* Total Margin with formula tooltip */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-muted-foreground">Total Margin:</span>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">
                        Margin % = (Selling Price - Mfg Cost) / Selling Price × 100
                      </p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        Manufacturing Cost = Parts cost only (Labor/Misc = $0)
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <span className="text-lg font-semibold">{calculateTotalMargin().toFixed(2)}%</span>
            </div>

            <Separator />

            {/* Quote Total (existing) */}
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">Quote Total:</span>
              <span className="text-2xl font-bold">${calculateTotal().toFixed(2)}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Trail */}
      <QuoteAuditTrail
        quoteId={quoteId}
        currentVersion={quote.current_version}
        onRevert={() => {
          fetchQuote()
          onUpdate?.()
        }}
      />

      {/* Floating Staging Summary Card */}
      {stagedFulfillments.size > 0 && (
        <Card className="fixed bottom-24 right-6 w-80 shadow-lg border-green-200 dark:border-green-800 bg-card z-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4 text-green-600 dark:text-green-400" />
              Staging Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {/* Per-section breakdown */}
            {calculateStagedSectionTotals(partItems).itemCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Parts ({calculateStagedSectionTotals(partItems).itemCount} items)
                </span>
                <span className="font-medium">
                  ${calculateStagedSectionTotals(partItems).stagedTotal.toFixed(2)}
                </span>
              </div>
            )}
            {calculateStagedSectionTotals(laborItems2).itemCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Labour ({calculateStagedSectionTotals(laborItems2).itemCount} items)
                </span>
                <span className="font-medium">
                  ${calculateStagedSectionTotals(laborItems2).stagedTotal.toFixed(2)}
                </span>
              </div>
            )}
            {calculateStagedSectionTotals(miscItems2).itemCount > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  Misc ({calculateStagedSectionTotals(miscItems2).itemCount} items)
                </span>
                <span className="font-medium">
                  ${calculateStagedSectionTotals(miscItems2).stagedTotal.toFixed(2)}
                </span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total Staging</span>
              <span className="text-green-600 dark:text-green-400">
                ${calculateStagedGrandTotal().stagedTotal.toFixed(2)}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Invoice Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex flex-col items-end gap-2">
          {!quote.client_po_number && stagedCount > 0 && (
            <span className="text-sm text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-400 px-3 py-1 rounded-md shadow-sm">
              Client PO Number required
            </span>
          )}
          <div className="flex gap-2">
            {stagedCount > 0 && (
              <Button
                size="lg"
                variant="outline"
                onClick={() => setPreviewModalOpen(true)}
                className="shadow-lg gap-2"
              >
                <FileText className="h-5 w-5" />
                Preview
              </Button>
            )}
            <Button
              size="lg"
              onClick={() => setConfirmDialogOpen(true)}
              disabled={stagedCount === 0 || isCreatingInvoice || !quote.client_po_number}
              className="shadow-lg gap-2"
            >
              <Receipt className="h-5 w-5" />
              {isCreatingInvoice ? "Creating..." : `Create Invoice${stagedCount > 0 ? ` (${stagedCount} items)` : ""}`}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Line Item Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getTypeIcon(addDialogType)}
              Add {addDialogType === "labor" ? "Labour" : addDialogType.charAt(0).toUpperCase() + addDialogType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Add a {addDialogType === "labor" ? "labour" : addDialogType} line item to this quote.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {addDialogType === "labor" && (
              <div className="space-y-2">
                <Label>Labour Item</Label>
                <SearchableSelect<Labor>
                  options={laborItems.map((labor): SearchableSelectOption => ({
                    value: labor.id.toString(),
                    label: labor.description,
                    description: `$${labor.rate}/hr x ${labor.hours}hrs`,
                  }))}
                  value={selectedLaborId}
                  onChange={setSelectedLaborId}
                  placeholder="Select labour"
                  searchPlaceholder="Search labour items..."
                  emptyMessage="No labour items found."
                  allowCreate={true}
                  createLabel="Create New Labour"
                  createDialogTitle="Create New Labour Item"
                  createForm={<LaborForm />}
                  onCreateSuccess={(newLabor) => {
                    setLaborItems([...laborItems, newLabor])
                    setSelectedLaborId(newLabor.id.toString())
                  }}
                />
              </div>
            )}

            {addDialogType === "part" && (
              <div className="space-y-2">
                <Label>Part</Label>
                <SearchableSelect<Part>
                  options={parts.map((part): SearchableSelectOption => ({
                    value: part.id.toString(),
                    label: `${part.part_number} - ${part.description}`,
                    description: `$${(part.cost * (1 + (part.markup_percent ?? 0) / 100)).toFixed(2)}${part.labor_items && part.labor_items.length > 0 ? ` (${part.labor_items.length} linked labour)` : ''}`,
                  }))}
                  value={selectedPartId}
                  onChange={setSelectedPartId}
                  placeholder="Select part"
                  searchPlaceholder="Search parts..."
                  emptyMessage="No parts found."
                  allowCreate={true}
                  createLabel="Create New Part"
                  createDialogTitle="Create New Part"
                  createForm={<PartForm />}
                  onCreateSuccess={(newPart) => {
                    setParts([...parts, newPart])
                    setSelectedPartId(newPart.id.toString())
                  }}
                />
              </div>
            )}

            {addDialogType === "misc" && (
              <div className="space-y-2">
                <Label>Miscellaneous Item</Label>
                <SearchableSelect<Miscellaneous>
                  options={miscItems.map((misc): SearchableSelectOption => ({
                    value: misc.id.toString(),
                    label: misc.description,
                    description: `$${(misc.unit_price * (1 + misc.markup_percent / 100)).toFixed(2)}`,
                  }))}
                  value={selectedMiscId}
                  onChange={setSelectedMiscId}
                  placeholder="Select misc item"
                  searchPlaceholder="Search misc items..."
                  emptyMessage="No miscellaneous items found."
                  allowCreate={true}
                  createLabel="Create New Misc Item"
                  createDialogTitle="Create New Miscellaneous Item"
                  createForm={<MiscForm />}
                  onCreateSuccess={(newMisc) => {
                    setMiscItems([...miscItems, newMisc])
                    setSelectedMiscId(newMisc.id.toString())
                  }}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Quantity</Label>
              <Input
                type="number"
                step="1"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </div>

            <Button
              onClick={handleAddLineItem}
              className="w-full"
              disabled={
                (addDialogType === "labor" && (!selectedLaborId || laborItems.length === 0)) ||
                (addDialogType === "part" && (!selectedPartId || parts.length === 0)) ||
                (addDialogType === "misc" && (!selectedMiscId || miscItems.length === 0))
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Line Item Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Line Item</DialogTitle>
            <DialogDescription>
              Update the quantity or apply a discount code.
            </DialogDescription>
          </DialogHeader>

          {editingLineItem && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">{getDescriptionLabel(editingLineItem)}</p>
                <p className="text-lg">{getLineItemDescription(editingLineItem)}</p>
              </div>

              <div className="space-y-2">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  step="1"
                  min="1"
                  value={editQuantity}
                  onChange={(e) => setEditQuantity(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Unit Price</Label>
                <div className="px-3 py-2 bg-muted/50 rounded-md text-muted-foreground">
                  ${getLineItemUnitPrice(editingLineItem).toFixed(2)}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Discount Code</Label>
                {quote?.markup_control_enabled ? (
                  <div className="px-3 py-2 bg-muted/50 rounded-md text-muted-foreground text-sm">
                    Discount codes disabled while Markup Control is enabled
                  </div>
                ) : (
                  <SearchableSelect<DiscountCode>
                    options={[
                      { value: "none", label: "No discount", description: undefined },
                      ...discountCodes.map((code): SearchableSelectOption => ({
                        value: code.id.toString(),
                        label: code.code,
                        description: `-${code.discount_percent.toFixed(2)}%`,
                      }))
                    ]}
                    value={editDiscountCodeId}
                    onChange={setEditDiscountCodeId}
                    placeholder="No discount"
                    searchPlaceholder="Search discount codes..."
                    allowCreate={true}
                    createLabel="Create New Discount Code"
                    createDialogTitle="Create New Discount Code"
                    createForm={<DiscountCodeForm />}
                    onCreateSuccess={(newCode) => {
                      setDiscountCodes([...discountCodes, newCode])
                      setEditDiscountCodeId(newCode.id.toString())
                    }}
                  />
                )}
              </div>

              <Button onClick={handleUpdateLineItem} className="w-full">
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auto-Add Labor Confirmation Dialog */}
      <Dialog open={autoAddLaborDialogOpen} onOpenChange={setAutoAddLaborDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Linked Labour Items?</DialogTitle>
            <DialogDescription>
              This part has {linkedLaborToAdd.length} linked labour item(s). Would you like to add them to the quote as well?
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-4">
            <p className="text-sm font-medium">Part: {pendingPart?.part_number} - {pendingPart?.description}</p>
            <div className="bg-muted/50 p-3 rounded-md space-y-2">
              <p className="text-sm font-medium">Linked Labour Items:</p>
              {linkedLaborToAdd.map((labor) => (
                <div key={labor.id} className="flex justify-between text-sm">
                  <span>{labor.description}</span>
                  <span className="text-muted-foreground">
                    ${(labor.hours * labor.rate * (1 + labor.markup_percent / 100)).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleSkipAutoAddLabor}>
              Just Add Part
            </Button>
            <Button onClick={handleConfirmAutoAddLabor}>
              Add Part + Labour
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PMS (Project Management Services) Dialog */}
      <Dialog open={pmsDialogOpen} onOpenChange={setPmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4" />
              {pmsType === "percent" ? "Add PMS %" : "Add PMS $"}
            </DialogTitle>
            <DialogDescription>
              {pmsType === "percent"
                ? "Enter a percentage of the non-PMS quote total. This will dynamically update as the quote changes."
                : "Enter the dollar amount for Project Management Services."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {pmsType === "percent" && (
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm text-muted-foreground">Current Non-PMS Total</p>
                <p className="text-lg font-semibold">${calculateNonPmsTotal().toFixed(2)}</p>
              </div>
            )}
            <div className="space-y-2">
              <Label>{pmsType === "percent" ? "Percentage (%)" : "Amount ($)"}</Label>
              <Input
                type="number"
                step={pmsType === "percent" ? "0.1" : "0.01"}
                min="0"
                value={pmsValue}
                onChange={(e) => setPmsValue(e.target.value)}
                placeholder={pmsType === "percent" ? "e.g., 10" : "e.g., 500.00"}
              />
              {pmsType === "percent" && pmsValue && !isNaN(parseFloat(pmsValue)) && (
                <p className="text-sm text-muted-foreground">
                  = ${(calculateNonPmsTotal() * parseFloat(pmsValue) / 100).toFixed(2)}
                </p>
              )}
            </div>
            <Button onClick={handleAddPmsItem} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Project Management Services
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Markup Control Enable Dialog */}
      <Dialog open={markupControlDialogOpen} onOpenChange={setMarkupControlDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Enable Markup Discount Control
            </DialogTitle>
            <DialogDescription>
              Enter the global markup percentage to apply to all line items (excluding PMS items).
              This will replace individual item markups.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Global Markup Percentage (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={pendingMarkupPercent}
                onChange={(e) => setPendingMarkupPercent(e.target.value)}
                placeholder="e.g., 15.00"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setMarkupControlDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmEnableMarkupControl}
                disabled={togglingMarkupControl || !pendingMarkupPercent}
              >
                {togglingMarkupControl ? "Applying..." : "Enable Markup Control"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Markup Percent Dialog */}
      <Dialog open={editMarkupDialogOpen} onOpenChange={setEditMarkupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              Edit Global Markup
            </DialogTitle>
            <DialogDescription>
              Update the global markup percentage. All line items (excluding PMS) will be recalculated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Global Markup Percentage (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={editingMarkupPercent}
                onChange={(e) => setEditingMarkupPercent(e.target.value)}
                placeholder="e.g., 15.00"
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditMarkupDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirmUpdateMarkup}
                disabled={updatingMarkupPercent || !editingMarkupPercent}
              >
                {updatingMarkupPercent ? "Updating..." : "Update Markup"}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invoice Creation Confirmation Dialog */}
      <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create Invoice?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to create an invoice for {stagedFulfillments.size} item{stagedFulfillments.size !== 1 ? 's' : ''} totaling{' '}
              <span className="font-semibold text-green-600 dark:text-green-400">
                ${calculateStagedGrandTotal().stagedTotal.toFixed(2)}
              </span>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleCreateInvoice}>
              Create Invoice
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Invoice Preview Modal */}
      <Dialog open={previewModalOpen} onOpenChange={setPreviewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Invoice Preview
            </DialogTitle>
            <DialogDescription>
              Review the staged items before creating the invoice.
            </DialogDescription>
          </DialogHeader>

          {/* Comparison Breakdown */}
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="p-4 bg-muted/30 rounded-lg">
              <p className="text-xs text-muted-foreground">Quote Total</p>
              <p className="text-xl font-bold">${calculateTotal().toFixed(2)}</p>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <p className="text-xs text-blue-600 dark:text-blue-400">Already Invoiced</p>
              <p className="text-xl font-bold text-blue-600 dark:text-blue-400">
                ${calculateInvoicedTotals().invoicedTotal.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-green-50 dark:bg-green-950 rounded-lg border-2 border-green-300 dark:border-green-700">
              <p className="text-xs text-green-600 dark:text-green-400">Staging Now</p>
              <p className="text-xl font-bold text-green-600 dark:text-green-400">
                ${calculateStagedGrandTotal().stagedTotal.toFixed(2)}
              </p>
            </div>
            <div className="p-4 bg-orange-50 dark:bg-orange-950 rounded-lg">
              <p className="text-xs text-orange-600 dark:text-orange-400">Remaining After</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">
                ${(calculateTotal() - calculateInvoicedTotals().invoicedTotal - calculateStagedGrandTotal().stagedTotal).toFixed(2)}
              </p>
            </div>
          </div>

          <Separator />

          {/* Staged Items List */}
          <div className="max-h-64 overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Qty Staging</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {quote?.line_items
                  .filter(item => stagedFulfillments.has(item.id))
                  .map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant={getTypeBadgeVariant(item.item_type)}>
                            {item.item_type === "labor" ? "Labour" : item.item_type.charAt(0).toUpperCase() + item.item_type.slice(1)}
                          </Badge>
                          <span className="font-medium">{getLineItemDescription(item)}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">${getEffectiveUnitPrice(item).toFixed(2)}</TableCell>
                      <TableCell className="text-right font-medium text-green-600 dark:text-green-400">
                        {stagedFulfillments.get(item.id)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        ${getStagedLineItemTotal(item).toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewModalOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Stage by Percentage Dialog */}
      <Dialog open={bulkStageDialogOpen} onOpenChange={setBulkStageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Percent className="h-4 w-4" />
              Stage by Percentage
            </DialogTitle>
            <DialogDescription>
              Stage a percentage of pending quantities for all {bulkStageSection === "labor" ? "labour" : bulkStageSection} items.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Percentage of pending to stage</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="1"
                  max="100"
                  value={bulkStagePercent}
                  onChange={(e) => setBulkStagePercent(e.target.value)}
                  className="w-24"
                />
                <span className="text-muted-foreground">%</span>
              </div>
            </div>
            {/* Quick preset buttons */}
            <div className="flex gap-2">
              {[25, 50, 75, 100].map(pct => (
                <Button
                  key={pct}
                  variant={bulkStagePercent === pct.toString() ? "default" : "outline"}
                  size="sm"
                  onClick={() => setBulkStagePercent(pct.toString())}
                >
                  {pct}%
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkStageDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBulkStageByPercent}>
                Stage Items
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Discount All Dialog */}
      <Dialog open={discountAllDialogOpen} onOpenChange={setDiscountAllDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              Apply Discount to All {discountAllSection === "labor" ? "Labour" : discountAllSection === "part" ? "Parts" : "Miscellaneous"} Items
            </DialogTitle>
            <DialogDescription>
              Select a discount code to apply to all items in this section.
              This will replace any existing discounts.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Discount Code</Label>
              <Select
                value={selectedBulkDiscountCodeId}
                onValueChange={setSelectedBulkDiscountCodeId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select discount code" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Discount (Remove All)</SelectItem>
                  {discountCodes
                    .filter(dc => !dc.is_archived)
                    .map(dc => (
                      <SelectItem key={dc.id} value={dc.id.toString()}>
                        {dc.code} (-{dc.discount_percent}%)
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            {discountAllSection && (
              <p className="text-sm text-muted-foreground">
                This will update {quote?.line_items.filter(i => i.item_type === discountAllSection).length || 0} item(s)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountAllDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleApplyDiscountAll}
              disabled={!selectedBulkDiscountCodeId || applyingDiscount}
            >
              {applyingDiscount ? "Applying..." : "Apply to All"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Travel Distance Selection Dialog */}
      <Dialog open={travelDistanceDialogOpen} onOpenChange={setTravelDistanceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Select Travel Distance
            </DialogTitle>
            <DialogDescription>
              Choose a travel distance tier. The quantity will be calculated as days (labor hours / 8, rounded up).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-muted/50 p-3 rounded-md">
              <p className="text-sm text-muted-foreground">Total Labor Hours (excl. PMS)</p>
              <p className="text-lg font-semibold">{calculateTotalLaborHours().toFixed(1)} hours</p>
              <p className="text-sm text-muted-foreground mt-1">
                = {Math.ceil(calculateTotalLaborHours() / 8) || 0} day(s)
              </p>
            </div>

            <div className="space-y-2">
              <Label>Travel Distance Tier</Label>
              <Select
                value={selectedTravelDistanceId}
                onValueChange={setSelectedTravelDistanceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select travel distance..." />
                </SelectTrigger>
                <SelectContent>
                  {travelDistanceItems.map(item => (
                    <SelectItem key={item.id} value={item.id.toString()}>
                      {item.description} - ${(item.unit_price * (1 + item.markup_percent / 100)).toFixed(2)}/day
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedTravelDistanceId && (
              <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-md">
                <p className="text-sm font-medium">Preview:</p>
                <p className="text-sm">
                  {Math.ceil(calculateTotalLaborHours() / 8)} day(s) x $
                  {(travelDistanceItems.find(i => i.id.toString() === selectedTravelDistanceId)?.unit_price ?? 0) *
                   (1 + (travelDistanceItems.find(i => i.id.toString() === selectedTravelDistanceId)?.markup_percent ?? 0) / 100)
                  }
                  {" = $"}
                  {(Math.ceil(calculateTotalLaborHours() / 8) *
                    (travelDistanceItems.find(i => i.id.toString() === selectedTravelDistanceId)?.unit_price ?? 0) *
                    (1 + (travelDistanceItems.find(i => i.id.toString() === selectedTravelDistanceId)?.markup_percent ?? 0) / 100)
                  ).toFixed(2)}
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTravelDistanceDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmTravelDistance}
              disabled={!selectedTravelDistanceId || addingTravelDistance}
            >
              {addingTravelDistance ? "Adding..." : "Add Travel Distance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
