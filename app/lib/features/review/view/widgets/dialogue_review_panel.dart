import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:intl/intl.dart';
import '../../models/review_model.dart';
import '../../cubit/review_cubit.dart';
import '../../../../shared/widgets/audio_player_control.dart';

class DialogueReviewPanel extends StatefulWidget {
  final List<ReviewItem> reviews;
  final List<ReviewItem> allReviews;
  final int fillBlankLevel;
  final VoidCallback onFinish;

  const DialogueReviewPanel({
    super.key,
    required this.reviews,
    required this.allReviews,
    required this.fillBlankLevel,
    required this.onFinish,
  });

  @override
  State<DialogueReviewPanel> createState() => _DialogueReviewPanelState();
}

class _DialogueReviewPanelState extends State<DialogueReviewPanel> {
  bool _showChart = true;
  int _currentIdx = 0;
  int _hoveredIdx = 0;
  final Map<int, String> _inputs = {};
  bool _submitted = false;
  bool _isCorrect = false;
  int _doneCount = 0;
  bool _submitting = false;

  final Map<int, TextEditingController> _controllers = {};
  final Map<int, FocusNode> _focusNodes = {};
  final FocusNode _nextFocusNode = FocusNode();

  @override
  void dispose() {
    _disposeControllers();
    _nextFocusNode.dispose();
    super.dispose();
  }

  void _disposeControllers() {
    _controllers.forEach((_, c) => c.dispose());
    _controllers.clear();
    _focusNodes.forEach((_, f) => f.dispose());
    _focusNodes.clear();
  }

