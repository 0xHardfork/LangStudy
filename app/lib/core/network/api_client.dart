import 'dart:async';
import 'package:dio/dio.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../config/app_config.dart';
import '../di/service_locator.dart';
import '../../features/auth/cubit/auth_cubit.dart';

class ApiClient {
  late final Dio _dio;
  final SharedPreferences _prefs;
  bool _isRefreshing = false;
  final List<Completer<void>> _refreshQueue = [];

  ApiClient(this._prefs) {
    _dio = Dio(
      BaseOptions(
        baseUrl: '${AppConfig.instance.baseUrl}/api/v1',
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(minutes: 5),
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Type': 'app',
        },
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _prefs.getString('auth_token');
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onResponse: (response, handler) async {
          final cookies = response.headers['set-cookie'];
          if (cookies != null && cookies.isNotEmpty) {
            for (final cookie in cookies) {
              if (cookie.startsWith('token=')) {
                final parts = cookie.split(';');
                final tokenPair = parts[0];
                final token = tokenPair.substring(6);
                if (token.isNotEmpty) {
                  await _prefs.setString('auth_token', token);
                }
                break;
              }
            }
          }
          return handler.next(response);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401) {
            final path = e.requestOptions.path;
            if (path != '/login' && path != '/register' && path != '/refresh') {
              if (_isRefreshing) {
                // If a token refresh is already in progress, wait for it to complete
                final completer = Completer<void>();
                _refreshQueue.add(completer);
                try {
                  await completer.future;
                  // Retry the original request with the new access token
                  final token = _prefs.getString('auth_token') ?? '';
                  final options = e.requestOptions;
                  options.headers['Authorization'] = 'Bearer $token';
                  final cloneReq = await _dio.fetch(options);
                  return handler.resolve(cloneReq);
                } catch (err) {
                  // Forward the error if the refresh failed
                  return handler.next(err is DioException ? err : e);
                }
              }

              final refreshToken = _prefs.getString('auth_refresh_token') ?? '';
              if (refreshToken.isNotEmpty) {
                _isRefreshing = true;
                try {
                  // Spin up a separate Dio instance for refreshing to avoid recursive interceptor loops
                  final refreshDio = Dio(
                    BaseOptions(
                      baseUrl: '${AppConfig.instance.baseUrl}/api/v1',
                      headers: {
                        'Content-Type': 'application/json',
                        'X-Client-Type': 'app',
                      },
                    ),
                  );

                  final res = await refreshDio.post('/refresh', data: {
                    'refresh_token': refreshToken,
                  });

                  if (res.statusCode == 200 && res.data != null) {
                    final data = res.data['data'] as Map<String, dynamic>?;
                    if (data != null) {
                      final newToken = data['token'] as String? ?? '';
                      final newRefreshToken = data['refresh_token'] as String? ?? '';

                      if (newToken.isNotEmpty && newRefreshToken.isNotEmpty) {
                        await _prefs.setString('auth_token', newToken);
                        await _prefs.setString('auth_refresh_token', newRefreshToken);

                        _isRefreshing = false;

                        // Resolve all waiting requests in the queue
                        for (final completer in _refreshQueue) {
                          completer.complete();
                        }
                        _refreshQueue.clear();

                        // Retry original failed request with the new access token
                        final options = e.requestOptions;
                        options.headers['Authorization'] = 'Bearer $newToken';

                        final cloneReq = await _dio.fetch(options);
                        return handler.resolve(cloneReq);
                      }
                    }
                  }
                  throw Exception('Refresh response parsing failed');
                } catch (err) {
                  _isRefreshing = false;

                  // Determine if the error is due to an invalid/expired refresh token
                  bool isTokenInvalid = false;
                  if (err is DioException) {
                    final statusCode = err.response?.statusCode;
                    if (statusCode == 400 || statusCode == 401) {
                      isTokenInvalid = true;
                    }
                  } else {
                    // For other non-network logic failures
                    isTokenInvalid = true;
                  }

                  if (isTokenInvalid) {
                    // Refresh token is expired or invalid, reject all waiting requests
                    for (final completer in _refreshQueue) {
                      completer.completeError(err);
                    }
                    _refreshQueue.clear();

                    // Force logout
                    await getIt<AuthCubit>().logout();
                  } else {
                    // It's a temporary network issue or server 5xx error.
                    // DO NOT log out. Complete the waiting requests with error so they propagate properly
                    for (final completer in _refreshQueue) {
                      completer.completeError(err);
                    }
                    _refreshQueue.clear();
                  }
                }
              } else {
                // No refresh token available, force logout
                await getIt<AuthCubit>().logout();
              }
            }
          }
          return handler.next(e);
        },
      ),
    );
  }

  Dio get dio => _dio;

  // Custom HTTP methods handling backend's {code, msg, data} structure
  Future<T> get<T>(String path, {Map<String, dynamic>? queryParameters}) async {
    try {
      final response = await _dio.get(path, queryParameters: queryParameters);
      return _handleResponse<T>(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> post<T>(String path, {dynamic data}) async {
    try {
      final response = await _dio.post(path, data: data);
      return _handleResponse<T>(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> put<T>(String path, {dynamic data}) async {
    try {
      final response = await _dio.put(path, data: data);
      return _handleResponse<T>(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  Future<T> delete<T>(String path, {dynamic data}) async {
    try {
      final response = await _dio.delete(path, data: data);
      return _handleResponse<T>(response);
    } on DioException catch (e) {
      throw _handleError(e);
    }
  }

  T _handleResponse<T>(Response response) {
    final body = response.data;
    if (body is! Map) {
      throw Exception('返回数据格式错误');
    }
    final code = body['code'];
    final msg = body['msg'];
    final data = body['data'];

    if (code != 0) {
      throw Exception(msg ?? '服务器错误 (code: $code)');
    }

    return data as T;
  }

  Exception _handleError(DioException e) {
    if (e.response != null && e.response?.data is Map) {
      final msg = e.response?.data['msg'];
      if (msg != null) {
        return Exception(msg);
      }
    }
    return Exception(e.message ?? '网络连接失败，请检查网络');
  }
}
