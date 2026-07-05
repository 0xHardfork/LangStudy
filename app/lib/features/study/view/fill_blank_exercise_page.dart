import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../../../core/di/service_locator.dart';
import '../../dialogue/models/dialogue_model.dart';
import '../../study/cubit/study_cubit.dart';
import '../../review/data/repository/review_repository.dart';
import '../../../shared/widgets/audio_player_control.dart';
import 'dialogue_full_text_page.dart';

class FillBlankExercisePage extends StatefulWidget {
  const FillBlankExercisePage({super.key});

  @override
  State<FillBlankExercisePage> createState() => _FillBlankExercisePageState();
}

class _FillBlankExercisePageState extends State<FillBlankExercisePage> {
  int _currentIndex = 0;
  final Map<int, String> _inputs = {};
  bool _submitted = false;
  bool _isCorrect = false;
  int _wrongCount = 0;
  bool _submitting = false;
  bool _showTranslation = false;
  int? _dialogueId;

  // Controllers and FocusNodes
  final Map<int, TextEditingController> _controllers = {};
  final Map<int, FocusNode> _focusNodes = {};
  final FocusNode _submitFocusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    print('[DEBUG] FillBlankExercisePage initState called');
    final studyState = context.read<StudyCubit>().state;
    final dialogue = studyState.currentDialogue;
    print('[DEBUG] FillBlankExercisePage dialogue: ${dialogue != null ? "id=${dialogue.id}" : "null"}');
    _currentIndex = studyState.previewLineIndex;
    if (dialogue != null) {
      _dialogueId = dialogue.id;
      if (_currentIndex < 0 || _currentIndex >= dialogue.lines.length) {
        _currentIndex = 0;
      }
    } else {
      _currentIndex = 0;
    }
    _initCurrentLineControllers();
  }

  @override
  void dispose() {
    _disposeControllers();
    _submitFocusNode.dispose();
    super.dispose();
  }

  void _disposeControllers() {
    _controllers.forEach((_, c) => c.dispose());
    _controllers.clear();
    _focusNodes.forEach((_, f) => f.dispose());
    _focusNodes.clear();
  }

  void _initCurrentLineControllers() {
    _disposeControllers();
    final studyState = context.read<StudyCubit>().state;
    final dialogue = studyState.currentDialogue;
    if (dialogue == null || _currentIndex >= dialogue.lines.length) return;

    final line = dialogue.lines[_currentIndex];
    final tokens = _tokenize(line.originalText);
    final blankIndices = _getBlankIndices(line, studyState.fillBlankLevel, tokens);

    for (final idx in blankIndices) {
      final controller = TextEditingController(text: _inputs[idx] ?? '');
      controller.addListener(() {
        _inputs[idx] = controller.text;
      });
      _controllers[idx] = controller;
      _focusNodes[idx] = FocusNode();
    }

    // Auto focus first input field
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

  Set<int> _getBlankIndices(DialogueLine line, int level, List<String> tokens) {
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
      final sorted = List<VocabularyItem>.from(line.vocabulary);
      sorted.sort((a, b) => a.importance.compareTo(b.importance));
      final sliced = sorted.take(level);
      return sliced.map((v) => v.wordIndex).toSet();
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

  bool _checkAnswer(DialogueLine line, int level, List<String> tokens, Set<int> blankIndices) {
    for (final idx in blankIndices) {
      final given = _normalize(_inputs[idx] ?? '');
      final tok = tokens[idx];
      final expected = _normalize(_splitToken(tok)['clean']!);
      if (given != expected) return false;
    }
    return true;
  }

  void _handleSubmit(DialogueLine line, int level, List<String> tokens, Set<int> blankIndices) async {
    if (_submitting) return;

    final correct = _checkAnswer(line, level, tokens, blankIndices);

    setState(() {
      _isCorrect = correct;
      _submitted = true;
      if (!correct) {
        _wrongCount++;
      }
      _submitting = true;
    });

    try {
      final reviewRepo = getIt<ReviewRepository>();
      await reviewRepo.submitDialogueAnswer(
        dialogueLineId: line.id,
        isCorrect: correct,
      );
    } catch (_) {
      // API call failed, fail silently or handle error
    } finally {
      setState(() {
        _submitting = false;
      });
      // Focus Next Button
      _submitFocusNode.requestFocus();
    }
  }

  void _handleNext(Dialogue dialogue) {
    final studyCubit = context.read<StudyCubit>();
    final nextIdx = _currentIndex + 1;

    if (nextIdx >= dialogue.lines.length) {
      // Completed, save progress & finish
      studyCubit.updateDialogueProgress(dialogue.id, nextIdx, true);
      studyCubit.setExerciseResult(_wrongCount);
      studyCubit.resetDialogue();
      context.go('/');
      return;
    }

    // Save progress in background
    studyCubit.updateDialogueProgress(dialogue.id, nextIdx, false);

    setState(() {
      _currentIndex = nextIdx;
      _inputs.clear();
      _submitted = false;
      _isCorrect = false;
      _showTranslation = false;
    });
    _initCurrentLineControllers();
  }

  void _handlePrev(Dialogue dialogue) {
    if (_currentIndex > 0) {
      final studyCubit = context.read<StudyCubit>();
      final prevIdx = _currentIndex - 1;
      studyCubit.updateDialogueProgress(dialogue.id, prevIdx, false);

      setState(() {
        _currentIndex = prevIdx;
        _inputs.clear();
        _submitted = false;
        _isCorrect = false;
        _showTranslation = false;
      });
      _initCurrentLineControllers();
    }
  }

  @override
  Widget build(BuildContext context) {
    print('[DEBUG] FillBlankExercisePage build called');
    final studyCubit = context.watch<StudyCubit>();
    final studyState = studyCubit.state;
    final dialogue = studyState.currentDialogue;
    print('[DEBUG] FillBlankExercisePage dialogue: ${dialogue != null ? "id=${dialogue.id}" : "null"}');

    if (dialogue == null) {
      return const Scaffold(
        body: Center(child: Text('无可用对话')),
      );
    }

    if (dialogue.lines.isEmpty) {
      return const Scaffold(
        body: Center(child: Text('对话内容为空')),
      );
    }

    // Detect if dialogue has changed (e.g. from learning history) or index is out of bounds
    if (_dialogueId != dialogue.id) {
      _dialogueId = dialogue.id;
      _currentIndex = studyState.previewLineIndex;
      if (_currentIndex < 0 || _currentIndex >= dialogue.lines.length) {
        _currentIndex = 0;
      }
      _inputs.clear();
      _submitted = false;
      _isCorrect = false;
      _initCurrentLineControllers();
    } else if (_currentIndex < 0 || _currentIndex >= dialogue.lines.length) {
      _currentIndex = 0;
      _initCurrentLineControllers();
    }

    final line = dialogue.lines[_currentIndex];
    final tokens = _tokenize(line.originalText);
    final blankIndices = _getBlankIndices(line, studyState.fillBlankLevel, tokens);
    final progress = ((_currentIndex + 1) / dialogue.lines.length);
    final isSpeakerA = line.speaker == 'A';

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${dialogue.topic} · ${dialogue.language.toUpperCase()}', style: const TextStyle(fontSize: 14, color: Colors.grey)),
            const SizedBox(height: 6),
            ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: progress,
                backgroundColor: const Color(0xFF1E293B),
                color: Colors.blueAccent,
                minHeight: 4,
              ),
            ),
          ],
        ),
        backgroundColor: const Color(0xFF0F172A),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => DialogueFullTextPage(dialogue: dialogue),
                ),
              );
            },
            child: const Text('显示全文', style: TextStyle(color: Colors.blueAccent)),
          ),
          PopupMenuButton<int>(
            initialValue: studyState.fillBlankLevel,
            onSelected: (lvl) {
              studyCubit.changeFillBlankLevel(lvl);
              // Wait for render, then rebuild inputs
              WidgetsBinding.instance.addPostFrameCallback((_) {
                _initCurrentLineControllers();
              });
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 1, child: Text('挖空等级 L1')),
              PopupMenuItem(value: 2, child: Text('挖空等级 L2')),
              PopupMenuItem(value: 3, child: Text('挖空等级 L3')),
              PopupMenuItem(value: 4, child: Text('挖空等级 L4')),
            ],
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: Center(
                child: Text('L${studyState.fillBlankLevel}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepPurpleAccent)),
              ),
            ),
          ),
        ],
        leading: IconButton(
          icon: const Icon(Icons.home),
          onPressed: () {
            studyCubit.resetDialogue();
            context.go('/');
          },
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    child: Container(
                      padding: const EdgeInsets.all(24),
                      decoration: BoxDecoration(
                        color: isSpeakerA
                            ? const Color(0xFF1E3A8A).withOpacity(0.12)
                            : const Color(0xFF581C87).withOpacity(0.12),
                        border: Border.all(
                          color: isSpeakerA ? Colors.blue.withOpacity(0.2) : Colors.purple.withOpacity(0.2),
                        ),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: SelectionArea(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Speaker Label & Audio
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  isSpeakerA ? '👩 Speaker A' : '👨 Speaker B',
                                  style: TextStyle(
                                    fontWeight: FontWeight.bold,
                                    color: isSpeakerA ? Colors.blueAccent : Colors.purpleAccent,
                                  ),
                                ),
                                AudioPlayerControl(audioPath: line.audioPath),
                              ],
                            ),
                            const SizedBox(height: 16),

                            // Translation hide/show
                            if (_showTranslation) ...[
                              Text(
                                line.translation,
                                style: const TextStyle(fontSize: 16, color: Colors.grey, fontStyle: FontStyle.italic),
                              ),
                              const SizedBox(height: 6),
                              GestureDetector(
                                onTap: () => setState(() => _showTranslation = false),
                                child: const Text('隐藏译文', style: TextStyle(color: Colors.grey, fontSize: 13, decoration: TextDecoration.underline)),
                              ),
                            ] else ...[
                              OutlinedButton.icon(
                                onPressed: () => setState(() => _showTranslation = true),
                                icon: const Icon(Icons.visibility, size: 14),
                                label: const Text('显示中文释义', style: TextStyle(fontSize: 13)),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                  side: BorderSide(color: Colors.grey.withOpacity(0.3)),
                                  foregroundColor: Colors.grey,
                                ),
                              ),
                            ],
                            const SizedBox(height: 24),

                            // Token Wrap list
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
                                        Text(prefix, style: const TextStyle(fontSize: 22, color: Colors.white)),
                                      SizedBox(
                                        width: (clean.length * 14.0 + 36.0).clamp(60.0, 200.0),
                                        child: TextField(
                                          controller: controller,
                                          focusNode: focusNode,
                                          enabled: !_submitted,
                                          textAlign: TextAlign.center,
                                          style: const TextStyle(fontSize: 20, color: Colors.white, fontWeight: FontWeight.bold),
                                          decoration: InputDecoration(
                                            contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                                            isDense: true,
                                            filled: true,
                                            fillColor: _submitted
                                                ? (isFieldCorrect ? Colors.green.withOpacity(0.15) : Colors.red.withOpacity(0.15))
                                                : Colors.deepPurple.withOpacity(0.08),
                                            enabledBorder: OutlineInputBorder(
                                              borderSide: BorderSide(color: Colors.deepPurpleAccent.withOpacity(0.5), style: BorderStyle.solid),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            disabledBorder: OutlineInputBorder(
                                              borderSide: BorderSide(
                                                color: isFieldCorrect ? Colors.green : Colors.red,
                                                width: 2,
                                              ),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            focusedBorder: OutlineInputBorder(
                                              borderSide: const BorderSide(color: Colors.blueAccent, width: 2),
                                              borderRadius: BorderRadius.circular(8),
                                            ),
                                            hintText: '___',
                                            hintStyle: TextStyle(color: Colors.grey[700]),
                                          ),
                                          textInputAction: TextInputAction.next,
                                          onSubmitted: (_) {
                                            final sorted = blankIndices.toList()..sort();
                                            final unfilled = sorted.where((i) {
                                              if (i == idx) {
                                                return _controllers[i]!.text.trim().isEmpty;
                                              }
                                              return (_inputs[i] ?? '').trim().isEmpty;
                                            }).toList();

                                            if (unfilled.isNotEmpty) {
                                              _focusNodes[unfilled[0]]?.requestFocus();
                                            } else {
                                              _submitFocusNode.requestFocus();
                                            }
                                          },
                                        ),
                                      ),
                                      if (suffix.isNotEmpty)
                                        Text(suffix, style: const TextStyle(fontSize: 22, color: Colors.white)),
                                    ],
                                  );
                                }

                                return Text(tok, style: const TextStyle(fontSize: 22, color: Colors.white));
                              }).toList(),
                            ),

                            // Correct/incorrect feedback
                            if (_submitted) ...[
                              const SizedBox(height: 24),
                              Container(
                                padding: const EdgeInsets.all(16),
                                width: double.infinity,
                                decoration: BoxDecoration(
                                  color: _isCorrect ? Colors.green.withOpacity(0.08) : Colors.red.withOpacity(0.08),
                                  border: Border.all(color: _isCorrect ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2)),
                                  borderRadius: BorderRadius.circular(16),
                                ),
                                child: Text(
                                  _isCorrect ? '✅ 回答正确！' : '❌ 错误，正确句子是：\n${line.originalText}',
                                  style: TextStyle(
                                    color: _isCorrect ? Colors.greenAccent : Colors.redAccent,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                    height: 1.4,
                                  ),
                                ),
                              ),
                            ]
                          ],
                        ),
                      ),
                    ),
                  ),
                ),
              ),

              // Bottom buttons
              Row(
                children: [
                  if (_currentIndex > 0) ...[
                    OutlinedButton(
                      onPressed: () => _handlePrev(dialogue),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 20),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        side: const BorderSide(color: Colors.grey),
                        foregroundColor: Colors.grey,
                      ),
                      child: const Text('← 上一句', style: TextStyle(fontSize: 16)),
                    ),
                    const SizedBox(width: 12),
                  ],
                  Expanded(
                    child: !_submitted
                        ? ElevatedButton(
                            onPressed: _submitting ? null : () => _handleSubmit(line, studyState.fillBlankLevel, tokens, blankIndices),
                            style: ElevatedButton.styleFrom(
                              padding: const EdgeInsets.symmetric(vertical: 16),
                              backgroundColor: Colors.deepPurple,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: _submitting
                                ? const SizedBox(
                                    width: 20,
                                    height: 20,
                                    child: CircularProgressIndicator(strokeWidth: 2, valueColor: AlwaysStoppedAnimation(Colors.white)),
                                  )
                                : const Text('提交答案', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.white)),
                          )
                        : Focus(
                            focusNode: _submitFocusNode,
                            child: ElevatedButton(
                              onPressed: () => _handleNext(dialogue),
                              style: ElevatedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(vertical: 16),
                                backgroundColor: const Color(0xFF1E3A8A).withOpacity(0.3),
                                foregroundColor: Colors.blueAccent,
                                side: const BorderSide(color: Colors.blueAccent),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              ),
                              child: Text(
                                _currentIndex + 1 < dialogue.lines.length ? '下一句 →' : '查看结果 🎉',
                                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                  ),
                ],
              ),
              if (_wrongCount > 0) ...[
                const SizedBox(height: 8),
                Text(
                  '本次错题数：$_wrongCount 句（已加入复习队列）',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
