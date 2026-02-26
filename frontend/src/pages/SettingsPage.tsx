import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { api } from '@/api/client'
import type { CompanySettings, CompanySettingsUpdate, CostCode, CostCodeCreate } from '@/types'
import { Loader2, Save, Pencil, Trash2, Plus, X, Check } from 'lucide-react'

// Inline editing row state
interface CostCodeEditState {
  code: string
  description: string
  gp_cost_code_properties: string
  uch_dept_properties: string
}

export function SettingsPage() {
  const [settings, setSettings] = useState<CompanySettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Form state
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [fax, setFax] = useState('')
  const [gstNumber, setGstNumber] = useState('')
  const [hstRate, setHstRate] = useState('')

  // Cost codes state
  const [costCodes, setCostCodes] = useState<CostCode[]>([])
  const [costCodesLoading, setCostCodesLoading] = useState(true)
  const [editingCostCodeId, setEditingCostCodeId] = useState<number | null>(null)
  const [editingCostCode, setEditingCostCode] = useState<CostCodeEditState | null>(null)
  const [addingCostCode, setAddingCostCode] = useState(false)
  const [newCostCode, setNewCostCode] = useState<CostCodeEditState>({ code: '', description: '', gp_cost_code_properties: '', uch_dept_properties: '' })
  const [costCodeSaving, setCostCodeSaving] = useState(false)
  const [costCodeError, setCostCodeError] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<CostCode | null>(null)

  useEffect(() => {
    fetchSettings()
    fetchCostCodes()
  }, [])

  const fetchSettings = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.companySettings.get()
      setSettings(data)
      setName(data.name || '')
      setAddress(data.address || '')
      setPhone(data.phone || '')
      setFax(data.fax || '')
      setGstNumber(data.gst_number || '')
      setHstRate(String(data.hst_rate ?? 13.0))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const fetchCostCodes = async () => {
    setCostCodesLoading(true)
    try {
      const data = await api.costCodes.getAll()
      setCostCodes(data)
    } catch (err) {
      setCostCodeError(err instanceof Error ? err.message : 'Failed to load cost codes')
    } finally {
      setCostCodesLoading(false)
    }
  }

  const handleSave = async () => {
    setError(null)
    setSuccessMessage(null)

    const hstValue = parseFloat(hstRate)
    if (isNaN(hstValue) || hstValue < 0 || hstValue > 100) {
      setError('HST Rate must be a number between 0 and 100.')
      return
    }

    setSaving(true)
    try {
      const update: CompanySettingsUpdate = {
        name,
        address,
        phone,
        fax,
        gst_number: gstNumber,
        hst_rate: hstValue,
      }
      const data = await api.companySettings.update(update)
      setSettings(data)
      setSuccessMessage('Settings saved successfully.')
      setTimeout(() => setSuccessMessage(null), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  // Cost code CRUD handlers
  const startEditCostCode = (cc: CostCode) => {
    setEditingCostCodeId(cc.id)
    setEditingCostCode({
      code: cc.code,
      description: cc.description,
      gp_cost_code_properties: cc.gp_cost_code_properties || '',
      uch_dept_properties: cc.uch_dept_properties || '',
    })
    setCostCodeError(null)
  }

  const cancelEditCostCode = () => {
    setEditingCostCodeId(null)
    setEditingCostCode(null)
  }

  const saveEditCostCode = async () => {
    if (!editingCostCode || editingCostCodeId === null) return
    if (!editingCostCode.code.trim() || !editingCostCode.description.trim()) {
      setCostCodeError('Code and Description are required.')
      return
    }

    setCostCodeSaving(true)
    setCostCodeError(null)
    try {
      await api.costCodes.update(editingCostCodeId, {
        code: editingCostCode.code.trim(),
        description: editingCostCode.description.trim(),
        gp_cost_code_properties: editingCostCode.gp_cost_code_properties.trim() || undefined,
        uch_dept_properties: editingCostCode.uch_dept_properties.trim() || undefined,
      })
      setEditingCostCodeId(null)
      setEditingCostCode(null)
      fetchCostCodes()
    } catch (err) {
      setCostCodeError(err instanceof Error ? err.message : 'Failed to update cost code')
    } finally {
      setCostCodeSaving(false)
    }
  }

  const startAddCostCode = () => {
    setAddingCostCode(true)
    setNewCostCode({ code: '', description: '', gp_cost_code_properties: '', uch_dept_properties: '' })
    setCostCodeError(null)
  }

  const cancelAddCostCode = () => {
    setAddingCostCode(false)
    setNewCostCode({ code: '', description: '', gp_cost_code_properties: '', uch_dept_properties: '' })
  }

  const saveNewCostCode = async () => {
    if (!newCostCode.code.trim() || !newCostCode.description.trim()) {
      setCostCodeError('Code and Description are required.')
      return
    }

    setCostCodeSaving(true)
    setCostCodeError(null)
    try {
      const data: CostCodeCreate = {
        code: newCostCode.code.trim(),
        description: newCostCode.description.trim(),
        gp_cost_code_properties: newCostCode.gp_cost_code_properties.trim() || undefined,
        uch_dept_properties: newCostCode.uch_dept_properties.trim() || undefined,
      }
      await api.costCodes.create(data)
      setAddingCostCode(false)
      setNewCostCode({ code: '', description: '', gp_cost_code_properties: '', uch_dept_properties: '' })
      fetchCostCodes()
    } catch (err) {
      setCostCodeError(err instanceof Error ? err.message : 'Failed to create cost code')
    } finally {
      setCostCodeSaving(false)
    }
  }

  const deleteCostCode = async (cc: CostCode) => {
    setCostCodeError(null)
    try {
      await api.costCodes.delete(cc.id)
      setDeleteConfirm(null)
      fetchCostCodes()
    } catch (err) {
      setDeleteConfirm(null)
      setCostCodeError(err instanceof Error ? err.message : 'Failed to delete cost code')
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
        Loading settings...
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage company information and business variables</p>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="p-3 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-md text-green-700 dark:text-green-300 text-sm">
          {successMessage}
        </div>
      )}

      {/* Company Information */}
      <Card>
        <CardHeader>
          <CardTitle>Company Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input
                id="company-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gst-number">GST Number</Label>
              <Input
                id="gst-number"
                value={gstNumber}
                onChange={(e) => setGstNumber(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fax">Fax</Label>
              <Input
                id="fax"
                value={fax}
                onChange={(e) => setFax(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Business Variables */}
      <Card>
        <CardHeader>
          <CardTitle>Business Variables</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="hst-rate">HST Rate (Ontario Harmonized Sales Tax)</Label>
            <div className="relative">
              <Input
                id="hst-rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={hstRate}
                onChange={(e) => setHstRate(e.target.value)}
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Applied to quotes, invoices, and purchase orders. Ontario HST is 13%.
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save Settings
        </Button>
      </div>

      {/* Cost Codes */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Cost Codes</CardTitle>
          <Button
            size="sm"
            onClick={startAddCostCode}
            disabled={addingCostCode || editingCostCodeId !== null}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            Add New
          </Button>
        </CardHeader>
        <CardContent>
          {costCodeError && (
            <div className="p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive text-sm">
              {costCodeError}
            </div>
          )}

          {costCodesLoading ? (
            <div className="p-4 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
              Loading cost codes...
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[120px]">Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="w-[180px]">GP Properties</TableHead>
                    <TableHead className="w-[180px]">UCH Dept Properties</TableHead>
                    <TableHead className="w-[100px] text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {costCodes.map((cc) => (
                    <TableRow key={cc.id}>
                      {editingCostCodeId === cc.id && editingCostCode ? (
                        <>
                          <TableCell>
                            <Input
                              value={editingCostCode.code}
                              onChange={(e) => setEditingCostCode({ ...editingCostCode, code: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editingCostCode.description}
                              onChange={(e) => setEditingCostCode({ ...editingCostCode, description: e.target.value })}
                              className="h-8"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editingCostCode.gp_cost_code_properties}
                              onChange={(e) => setEditingCostCode({ ...editingCostCode, gp_cost_code_properties: e.target.value })}
                              className="h-8"
                              placeholder="Optional"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={editingCostCode.uch_dept_properties}
                              onChange={(e) => setEditingCostCode({ ...editingCostCode, uch_dept_properties: e.target.value })}
                              className="h-8"
                              placeholder="Optional"
                            />
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEditCostCode} disabled={costCodeSaving}>
                                {costCodeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelEditCostCode}>
                                <X className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell className="font-mono text-sm">{cc.code}</TableCell>
                          <TableCell>{cc.description}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{cc.gp_cost_code_properties || '—'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{cc.uch_dept_properties || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7"
                                onClick={() => startEditCostCode(cc)}
                                disabled={addingCostCode || editingCostCodeId !== null}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:text-destructive"
                                onClick={() => setDeleteConfirm(cc)}
                                disabled={addingCostCode || editingCostCodeId !== null}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))}

                  {/* Add new row */}
                  {addingCostCode && (
                    <TableRow>
                      <TableCell>
                        <Input
                          value={newCostCode.code}
                          onChange={(e) => setNewCostCode({ ...newCostCode, code: e.target.value })}
                          className="h-8"
                          placeholder="e.g. 999-100"
                          autoFocus
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newCostCode.description}
                          onChange={(e) => setNewCostCode({ ...newCostCode, description: e.target.value })}
                          className="h-8"
                          placeholder="Description"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newCostCode.gp_cost_code_properties}
                          onChange={(e) => setNewCostCode({ ...newCostCode, gp_cost_code_properties: e.target.value })}
                          className="h-8"
                          placeholder="Optional"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={newCostCode.uch_dept_properties}
                          onChange={(e) => setNewCostCode({ ...newCostCode, uch_dept_properties: e.target.value })}
                          className="h-8"
                          placeholder="Optional"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveNewCostCode} disabled={costCodeSaving}>
                            {costCodeSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-600" />}
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={cancelAddCostCode}>
                            <X className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}

                  {costCodes.length === 0 && !addingCostCode && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        No cost codes found. Click "Add New" to create one.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Cost Code</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete cost code <strong>{deleteConfirm?.code}</strong> ({deleteConfirm?.description})?
              This cannot be undone. If this cost code is used by any quotes or purchase orders, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteConfirm && deleteCostCode(deleteConfirm)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
