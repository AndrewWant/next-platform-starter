import { redirect } from 'next/navigation'
import { createClient } from '../../../lib/supabase/server'
import LineupApp from './lineup-app'

export const metadata = {
  title: 'LineUp',
  description: 'Lane read tool for tenpin bowling.',
}

export default async function LineupPage({ searchParams }) {
  const params = await searchParams;
  const isGuest = !!params?.origin;

  if (!isGuest) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) redirect('/login?next=/app/lineup')
  }

  return <LineupApp guestMode={isGuest} />
}
