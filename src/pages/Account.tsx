import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserProfile } from '../modules/auth/components/UserProfile'
import { useAppLayout } from '../layouts/AppLayout'

export default function Account() {
  const navigate = useNavigate()
  const { session, sessionLoaded } = useAppLayout()

  useEffect(() => {
    if (sessionLoaded && !session) navigate('/login')
  }, [sessionLoaded, session, navigate])

  if (!session) return null

  return <UserProfile onLogout={() => navigate('/kamus')} />
}
