import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableMultiSelect, SearchableMultiSelectOption } from "@/components/ui/searchable-multi-select"
import { api } from "@/api/client"
import type { Part, PartCreate, Labor } from "@/types"
import { LaborForm } from "./LaborForm"

interface PartFormProps {
  part?: Part // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
}

export function PartForm({ part, onSuccess, onCancel }: PartFormProps) {
  const [laborItems, setLaborItems] = useState<Labor[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!part

  // Form state - use strings for number fields to allow empty while editing
  const [partNumber, setPartNumber] = useState("")
  const [description, setDescription] = useState("")
  const [cost, setCost] = useState("")
  const [markupPercent, setMarkupPercent] = useState("")
  const [selectedLaborIds, setSelectedLaborIds] = useState<string[]>([])

  // Fetch available labor items on mount
  useEffect(() => {
    const fetchLabor = async () => {
      try {
        const data = await api.labor.getAll()
        setLaborItems(data)
      } catch {
        setError("Failed to load labor items")
      }
    }
    fetchLabor()
  }, [])

  // Populate form when editing
  useEffect(() => {
    if (part) {
      setPartNumber(part.part_number)
      setDescription(part.description)
      setCost(part.cost.toString())
      setMarkupPercent(part.markup_percent?.toString() || "0")
      // Set linked labor IDs if available
      if (part.labor_items) {
        setSelectedLaborIds(part.labor_items.map(l => l.id.toString()))
      }
    }
  }, [part])

  // Convert labor items to multi-select options
  const laborOptions: SearchableMultiSelectOption[] = laborItems.map((labor) => ({
    value: labor.id.toString(),
    label: labor.description,
    description: `${labor.hours}hrs @ $${labor.rate.toFixed(2)}/hr`,
  }))

  // Calculate total linked labor cost
  const linkedLaborCost = selectedLaborIds.reduce((total, id) => {
    const labor = laborItems.find((l) => l.id === parseInt(id, 10))
    if (labor) {
      return total + (labor.hours * labor.rate * (1 + labor.markup_percent / 100))
    }
    return total
  }, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const partData: PartCreate = {
      part_number: partNumber,
      description,
      cost: parseFloat(cost) || 0,
      markup_percent: parseFloat(markupPercent) || 0,
      linked_labor_ids: selectedLaborIds.map((id) => parseInt(id, 10)),
    }

    try {
      if (isEditing && part) {
        await api.parts.update(part.id, partData)
      } else {
        await api.parts.create(partData)
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} part`)
    } finally {
      setLoading(false)
    }
  }

  const partCost = parseFloat(cost) || 0
  const markupNum = parseFloat(markupPercent) || 0
  const partPriceWithMarkup = partCost * (1 + markupNum / 100)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="partNumber">Part Number</Label>
        <Input
          id="partNumber"
          value={partNumber}
          onChange={(e) => setPartNumber(e.target.value)}
          placeholder="e.g., HVAC-001"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., AC Unit 2-Ton"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cost">Manufacturer Cost ($)</Label>
        <Input
          id="cost"
          type="number"
          step="0.01"
          min="0"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          placeholder="0.00"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="markup">Markup (%)</Label>
        <Input
          id="markup"
          type="number"
          step="0.01"
          min="0"
          value={markupPercent}
          onChange={(e) => setMarkupPercent(e.target.value)}
          placeholder="0"
        />
      </div>

      <div className="space-y-2">
        <Label>Linked Labour</Label>
        <SearchableMultiSelect<Labor>
          options={laborOptions}
          selected={selectedLaborIds}
          onChange={setSelectedLaborIds}
          placeholder="Select labour tasks for this part..."
          searchPlaceholder="Search labour items..."
          emptyMessage="No labour items found."
          allowCreate={true}
          createLabel="Create New Labour"
          createDialogTitle="Create New Labour Item"
          createForm={<LaborForm />}
          onCreateSuccess={(newLabor) => {
            setLaborItems([...laborItems, newLabor])
            setSelectedLaborIds([...selectedLaborIds, newLabor.id.toString()])
          }}
        />
        <p className="text-sm text-muted-foreground">
          Select labour tasks that are typically performed with this part. When adding this part to a quote, the system will prompt to auto-add these labour items.
        </p>
      </div>

      {/* Cost Summary */}
      <div className="bg-muted/50 p-4 rounded-md space-y-2">
        <h4 className="font-medium text-sm">Cost Summary</h4>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span>Part Cost:</span>
            <span>${partCost.toFixed(2)}</span>
          </div>
          {markupNum > 0 && (
            <div className="flex justify-between">
              <span>With Markup ({markupNum}%):</span>
              <span>${partPriceWithMarkup.toFixed(2)}</span>
            </div>
          )}
          {selectedLaborIds.length > 0 && (
            <>
              <div className="flex justify-between">
                <span>Linked Labour Cost:</span>
                <span>${linkedLaborCost.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-medium border-t pt-1">
                <span>Total (with labour):</span>
                <span>${(partPriceWithMarkup + linkedLaborCost).toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !partNumber || !description || !cost}>
          {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Part")}
        </Button>
      </div>
    </form>
  )
}
