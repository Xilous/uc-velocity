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
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { SearchableSelect } from "@/components/ui/searchable-select"
import type { SearchableSelectOption } from "@/components/ui/searchable-select"
import { api } from "@/api/client"
import type { PurchaseOrder, POLineItem, POLineItemCreate, POLineItemType, Part } from "@/types"
import { Plus, Trash2, Package, FileText, Building } from "lucide-react"
import { PartForm } from "@/components/forms/PartForm"

interface POEditorProps {
  poId: number
  onUpdate?: () => void
}

export function POEditor({ poId, onUpdate }: POEditorProps) {
  const [po, setPO] = useState<PurchaseOrder | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Dialog states
  const [dialogOpen, setDialogOpen] = useState(false)
  const [dialogType, setDialogType] = useState<POLineItemType>("part")

  // Available items for selection
  const [parts, setParts] = useState<Part[]>([])

  // Form fields
  const [selectedPartId, setSelectedPartId] = useState<string>("")
  const [miscDescription, setMiscDescription] = useState("")
  const [quantity, setQuantity] = useState("1")
  const [unitPrice, setUnitPrice] = useState("")

  const fetchPO = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.purchaseOrders.get(poId)
      setPO(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch purchase order")
    } finally {
      setLoading(false)
    }
  }

  const fetchParts = async () => {
    try {
      const partsData = await api.parts.getAll()
      setParts(partsData)
    } catch (err) {
      console.error("Failed to fetch parts", err)
    }
  }

  useEffect(() => {
    fetchPO()
    fetchParts()
  }, [poId])

  const openAddDialog = (type: POLineItemType) => {
    setDialogType(type)
    setSelectedPartId("")
    setMiscDescription("")
    setQuantity("1")
    setUnitPrice("")
    setDialogOpen(true)
  }

  const handleAddLineItem = async () => {
    const lineItem: POLineItemCreate = {
      item_type: dialogType,
      quantity: parseFloat(quantity) || 1,
    }

    if (dialogType === "part") {
      if (!selectedPartId) return
      lineItem.part_id = parseInt(selectedPartId)
      const part = parts.find((p) => p.id === lineItem.part_id)
      if (part) lineItem.unit_price = part.cost * (1 + (part.markup_percent ?? 0) / 100)
    } else {
      // misc
      if (!miscDescription) return
      lineItem.description = miscDescription
      lineItem.unit_price = parseFloat(unitPrice) || 0
    }

    try {
      await api.purchaseOrders.addLine(poId, lineItem)
      setDialogOpen(false)
      fetchPO()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add line item")
    }
  }

  const handleDeleteLine = async (lineId: number) => {
    if (!confirm("Delete this line item?")) return
    try {
      await api.purchaseOrders.deleteLine(poId, lineId)
      fetchPO()
      onUpdate?.()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete line item")
    }
  }

  const getLineItemDescription = (item: POLineItem): string => {
    if (item.item_type === "part" && item.part) {
      return `${item.part.part_number} - ${item.part.description}`
    }
    return item.description || "Miscellaneous"
  }

  const getLineItemTotal = (item: POLineItem): number => {
    return (item.unit_price || 0) * item.quantity
  }

  const calculateTotal = (): number => {
    if (!po) return 0
    return po.line_items.reduce((sum, item) => sum + getLineItemTotal(item), 0)
  }

  const getTypeIcon = (type: POLineItemType) => {
    switch (type) {
      case "part":
        return <Package className="h-4 w-4" />
      case "misc":
        return <FileText className="h-4 w-4" />
    }
  }

  const getTypeBadgeVariant = (type: POLineItemType) => {
    switch (type) {
      case "part":
        return "secondary"
      case "misc":
        return "outline"
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>
  }

  if (error || !po) {
    return (
      <div className="p-8">
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
          {error || "Purchase order not found"}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-semibold">Purchase Order #{po.id}</h2>
          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
            <Building className="h-4 w-4" />
            <span>Vendor: {po.vendor.name}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Created: {new Date(po.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={po.status === "draft" ? "outline" : "default"}>
          {po.status}
        </Badge>
      </div>

      {/* Add Line Item Buttons - NO LABOR */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Add Line Item</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddDialog("part")}
              className="gap-2"
            >
              <Package className="h-4 w-4" />
              Add Part
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openAddDialog("misc")}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              Add Misc
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Note: Purchase orders can only include parts and miscellaneous items.
          </p>
        </CardContent>
      </Card>

      {/* Line Items Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Line Items</CardTitle>
        </CardHeader>
        <CardContent>
          {po.line_items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No line items yet. Add items using the buttons above.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.line_items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <Badge
                        variant={getTypeBadgeVariant(item.item_type) as "secondary" | "outline"}
                        className="gap-1"
                      >
                        {getTypeIcon(item.item_type)}
                        {item.item_type}
                      </Badge>
                    </TableCell>
                    <TableCell>{getLineItemDescription(item)}</TableCell>
                    <TableCell className="text-right">{item.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${(item.unit_price || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${getLineItemTotal(item).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteLine(item.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {/* Total Row */}
                <TableRow className="bg-muted/50">
                  <TableCell colSpan={4} className="text-right font-semibold">
                    Total:
                  </TableCell>
                  <TableCell className="text-right font-bold text-lg">
                    ${calculateTotal().toFixed(2)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add Line Item Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getTypeIcon(dialogType)}
              Add {dialogType.charAt(0).toUpperCase() + dialogType.slice(1)}
            </DialogTitle>
            <DialogDescription>
              Add a {dialogType} line item to this purchase order.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-4">
            {dialogType === "part" && (
              <div className="space-y-2">
                <Label>Part</Label>
                <SearchableSelect<Part>
                  options={parts.map((part): SearchableSelectOption => ({
                    value: part.id.toString(),
                    label: `${part.part_number} - ${part.description}`,
                    description: `$${(part.cost * (1 + (part.markup_percent ?? 0) / 100)).toFixed(2)}`,
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

            {dialogType === "misc" && (
              <>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Input
                    value={miscDescription}
                    onChange={(e) => setMiscDescription(e.target.value)}
                    placeholder="e.g., Shipping fee"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Unit Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </>
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
                (dialogType === "part" && (!selectedPartId || parts.length === 0)) ||
                (dialogType === "misc" && !miscDescription)
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Line Item
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
