class SubtitleBlock {
  final int id;
  final int topicId;
  final int blockIndex;
  final String startTime;
  final String endTime;
  final String rawText;
  final String targetText;
  final String nativeText;

  SubtitleBlock({
    required this.id,
    required this.topicId,
    required this.blockIndex,
    required this.startTime,
    required this.endTime,
    required this.rawText,
    required this.targetText,
    required this.nativeText,
  });

  factory SubtitleBlock.fromJson(Map<String, dynamic> json) {
    return SubtitleBlock(
      id: json['id'] as int,
      topicId: json['topic_id'] as int? ?? 0,
      blockIndex: json['block_index'] as int? ?? 0,
      startTime: json['start_time'] as String? ?? '',
      endTime: json['end_time'] as String? ?? '',
      rawText: json['raw_text'] as String? ?? '',
      targetText: json['target_text'] as String? ?? '',
      nativeText: json['native_text'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'topic_id': topicId,
      'block_index': blockIndex,
      'start_time': startTime,
      'end_time': endTime,
      'raw_text': rawText,
      'target_text': targetText,
      'native_text': nativeText,
    };
  }
}

class SubtitleSentence {
  final int id;
  final int topicId;
  final int sentenceIndex;
  final String originalText;
  final String translation;
  final String explanation;
  final String createdAt;

  SubtitleSentence({
    required this.id,
    required this.topicId,
    required this.sentenceIndex,
    required this.originalText,
    required this.translation,
    required this.explanation,
    required this.createdAt,
  });

  factory SubtitleSentence.fromJson(Map<String, dynamic> json) {
    return SubtitleSentence(
      id: json['id'] as int,
      topicId: json['topic_id'] as int? ?? 0,
      sentenceIndex: json['sentence_index'] as int? ?? 0,
      originalText: json['original_text'] as String? ?? '',
      translation: json['translation'] as String? ?? '',
      explanation: json['explanation'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'topic_id': topicId,
      'sentence_index': sentenceIndex,
      'original_text': originalText,
      'translation': translation,
      'explanation': explanation,
      'created_at': createdAt,
    };
  }
}

class SubtitleChunk {
  final int id;
  final int topicId;
  final int chunkIndex;
  final int startIndex;
  final int endIndex;
  final String rawContent;
  final String status;
  final String errorMessage;
  final String createdAt;
  final String updatedAt;

  SubtitleChunk({
    required this.id,
    required this.topicId,
    required this.chunkIndex,
    required this.startIndex,
    required this.endIndex,
    required this.rawContent,
    required this.status,
    required this.errorMessage,
    required this.createdAt,
    required this.updatedAt,
  });

  factory SubtitleChunk.fromJson(Map<String, dynamic> json) {
    return SubtitleChunk(
      id: json['id'] as int,
      topicId: json['topic_id'] as int? ?? 0,
      chunkIndex: json['chunk_index'] as int? ?? 0,
      startIndex: json['start_index'] as int? ?? 0,
      endIndex: json['end_index'] as int? ?? 0,
      rawContent: json['raw_content'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      errorMessage: json['error_message'] as String? ?? '',
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'topic_id': topicId,
      'chunk_index': chunkIndex,
      'start_index': startIndex,
      'end_index': endIndex,
      'raw_content': rawContent,
      'status': status,
      'error_message': errorMessage,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}

class SubtitleTopic {
  final int id;
  final int userId;
  final String title;
  final String originalFileName;
  final String nativeLanguage;
  final String targetLanguage;
  final String status;
  final bool isShared;
  final List<SubtitleBlock>? blocks;
  final List<SubtitleSentence>? sentences;
  final List<SubtitleChunk>? chunks;
  final String createdAt;

  SubtitleTopic({
    required this.id,
    required this.userId,
    required this.title,
    required this.originalFileName,
    required this.nativeLanguage,
    required this.targetLanguage,
    required this.status,
    required this.isShared,
    this.blocks,
    this.sentences,
    this.chunks,
    required this.createdAt,
  });

  factory SubtitleTopic.fromJson(Map<String, dynamic> json) {
    List<SubtitleBlock>? blks;
    if (json['blocks'] is List) {
      blks = (json['blocks'] as List)
          .map((i) => SubtitleBlock.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    List<SubtitleSentence>? sents;
    if (json['sentences'] is List) {
      sents = (json['sentences'] as List)
          .map((i) => SubtitleSentence.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    List<SubtitleChunk>? chks;
    if (json['chunks'] is List) {
      chks = (json['chunks'] as List)
          .map((i) => SubtitleChunk.fromJson(i as Map<String, dynamic>))
          .toList();
    }

    return SubtitleTopic(
      id: json['id'] as int,
      userId: json['user_id'] as int? ?? 0,
      title: json['title'] as String? ?? '',
      originalFileName: json['original_file_name'] as String? ?? '',
      nativeLanguage: json['native_language'] as String? ?? '',
      targetLanguage: json['target_language'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      isShared: json['is_shared'] as bool? ?? false,
      blocks: blks,
      sentences: sents,
      chunks: chks,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'title': title,
      'original_file_name': originalFileName,
      'native_language': nativeLanguage,
      'target_language': targetLanguage,
      'status': status,
      'is_shared': isShared,
      if (blocks != null) 'blocks': blocks!.map((b) => b.toJson()).toList(),
      if (sentences != null) 'sentences': sentences!.map((s) => s.toJson()).toList(),
      if (chunks != null) 'chunks': chunks!.map((c) => c.toJson()).toList(),
      'created_at': createdAt,
    };
  }
}
