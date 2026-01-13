import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { api } from "@/api/client"
import type { DiscountCode, DiscountCodeCreate } from "@/types"

interface DiscountCodeFormProps {
  discountCode?: DiscountCode // If provided, we're editing; otherwise creating
  onSuccess?: () => void
  onCancel?: () => void
}

export function DiscountCodeForm({ discountCode, onSuccess, onCancel }: DiscountCodeFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEditing = !!discountCode

  // Form state
  const [code, setCode] = useState("")
  const [discountPercent, setDiscountPercent] = useState("")

  // Populate form when editing
  useEffect(() => {
    if (discountCode) {
      setCode(discountCode.code)
      setDiscountPercent(discountCode.discount_percent.toFixed(2))
    }
  }, [discountCode])

  // Format the discount percent for display
  const formatPercent = (value: string): string => {
    const num = parseFloat(value)
    if (isNaN(num)) return ""
    return num.toFixed(2)
  }

  const handlePercentBlur = () => {
    if (discountPercent) {
      setDiscountPercent(formatPercent(discountPercent))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    // Validate code length
    if (code.length > 10) {
      setError("Discount code must be 10 characters or less")
      setLoading(false)
      return
    }

    const data: DiscountCodeCreate = {
      code: code.toUpperCase(), // Store codes in uppercase
      discount_percent: parseFloat(discountPercent) || 0,
    }

    try {
      if (isEditing && discountCode) {
        await api.discountCodes.update(discountCode.id, data)
      } else {
        await api.discountCodes.create(data)
      }
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? 'update' : 'create'} discount code`)
    } finally {
      setLoading(false)
    }
  }

  const percentNum = parseFloat(discountPercent) || 0

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md border border-destructive/20">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="code">Discount Code</Label>
        <Input
          id="code"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 10))}
          placeholder="e.g., SUMMER20"
          maxLength={10}
          required
        />
        <p className="text-sm text-muted-foreground">
          Maximum 10 characters. Will be stored in uppercase.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="discountPercent">Discount Percentage</Label>
        <div className="relative">
          <Input
            id="discountPercent"
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={discountPercent}
            onChange={(e) => setDiscountPercent(e.target.value)}
            onBlur={handlePercentBlur}
            placeholder="10.00"
            className="pr-8"
            required
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
        </div>
        <p className="text-sm text-muted-foreground">
          Enter the discount percentage (e.g., 10 for 10% off)
        </p>
      </div>

      {/* Preview */}
      {percentNum > 0 && (
        <div className="bg-muted/50 p-4 rounded-md">
          <h4 className="font-medium text-sm mb-2">Preview</h4>
          <p className="text-sm text-muted-foreground">
            This code will apply a <span className="font-medium text-foreground">{percentNum.toFixed(2)}%</span> discount to line items.
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Example: $100.00 item → <span className="font-medium text-foreground">${(100 * (1 - percentNum / 100)).toFixed(2)}</span>
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !code || !discountPercent}>
          {loading ? (isEditing ? "Saving..." : "Creating...") : (isEditing ? "Save Changes" : "Create Discount Code")}
        </Button>
      </div>
    </form>
  )
}
