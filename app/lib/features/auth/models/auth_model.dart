class AuthUser {
  final int id;
  final String username;
  final String role;
  final String createdAt;

  AuthUser({
    required this.id,
    required this.username,
    required this.role,
    required this.createdAt,
  });

  factory AuthUser.fromJson(Map<String, dynamic> json) {
    return AuthUser(
      id: json['id'] as int,
      username: json['username'] as String,
      role: json['role'] as String,
      createdAt: json['created_at'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
      'created_at': createdAt,
    };
  }
}

class TargetLanguage {
  final String lang;
  final String level;

  TargetLanguage({
    required this.lang,
    required this.level,
  });

  factory TargetLanguage.fromJson(Map<String, dynamic> json) {
    return TargetLanguage(
      lang: json['lang'] as String,
      level: json['level'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'lang': lang,
      'level': level,
    };
  }
}

class UserLearningProfile {
  final int? id;
  final int? userId;
  final String nickname;
  final String nativeLanguage;
  final List<TargetLanguage> targetLanguages;
  final int fillBlankLevel;

  UserLearningProfile({
    this.id,
    this.userId,
    required this.nickname,
    required this.nativeLanguage,
    required this.targetLanguages,
    required this.fillBlankLevel,
  });

  factory UserLearningProfile.fromJson(Map<String, dynamic> json) {
    var list = json['target_languages'] as List? ?? [];
    List<TargetLanguage> targets = list.map((i) => TargetLanguage.fromJson(i as Map<String, dynamic>)).toList();

    return UserLearningProfile(
      id: json['id'] as int?,
      userId: json['user_id'] as int?,
      nickname: json['nickname'] as String? ?? '',
      nativeLanguage: json['native_language'] as String? ?? 'zh',
      targetLanguages: targets,
      fillBlankLevel: json['fill_blank_level'] as int? ?? 1,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      if (id != null) 'id': id,
      if (userId != null) 'user_id': userId,
      'nickname': nickname,
      'native_language': nativeLanguage,
      'target_languages': targetLanguages.map((t) => t.toJson()).toList(),
      'fill_blank_level': fillBlankLevel,
    };
  }
}