  void _initItemControllers() {
    _disposeControllers();
    if (_currentIdx >= widget.reviews.length) return;

    final item = widget.reviews[_currentIdx];
    final tokens = _tokenize(item.originalText);
    final blankIndices = _getBlankIndices(item, widget.fillBlankLevel, tokens);

    for (final idx in blankIndices) {
      final controller = TextEditingController(text: _inputs[idx] ?? '');
      controller.addListener(() {
        _inputs[idx] = controller.text;
      });
      _controllers[idx] = controller;
      _focusNodes[idx] = FocusNode();
    }

    if (blankIndices.isNotEmpty) {
      final sorted = blankIndices.toList()..sort();
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (_focusNodes.containsKey(sorted[0])) {
          _focusNodes[sorted[0]]!.requestFocus();
        }
      });
    }
  }

  List<String> _tokenize(String text) {
    return text.contains(' ') ? text.split(' ') : text.split('');
  }

  Map<String, String> _splitToken(String token) {
    final isPunct = RegExp(r'^[^\p{L}\p{N}]$', unicode: true);
    int start = 0;
    while (start < token.length && isPunct.hasMatch(token[start])) {
      start++;
    }
    int end = token.length;
    while (end > start && isPunct.hasMatch(token[end - 1])) {
      end--;
    }
    return {
      'prefix': token.substring(0, start),
      'clean': token.substring(start, end),
      'suffix': token.substring(end),
    };
  }

  Set<int> _getBlankIndices(ReviewItem item, int level, List<String> tokens) {
    if (level == 4) {
      final Set<int> indices = {};
      for (int i = 0; i < tokens.length; i++) {
        final clean = _splitToken(tokens[i])['clean']!;
        if (clean.isNotEmpty) {
          indices.add(i);
        }
      }
      return indices;
    } else {
      final sorted = List.from(item.vocabulary);
      sorted.sort((a, b) => a.importance.compareTo(b.importance));
      final sliced = sorted.take(level);
      return sliced.map((v) => v.wordIndex as int).toSet();
    }
  }

  String _normalize(String s) {
    return s
        .trim()
        .toLowerCase()
        .replaceAll(RegExp(r'[.,\/#!$%\^&\*;:{}=\-_`~()?（）！，。？；：]'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
  }

  void _submit() async {
    if (_submitting) return;

    final item = widget.reviews[_currentIdx];
    final tokens = _tokenize(item.originalText);
    final blankIndices = _getBlankIndices(item, widget.fillBlankLevel, tokens);

    bool correct = true;
    for (final idx in blankIndices) {
      final given = _normalize(_inputs[idx] ?? '');
      final expected = _normalize(_splitToken(tokens[idx])['clean']!);
      if (given != expected) {
        correct = false;
        break;
      }
    }

    setState(() {
      _isCorrect = correct;
      _submitted = true;
      _doneCount++;
      _submitting = true;
    });

    try {
      await context.read<ReviewCubit>().submitDialogueAnswer(
            dialogueLineId: item.dialogueLineId,
            isCorrect: correct,
          );
    } catch (_) {} finally {
      setState(() {
        _submitting = false;
      });
      _nextFocusNode.requestFocus();
    }
  }

  void _next() {
    setState(() {
      _currentIdx++;
      _inputs.clear();
      _submitted = false;
      _isCorrect = false;
    });
    _initItemControllers();
  }

  void _prev() {
    if (_currentIdx > 0) {
      setState(() {
        _currentIdx--;
        _inputs.clear();
        _submitted = false;
        _isCorrect = false;
      });
      _initItemControllers();
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_showChart) {
      return _buildDashboard();
    }

    if (widget.reviews.isEmpty) {
      return _buildFinished(title: '暂无需要复习的内容', desc: '继续保持，明天再来！');
    }

    if (_currentIdx >= widget.reviews.length) {
      return _buildFinished(title: '复习完成！', desc: '共复习 $_doneCount 句');
    }

    final item = widget.reviews[_currentIdx];
    final tokens = _tokenize(item.originalText);
    final blankIndices = _getBlankIndices(item, widget.fillBlankLevel, tokens);

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
                '🔄 听写复习 (${_currentIdx + 1} / ${widget.reviews.length})',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.grey),
              ),
              TextButton(
                onPressed: () => setState(() => _showChart = true),
                child: const Text('查看计划', style: TextStyle(fontSize: 13, color: Colors.blueAccent)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Review Exercise Box
        Container(
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF581C87).withOpacity(0.08),
            border: Border.all(color: Colors.purple.withOpacity(0.15)),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    '复习 轮次 #${item.reviewCount + 1}',
                    style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.purpleAccent),
                  ),
                  AudioPlayerControl(audioPath: item.audioPath),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                '💬 ${item.translation}',
                style: const TextStyle(fontSize: 16, color: Colors.white, height: 1.4),
              ),
              const SizedBox(height: 8),
              if (item.audioPath != null)
                const Text(
                  '💡 提示：可以先点 🔊 听读音再填写',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
              const SizedBox(height: 24),

              // Blanks wrapping
              Wrap(
                spacing: 8.0,
                runSpacing: 12.0,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: tokens.asMap().entries.map((entry) {
                  final idx = entry.key;
                  final tok = entry.value;
                  final parts = _splitToken(tok);
                  final prefix = parts['prefix']!;
                  final clean = parts['clean']!;
                  final suffix = parts['suffix']!;

                  if (blankIndices.contains(idx)) {
                    final controller = _controllers[idx];
                    final focusNode = _focusNodes[idx];
                    final given = _inputs[idx] ?? '';
                    final isFieldCorrect = given.trim().toLowerCase() == clean.toLowerCase();

                    return Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (prefix.isNotEmpty)
                          Text(prefix, style: const TextStyle(fontSize: 20, color: Colors.white)),
                        SizedBox(
                          width: (clean.length * 13.0 + 36.0).clamp(55.0, 180.0),
                          child: TextField(
                            controller: controller,
                            focusNode: focusNode,
                            enabled: !_submitted,
                            textAlign: TextAlign.center,
                            style: const TextStyle(fontSize: 18, color: Colors.white, fontWeight: FontWeight.bold),
                            decoration: InputDecoration(
                              contentPadding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                              isDense: true,
                              filled: true,
                              fillColor: _submitted
                                  ? (isFieldCorrect ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15))
                                  : Colors.purple.withOpacity(0.08),
                              enabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: Colors.purpleAccent.withOpacity(0.4), style: BorderStyle.solid),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              disabledBorder: OutlineInputBorder(
                                borderSide: BorderSide(color: isFieldCorrect ? Colors.green : Colors.red, width: 2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderSide: const BorderSide(color: Colors.blueAccent, width: 2),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              hintText: '___',
                              hintStyle: TextStyle(color: Colors.grey[750]),
                            ),
                            textInputAction: TextInputAction.next,
                            onSubmitted: (_) {
                              final sorted = blankIndices.toList()..sort();
                              final unfilled = sorted.where((i) {
                                if (i == idx) return _controllers[i]!.text.trim().isEmpty;
                                return (_inputs[i] ?? '').trim().isEmpty;
                              }).toList();

                              if (unfilled.isNotEmpty) {
                                _focusNodes[unfilled[0]]?.requestFocus();
                              } else {
                                _nextFocusNode.requestFocus();
                              }
                            },
                          ),
                        ),
                        if (suffix.isNotEmpty)
                          Text(suffix, style: const TextStyle(fontSize: 20, color: Colors.white)),
                      ],
                    );
                  }

                  return Text(tok, style: const TextStyle(fontSize: 20, color: Colors.white));
                }).toList(),
              ),

              // Feedback
              if (_submitted) ...[
                const SizedBox(height: 20),
                Container(
                  padding: const EdgeInsets.all(12),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: _isCorrect ? Colors.green.withOpacity(0.08) : Colors.red.withOpacity(0.08),
                    border: Border.all(color: _isCorrect ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2)),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    _isCorrect ? '✅ 答对了！' : '❌ 答错了，正确句子是：\n${item.originalText}',
                    style: TextStyle(
                      color: _isCorrect ? Colors.greenAccent : Colors.redAccent,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Controls
        Row(
          children: [
            if (_currentIdx > 0) ...[
              OutlinedButton(
                onPressed: _prev,
                style: OutlinedButton.styleFrom(
                  padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  side: const BorderSide(color: Colors.grey),
                  foregroundColor: Colors.grey,
                ),
                child: const Text('← 上一句'),
              ),
              const SizedBox(width: 12),
            ],
            Expanded(
              child: !_submitted
                  ? ElevatedButton(
                      onPressed: _submitting ? null : _submit,
                      style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        backgroundColor: Colors.deepPurple,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _submitting
                          ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)))
                          : const Text('提交', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
                    )
                  : Focus(
                      focusNode: _nextFocusNode,
                      child: ElevatedButton(
                        onPressed: _next,
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          backgroundColor: const Color(0xFF1E3A8A).withOpacity(0.2),
                          foregroundColor: Colors.blueAccent,
                          side: const BorderSide(color: Colors.blueAccent),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: Text(_currentIdx + 1 >= widget.reviews.length ? '完成复习 🎉' : '下一条 →'),
                      ),
                    ),
            ),
          ],
        ),
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
    final dates = List.generate(7, (i) {
      final d = DateTime.now().add(Duration(days: i));
      return DateFormat('M/d').format(d);
    });

    final Map<String, List<ReviewItem>> grouped = {for (var d in dates) d: []};
    final todayStr = dates[0];

    for (final item in widget.allReviews) {
      final nextAt = DateTime.parse(item.nextReviewAt).toLocal();
      final todayEnd = DateTime.now().add(const Duration(days: 0));
      final cleanTodayEnd = DateTime(todayEnd.year, todayEnd.month, todayEnd.day, 23, 59, 59);

      if (nextAt.isBefore(cleanTodayEnd)) {
        grouped[todayStr]?.add(item);
      } else {
        final dateStr = DateFormat('M/d').format(nextAt);
        if (grouped.containsKey(dateStr)) {
          grouped[dateStr]?.add(item);
        }
      }
    }

    final maxCount = grouped.values.map((l) => l.length).fold(0, (max, len) => len > max ? len : max).clamp(5, 100);
    final activeDateStr = dates[_hoveredIdx];
    final activeItems = grouped[activeDateStr] ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Bar Graph Planner
        Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.grey.withOpacity(0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('未来 7 天听力复习规划统计', style: TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
                  Text('点击查看每日概要', style: TextStyle(color: Colors.grey, fontSize: 11)),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: List.generate(7, (i) {
                  final date = dates[i];
                  final count = grouped[date]?.length ?? 0;
                  final ratio = count / maxCount;
                  final isToday = i == 0;
                  final isSelected = _hoveredIdx == i;

                  return GestureDetector(
                    onTap: () => setState(() => _hoveredIdx = i),
                    child: Column(
                      children: [
                        Text('$count', style: TextStyle(fontSize: 10, color: isSelected ? Colors.purpleAccent : Colors.grey, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Container(
                          width: 24,
                          height: (ratio * 120).clamp(4.0, 120.0),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(4),
                            gradient: LinearGradient(
                              colors: isSelected
                                  ? [Colors.purpleAccent, Colors.purple]
                                  : (isToday ? [Colors.blueAccent, Colors.blue] : [Colors.grey[800]!, Colors.grey[900]!]),
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                            ),
                          ),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          isToday ? '今日' : date,
                          style: TextStyle(
                            fontSize: 10,
                            color: isSelected ? Colors.purpleAccent : (isToday ? Colors.blueAccent : Colors.grey),
                            fontWeight: isToday || isSelected ? FontWeight.bold : FontWeight.normal,
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Active selected date summary
        Text(
          _hoveredIdx == 0 ? '今日待复习句子的概要' : '$activeDateStr 计划复习句子的概要',
          style: const TextStyle(fontSize: 13, color: Colors.grey, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 8),
        if (activeItems.isEmpty)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 24),
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A).withOpacity(0.3),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.grey.withOpacity(0.08)),
            ),
            child: const Center(
              child: Text('此日期没有计划复习的句子', style: TextStyle(color: Colors.grey, fontSize: 13)),
            ),
          )
        else
          ConstrainedBox(
            constraints: const BoxConstraints(maxHeight: 200),
            child: ListView.builder(
              shrinkWrap: true,
              itemCount: activeItems.length,
              itemBuilder: (context, idx) {
                final item = activeItems[idx];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 8.0),
                  child: Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A).withOpacity(0.5),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Colors.grey.withOpacity(0.08)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(item.translation, style: const TextStyle(fontSize: 14, color: Colors.white)),
                              const SizedBox(height: 4),
                              Text('复习轮次: 第 ${item.reviewCount + 1} 轮', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                            ],
                          ),
                        ),
                        AudioPlayerControl(audioPath: item.audioPath),
                      ],
                    ),
                  ),
                );
              },
            ),
          ),
        const SizedBox(height: 24),

        // Start Review Button
        if (widget.reviews.isNotEmpty)
          ElevatedButton(
            onPressed: () {
              setState(() => _showChart = false);
              _initItemControllers();
            },
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
              backgroundColor: Colors.deepPurple,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
            child: Text(
              '🚀 开始今日听力复习 (${widget.reviews.length} 句)',
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
                '🎉 太棒了！今天所有的听写复习都已完成！',
                style: TextStyle(color: Colors.greenAccent, fontSize: 14, fontWeight: FontWeight.bold),
              ),
            ),
          ),
      ],
    );
  }
}
