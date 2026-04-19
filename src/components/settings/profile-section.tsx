'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Loader2, User } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface ProfileSectionProps {
  user: { email?: string; user_metadata?: { display_name?: string } }
}

export function ProfileSection({ user }: ProfileSectionProps) {
  const [displayName, setDisplayName] = useState(
    user.user_metadata?.display_name ?? ''
  )
  const [saving, setSaving] = useState(false)
  const email = user.email ?? ''
  const initials = email.slice(0, 2).toUpperCase()

  async function handleSave() {
    if (!displayName.trim()) {
      toast.error('Display name is required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/settings/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName }),
      })

      if (res.ok) {
        toast.success('Profile updated')
      } else {
        toast.error('Failed to update profile')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card className="card-interactive animate-fade-in-up">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-brand-muted flex items-center justify-center">
            <User className="h-4 w-4 text-brand" />
          </div>
          <div>
            <CardTitle>Profile</CardTitle>
            <CardDescription>Manage your personal information.</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 ring-2 ring-brand/20 ring-offset-2 ring-offset-background">
            <AvatarFallback className="bg-brand text-brand-foreground text-lg font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{displayName || email.split('@')[0]}</p>
            <p className="text-sm text-muted-foreground">{email}</p>
          </div>
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="displayName">Display Name</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              data-testid="display-name"
            />
          </div>

          <div className="space-y-2 max-w-sm">
            <Label htmlFor="email">Email</Label>
          <Input id="email" value={email} disabled className="bg-muted" />
          <p className="text-xs text-muted-foreground">
            Email is managed by your authentication provider and cannot be changed here.
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving} size="sm">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Save changes'}
        </Button>
        </div>
      </CardContent>
    </Card>
  )
}
