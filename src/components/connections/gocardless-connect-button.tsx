'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, ArrowRight, Search, Building2 } from 'lucide-react'
import { toast } from 'sonner'

const EU_EEA_COUNTRIES = [
  { code: 'AT', name: 'Austria' },
  { code: 'BE', name: 'Belgium' },
  { code: 'BG', name: 'Bulgaria' },
  { code: 'HR', name: 'Croatia' },
  { code: 'CY', name: 'Cyprus' },
  { code: 'CZ', name: 'Czech Republic' },
  { code: 'DK', name: 'Denmark' },
  { code: 'EE', name: 'Estonia' },
  { code: 'FI', name: 'Finland' },
  { code: 'FR', name: 'France' },
  { code: 'DE', name: 'Germany' },
  { code: 'GR', name: 'Greece' },
  { code: 'HU', name: 'Hungary' },
  { code: 'IS', name: 'Iceland' },
  { code: 'IE', name: 'Ireland' },
  { code: 'IT', name: 'Italy' },
  { code: 'LV', name: 'Latvia' },
  { code: 'LI', name: 'Liechtenstein' },
  { code: 'LT', name: 'Lithuania' },
  { code: 'LU', name: 'Luxembourg' },
  { code: 'MT', name: 'Malta' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'NO', name: 'Norway' },
  { code: 'PL', name: 'Poland' },
  { code: 'PT', name: 'Portugal' },
  { code: 'RO', name: 'Romania' },
  { code: 'SK', name: 'Slovakia' },
  { code: 'SI', name: 'Slovenia' },
  { code: 'ES', name: 'Spain' },
  { code: 'SE', name: 'Sweden' },
  { code: 'GB', name: 'United Kingdom' },
]

interface Institution {
  id: string
  name: string
  bic: string
  logo: string
  countries: string[]
}

export function GoCardlessConnectButton({ onSuccess }: { onSuccess?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [country, setCountry] = useState('')
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loadingInstitutions, setLoadingInstitutions] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchInstitutions = useCallback(async (countryCode: string) => {
    setLoadingInstitutions(true)
    setError(null)
    setInstitutions([])
    setSearchQuery('')
    try {
      const res = await fetch(`/api/gocardless/institutions?country=${countryCode}`)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to load banks')
        return
      }
      setInstitutions(data.institutions || [])
    } catch {
      setError('Network error')
    } finally {
      setLoadingInstitutions(false)
    }
  }, [])

  useEffect(() => {
    if (country) {
      fetchInstitutions(country)
    }
  }, [country, fetchInstitutions])

  async function handleConnect(institution: Institution) {
    setConnecting(true)
    setError(null)
    try {
      const res = await fetch('/api/gocardless/create-requisition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          institutionId: institution.id,
          institutionName: institution.name,
          country,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error('Failed to connect', { description: data.error })
        setError(data.error || 'Connection failed')
        return
      }

      if (data.link) {
        toast.info('Redirecting to bank...', {
          description: 'Complete authorization on your bank\'s website',
        })
        // If mock mode returned a relative /connections URL, just reload
        if (data.link.includes('mock_gocardless=true')) {
          toast.success('EU Bank connected', { description: institution.name })
          setOpen(false)
          onSuccess?.()
          router.refresh()
        } else {
          window.location.href = data.link
        }
      }
    } catch {
      toast.error('Connection failed', { description: 'Network error — please try again' })
      setError('Network error')
    } finally {
      setConnecting(false)
    }
  }

  const filtered = institutions.filter((i) =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button variant="outline" data-testid="gocardless-connect-button" className="group/btn gap-2">
            Connect EU Bank
            <ArrowRight className="h-3.5 w-3.5 -translate-x-1 opacity-0 group-hover/btn:translate-x-0 group-hover/btn:opacity-100 transition-all" />
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect EU Bank Account</DialogTitle>
          <DialogDescription>
            Select your country and bank to connect via Open Banking (PSD2).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Country selector */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Country</label>
            <Select value={country} onValueChange={(val) => { if (val) setCountry(val) }}>
              <SelectTrigger>
                <SelectValue placeholder="Select your country" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {EU_EEA_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Institution search + list */}
          {country && (
            <div className="space-y-2">
              {loadingInstitutions ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">
                    Loading banks...
                  </span>
                </div>
              ) : institutions.length > 0 ? (
                <>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search banks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8"
                    />
                  </div>
                  <div className="max-h-52 overflow-y-auto rounded-lg border divide-y">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                        No banks match &ldquo;{searchQuery}&rdquo;
                      </div>
                    ) : (
                      filtered.map((inst) => (
                        <button
                          key={inst.id}
                          type="button"
                          onClick={() => handleConnect(inst)}
                          disabled={connecting}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left text-sm hover:bg-muted/50 transition-colors disabled:opacity-50"
                        >
                          {inst.logo ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={inst.logo}
                              alt=""
                              className="h-7 w-7 rounded object-contain"
                            />
                          ) : (
                            <div className="h-7 w-7 rounded bg-muted flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium truncate">{inst.name}</span>
                          {connecting && (
                            <Loader2 className="h-4 w-4 animate-spin ml-auto shrink-0" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              ) : error ? (
                <p className="text-sm text-red-500 py-2">{error}</p>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <Building2 className="h-8 w-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No banks available for this country.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
