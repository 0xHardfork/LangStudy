import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../cubit/review_cubit.dart';
import '../../../../shared/widgets/audio_player_control.dart';
import '../../../grammar/models/grammar_model.dart';

class GrammarReviewPanel extends StatefulWidget {
  final List<GrammarQuizReviewDetail> grammarReviews;
  final VoidCallback onFinish;

  const GrammarReviewPanel({
    super.key,
    required this.grammarReviews,
    required this.onFinish,
  });

  @override
  State<GrammarReviewPanel> createState() => _GrammarReviewPanelState();
}

class _GrammarReviewPanelState extends State<GrammarReviewPanel> {
  bool _showStart = true;
  int _currentIdx = 0;
  int? _selectedOption;
  bool? _isCorrect;
  bool _submitted = false;
  int _doneCount = 0;

  void _handleSelectOption(GrammarQuizReviewDetail item, int optionIdx) async {
    if (_submitted) return;

    final correct = optionIdx == item.correctOption;

    setState(() {
      _selectedOption = optionIdx;
      _isCorrect = correct;
      _submitted = true;
      _doneCount++;
    });

    try {
      await context.read<ReviewCubit>().submitGrammarAnswer(
            grammarQuizId: item.grammarQuizId,
            isCorrect: correct,
          );
    } catch (_) {}
  }

