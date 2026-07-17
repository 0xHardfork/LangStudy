import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import '../cubit/subtitle_cubit.dart';
import '../cubit/subtitle_state.dart';

class SubtitleProgressPage extends StatefulWidget {
  final int topicId;

  const SubtitleProgressPage({super.key, required this.topicId});

  @override
  State<SubtitleProgressPage> createState() => _SubtitleProgressPageState();
}

class _SubtitleProgressPageState extends State<SubtitleProgressPage> {
  bool _isProcessing = false;
  bool _isMerging = false;

  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<SubtitleCubit>().getSubtitleTopic(widget.topicId);
      _startPolling();
    });
  }

  @override
  void dispose() {
    _stopPolling();
    super.dispose();
  }

  void _startPolling() {
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
      final cubit = context.read<SubtitleCubit>();
      final activeState = cubit.state;
      if (activeState is SubtitleLoaded && activeState.currentTopic != null) {
        final topic = activeState.currentTopic!;
        final hasFailed = topic.chunks?.any((c) => c.status == 'failed') ?? false;
        if (topic.status != 'pending' || hasFailed) {
          _stopPolling();
          return;
        }
      }
      cubit.getSubtitleTopic(widget.topicId);
    });
  }

  void _stopPolling() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<void> _resumeProcessing() async {
    if (_isProcessing) return;
    setState(() {
      _isProcessing = true;
    });
    try {
      await context.read<SubtitleCubit>().processSubtitleTopic(widget.topicId);
      if (mounted) {
        await context.read<SubtitleCubit>().getSubtitleTopic(widget.topicId);
        _startPolling();
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('启动任务失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isProcessing = false;
        });
      }
    }
  }

  Future<void> _mergeTopic() async {
    if (_isMerging) return;
    setState(() {
      _isMerging = true;
    });
    try {
      await context.read<SubtitleCubit>().mergeSubtitleTopic(widget.topicId);
      if (mounted) {
        context.go('/subtitle/detail/${widget.topicId}');
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('合并失败: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isMerging = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF020617),
      appBar: AppBar(
        backgroundColor: const Color(0xFF0F172A).withOpacity(0.6),
        title: const Text(
          '🎬 字幕分块处理进度',
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold),
        ),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: Colors.white),
          onPressed: () {
            context.read<SubtitleCubit>().resetCurrentTopic();
            context.go('/subtitle');
          },
        ),
      ),
      body: BlocBuilder<SubtitleCubit, SubtitleState>(
        builder: (context, state) {
          if (state is SubtitleLoading && !_isProcessing && !_isMerging) {
            return const Center(
              child: CircularProgressIndicator(color: Color(0xFFF43F5E)),
            );
          }

          if (state is SubtitleError) {
            return Center(
              child: Text(
                state.message,
                style: const TextStyle(color: Colors.redAccent),
              ),
            );
          }

          if (state is SubtitleLoaded && state.currentTopic != null) {
            final topic = state.currentTopic!;
            final chunks = topic.chunks ?? [];
            final total = chunks.length;
            final completed = chunks.where((c) => c.status == 'completed').length;
            final isAllDone = total > 0 && completed == total;
            final progressPercent = total > 0 ? (completed / total) : 0.0;

            return SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    color: const Color(0xFF0F172A).withOpacity(0.4),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          topic.title,
                          style: const TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '文件名: ${topic.originalFileName}',
                          style: const TextStyle(color: Colors.grey, fontSize: 12),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              '处理进度: $completed / $total 分块',
                              style: const TextStyle(color: Colors.white70, fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                            Text(
                              '${(progressPercent * 100).round()}%',
                              style: const TextStyle(color: Color(0xFFF43F5E), fontSize: 13, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: progressPercent,
                            backgroundColor: const Color(0xFF1E293B),
                            color: const Color(0xFFF43F5E),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      padding: const EdgeInsets.all(16),
                      itemCount: chunks.length,
                      itemBuilder: (context, index) {
                        final chunk = chunks[index];
                        final isFailed = chunk.status == 'failed';
                        final isProcessing = chunk.status == 'processing';
                        final isCompleted = chunk.status == 'completed';

                        Color borderColor = const Color(0xFF1E293B);
                        Color bgColor = const Color(0xFF0F172A).withOpacity(0.2);

                        if (isProcessing) {
                          borderColor = Colors.amber.withOpacity(0.4);
                          bgColor = Colors.amber.withOpacity(0.05);
                        } else if (isCompleted) {
                          borderColor = const Color(0xFF10B981).withOpacity(0.2);
                          bgColor = const Color(0xFF10B981).withOpacity(0.02);
                        } else if (isFailed) {
                          borderColor = Colors.red.withOpacity(0.3);
                          bgColor = Colors.red.withOpacity(0.03);
                        }

                        return Container(
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: bgColor,
                            border: Border.all(color: borderColor),
                            borderRadius: BorderRadius.circular(12),
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
                                          '分块 #${chunk.chunkIndex + 1}',
                                          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold),
                                        ),
                                        const SizedBox(width: 8),
                                        Text(
                                          '(序号: ${chunk.startIndex}-${chunk.endIndex})',
                                          style: const TextStyle(color: Colors.grey, fontSize: 11),
                                        ),
                                      ],
                                    ),
                                    if (isFailed && chunk.errorMessage.isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      Container(
                                        padding: const EdgeInsets.all(8),
                                        decoration: BoxDecoration(
                                          color: Colors.black26,
                                          borderRadius: BorderRadius.circular(6),
                                          border: Border.all(color: Colors.red.withOpacity(0.1)),
                                        ),
                                        child: Text(
                                          '⚠️ 失败原因: ${chunk.errorMessage}',
                                          style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              if (isCompleted)
                                const Text(
                                  '✅ 完成',
                                  style: TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.bold),
                                )
                              else if (isProcessing)
                                const Text(
                                  '🔄 处理中',
                                  style: TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                                )
                              else if (isFailed)
                                Row(
                                  children: [
                                    const Text(
                                      '❌ 失败',
                                      style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                       onPressed: _isProcessing ? null : _resumeProcessing,
                                       style: ElevatedButton.styleFrom(
                                         backgroundColor: const Color(0xFFF43F5E),
                                         padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                         minimumSize: Size.zero,
                                         shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                       ),
                                       child: const Text('重试', style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold)),
                                     ),
                                  ],
                                )
                              else
                                const Text(
                                  '等待中',
                                  style: TextStyle(color: Colors.grey, fontSize: 12),
                                ),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                  if (!isAllDone && !chunks.any((c) => c.status == 'processing'))
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: ElevatedButton.icon(
                        onPressed: _isProcessing ? null : _resumeProcessing,
                        icon: _isProcessing
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Icon(Icons.play_arrow, color: Colors.white),
                        label: const Text('🚀 开始/继续分析字幕', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFFF43F5E),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                      ),
                    ),
                  if (isAllDone)
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: ElevatedButton(
                        onPressed: _isMerging ? null : _mergeTopic,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF10B981),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: _isMerging
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('✨ 合并字幕并开启完整解析', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white)),
                      ),
                    ),
                ],
              ),
            );
          }

          return const SizedBox.shrink();
        },
      ),
    );
  }
}
