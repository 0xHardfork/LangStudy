import '../../dialogue/models/dialogue_model.dart';

class ReviewItem {
  final int id;
  final int dialogueLineId;
  final String originalText;
  final String translation;
  final String? audioPath;
  final String nextReviewAt;
  final int reviewCount;
  final List<VocabularyItem> vocabulary;

  ReviewItem({
    required this.id,
    required this.dialogueLineId,
    required this.originalText,
    required this.translation,
    this.audioPath,
    required this.nextReviewAt,
    required this.reviewCount,
    required this.vocabulary,
  });

  factory ReviewItem.fromJson(Map<String, dynamic> json) {
    var vocabList = json['vocabulary'] as List? ?? [];
    List<VocabularyItem> vocabs = vocabList.map((i) => VocabularyItem.fromJson(i as Map<String, dynamic>)).toList();

    return ReviewItem(
      id: json['id'] as int,
      dialogueLineId: json['dialogue_line_id'] as int,
      originalText: json['original_text'] as String? ?? '',
      translation: json['translation'] as String? ?? '',
      audioPath: json['audio_path'] as String?,
      nextReviewAt: json['next_review_at'] as String? ?? '',
      reviewCount: json['review_count'] as int? ?? 0,
      vocabulary: vocabs,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'dialogue_line_id': dialogueLineId,
      'original_text': originalText,
      'translation': translation,
      'audio_path': audioPath,
      'next_review_at': nextReviewAt,
      'review_count': reviewCount,
      'vocabulary': vocabulary.map((v) => v.toJson()).toList(),
    };
  }
}
