import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/cubit/auth_state.dart';
import '../../study/cubit/study_cubit.dart';
import '../../study/cubit/study_state.dart';
import '../../../shared/widgets/audio_player_control.dart';
import '../../../shared/utils/constants.dart';

class DialoguePreviewPage extends StatefulWidget {
  const DialoguePreviewPage({super.key});

  @override
  State<DialoguePreviewPage> createState() => _DialoguePreviewPageState();
}

class _DialoguePreviewPageState extends State<DialoguePreviewPage> {
  final _hintController = TextEditingController();

  @override
  void dispose() {
    _hintController.dispose();
    super.dispose();
  }

  void _showRegenerateDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        title: const Text('重新生成对话', style: TextStyle(color: Colors.white)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              '您可以提供额外的提示词（Hint）来调整生成方向：',
              style: TextStyle(color: Colors.grey, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: _hintController,
              decoration: InputDecoration(
                hintText: '例如：谈论具体的价格、修改角色、更简单一些...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('取消', style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              final authState = context.read<AuthCubit>().state;
              if (authState is AuthAuthenticated && authState.profile != null) {
                final studyCubit = context.read<StudyCubit>();
                studyCubit.regenerateDialogue(
                  prevDialogueId: studyCubit.state.currentDialogue!.id,
                  hint: _hintController.text.trim(),
                  nativeLanguage: authState.profile!.nativeLanguage,
                );
                _hintController.clear();
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurple),
            child: const Text('生成', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final studyCubit = context.watch<StudyCubit>();
    final studyState = studyCubit.state;
    final dialogue = studyState.currentDialogue;

    if (dialogue == null) {
      return const Scaffold(
        body: Center(child: Text('无可用对话', style: TextStyle(color: Colors.grey))),
      );
    }

    final langLabel = languageLabels[dialogue.language] ?? dialogue.language.toUpperCase();
    final levelLabel = levelLabels[dialogue.level] ?? dialogue.level;

    return Scaffold(
      appBar: AppBar(
        title: Text('${dialogue.topic} ($langLabel · $levelLabel)', style: const TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            studyCubit.resetDialogue();
            context.go('/');
          },
        ),
      ),
      body: Stack(
        children: [
          Column(
            children: [
              // Chat List
              Expanded(
                child: ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
                  itemCount: dialogue.lines.length,
                  itemBuilder: (context, index) {
                    final line = dialogue.lines[index];
                    final isSpeakerA = line.speaker == 'A';

                    return Padding(
                      padding: const EdgeInsets.only(bottom: 20.0),
                      child: Row(
                        mainAxisAlignment: isSpeakerA ? MainAxisAlignment.start : MainAxisAlignment.end,
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          if (isSpeakerA) ...[
                            _buildAvatar(isSpeakerA),
                            const SizedBox(width: 10),
                          ],
                          Flexible(
                            child: Container(
                              padding: const EdgeInsets.all(16),
                              decoration: BoxDecoration(
                                color: isSpeakerA
                                    ? const Color(0xFF1E3A8A).withOpacity(0.2) // Blue tint for Speaker A
                                    : const Color(0xFF581C87).withOpacity(0.2), // Purple tint for Speaker B
                                border: Border.all(
                                  color: isSpeakerA
                                      ? Colors.blue.withOpacity(0.2)
                                      : Colors.purple.withOpacity(0.2),
                                ),
                                borderRadius: BorderRadius.only(
                                  topLeft: const Radius.circular(16),
                                  topRight: const Radius.circular(16),
                                  bottomLeft: isSpeakerA ? Radius.zero : const Radius.circular(16),
                                  bottomRight: isSpeakerA ? const Radius.circular(16) : Radius.zero,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Text(
                                        isSpeakerA ? 'Speaker A' : 'Speaker B',
                                        style: TextStyle(
                                          fontWeight: FontWeight.bold,
                                          fontSize: 12,
                                          color: isSpeakerA ? Colors.blueAccent : Colors.purpleAccent,
                                        ),
                                      ),
                                      const SizedBox(width: 12),
                                      AudioPlayerControl(audioPath: line.audioPath),
                                    ],
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    line.originalText,
                                    style: const TextStyle(fontSize: 18, color: Colors.white, height: 1.4),
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    line.translation,
                                    style: TextStyle(fontSize: 14, color: Colors.grey[400], height: 1.4),
                                  ),
                                ],
                              ),
                            ),
                          ),
                          if (!isSpeakerA) ...[
                            const SizedBox(width: 10),
                            _buildAvatar(isSpeakerA),
                          ],
                        ],
                      ),
                    );
                  },
                ),
              ),

              // Bottom control buttons
              Container(
                padding: const EdgeInsets.all(20),
                decoration: const BoxDecoration(
                  color: Color(0xFF0F172A),
                  border: Border(top: BorderSide(color: Color(0xFF1E293B))),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.refresh, size: 18),
                            label: const Text('重新生成'),
                            onPressed: () => _showRegenerateDialog(context),
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              foregroundColor: Colors.purpleAccent,
                              side: const BorderSide(color: Colors.purpleAccent),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: OutlinedButton.icon(
                            icon: const Icon(Icons.change_circle_outlined, size: 18),
                            label: const Text('更换主题'),
                            onPressed: () {
                              studyCubit.rejectDialogue(dialogue.id);
                              context.go('/');
                            },
                            style: OutlinedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              foregroundColor: Colors.redAccent,
                              side: const BorderSide(color: Colors.redAccent),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    ElevatedButton(
                      onPressed: () {
                        // Mark progress and go to fill-blank
                        studyCubit.updateDialogueProgress(dialogue.id, studyState.previewLineIndex, false);
                        context.push('/fill-blank');
                      },
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        backgroundColor: Colors.deepPurple,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: const Text('开始练习 🎓', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                    ),
                  ],
                ),
              ),
            ],
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

  Widget _buildAvatar(bool isSpeakerA) {
    return CircleAvatar(
      backgroundColor: isSpeakerA ? Colors.blue[900] : Colors.purple[900],
      radius: 20,
      child: Text(
        isSpeakerA ? 'A' : 'B',
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: isSpeakerA ? Colors.blueAccent : Colors.purpleAccent,
        ),
      ),
    );
  }
}
