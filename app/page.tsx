import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE_NAME } from '@/lib/auth/constants'
import { getSessionSecret, verifySessionToken } from '@/lib/auth/session'

export default async function Home() {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  const secret = getSessionSecret()

  if (token && secret && (await verifySessionToken(token, secret))) {
    redirect('/dashboard')
  }

  redirect('/login')
}
