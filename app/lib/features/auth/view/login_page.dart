import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/di/service_locator.dart';
import '../cubit/auth_cubit.dart';
import '../cubit/auth_state.dart';
import '../data/repository/auth_repository.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _captchaController = TextEditingController();

  bool _isLogin = true;
  String _captchaId = '';
  String _captchaImgBase64 = '';
  bool _loadingCaptcha = false;
  String? _localError;
  String? _successMessage;

  @override
  void initState() {
    super.initState();
    _fetchCaptcha();
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _captchaController.dispose();
    super.dispose();
  }

  Future<void> _fetchCaptcha() async {
    setState(() {
      _loadingCaptcha = true;
      _localError = null;
    });
    try {
      final repo = getIt<AuthRepository>();
      final res = await repo.fetchCaptcha();
      setState(() {
        _captchaId = res['captcha_id'] as String? ?? '';
        _captchaImgBase64 = res['captcha_image'] as String? ?? '';
      });
    } catch (e) {
      setState(() {
        _localError = '获取验证码失败: ${e.toString().replaceAll('Exception: ', '')}';
      });
    } finally {
      setState(() {
        _loadingCaptcha = false;
      });
    }
  }

  void _submit() async {
    setState(() {
      _localError = null;
      _successMessage = null;
    });

    final username = _usernameController.text.trim();
    final password = _passwordController.text;
    final confirmPassword = _confirmPasswordController.text;
    final captchaCode = _captchaController.text.trim();

    if (username.isEmpty || password.isEmpty || captchaCode.isEmpty) {
      setState(() {
        _localError = '请填写所有必填字段';
      });
      return;
    }

    if (password.length < 8) {
      setState(() {
        _localError = '密码长度不能少于 8 位';
      });
      return;
    }

    if (!_isLogin && password != confirmPassword) {
      setState(() {
        _localError = '两次输入的密码不一致';
      });
      return;
    }

    final cubit = context.read<AuthCubit>();
    if (_isLogin) {
      await cubit.login(
        username: username,
        password: password,
        captchaId: _captchaId,
        captchaCode: captchaCode,
      );
      if (cubit.state is AuthError) {
        _fetchCaptcha(); // Refresh captcha on failure
      }
    } else {
      try {
        final repo = getIt<AuthRepository>();
        await repo.register(
          username: username,
          password: password,
          captchaId: _captchaId,
          captchaCode: captchaCode,
        );
        setState(() {
          _successMessage = '注册成功！您的账号正在审核中，请联系管理员审核后登录。';
          _isLogin = true;
          _passwordController.clear();
          _confirmPasswordController.clear();
          _captchaController.clear();
        });
        _fetchCaptcha();
      } catch (e) {
        _fetchCaptcha();
        setState(() {
          _localError = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  Widget _buildCaptchaImage() {
    if (_loadingCaptcha) {
      return const SizedBox(
        width: 100,
        height: 40,
        child: Center(
          child: SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(strokeWidth: 2),
          ),
        ),
      );
    }

    if (_captchaImgBase64.isEmpty) {
      return GestureDetector(
        onTap: _fetchCaptcha,
        child: Container(
          width: 100,
          height: 40,
          color: Colors.grey[900],
          child: const Center(
            child: Text('点击重试', style: TextStyle(fontSize: 12, color: Colors.grey)),
          ),
        ),
      );
    }

    try {
      String cleanBase64 = _captchaImgBase64;
      if (cleanBase64.startsWith('data:image/png;base64,')) {
        cleanBase64 = cleanBase64.substring('data:image/png;base64,'.length);
      }
      final bytes = base64Decode(cleanBase64);
      return GestureDetector(
        onTap: _fetchCaptcha,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(8),
          child: Image.memory(
            bytes,
            width: 100,
            height: 40,
            fit: BoxFit.fill,
          ),
        ),
      );
    } catch (_) {
      return GestureDetector(
        onTap: _fetchCaptcha,
        child: Container(
          width: 100,
          height: 40,
          color: Colors.red[950],
          child: const Center(
            child: Text('解析失败', style: TextStyle(fontSize: 12, color: Colors.red)),
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      body: Stack(
        children: [
          // Background glow
          Positioned(
            left: -100,
            top: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.blue.withOpacity(0.08),
              ),
            ),
          ),
          Positioned(
            right: -100,
            bottom: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.purple.withOpacity(0.08),
              ),
            ),
          ),
          // Form center card
          Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24.0),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 400),
                child: BlocConsumer<AuthCubit, AuthState>(
                  listener: (context, state) {
                    if (state is AuthAuthenticated) {
                      context.go('/');
                    } else if (state is AuthError) {
                      setState(() {
                        _localError = state.message;
                      });
                    }
                  },
                  builder: (context, state) {
                    final cubitLoading = state is AuthLoading;

                    return Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Title
                        ShaderMask(
                          shaderCallback: (bounds) => const LinearGradient(
                            colors: [Color(0xFF60A5FA), Color(0xFFA78BFA), Color(0xFFF472B6)],
                          ).createShader(bounds),
                          child: const Text(
                            'LangStudy',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 36,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        const Text(
                          'AI 对话语言学习，掌握地道表达',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.grey, fontSize: 14),
                        ),
                        const SizedBox(height: 32),

                        // Login / Register Tabs
                        Container(
                          padding: const EdgeInsets.all(4),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _isLogin = true;
                                      _localError = null;
                                      _successMessage = null;
                                    });
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                    decoration: BoxDecoration(
                                      color: _isLogin ? const Color(0xFF0F172A) : Colors.transparent,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '登录',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: _isLogin ? Colors.white : Colors.grey,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              Expanded(
                                child: GestureDetector(
                                  onTap: () {
                                    setState(() {
                                      _isLogin = false;
                                      _localError = null;
                                      _successMessage = null;
                                    });
                                  },
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                    decoration: BoxDecoration(
                                      color: !_isLogin ? const Color(0xFF0F172A) : Colors.transparent,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '注册',
                                      textAlign: TextAlign.center,
                                      style: TextStyle(
                                        color: !_isLogin ? Colors.white : Colors.grey,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 24),

                        // Notifications
                        if (_localError != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.red.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.red.withOpacity(0.3)),
                            ),
                            child: Text(
                              _localError!,
                              style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        if (_successMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.green.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: Colors.green.withOpacity(0.3)),
                            ),
                            child: Text(
                              _successMessage!,
                              style: const TextStyle(color: Colors.greenAccent, fontSize: 13),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Username Input
                        TextField(
                          controller: _usernameController,
                          decoration: InputDecoration(
                            labelText: '用户名',
                            prefixIcon: const Icon(Icons.person_outline),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Password Input
                        TextField(
                          controller: _passwordController,
                          obscureText: true,
                          decoration: InputDecoration(
                            labelText: '密码',
                            prefixIcon: const Icon(Icons.lock_outline),
                            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                        const SizedBox(height: 16),

                        // Confirm Password (Register only)
                        if (!_isLogin) ...[
                          TextField(
                            controller: _confirmPasswordController,
                            obscureText: true,
                            decoration: InputDecoration(
                              labelText: '确认密码',
                              prefixIcon: const Icon(Icons.lock_outline),
                              border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                          const SizedBox(height: 16),
                        ],

                        // Captcha Code
                        Row(
                          children: [
                            Expanded(
                              child: TextField(
                                controller: _captchaController,
                                decoration: InputDecoration(
                                  labelText: '验证码',
                                  prefixIcon: const Icon(Icons.security),
                                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 12),
                            _buildCaptchaImage(),
                          ],
                        ),
                        const SizedBox(height: 32),

                        // Submit Button
                        ElevatedButton(
                          onPressed: cubitLoading ? null : _submit,
                          style: ElevatedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            backgroundColor: Colors.deepPurple,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: cubitLoading
                              ? const SizedBox(
                                  width: 20,
                                  height: 20,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    valueColor: AlwaysStoppedAnimation(Colors.white),
                                  ),
                                )
                              : Text(_isLogin ? '立即登录' : '提交注册', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ),
                      ],
                    );
                  },
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
