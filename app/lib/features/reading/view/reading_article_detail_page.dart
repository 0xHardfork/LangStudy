import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../cubit/reading_cubit.dart';
import '../cubit/reading_state.dart';
import '../models/reading_models.dart';
import '../../../shared/widgets/audio_player_control.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

class ReadingArticleDetailPage extends StatefulWidget {
  final int articleId;

  const ReadingArticleDetailPage({super.key, required this.articleId});

  @override
  State<ReadingArticleDetailPage> createState() => _ReadingArticleDetailPageState();
}

class _ReadingArticleDetailPageState extends State<ReadingArticleDetailPage> {
  @override
  void initState() {
    super.initState();
    context.read<ReadingCubit>().getReadingArticle(widget.articleId);
  }

  void _showSentenceDetails(BuildContext context, ReadingSentence sentence, bool analyzing) {
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
            return BlocListener<ReadingCubit, ReadingState>(
              listener: (context, state) {
                if (state is ReadingLoaded) {
                  // Find updated sentence to refresh UI within the modal
                  final updatedSent = state.currentArticle?.sentences?.firstWhere(
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
                  final readingCubit = context.watch<ReadingCubit>();
                  final isCurrentlyAnalyzing = readingCubit.state is ReadingLoaded &&
                      (readingCubit.state as ReadingLoaded).analyzing;

                  return SingleChildScrollView(
                    controller: scrollController,
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Drag handle
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

                        // Header (Index & TTS Audio)
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '段落 ${sentence.paragraphIndex + 1} - 句子 ${sentence.sentenceIndex + 1}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                            ),
                            AudioPlayerControl(audioPath: sentence.audioPath),
                          ],
                        ),
                        const SizedBox(height: 20),

                        // English text
                        const Text('英文原文', style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          sentence.originalText,
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
                        ),
                        const SizedBox(height: 20),

                        // Chinese translation
                        const Text('中文释义', style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          sentence.translation,
                          style: const TextStyle(fontSize: 14, color: Colors.grey, height: 1.4),
                        ),
                        const SizedBox(height: 20),

                        // Grammar Analysis
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('深度语法解析', style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                            ElevatedButton.icon(
                              onPressed: isCurrentlyAnalyzing
                                  ? null
                                  : () async {
                                      await context.read<ReadingCubit>().regenerateReadingSentence(sentence.id);
                                    },
                              icon: const Icon(Icons.refresh, size: 12),
                              label: const Text('重新生成 AI 解析', style: TextStyle(fontSize: 11)),
                              style: ElevatedButton.styleFrom(
                                backgroundColor: Colors.blue.withOpacity(0.1),
                                foregroundColor: Colors.blueAccent,
                                elevation: 0,
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),

                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: const Color(0xFF020617).withOpacity(0.5),
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: Colors.grey.withOpacity(0.08)),
                          ),
                          child: MarkdownBody(
                            data: sentence.explanation,
                            selectable: true,
                            styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
                              p: const TextStyle(color: Colors.white, fontSize: 13, height: 1.5),
                              strong: const TextStyle(color: Colors.blueAccent, fontWeight: FontWeight.bold),
                              em: const TextStyle(fontStyle: FontStyle.italic),
                              listBullet: const TextStyle(color: Colors.blueAccent),
                            ),
                          ),
                        ),
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
    final readingCubit = context.watch<ReadingCubit>();

    return Scaffold(
      appBar: AppBar(
        title: const Text('长文阅读与解析', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            readingCubit.resetCurrentArticle();
            context.go('/reading');
          },
        ),
      ),
      body: SafeArea(
        child: BlocBuilder<ReadingCubit, ReadingState>(
          builder: (context, state) {
            if (state is ReadingLoading || state is ReadingInitial) {
              return const Center(child: CircularProgressIndicator(color: Colors.blueAccent));
            }

            if (state is ReadingError) {
              return Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text('加载文章失败', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 8),
                    Text(state.message, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () => readingCubit.getReadingArticle(widget.articleId),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.blue),
                      child: const Text('重试', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (state is ReadingLoaded && state.currentArticle != null) {
              final article = state.currentArticle!;
              final sentences = article.sentences ?? [];

              // Group sentences by paragraph
              final Map<int, List<ReadingSentence>> paragraphs = {};
              for (final sent in sentences) {
                paragraphs.putIfAbsent(sent.paragraphIndex, () => []).add(sent);
              }
              final pIndices = paragraphs.keys.toList()..sort();

              return Column(
                children: [
                  // Article Title Header Card
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(18),
                    color: const Color(0xFF0F172A).withOpacity(0.5),
                    child: Text(
                      article.title,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                      textAlign: TextAlign.center,
                    ),
                  ),

                  // Chat-like sentence list
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: sentences.length,
                      itemBuilder: (context, index) {
                        final sent = sentences[index];

                        return Padding(
                          padding: const EdgeInsets.only(bottom: 12.0),
                          child: Align(
                            alignment: Alignment.centerLeft,
                            child: InkWell(
                              onTap: () => _showSentenceDetails(context, sent, state.analyzing),
                              borderRadius: BorderRadius.circular(16),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                constraints: BoxConstraints(
                                  maxWidth: MediaQuery.of(context).size.width * 0.85,
                                ),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF1E293B),
                                  borderRadius: const BorderRadius.only(
                                    topLeft: Radius.circular(16),
                                    topRight: Radius.circular(16),
                                    bottomRight: Radius.circular(16),
                                    bottomLeft: Radius.circular(4),
                                  ),
                                  border: Border.all(color: Colors.grey.withOpacity(0.1)),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      sent.originalText,
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 15,
                                        height: 1.4,
                                      ),
                                    ),
                                    const SizedBox(height: 6),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                      children: [
                                        Text(
                                          'P${sent.paragraphIndex + 1} - S${sent.sentenceIndex + 1}',
                                          style: TextStyle(color: Colors.grey[500], fontSize: 10, fontWeight: FontWeight.w600),
                                        ),
                                        Text(
                                          '点击查看翻译与语法 💡',
                                          style: TextStyle(color: Colors.blue[300], fontSize: 10, fontWeight: FontWeight.bold),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
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
