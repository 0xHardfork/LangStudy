import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../../core/di/service_locator.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/cubit/auth_state.dart';
import '../../auth/models/auth_model.dart';
import '../data/repository/auth_repository.dart';

class ProfilePage extends StatefulWidget {
  const ProfilePage({super.key});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  final _formKey = GlobalKey<FormState>();
  final _nicknameController = TextEditingController();
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  String _nativeLang = 'zh';
  String _targetLang = 'en';
  String _targetLevel = 'beginner';
  int _fillBlankLevel = 1;

  bool _showPasswordFields = false;
  bool _saving = false;
  String? _error;
  String? _success;

  final List<Map<String, String>> _nativeLanguages = [
    {'value': 'zh', 'label': '简体中文'},
    {'value': 'en', 'label': 'English'},
    {'value': 'ja', 'label': '日本語'},
    {'value': 'ko', 'label': '한국어'},
    {'value': 'fr', 'label': 'Français'},
    {'value': 'de', 'label': 'Deutsch'},
    {'value': 'es', 'label': 'Español'},
  ];

  @override
  void initState() {
    super.initState();
    _loadProfileData();
  }

  void _loadProfileData() {
    final state = context.read<AuthCubit>().state;
    if (state is AuthAuthenticated && state.profile != null) {
      final profile = state.profile!;
      _nicknameController.text = profile.nickname;
      _nativeLang = profile.nativeLanguage;
      _fillBlankLevel = profile.fillBlankLevel;
      if (profile.targetLanguages.isNotEmpty) {
        _targetLang = profile.targetLanguages[0].lang;
        _targetLevel = profile.targetLanguages[0].level;
      }
    }
  }

  @override
  void dispose() {
    _nicknameController.dispose();
    _oldPasswordController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _saving = true;
      _error = null;
      _success = null;
    });

    try {
      final repo = getIt<AuthRepository>();

      // 1. Password change if requested
      if (_showPasswordFields) {
        final oldPassword = _oldPasswordController.text;
        final newPassword = _newPasswordController.text;
        final confirmPassword = _confirmPasswordController.text;

        if (oldPassword.isEmpty || newPassword.isEmpty) {
          throw Exception('请输入密码字段');
        }
        if (newPassword.length < 8) {
          throw Exception('新密码长度必须至少为 8 位');
        }
        if (newPassword != confirmPassword) {
          throw Exception('两次输入的新密码不一致');
        }

        await repo.changePassword(oldPassword: oldPassword, newPassword: newPassword);
        _oldPasswordController.clear();
        _newPasswordController.clear();
        _confirmPasswordController.clear();
      }

      // 2. Profile upsert
      final payload = UserLearningProfile(
        nickname: _nicknameController.text.trim(),
        nativeLanguage: _nativeLang,
        targetLanguages: [
          TargetLanguage(lang: _targetLang, level: _targetLevel),
        ],
        fillBlankLevel: _fillBlankLevel,
      );

      await context.read<AuthCubit>().updateLearningProfile(payload);

      setState(() {
        _success = '保存设定成功';
        _showPasswordFields = false;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _saving = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('个人设定', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              if (_error != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.red.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.red.withOpacity(0.3)),
                  ),
                  child: Text(_error!, style: const TextStyle(color: Colors.redAccent)),
                ),
                const SizedBox(height: 16),
              ],
              if (_success != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.green.withOpacity(0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green.withOpacity(0.3)),
                  ),
                  child: Text(_success!, style: const TextStyle(color: Colors.greenAccent)),
                ),
                const SizedBox(height: 16),
              ],

              // Nickname
              const Text('昵称', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              TextFormField(
                controller: _nicknameController,
                validator: (val) => (val == null || val.trim().isEmpty) ? '昵称不能为空' : null,
                decoration: InputDecoration(
                  hintText: '请输入您的昵称',
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),

              // Password toggle button
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  onPressed: () {
                    setState(() {
                      _showPasswordFields = !_showPasswordFields;
                      _error = null;
                      _success = null;
                    });
                  },
                  icon: Icon(_showPasswordFields ? Icons.arrow_drop_up : Icons.arrow_drop_down, color: Colors.deepPurpleAccent),
                  label: Text(_showPasswordFields ? '隐藏密码修改' : '修改账户密码', style: const TextStyle(color: Colors.deepPurpleAccent)),
                ),
              ),
              const SizedBox(height: 8),

              // Password fields
              if (_showPasswordFields) ...[
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: Colors.grey.withOpacity(0.1)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text('旧密码', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _oldPasswordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          hintText: '请输入旧密码',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text('新密码', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _newPasswordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          hintText: '请输入新密码（至少8位）',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                      const SizedBox(height: 14),
                      const Text('确认新密码', style: TextStyle(color: Colors.grey, fontSize: 12)),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _confirmPasswordController,
                        obscureText: true,
                        decoration: InputDecoration(
                          hintText: '请再次输入新密码',
                          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),
              ],

              // Native Language
              const Text('母语', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _nativeLang,
                items: _nativeLanguages.map((lang) {
                  return DropdownMenuItem<String>(
                    value: lang['value'],
                    child: Text(lang['label']!),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _nativeLang = val);
                },
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),

              // Target Language
              const Text('学习语言', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _targetLang,
                items: const [
                  DropdownMenuItem(value: 'en', child: Text('英语')),
                  DropdownMenuItem(value: 'ja', child: Text('日语')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _targetLang = val);
                },
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),

              // Target Level
              const Text('学习等级', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              DropdownButtonFormField<String>(
                value: _targetLevel,
                items: const [
                  DropdownMenuItem(value: 'beginner', child: Text('初级')),
                  DropdownMenuItem(value: 'intermediate', child: Text('中级')),
                  DropdownMenuItem(value: 'advanced', child: Text('高级')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _targetLevel = val);
                },
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),

              // Default Fill Blank Level
              const Text('默认填空等级', style: TextStyle(color: Colors.grey, fontSize: 13, fontWeight: FontWeight.bold)),
              const SizedBox(height: 8),
              DropdownButtonFormField<int>(
                value: _fillBlankLevel,
                items: const [
                  DropdownMenuItem(value: 1, child: Text('L1 (容易 - 挖空少)')),
                  DropdownMenuItem(value: 2, child: Text('L2 (中等)')),
                  DropdownMenuItem(value: 3, child: Text('L3 (较难)')),
                  DropdownMenuItem(value: 4, child: Text('L4 (极难 - 全文挖空)')),
                ],
                onChanged: (val) {
                  if (val != null) setState(() => _fillBlankLevel = val);
                },
                decoration: InputDecoration(
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 36),

              // Save Button
              ElevatedButton(
                onPressed: _saving ? null : _save,
                style: ElevatedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  backgroundColor: Colors.deepPurple,
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: _saving
                    ? const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                      )
                    : const Text('保存设定', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
