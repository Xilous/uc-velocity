import { Fragment, useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import { ProjectForm } from "@/components/forms/ProjectForm"
import { api } from "@/api/client"
import type { Project, Quote, PurchaseOrder } from "@/types"
import { Plus, Trash2, Pencil, FolderOpen, Search, FileText, ShoppingCart } from "lucide-react"

interface ProjectsPageProps {
  onSelectProject: (projectId: number) => void
  onSelectChildDoc: (projectId: number, doc: { type: "quote" | "po"; id: number }) => void
  searchTerm: string
  onSearchTermChange: (value: string) => void
}

export function ProjectsPage({
  onSelectProject,
  onSelectChildDoc,
  searchTerm,
  onSearchTermChange,
}: ProjectsPageProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const [projectsData, quotesData, posData] = await Promise.all([
        api.projects.getAll(),
        api.quotes.getAll(),
        api.purchaseOrders.getAll(),
      ])
      setProjects(projectsData)
      setQuotes(quotesData)
      setPurchaseOrders(posData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch projects")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Are you sure you want to delete this project? All quotes and purchase orders will be deleted.")) return
    try {
      await api.projects.delete(id)
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete project")
    }
  }

  const handleEdit = (project: Project, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingProject(project)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingProject(null)
    setDialogOpen(true)
  }

  const handleDialogClose = (open: boolean) => {
    if (!open) {
      setEditingProject(null)
    }
    setDialogOpen(open)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">Active</Badge>
      case "completed":
        return <Badge variant="secondary">Completed</Badge>
      case "on_hold":
        return <Badge variant="outline">On Hold</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const quotesByProject = useMemo(() => {
    const map = new Map<number, Quote[]>()
    for (const q of quotes) {
      const arr = map.get(q.project_id) ?? []
      arr.push(q)
      map.set(q.project_id, arr)
    }
    return map
  }, [quotes])

  const posByProject = useMemo(() => {
    const map = new Map<number, PurchaseOrder[]>()
    for (const po of purchaseOrders) {
      const arr = map.get(po.project_id) ?? []
      arr.push(po)
      map.set(po.project_id, arr)
    }
    return map
  }, [purchaseOrders])

  // Cross-entity search: a project is kept if it matches directly OR any of its
  // quotes/POs match. When kept via children, we record which ones matched so
  // the user can click straight into that doc.
  const { filteredProjects, matchesByProject } = useMemo(() => {
    const term = searchTerm.toLowerCase().trim()
    if (!term) {
      return {
        filteredProjects: projects,
        matchesByProject: new Map<number, { quotes: Quote[]; pos: PurchaseOrder[] }>(),
      }
    }
    const matches = new Map<number, { quotes: Quote[]; pos: PurchaseOrder[] }>()
    const filtered = projects.filter((project) => {
      const directMatch =
        project.name.toLowerCase().includes(term) ||
        project.uca_project_number.toLowerCase().includes(term) ||
        (project.ucsh_project_number?.toLowerCase().includes(term) ?? false) ||
        project.customer.name.toLowerCase().includes(term) ||
        (project.project_lead?.toLowerCase().includes(term) ?? false) ||
        project.status.toLowerCase().includes(term)

      const projectQuotes = quotesByProject.get(project.id) ?? []
      const projectPOs = posByProject.get(project.id) ?? []

      const matchedQuotes = projectQuotes.filter(
        (q) =>
          q.quote_number.toLowerCase().includes(term) ||
          (q.client_po_number?.toLowerCase().includes(term) ?? false) ||
          (q.work_description?.toLowerCase().includes(term) ?? false),
      )
      const matchedPOs = projectPOs.filter(
        (po) =>
          po.po_number.toLowerCase().includes(term) ||
          po.vendor.name.toLowerCase().includes(term) ||
          (po.vendor_po_number?.toLowerCase().includes(term) ?? false) ||
          (po.work_description?.toLowerCase().includes(term) ?? false),
      )

      if (directMatch || matchedQuotes.length > 0 || matchedPOs.length > 0) {
        if (matchedQuotes.length > 0 || matchedPOs.length > 0) {
          matches.set(project.id, { quotes: matchedQuotes, pos: matchedPOs })
        }
        return true
      }
      return false
    })
    return { filteredProjects: filtered, matchesByProject: matches }
  }, [projects, quotesByProject, posByProject, searchTerm])

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Projects</h1>
          <p className="text-muted-foreground">Manage projects, quotes, and purchase orders</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          New Project
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
          {error}
        </div>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects, POs, quotes, vendors..."
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="bg-card rounded-lg border shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-muted-foreground">Loading...</div>
        ) : filteredProjects.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {projects.length === 0
              ? "No projects found. Create your first project to get started."
              : "No projects match your search."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>UCA #</TableHead>
                <TableHead>UCSH #</TableHead>
                <TableHead>Project Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Project Lead</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created On</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map((project) => {
                const childMatches = matchesByProject.get(project.id)
                return (
                  <Fragment key={project.id}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => onSelectProject(project.id)}
                    >
                      <TableCell className="font-mono text-sm">{project.uca_project_number}</TableCell>
                      <TableCell className="text-muted-foreground">{project.ucsh_project_number || "-"}</TableCell>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FolderOpen className="h-4 w-4 text-muted-foreground" />
                          {project.name}
                        </div>
                      </TableCell>
                      <TableCell>{project.customer.name}</TableCell>
                      <TableCell className="text-muted-foreground">{project.project_lead || "-"}</TableCell>
                      <TableCell>{getStatusBadge(project.status)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(project.created_on).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleEdit(project, e)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => handleDelete(project.id, e)}
                          className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {childMatches && (
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={8} className="py-2">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground pl-6">
                            <span className="uppercase tracking-wide">Matches:</span>
                            {childMatches.quotes.map((q) => (
                              <Badge
                                key={`q-${q.id}`}
                                variant="outline"
                                className="cursor-pointer gap-1 font-mono hover:bg-background"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectChildDoc(project.id, { type: "quote", id: q.id })
                                }}
                              >
                                <FileText className="h-3 w-3" />
                                {q.quote_number}
                              </Badge>
                            ))}
                            {childMatches.pos.map((po) => (
                              <Badge
                                key={`po-${po.id}`}
                                variant="outline"
                                className="cursor-pointer gap-1 font-mono hover:bg-background"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectChildDoc(project.id, { type: "po", id: po.id })
                                }}
                              >
                                <ShoppingCart className="h-3 w-3" />
                                {po.po_number}
                                <span className="text-muted-foreground font-sans">— {po.vendor.name}</span>
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
            <DialogDescription>
              {editingProject ? "Update the project details below." : "Create a new project for a customer."}
            </DialogDescription>
          </DialogHeader>
          <ProjectForm
            project={editingProject ?? undefined}
            onSuccess={() => {
              handleDialogClose(false)
              fetchData()
            }}
            onCancel={() => handleDialogClose(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
