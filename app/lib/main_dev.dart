import 'package:flutter/material.dart';
import 'core/config/app_config.dart';
import 'core/di/service_locator.dart';
import 'app/app.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  AppConfig.init(
    envName: 'development',
    baseUrl: 'http://localhost:8080', // Configure for iOS simulator. Use 'http://10.0.2.2:8080' for Android emulator.
  );

  await setupServiceLocator();

  runApp(const App());
}
