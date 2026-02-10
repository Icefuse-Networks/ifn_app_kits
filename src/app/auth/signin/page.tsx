'use client'

import { useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Suspense } from 'react'

function SignInContent() {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') || '/dashboard'

  useEffect(() => {
    signIn('icefuse', { callbackUrl, redirect: true })
  }, [callbackUrl])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Redirecting to sign in...</p>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Loading...</p></div>}>
      <SignInContent />
    </Suspense>
  )
}
