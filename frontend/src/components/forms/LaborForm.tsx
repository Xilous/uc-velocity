import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/api/client"
import type { Labor, LaborCreate } from "@/types"

interface LaborFormProps {
  labor?: Labor // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
}

export function LaborForm({ labor, onSuccess, onCancel }: LaborFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!labor

  // Form state - use strings for number fields to allow empty while editing
  const [description, setDescription] = useState("")
  const [hours, setHours] = useState("")
  const [rate, setRate] = useState("")
  const [markupPercent, setMarkupPercent] = useState("")

  // Populate form when editing
  useEffect(() => {
    if (labor) {
      setDescription(labor.description)
      setHours(labor.hours.toString())
      setRate(labor.rate.toString())
      setMarkupPercent(labor.markup_percent.toString())
    }
  }, [labor])

  // Calculate labor cost (use parsed values or 0 for display)
  const hoursNum = parseInt(hours, 10) || 0
  const rateNum = parseFloat(rate) || 0
  const markupNum = parseFloat(markupPercent) || 0
  const laborCost = hoursNum * rateNum * (1 + markupNum / 100)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate hours is a positive integer
    const hoursValue = parseInt(hours, 10)
    if (!Number.isInteger(hoursValue) || hoursValue <= 0) {
      setError("Hours must be a positive whole number (e.g., 1, 2, 3...)")
      setLoading(false)
      return
    }

    const laborData: LaborCreate = {
      description,
      hours: hoursValue,
      rate: parseFloat(rate) || 0,
      markup_percent: parseFloat(markupPercent) || 0,
    }

    try {
      if (isEditing && labor) {
        await api.labor.update(labor.id, laborData)
      } else {
        await api.labor.create(laborData)
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} labor`)
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
        <Label htmlFor="description">Labour Description</Label>
        <Input
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g., Install HVAC System"
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hours">Hours</Label>
          <Input
            id="hours"
            type="number"
            step="1"
            min="1"
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
            <span>Labour Cost:</span>
            <span>${laborCost.toFixed(2)}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !description || !hours || !rate}>
          {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Labour")}
        </Button>
      </div>
    </form>
  )
}
