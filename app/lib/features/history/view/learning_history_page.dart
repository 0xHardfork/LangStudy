import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/di/service_locator.dart';
import '../../dialogue/data/repository/dialogue_repository.dart';
import '../../dialogue/models/dialogue_model.dart';
import '../../study/cubit/study_cubit.dart';
import '../../study/cubit/study_state.dart';
import '../../../shared/utils/constants.dart';

class LearningHistoryPage extends StatefulWidget {
  const LearningHistoryPage({super.key});

  @override
  State<LearningHistoryPage> createState() => _LearningHistoryPageState();
}

class _LearningHistoryPageState extends State<LearningHistoryPage> {
  final _searchController = TextEditingController();
  int _currentPage = 1;
  final int _pageSize = 10;

  bool _loading = false;
  String? _error;
  List<Dialogue> _dialogues = [];
  int _totalItems = 0;

  @override
  void initState() {
    super.initState();
    _loadHistory();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _loadHistory() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final repo = getIt<DialogueRepository>();
      final res = await repo.listDialogues(
        page: _currentPage,
        pageSize: _pageSize,
        search: _searchController.text.trim(),
      );

      final List itemsRaw = res['items'] as List? ?? [];
      final total = res['total'] as int? ?? 0;

      setState(() {
        _dialogues = itemsRaw.map((i) => Dialogue.fromJson(i as Map<String, dynamic>)).toList();
        _totalItems = total;
      });
    } catch (e) {
      setState(() {
        _error = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }

  void _onSearch() {
    setState(() {
      _currentPage = 1;
    });
    _loadHistory();
  }

  void _relearn(Dialogue dialogue) {
    final studyCubit = context.read<StudyCubit>();
    studyCubit.resetDialogue();
    // Inject the selected dialogue to the state
    studyCubit.emit(studyCubit.state.copyWith(
      currentDialogue: () => dialogue,
      previewLineIndex: 0,
    ));
    context.push('/fill-blank');
  }

  @override
  Widget build(BuildContext context) {
    final totalPages = (_totalItems / _pageSize).ceil().clamp(1, 9999);

    return Scaffold(
      appBar: AppBar(
        title: const Text('📚 学习历史', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF0F172A),
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.go('/'),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            // Search Input Row
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
              child: Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _searchController,
                      decoration: InputDecoration(
                        hintText: '搜索对话主题...',
                        prefixIcon: const Icon(Icons.search),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                        contentPadding: const EdgeInsets.symmetric(vertical: 10),
                      ),
                      onSubmitted: (_) => _onSearch(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  ElevatedButton(
                    onPressed: _onSearch,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
                      backgroundColor: Colors.deepPurple,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: const Text('搜索', style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ),

            // Dialogues List
            Expanded(
              child: _buildListContent(totalPages),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildListContent(int totalPages) {
    if (_loading) {
      return const Center(child: CircularProgressIndicator(color: Colors.deepPurpleAccent));
    }

    if (_error != null) {
      return Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('获取历史记录失败', style: TextStyle(color: Colors.redAccent, fontSize: 16, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.grey), textAlign: TextAlign.center),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _loadHistory,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.deepPurple),
              child: const Text('重试', style: TextStyle(color: Colors.white)),
            ),
          ],
        ),
      );
    }

    if (_dialogues.isEmpty) {
      return const Center(
        child: Text('暂无历史记录', style: TextStyle(color: Colors.grey)),
      );
    }

    return Column(
      children: [
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: 24),
            itemCount: _dialogues.length,
            itemBuilder: (context, index) {
              final dialogue = _dialogues[index];
              final langLabel = languageLabels[dialogue.language] ?? dialogue.language.toUpperCase();
              final levelLabel = levelLabels[dialogue.level] ?? dialogue.level;
              final firstLine = dialogue.lines.isNotEmpty ? dialogue.lines[0].originalText : '';
              final timeStr = dialogue.createdAt.isNotEmpty
                  ? DateFormat('yyyy/MM/dd HH:mm').format(DateTime.parse(dialogue.createdAt).toLocal())
                  : '';

              return Padding(
                padding: const EdgeInsets.only(bottom: 12.0),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A).withOpacity(0.5),
                    border: Border.all(color: Colors.grey.withOpacity(0.12)),
                    borderRadius: BorderRadius.circular(16),
                  ),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Text(
                                  dialogue.topic,
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.white),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: Colors.blue.withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text('$langLabel · $levelLabel', style: const TextStyle(fontSize: 10, color: Colors.blueAccent)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Text(
                              firstLine,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(fontSize: 13, color: Colors.grey),
                            ),
                            const SizedBox(height: 8),
                            Text('📅 学习于 $timeStr', style: const TextStyle(fontSize: 10, color: Colors.grey)),
                          ],
                        ),
                      ),
                      const SizedBox(width: 12),
                      ElevatedButton(
                        onPressed: () => _relearn(dialogue),
                        style: ElevatedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          backgroundColor: Colors.purple.withOpacity(0.12),
                          foregroundColor: Colors.purpleAccent,
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: const Text('重新学习', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),

        // Pagination Bar
        if (totalPages > 1)
          Container(
            padding: const EdgeInsets.symmetric(vertical: 16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                IconButton(
                  icon: const Icon(Icons.chevron_left),
                  onPressed: _currentPage > 1
                      ? () {
                          setState(() => _currentPage--);
                          _loadHistory();
                        }
                      : null,
                ),
                Text('$_currentPage / $totalPages', style: const TextStyle(color: Colors.white)),
                IconButton(
                  icon: const Icon(Icons.chevron_right),
                  onPressed: _currentPage < totalPages
                      ? () {
                          setState(() => _currentPage++);
                          _loadHistory();
                        }
                      : null,
                ),
              ],
            ),
          ),
      ],
    );
  }
}
