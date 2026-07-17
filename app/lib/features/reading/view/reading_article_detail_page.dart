import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:audioplayers/audioplayers.dart';
import '../cubit/reading_cubit.dart';
import '../cubit/reading_state.dart';
import '../models/reading_models.dart';
import '../../../shared/widgets/audio_player_control.dart';
import '../../../core/config/app_config.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

class ReadingArticleDetailPage extends StatefulWidget {
  final int articleId;

  const ReadingArticleDetailPage({super.key, required this.articleId});

  @override
  State<ReadingArticleDetailPage> createState() => _ReadingArticleDetailPageState();
}

class _ReadingArticleDetailPageState extends State<ReadingArticleDetailPage> {
  late final AudioPlayer _audioPlayer;
  List<GlobalKey> _bubbleKeys = [];

  int? _playingIndex;
  bool _isSingleLoop = false;
  bool _isFullLoop = false;
  PlayerState _playerState = PlayerState.stopped;
  bool _isSwitchingSource = false;
  double _playbackSpeed = 1.0;
  late final TextEditingController _inputController;
  late final ScrollController _scrollController;

  @override
  void initState() {
    super.initState();
    _audioPlayer = AudioPlayer();
    _inputController = TextEditingController();
    _scrollController = ScrollController();

    _audioPlayer.onPlayerStateChanged.listen((state) {
      if (mounted) {
        setState(() {
          _playerState = state;
        });
      }
    });

    _audioPlayer.onPlayerComplete.listen((_) {
      if (mounted && !_isSwitchingSource) {
        _onPlaybackComplete();
      }
    });

    context.read<ReadingCubit>().getReadingArticle(widget.articleId);
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    _inputController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  Future<void> _playLine(int index, List<ReadingSentence> sentences) async {
    if (index < 0 || index >= sentences.length) return;
    final sentence = sentences[index];
    final path = sentence.audioPath;
    if (path == null || path.isEmpty) return;

    final baseUrl = AppConfig.instance.baseUrl;
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final fullUrl = path.startsWith('http') ? path : '$baseUrl/$cleanPath';

    setState(() {
      _playingIndex = index;
      _isSwitchingSource = true;
    });

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _scrollToIndex(index);
    });

