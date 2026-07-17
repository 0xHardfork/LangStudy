import '../models/subtitle_models.dart';

abstract class SubtitleState {}

class SubtitleInitial extends SubtitleState {}

class SubtitleLoading extends SubtitleState {}

class SubtitleLoaded extends SubtitleState {
  final List<SubtitleTopic> history;
  final List<SubtitleTopic> sharedHistory;
  final SubtitleTopic? currentTopic;
  final bool analyzing;
  final String? error;

  SubtitleLoaded({
    required this.history,
    this.sharedHistory = const [],
    this.currentTopic,
    this.analyzing = false,
    this.error,
  });

  SubtitleLoaded copyWith({
    List<SubtitleTopic>? history,
    List<SubtitleTopic>? sharedHistory,
    SubtitleTopic? Function()? currentTopic,
    bool? analyzing,
    String? Function()? error,
  }) {
    return SubtitleLoaded(
      history: history ?? this.history,
      sharedHistory: sharedHistory ?? this.sharedHistory,
      currentTopic: currentTopic != null ? currentTopic() : this.currentTopic,
      analyzing: analyzing ?? this.analyzing,
      error: error != null ? error() : this.error,
    );
  }
}

class SubtitleError extends SubtitleState {
  final String message;
  SubtitleError(this.message);
}
