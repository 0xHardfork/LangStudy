import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_markdown/flutter_markdown.dart';
import 'package:flutter/services.dart';
import '../cubit/subtitle_cubit.dart';
import '../cubit/subtitle_state.dart';
import '../models/subtitle_models.dart';
import '../../../core/config/app_config.dart';
import '../../auth/cubit/auth_cubit.dart';
import '../../auth/cubit/auth_state.dart';

class SubtitleDetailPage extends StatefulWidget {
  final int topicId;

  const SubtitleDetailPage({super.key, required this.topicId});

  @override
  State<SubtitleDetailPage> createState() => _SubtitleDetailPageState();
}

class _SubtitleDetailPageState extends State<SubtitleDetailPage> {
  @override
  void initState() {
    super.initState();
    context.read<SubtitleCubit>().getSubtitleTopic(widget.topicId);
  }

  void _copyDownloadLink(String langType) {
    final baseUrl = AppConfig.instance.baseUrl;
    final url = '$baseUrl/api/v1/subtitle/topic/${widget.topicId}/download/$langType';

    Clipboard.setData(ClipboardData(text: url));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('已复制 ${langType == 'bilingual' ? '双语' : '学习语言'} 字幕下载链接到剪贴板')),
    );
  }

  void _showSentenceDetails(BuildContext context, SubtitleSentence sentence, bool isOwner) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (bottomSheetContext) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return BlocListener<SubtitleCubit, SubtitleState>(
              listener: (context, state) {
                if (state is SubtitleLoaded) {
                  final updatedSent = state.currentTopic?.sentences?.firstWhere(
                    (s) => s.id == sentence.id,
                    orElse: () => sentence,
                  );
                  if (updatedSent != null) {
                    setModalState(() {
                      sentence = updatedSent;
                    });
                  }
                }
              },
              child: DraggableScrollableSheet(
                initialChildSize: 0.6,
                minChildSize: 0.4,
                maxChildSize: 0.9,
                expand: false,
                builder: (context, scrollController) {
                  final subtitleCubit = context.watch<SubtitleCubit>();
                  final isCurrentlyAnalyzing = subtitleCubit.state is SubtitleLoaded &&
                      (subtitleCubit.state as SubtitleLoaded).analyzing;

                  return SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 40,
                            height: 4,
                            decoration: BoxDecoration(
                              color: Colors.grey[700],
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '第 ${sentence.sentenceIndex + 1} 句',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                            ),
                            if (isOwner)
                              ElevatedButton.icon(
                                onPressed: isCurrentlyAnalyzing
                                    ? null
                                    : () async {
                                        await context
                                            .read<SubtitleCubit>()
                                            .regenerateSubtitleSentence(sentence.id);
                                      },
                                icon: isCurrentlyAnalyzing
                                    ? const SizedBox(
                                        width: 10,
                                        height: 10,
                                        child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white),
                                      )
                                    : const Icon(Icons.refresh, size: 12),
                                label: const Text('重新生成 AI 解析', style: TextStyle(fontSize: 11)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFFF43F5E).withOpacity(0.1),
                                  foregroundColor: const Color(0xFFF43F5E),
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                ),
                              ),
                          ],
                        ),
                        const SizedBox(height: 20),
                        const Text('英文原文', style: TextStyle(color: Color(0xFFF43F5E), fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          sentence.originalText,
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        const Text('中文释义', style: TextStyle(color: Color(0xFFF43F5E), fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          sentence.translation,
                          style: const TextStyle(fontSize: 14, color: Colors.grey, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        const Text('深度语法解析', style: TextStyle(color: Color(0xFFF43F5E), fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        if (sentence.explanation.isNotEmpty)
                          MarkdownBody(
                            data: sentence.explanation,
                            styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                              p: const TextStyle(color: Colors.grey, height: 1.4),
                            ),
                          )
                        else
                          const Text('暂无解析内容', style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic)),
                      ],
                    ),
                  );
                },
              ),
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('字幕语法深度解析', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            context.read<SubtitleCubit>().resetCurrentTopic();
            context.go('/subtitle');
          },
        ),
      ),
      body: SafeArea(
        child: BlocBuilder<SubtitleCubit, SubtitleState>(
          builder: (context, state) {
            if (state is SubtitleLoading) {
              return const Center(child: CircularProgressIndicator(color: Color(0xFFF43F5E)));
            }

            if (state is SubtitleError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Text(
                    state.message,
                    style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
                    textAlign: TextAlign.center,
                  ),
                ),
              );
            }

            if (state is SubtitleLoaded && state.currentTopic != null) {
              final topic = state.currentTopic!;
              final sentences = topic.sentences ?? [];
              final authState = context.watch<AuthCubit>().state;
              int? currentUserId;
              if (authState is AuthAuthenticated) {
                currentUserId = authState.user.id;
              }
              final isOwner = topic.userId == currentUserId;

              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Topic Info Card
                  Container(
                    padding: const EdgeInsets.all(16),
                    color: const Color(0xFF0F172A).withOpacity(0.4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Expanded(
                              child: Text(
                                topic.title,
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
                              ),
                            ),
                            if (isOwner) ...[
                              const SizedBox(width: 8),
                              TextButton.icon(
                                onPressed: () {
                                  if (topic.isShared) {
                                    context.read<SubtitleCubit>().unshareTopic(topic.id);
                                  } else {
                                    context.read<SubtitleCubit>().shareTopic(topic.id);
                                  }
                                },
                                icon: Icon(
                                  topic.isShared ? Icons.lock_open : Icons.lock_outline,
                                  size: 16,
                                  color: topic.isShared ? const Color(0xFF10B981) : Colors.grey,
                                ),
                                label: Text(
                                  topic.isShared ? '已共享' : '分享字幕',
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: topic.isShared ? const Color(0xFF10B981) : Colors.grey,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '文件名: ${topic.originalFileName}',
                          style: const TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _copyDownloadLink('learning'),
                                icon: const Icon(Icons.link, size: 14),
                                label: const Text('复制目标语言字幕下载链接', style: TextStyle(fontSize: 11)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1E293B),
                                  foregroundColor: Colors.white70,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: ElevatedButton.icon(
                                onPressed: () => _copyDownloadLink('bilingual'),
                                icon: const Icon(Icons.link, size: 14),
                                label: const Text('复制双语字幕下载链接', style: TextStyle(fontSize: 11)),
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: const Color(0xFF1E293B),
                                  foregroundColor: Colors.white70,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Scrolling Sentence List
                  Expanded(
                    child: sentences.isEmpty
                      ? const Center(child: Text('无有效的解析句子', style: TextStyle(color: Colors.grey)))
                      : ListView.builder(
                          padding: const EdgeInsets.all(16),
                          itemCount: sentences.length,
                          itemBuilder: (context, index) {
                            final sent = sentences[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 12.0),
                              child: InkWell(
                                onTap: () => _showSentenceDetails(context, sent, isOwner),
                                borderRadius: BorderRadius.circular(16),
                                child: Container(
                                  padding: const EdgeInsets.all(16),
                                  decoration: BoxDecoration(
                                    border: Border.all(color: Colors.grey.withOpacity(0.12)),
                                    borderRadius: BorderRadius.circular(16),
                                    color: const Color(0xFF0F172A).withOpacity(0.5),
                                  ),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.stretch,
                                    children: [
                                      Row(
                                        children: [
                                          Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                            decoration: BoxDecoration(
                                              color: Colors.black.withOpacity(0.3),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              '#${index + 1}',
                                              style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.grey),
                                            ),
                                          ),
                                        ],
                                      ),
                                      const SizedBox(height: 8),
                                      Text(
                                        sent.originalText,
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w600,
                                          color: Colors.white,
                                          height: 1.4,
                                        ),
                                      ),
                                      if (sent.translation.isNotEmpty) ...[
                                        const SizedBox(height: 8),
                                        Text(
                                          sent.translation,
                                          style: const TextStyle(fontSize: 13, color: Colors.grey),
                                        ),
                                      ],
                                    ],
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                  ),
                ],
              );
            }

            return const SizedBox.shrink();
          },
        ),
      ),
    );
  }
}