    try {
      await _audioPlayer.stop();
      await _audioPlayer.play(UrlSource(fullUrl));
      await _audioPlayer.setPlaybackRate(_playbackSpeed);
      if (mounted) {
        setState(() {
          _isSwitchingSource = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _isSwitchingSource = false;
          _playingIndex = null;
        });
      }
    }
  }

  Future<void> _togglePlayLine(int index, List<ReadingSentence> sentences) async {
    if (_playingIndex == index) {
      if (_playerState == PlayerState.playing) {
        await _audioPlayer.pause();
      } else {
        await _audioPlayer.resume();
        await _audioPlayer.setPlaybackRate(_playbackSpeed);
      }
    } else {
      await _playLine(index, sentences);
    }
  }

  void _onPlaybackComplete() {
    if (!mounted) return;
    final cubitState = context.read<ReadingCubit>().state;
    if (cubitState is! ReadingLoaded || cubitState.currentArticle == null) return;
    final sentences = cubitState.currentArticle!.sentences ?? [];

    Future.delayed(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      if (_isSingleLoop && _playingIndex != null) {
        _playLine(_playingIndex!, sentences);
      } else if (_isFullLoop && _playingIndex != null) {
        final nextIndex = _playingIndex! + 1;
        if (nextIndex < sentences.length) {
          _playLine(nextIndex, sentences);
        } else {
          _playLine(0, sentences);
        }
      } else {
        setState(() {
          _playingIndex = null;
        });
      }
    });
  }

  void _scrollToIndex(int index) {
    if (index < 0 || index >= _bubbleKeys.length) return;
    final context = _bubbleKeys[index].currentContext;
    if (context != null) {
      Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 350),
        curve: Curves.easeInOut,
      );
    }
  }

  void _showSentenceDetails(BuildContext context, ReadingSentence sentence, bool analyzing) {
    // Stop main audio player when opening sentence details bottom sheet
    _audioPlayer.stop();
    setState(() {
      _playingIndex = null;
    });

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
                              '段落 ${sentence.paragraphIndex + 1} - 句子 ${sentence.sentenceIndex + 1}',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.grey),
                            ),
                            AudioPlayerControl(audioPath: sentence.audioPath),
                          ],
                        ),
                        const SizedBox(height: 20),
                        const Text('英文原文', style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          sentence.originalText,
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.white, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        const Text('中文释义', style: TextStyle(color: Colors.blueAccent, fontSize: 11, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 6),
                        Text(
                          sentence.translation,
                          style: const TextStyle(fontSize: 14, color: Colors.grey, height: 1.4),
                        ),
                        const SizedBox(height: 20),
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

  Future<void> _sendSentence(String text) async {
    _inputController.clear();
    final cubit = context.read<ReadingCubit>();
    await cubit.addReadingSentence(widget.articleId, text);

    // Scroll to bottom after state updates
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
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

              if (_bubbleKeys.length != sentences.length) {
                _bubbleKeys = List.generate(sentences.length, (_) => GlobalKey());
              }

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

                  // Audio Control Panel
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F172A),
                      border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _playingIndex != null
                                    ? '${_playerState == PlayerState.playing ? "正在播放" : "已暂停"} 第 ${_playingIndex! + 1} / ${sentences.length} 句'
                                    : '未开始播放',
                                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                _isSingleLoop
                                    ? '单句循环模式开启'
                                    : (_isFullLoop ? '全文循环模式开启' : '单次播放模式'),
                                style: const TextStyle(color: Colors.grey, fontSize: 11),
                              ),
                            ],
                          ),
                        ),
                        Row(
                          children: [
                            IconButton(
                              icon: Icon(
                                Icons.repeat_one,
                                color: _isSingleLoop ? Colors.blueAccent : Colors.grey,
                              ),
                              onPressed: () {
                                setState(() {
                                  _isSingleLoop = !_isSingleLoop;
                                  if (_isSingleLoop) {
                                    _isFullLoop = false;
                                  }
                                });
                              },
                              tooltip: '单句循环',
                            ),
                            IconButton(
                              icon: Icon(
                                Icons.repeat,
                                color: _isFullLoop ? Colors.blueAccent : Colors.grey,
                              ),
                              onPressed: () {
                                setState(() {
                                  _isFullLoop = !_isFullLoop;
                                  if (_isFullLoop) {
                                    _isSingleLoop = false;
                                  }
                                });
                              },
                              tooltip: '全文循环',
                            ),
                            const SizedBox(width: 8),
                            PopupMenuButton<double>(
                              icon: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                decoration: BoxDecoration(
                                  border: Border.all(color: _playbackSpeed == 1.0 ? Colors.grey : Colors.blueAccent),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '${_playbackSpeed}x',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: _playbackSpeed == 1.0 ? Colors.grey : Colors.blueAccent,
                                  ),
                                ),
                              ),
                              tooltip: '播放速度',
                              onSelected: (double speed) async {
                                setState(() {
                                  _playbackSpeed = speed;
                                });
                                if (_playerState == PlayerState.playing) {
                                  await _audioPlayer.setPlaybackRate(speed);
                                }
                              },
                              itemBuilder: (BuildContext context) => <PopupMenuEntry<double>>[
                                const PopupMenuItem<double>(value: 0.5, child: Text('0.5x 极慢')),
                                const PopupMenuItem<double>(value: 0.8, child: Text('0.8x 较慢')),
                                const PopupMenuItem<double>(value: 1.0, child: Text('1.0x 正常')),
                                const PopupMenuItem<double>(value: 1.2, child: Text('1.2x 稍快')),
                                const PopupMenuItem<double>(value: 1.5, child: Text('1.5x 较快')),
                                const PopupMenuItem<double>(value: 2.0, child: Text('2.0x 极快')),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),

                  // Chat-like sentence list
                  Expanded(
                    child: sentences.isEmpty
                        ? const Center(
                            child: Text(
                              '主题下暂无句子，请在下方追加句并解析 💡',
                              style: TextStyle(color: Colors.grey, fontSize: 13),
                            ),
                          )
                        : ListView.builder(
                            controller: _scrollController,
                            padding: const EdgeInsets.all(16),
                            itemCount: sentences.length,
                            itemBuilder: (context, index) {
                              final sent = sentences[index];
                              final isCurrentLine = _playingIndex == index;
                              final isLinePlaying = isCurrentLine && _playerState == PlayerState.playing;

                              return Padding(
                                padding: const EdgeInsets.only(bottom: 12.0),
                                child: Align(
                                  alignment: Alignment.centerLeft,
                                  child: Row(
                                    key: _bubbleKeys[index],
                                    crossAxisAlignment: CrossAxisAlignment.center,
                                    children: [
                                      Expanded(
                                        child: InkWell(
                                          onTap: () => _showSentenceDetails(context, sent, state.analyzing),
                                          borderRadius: BorderRadius.circular(16),
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                                            decoration: BoxDecoration(
                                              color: isCurrentLine
                                                  ? Colors.blue[950]?.withOpacity(0.4)
                                                  : const Color(0xFF1E293B),
                                              borderRadius: const BorderRadius.only(
                                                topLeft: Radius.circular(16),
                                                topRight: Radius.circular(16),
                                                bottomRight: Radius.circular(16),
                                                bottomLeft: Radius.circular(4),
                                              ),
                                              border: Border.all(
                                                color: isCurrentLine ? Colors.blueAccent : Colors.grey.withOpacity(0.1),
                                                width: isCurrentLine ? 2.0 : 1.0,
                                              ),
                                            ),
                                            child: Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Text(
                                                  sent.originalText,
                                                  style: TextStyle(
                                                    color: isCurrentLine ? Colors.white : const Color(0xFFE2E8F0),
                                                    fontWeight: isCurrentLine ? FontWeight.w600 : FontWeight.normal,
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
                                      const SizedBox(width: 8),
                                      IconButton(
                                        icon: Icon(
                                          isLinePlaying ? Icons.pause_circle : Icons.play_circle,
                                          color: isCurrentLine ? Colors.blueAccent : Colors.grey,
                                          size: 28,
                                        ),
                                        onPressed: () => _togglePlayLine(index, sentences),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            },
                          ),
                  ),

                  // Chat-like bottom input bar
                  Container(
                    padding: EdgeInsets.only(
                      left: 16,
                      right: 16,
                      top: 10,
                      bottom: 10 + MediaQuery.of(context).padding.bottom,
                    ),
                    decoration: const BoxDecoration(
                      color: Color(0xFF0F172A),
                      border: Border(top: BorderSide(color: Color(0xFF1E293B))),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _inputController,
                            style: const TextStyle(color: Colors.white, fontSize: 14),
                            textInputAction: TextInputAction.send,
                            onSubmitted: (val) {
                              if (val.trim().isNotEmpty && !state.analyzing) {
                                _sendSentence(val.trim());
                              }
                            },
                            decoration: InputDecoration(
                              hintText: state.analyzing ? 'AI 正在深度解析中...' : '追加英文新句子并解析...',
                              hintStyle: const TextStyle(color: Colors.grey, fontSize: 13),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              filled: true,
                              fillColor: const Color(0xFF1E293B),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(24),
                                borderSide: BorderSide.none,
                              ),
                              enabled: !state.analyzing,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IconButton(
                          icon: state.analyzing
                              ? const SizedBox(
                                  width: 24,
                                  height: 24,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                    color: Colors.blueAccent,
                                  ),
                                )
                              : const Icon(Icons.send, color: Colors.blueAccent),
                          onPressed: state.analyzing
                              ? null
                              : () {
                                  final val = _inputController.text.trim();
                                  if (val.isNotEmpty) {
                                    _sendSentence(val);
                                  }
                                },
                        ),
                      ],
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
