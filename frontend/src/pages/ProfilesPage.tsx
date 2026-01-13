import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { ProfileForm } from "@/components/forms/ProfileForm"
import { api } from "@/api/client"
import type { Profile } from "@/types"
import { Plus, Trash2, Pencil, Users, Building, ExternalLink, Phone, Mail, MapPin } from "lucide-react"

export function ProfilesPage() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null)
  const [viewingProfile, setViewingProfile] = useState<Profile | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.profiles.getAll()
      setProfiles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch profiles")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation() // Prevent row click
    if (!confirm("Are you sure you want to delete this profile?")) return
    try {
      await api.profiles.delete(id)
      fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete profile")
    }
  }

  const handleEdit = (e: React.MouseEvent, profile: Profile) => {
    e.stopPropagation() // Prevent row click
    setEditingProfile(profile)
    setEditDialogOpen(true)
  }

  const handleAdd = () => {
    setEditingProfile(null)
    setEditDialogOpen(true)
  }

  const handleEditDialogClose = (open: boolean) => {
    if (!open) {
      setEditingProfile(null)
    }
    setEditDialogOpen(open)
  }

  const handleRowClick = (profile: Profile) => {
    setViewingProfile(profile)
  }

  // Split profiles into customers and vendors
  const customers = profiles.filter(p => p.type === 'customer')
  const vendors = profiles.filter(p => p.type === 'vendor')

  // Profile table component for reuse
  const ProfileTable = ({ profiles: tableProfiles, emptyMessage }: { profiles: Profile[], emptyMessage: string }) => (
    <div className="bg-card rounded-lg border shadow-sm">
      {tableProfiles.length === 0 ? (
        <div className="p-6 text-center text-muted-foreground text-sm">
          {emptyMessage}
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Contacts</TableHead>
              <TableHead>Website</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tableProfiles.map((profile) => (
              <TableRow
                key={profile.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => handleRowClick(profile)}
              >
                <TableCell className="font-medium">{profile.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  <div className="text-sm">{profile.address}</div>
                  <div className="text-xs">{profile.postal_code}</div>
                </TableCell>
                <TableCell>
                  <div className="text-sm">
                    {profile.contacts.length} contact{profile.contacts.length !== 1 ? 's' : ''}
                  </div>
                  {profile.contacts.length > 0 && (
                    <div className="text-xs text-muted-foreground">
                      {profile.contacts[0].name}
                      {profile.contacts.length > 1 && ` +${profile.contacts.length - 1} more`}
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  {profile.website ? (
                    <a
                      href={profile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-3 w-3" />
                      Visit
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleEdit(e, profile)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => handleDelete(e, profile.id)}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Profiles</h1>
          <p className="text-muted-foreground">Manage customers and vendors</p>
        </div>
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Profile
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-md text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-8 text-center text-muted-foreground">Loading...</div>
      ) : (
        <div className="grid grid-cols-2 gap-6">
          {/* Customers column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Customers
              <Badge variant="secondary" className="ml-2">{customers.length}</Badge>
            </h2>
            <ProfileTable profiles={customers} emptyMessage="No customers yet. Add your first customer profile." />
          </div>

          {/* Vendors column */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Building className="h-5 w-5" />
              Vendors
              <Badge variant="secondary" className="ml-2">{vendors.length}</Badge>
            </h2>
            <ProfileTable profiles={vendors} emptyMessage="No vendors yet. Add your first vendor profile." />
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={handleEditDialogClose}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingProfile ? "Edit Profile" : "Add New Profile"}</DialogTitle>
            <DialogDescription>
              {editingProfile ? "Update the profile details below." : "Create a new customer or vendor with at least one contact."}
            </DialogDescription>
          </DialogHeader>
          <ProfileForm
            profile={editingProfile ?? undefined}
            onSuccess={() => {
              handleEditDialogClose(false)
              fetchData()
            }}
            onCancel={() => handleEditDialogClose(false)}
          />
        </DialogContent>
      </Dialog>

      {/* View Detail Dialog */}
      <Dialog open={!!viewingProfile} onOpenChange={(open) => !open && setViewingProfile(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {viewingProfile?.type === 'customer' ? (
                <Users className="h-5 w-5" />
              ) : (
                <Building className="h-5 w-5" />
              )}
              {viewingProfile?.name}
            </DialogTitle>
            <DialogDescription>
              <Badge variant={viewingProfile?.type === 'customer' ? 'default' : 'secondary'}>
                {viewingProfile?.type}
              </Badge>
            </DialogDescription>
          </DialogHeader>

          {viewingProfile && (
            <div className="space-y-6 max-h-[60vh] overflow-y-auto">
              {/* Profile Information */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">Profile Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">PST (Provincial Tax Number)</p>
                    <p className="font-medium">{viewingProfile.pst}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Postal Code</p>
                    <p className="font-medium">{viewingProfile.postal_code}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Address
                  </p>
                  <p className="font-medium">{viewingProfile.address}</p>
                </div>
                {viewingProfile.website && (
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" /> Website
                    </p>
                    <a
                      href={viewingProfile.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {viewingProfile.website}
                    </a>
                  </div>
                )}
              </div>

              <Separator />

              {/* Contacts */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
                  Contacts ({viewingProfile.contacts.length})
                </h3>
                <div className="space-y-3">
                  {viewingProfile.contacts.map((contact) => (
                    <Card key={contact.id}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base">{contact.name}</CardTitle>
                        {contact.job_title && (
                          <p className="text-sm text-muted-foreground">{contact.job_title}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                            <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                              {contact.email}
                            </a>
                          </div>
                        )}
                        {contact.phone_numbers.length > 0 && (
                          <div className="space-y-1">
                            {contact.phone_numbers.map((phone) => (
                              <div key={phone.id} className="flex items-center gap-2 text-sm">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground capitalize">{phone.type}:</span>
                                <span>{phone.number}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {!contact.email && contact.phone_numbers.length === 0 && (
                          <p className="text-sm text-muted-foreground">No contact details</p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Close button */}
              <div className="flex justify-end pt-4">
                <Button variant="outline" onClick={() => setViewingProfile(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
