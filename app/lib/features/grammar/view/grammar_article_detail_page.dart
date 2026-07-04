import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../cubit/grammar_cubit.dart';
import '../cubit/grammar_state.dart';
import '../models/grammar_model.dart';
import '../../../shared/widgets/audio_player_control.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

class GrammarArticleDetailPage extends StatefulWidget {
  final int articleId;

  const GrammarArticleDetailPage({super.key, required this.articleId});

  @override
  State<GrammarArticleDetailPage> createState() => _GrammarArticleDetailPageState();
}

class _GrammarArticleDetailPageState extends State<GrammarArticleDetailPage> {
  int? _activeSentIdx;

  @override
  void initState() {
    super.initState();
    context.read<GrammarCubit>().getAnalyzedArticle(widget.articleId);
  }

  @override
  Widget build(BuildContext context) {
    final grammarCubit = context.watch<GrammarCubit>();
    final state = grammarCubit.state;

    return Scaffold(
      appBar: AppBar(
        title: const Text('文章语法分析', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            grammarCubit.resetCurrentArticle();
            context.go('/grammar');
          },
        ),
      ),
      body: SafeArea(
        child: BlocBuilder<GrammarCubit, GrammarState>(
          builder: (context, state) {
            if (state is GrammarLoading || state is GrammarInitial) {
              return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
            }

            if (state is GrammarError) {
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
                      onPressed: () => grammarCubit.getAnalyzedArticle(widget.articleId),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurple),
                      child: const Text('重试', style: TextStyle(color: Colors.white)),
                    ),
                  ],
                ),
              );
            }

            if (state is GrammarLoaded && state.currentArticle != null) {
              final article = state.currentArticle!;
              final sentences = article.sentences ?? [];

              // Auto select first sentence if not set
              if (_activeSentIdx == null && sentences.isNotEmpty) {
                _activeSentIdx = 0;
              }

              final currentSentence = (_activeSentIdx != null && _activeSentIdx! < sentences.length)
                  ? sentences[_activeSentIdx!]
                  : null;

              return Column(
                children: [
                  Expanded(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(24),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            article.title,
                            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                          const SizedBox(height: 16),

                          // Left side analog: Article text selection box
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF0F172A),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.grey.withOpacity(0.1)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  '💡 提示：点击下方的英文句子即可呼出对应的深度语法解析',
                                  style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 16),
                                Wrap(
                                  spacing: 6,
                                  runSpacing: 10,
                                  children: List.generate(sentences.length, (idx) {
                                    final sent = sentences[idx];
                                    final isActive = _activeSentIdx == idx;
                                    return GestureDetector(
                                      onTap: () => setState(() => _activeSentIdx = idx),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: isActive ? Colors.purple.withOpacity(0.15) : Colors.transparent,
                                          border: Border(
                                            bottom: BorderSide(
                                              color: isActive ? Colors.purpleAccent : Colors.grey[850]!,
                                              style: isActive ? BorderStyle.solid : BorderStyle.solid,
                                              width: isActive ? 2 : 1,
                                            ),
                                          ),
                                        ),
                                        child: Text(
                                          sent.originalText,
                                          style: TextStyle(
                                            fontSize: 16,
                                            color: isActive ? Colors.white : Colors.grey[400],
                                            height: 1.5,
                                          ),
                                        ),
                                      ),
                                    );
                                  }),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Sentence detailed analysis panel
                          if (currentSentence != null) ...[
                            _buildSentenceAnalysisCard(context, currentSentence, sentences.length, state.analyzing),
                            if (currentSentence.quizzes.isNotEmpty) ...[
                              const SizedBox(height: 24),
                              Text(
                                '🎯 语法测验 (${currentSentence.quizzes.length} 题)',
                                style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(height: 12),
                              ...currentSentence.quizzes.map((quiz) => GrammarQuizCard(quiz: quiz)),
                            ],
                          ] else ...[
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 40.0),
                              child: Center(
                                child: Text('请在上方选择句子查看语法深度解析', style: TextStyle(color: Colors.grey)),
                              ),
                            ),
                          ],
                        ],
                      ),
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

  Widget _buildSentenceAnalysisCard(BuildContext context, GrammarSentence sentence, int totalCount, bool analyzing) {
    final grammarCubit = context.read<GrammarCubit>();

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF0F172A),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '句 ${_activeSentIdx! + 1} / $totalCount',
                style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
              ),
              AudioPlayerControl(audioPath: sentence.audioPath),
            ],
          ),
          const SizedBox(height: 16),
          const Text('原文', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            sentence.originalText,
            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
          ),
          const SizedBox(height: 16),
          const Text('中文释义', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            sentence.translation,
            style: const TextStyle(fontSize: 14, color: Colors.grey, height: 1.4),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('语法讲解', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
              ElevatedButton.icon(
                onPressed: analyzing
                    ? null
                    : () {
                        grammarCubit.regenerateGrammarSentence(sentence.id);
                      },
                icon: const Icon(Icons.refresh, size: 12),
                label: const Text('重新生成 AI 解析', style: TextStyle(fontSize: 11)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.purple.withOpacity(0.1),
                  foregroundColor: Colors.purpleAccent,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.all(12),
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
                strong: const TextStyle(color: Colors.purpleAccent, fontWeight: FontWeight.bold),
                em: const TextStyle(fontStyle: FontStyle.italic),
                listBullet: const TextStyle(color: Colors.purpleAccent),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class GrammarQuizCard extends StatefulWidget {
  final GrammarQuiz quiz;

  const GrammarQuizCard({super.key, required this.quiz});

  @override
  State<GrammarQuizCard> createState() => _GrammarQuizCardState();
}

class _GrammarQuizCardState extends State<GrammarQuizCard> {
  int? _selectedIdx;
  bool? _isCorrect;
  bool _submitting = false;

  @override
  void didUpdateWidget(covariant GrammarQuizCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.quiz.id != widget.quiz.id) {
      _selectedIdx = null;
      _isCorrect = null;
    }
  }

  void _handleSelect(int idx) async {
    if (_selectedIdx != null || _submitting) return;

    final correct = idx == widget.quiz.correctOption;

    setState(() {
      _selectedIdx = idx;
      _isCorrect = correct;
      _submitting = true;
    });

    try {
      await context.read<GrammarCubit>().submitGrammarAnswer(
            grammarQuizId: widget.quiz.id,
            isCorrect: correct,
          );
    } catch (_) {} finally {
      setState(() {
        _submitting = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16.0),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFF0F172A),
          border: Border.all(color: Colors.purple.withOpacity(0.12)),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Expanded(
                  child: Text(
                    '🧠 完形填空专项检测 (Cloze Quiz)',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Colors.purpleAccent),
                  ),
                ),
                const SizedBox(width: 8),
                if (widget.quiz.tags.isNotEmpty)
                  Wrap(
                    spacing: 4,
                    children: widget.quiz.tags.map((tag) {
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.purple.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text('#$tag', style: const TextStyle(fontSize: 9, color: Colors.purpleAccent)),
                      );
                    }).toList(),
                  ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              widget.quiz.question,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
            ),
            const SizedBox(height: 16),

            // Options
            ...List.generate(widget.quiz.options.length, (idx) {
              final opt = widget.quiz.options[idx];
              final isSelected = _selectedIdx == idx;
              final isCorrectOpt = widget.quiz.correctOption == idx;

              Color borderColor = Colors.grey.withOpacity(0.2);
              Color bgColor = const Color(0xFF020617).withOpacity(0.5);
              Color textColor = Colors.white;

              if (_selectedIdx != null) {
                if (isCorrectOpt) {
                  borderColor = Colors.green;
                  bgColor = Colors.green.withOpacity(0.15);
                  textColor = Colors.greenAccent;
                } else if (isSelected) {
                  borderColor = Colors.red;
                  bgColor = Colors.red.withOpacity(0.15);
                  textColor = Colors.redAccent;
                } else {
                  textColor = Colors.grey;
                }
              }

              return Padding(
                padding: const EdgeInsets.only(bottom: 8.0),
                child: InkWell(
                  onTap: _selectedIdx != null ? null : () => _handleSelect(idx),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      border: Border.all(color: borderColor),
                      borderRadius: BorderRadius.circular(12),
                      color: bgColor,
                    ),
                    child: Text(
                      '${String.fromCharCode(65 + idx)}. $opt',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: textColor),
                    ),
                  ),
                ),
              );
            }),

            // Explanations Card
            if (_selectedIdx != null) ...[
              const SizedBox(height: 14),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: _isCorrect! ? Colors.green.withOpacity(0.04) : Colors.red.withOpacity(0.04),
                  border: Border.all(color: _isCorrect! ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1)),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _isCorrect! ? '✅ 答对了！' : '❌ 答错了，正确答案是 ${String.fromCharCode(65 + widget.quiz.correctOption)}',
                      style: TextStyle(color: _isCorrect! ? Colors.greenAccent : Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 8),
                    const Text('选项解析：', style: TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold)),
                    const SizedBox(height: 6),
                    ...List.generate(widget.quiz.options.length, (idx) {
                      final explain = widget.quiz.explanations[idx] ?? '暂无解析';
                      final isCorrectOpt = widget.quiz.correctOption == idx;
                      return Padding(
                        padding: const EdgeInsets.only(bottom: 6.0),
                        child: Container(
                          padding: const EdgeInsets.only(left: 8),
                          decoration: BoxDecoration(
                            border: Border(left: BorderSide(color: isCorrectOpt ? Colors.green : Colors.grey, width: 2)),
                          ),
                          child: Text(
                            '${String.fromCharCode(65 + idx)}: $explain',
                            style: TextStyle(color: isCorrectOpt ? Colors.greenAccent : Colors.grey[400], fontSize: 11, height: 1.3),
                          ),
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
