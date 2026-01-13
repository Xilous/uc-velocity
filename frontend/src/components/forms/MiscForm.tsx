import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/api/client"
import type { Miscellaneous, MiscellaneousCreate } from "@/types"

interface MiscFormProps {
  misc?: Miscellaneous // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
}

export function MiscForm({ misc, onSuccess, onCancel }: MiscFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!misc

  // Form state - use strings for number fields to allow empty while editing
  const [description, setDescription] = useState("")
  const [hours, setHours] = useState("")
  const [rate, setRate] = useState("")
  const [markupPercent, setMarkupPercent] = useState("")

  // Populate form when editing
  useEffect(() => {
    if (misc) {
      setDescription(misc.description)
      setHours(misc.hours.toString())
      setRate(misc.rate.toString())
      setMarkupPercent(misc.markup_percent.toString())
    }
  }, [misc])

  // Calculate misc cost (use parsed values or 0 for display)
  const hoursNum = parseFloat(hours) || 0
  const rateNum = parseFloat(rate) || 0
  const markupNum = parseFloat(markupPercent) || 0
  const miscCost = hoursNum * rateNum * (1 + markupNum / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const miscData: MiscellaneousCreate = {
      description,
      hours: parseFloat(hours) || 1,
      rate: parseFloat(rate) || 0,
      markup_percent: parseFloat(markupPercent) || 0,
    }

    try {
      if (isEditing && misc) {
        await api.misc.update(misc.id, miscData)
      } else {
        await api.misc.create(miscData)
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} miscellaneous item`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description">Misc Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Equipment Rental"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hours">Hours</Label>
          <Input
            id="hours"
            type="number"
            step="0.5"
            min="0"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="1"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rate">Hourly Rate ($)</Label>
          <Input
            id="rate"
            type="number"
            step="0.01"
            min="0"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
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
      </div>

      {/* Cost Summary */}
      <div className="bg-muted/50 p-4 rounded-md space-y-2">
        <h4 className="font-medium text-sm">Cost Summary</h4>
        <div className="text-sm space-y-1">
          <div className="flex justify-between font-medium">
            <span>Misc Cost:</span>
            <span>${miscCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !description || !hours || !rate}>
          {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Misc")}
        </Button>
      </div>
    </form>
  )
}
