import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { api } from "@/api/client"
import type { Contact, ContactCreate, PhoneType } from "@/types"
import { Plus, Trash2, Phone } from "lucide-react"

// Helper to generate temporary IDs for new items
const generateTempId = () => `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

interface PhoneFormData {
  tempId: string
  type: PhoneType
  number: string
}

interface ContactFormProps {
  profileId: number  // The customer/profile ID to add the contact to
  onSuccess?: (newContact: Contact) => void
  onCancel?: () => void
}

export function ContactForm({ profileId, onSuccess, onCancel }: ContactFormProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Contact fields
  const [name, setName] = useState("")
  const [jobTitle, setJobTitle] = useState("")
  const [email, setEmail] = useState("")
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneFormData[]>([])

  const createEmptyPhone = (): PhoneFormData => ({
    tempId: generateTempId(),
    type: "work",
    number: ""
  })

  const addPhone = () => {
    setPhoneNumbers([...phoneNumbers, createEmptyPhone()])
  }

  const removePhone = (tempId: string) => {
    setPhoneNumbers(phoneNumbers.filter(p => p.tempId !== tempId))
  }

  const updatePhone = (tempId: string, field: keyof PhoneFormData, value: string) => {
    setPhoneNumbers(phoneNumbers.map(p =>
      p.tempId === tempId ? { ...p, [field]: value } : p
    ))
  }

  const isFormValid = () => {
    return name.trim() !== ""
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const contactData: ContactCreate = {
      name: name.trim(),
      job_title: jobTitle.trim() || undefined,
      email: email.trim() || undefined,
      phone_numbers: phoneNumbers
        .map(p => ({ type: p.type, number: p.number.trim() }))
        .filter(p => p.number !== "")
    }

    try {
      const newContact = await api.profiles.addContact(profileId, contactData)
      onSuccess?.(newContact)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact")
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
        <Label htmlFor="name">Contact Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., John Smith"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="jobTitle">Job Title</Label>
        <Input
          id="jobTitle"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="e.g., Project Manager"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="e.g., john@example.com"
        />
      </div>

      {/* Phone Numbers */}
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <Label className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Phone Numbers
          </Label>
          <Button type="button" variant="ghost" size="sm" onClick={addPhone}>
            <Plus className="h-4 w-4 mr-1" /> Add Phone
          </Button>
        </div>

        {phoneNumbers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No phone numbers added</p>
        ) : (
          <div className="space-y-2">
            {phoneNumbers.map((phone) => (
              <div key={phone.tempId} className="flex gap-2 items-center">
                <Select
                  value={phone.type}
                  onValueChange={(v) => updatePhone(phone.tempId, 'type', v)}
                >
                  <SelectTrigger className="w-28">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="work">Work</SelectItem>
                    <SelectItem value="mobile">Mobile</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  value={phone.number}
                  onChange={(e) => updatePhone(phone.tempId, 'number', e.target.value)}
                  placeholder="(555) 123-4567"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePhone(phone.tempId)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Form Actions */}
      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={loading || !isFormValid()}>
          {loading ? "Creating..." : "Create Contact"}
        </Button>
      </div>
    </form>
  )
}
