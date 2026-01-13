import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { api } from "@/api/client"
import type {
  Quote, QuoteLineItem, QuoteLineItemCreate, QuoteLineItemUpdate,
  LineItemType, Part, Labor, Miscellaneous, DiscountCode, QuoteStatus,
  StagedFulfillment, InvoiceCreate
} from "@/types"
import { Plus, Trash2, Wrench, Package, FileText, Pencil, Tag, ClipboardCheck, Receipt } from "lucide-react"
import { QuoteAuditTrail } from "./QuoteAuditTrail"

interface QuoteEditorProps {
  quoteId: number
  onUpdate?: () => void
}

export function QuoteEditor({ quoteId, onUpdate }: QuoteEditorProps) {
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

  // Fulfill dialog states
  const [fulfillDialogOpen, setFulfillDialogOpen] = useState(false)
  const [fulfillLineItem, setFulfillLineItem] = useState<QuoteLineItem | null>(null)
  const [fulfillQuantity, setFulfillQuantity] = useState("")

  // Staged fulfillments (session only - not persisted until invoice created)
  const [stagedFulfillments, setStagedFulfillments] = useState<Map<number, number>>(new Map())

  // Creating invoice
  const [isCreatingInvoice, setIsCreatingInvoice] = useState(false)

  const fetchQuote = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.quotes.get(quoteId)
      setQuote(data)
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
        lineItem.unit_price = misc.rate * misc.hours * (1 + misc.markup_percent / 100)
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

  const getLineItemDescription = (item: QuoteLineItem): string => {
    if (item.item_type === "labor" && item.labor) {
      return item.labor.description
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
      return item.miscellaneous.hours * item.miscellaneous.rate * (1 + item.miscellaneous.markup_percent / 100)
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

  const calculateTotal = (): number => {
    if (!quote) return 0
    return quote.line_items.reduce((sum, item) => sum + getLineItemTotal(item), 0)
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

  // Fulfill dialog handlers
  const openFulfillDialog = (item: QuoteLineItem) => {
    setFulfillLineItem(item)
    // Pre-fill with staged value if exists, otherwise empty
    const staged = stagedFulfillments.get(item.id)
    setFulfillQuantity(staged?.toString() || "")
    setFulfillDialogOpen(true)
  }

  const handleStageFulfillment = () => {
    if (!fulfillLineItem) return
    const qty = parseFloat(fulfillQuantity)
    if (isNaN(qty) || qty <= 0) {
      // Remove staged fulfillment if invalid or zero
      const newStaged = new Map(stagedFulfillments)
      newStaged.delete(fulfillLineItem.id)
      setStagedFulfillments(newStaged)
    } else if (qty > fulfillLineItem.qty_pending) {
      alert(`Cannot fulfill more than ${fulfillLineItem.qty_pending} (pending quantity)`)
      return
    } else {
      const newStaged = new Map(stagedFulfillments)
      newStaged.set(fulfillLineItem.id, qty)
      setStagedFulfillments(newStaged)
    }
    setFulfillDialogOpen(false)
    setFulfillLineItem(null)
    setFulfillQuantity("")
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
    addButtonLabel: string
  ) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle className="text-base flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
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
                  <TableRow key={item.id} className={staged ? "bg-green-50" : undefined}>
                    <TableCell>
                      <div>
                        <span className="font-medium">{getLineItemDescription(item)}</span>
                        {item.item_type === "part" && item.part && (
                          <span className="text-muted-foreground ml-2">- {item.part.description}</span>
                        )}
                        {staged && (
                          <Badge variant="outline" className="ml-2 bg-green-100 text-green-700 border-green-300">
                            Staged: {staged}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      <span className={item.qty_pending === 0 ? "text-muted-foreground" : ""}>
                        {item.qty_pending}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className={item.qty_fulfilled > 0 ? "text-green-600 font-medium" : "text-muted-foreground"}>
                        {item.qty_fulfilled}
                      </span>
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
                          <span className="ml-2 font-medium text-green-600">
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openFulfillDialog(item)}
                        disabled={item.qty_pending === 0}
                        title="Fulfill"
                        className={staged ? "text-green-600" : "text-blue-600"}
                      >
                        <ClipboardCheck className="h-4 w-4" />
                      </Button>
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

      {/* Parts Section */}
      {renderLineItemSection("Parts", partItems, "part", <Package className="h-4 w-4" />, "Add Part")}

      {/* Labor Section */}
      {renderLineItemSection("Labour", laborItems2, "labor", <Wrench className="h-4 w-4" />, "Add Labour")}

      {/* Misc Section */}
      {renderLineItemSection("Miscellaneous", miscItems2, "misc", <FileText className="h-4 w-4" />, "Add Misc")}

      {/* Total Summary */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">Quote Total:</span>
            <span className="text-2xl font-bold">${calculateTotal().toFixed(2)}</span>
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

      {/* Floating Invoice Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button
          size="lg"
          onClick={handleCreateInvoice}
          disabled={stagedCount === 0 || isCreatingInvoice}
          className="shadow-lg gap-2"
        >
          <Receipt className="h-5 w-5" />
          {isCreatingInvoice ? "Creating..." : `Create Invoice${stagedCount > 0 ? ` (${stagedCount} items)` : ""}`}
        </Button>
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
                {laborItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No labour items found. Create labour items in Inventory first.
                  </p>
                ) : (
                  <Select value={selectedLaborId} onValueChange={setSelectedLaborId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select labour" />
                    </SelectTrigger>
                    <SelectContent>
                      {laborItems.map((labor) => (
                        <SelectItem key={labor.id} value={labor.id.toString()}>
                          {labor.description} (${labor.rate}/hr x {labor.hours}hrs)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {addDialogType === "part" && (
              <div className="space-y-2">
                <Label>Part</Label>
                {parts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No parts found. Create parts in Inventory first.
                  </p>
                ) : (
                  <Select value={selectedPartId} onValueChange={setSelectedPartId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select part" />
                    </SelectTrigger>
                    <SelectContent>
                      {parts.map((part) => (
                        <SelectItem key={part.id} value={part.id.toString()}>
                          {part.part_number} - {part.description} (${(part.cost * (1 + (part.markup_percent ?? 0) / 100)).toFixed(2)})
                          {part.labor_items && part.labor_items.length > 0 && (
                            <span className="ml-2 text-muted-foreground">
                              ({part.labor_items.length} linked labour)
                            </span>
                          )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {addDialogType === "misc" && (
              <div className="space-y-2">
                <Label>Miscellaneous Item</Label>
                {miscItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No miscellaneous items found. Create misc items in Inventory first.
                  </p>
                ) : (
                  <Select value={selectedMiscId} onValueChange={setSelectedMiscId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select misc item" />
                    </SelectTrigger>
                    <SelectContent>
                      {miscItems.map((misc) => (
                        <SelectItem key={misc.id} value={misc.id.toString()}>
                          {misc.description} (${(misc.rate * misc.hours * (1 + misc.markup_percent / 100)).toFixed(2)})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
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
                <Select value={editDiscountCodeId} onValueChange={setEditDiscountCodeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="No discount" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No discount</SelectItem>
                    {discountCodes.map((code) => (
                      <SelectItem key={code.id} value={code.id.toString()}>
                        {code.code} (-{code.discount_percent.toFixed(2)}%)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

      {/* Fulfill Dialog */}
      <Dialog open={fulfillDialogOpen} onOpenChange={setFulfillDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              Stage Fulfillment
            </DialogTitle>
            <DialogDescription>
              Set the quantity to fulfill for this line item. This will be staged until you create an invoice.
            </DialogDescription>
          </DialogHeader>

          {fulfillLineItem && (
            <div className="space-y-4 pt-4">
              <div className="bg-muted/50 p-3 rounded-md">
                <p className="text-sm font-medium">{getDescriptionLabel(fulfillLineItem)}</p>
                <p className="text-lg">{getLineItemDescription(fulfillLineItem)}</p>
              </div>

              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-muted/30 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Qty Ordered</p>
                  <p className="text-lg font-semibold">{fulfillLineItem.quantity}</p>
                </div>
                <div className="bg-muted/30 p-3 rounded-md">
                  <p className="text-xs text-muted-foreground">Qty Pending</p>
                  <p className="text-lg font-semibold">{fulfillLineItem.qty_pending}</p>
                </div>
                <div className="bg-green-50 p-3 rounded-md">
                  <p className="text-xs text-green-600">Qty Fulfilled</p>
                  <p className="text-lg font-semibold text-green-600">{fulfillLineItem.qty_fulfilled}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Quantity to Fulfill (max: {fulfillLineItem.qty_pending})</Label>
                <Input
                  type="number"
                  step="1"
                  min="0"
                  max={fulfillLineItem.qty_pending}
                  value={fulfillQuantity}
                  onChange={(e) => setFulfillQuantity(e.target.value)}
                  placeholder="Enter quantity"
                />
              </div>

              <div className="flex gap-2">
                {stagedFulfillments.has(fulfillLineItem.id) && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearStagedFulfillment(fulfillLineItem.id)
                      setFulfillDialogOpen(false)
                    }}
                    className="flex-1"
                  >
                    Clear Staged
                  </Button>
                )}
                <Button onClick={handleStageFulfillment} className="flex-1">
                  Stage Fulfillment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
