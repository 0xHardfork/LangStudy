import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import '../../../core/config/app_config.dart';
import '../../dialogue/models/dialogue_model.dart';

class DialogueFullTextPage extends StatefulWidget {
  final Dialogue dialogue;

  const DialogueFullTextPage({super.key, required this.dialogue});

  @override
  State<DialogueFullTextPage> createState() => _DialogueFullTextPageState();
}

class _DialogueFullTextPageState extends State<DialogueFullTextPage> {
  late final AudioPlayer _audioPlayer;
  late final List<GlobalKey> _bubbleKeys;

  int? _playingIndex;
  bool _isSingleLoop = false;
  bool _isFullLoop = false;
  bool _showTranslation = true;
  PlayerState _playerState = PlayerState.stopped;
  bool _isSwitchingSource = false;
  double _playbackSpeed = 1.0;

  @override
  void initState() {
    super.initState();
    _bubbleKeys = List.generate(widget.dialogue.lines.length, (_) => GlobalKey());
    _audioPlayer = AudioPlayer();

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
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _playLine(int index) async {
    if (index < 0 || index >= widget.dialogue.lines.length) return;
    final line = widget.dialogue.lines[index];
    final path = line.audioPath;
    if (path == null || path.isEmpty) return;

    final baseUrl = AppConfig.instance.baseUrl;
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final fullUrl = path.startsWith('http') ? path : '$baseUrl/$cleanPath';

    setState(() {
      _playingIndex = index;
      _isSwitchingSource = true;
    });

    // Auto-scroll to the active line
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

  Future<void> _togglePlayLine(int index) async {
    if (_playingIndex == index) {
      if (_playerState == PlayerState.playing) {
        await _audioPlayer.pause();
      } else {
        await _audioPlayer.resume();
        await _audioPlayer.setPlaybackRate(_playbackSpeed);
      }
    } else {
      await _playLine(index);
    }
  }

  void _onPlaybackComplete() {
    if (!mounted) return;

    // Use a small delay to allow the native audio engine (AVPlayer) to transition state
    Future.delayed(const Duration(milliseconds: 250), () {
      if (!mounted) return;
      if (_isSingleLoop && _playingIndex != null) {
        _playLine(_playingIndex!);
      } else if (_isFullLoop && _playingIndex != null) {
        final nextIndex = _playingIndex! + 1;
        if (nextIndex < widget.dialogue.lines.length) {
          _playLine(nextIndex);
        } else {
          _playLine(0); // Loop back to the first line
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

  @override
  Widget build(BuildContext context) {
    final totalLines = widget.dialogue.lines.length;
    final currentPos = _playingIndex != null ? _playingIndex! + 1 : 0;

    return Scaffold(
      backgroundColor: const Color(0xFF020617), // slate-950
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('对话全文', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            Text(widget.dialogue.topic, style: const TextStyle(fontSize: 12, color: Colors.grey)),
          ],
        ),
        backgroundColor: const Color(0xFF0F172A), // slate-900
        elevation: 0,
      ),
      body: Column(
        children: [
          // Glassmorphic Player Control Panel
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              border: Border(bottom: BorderSide(color: Color(0xFF1E293B))),
            ),
            child: Column(
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    // Playback status indicators
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _playingIndex != null
                                ? '${_playerState == PlayerState.playing ? "正在播放" : "已暂停"} 第 $currentPos / $totalLines 句'
                                : '未开始播放',
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            _isSingleLoop
                                ? '单句循环模式开启'
                                : (_isFullLoop ? '全文循环模式开启' : '单次播放模式'),
                            style: const TextStyle(color: Colors.grey, fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                    // Action controls
                    Row(
                      children: [
                        // Show/Hide Translation
                        IconButton(
                          icon: Icon(
                            _showTranslation ? Icons.visibility : Icons.visibility_off,
                            color: _showTranslation ? Colors.blueAccent : Colors.grey,
                          ),
                          onPressed: () {
                            setState(() {
                              _showTranslation = !_showTranslation;
                            });
                          },
                          tooltip: _showTranslation ? '隐藏翻译' : '显示翻译',
                        ),
                        // Single Loop Toggle
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
                        // Full Loop Toggle
                        IconButton(
                          icon: Icon(
                            Icons.repeat,
                            color: _isFullLoop ? Colors.blueAccent : Colors.grey,
                          ),
                          onPressed: () {
                            setState(() {
                              _isFullLoop = !_isFullLoop;
                              if (_isFullLoop) {
                                _isSingleLoop = false; // Disable single loop
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
                                fontSize: 12, 
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
              ],
            ),
          ),

          // Conversation ListView
          Expanded(
            child: SelectionArea(
              child: ListView.builder(
                physics: const AlwaysScrollableScrollPhysics(
                  parent: BouncingScrollPhysics(),
                ),
                padding: const EdgeInsets.all(16.0),
                itemCount: totalLines,
                itemBuilder: (context, index) {
                  final line = widget.dialogue.lines[index];
                  final isSpeakerA = line.speaker == 'A';
                  final isCurrentLine = _playingIndex == index;
                  final isLinePlaying = isCurrentLine && _playerState == PlayerState.playing;

                  return Container(
                    key: _bubbleKeys[index],
                    margin: const EdgeInsets.only(bottom: 16.0),
                    padding: const EdgeInsets.all(12.0),
                    decoration: BoxDecoration(
                      color: isCurrentLine
                          ? (isSpeakerA ? Colors.blue[950]?.withOpacity(0.4) : Colors.purple[950]?.withOpacity(0.4))
                          : const Color(0xFF0F172A), // slate-900
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isCurrentLine
                            ? (isSpeakerA ? Colors.blueAccent : Colors.purpleAccent)
                            : const Color(0xFF1E293B),
                        width: isCurrentLine ? 2.0 : 1.0,
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Speaker Avatar
                        CircleAvatar(
                          backgroundColor: isSpeakerA ? Colors.blue[900] : Colors.purple[900],
                          radius: 18,
                          child: Text(
                            line.speaker,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ),
                        const SizedBox(width: 12),

                        // Text Content Bubble
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                line.originalText,
                                style: TextStyle(
                                  fontSize: 16,
                                  color: isCurrentLine ? Colors.white : const Color(0xFFE2E8F0),
                                  fontWeight: isCurrentLine ? FontWeight.w600 : FontWeight.normal,
                                ),
                              ),
                              if (_showTranslation) ...[
                                const SizedBox(height: 6),
                                Text(
                                  line.translation,
                                  style: const TextStyle(fontSize: 13, color: Colors.grey),
                                ),
                              ],
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),

                        // Play/Pause Action next to the bubble
                        IconButton(
                          icon: Icon(
                            isLinePlaying ? Icons.pause_circle : Icons.play_circle,
                            color: isCurrentLine
                                ? (isSpeakerA ? Colors.blueAccent : Colors.purpleAccent)
                                : Colors.grey,
                            size: 28,
                          ),
                          onPressed: () => _togglePlayLine(index),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}
