'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow
} from '@/components/ui/table'
import { Building2, Crown, Loader2, Shield, User, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

interface Member {
  user_id: string
  role: string
  created_at: string
}

const roleBadgeColors: Record<string, string> = {
  owner: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  admin: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  member: 'bg-muted text-muted-foreground',
  viewer: 'bg-muted text-muted-foreground',
}

const roleIcons: Record<string, typeof Crown> = {
  owner: Crown,
  admin: Shield,
  member: User,
  viewer: User,
}

interface OrganizationSectionProps {
  orgName: string
  members: Member[]
  isOwnerOrAdmin: boolean
}

export function OrganizationSection({
  orgName,
  members,
  isOwnerOrAdmin,
}: OrganizationSectionProps) {
  const [name, setName] = useState(orgName)
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/organization', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        toast.success('Organization name updated')
      } else {
        toast.error('Failed to update organization')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card className="card-interactive animate-fade-in-up">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-brand-muted flex items-center justify-center">
              <Building2 className="h-4 w-4 text-brand" />
            </div>
            <div>
              <CardTitle>Organization</CardTitle>
              <CardDescription>Manage your organization details.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-sm">
            <Label htmlFor="orgName">Organization Name</Label>
            <Input
              id="orgName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwnerOrAdmin}
              data-testid="org-name-input"
            />
          </div>
          {isOwnerOrAdmin && (
            <Button onClick={handleSave} disabled={saving} size="sm" data-testid="org-save-button">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : 'Update name'}
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="card-interactive animate-fade-in-up" style={{ animationDelay: '80ms' }}>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>{members.length} member{members.length !== 1 ? 's' : ''} in your organization</CardDescription>
            </div>
          </div>
          {isOwnerOrAdmin && (
            <Button variant="outline" size="sm" disabled className="shrink-0">
              <UserPlus className="mr-2 h-4 w-4" />
              Invite
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <Table data-testid="members-list">
            <TableHeader>
              <TableRow>
                <TableHead>User ID</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {members.map((m) => {
                const RoleIcon = roleIcons[m.role] ?? User
                return (
                  <TableRow key={m.user_id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-mono text-xs">
                      {m.user_id.slice(0, 8)}...
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`gap-1 ${roleBadgeColors[m.role] ?? ''}`}>
                        <RoleIcon className="h-3 w-3" />
                        {m.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(m.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
