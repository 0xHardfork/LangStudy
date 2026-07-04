lib/
├── app/
│   ├── router/
│   └── app.dart
│
├── core/
│   ├── di/
│   ├── network/
│   └── theme/
│
├── features/
│   ├── auth/
│   │   ├── cubit/
│   │   │   ├── auth_cubit.dart
│   │   │   └── profile_cubit.dart
│   │   │
│   │   ├── view/
│   │   │   ├── login_page.dart        
│   │   │   └── profile_page.dart       
│   │   │
│   │   ├── widgets/
│   │   ├── models/
│   │   └── data/
│   │       ├── repository/
│   │       └── datasource/
│   │
│   ├── check_in/
│   │   ├── cubit/
│   │   ├── view/
│   │   │   └── check_in_page.dart     
│   │   ├── widgets/
│   │   ├── models/
│   │   └── data/
│   │       ├── repository/
│   │       └── datasource/
│   │
│   └── leaderboard/
│       ├── cubit/
│       ├── view/
│       │   └── leaderboard_page.dart  
│       ├── widgets/
│       ├── models/         
│       └── data/
│           ├── repository/
│           └── datasource/
│
├── shared/
│   ├── layout/
│   ├── widgets/
│   └── utils/
│
├── l10n/
│   ├── app_en.arb
│   ├── app_zh.arb
│   └── app_ja.arb
│
└── main.dart