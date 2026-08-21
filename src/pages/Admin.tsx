import { AdminConsole } from '../modules/admin/components/AdminConsole'
import { useAppLayout } from '../layouts/AppLayout'

export default function Admin() {
  const { userRole } = useAppLayout()

  if (userRole !== 'admin') {
    return <div className="text-ink-muted text-sm">Anda tidak memiliki akses ke halaman ini.</div>
  }

  return <AdminConsole />
}