  void _next() {
    setState(() {
      _currentIdx++;
      _selectedOption = null;
      _isCorrect = null;
      _submitted = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_showStart) {
      return _buildDashboard();
    }

    if (widget.grammarReviews.isEmpty) {
      return _buildFinished(title: '暂无需要复习的语法题', desc: '继续保持，明天再来！');
    }

    if (_currentIdx >= widget.grammarReviews.length) {
      return _buildFinished(title: '语法复习完成！', desc: '共复习 $_doneCount 道题');
    }

    final item = widget.grammarReviews[_currentIdx];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Card Header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: Colors.grey.withOpacity(0.1)),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                '🧠 语法错题复习 (${_currentIdx + 1} / ${widget.grammarReviews.length})',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.grey),
              ),
              TextButton(
                onPressed: () => setState(() => _showStart = true),
                child: const Text('查看计划', style: TextStyle(fontSize: 13, color: Colors.blueAccent)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Context / Audio Card
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('原句发音与释义', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey)),
                  AudioPlayerControl(audioPath: item.audioPath),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                '💬 ${item.sentenceTrans}',
                style: const TextStyle(color: Colors.white, fontSize: 14, height: 1.4),
              ),
              if (_submitted) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF020617),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.grey.withOpacity(0.08)),
                  ),
                  child: Text(
                    '语法讲解：\n${item.sentenceExplain}',
                    style: const TextStyle(color: Colors.grey, fontSize: 12, height: 1.4),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Quiz Question & Options
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF581C87).withOpacity(0.08),
            border: Border.all(color: Colors.purple.withOpacity(0.15)),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                item.question,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
              ),
              const SizedBox(height: 20),

              // Options
              ...List.generate(item.options.length, (idx) {
                final opt = item.options[idx];
                final isSelected = _selectedOption == idx;
                final isCorrectOpt = item.correctOption == idx;

                Color borderColor = Colors.grey.withOpacity(0.2);
                Color bgColor = const Color(0xFF0F172A).withOpacity(0.4);
                Color textColor = Colors.white;

                if (_submitted) {
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
                  padding: const EdgeInsets.only(bottom: 10.0),
                  child: InkWell(
                    onTap: _submitted ? null : () => _handleSelectOption(item, idx),
                    borderRadius: BorderRadius.circular(12),
                    child: Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        border: Border.all(color: borderColor),
                        borderRadius: BorderRadius.circular(12),
                        color: bgColor,
                      ),
                      child: Text(
                        '${String.fromCharCode(65 + idx)}. $opt',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: textColor),
                      ),
                    ),
                  ),
                );
              }),

              // Feedbacks
              if (_submitted) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: _isCorrect! ? Colors.green.withOpacity(0.05) : Colors.red.withOpacity(0.05),
                    border: Border.all(color: _isCorrect! ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        _isCorrect! ? '✅ 答对了！' : '❌ 答错了，正确答案是 ${String.fromCharCode(65 + item.correctOption)}',
                        style: TextStyle(color: _isCorrect! ? Colors.greenAccent : Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 12),
                      const Text('选项解析：', style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold)),
                      const SizedBox(height: 8),
                      ...List.generate(item.options.length, (idx) {
                        final explain = item.explanations[idx] ?? '暂无解析';
                        final isCorrectOpt = item.correctOption == idx;
                        return Padding(
                          padding: const EdgeInsets.only(bottom: 6.0),
                          child: Container(
                            padding: const EdgeInsets.only(left: 8),
                            decoration: BoxDecoration(
                              border: Border(left: BorderSide(color: isCorrectOpt ? Colors.green : Colors.grey, width: 2)),
                            ),
                            child: Text(
                              '${String.fromCharCode(65 + idx)}: $explain',
                              style: TextStyle(color: isCorrectOpt ? Colors.greenAccent : Colors.grey[400], fontSize: 12, height: 1.3),
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

        // Next Button
        if (_submitted) ...[
          const SizedBox(height: 16),
          ElevatedButton(
            onPressed: _next,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              backgroundColor: const Color(0xFF581C87).withOpacity(0.2),
              foregroundColor: Colors.purpleAccent,
              side: const BorderSide(color: Colors.purpleAccent),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(_currentIdx + 1 >= widget.grammarReviews.length ? '完成复习 🎉' : '下一题 →'),
          ),
        ],
      ],
    );
  }

  Widget _buildFinished({required String title, required String desc}) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        const SizedBox(height: 48),
        const Text('🎉', style: TextStyle(fontSize: 48)),
        const SizedBox(height: 16),
        Text(title, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white)),
        const SizedBox(height: 8),
        Text(desc, style: const TextStyle(color: Colors.grey)),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: widget.onFinish,
          style: ElevatedButton.styleFrom(
            padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 14),
            backgroundColor: Colors.deepPurple,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
          child: const Text('返回主页', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
        ),
      ],
    );
  }

  Widget _buildDashboard() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Summary Card
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.withOpacity(0.1)),
          ),
          child: Column(
            children: [
              const Text('🧠', style: TextStyle(fontSize: 40)),
              const SizedBox(height: 12),
              const Text('语法错题填空计划', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
              const SizedBox(height: 8),
              Text(
                '今天有 ${widget.grammarReviews.length} 道语法错题需要复习巩固',
                style: const TextStyle(color: Colors.grey, fontSize: 13),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // List Summary
        const Text('待复习题概要', style: TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        if (widget.grammarReviews.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 24),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A).withOpacity(0.3),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.withOpacity(0.08)),
            ),
            child: const Center(
              child: Text('暂无需要复习的语法单选', style: TextStyle(color: Colors.grey, fontSize: 13)),
            ),
          )
        else
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 240),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: widget.grammarReviews.length,
              itemBuilder: (context, idx) {
                final item = widget.grammarReviews[idx];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withOpacity(0.5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.withOpacity(0.08)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('${idx + 1}. ${item.question}', style: const TextStyle(fontSize: 14, color: Colors.white, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 4),
                        Text('原句释义: ${item.sentenceTrans}', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        const SizedBox(height: 24),

        // Action Button
        if (widget.grammarReviews.isNotEmpty)
          ElevatedButton(
            onPressed: () => setState(() => _showStart = false),
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              backgroundColor: Colors.deepPurple,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: Text(
              '🚀 开始语法复习 (${widget.grammarReviews.length} 题)',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white),
            ),
          )
        else
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.green.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.green.withOpacity(0.2)),
            ),
            child: const Center(
              child: Text(
                '🎉 太棒了！所有的语法题复习均已完成！',
                style: TextStyle(color: Colors.greenAccent, fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ),
          ),
      ],
    );
  }
}
