CREATE TABLE IF NOT EXISTS dialogue_types (
    id          BIGSERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT         NOT NULL DEFAULT '',
    emoji       VARCHAR(10)  NOT NULL DEFAULT '💬',
    sort_order  INT          NOT NULL DEFAULT 0,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Seed with the previously hardcoded topics
INSERT INTO dialogue_types (name, description, emoji, sort_order) VALUES
    ('SDL',         'Software Development Lifecycle discussions: requirements, design reviews, sprints, and release planning conversations between engineering team members.', '🛡️', 10),
    ('Incident',    'On-call incident response conversations: triaging alerts, identifying root cause, coordinating mitigation, and post-mortem debriefs.', '🚨', 20),
    ('购物',         '日常购物场景：询价、议价、退换货、结账等真实对话。', '🛍️', 30),
    ('餐厅点餐',     '餐厅就餐场景：点菜、询问食材、结账、与服务员的互动对话。', '🍜', 40),
    ('职场沟通',     '职场日常沟通：会议安排、任务协作、绩效讨论、跨团队沟通。', '💼', 50),
    ('健康与医疗',   '医疗就诊场景：挂号、与医生的问诊对话、药品询问、健康建议。', '🏥', 60),
    ('兴趣爱好',     '日常兴趣爱好话题：旅行、音乐、运动、电影等轻松休闲对话。', '🎨', 70),
    ('k8s-security','Kubernetes security topics: RBAC policies, pod security standards, network policies, admission controllers, and CVE discussions.', '☸️', 80),
    ('DevSevOps',   'DevSecOps pipeline conversations: CI/CD security gates, SAST/DAST integration, secrets management, and supply chain security.', '🔧', 90),
    ('Web3-Security','Web3 and blockchain security: smart contract auditing, reentrancy attacks, DeFi exploit discussions, and wallet security best practices.', '⛓️', 100)
ON CONFLICT (name) DO NOTHING;
