import React, { useState, useEffect } from 'react'
import {
  CAvatar,
  CDropdown,
  CDropdownDivider,
  CDropdownHeader,
  CDropdownItem,
  CDropdownMenu,
  CDropdownToggle,
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CFormInput,
  CButton,
} from '@coreui/react'
import { cilLockLocked, cilUser, cilSettings } from '@coreui/icons'
import CIcon from '@coreui/icons-react'
import { toast } from 'react-toastify'
import API from '../../api'
import '../../assets/CSS/user.css'

const AppHeaderDropdown = () => {
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [showMailConfigModal, setShowMailConfigModal] = useState(false)
  const [isEditMode, setIsEditMode] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [mailConfigForm, setMailConfigForm] = useState({
    emailID: '',
    password: '',
    port: '',
    host: '',
  })
  const user = JSON.parse(sessionStorage.getItem('user') || '{}')
  const clearPasswordForm = () => {
    setPasswordForm({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    })
  }
  const clearMailConfigForm = () => {
    setMailConfigForm({
      emailID: '',
      password: '',
      port: '',
      host: '',
    })
  }
  useEffect(() => {
    if (showPasswordModal) {
      clearPasswordForm()
    }
  }, [showPasswordModal])

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword.trim()) {
      toast.error('Please Enter Current Password')
      return
    }

    if (!passwordForm.newPassword.trim()) {
      toast.error('Please Enter New Password')
      return
    }

    if (!passwordForm.confirmPassword.trim()) {
      toast.error('Please Enter Confirm Password')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New Password and Confirm Password do not Match')
      return
    }

    try {
      const response = await API.put(`/users/change-password/${user.id}`, {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      })

      toast.success(response?.data || 'Password Changed Successfully')

      clearPasswordForm()
      setShowPasswordModal(false)
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data?.message || error?.response?.data || 'Password Change Failed',
      )
    }
  }

  const handleMailConfig = async () => {
    if (!mailConfigForm.emailID.trim()) {
      toast.error('Please Enter Email ID')
      return
    }

    if (!mailConfigForm.password.trim()) {
      toast.error('Please Enter Password')
      return
    }

    if (!mailConfigForm.host.trim()) {
      toast.error('Please Enter Host')
      return
    }

    if (!mailConfigForm.port) {
      toast.error('Please Enter Port Number')
      return
    }

    try {
      const getResponse = await API.get(`/users/get-data-in-table`)

      console.log('response', getResponse)

      if (getResponse.data === '') {
        const postResponse = await API.post(`/users/save-mail-congif`, {
          Email_Id: mailConfigForm.emailID,
          Password: mailConfigForm.password,
          Host: mailConfigForm.host,
          Port: mailConfigForm.port,
        })
        toast.success(postResponse?.data || 'Mail Config Saved Successfully')
      } else {
        var id = getResponse.data.id
        console.log('response_id', getResponse)
        const putResponse = await API.put(`/users/update-mail-congif/${id}`, {
          Email_Id: mailConfigForm.emailID,
          Password: mailConfigForm.password,
          Host: mailConfigForm.host,
          Port: mailConfigForm.port,
        })
        toast.success(putResponse?.data || 'Mail Config Updated Successfully')
      }

      // const postResponse = await API.post(`/users/save-mail-congif`)
      // toast.success(postResponse?.data || 'Mail Config Saved Successfully')

      clearMailConfigForm()
      setShowMailConfigModal(false)
    } catch (error) {
      console.error(error)

      toast.error(
        error?.response?.data?.message || error?.response?.data || 'Password Change Failed',
      )
    }
  }

  return (
    <>
      <CDropdown variant="nav-item">
        <CDropdownToggle placement="bottom-end" className="py-0 pe-0" caret={false}>
          <CAvatar size="md" style={{ background: '#e4e6ef' }}>
            <CIcon icon={cilUser} size="lg" />
          </CAvatar>
        </CDropdownToggle>

        <CDropdownMenu placement="bottom-end">
          <CDropdownHeader className="bg-body-secondary fw-semibold">
            {user?.username}
          </CDropdownHeader>

          <CDropdownDivider />

          {/* <CDropdownItem
            className="pointer-cursor"
            onClick={() => {
              clearPasswordForm()
              setShowPasswordModal(true)
            }}
          >
            <CIcon icon={cilLockLocked} className="me-2" />
            Change Password
          </CDropdownItem>

          <CDropdownItem
            className="pointer-cursor"
            onClick={async () => {
              try {
                const res = await API.get('/users/get-mail-config')

                if (res.data) {
                  setMailConfigForm({
                    emailID: res.data.email_Id,
                    password: res.data.password,
                    host: res.data.host,
                    port: res.data.port,
                  })

                  setIsEditMode(true)
                } else {
                  clearMailConfigForm()
                  setIsEditMode(false)
                }
                setShowMailConfigModal(true)
              } catch (err) {
                console.error(err)
                clearMailConfigForm()
                setIsEditMode(false)
                setShowMailConfigModal(true)
              }
            }}
          >
            <CIcon icon={cilSettings} className="me-2" />
            Mail Configuration
          </CDropdownItem> */}
        </CDropdownMenu>
      </CDropdown>

      <CModal
        className="password-modal"
        visible={showPasswordModal}
        onClose={() => {
          clearPasswordForm()
          setShowPasswordModal(false)
        }}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilLockLocked} className="me-2" />
            Change Password
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <CFormInput
            type="password"
            label="Current Password"
            placeholder="Enter Current Password"
            autoComplete="new-password"
            name="currentPassword"
            value={passwordForm.currentPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                currentPassword: e.target.value,
              })
            }
          />
          <CFormInput
            type="password"
            label="New Password"
            placeholder="Enter New Password"
            value={passwordForm.newPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                newPassword: e.target.value,
              })
            }
          />

          <CFormInput
            type="password"
            label="Confirm Password"
            placeholder="Enter Confirm Password"
            value={passwordForm.confirmPassword}
            onChange={(e) =>
              setPasswordForm({
                ...passwordForm,
                confirmPassword: e.target.value,
              })
            }
          />
        </CModalBody>

        <CModalFooter>
          <CButton
            className="password-cancel-btn"
            onClick={() => {
              setShowPasswordModal(false)
              clearPasswordForm()
            }}
          >
            Cancel
          </CButton>
          <CButton className="password-update-btn" onClick={handleChangePassword}>
            Update Password
          </CButton>
        </CModalFooter>
      </CModal>

      <CModal
        className="mail-config-modal"
        visible={showMailConfigModal}
        onClose={() => {
          clearMailConfigForm()
          setShowMailConfigModal(false)
          setIsEditMode(false)
        }}
        alignment="center"
        backdrop="static"
      >
        <CModalHeader>
          <CModalTitle>
            <CIcon icon={cilSettings} className="me-2" />
            Mail Configuration
          </CModalTitle>
        </CModalHeader>

        <CModalBody>
          <CFormInput
            type="text"
            label="Email ID"
            placeholder="Enter Email ID"
            value={mailConfigForm.emailID}
            onChange={(e) =>
              setMailConfigForm({
                ...mailConfigForm,
                emailID: e.target.value,
              })
            }
          />
          <CFormInput
            type="password"
            label="Password"
            placeholder="Enter Password"
            value={mailConfigForm.password}
            onChange={(e) =>
              setMailConfigForm({
                ...mailConfigForm,
                password: e.target.value,
              })
            }
          />

          <CFormInput
            type="text"
            label="Host"
            placeholder="Enter Host"
            value={mailConfigForm.host}
            onChange={(e) =>
              setMailConfigForm({
                ...mailConfigForm,
                host: e.target.value,
              })
            }
          />

          <CFormInput
            type="text"
            label="Port"
            placeholder="Enter Port"
            value={mailConfigForm.port}
            onChange={(e) =>
              setMailConfigForm({
                ...mailConfigForm,
                port: e.target.value,
              })
            }
          />
        </CModalBody>

        <CModalFooter>
          <CButton
            className="mail-cancel-btn"
            color="secondary"
            onClick={() => {
              clearMailConfigForm()
              setShowMailConfigModal(false)
            }}
          >
            Cancel
          </CButton>
          <CButton className="mail-update-btn" color="primary" onClick={handleMailConfig}>
            {isEditMode ? 'Update Mail Configuration' : 'Save Mail Configuration'}
          </CButton>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default AppHeaderDropdown
