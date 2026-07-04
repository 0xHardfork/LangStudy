import '../models/grammar_model.dart';

abstract class GrammarState {}

class GrammarInitial extends GrammarState {}

class GrammarLoading extends GrammarState {}

class GrammarLoaded extends GrammarState {
  final List<GrammarArticle> history;
  final GrammarArticle? currentArticle;
  final bool analyzing;
  final String? error;

  GrammarLoaded({
    required this.history,
    this.currentArticle,
    this.analyzing = false,
    this.error,
  });

  GrammarLoaded copyWith({
    List<GrammarArticle>? history,
    GrammarArticle? Function()? currentArticle,
    bool? analyzing,
    String? Function()? error,
  }) {
    return GrammarLoaded(
      history: history ?? this.history,
      currentArticle: currentArticle != null ? currentArticle() : this.currentArticle,
      analyzing: analyzing ?? this.analyzing,
      error: error != null ? error() : this.error,
    );
  }
}

class GrammarError extends GrammarState {
  final String message;
  GrammarError(this.message);
}
