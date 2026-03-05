import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
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
import { Upload, FileCheck, FileX, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { api } from "@/api/client"
import type { MigrationResult } from "@/types"

const EXPECTED_FILES: Record<string, { label: string; entity: string; required: boolean }> = {
  "tblPartsCategories.csv": { label: "Categories", entity: "categories", required: false },
  "tblClients.csv": { label: "Customers", entity: "profiles", required: true },
  "tblVendors.csv": { label: "Vendors", entity: "profiles", required: true },
  "tblMaterial.csv": { label: "Parts", entity: "parts", required: false },
  "tblApplication.csv": { label: "Labour", entity: "labor", required: false },
  "tblZones.csv": { label: "Miscellaneous", entity: "miscellaneous", required: false },
  "tblProjects.csv": { label: "Projects", entity: "projects", required: true },
  "tblServiceRecords.csv": { label: "Quotes", entity: "quotes", required: false },
  "tblWorkorderApplication.csv": { label: "Quote Labour Items", entity: "quote_line_items", required: false },
  "tblWorkorderMaterial.csv": { label: "Quote Part Items", entity: "quote_line_items", required: false },
  "tblWorkorderZones.csv": { label: "Quote Misc Items", entity: "quote_line_items", required: false },
  "tblPurchaseOrders.csv": { label: "Purchase Orders", entity: "purchase_orders", required: false },
  "tblPurchaseOrdersMaterial.csv": { label: "PO Line Items", entity: "po_line_items", required: false },
}

export function MigrationPage() {
  const [files, setFiles] = useState<File[]>([])
  const [showConfirm, setShowConfirm] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<MigrationResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const recognized = files.filter(f => f.name in EXPECTED_FILES)
  const unrecognized = files.filter(f => !(f.name in EXPECTED_FILES))
  const missingRequired = Object.entries(EXPECTED_FILES)
    .filter(([, meta]) => meta.required)
    .filter(([name]) => !recognized.some(f => f.name === name))
    .map(([name, meta]) => ({ name, label: meta.label }))

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    setFiles(Array.from(newFiles))
    setResult(null)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const handleImport = async () => {
    setShowConfirm(false)
    setImporting(true)
    setError(null)
    setResult(null)

    try {
      const res = await api.migration.import(recognized)
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Legacy Data Migration</h1>
        <p className="text-muted-foreground mt-1">
          Import CSV exports from UC Vision (Access database) into UC Velocity.
        </p>
      </div>

      {/* File Upload Zone */}
      <Card
        className={`border-2 border-dashed p-8 text-center cursor-pointer transition-colors ${
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">Drop CSV files here or click to browse</p>
        <p className="text-sm text-muted-foreground mt-1">
          Select all 13 legacy CSV files (tblClients.csv, tblVendors.csv, etc.)
        </p>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".csv"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
      </Card>

      {/* File Analysis */}
      {files.length > 0 && (
        <Card className="p-4 space-y-4">
          <h2 className="font-semibold text-lg">File Analysis</h2>

          {/* Recognized files */}
          {recognized.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Recognized ({recognized.length} / {Object.keys(EXPECTED_FILES).length})
              </p>
              {recognized.map(f => (
                <div key={f.name} className="flex items-center gap-2 text-sm py-1">
                  <FileCheck className="h-4 w-4 text-green-600 shrink-0" />
                  <span className="font-mono">{f.name}</span>
                  <span className="text-muted-foreground">&rarr;</span>
                  <span>{EXPECTED_FILES[f.name].label}</span>
                  {EXPECTED_FILES[f.name].required && (
                    <Badge variant="outline" className="text-xs">Required</Badge>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Unrecognized files */}
          {unrecognized.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Skipped ({unrecognized.length})
              </p>
              {unrecognized.map(f => (
                <div key={f.name} className="flex items-center gap-2 text-sm py-1 text-muted-foreground">
                  <FileX className="h-4 w-4 shrink-0" />
                  <span className="font-mono">{f.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Missing required files warning */}
          {missingRequired.length > 0 && (
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
              <AlertTriangle className="h-4 w-4 text-yellow-600 mt-0.5 shrink-0" />
              <div className="text-sm">
                <p className="font-medium text-yellow-700 dark:text-yellow-400">Missing required files:</p>
                <p className="text-muted-foreground">
                  {missingRequired.map(m => m.name).join(", ")}
                </p>
              </div>
            </div>
          )}

          {/* Import Button */}
          <div className="pt-2">
            <Button
              size="lg"
              disabled={recognized.length === 0 || missingRequired.length > 0 || importing}
              onClick={() => setShowConfirm(true)}
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importing...
                </>
              ) : (
                <>Import {recognized.length} files</>
              )}
            </Button>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <Card className="p-4 border-red-500/50 bg-red-500/10">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium text-red-700 dark:text-red-400">Import Failed</p>
              <p className="text-sm mt-1">{error}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Results */}
      {result && (
        <Card className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-lg">Import Complete</h2>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(result.counts).map(([key, count]) => (
              <div key={key} className="bg-muted/50 rounded-md p-3">
                <p className="text-2xl font-bold">{count.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground capitalize">{key.replace(/_/g, " ")}</p>
              </div>
            ))}
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div>
              <p className="text-sm font-medium text-yellow-700 dark:text-yellow-400 mb-1">
                Warnings ({result.warnings.length})
              </p>
              <div className="max-h-48 overflow-y-auto bg-muted/30 rounded-md p-2 space-y-1">
                {result.warnings.map((w, i) => (
                  <p key={i} className="text-xs font-mono text-muted-foreground">{w}</p>
                ))}
              </div>
            </div>
          )}

          {/* Skipped Files */}
          {result.skipped_files.length > 0 && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">
                Skipped files: {result.skipped_files.join(", ")}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={setShowConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Data Wipe & Import</AlertDialogTitle>
            <AlertDialogDescription>
              This will <strong>permanently delete all existing data</strong> (categories, profiles,
              parts, labor, miscellaneous, projects, quotes, purchase orders, and all related records)
              and replace it with data from the uploaded CSV files.
              <br /><br />
              Cost codes, discount codes, and company settings will be preserved.
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleImport}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Wipe & Import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
