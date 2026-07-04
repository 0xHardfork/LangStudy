import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import '../../core/config/app_config.dart';

class AudioPlayerControl extends StatefulWidget {
  final String? audioPath;

  const AudioPlayerControl({super.key, this.audioPath});

  @override
  State<AudioPlayerControl> createState() => _AudioPlayerControlState();
}

class _AudioPlayerControlState extends State<AudioPlayerControl> {
  late final AudioPlayer _audioPlayer;
  PlayerState _playerState = PlayerState.stopped;

  @override
  void initState() {
    super.initState();
    _audioPlayer = AudioPlayer();
    _audioPlayer.onPlayerStateChanged.listen((state) {
      if (mounted) {
        setState(() {
          _playerState = state;
        });
      }
    });
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  Future<void> _play() async {
    final path = widget.audioPath;
    if (path == null || path.isEmpty) return;

    final baseUrl = AppConfig.instance.baseUrl;
    // Strip double slashes if present
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final fullUrl = path.startsWith('http') ? path : '$baseUrl/$cleanPath';

    try {
      if (_playerState == PlayerState.playing) {
        await _audioPlayer.pause();
      } else {
        await _audioPlayer.stop();
        await _audioPlayer.play(UrlSource(fullUrl));
      }
    } catch (_) {
      // Audio playback failed
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.audioPath == null || widget.audioPath!.isEmpty) {
      return const SizedBox.shrink();
    }

    final isPlaying = _playerState == PlayerState.playing;

    return IconButton(
      icon: Icon(
        isPlaying ? Icons.pause_circle_filled : Icons.play_circle_filled,
        size: 32,
        color: Colors.deepPurpleAccent,
      ),
      onPressed: _play,
      tooltip: '播放语音',
    );
  }
}
