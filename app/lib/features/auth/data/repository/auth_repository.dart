import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../datasource/auth_datasource.dart';
import '../../models/auth_model.dart';

class AuthRepository {
  final AuthDatasource _datasource;
  final SharedPreferences _prefs;

  AuthRepository(this._datasource, this._prefs);

  Future<Map<String, dynamic>> fetchCaptcha() async {
    return _datasource.fetchCaptcha();
  }

  Future<AuthUser> login({
    required String username,
    required String password,
    required String captchaId,
    required String captchaCode,
  }) async {
    final res = await _datasource.login(
      username: username,
      password: password,
      captchaId: captchaId,
      captchaCode: captchaCode,
    );

    final token = res['token'] as String? ?? '';
    final refreshToken = res['refresh_token'] as String? ?? '';
    final userJson = res['user'] as Map<String, dynamic>?;

    if (token.isEmpty || refreshToken.isEmpty || userJson == null) {
      throw Exception('获取登录数据失败：未收到有效的身份令牌或用户信息');
    }

    await _prefs.setString('auth_token', token);
    await _prefs.setString('auth_refresh_token', refreshToken);
    final user = AuthUser.fromJson(userJson);
    await _prefs.setString('auth_user', jsonEncode(user.toJson()));

    return user;
  }

  Future<void> register({
    required String username,
    required String password,
    required String captchaId,
    required String captchaCode,
  }) async {
    await _datasource.register(
      username: username,
      password: password,
      captchaId: captchaId,
      captchaCode: captchaCode,
    );
  }

  Future<void> logout() async {
    await _prefs.remove('auth_token');
    await _prefs.remove('auth_refresh_token');
    await _prefs.remove('auth_user');
    await _prefs.remove('auth_profile');
  }

  Future<AuthUser?> getCachedUser() async {
    final raw = _prefs.getString('auth_user');
    if (raw == null) return null;
    try {
      return AuthUser.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<AuthUser> getProfile() async {
    final user = await _datasource.getProfile();
    await _prefs.setString('auth_user', jsonEncode(user.toJson()));
    return user;
  }

  Future<UserLearningProfile> getLearningProfile() async {
    final profile = await _datasource.getLearningProfile();
    await _prefs.setString('auth_profile', jsonEncode(profile.toJson()));
    return profile;
  }

  Future<UserLearningProfile?> getCachedLearningProfile() async {
    final raw = _prefs.getString('auth_profile');
    if (raw == null) return null;
    try {
      return UserLearningProfile.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  Future<UserLearningProfile> upsertLearningProfile(UserLearningProfile profile) async {
    final updated = await _datasource.upsertLearningProfile(profile);
    await _prefs.setString('auth_profile', jsonEncode(updated.toJson()));
    return updated;
  }

  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    await _datasource.changePassword(oldPassword: oldPassword, newPassword: newPassword);
  }
}
