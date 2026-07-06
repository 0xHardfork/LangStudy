class ReadingSentence {
  final int id;
  final int articleId;
  final int sentenceIndex;
  final int paragraphIndex;
  final String originalText;
  final String translation;
  final String explanation;
  final String? audioPath;
  final String createdAt;

  ReadingSentence({
    required this.id,
    required this.articleId,
    required this.sentenceIndex,
    required this.paragraphIndex,
    required this.originalText,
    required this.translation,
    required this.explanation,
    this.audioPath,
    required this.createdAt,
  });

  factory ReadingSentence.fromJson(Map<String, dynamic> json) {
    return ReadingSentence(
      id: json['id'] as int,
      articleId: json['article_id'] as int,
      sentenceIndex: json['sentence_index'] as int? ?? 0,
      paragraphIndex: json['paragraph_index'] as int? ?? 0,
      originalText: json['original_text'] as String? ?? '',
      translation: json['translation'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      audioPath: json['audio_path'] as String?,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'article_id': articleId,
      'sentence_index': sentenceIndex,
      'paragraph_index': paragraphIndex,
      'original_text': originalText,
      'translation': translation,
      'explanation': explanation,
      'audio_path': audioPath,
      'created_at': createdAt,
    };
  }
}

class ReadingArticle {
  final int id;
  final int userId;
  final String title;
  final String rawText;
  final List<ReadingSentence>? sentences;
  final String createdAt;

  ReadingArticle({
    required this.id,
    required this.userId,
    required this.title,
    required this.rawText,
    this.sentences,
    required this.createdAt,
  });

  factory ReadingArticle.fromJson(Map<String, dynamic> json) {
    List<ReadingSentence>? sents;
    if (json['sentences'] is List) {
      sents = (json['sentences'] as List)
          .map((i) => ReadingSentence.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    return ReadingArticle(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      title: json['title'] as String? ?? '',
      rawText: json['raw_text'] as String? ?? '',
      sentences: sents,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'title': title,
      'raw_text': rawText,
      if (sentences != null) 'sentences': sentences!.map((s) => s.toJson()).toList(),
      'created_at': createdAt,
    };
  }
}
