// src/hooks/usePrivilege.js

import { useEffect, useState } from 'react'
import API from '../../api'

const usePrivilege = () => {
  const [privileges, setPrivileges] = useState([])
  useEffect(() => {
    loadPrivileges()
  }, [])

  const loadPrivileges = async () => {
    const user = JSON.parse(sessionStorage.getItem('user'))
    if (!user?.id) return
    const res = await API.get(`/users/privileges/${user.id}`)
    setPrivileges(res.data)
  }

  const canView = (menu) => privileges.some((p) => p.menuName === menu && p.canView)
  return { privileges, canView }
}

export default usePrivilege
