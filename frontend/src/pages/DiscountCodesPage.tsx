import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { DiscountCodeForm } from "@/components/forms/DiscountCodeForm"
import { api } from "@/api/client"
import type { DiscountCode } from "@/types"
import { Plus, Trash2, Pencil, Archive, Tag } from "lucide-react"

export function DiscountCodesPage() {
  const [discountCodes, setDiscountCodes] = useState<DiscountCode[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null)

  const fetchDiscountCodes = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.discountCodes.getAll(showArchived)
      setDiscountCodes(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch discount codes")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDiscountCodes()
  }, [showArchived])

  const handleAdd = () => {
    setEditingCode(null)
    setDialogOpen(true)
  }

  const handleEdit = (code: DiscountCode) => {
    setEditingCode(code)
    setDialogOpen(true)
  }

  const handleArchive = async (code: DiscountCode) => {
    if (!confirm(`Are you sure you want to archive discount code "${code.code}"?`)) return
    try {
      await api.discountCodes.archive(code.id)
      fetchDiscountCodes()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to archive discount code")
    }
  }

  const handleDelete = async (code: DiscountCode) => {
    if (!confirm(`Are you sure you want to delete discount code "${code.code}"? This is only possible if the code has never been used.`)) return
    try {
      await api.discountCodes.delete(code.id)
      fetchDiscountCodes()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete discount code")
    }
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingCode(null)
    }
    setDialogOpen(open)
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Discount Codes</h1>
          <p className="text-muted-foreground">Manage discount codes for quote line items</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          New Discount Code
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
          {error}
        </div>
      )}

      <div className="bg-card rounded-lg border shadow-sm">
        <div className="p-4 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">All Discount Codes</h2>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-gray-300"
            />
            Show archived
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : discountCodes.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No discount codes found.</p>
            <p className="text-sm mt-1">Create your first discount code to get started.</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                  Code
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Discount
                </th>
                <th className="px-4 py-3 text-center text-sm font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {discountCodes.map((code) => (
                <tr key={code.id} className={`hover:bg-muted/50 ${code.is_archived ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-mono font-medium">{code.code}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium">{code.discount_percent.toFixed(2)}%</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {code.is_archived ? (
                      <Badge variant="secondary">Archived</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right space-x-1">
                    {!code.is_archived && (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(code)}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(code)}
                          title="Archive"
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(code)}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Delete (only if never used)"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Discount Code Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingCode ? "Edit Discount Code" : "Create Discount Code"}</DialogTitle>
            <DialogDescription>
              {editingCode
                ? "Update the discount code details below."
                : "Create a new discount code that can be applied to quote line items."}
            </DialogDescription>
          </DialogHeader>
          <DiscountCodeForm
            discountCode={editingCode ?? undefined}
            onSuccess={() => {
              handleDialogClose(false)
              fetchDiscountCodes()
            }}
            onCancel={() => handleDialogClose(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
