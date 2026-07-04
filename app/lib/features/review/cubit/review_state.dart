import '../models/review_model.dart';
import '../../grammar/models/grammar_model.dart';

abstract class ReviewState {}

class ReviewInitial extends ReviewState {}

class ReviewLoading extends ReviewState {}

class ReviewLoaded extends ReviewState {
  final List<ReviewItem> dueReviews;
  final List<ReviewItem> allReviews;
  final List<GrammarQuizReviewDetail> dueGrammarReviews;

  ReviewLoaded({
    required this.dueReviews,
    required this.allReviews,
    required this.dueGrammarReviews,
  });
}

class ReviewError extends ReviewState {
  final String message;
  ReviewError(this.message);
}
