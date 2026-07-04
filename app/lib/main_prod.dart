import 'package:flutter/material.dart';
import 'core/config/app_config.dart';
import 'core/di/service_locator.dart';
import 'app/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  const String productionBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://127.0.0.1:8080',
  );

  AppConfig.init(
    envName: 'production',
    baseUrl: productionBaseUrl,
  );

  await setupServiceLocator();

  runApp(const App());
}
