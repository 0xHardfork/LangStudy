import '../models/reading_models.dart';

abstract class ReadingState {}

class ReadingInitial extends ReadingState {}

class ReadingLoading extends ReadingState {}

class ReadingLoaded extends ReadingState {
  final List<ReadingArticle> history;
  final ReadingArticle? currentArticle;
  final bool analyzing;
  final String? error;

  ReadingLoaded({
    required this.history,
    this.currentArticle,
    this.analyzing = false,
    this.error,
  });

  ReadingLoaded copyWith({
    List<ReadingArticle>? history,
    ReadingArticle? Function()? currentArticle,
    bool? analyzing,
    String? Function()? error,
  }) {
    return ReadingLoaded(
      history: history ?? this.history,
      currentArticle: currentArticle != null ? currentArticle() : this.currentArticle,
      analyzing: analyzing ?? this.analyzing,
      error: error != null ? error() : this.error,
    );
  }
}

class ReadingError extends ReadingState {
  final String message;
  ReadingError(this.message);
}
