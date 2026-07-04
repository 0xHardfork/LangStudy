import 'dart:async';
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
  AudioPlayer? _audioPlayer;
  PlayerState _playerState = PlayerState.stopped;
  StreamSubscription? _stateSubscription;

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _cleanupPlayer(fromDispose: true);
    super.dispose();
  }

  void _cleanupPlayer({bool fromDispose = false}) {
    _stateSubscription?.cancel();
    _stateSubscription = null;
    _audioPlayer?.dispose();
    _audioPlayer = null;
    if (!fromDispose && mounted) {
      setState(() {
        _playerState = PlayerState.stopped;
      });
    }
  }

  Future<void> _play() async {
    final path = widget.audioPath;
    if (path == null || path.isEmpty) return;

    final baseUrl = AppConfig.instance.baseUrl;
    // Strip double slashes if present
    final cleanPath = path.startsWith('/') ? path.substring(1) : path;
    final fullUrl = path.startsWith('http') ? path : '$baseUrl/$cleanPath';

    try {
      if (_audioPlayer == null) {
        final player = AudioPlayer();
        _audioPlayer = player;
        _stateSubscription = player.onPlayerStateChanged.listen((state) {
          if (mounted) {
            setState(() {
              _playerState = state;
            });
          }
          if (state == PlayerState.completed) {
            _cleanupPlayer();
          }
        });
      }

      if (_playerState == PlayerState.playing) {
        await _audioPlayer?.pause();
      } else {
        await _audioPlayer?.stop();
        await _audioPlayer?.play(UrlSource(fullUrl));
      }
    } catch (_) {
      _cleanupPlayer();
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
