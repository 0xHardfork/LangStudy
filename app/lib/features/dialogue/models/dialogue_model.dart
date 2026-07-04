class VocabularyItem {
  final int id;
  final int dialogueLineId;
  final String word;
  final int wordIndex;
  final int importance; // 1-4

  VocabularyItem({
    required this.id,
    required this.dialogueLineId,
    required this.word,
    required this.wordIndex,
    required this.importance,
  });

  factory VocabularyItem.fromJson(Map<String, dynamic> json) {
    return VocabularyItem(
      id: json['id'] as int,
      dialogueLineId: json['dialogue_line_id'] as int,
      word: json['word'] as String,
      wordIndex: json['word_index'] as int,
      importance: json['importance'] as int,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'dialogue_line_id': dialogueLineId,
      'word': word,
      'word_index': wordIndex,
      'importance': importance,
    };
  }
}

class DialogueLine {
  final int id;
  final int dialogueId;
  final int lineIndex;
  final String speaker; // "A" | "B"
  final String originalText;
  final String translation;
  final String? audioPath;
  final List<VocabularyItem> vocabulary;

  DialogueLine({
    required this.id,
    required this.dialogueId,
    required this.lineIndex,
    required this.speaker,
    required this.originalText,
    required this.translation,
    this.audioPath,
    required this.vocabulary,
  });

  factory DialogueLine.fromJson(Map<String, dynamic> json) {
    var vocabList = json['vocabulary'] as List? ?? [];
    List<VocabularyItem> vocabs = vocabList.map((i) => VocabularyItem.fromJson(i as Map<String, dynamic>)).toList();

    return DialogueLine(
      id: json['id'] as int,
      dialogueId: json['dialogue_id'] as int,
      lineIndex: json['line_index'] as int,
      speaker: json['speaker'] as String,
      originalText: json['original_text'] as String,
      translation: json['translation'] as String,
      audioPath: json['audio_path'] as String?,
      vocabulary: vocabs,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'dialogue_id': dialogueId,
      'line_index': lineIndex,
      'speaker': speaker,
      'original_text': originalText,
      'translation': translation,
      'audio_path': audioPath,
      'vocabulary': vocabulary.map((v) => v.toJson()).toList(),
    };
  }
}

class Dialogue {
  final int id;
  final int userId;
  final String language;
  final String level;
  final String topic;
  final bool isRejected;
  final List<DialogueLine> lines;
  final String createdAt;

  Dialogue({
    required this.id,
    required this.userId,
    required this.language,
    required this.level,
    required this.topic,
    required this.isRejected,
    required this.lines,
    required this.createdAt,
  });

  factory Dialogue.fromJson(Map<String, dynamic> json) {
    var linesList = json['lines'] as List? ?? [];
    List<DialogueLine> lines = linesList.map((i) => DialogueLine.fromJson(i as Map<String, dynamic>)).toList();

    return Dialogue(
      id: json['id'] as int,
      userId: json['user_id'] as int,
      language: json['language'] as String,
      level: json['level'] as String,
      topic: json['topic'] as String,
      isRejected: json['is_rejected'] as bool? ?? false,
      lines: lines,
      createdAt: json['created_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'user_id': userId,
      'language': language,
      'level': level,
      'topic': topic,
      'is_rejected': isRejected,
      'lines': lines.map((l) => l.toJson()).toList(),
      'created_at': createdAt,
    };
  }
}

class DialogueWithProgress {
  final Dialogue dialogue;
  final int currentLineIndex;

  DialogueWithProgress({
    required this.dialogue,
    required this.currentLineIndex,
  });

  factory DialogueWithProgress.fromJson(Map<String, dynamic> json) {
    return DialogueWithProgress(
      dialogue: Dialogue.fromJson(json['dialogue'] as Map<String, dynamic>),
      currentLineIndex: json['current_line_index'] as int? ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'dialogue': dialogue.toJson(),
      'current_line_index': currentLineIndex,
    };
  }
}

class DialogueType {
  final int id;
  final String name;
  final String description;
  final String emoji;
  final int sortOrder;
  final String createdAt;
  final String updatedAt;

  DialogueType({
    required this.id,
    required this.name,
    required this.description,
    required this.emoji,
    required this.sortOrder,
    required this.createdAt,
    required this.updatedAt,
  });

  factory DialogueType.fromJson(Map<String, dynamic> json) {
    return DialogueType(
      id: json['id'] as int,
      name: json['name'] as String? ?? '',
      description: json['description'] as String? ?? '',
      emoji: json['emoji'] as String? ?? '',
      sortOrder: json['sort_order'] as int? ?? 0,
      createdAt: json['created_at'] as String? ?? '',
      updatedAt: json['updated_at'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'emoji': emoji,
      'sort_order': sortOrder,
      'created_at': createdAt,
      'updated_at': updatedAt,
    };
  }
}
