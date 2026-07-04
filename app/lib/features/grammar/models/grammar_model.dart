class GrammarQuiz {
  final int id;
  final int sentenceId;
  final String question;
  final List<String> options;
  final int correctOption;
  final Map<int, String> explanations;
  final List<String> tags;
  final String createdAt;

  GrammarQuiz({
    required this.id,
    required this.sentenceId,
    required this.question,
    required this.options,
    required this.correctOption,
    required this.explanations,
    required this.tags,
    required this.createdAt,
  });

  factory GrammarQuiz.fromJson(Map<String, dynamic> json) {
    var opts = (json['options'] as List? ?? []).map((o) => o.toString()).toList();
    var tagsList = (json['tags'] as List? ?? []).map((t) => t.toString()).toList();

    Map<int, String> expls = {};
    if (json['explanations'] is Map) {
      (json['explanations'] as Map).forEach((k, v) {
        final parsedKey = int.tryParse(k.toString());
        if (parsedKey != null) {
          expls[parsedKey] = v.toString();
        }
      });
    }

    return GrammarQuiz(
      id: json['id'] as int,
      sentenceId: json['sentence_id'] as int,
      question: json['question'] as String? ?? '',
      options: opts,
      correctOption: json['correct_option'] as int? ?? 0,
      explanations: expls,
      tags: tagsList,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'sentence_id': sentenceId,
      'question': question,
      'options': options,
      'correct_option': correctOption,
      'explanations': explanations.map((k, v) => MapEntry(k.toString(), v)),
      'tags': tags,
      'created_at': createdAt,
    };
  }
}

class GrammarSentence {
  final int id;
  final int articleId;
  final int sentenceIndex;
  final String originalText;
  final String translation;
  final String explanation;
  final String? audioPath;
  final List<GrammarQuiz> quizzes;
  final String createdAt;

  GrammarSentence({
    required this.id,
    required this.articleId,
    required this.sentenceIndex,
    required this.originalText,
    required this.translation,
    required this.explanation,
    this.audioPath,
    required this.quizzes,
    required this.createdAt,
  });

  factory GrammarSentence.fromJson(Map<String, dynamic> json) {
    var quizzesList = json['quizzes'] as List? ?? [];
    List<GrammarQuiz> quizObjs = quizzesList.map((i) => GrammarQuiz.fromJson(i as Map<String, dynamic>)).toList();

    return GrammarSentence(
      id: json['id'] as int,
      articleId: json['article_id'] as int,
      sentenceIndex: json['sentence_index'] as int,
      originalText: json['original_text'] as String? ?? '',
      translation: json['translation'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      audioPath: json['audio_path'] as String?,
      quizzes: quizObjs,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'article_id': articleId,
      'sentence_index': sentenceIndex,
      'original_text': originalText,
      'translation': translation,
      'explanation': explanation,
      'audio_path': audioPath,
      'quizzes': quizzes.map((q) => q.toJson()).toList(),
      'created_at': createdAt,
    };
  }
}

class GrammarArticle {
  final int id;
  final int userId;
  final String title;
  final String rawText;
  final List<GrammarSentence>? sentences;
  final String createdAt;

  GrammarArticle({
    required this.id,
    required this.userId,
    required this.title,
    required this.rawText,
    this.sentences,
    required this.createdAt,
  });

  factory GrammarArticle.fromJson(Map<String, dynamic> json) {
    List<GrammarSentence>? sents;
    if (json['sentences'] is List) {
      sents = (json['sentences'] as List).map((i) => GrammarSentence.fromJson(i as Map<String, dynamic>)).toList();
    }

    return GrammarArticle(
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

class GrammarQuizReviewDetail {
  final int reviewId;
  final int grammarQuizId;
  final String question;
  final List<String> options;
  final int correctOption;
  final Map<int, String> explanations;
  final List<String> tags;
  final String nextReviewAt;
  final int reviewCount;
  final String sentenceText;
  final String sentenceTrans;
  final String sentenceExplain;
  final String? audioPath;

  GrammarQuizReviewDetail({
    required this.reviewId,
    required this.grammarQuizId,
    required this.question,
    required this.options,
    required this.correctOption,
    required this.explanations,
    required this.tags,
    required this.nextReviewAt,
    required this.reviewCount,
    required this.sentenceText,
    required this.sentenceTrans,
    required this.sentenceExplain,
    this.audioPath,
  });

  factory GrammarQuizReviewDetail.fromJson(Map<String, dynamic> json) {
    var opts = (json['options'] as List? ?? []).map((o) => o.toString()).toList();
    var tagsList = (json['tags'] as List? ?? []).map((t) => t.toString()).toList();

    Map<int, String> expls = {};
    if (json['explanations'] is Map) {
      (json['explanations'] as Map).forEach((k, v) {
        final parsedKey = int.tryParse(k.toString());
        if (parsedKey != null) {
          expls[parsedKey] = v.toString();
        }
      });
    }

    return GrammarQuizReviewDetail(
      reviewId: json['review_id'] as int,
      grammarQuizId: json['grammar_quiz_id'] as int,
      question: json['question'] as String? ?? '',
      options: opts,
      correctOption: json['correct_option'] as int? ?? 0,
      explanations: expls,
      tags: tagsList,
      nextReviewAt: json['next_review_at'] as String? ?? '',
      reviewCount: json['review_count'] as int? ?? 0,
      sentenceText: json['sentence_text'] as String? ?? '',
      sentenceTrans: json['sentence_trans'] as String? ?? '',
      sentenceExplain: json['sentence_explain'] as String? ?? '',
      audioPath: json['audio_path'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'review_id': reviewId,
      'grammar_quiz_id': grammarQuizId,
      'question': question,
      'options': options,
      'correct_option': correctOption,
      'explanations': explanations.map((k, v) => MapEntry(k.toString(), v)),
      'tags': tags,
      'next_review_at': nextReviewAt,
      'review_count': reviewCount,
      'sentence_text': sentenceText,
      'sentence_trans': sentenceTrans,
      'sentence_explain': sentenceExplain,
      'audio_path': audioPath,
    };
  }
}
