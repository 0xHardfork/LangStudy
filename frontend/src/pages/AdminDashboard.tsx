import { useState, useEffect } from 'react'
import { ConfigProvider, theme, Tabs, Table, Button, Modal, Form, Input, InputNumber, Select, Popconfirm, message, Card, Spin } from 'antd'
import {
  adminListDialogueTypes,
  adminCreateDialogueType,
  adminUpdateDialogueType,
  adminDeleteDialogueType,
} from '../services/api'
import { useAppStore } from '../store/useAppStore'

interface UserProfile {
  id: number
  username: string
  role: string
  created_at: string
}

interface AdminDashboardProps {
  onLogout: () => void
  user: UserProfile
}

interface UserData {
  id: number
  username: string
  role: string
  is_approved: boolean
  created_at: string
}

interface DialogueTypeData {
  id: number
  name: string
  description: string
  emoji: string
  sort_order: number
  created_at: string
  updated_at: string
}

const EMOJI_OPTIONS = [
  { value: '💬', label: '💬 Conversation' },
  { value: '💼', label: '💼 Business & Work' },
  { value: '🛍️', label: '🛍️ Shopping' },
  { value: '🍜', label: '🍜 Food & Restaurant' },
  { value: '🏥', label: '🏥 Health & Hospital' },
  { value: '🎨', label: '🎨 Art & Hobby' },
  { value: '🚨', label: '🚨 Incident & Alert' },
  { value: '🛡️', label: '🛡️ Security' },
  { value: '🔧', label: '🔧 DevOps & Tools' },
  { value: '✈️', label: '✈️ Travel & Flight' },
  { value: '🏨', label: '🏨 Hotel & Lodging' },
  { value: '🏫', label: '🏫 School & Education' },
  { value: '💻', label: '💻 Coding & IT' },
  { value: '📚', label: '📚 Reading & Library' },
  { value: '🗣️', label: '🗣️ Speaking & Pronunciation' },
  { value: '⚙️', label: '⚙️ Settings & System' },
  { value: '🧠', label: '🧠 Mind & Learning' },
  { value: '🎵', label: '🎵 Music' },
  { value: '🍿', label: '🍿 Movies & Entertainment' },
  { value: '⚽', label: '⚽ Sports' }
]

