import 'package:flutter_bloc/flutter_bloc.dart';
import '../data/repository/auth_repository.dart';
import '../models/auth_model.dart';
import 'auth_state.dart';

class AuthCubit extends Cubit<AuthState> {
  final AuthRepository _repository;

  AuthCubit(this._repository) : super(AuthInitial());

  Future<void> checkAuth() async {
    final user = await _repository.getCachedUser();
    final profile = await _repository.getCachedLearningProfile();

    if (user != null) {
      emit(AuthAuthenticated(user: user, profile: profile));
      // Refresh in background
      try {
        final freshUser = await _repository.getProfile();
        final freshProfile = await _repository.getLearningProfile();
        emit(AuthAuthenticated(user: freshUser, profile: freshProfile));
      } catch (_) {
        // Keep cached if network fails
      }
    } else {
      emit(AuthUnauthenticated());
    }
  }

  Future<void> login({
    required String username,
    required String password,
    required String captchaId,
    required String captchaCode,
  }) async {
    emit(AuthLoading());
    try {
      final user = await _repository.login(
        username: username,
        password: password,
        captchaId: captchaId,
        captchaCode: captchaCode,
      );
      UserLearningProfile? profile;
      try {
        profile = await _repository.getLearningProfile();
      } catch (_) {
        // Safe to ignore if profile is not setup yet
      }
      emit(AuthAuthenticated(user: user, profile: profile));
    } catch (e) {
      emit(AuthError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> register({
    required String username,
    required String password,
    required String captchaId,
    required String captchaCode,
  }) async {
    emit(AuthLoading());
    try {
      await _repository.register(
        username: username,
        password: password,
        captchaId: captchaId,
        captchaCode: captchaCode,
      );
      emit(AuthUnauthenticated()); // Go back to login
    } catch (e) {
      emit(AuthError(e.toString().replaceAll('Exception: ', '')));
    }
  }

  Future<void> logout() async {
    emit(AuthLoading());
    await _repository.logout();
    emit(AuthUnauthenticated());
  }

  Future<void> updateLearningProfile(UserLearningProfile profile) async {
    final currentState = state;
    if (currentState is AuthAuthenticated) {
      emit(AuthLoading());
      try {
        final updated = await _repository.upsertLearningProfile(profile);
        emit(AuthAuthenticated(user: currentState.user, profile: updated));
      } catch (e) {
        emit(AuthError(e.toString().replaceAll('Exception: ', '')));
        emit(AuthAuthenticated(user: currentState.user, profile: currentState.profile));
      }
    }
  }

  Future<void> refreshProfile() async {
    final currentState = state;
    if (currentState is AuthAuthenticated) {
      try {
        final freshProfile = await _repository.getLearningProfile();
        emit(AuthAuthenticated(user: currentState.user, profile: freshProfile));
      } catch (_) {}
    }
  }
}
