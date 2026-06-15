import { useState, useEffect } from 'react'
import { Tabs, Table, Button, Modal, Form, Input, Select, Popconfirm, message, Card, Spin } from 'antd'

interface UserProfile {
  id: number
  username: string
  role: string
  created_at: string
}

interface AdminDashboardProps {
  token: string
  onLogout: () => void
  user: UserProfile
}

interface UserData {
  id: number
  username: string
  role: string
  created_at: string
}

export default function AdminDashboard({ token, onLogout, user }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<UserData[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const [configLoading, setConfigLoading] = useState(false)
  const [configForm] = Form.useForm()

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await fetch('/api/v1/admin/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        setUsers(result.data || [])
      } else {
        message.error(result.msg || 'Failed to fetch users')
      }
    } catch {
      message.error('Failed to connect to server')
    } finally {
      setUsersLoading(false)
    }
  }

  const fetchLLMConfig = async () => {
    setConfigLoading(true)
    try {
      const response = await fetch('/api/v1/admin/llm-config', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        configForm.setFieldsValue(result.data)
      } else {
        message.error(result.msg || 'Failed to fetch LLM config')
      }
    } catch {
      message.error('Failed to connect to server')
    } finally {
      setConfigLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers()
    } else if (activeTab === 'llm') {
      fetchLLMConfig()
    }
  }, [activeTab])

  const handleAddUser = async (values: unknown) => {
    try {
      const response = await fetch('/api/v1/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        message.success('User created successfully')
        setIsModalOpen(false)
        form.resetFields()
        fetchUsers()
      } else {
        message.error(result.msg || 'Failed to create user')
      }
    } catch {
      message.error('Connection failed')
    }
  }

  const handleDeleteUser = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        message.success('User deleted successfully')
        fetchUsers()
      } else {
        message.error(result.msg || 'Failed to delete user')
      }
    } catch {
      message.error('Connection failed')
    }
  }

  const handleSaveConfig = async (values: unknown) => {
    try {
      const response = await fetch('/api/v1/admin/llm-config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(values)
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        message.success('LLM config updated successfully')
      } else {
        message.error(result.msg || 'Failed to update LLM config')
      }
    } catch {
      message.error('Connection failed')
    }
  }

  const userColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
    },
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role: string) => (
        <span className={`px-2 py-0.5 rounded text-xs ${role === 'admin' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'}`}>
          {role}
        </span>
      )
    },
    {
      title: 'Created At',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (dateStr: string) => new Date(dateStr).toLocaleString()
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_: unknown, record: UserData) => (
        record.id === user.id ? (
          <span className="text-xs text-slate-500">Current User</span>
        ) : (
          <Popconfirm
            title="Delete the user"
            description="Are you sure you want to delete this user?"
            onConfirm={() => handleDeleteUser(record.id)}
            okText="Yes"
            cancelText="No"
            className="cursor-pointer"
          >
            <Button type="link" danger size="small">
              Delete
            </Button>
          </Popconfirm>
        )
      )
    }
  ]

  const items = [
    {
      key: 'users',
      label: 'User Management',
      children: (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">System Users</h3>
            <Button
              type="primary"
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-500 hover:bg-blue-600 border-none rounded-lg cursor-pointer"
            >
              Add User
            </Button>
          </div>

          <Table
            dataSource={users}
            columns={userColumns}
            rowKey="id"
            loading={usersLoading}
            pagination={{ pageSize: 10 }}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
          />

          <Modal
            title="Create New User"
            open={isModalOpen}
            onCancel={() => {
              setIsModalOpen(false)
              form.resetFields()
            }}
            footer={null}
            destroyOnClose
            className="dark-modal"
          >
            <Form
              form={form}
              layout="vertical"
              onFinish={handleAddUser}
              className="mt-4"
            >
              <Form.Item
                name="username"
                label="Username"
                rules={[
                  { required: true, message: 'Please input username' },
                  { min: 3, message: 'Username must be at least 3 characters' }
                ]}
              >
                <Input placeholder="Enter username" />
              </Form.Item>

              <Form.Item
                name="password"
                label="Password"
                rules={[
                  { required: true, message: 'Please input password' },
                  { min: 8, message: 'Password must be at least 8 characters' }
                ]}
              >
                <Input.Password placeholder="Enter password" />
              </Form.Item>

              <Form.Item
                name="role"
                label="Role"
                initialValue="user"
                rules={[{ required: true }]}
              >
                <Select className="cursor-pointer">
                  <Select.Option value="user">User</Select.Option>
                  <Select.Option value="admin">Admin</Select.Option>
                </Select>
              </Form.Item>

              <Form.Item className="mb-0 flex justify-end space-x-2">
                <Button onClick={() => setIsModalOpen(false)} className="mr-2 cursor-pointer">
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" className="bg-blue-500 border-none cursor-pointer">
                  Create
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )
    },
    {
      key: 'llm',
      label: 'LLM Configurations',
      children: (
        <Card className="bg-slate-900 border-slate-800 text-white rounded-xl shadow-xl">
          <h3 className="text-lg font-bold text-white mb-6">Large Language Model API Settings</h3>
          <Spin spinning={configLoading}>
            <Form
              form={configForm}
              layout="vertical"
              onFinish={handleSaveConfig}
            >
              <Form.Item
                name="api_url"
                label="API Endpoint URL"
                rules={[{ required: true, message: 'API URL is required' }]}
              >
                <Input placeholder="https://api.openai.com/v1" />
              </Form.Item>

              <Form.Item
                name="api_key"
                label="API Bearer Token / Key"
                rules={[{ required: true, message: 'API Key is required' }]}
              >
                <Input.Password placeholder="sk-..." />
              </Form.Item>

              <Form.Item
                name="model_name"
                label="Model Identifier / Name"
                rules={[{ required: true, message: 'Model Name is required' }]}
              >
                <Input placeholder="gpt-4o" />
              </Form.Item>

              <Form.Item
                name="prompt_tpl"
                label="Article Prompt Template"
                rules={[{ required: true, message: 'Prompt Template is required' }]}
              >
                <Input.TextArea rows={6} placeholder="Template for dialogue generation..." />
              </Form.Item>

              <Form.Item className="mb-0 flex justify-end">
                <Button type="primary" htmlType="submit" className="bg-blue-500 border-none rounded-lg px-6 cursor-pointer">
                  Save Configurations
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </Card>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 flex flex-col">
      <header className="border-b border-slate-900 bg-slate-900/40 backdrop-blur-md sticky top-0 z-50">
        <div className="mx-auto max-w-5xl px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-red-500 to-amber-500 flex items-center justify-center font-bold text-white">
              A
            </div>
            <span className="font-bold text-lg tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-amber-400">
              Admin Portal
            </span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="text-sm text-slate-300">
              Admin: <strong className="text-white">{user.username}</strong>
            </span>
            <button
              onClick={onLogout}
              className="rounded-lg bg-slate-900 border border-slate-800 px-3.5 py-1.5 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-700 transition-colors cursor-pointer"
            >
              Log Out
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-5xl px-4 py-8">
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={items}
          className="admin-tabs"
        />
      </main>
    </div>
  )
}