export default function AdminDashboard({ onLogout, user }: AdminDashboardProps) {
  const token = useAppStore(state => state.token!)
  const [activeTab, setActiveTab] = useState('users')
  const [users, setUsers] = useState<UserData[]>([])
  const [usersLoading, setUsersLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [form] = Form.useForm()

  const [configLoading, setConfigLoading] = useState(false)
  const [configForm] = Form.useForm()
  const [testingConfig, setTestingConfig] = useState(false)

  // Dialogue types state
  const [dtypes, setDtypes] = useState<DialogueTypeData[]>([])
  const [dtypesLoading, setDtypesLoading] = useState(false)
  const [dtypeModalOpen, setDtypeModalOpen] = useState(false)
  const [editingDtype, setEditingDtype] = useState<DialogueTypeData | null>(null)
  const [dtypeForm] = Form.useForm()

  const fetchUsers = async () => {
    setUsersLoading(true)
    try {
      const response = await fetch('/api/v1/admin/users', {
        credentials: 'same-origin'
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
        credentials: 'same-origin'
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        setTimeout(() => {
          configForm.setFieldsValue(result.data)
        }, 100)
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
    } else if (activeTab === 'dtypes') {
      fetchDtypes()
    }
  }, [activeTab])

  const fetchDtypes = async () => {
    setDtypesLoading(true)
    try {
      const data = await adminListDialogueTypes(token)
      setDtypes(data)
    } catch {
      message.error('Failed to fetch dialogue types')
    } finally {
      setDtypesLoading(false)
    }
  }

  const handleDtypeSubmit = async (values: { name: string; description: string; emoji: string; sort_order: number }) => {
    try {
      if (editingDtype) {
        await adminUpdateDialogueType(token, editingDtype.id, values)
        message.success('Dialogue type updated')
      } else {
        await adminCreateDialogueType(token, values)
        message.success('Dialogue type created')
      }
      setDtypeModalOpen(false)
      dtypeForm.resetFields()
      setEditingDtype(null)
      fetchDtypes()
    } catch (e: unknown) {
      message.error((e as Error).message || 'Operation failed')
    }
  }

  const handleDtypeDelete = async (id: number) => {
    try {
      await adminDeleteDialogueType(token, id)
      message.success('Deleted')
      fetchDtypes()
    } catch {
      message.error('Delete failed')
    }
  }

  const handleAddUser = async (values: unknown) => {
    try {
      const response = await fetch('/api/v1/admin/users', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
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
        credentials: 'same-origin'
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

  const handleApproveUser = async (id: number) => {
    try {
      const response = await fetch(`/api/v1/admin/users/${id}/approve`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        message.success('User approved successfully')
        fetchUsers()
      } else {
        message.error(result.msg || 'Failed to approve user')
      }
    } catch {
      message.error('Connection failed')
    }
  }

  const handleSaveConfig = async (values: unknown) => {
    try {
      const response = await fetch('/api/v1/admin/llm-config', {
        method: 'PUT',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
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

  const handleTestConfig = async () => {
    try {
      const values = await configForm.validateFields(['api_url', 'api_key', 'model_name'])
      setTestingConfig(true)
      const response = await fetch('/api/v1/admin/llm-config/test', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(values)
      })
      const result = await response.json()
      if (response.ok && result.code === 0) {
        message.success(`测试成功！大模型响应："${result.data.response}"`)
      } else {
        message.error(result.msg || '测试失败，请检查配置')
      }
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'errorFields' in err) {
        return
      }
      message.error((err as Error).message || '连接失败')
    } finally {
      setTestingConfig(false)
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
      title: 'Status',
      dataIndex: 'is_approved',
      key: 'is_approved',
      render: (isApproved: boolean, record: UserData) => (
        record.role === 'admin' ? (
          <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
            Active
          </span>
        ) : isApproved ? (
          <span className="px-2 py-0.5 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/20">
            Approved
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
            Pending Approval
          </span>
        )
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
          <div className="flex gap-2">
            {!record.is_approved && record.role !== 'admin' && (
              <Button
                type="link"
                onClick={() => handleApproveUser(record.id)}
                size="small"
                className="text-green-500 hover:text-green-400 p-0 mr-2"
              >
                Approve
              </Button>
            )}
            <Popconfirm
              title="Delete the user"
              description="Are you sure you want to delete this user?"
              onConfirm={() => handleDeleteUser(record.id)}
              okText="Yes"
              cancelText="No"
              className="cursor-pointer"
            >
              <Button type="link" danger size="small" className="p-0">
                Delete
              </Button>
            </Popconfirm>
          </div>
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
      forceRender: true,
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
                label="Dialogue Generation Prompt Template (对话生成 Prompt 模版)"
                rules={[{ required: true, message: 'Prompt Template is required' }]}
                extra={
                  <div className="mt-2 text-xs text-slate-400 border border-slate-800/80 bg-slate-950/40 rounded-lg p-3 space-y-1.5">
                    <div>
                      <strong>可使用变量：</strong>
                      <code className="text-blue-400 ml-1">{"{{language}}"}</code> (目标语言),
                      <code className="text-blue-400 ml-1">{"{{level}}"}</code> (难度等级),
                      <code className="text-blue-400 ml-1">{"{{topic}}"}</code> (主题名称),
                      <code className="text-blue-400 ml-1">{"{{topic_description}}"}</code> (主题详细描述)。
                    </div>
                    <div>
                      <strong>模版示例：</strong>
                      <pre className="text-slate-500 font-mono text-[10px] mt-1 bg-slate-950 p-2 rounded overflow-x-auto leading-relaxed">
{`Generate a natural dialogue in {{language}} about the topic "{{topic}}".{{topic_description}}

The target learner's level is: {{level}}. Adjust the language difficulty strictly according to these guidelines:
1. If level is "beginner": Use simple vocabulary, basic daily words, simple sentence structures (S-V-O), short sentences, and primarily present tense. Avoid complex grammar or idioms.
2. If level is "intermediate": Use common vocabulary, standard everyday expressions, compound/complex sentences (e.g., using "although", "because", "who", "which"), and a mix of tenses.
3. If level is "advanced": Use rich vocabulary, idiomatic expressions, complex syntactic structures (e.g., inversion, conditional, subjunctive), longer sentences, and native-like phrasing.

The dialogue should have exactly 16 lines, alternating between speaker A (female) and speaker B (male).
Return ONLY a JSON array with no other text, in this exact format:
[{"speaker":"A","original_text":"<text in {{language}}>","translation":"<Chinese translation>"},...]`}
                      </pre>
                    </div>
                  </div>
                }
              >
                <Input.TextArea rows={6} placeholder="Template for dialogue generation..." />
              </Form.Item>

              <Form.Item
                name="vocab_prompt_tpl"
                label="Vocabulary Extraction Prompt Template (核心词汇提取 Prompt 模版)"
                rules={[{ required: true, message: 'Vocabulary Prompt Template is required' }]}
                extra={
                  <div className="mt-2 text-xs text-slate-400 border border-slate-800/80 bg-slate-950/40 rounded-lg p-3 space-y-1.5">
                    <div>
                      <strong>可使用变量：</strong>
                      <code className="text-blue-400 ml-1">{"{{max_line_index}}"}</code> (最大行索引，通常为 15),
                      <code className="text-blue-400 ml-1">{"{{lines_json}}"}</code> (当前生成的 16 行对话 JSON 数组数据)。
                    </div>
                    <div>
                      <strong>模版示例：</strong>
                      <pre className="text-slate-500 font-mono text-[10px] mt-1 bg-slate-950 p-2 rounded overflow-x-auto leading-relaxed">
{`Given these dialogue lines (indexed 0 to {{max_line_index}}):
{{lines_json}}

For each line, identify the top 3 most important vocabulary words for language learners.
Rate each word's importance from 1 (most important) to 4 (least important).
Word index is the 0-based position of the word when the sentence is split by spaces.
Return ONLY a JSON array with no other text:
[{"line_index":0,"word":"<word>","word_index":0,"importance":1},...]`}
                      </pre>
                    </div>
                  </div>
                }
              >
                <Input.TextArea rows={6} placeholder="Template for vocabulary extraction..." />
              </Form.Item>

              <Form.Item
                name="grammar_prompt_tpl"
                label="Grammar Analysis & Cloze Quiz Prompt Template (语法分析与完形填空 Prompt 模版)"
                rules={[{ required: true, message: 'Grammar Prompt Template is required' }]}
                extra={
                  <div className="mt-2 text-xs text-slate-400 border border-slate-800/80 bg-slate-950/40 rounded-lg p-3 space-y-1.5">
                    <div>
                      <strong>可使用变量：</strong>
                      <code className="text-blue-400 ml-1">{"{{sentence}}"}</code> (待分析的原始英文单句内容)。
                    </div>
                    <div>
                      <strong>模版示例：</strong>
                      <pre className="text-slate-500 font-mono text-[10px] mt-1 bg-slate-950 p-2 rounded overflow-x-auto leading-relaxed">
{`You are an expert English grammar teacher. Analyze the grammar structure of the following sentence and generate Cloze multiple-choice questions testing key grammar points.

Sentence: "{{sentence}}"

Generate a JSON object strictly matching this schema:
{
  "translation": "accurate Chinese translation of the sentence",
  "explanation": "Detailed grammatical analysis of the sentence structure and explanations of the syntax rules used.",
  "quizzes": [
    {
      "question": "Sentence with blank (use ___ for blank)",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_option": 0,
      "tags": ["Grammar Concept Tag 1 (e.g. Attributive Clause)"],
      "explanations": {
        "0": "Explanation for Option A",
        "1": "Explanation for Option B",
        "2": "Explanation for Option C",
        "3": "Explanation for Option D"
      }
    }
  ]
}`}
                      </pre>
                    </div>
                  </div>
                }
              >
                <Input.TextArea rows={12} placeholder="Template for grammar analysis and cloze generation..." />
              </Form.Item>

              <Form.Item className="mb-0 flex justify-end space-x-3">
                <Button
                  type="default"
                  onClick={handleTestConfig}
                  loading={testingConfig}
                  className="border-slate-700 text-slate-300 hover:text-white hover:border-slate-500 rounded-lg px-6 cursor-pointer mr-3"
                >
                  Test Connection
                </Button>
                <Button type="primary" htmlType="submit" className="bg-blue-500 border-none rounded-lg px-6 cursor-pointer">
                  Save Configurations
                </Button>
              </Form.Item>
            </Form>
          </Spin>
        </Card>
      )
    },
    {
      key: 'dtypes',
      label: 'Dialogue Types',
      children: (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-white">Dialogue Topic Types</h3>
            <Button
              type="primary"
              onClick={() => {
                setEditingDtype(null)
                dtypeForm.resetFields()
                dtypeForm.setFieldsValue({ emoji: '💬', sort_order: 0 })
                setDtypeModalOpen(true)
              }}
              className="bg-purple-600 hover:bg-purple-700 border-none rounded-lg cursor-pointer"
            >
              Add Type
            </Button>
          </div>

          <Table
            dataSource={dtypes}
            rowKey="id"
            loading={dtypesLoading}
            pagination={{ pageSize: 20 }}
            className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
            columns={[
              {
                title: 'Emoji',
                dataIndex: 'emoji',
                key: 'emoji',
                width: 64,
                render: (e: string) => <span style={{ fontSize: '1.5rem' }}>{e}</span>,
              },
              {
                title: 'Name',
                dataIndex: 'name',
                key: 'name',
                render: (name: string) => <span className="font-semibold text-white">{name}</span>,
              },
              {
                title: 'Description',
                dataIndex: 'description',
                key: 'description',
                render: (desc: string) => (
                  <span className="text-slate-400 text-xs line-clamp-2">{desc || '—'}</span>
                ),
              },
              {
                title: 'Sort',
                dataIndex: 'sort_order',
                key: 'sort_order',
                width: 64,
              },
              {
                title: 'Actions',
                key: 'actions',
                width: 120,
                render: (_: unknown, record: DialogueTypeData) => (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button
                      type="link"
                      size="small"
                      onClick={() => {
                        setEditingDtype(record)
                        dtypeForm.setFieldsValue(record)
                        setDtypeModalOpen(true)
                      }}
                    >
                      Edit
                    </Button>
                    <Popconfirm
                      title="Delete this type?"
                      onConfirm={() => handleDtypeDelete(record.id)}
                      okText="Yes"
                      cancelText="No"
                    >
                      <Button type="link" danger size="small">Delete</Button>
                    </Popconfirm>
                  </div>
                ),
              },
            ]}
          />

          <Modal
            title={editingDtype ? 'Edit Dialogue Type' : 'Create Dialogue Type'}
            open={dtypeModalOpen}
            onCancel={() => {
              setDtypeModalOpen(false)
              dtypeForm.resetFields()
              setEditingDtype(null)
            }}
            footer={null}
            destroyOnClose
          >
            <Form
              form={dtypeForm}
              layout="vertical"
              onFinish={handleDtypeSubmit}
              className="mt-4"
            >
              <Form.Item
                name="emoji"
                label="Emoji"
                rules={[{ required: true, message: 'Please select an emoji' }]}
              >
                <Select
                  placeholder="Select emoji"
                  options={EMOJI_OPTIONS}
                  style={{ width: '180px' }}
                />
              </Form.Item>

              <Form.Item
                name="name"
                label="Name"
                rules={[{ required: true, message: 'Name is required' }]}
              >
                <Input placeholder="e.g. k8s-security" />
              </Form.Item>

              <Form.Item
                name="description"
                label="Description (used as AI context)"
              >
                <Input.TextArea
                  rows={4}
                  placeholder="Describe the topic context so the AI generates more relevant dialogue..."
                />
              </Form.Item>

              <Form.Item name="sort_order" label="Sort Order" initialValue={0}>
                <InputNumber style={{ width: '100%' }} />
              </Form.Item>

              <Form.Item className="mb-0 flex justify-end space-x-2">
                <Button onClick={() => setDtypeModalOpen(false)} className="mr-2 cursor-pointer">
                  Cancel
                </Button>
                <Button type="primary" htmlType="submit" className="bg-purple-600 border-none cursor-pointer">
                  {editingDtype ? 'Update' : 'Create'}
                </Button>
              </Form.Item>
            </Form>
          </Modal>
        </div>
      )
    }
  ]


  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#8b5cf6',      // violet-500
          colorBgContainer: '#0f172a',  // slate-900
          colorBgElevated: '#1e293b',   // slate-800
          colorBorder: '#1e293b',       // slate-800
          colorText: '#f8fafc',         // slate-50
          colorTextDescription: '#94a3b8', // slate-400
        }
      }}
    >
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
    </ConfigProvider>
  )
}
