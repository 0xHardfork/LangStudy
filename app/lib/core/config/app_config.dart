class AppConfig {
  final String envName;
  final String baseUrl;

  AppConfig({
    required this.envName,
    required this.baseUrl,
  });

  static late final AppConfig instance;

  static void init({required String envName, required String baseUrl}) {
    instance = AppConfig(envName: envName, baseUrl: baseUrl);
  }
}
