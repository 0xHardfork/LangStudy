import '../datasource/dialogue_datasource.dart';
import '../../models/dialogue_model.dart';

class DialogueRepository {
  final DialogueDatasource _datasource;

  DialogueRepository(this._datasource);

  Future<List<DialogueType>> getDialogueTypes() {
    return _datasource.getDialogueTypes();
  }

  Future<Dialogue> generateDialogue({
    required String topic,
    required String language,
    required String level,
  }) {
    return _datasource.generateDialogue(topic: topic, language: language, level: level);
  }

  Future<DialogueWithProgress> getSharedDialogue({
    required String topic,
    required String language,
    required String level,
  }) {
    return _datasource.getSharedDialogue(topic: topic, language: language, level: level);
  }

  Future<DialogueWithProgress?> getActiveDialogue() {
    return _datasource.getActiveDialogue();
  }

  Future<void> updateDialogueProgress({
    required int dialogueId,
    required int lineIndex,
    required bool completed,
  }) {
    return _datasource.updateDialogueProgress(dialogueId: dialogueId, lineIndex: lineIndex, completed: completed);
  }

  Future<Dialogue> regenerateDialogue({
    required int prevDialogueId,
    required String topic,
    required String language,
    required String level,
    required String hint,
    required String nativeLanguage,
  }) {
    return _datasource.regenerateDialogue(
      prevDialogueId: prevDialogueId,
      topic: topic,
      language: language,
      level: level,
      hint: hint,
      nativeLanguage: nativeLanguage,
    );
  }

  Future<Dialogue> getDialogue(int id) {
    return _datasource.getDialogue(id);
  }

  Future<Map<String, dynamic>> listDialogues({
    required int page,
    required int pageSize,
    String? search,
  }) {
    return _datasource.listDialogues(page: page, pageSize: pageSize, search: search);
  }

  Future<void> rejectDialogue(int id) {
    return _datasource.rejectDialogue(id);
  }
}
