import '../../../../core/network/api_client.dart';
import '../../models/auth_model.dart';

class AuthDatasource {
  final ApiClient _client;

  AuthDatasource(this._client);

  Future<Map<String, dynamic>> fetchCaptcha() async {
    return _client.get<Map<String, dynamic>>('/captcha');
  }

  Future<Map<String, dynamic>> login({
    required String username,
    required String password,
    required String captchaId,
    required String captchaCode,
  }) async {
    return _client.post<Map<String, dynamic>>('/login', data: {
      'username': username,
      'password': password,
      'captcha_id': captchaId,
      'captcha_code': captchaCode,
    });
  }

  Future<void> register({
    required String username,
    required String password,
    required String captchaId,
    required String captchaCode,
  }) async {
    await _client.post('/register', data: {
      'username': username,
      'password': password,
      'captcha_id': captchaId,
      'captcha_code': captchaCode,
    });
  }

  Future<AuthUser> getProfile() async {
    final data = await _client.get<Map<String, dynamic>>('/profile');
    return AuthUser.fromJson(data);
  }

  Future<UserLearningProfile> getLearningProfile() async {
    final data = await _client.get<Map<String, dynamic>>('/me/profile');
    return UserLearningProfile.fromJson(data);
  }

  Future<UserLearningProfile> upsertLearningProfile(UserLearningProfile profile) async {
    final data = await _client.put<Map<String, dynamic>>('/me/profile', data: profile.toJson());
    return UserLearningProfile.fromJson(data);
  }

  Future<void> changePassword({
    required String oldPassword,
    required String newPassword,
  }) async {
    await _client.put('/me/password', data: {
      'old_password': oldPassword,
      'new_password': newPassword,
    });
  }
}
