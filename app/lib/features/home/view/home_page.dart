import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/cubit/auth_state.dart';
import '../../auth/models/auth_model.dart';
import '../../study/cubit/study_cubit.dart';
import '../../study/cubit/study_state.dart';
import '../../../shared/utils/constants.dart';
import 'widgets/topic_select_dialog.dart';
import 'widgets/language_select_dialog.dart';

class HomePage extends StatelessWidget {
  const HomePage({super.key});

  void _handleStartLearning(BuildContext context) async {
    final studyCubit = context.read<StudyCubit>();
    final authCubit = context.read<AuthCubit>();
    final authState = authCubit.state;
    if (authState is! AuthAuthenticated) return;

    if (authState.profile == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('请先在个人设定中配置学习语言与等级')),
      );
      return;
    }

    final hasActive = await studyCubit.handleStartLearning();
    if (hasActive) {
      final lineIdx = studyCubit.state.previewLineIndex;
      if (lineIdx > 0) {
        context.push('/fill-blank');
      } else {
        context.push('/preview');
      }
      return;
    }

    _showTopicSelector(context, authState.profile!);
  }

  void _showTopicSelector(BuildContext context, UserLearningProfile profile) {
    final studyCubit = context.read<StudyCubit>();
    showDialog(
      context: context,
      builder: (ctx) => TopicSelectDialog(
        types: studyCubit.state.dialogueTypes,
        onSelect: (type) {
          studyCubit.selectTopic(type.name);
          final targets = profile.targetLanguages;
          if (targets.isEmpty) {
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('请先在个人设定中配置学习语言与等级')),
            );
          } else if (targets.length == 1) {
            studyCubit.selectLanguage(targets[0]);
            _beginGenerate(context, type.name, targets[0], profile.nativeLanguage);
          } else {
            _showLanguageSelector(context, targets, type.name, profile.nativeLanguage);
          }
        },
      ),
    );
  }

  void _showLanguageSelector(BuildContext context, List<TargetLanguage> targets, String topic, String nativeLanguage) {
    final studyCubit = context.read<StudyCubit>();
    showDialog(
      context: context,
      builder: (ctx) => LanguageSelectDialog(
        languages: targets,
        onSelect: (lang) {
          studyCubit.selectLanguage(lang);
          _beginGenerate(context, topic, lang, nativeLanguage);
        },
      ),
    );
  }

  void _beginGenerate(BuildContext context, String topic, TargetLanguage lang, String nativeLanguage) {
    final studyCubit = context.read<StudyCubit>();
    studyCubit.beginGenerate(
      topic: topic,
      lang: lang,
      nativeLanguage: nativeLanguage,
      onRouteReady: (route) {
        context.push(route);
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final authCubit = context.watch<AuthCubit>();
    final authState = authCubit.state;

    final studyCubit = context.watch<StudyCubit>();
    final studyState = studyCubit.state;

    // Direct user profile access
    final profile = authState is AuthAuthenticated ? authState.profile : null;
    final nickname = profile?.nickname ?? (authState is AuthAuthenticated ? authState.user.username : '');
    final activeTargetLang = (profile?.targetLanguages != null && profile!.targetLanguages.isNotEmpty)
        ? profile.targetLanguages[0]
        : null;

    return Scaffold(
      body: Stack(
        children: [
          // Background glows
          Positioned(
            left: -150,
            top: -150,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.blue.withOpacity(0.04),
              ),
            ),
          ),
          Positioned(
            right: -150,
            bottom: -150,
            child: Container(
              width: 400,
              height: 400,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.purple.withOpacity(0.04),
              ),
            ),
          ),

          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Header Row
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '你好, $nickname 👋',
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            '今天想学点什么？',
                            style: TextStyle(color: Colors.grey, fontSize: 13),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          IconButton(
                            icon: const Icon(Icons.settings_outlined, color: Colors.grey),
                            onPressed: () => context.push('/profile'),
                          ),
                          IconButton(
                            icon: const Icon(Icons.logout, color: Colors.redAccent),
                            onPressed: () => authCubit.logout(),
                          ),
                        ],
                      ),
                    ],
                  ),
                  const SizedBox(height: 32),

                  // Title banner
                  const Center(
                    child: Column(
                      children: [
                        Text(
                          'AI 对话语言学习',
                          style: TextStyle(
                            fontSize: 32,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        SizedBox(height: 8),
                        Text(
                          '通过 AI 生成的真实对话练习，掌握地道表达',
                          style: TextStyle(color: Colors.grey, fontSize: 14),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 32),

                  // Exercise result alert
                  if (studyState.exerciseResultWrongCount != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.green.withOpacity(0.25)),
                      ),
                      child: Text(
                        studyState.exerciseResultWrongCount == 0
                            ? '🎉 全部正确！'
                            : '📝 本次错误 ${studyState.exerciseResultWrongCount} 句，已加入复习队列',
                        style: const TextStyle(color: Colors.greenAccent, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Generating error alert
                  if (studyState.generatingError != null) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: Colors.red.withOpacity(0.08),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.red.withOpacity(0.25)),
                      ),
                      child: Text(
                        '⚠️ 生成失败：${studyState.generatingError}',
                        style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Actions cards list
                  _buildActionCard(
                    id: 'btn-start-learning',
                    emoji: '🎓',
                    title: '今日学习',
                    desc: 'AI 生成新对话，开始填空练习',
                    colors: [const Color(0xFF0F172A), const Color(0xFF1E1B4B)],
                    glowColor: Colors.blue.withOpacity(0.15),
                    onTap: () => _handleStartLearning(context),
                  ),
                  const SizedBox(height: 16),

                  _buildActionCard(
                    id: 'btn-start-review',
                    emoji: '🔄',
                    title: '今日复习',
                    desc: '复习已学错题，巩固记忆',
                    colors: [const Color(0xFF022C22), const Color(0xFF0F172A)],
                    glowColor: const Color(0xFF10B981).withOpacity(0.1),
                    onTap: () => context.push('/review'),
                  ),
                  const SizedBox(height: 16),

                  _buildActionCard(
                    id: 'btn-start-grammar',
                    emoji: '📖',
                    title: '文章语法分析',
                    desc: '分析英语段落，学习语法并进行完形填空测试',
                    colors: [const Color(0xFF4A044E), const Color(0xFF0F172A)],
                    glowColor: Colors.purple.withOpacity(0.1),
                    onTap: () => context.push('/grammar'),
                  ),
                  const SizedBox(height: 16),

                  _buildActionCard(
                    id: 'btn-start-history',
                    emoji: '📚',
                    title: '浏览学习历史',
                    desc: '浏览并回顾已经学过的对话',
                    colors: [const Color(0xFF1E1B4B), const Color(0xFF0F172A)],
                    glowColor: const Color(0xFF8B5CF6).withOpacity(0.08),
                    onTap: () => context.push('/history'),
                  ),
                  const SizedBox(height: 32),

                  // Current setting footer
                  if (activeTargetLang != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
                      decoration: BoxDecoration(
                        border: Border.all(color: Colors.grey.withOpacity(0.1)),
                        borderRadius: BorderRadius.circular(16),
                        color: const Color(0xFF0F172A).withOpacity(0.3),
                      ),
                      child: Text(
                        '当前配置：母语 ${profile?.nativeLanguage == 'zh' ? '中文' : profile?.nativeLanguage.toUpperCase()} | 目标语言 ${languageLabels[activeTargetLang.lang] ?? activeTargetLang.lang} (${levelLabels[activeTargetLang.level]})',
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // Generating loader screen
          if (studyState.generating)
            Positioned.fill(
              child: Container(
                color: Colors.black.withOpacity(0.85),
                child: const Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    CircularProgressIndicator(color: Colors.deepPurpleAccent),
                    SizedBox(height: 24),
                    Text(
                      'AI 正在生成对话...',
                      style: TextStyle(color: Color(0xFFC084FC), fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                    SizedBox(height: 8),
                    Text(
                      '同时生成语音，请稍候（约 30-60 秒）',
                      style: TextStyle(color: Colors.grey, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildActionCard({
    required String id,
    required String emoji,
    required String title,
    required String desc,
    required List<Color> colors,
    required Color glowColor,
    required VoidCallback onTap,
  }) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(color: glowColor, blurRadius: 16, offset: const Offset(0, 4)),
        ],
        gradient: LinearGradient(
          colors: colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        border: Border.all(color: Colors.grey.withOpacity(0.12)),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(20),
          child: Padding(
            padding: const EdgeInsets.all(20.0),
            child: Row(
              children: [
                Text(emoji, style: const TextStyle(fontSize: 40)),
                const SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        desc,
                        style: const TextStyle(color: Colors.grey, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
